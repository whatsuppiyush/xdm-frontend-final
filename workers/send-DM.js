// workers/send-DM.js
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const http = require('http');
const { getUserDailyMessageLimit, getEnvironmentAdjustedLimit } = require('./planLimits');

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
    console.log(`[CampaignQueue] Created for campaignId: ${campaignId}`);
  }

  async loadFromRedis() {
    console.log(`[CampaignQueue:${this.campaignId}] Loading state from Redis`);
    const queueData = await redis.get(`${QUEUE_PREFIX}${this.campaignId}`);
    if (queueData) {
      this.queue = queueData.queue || [];
      this.processedRecipients = queueData.processedRecipients || [];
      this.status = queueData.status || 'Ready';
      this.totalAttempts = queueData.totalAttempts || 0;
      console.log(`[CampaignQueue:${this.campaignId}] Loaded state: status=${this.status}, queueLen=${this.queue.length}, processedLen=${this.processedRecipients.length}`);
    } else {
      console.log(`[CampaignQueue:${this.campaignId}] No state found in Redis`);
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
    console.log(`[CampaignQueue:${this.campaignId}] Saved state to Redis: status=${this.status}, queueLen=${this.queue.length}, processedLen=${this.processedRecipients.length}`);
  }

  async process(dmWorker) {
    await this.loadFromRedis();
    console.log(`[CampaignQueue:${this.campaignId}] Starting process, status: ${this.status}`);
    if (this.status === 'Stopped' || this.status === 'Paused') {
      console.log(`[CampaignQueue:${this.campaignId}] Not processing due to status: ${this.status}`);
      return;
    }
    this.status = 'Running';
    await this.saveToRedis();
    try {
      await prisma.message.update({
        where: { id: this.campaignId },
        data: { status: 'In Progress' }
      });
      console.log(`[CampaignQueue:${this.campaignId}] Set DB status to In Progress`);
    } catch (error) {
      console.error(`[CampaignQueue:${this.campaignId}] Failed to update DB status:`, error);
    }
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;
    let recipientsToRetry = [];
    try {
      if (!dmWorker.browser) {
        console.log(`[CampaignQueue:${this.campaignId}] Launching browser`);
        await dmWorker.launchBrowser();
      }
      if (recipientsToRetry.length > 0) {
        console.log(`[CampaignQueue:${this.campaignId}] Adding ${recipientsToRetry.length} recipients back to queue for retry`);
        this.queue = [...recipientsToRetry, ...this.queue];
        recipientsToRetry = [];
        await this.saveToRedis();
      }
      while (this.queue.length > 0 && this.status === 'Running') {
        await this.loadFromRedis();
        if (this.status !== 'Running') {
          console.log(`[CampaignQueue:${this.campaignId}] Status changed to ${this.status}, breaking loop`);
          break;
        }
        const { recipientId, message, cookies, userId } = this.queue[0];
        console.log(`[CampaignQueue:${this.campaignId}] Processing recipientId=${recipientId}, userId=${userId}`);
        if (this.processedRecipients.includes(recipientId)) {
          console.log(`[CampaignQueue:${this.campaignId}] Recipient ${recipientId} already processed, skipping`);
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }
        if (limitCheckCounter % 5 === 0) {
          if (!userId) {
            console.error(`[CampaignQueue:${this.campaignId}] userId undefined, attempting DB lookup`);
            try {
              const campaign = await prisma.message.findUnique({
                where: { id: this.campaignId },
                select: { userId: true }
              });
              if (campaign?.userId) {
                console.log(`[CampaignQueue:${this.campaignId}] Found userId ${campaign.userId} from DB`);
                this.queue[0].userId = campaign.userId;
                await this.saveToRedis();
                const limitCheck = await dmWorker.checkDailyLimit(campaign.userId);
                if (!limitCheck.canSend) {
                  console.log(`[CampaignQueue:${this.campaignId}] Daily limit reached for user ${campaign.userId}, setting Rate Limited`);
                  this.status = 'Rate Limited';
                  await this.saveToRedis();
                  await prisma.message.update({
                    where: { id: this.campaignId },
                    data: { status: 'Rate Limited' }
                  });
                  return;
                }
              }
            } catch (error) {
              console.error(`[CampaignQueue:${this.campaignId}] Error fetching userId from DB:`, error);
            }
            this.queue.shift();
            await this.saveToRedis();
            continue;
          }
          const limitCheck = await dmWorker.checkDailyLimit(userId);
          if (!limitCheck.canSend) {
            console.log(`[CampaignQueue:${this.campaignId}] Daily limit reached for user ${userId}, setting Rate Limited`);
            this.status = 'Rate Limited';
            await this.saveToRedis();
            await prisma.message.update({
              where: { id: this.campaignId },
              data: { status: 'Rate Limited' }
            });
            return;
          }
        }
        limitCheckCounter++;
        const delay = Math.floor(Math.random() * (240000 - 120000 + 1) + 120000);
        console.log(`[CampaignQueue:${this.campaignId}] Waiting ${delay / 60000} minutes before next message`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.loadFromRedis();
        if (this.status !== 'Running') {
          console.log(`[CampaignQueue:${this.campaignId}] Status changed to ${this.status} during delay, breaking`);
          break;
        }
        try {
          const success = await dmWorker.sendDM(recipientId, message, cookies);
          if (success) {
            if (userId) {
              await dmWorker.incrementDailyLimit(userId);
              console.log(`[CampaignQueue:${this.campaignId}] Incremented daily message count for user ${userId}`);
            }
            await dmWorker.updateMessageStatus(this.campaignId, recipientId);
            this.processedRecipients.push(recipientId);
            this.queue.shift();
            this.totalAttempts = 0;
            consecutiveMemoryErrors = 0;
            console.log(`[CampaignQueue:${this.campaignId}] Message sent to ${recipientId}, queueLen=${this.queue.length}`);
          } else {
            console.log(`[CampaignQueue:${this.campaignId}] sendDM returned false for ${recipientId}`);
            this.handleFailedAttempt(recipientId);
          }
        } catch (error) {
          console.log(`[CampaignQueue:${this.campaignId}] Error in send attempt:`, error);
          if (dmWorker.isMemoryError(error)) {
            consecutiveMemoryErrors++;
            console.log(`[CampaignQueue:${this.campaignId}] Browser memory issue: ${error.message}, restartCount=${browserRestartCount + 1}, consecutive=${consecutiveMemoryErrors}`);
            await this.saveToRedis();
            const currentRecipient = this.queue[0];
            recipientsToRetry.push(currentRecipient);
            this.queue.shift();
            await this.saveToRedis();
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors * 2), 10);
            console.log(`[CampaignQueue:${this.campaignId}] Cooling down for ${cooldownMinutes} minutes before browser restart`);
            await dmWorker.closeBrowser();
            await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60000));
            console.log(`[CampaignQueue:${this.campaignId}] Cooldown complete, restarting browser`);
            try {
              await dmWorker.launchBrowser();
              console.log(`[CampaignQueue:${this.campaignId}] Browser restarted after cooldown`);
              this.queue = [...recipientsToRetry, ...this.queue];
              recipientsToRetry = [];
              await this.saveToRedis();
              continue;
            } catch (restartError) {
              console.error(`[CampaignQueue:${this.campaignId}] Error restarting browser:`, restartError);
              break;
            }
          } else {
            console.error(`[CampaignQueue:${this.campaignId}] Error sending DM to ${recipientId}:`, error);
            this.handleFailedAttempt(recipientId);
          }
        }
        await this.saveToRedis();
      }
      if (this.queue.length === 0) {
        this.status = 'Completed';
        await this.saveToRedis();
        await prisma.message.update({
          where: { id: this.campaignId },
          data: { status: 'Completed' }
        });
        await redis.del(`${QUEUE_PREFIX}${this.campaignId}`);
        console.log(`[CampaignQueue:${this.campaignId}] Campaign completed and cleaned up`);
      }
    } catch (error) {
      console.error(`[CampaignQueue:${this.campaignId}] Error processing campaign:`, error);
    }
  }

  handleFailedAttempt(recipientId) {
    this.totalAttempts++;
    if (this.totalAttempts >= MAX_RETRIES) {
      console.log(`[CampaignQueue:${this.campaignId}] Max retries reached for ${recipientId}, marking as processed`);
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
    console.log('[DMWorker] Initialized');
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
      console.log('[DMWorker] Heartbeat sent');
    } catch (error) {
      console.error('[DMWorker] Failed to send heartbeat:', error);
    }
  }

  async initialize() {
    console.log('[DMWorker] Initializing...');
    
    // Recovery logic - find any campaigns that were interrupted
    await this.recoverActiveCampaigns();
    
    // Start the processing loop
    this.startProcessingLoop();
  }

  async startProcessingLoop() {
    console.log('[DMWorker] Starting processing loop...');
    
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
        console.error('[DMWorker] Error in processing loop:', error);
        // Wait a bit longer on error
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  async processNextTask() {
    const queueKeys = await redis.keys(`${QUEUE_PREFIX}*`);
    console.log(`[DMWorker] Found ${queueKeys.length} campaign queues in Redis`);
    for (const queueKey of queueKeys) {
      const campaignId = queueKey.split(':')[1];
      if (!campaignId) continue;
      
      const campaignQueue = new CampaignQueue(campaignId);
      await campaignQueue.loadFromRedis();
      
      if (campaignQueue.queue.length > 0 && campaignQueue.status === 'Running') {
        console.log(`[DMWorker] Processing campaign ${campaignId}`);
        this.isProcessing = true;
        this.currentCampaignId = campaignId;
        await campaignQueue.process(this);
        this.isProcessing = false;
        this.currentCampaignId = null;
        break;
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
        console.log(`[DMWorker] Updated message status for campaignId=${campaignId}, recipientId=${recipientId}`);
      }
    } catch (error) {
      console.error('[DMWorker] Failed to update message status:', error);
    }
  }

  async sendDM(recipientId, message, cookies) {
    let page = null;
    
    try {
      console.log(`[DMWorker] [${recipientId}] Starting DM process`);
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
      
      // Set minimal cookies
      const essentialCookies = cookies.filter(c => 
        ['auth_token', 'ct0'].includes(c.name)
      );
      await page.setCookie(...essentialCookies);
      console.log(`[DMWorker] [${recipientId}] Cookies set, count: ${essentialCookies.length}`);
      
      // Navigate directly with minimal wait
      console.log(`[DMWorker] [${recipientId}] Navigating to DM page`);
      await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      console.log(`[DMWorker] [${recipientId}] Navigation complete`);
      
      // Find composer with minimal DOM operations
      console.log(`[DMWorker] [${recipientId}] Waiting for composer selector`);
      await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
        timeout: 60000,
        visible: true
      });
      console.log(`[DMWorker] [${recipientId}] Composer found, typing message`);
      
      // Use a more reliable typing method
      try {
        // Try direct typing first (most reliable)
        console.log(`[DMWorker] [${recipientId}] Trying page.type method, message: ${message}`);
        await page.type('[data-testid="dmComposerTextInput"]', message);
        console.log(`[DMWorker] [${recipientId}] page.type succeeded`);
      } catch (error) {
        console.log(`[DMWorker] [${recipientId}] page.type failed: ${error.message}`);
        // Fallback method using evaluate with better error checking
        console.log(`[DMWorker] [${recipientId}] Trying evaluate method`);
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
          console.log(`[DMWorker] [${recipientId}] Evaluate method result: ${result}`);
        });
      }
      // Log the DM page URL
      const dmUrl = `https://twitter.com/messages/compose?recipient_id=${recipientId}`;
      console.log(`[DMWorker] [${recipientId}] DM page URL: ${dmUrl}`);
      // Click send
      console.log(`[DMWorker] [${recipientId}] Clicking send button`);
      try {
        await page.click('[data-testid="dmComposerSendButton"]');
        console.log(`[DMWorker] [${recipientId}] Send button clicked`);
      } catch (clickError) {
        console.error(`[DMWorker] [${recipientId}] Error clicking send button: ${clickError.message}`);
      }
      await page.waitForTimeout(1000);
      console.log(`[DMWorker] [${recipientId}] Message sent (browser action complete)`);
      
      return true;
    } catch (error) {
      console.error(`[DMWorker] [${recipientId}] FAILED: ${error.message}`);
      console.error(`[DMWorker] [${recipientId}] Error stack: ${error.stack.split('\n')[0]}`);
      
      // Check if it's a memory-related error and rethrow it so the outer catch block can handle it
      if (this.isMemoryError(error)) {
        throw error; // Rethrow memory errors
      }
      
      return false; // Return false for non-memory errors
    } finally {
      if (page) {
        console.log(`[DMWorker] [${recipientId}] Cleaning up page`);
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
      console.error('[DMWorker] userId is undefined in checkDailyLimit');
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
    console.log(`[DMWorker] checkDailyLimit: userId=${userId}, currentCount=${parsedCount}, limit=${effectiveLimit}`);
    
    return {
      canSend: parsedCount < effectiveLimit,
      currentCount: parsedCount
    };
  }

  async incrementDailyLimit(userId) {
    if (!userId) {
      console.error('[DMWorker] userId is undefined in incrementDailyLimit');
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
    
    console.log(`[DMWorker] incrementDailyLimit: userId=${userId}, newCount=${newCount}`);
    
    return {
      success: true,
      currentCount: newCount
    };
  }

  async recoverActiveCampaigns() {
    try {
      // Find all campaign queues in Redis
      console.log('[DMWorker] Recovering active campaigns');
      const queueKeys = await redis.keys(`${QUEUE_PREFIX}*`);
      console.log(`[DMWorker] Found ${queueKeys.length} campaign queues in Redis`);
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
          console.log(`[DMWorker] Found active campaign ${campaignId} with status ${campaignQueue.status}`);
          
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
                console.log(`[DMWorker] Resumed rate-limited campaign ${campaignId}`);
              }
            }
          }
          // For Running campaigns, ensure they're actually running
          else if (campaignQueue.status === 'Running') {
            // Mark as recovered
            recoveredCount++;
            console.log(`[DMWorker] Marked running campaign ${campaignId} as recovered`);
          }
        }
      }
      
      console.log(`[DMWorker] Recovered ${recoveredCount} campaigns`);
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