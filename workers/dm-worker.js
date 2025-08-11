const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { CampaignQueue } = require('./campaign-queue');
const { prisma, redis, WORKER_HEARTBEAT_KEY, QUEUE_PREFIX } = require('./config');
const { isMemoryError } = require('./utils');
const { Lock } = require('@upstash/lock');
const { getUserDailyMessageLimit, getEnvironmentAdjustedLimit } = require('./planLimits');

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
    // Use a Redis set to track active campaigns instead of keys
    const campaignIds = await redis.smembers('active_campaigns');
    console.log(`Found ${campaignIds.length} active campaign IDs in Redis set`);
    for (const campaignId of campaignIds) {
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
      
      // Set minimal cookies
      const essentialCookies = cookies.filter(c => 
        ['auth_token', 'ct0'].includes(c.name)
      );
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
      await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
        timeout: 60000,
        visible: true
      });
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
      if (isMemoryError(error)) {
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
    return isMemoryError(error);
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
      // Use Redis set for active campaigns
      console.log("Recovering active campaigns");
      const campaignIds = await redis.smembers('active_campaigns');
      console.log(`Found ${campaignIds.length} active campaign IDs in Redis set`);
      if (campaignIds.length === 0) {
        return { recovered: 0 };
      }
      let recoveredCount = 0;
      for (const campaignId of campaignIds) {
        if (!campaignId) continue;
        const campaign = await prisma.message.findUnique({ where: { id: campaignId } });
        if (!campaign) continue;
        const campaignQueue = new CampaignQueue(campaignId);
        await campaignQueue.loadFromRedis();
        if (campaignQueue.queue.length > 0 && campaignQueue.status !== 'Stopped') {
          console.log(`Found active campaign ${campaignId} with status ${campaignQueue.status}`);
          if (campaignQueue.status === 'Rate Limited') {
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
              const userCredits = await prisma.userCredits.findUnique({ where: { userId } });
              const userLimit = getUserDailyMessageLimit(userCredits);
              const adjustedLimit = getEnvironmentAdjustedLimit(userLimit);
              if (!dailyUsage || parseInt(dailyUsage) < adjustedLimit) {
                campaignQueue.status = 'Running';
                await campaignQueue.saveToRedis();
                await prisma.message.update({
                  where: { id: campaignId },
                  data: { status: 'In Progress' }
                });
                recoveredCount++;
              }
            }
          } else if (campaignQueue.status === 'Running') {
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

module.exports = { DMWorker }; 