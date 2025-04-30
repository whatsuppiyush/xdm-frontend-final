// workers/send-DM.js
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const http = require('http');
const { getUserDailyMessageLimit, getEnvironmentAdjustedLimit } = require('./planLimits');
const { Lock } = require("@upstash/lock");

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// Constants
const MAX_RETRIES = 2;
const PROCESSING_QUEUE = 'dm:processing:queue';
const QUEUE_PREFIX = 'queue:';
const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';

// Handle any initialization failures gracefully
process.on('unhandledRejection', (error) => {
  console.error('unhandledRejection', error);
});

// Create a simple health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start the server on the specified port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

class CampaignQueue {
  constructor(campaignId) {
    this.campaignId = campaignId;
    this.queue = [];
    this.processedRecipients = [];
    this.totalAttempts = 0;
    this.status = 'Ready'; // Ready, Running, Paused, Stopped, Rate Limited
    this.browser = null;
    // Add error count tracking for browser restarts per recipient
    this.recipientErrorCounts = {};
    this.composerErrorCounts = {};
  }

  async loadFromRedis() {
    const queueData = await redis.get(`${QUEUE_PREFIX}${this.campaignId}`);
    if (queueData) {
      this.queue = queueData.queue || [];
      this.processedRecipients = queueData.processedRecipients || [];
      this.status = queueData.status || 'Ready';
      this.totalAttempts = queueData.totalAttempts || 0;
    }
  }

  async saveToRedis() {
    const queueState = {
      queue: this.queue,
      processedRecipients: this.processedRecipients,
      status: this.status,
      totalAttempts: this.totalAttempts
    };
    await redis.set(`${QUEUE_PREFIX}${this.campaignId}`, queueState);
  }

  async process(dmWorker) {
    await this.loadFromRedis();
    console.log(`Processing campaign ${this.campaignId}, status: ${this.status}`);
    
    // Only proceed if status is Ready or Running
    if (this.status === 'Stopped' || this.status === 'Paused') return;
    
    // Set status to Running
    this.status = 'Running';
    await this.saveToRedis();
    
    // Update message status in database to In Progress
    try {
      await prisma.message.update({
        where: { id: this.campaignId },
        data: { status: 'In Progress' }
      });
    } catch (error) {
      console.error('Failed to update message status:', error);
    }
    
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;
    let recipientsToRetry = [];
    
    try {
      // Launch browser if not already launched
      if (!dmWorker.browser) {
        await dmWorker.launchBrowser();
      }
      
      // Add any recipients that need retry from previous browser crash
      if (recipientsToRetry.length > 0) {
        console.log(`Adding ${recipientsToRetry.length} recipients back to the queue for retry`);
        this.queue = [...recipientsToRetry, ...this.queue];
        recipientsToRetry = [];
        await this.saveToRedis();
      }

      while (this.queue.length > 0 && this.status === 'Running') {
        await this.loadFromRedis();
        if (this.status !== 'Running') break;

        const { recipientId, message, cookies, userId } = this.queue[0];
        
        if (this.processedRecipients.includes(recipientId)) {
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }

        // Check daily limit every 5 messages or on the first message
        if (limitCheckCounter % 5 === 0) {
          if (!userId) {
            console.error(`userId is undefined for campaign: ${this.campaignId}`);
            
            // Try to get userId from database as fallback
            try {
              const campaign = await prisma.message.findUnique({
                where: { id: this.campaignId },
                select: { userId: true }
              });
              
              if (campaign?.userId) {
                console.log(`Found userId ${campaign.userId} from database for campaign ${this.campaignId}`);
                // Update the current queue item
                this.queue[0].userId = campaign.userId;
                await this.saveToRedis();
                
                // Continue with the updated userId
                const limitCheck = await dmWorker.checkDailyLimit(campaign.userId);
                
                if (!limitCheck.canSend) {
                  console.log(`Daily limit reached for user ${campaign.userId}. Setting campaign to Rate Limited.`);
                  this.status = 'Rate Limited';
                  await this.saveToRedis();
                  
                  // Update message status in database
                  await prisma.message.update({
                    where: { id: this.campaignId },
                    data: { status: 'Rate Limited' }
                  });
                  
                  // Exit the processing loop
                  return;
                }
              }
            } catch (error) {
              console.error("Error fetching userId from database:", error);
            }
            
            // Skip this message if no userId found
            this.queue.shift();
            await this.saveToRedis();
            continue;
          }
          
          const limitCheck = await dmWorker.checkDailyLimit(userId);
          
          if (!limitCheck.canSend) {
            console.log(`Daily limit reached for user ${userId}. Setting campaign to Rate Limited.`);
            this.status = 'Rate Limited';
            await this.saveToRedis();
            
            // Update message status in database
            await prisma.message.update({
              where: { id: this.campaignId },
              data: { status: 'Rate Limited' }
            });
            
            return; // Exit the processing loop
          }
        }
        limitCheckCounter++;

        // Apply random delay between messages (2-4 minutes)
        const delay = Math.floor(Math.random() * (240000 - 120000 + 1) + 120000);
        console.log(`Waiting ${delay/60000} minutes before sending next message`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reload queue state after delay to check for status changes
        await this.loadFromRedis();
        if (this.status !== 'Running') {
          console.log(`Campaign ${this.campaignId} status changed to ${this.status} during delay, stopping processing`);
          break;
        }

        try {
          const result = await dmWorker.sendDM(recipientId, message, cookies);
          if (result === true) {
            if (userId) {
              await dmWorker.incrementDailyLimit(userId);
              console.log(`Incremented daily message count for user ${userId} after successful send`);
            }
            
            // Update message status in database
            await dmWorker.updateMessageStatus(this.campaignId, recipientId);
            
            // Update processed recipients list
            this.processedRecipients.push(recipientId);
            this.queue.shift();
            this.totalAttempts = 0;
            
            // Reset consecutive errors counter on success
            consecutiveMemoryErrors = 0;
            // Reset error count on success
            this.recipientErrorCounts[recipientId] = 0;
            this.composerErrorCounts = this.composerErrorCounts || {};
            this.composerErrorCounts[recipientId] = 0;
          } else if (result === 'composer_not_found') {
            this.composerErrorCounts = this.composerErrorCounts || {};
            this.composerErrorCounts[recipientId] = (this.composerErrorCounts[recipientId] || 0) + 1;
            if (this.composerErrorCounts[recipientId] >= 3) {
              console.log(`[${recipientId}] Hit max composer not found errors (3), skipping recipient.`);
              this.processedRecipients.push(recipientId);
              this.queue.shift();
              this.totalAttempts = 0;
              await this.saveToRedis();
              continue;
            } else {
              console.log(`[${recipientId}] Composer not found, will retry (attempt ${this.composerErrorCounts[recipientId]})`);
              // Wait a short time before retrying
              await new Promise(resolve => setTimeout(resolve, 10000));
              await this.saveToRedis();
              continue;
            }
          } else {
            this.handleFailedAttempt(recipientId);
          }
        } catch (error) {
          // Track browser restart/cooldown attempts per recipient
          const MAX_BROWSER_RESTARTS_PER_RECIPIENT = 3;
          this.recipientErrorCounts[recipientId] = (this.recipientErrorCounts[recipientId] || 0) + 1;
          // Log the error reason
          console.error(`[${recipientId}] Browser restart/cooldown error: ${error.message}`);
          if (this.recipientErrorCounts[recipientId] >= MAX_BROWSER_RESTARTS_PER_RECIPIENT) {
            console.log(`[${recipientId}] Hit max browser restarts (${MAX_BROWSER_RESTARTS_PER_RECIPIENT}), skipping recipient.`);
            this.processedRecipients.push(recipientId);
            this.queue.shift();
            await this.saveToRedis();
            continue;
          }
          // Check for memory-related errors
          console.log("Error in send attempt:", error);
          if (dmWorker.isMemoryError(error)) {
            // Increment consecutive errors
            consecutiveMemoryErrors++;
            console.log(`Browser memory issue detected: ${error.message}`);
            console.log(`Performing browser restart and cooldown (attempt ${++browserRestartCount}, consecutive: ${consecutiveMemoryErrors})`);
            
            // Save current state
            await this.saveToRedis();
            
            // Add current recipient to retry list
            const currentRecipient = this.queue[0];
            recipientsToRetry.push(currentRecipient);
            console.log("Recipients to retry:", recipientsToRetry);
            
            // Remove from current queue to avoid duplicate processing
            this.queue.shift();
            await this.saveToRedis();
            
            // Progressive cooldown period - increases with consecutive errors
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors * 2), 10);
            console.log(`Cooling down for ${cooldownMinutes} minutes before restarting browser`);
            
            // Close browser BEFORE cooldown to free up memory
            await dmWorker.closeBrowser();
            
            // Perform the actual cooldown
            await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60000));
            console.log(`Cooldown completed, restarting browser`);
            
            // Restart browser
            try {
              await dmWorker.launchBrowser();
              console.log("Browser restarted successfully after cooldown");
              
              // Add failed recipients back to the beginning of the queue
              this.queue = [...recipientsToRetry, ...this.queue];
              recipientsToRetry = [];
              await this.saveToRedis();
              
              // Continue the loop from the beginning
              continue;
            } catch (restartError) {
              console.error('Error restarting browser:', restartError);
              break;
            }
          } else {
            // For non-memory errors, handle as a regular failed attempt
            console.error(`Error sending DM to ${recipientId}:`, error);
            this.handleFailedAttempt(recipientId);
          }
        }
        
        // Save state after each message
        await this.saveToRedis();
      }
      
      // If we've processed all messages, mark as Completed
      if (this.queue.length === 0) {
        this.status = 'Completed';
        await this.saveToRedis();
        
        // Update the message status in database
        await prisma.message.update({
          where: { id: this.campaignId },
          data: { status: 'Completed' }
        });
        
        // Clean up Redis queue if completed
        await redis.del(`${QUEUE_PREFIX}${this.campaignId}`);
      }
      
    } catch (error) {
      console.error(`Error processing campaign ${this.campaignId}:`, error);
    } finally {
      // Do not close the browser here, as it's managed by the DMWorker
    }
  }

  handleFailedAttempt(recipientId) {
    this.totalAttempts++;
    
    if (this.totalAttempts >= MAX_RETRIES) {
      console.log(`Max retries reached for recipient ${recipientId}, marking as processed`);
      this.processedRecipients.push(recipientId);
      this.queue.shift();
      this.totalAttempts = 0;
    }
  }
}

class DMWorker {
  constructor() {
    this.browser = null;
    this.isProcessing = false;
    this.currentCampaignId = null;
    
    // Set up heartbeat interval
    this.startHeartbeat();
  }
  
  async startHeartbeat() {
    // Send initial heartbeat
    await this.sendHeartbeat();
    
    // Set up interval (every minute)
    setInterval(async () => {
      await this.sendHeartbeat();
    }, 60 * 1000);
  }
  
  async sendHeartbeat() {
    try {
      await redis.set(WORKER_HEARTBEAT_KEY, Date.now().toString());
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  async initialize() {
    console.log('Initializing DM worker...');
    
    // Recovery logic - find any campaigns that were interrupted
    await this.recoverActiveCampaigns();
    
    // Start the processing loop
    this.startProcessingLoop();
  }

  async startProcessingLoop() {
    console.log('Starting processing loop...');
    
    // Run continuously
    while (true) {
      try {
        if (!this.isProcessing) {
          // Check for new tasks
          await this.processNextTask();
        }
        
        // Wait a bit before checking again to avoid hammering Redis
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error('Error in processing loop:', error);
        // Wait a bit longer on error
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  async processNextTask() {
    const queueKeys = await redis.keys(`${QUEUE_PREFIX}*`);
    console.log(`Found ${queueKeys.length} campaign queues in Redis`);
    for (const queueKey of queueKeys) {
      const campaignId = queueKey.split(':')[1];
      if (!campaignId) continue;
      
      const campaignQueue = new CampaignQueue(campaignId);
      await campaignQueue.loadFromRedis();
      
      if (campaignQueue.queue.length > 0 && campaignQueue.status === 'Running') {
        // Distributed lock section
        const lock = new Lock({
          id: `lock:campaign:${campaignId}`,
          redis: redis,
          lease: 60000 // 60 seconds
        });

        if (await lock.acquire()) {
          let lockRenewal;
          try {
            // Start lock renewal every 30 seconds
            lockRenewal = setInterval(() => {
              lock.extend(60000).catch(e => {
                console.error(`Failed to extend lock for campaign ${campaignId}:`, e);
              });
            }, 30000);
            console.log(`Processing campaign ${campaignId}`);
            this.isProcessing = true;
            this.currentCampaignId = campaignId;
            await campaignQueue.process(this);
            this.isProcessing = false;
            this.currentCampaignId = null;
          } finally {
            clearInterval(lockRenewal);
            await lock.release();
          }
          break;
        } else {
          console.log(`Could not acquire lock for campaign ${campaignId}, skipping...`);
        }
      }
    }
  }

  async updateMessageStatus(campaignId, recipientId) {
    try {
      // Find and update the message for this specific campaign
      const messageRecord = await prisma.message.findUnique({
        where: { id: campaignId }
      });

      if (messageRecord) {
        const updatedMessages = messageRecord.messages.map(msg => 
          msg.recipientId === recipientId 
            ? { ...msg, status: true }
            : msg
        );

        await prisma.message.update({
          where: { id: campaignId },
          data: { messages: updatedMessages }
        });
      }
    } catch (error) {
      console.error('Failed to update message status:', error);
    }
  }

  async sendDM(recipientId, message, cookies) {
    let page = null;
    
    try {
      console.log(`[${recipientId}] Starting DM process for campaign ${this.currentCampaignId}`);
      page = await this.browser.newPage();
      
      // Block unnecessary resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Set minimal viewport
      await page.setViewport({ width: 800, height: 600 });
      const essentialCookies = cookies.filter(c => ['auth_token', 'ct0'].includes(c.name));
      await page.setCookie(...essentialCookies);
      console.log(`[${recipientId}] Cookies set, essential count: ${essentialCookies.length}`);
      
      // Navigate directly with minimal wait
      console.log(`[${recipientId}] Navigating to DM page`);
      await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      console.log(`[${recipientId}] Navigation complete`);
      
      // Find composer with minimal DOM operations
      console.log(`[${recipientId}] Waiting for composer selector`);
      try {
        await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
          timeout: 60000,
          visible: true
        });
      } catch (e) {
        if (e.name === 'TimeoutError') {
          console.error(`[${recipientId}] DM composer not found, incrementing composer error count`);
          return 'composer_not_found';
        }
        throw e;
      }
      console.log(`[${recipientId}] Composer found, attempting to type`);
      
      // Use a more reliable typing method
      try {
        // Try direct typing first (most reliable)
        console.log(`[${recipientId}] Trying page.type method, message: ${message}`);
        await page.type('[data-testid="dmComposerTextInput"]', message);
        console.log(`[${recipientId}] page.type succeeded, message typed: ${message}`);
      } catch (error) {
        console.log(`[${recipientId}] page.type failed: ${error.message}`);
        // Fallback method using evaluate with better error checking
        console.log(`[${recipientId}] Trying evaluate method`);
        await page.evaluate((msg) => {
          const composer = document.querySelector('[data-testid="dmComposerTextInput"]');
          if (composer) {
            composer.innerText = msg;
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          } else {
            // Try alternative selectors
            const alternatives = [
              '[role="textbox"]',
              '[contenteditable="true"]',
              'div[data-contents="true"]'
            ];
            for (const selector of alternatives) {
              const element = document.querySelector(selector);
              if (element) {
                element.innerText = msg;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
            }
            return false;
          }
        }, message).then(result => {
          console.log(`[${recipientId}] Evaluate method result: ${result}, message: ${message}`);
        });
      }
      // Log the DM page URL
      const dmUrl = `https://twitter.com/messages/compose?recipient_id=${recipientId}`;
      console.log(`[${recipientId}] DM page URL: ${dmUrl}`);
      // Click send
      console.log(`[${recipientId}] Attempting to click send button, message: ${message}`);
      try {
        await page.click('[data-testid="dmComposerSendButton"]');
        console.log(`[${recipientId}] Send button clicked successfully, message: ${message}`);
      } catch (clickError) {
        console.error(`[${recipientId}] Error clicking send button: ${clickError.message}`);
      }
      await page.waitForTimeout(1000);
      console.log(`[${recipientId}] Message sent successfully (browser action complete)`);
      
      return true;
    } catch (error) {
      console.error(`[${recipientId}] FAILED: ${error.message}`);
      console.error(`[${recipientId}] Error stack: ${error.stack.split('\n')[0]}`);
      
      // Check if it's a memory-related error and rethrow it so the outer catch block can handle it
      if (this.isMemoryError(error)) {
        throw error; // Rethrow memory errors
      }
      
      return false; // Return false for non-memory errors
    } finally {
      if (page) {
        console.log(`[${recipientId}] Cleaning up page`);
        // Close page and clean up
        await page.removeAllListeners();
        await page.close();
      }
    }
  }

  async launchBrowser() {
    if (this.browser) {
      await this.closeBrowser();
    }
    
    try {
      const isLocal = process.env.NEXT_PUBLIC_APP_ENV === 'local';
      const isWindows = process.platform === 'win32';
      const executablePath = isLocal && isWindows ? 
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 
        await chromium.executablePath();

      this.browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--js-flags="--max-old-space-size=256"',
          '--single-process',
        ],
        executablePath,
        headless: isLocal ? false : chromium.headless,
        defaultViewport: { width: 800, height: 600 },
        protocolTimeout: 180000,
        timeout: 180000
      });

      console.log('Browser launched successfully');
      return true;
    } catch (error) {
      console.error('Failed to launch browser:', error);
      return false;
    }
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log('Browser closed successfully');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }

  isMemoryError(error) {
    const errorMessage = error.message || '';
    return errorMessage.includes('Target.createTarget timed out') || 
      errorMessage.includes('out of memory') || 
      errorMessage.includes('TimeoutError') ||
      errorMessage.includes('Browser closed') ||
      errorMessage.includes('Protocol error') || 
      errorMessage.includes('Increase the \'protocolTimeout\'') ||
      errorMessage.includes('Waiting for selector') ||
      errorMessage.includes('Waiting failed:');
  }

  async checkDailyLimit(userId) {
    if (!userId) {
      console.error("userId is undefined in checkDailyLimit");
      return { canSend: false };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
    
    // Check if we're already at the limit
    const currentCount = await redis.get(dailyLimitKey);
    const parsedCount = currentCount ? parseInt(currentCount) : 0;
    
    // Get user's plan type from database
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId }
    });
    
    // Use the utility functions to calculate the limit
    const userLimit = getUserDailyMessageLimit(userCredits);
    const effectiveLimit = getEnvironmentAdjustedLimit(userLimit);
    console.log(`Current count: ${parsedCount}, Limit: ${effectiveLimit}`);
    
    return {
      canSend: parsedCount < effectiveLimit,
      currentCount: parsedCount
    };
  }

  async incrementDailyLimit(userId) {
    if (!userId) {
      console.error("userId is undefined in incrementDailyLimit");
      return { success: false };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
    
    // Increment the counter
    const newCount = await redis.incr(dailyLimitKey);
    
    // If this is the first increment, set expiration
    if (newCount === 1) {
      // Calculate seconds until midnight of the next day
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
      await redis.expire(dailyLimitKey, secondsUntilMidnight);
    }
    
    console.log(`Daily message count for user ${userId} incremented to: ${newCount}`);
    
    return {
      success: true,
      currentCount: newCount
    };
  }

  async recoverActiveCampaigns() {
    try {
      // Find all campaign queues in Redis
      console.log("Recovering active campaigns");
      const queueKeys = await redis.keys(`${QUEUE_PREFIX}*`);
      console.log(`Found ${queueKeys.length} campaign queues in Redis`);
      if (queueKeys.length === 0) {
        return { recovered: 0 };
      }
      
      let recoveredCount = 0;
      
      for (const queueKey of queueKeys) {
        const campaignId = queueKey.split(':')[1];
        if (!campaignId) continue;
        
        const campaign = await prisma.message.findUnique({ where: { id: campaignId } });
        if (!campaign) continue;
        
        const campaignQueue = new CampaignQueue(campaignId);
        await campaignQueue.loadFromRedis();
        
        if (campaignQueue.queue.length > 0 && campaignQueue.status !== 'Stopped') {
          console.log(`Found active campaign ${campaignId} with status ${campaignQueue.status}`);
          
          // For rate limited campaigns, check if limit has reset
          if (campaignQueue.status === 'Rate Limited') {
            // Find a userId in the queue
            let userId = null;
            if (campaignQueue.queue.length > 0 && campaignQueue.queue[0].userId) {
              userId = campaignQueue.queue[0].userId;
            } else if (campaign.userId) {
              userId = campaign.userId;
            }
            
            if (userId) {
              const today = new Date().toISOString().split('T')[0];
              const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
              const dailyUsage = await redis.get(dailyLimitKey);
              
              // Get user's plan type and calculate their limit
              const userCredits = await prisma.userCredits.findUnique({
                where: { userId }
              });
              
              const userLimit = getUserDailyMessageLimit(userCredits);
              const adjustedLimit = getEnvironmentAdjustedLimit(userLimit);
              
              if (!dailyUsage || parseInt(dailyUsage) < adjustedLimit) {
                // Resume campaign
                campaignQueue.status = 'Running';
                await campaignQueue.saveToRedis();
                
                await prisma.message.update({
                  where: { id: campaignId },
                  data: { status: 'In Progress' }
                });
                
                recoveredCount++;
              }
            }
          }
          // For Running campaigns, ensure they're actually running
          else if (campaignQueue.status === 'Running') {
            // Mark as recovered
            recoveredCount++;
          }
        }
      }
      
      console.log(`Recovered ${recoveredCount} campaigns`);
      return { recovered: recoveredCount };
    } catch (error) {
      console.error('Error recovering campaigns:', error);
      return { recovered: 0, error: error.message };
    }
  }
}

// Utility function to transform message templates
function messageTransformFunction(message, recipient) {
  if (!message || !recipient) return message;
  
  let transformedMessage = message.replace(/{name}/g, recipient.name ? recipient.name.split(" ")[0] : "");
  transformedMessage = transformedMessage.replace(/{username}/g, recipient.username ? recipient.username : "");
  transformedMessage = transformedMessage.replace(/{url}/g, recipient.url ? recipient.url : "");
  transformedMessage = transformedMessage.replace(/{bio}/g, recipient.bio ? recipient.bio : "");
  transformedMessage = transformedMessage.replace(/{followers}/g, recipient.followers ? recipient.followers : "");
  transformedMessage = transformedMessage.replace(/{following}/g, recipient.following ? recipient.following : "");
  
  return transformedMessage;
}

// Start the worker
const worker = new DMWorker();
worker.initialize().catch(console.error);

// Export for potential programmatic use
module.exports = { DMWorker }; 