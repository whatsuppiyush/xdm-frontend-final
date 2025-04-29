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
    console.log(`[Worker] Found ${queueKeys.length} campaign queues in Redis`);
    for (const queueKey of queueKeys) {
      const campaignId = queueKey.split(':')[1];
      if (!campaignId) continue;
      const queueData = await redis.get(queueKey);
      if (!queueData) continue;
      const queueState = queueData;
      console.log(`[Worker] Checking campaign ${campaignId} with status ${queueState.status}, queue length: ${queueState.queue.length}`);
      if (queueState.queue && queueState.queue.length > 0 && queueState.status === 'Running') {
        console.log(`[Worker] Processing campaign ${campaignId}`);
        this.isProcessing = true;
        this.currentCampaignId = campaignId;
        await this.processCampaignQueue(campaignId, queueState);
        this.isProcessing = false;
        this.currentCampaignId = null;
        break;
      }
    }
  }

  async processCampaignQueue(campaignId, queueState) {
    console.log(`[Campaign ${campaignId}] Starting to process campaign`);
    
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;
    let recipientsToRetry = [];
    
    try {
      // Get campaign from database
      const campaign = await prisma.message.findUnique({
        where: { id: campaignId }
      });
      
      if (!campaign) {
        console.log(`[Campaign ${campaignId}] Not found in database, skipping`);
        return;
      }
      
      // Launch browser with memory optimization arguments
      console.log(`[Campaign ${campaignId}] Launching browser...`);
      await this.launchBrowser();
      
      // Add any recipients that need retry from previous browser crash
      if (recipientsToRetry.length > 0) {
        console.log(`[Campaign ${campaignId}] Adding ${recipientsToRetry.length} recipients back to the queue for retry`);
        queueState.queue = [...recipientsToRetry, ...queueState.queue];
        recipientsToRetry = [];
        await this.saveQueueState(campaignId, queueState);
      }

      while (queueState.queue.length > 0 && queueState.status === 'Running') {
        // Reload queue state to check for status changes
        const freshState = await this.getQueueState(campaignId);
        if (freshState && freshState.status !== 'Running') {
          console.log(`[Campaign ${campaignId}] Status changed to ${freshState.status}, stopping processing`);
          break;
        }
        
        const { recipientId, message, cookies, userId } = queueState.queue[0];
        console.log(`[Campaign ${campaignId}] Processing message to recipient ${recipientId} for user ${userId}`);
        
        if (queueState.processedRecipients && queueState.processedRecipients.includes(recipientId)) {
          console.log(`[Campaign ${campaignId}] Recipient ${recipientId} already processed, skipping`);
          queueState.queue.shift();
          await this.saveQueueState(campaignId, queueState);
          continue;
        }

        // Check daily limit every 5 messages or on the first message
        if (limitCheckCounter % 5 === 0) {
          if (!userId) {
            console.error(`[Campaign ${campaignId}] userId is undefined`);
            // Try to get userId from database as fallback
            try {
              const campaign = await prisma.message.findUnique({
                where: { id: campaignId },
                select: { userId: true }
              });
              if (campaign?.userId) {
                console.log(`[Campaign ${campaignId}] Found userId ${campaign.userId} from database`);
                queueState.queue[0].userId = campaign.userId;
                await this.saveQueueState(campaignId, queueState);
                const limitCheck = await this.checkDailyLimit(campaign.userId);
                if (!limitCheck.canSend) {
                  console.log(`[Campaign ${campaignId}] Daily limit reached for user ${campaign.userId}. Setting campaign to Rate Limited.`);
                  queueState.status = 'Rate Limited';
                  await this.saveQueueState(campaignId, queueState);
                  await prisma.message.update({
                    where: { id: campaignId },
                    data: { status: 'Rate Limited' }
                  });
                  return;
                }
              }
            } catch (error) {
              console.error(`[Campaign ${campaignId}] Error fetching userId from database:`, error);
            }
            queueState.queue.shift();
            await this.saveQueueState(campaignId, queueState);
            continue;
          }
          const limitCheck = await this.checkDailyLimit(userId);
          if (!limitCheck.canSend) {
            console.log(`[Campaign ${campaignId}] Daily limit reached for user ${userId}. Setting campaign to Rate Limited.`);
            queueState.status = 'Rate Limited';
            await this.saveQueueState(campaignId, queueState);
            await prisma.message.update({
              where: { id: campaignId },
              data: { status: 'Rate Limited' }
            });
            return;
          }
          console.log(`[Campaign ${campaignId}] Daily limit check passed. Current count: ${limitCheck.currentCount}`);
        }
        limitCheckCounter++;

        // Apply random delay between messages (2-4 minutes)
        const delay = Math.floor(Math.random() * (240000 - 120000 + 1) + 120000);
        console.log(`[Campaign ${campaignId}] Waiting ${delay/60000} minutes before sending next message`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reload queue state after delay to check for status changes
        const postDelayState = await this.getQueueState(campaignId);
        if (postDelayState && postDelayState.status !== 'Running') {
          console.log(`[Campaign ${campaignId}] Status changed to ${postDelayState.status} during delay, stopping processing`);
          queueState = postDelayState;
          break;
        }

        try {
          const success = await this.sendDM(recipientId, message, cookies);
          if (success) {
            if (userId) {
              await this.incrementDailyLimit(userId);
              console.log(`[Campaign ${campaignId}] Incremented daily message count for user ${userId} after successful send`);
            }
            await this.updateMessageStatus(campaignId, recipientId);
            if (!queueState.processedRecipients) {
              queueState.processedRecipients = [];
            }
            queueState.processedRecipients.push(recipientId);
            queueState.queue.shift();
            queueState.totalAttempts = 0;
            consecutiveMemoryErrors = 0;
            console.log(`[Campaign ${campaignId}] Successfully sent DM to recipient ${recipientId}`);
          } else {
            console.log(`[Campaign ${campaignId}] Failed to send DM to recipient ${recipientId}, will retry if under max attempts`);
            this.handleFailedAttempt(queueState, recipientId);
          }
        } catch (error) {
          console.log(`[Campaign ${campaignId}] Error in send attempt to recipient ${recipientId}:`, error);
          if (this.isMemoryError(error)) {
            consecutiveMemoryErrors++;
            console.log(`[Campaign ${campaignId}] Browser memory issue detected: ${error.message}`);
            console.log(`[Campaign ${campaignId}] Performing browser restart and cooldown (attempt ${++browserRestartCount}, consecutive: ${consecutiveMemoryErrors})`);
            await this.saveQueueState(campaignId, queueState);
            const currentRecipient = queueState.queue[0];
            recipientsToRetry.push(currentRecipient);
            console.log(`[Campaign ${campaignId}] Recipients to retry:`, recipientsToRetry.map(r => r.recipientId));
            queueState.queue.shift();
            await this.saveQueueState(campaignId, queueState);
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors * 2), 10);
            console.log(`[Campaign ${campaignId}] Cooling down for ${cooldownMinutes} minutes before restarting browser`);
            await this.closeBrowser();
            await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60000));
            console.log(`[Campaign ${campaignId}] Cooldown completed, restarting browser now`);
            try {
              console.log(`[Campaign ${campaignId}] Launching new browser instance after cooldown`);
              await this.launchBrowser();
              console.log(`[Campaign ${campaignId}] Browser restarted successfully after cooldown`);
              queueState.queue = [...recipientsToRetry, ...queueState.queue];
              recipientsToRetry = [];
              await this.saveQueueState(campaignId, queueState);
              continue;
            } catch (restartError) {
              console.error(`[Campaign ${campaignId}] Error restarting browser:`, restartError);
              break;
            }
          } else {
            console.error(`[Campaign ${campaignId}] Error sending DM to ${recipientId}:`, error);
            this.handleFailedAttempt(queueState, recipientId);
          }
        }
        await this.saveQueueState(campaignId, queueState);
      }
      if (queueState.queue.length === 0) {
        queueState.status = 'Completed';
        await this.saveQueueState(campaignId, queueState);
        try {
          await prisma.message.update({
            where: { id: campaignId },
            data: { status: 'Completed' }
          });
          console.log(`[Campaign ${campaignId}] Campaign completed and status updated in DB`);
        } catch (error) {
          console.error(`[Campaign ${campaignId}] Failed to update message status in DB:`, error);
        }
      }
    } catch (error) {
      console.error(`[Campaign ${campaignId}] Error processing campaign:`, error);
    } finally {
      if (this.browser) {
        console.log(`[Campaign ${campaignId}] Closing browser`);
        await this.closeBrowser();
      }
    }
  }

  handleFailedAttempt(queueState, recipientId) {
    if (!queueState.totalAttempts) {
      queueState.totalAttempts = 0;
    }
    
    queueState.totalAttempts++;
    
    if (queueState.totalAttempts >= MAX_RETRIES) {
      console.log(`Max retries reached for recipient ${recipientId}, marking as processed`);
      if (!queueState.processedRecipients) {
        queueState.processedRecipients = [];
      }
      queueState.processedRecipients.push(recipientId);
      queueState.queue.shift();
      queueState.totalAttempts = 0;
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
      console.log(`[DM] [${recipientId}] Starting DM process`);
      page = await this.browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.setViewport({ width: 800, height: 600 });
      const essentialCookies = cookies.filter(c => ['auth_token', 'ct0'].includes(c.name));
      await page.setCookie(...essentialCookies);
      console.log(`[DM] [${recipientId}] Cookies set, essential count: ${essentialCookies.length}`);
      console.log(`[DM] [${recipientId}] Navigating to DM page`);
      await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      console.log(`[DM] [${recipientId}] Navigation complete`);
      console.log(`[DM] [${recipientId}] Waiting for composer selector`);
      await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
        timeout: 60000,
        visible: true
      });
      console.log(`[DM] [${recipientId}] Composer found, attempting to type`);
      try {
        console.log(`[DM] [${recipientId}] Trying page.type method`);
        await page.type('[data-testid="dmComposerTextInput"]', message);
        console.log(`[DM] [${recipientId}] page.type succeeded`);
      } catch (error) {
        console.log(`[DM] [${recipientId}] page.type failed: ${error.message}`);
        console.log(`[DM] [${recipientId}] Trying evaluate method`);
        await page.evaluate((msg) => {
          const composer = document.querySelector('[data-testid="dmComposerTextInput"]');
          if (composer) {
            composer.innerText = msg;
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          } else {
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
          console.log(`[DM] [${recipientId}] Evaluate method result: ${result}`);
        });
      }
      console.log(`[DM] [${recipientId}] Attempting to click send button`);
      await page.click('[data-testid="dmComposerSendButton"]');
      await page.waitForTimeout(1000);
      console.log(`[DM] [${recipientId}] Message sent successfully`);
      return true;
    } catch (error) {
      console.error(`[DM] [${recipientId}] FAILED: ${error.message}`);
      console.error(`[DM] [${recipientId}] Error stack: ${error.stack.split('\n')[0]}`);
      if (this.isMemoryError(error)) {
        throw error;
      }
      return false;
    } finally {
      if (page) {
        console.log(`[DM] [${recipientId}] Cleaning up page`);
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

  async getQueueState(campaignId) {
    const queueData = await redis.get(`${QUEUE_PREFIX}${campaignId}`);
    return queueData || null;
  }

  async saveQueueState(campaignId, queueState) {
    await redis.set(`${QUEUE_PREFIX}${campaignId}`, queueState);
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
        const queueData = await redis.get(queueKey);
        if (!queueData) continue;
        const queueState = queueData;
        if (queueState.queue && queueState.queue.length > 0 && queueState.status !== 'Stopped') {
          console.log(`Found active campaign ${campaignId} with status ${queueState.status}`);
          // For rate limited campaigns, check if limit has reset
          if (queueState.status === 'Rate Limited') {
            // Find a userId in the queue
            let userId = null;
            if (queueState.queue.length > 0 && queueState.queue[0].userId) {
              userId = queueState.queue[0].userId;
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
                queueState.status = 'Running';
                await this.saveQueueState(campaignId, queueState);
                
                await prisma.message.update({
                  where: { id: campaignId },
                  data: { status: 'In Progress' }
                });
                
                recoveredCount++;
              }
            }
          }
          // For Running campaigns, ensure they're actually running
          else if (queueState.status === 'Running') {
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

// Start the worker
const worker = new DMWorker();
worker.initialize().catch(console.error);

// Export for potential programmatic use
module.exports = { DMWorker }; 