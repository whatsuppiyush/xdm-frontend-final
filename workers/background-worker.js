const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const express = require('express');
const app = express();

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const prisma = new PrismaClient();
const MAX_RETRIES = 2;
const BROWSER_INSTANCES = new Map();
const ACTIVE_CAMPAIGNS = new Map(); // Track campaigns currently being processed

// Utility functions
function getUserDailyMessageLimit(userCredits, defaultLimit = 50) {
  if (!userCredits) {
    return defaultLimit;
  }
  
  const { planType } = userCredits;
  
  switch(planType) {
    case 'Starter': return 450;
    case 'Growth': return 1250;
    case 'Elite': return 2250;
    case 'free': return 50;
    default: return defaultLimit;
  }
}

function getEnvironmentAdjustedLimit(limit) {
  if (process.env.NODE_ENV === 'development') {
    return 25;
  }
  return limit;
}

// Campaign Queue class - similar to send-DM.js but optimized for worker
class CampaignQueue {
  constructor(campaignId) {
    this.campaignId = campaignId;
    this.queue = [];
    this.processedRecipients = new Set();
    this.totalAttempts = 0;
    this.status = 'Ready';
    this.browser = null;
    this.lastStatusCheck = 0;
  }

  async saveToRedis() {
    const queueState = {
      campaignId: this.campaignId,
      queue: this.queue,
      processedRecipients: Array.from(this.processedRecipients),
      status: this.status
    };
    await redis.set(`queue:${this.campaignId}`, JSON.stringify(queueState));
  }

  async loadFromRedis() {
    const queueState = await redis.get(`queue:${this.campaignId}`);
    if (queueState) {
      const state = typeof queueState === 'string' ? JSON.parse(queueState) : queueState;
      this.queue = state.queue || [];
      this.processedRecipients = new Set(state.processedRecipients || []);
      this.status = state.status || 'Ready';
      console.log(`[QUEUE] Campaign ${this.campaignId}: Loaded state with status=${this.status}, items=${this.queue.length}`);
    }
  }

  // Check if there's been a status change from the API
  async checkForStatusChanges() {
    try {
      const statusChangeTimestamp = await redis.get(`status_change:${this.campaignId}`);
      
      if (statusChangeTimestamp && parseInt(statusChangeTimestamp) > this.lastStatusCheck) {
        console.log(`[STATUS] Campaign ${this.campaignId}: Status change detected, reloading state`);
        await this.loadFromRedis();
        this.lastStatusCheck = Date.now();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[ERROR] Campaign ${this.campaignId}: Error checking status changes:`, error);
      return false;
    }
  }

  async updateMessageStatus(recipientId) {
    try {
      await prisma.message.update({
        where: { id: this.campaignId },
        data: {
          messages: {
            updateMany: {
              where: { recipientId },
              data: { status: true }
            }
          }
        }
      });
    } catch (error) {
      console.error(`[DB] Campaign ${this.campaignId}: Failed to update message status:`, error);
    }
  }

  async process() {
    await this.loadFromRedis();
    
    // Set initial status check timestamp
    this.lastStatusCheck = Date.now();
    
    if (this.status === 'Stopped' || this.status === 'Paused') {
      console.log(`[PROCESS] Campaign ${this.campaignId}: Skipping processing due to status ${this.status}`);
      return;
    }
    
    this.status = 'Running';
    await this.saveToRedis();
    
    // Mark this campaign as active
    ACTIVE_CAMPAIGNS.set(this.campaignId, this);
    
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;
    let recipientsToRetry = [];

    try {
      console.log(`[BROWSER] Campaign ${this.campaignId}: Launching browser`);
      this.browser = await launchBrowser(this.campaignId);
      BROWSER_INSTANCES.set(this.campaignId, this.browser);
      
      if (recipientsToRetry.length > 0) {
        console.log(`[RETRY] Campaign ${this.campaignId}: Adding ${recipientsToRetry.length} recipients back to queue`);
        this.queue = [...recipientsToRetry, ...this.queue];
        recipientsToRetry = [];
        await this.saveToRedis();
      }

      while (this.queue.length > 0 && this.status === 'Running') {
        // Check for status changes from API every few iterations
        if (limitCheckCounter % 3 === 0) {
          const statusChanged = await this.checkForStatusChanges();
          if (statusChanged && this.status !== 'Running') {
            console.log(`[STATUS] Campaign ${this.campaignId}: Processing halted due to status change to ${this.status}`);
            break;
          }
        }
        
        await this.loadFromRedis();
        if (this.status !== 'Running') break;

        const { recipientId, message, cookies, userId, recipient } = this.queue[0];
        console.log(`[PROCESS] Campaign ${this.campaignId}: Processing message for ${recipientId}`);
        
        if (this.processedRecipients.has(recipientId)) {
          console.log(`[SKIP] Campaign ${this.campaignId}: Recipient ${recipientId} already processed`);
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }

        // Check daily limit every 5 messages or on first message
        if (limitCheckCounter % 5 === 0) {
          if (!userId) {
            console.error(`[ERROR] Campaign ${this.campaignId}: userId is undefined for recipient ${recipientId}`);
            
            // Try to get userId from database as fallback
            try {
              const campaign = await prisma.message.findUnique({
                where: { id: this.campaignId },
                select: { userId: true }
              });
              
              if (campaign?.userId) {
                console.log(`[FOUND] Campaign ${this.campaignId}: Found userId ${campaign.userId}`);
                this.queue[0].userId = campaign.userId;
                await this.saveToRedis();
                
                const limitCheck = await checkDailyLimit(campaign.userId);
                if (!limitCheck.canSend) {
                  console.log(`[LIMIT] Campaign ${this.campaignId}: Daily limit reached for user ${campaign.userId}`);
                  this.status = 'Rate Limited';
                  await this.saveToRedis();
                  
                  await prisma.message.update({
                    where: { id: this.campaignId },
                    data: { status: 'Rate Limited' }
                  });
                  return;
                }
                console.log(`[LIMIT] Campaign ${this.campaignId}: Daily limit check passed. Current count: ${limitCheck.currentCount}`);
              }
            } catch (error) {
              console.error(`[ERROR] Campaign ${this.campaignId}: Error fetching userId:`, error);
            }
            
            this.queue.shift();
            await this.saveToRedis();
            continue;
          }
          
          const limitCheck = await checkDailyLimit(userId);
          
          if (!limitCheck.canSend) {
            console.log(`[LIMIT] Campaign ${this.campaignId}: Daily limit reached for user ${userId}`);
            this.status = 'Rate Limited';
            await this.saveToRedis();
            
            await prisma.message.update({
              where: { id: this.campaignId },
              data: { status: 'Rate Limited' }
            });
            break;
          }
          console.log(`[LIMIT] Campaign ${this.campaignId}: Daily limit check passed. Current count: ${limitCheck.currentCount}`);
        }
        limitCheckCounter++;

        // Random delay between messages to avoid rate limiting
        const delay = Math.floor(Math.random() * (4 - 2 + 1) + 2) * 60000;
        console.log(`[DELAY] Campaign ${this.campaignId}: Waiting ${delay/60000} minutes before next message`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Check for status changes again after delay
        await this.checkForStatusChanges();
        if (this.status !== 'Running') {
          console.log(`[STATUS] Campaign ${this.campaignId}: Processing halted after delay due to status change to ${this.status}`);
          break;
        }

        try {
          // Transform message with recipient data if available
          const personalizedMessage = recipient ? messageTransformFunction(message, recipient) : message;
          
          // Send the DM
          const success = await sendDM(recipientId, personalizedMessage, cookies, this.browser, this.campaignId);
          
          if (success) {
            if (userId) {
              await incrementDailyLimit(userId);
              console.log(`[LIMIT] Campaign ${this.campaignId}: Incremented daily count for ${userId}`);
            }
            
            await this.updateMessageStatus(recipientId);
            this.processedRecipients.add(recipientId);
            this.queue.shift();
            this.totalAttempts = 0;
            consecutiveMemoryErrors = 0;
          } else {
            this.handleFailedAttempt(recipientId);
          }
        } catch (error) {
          console.error(`[ERROR] Campaign ${this.campaignId}: Error processing ${recipientId}:`, error);
          
          // Check for memory-related errors
          if (error.message.includes('Target.createTarget timed out') || 
              error.message.includes('out of memory') || 
              error.message.includes('TimeoutError') ||
              error.message.includes('Browser closed') ||
              error.message.includes('Protocol error') || 
              error.message.includes('Increase the \'protocolTimeout\'') ||
              error.message.includes('Waiting for selector') ||
              error.message.includes('Waiting failed:')) {
            
            consecutiveMemoryErrors++;
            console.log(`[BROWSER] Campaign ${this.campaignId}: Memory issue detected, consecutive errors: ${consecutiveMemoryErrors}`);
            
            // Save current state
            await this.saveToRedis();
            
            // Add current recipient to retry list
            recipientsToRetry.push(this.queue[0]);
            this.queue.shift();
            await this.saveToRedis();
            
            // Progressive cooldown period
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors * 2), 10);
            console.log(`[COOLDOWN] Campaign ${this.campaignId}: Cooling down for ${cooldownMinutes} minutes`);
            
            // Close browser before cooldown
            try {
              if (this.browser) {
                await this.browser.close();
                this.browser = null;
                BROWSER_INSTANCES.delete(this.campaignId);
                console.log(`[BROWSER] Campaign ${this.campaignId}: Browser closed successfully`);
              }
            } catch (closeError) {
              console.error(`[BROWSER] Campaign ${this.campaignId}: Error closing browser:`, closeError);
            }
            
            // Log cooldown times
            console.log(`[COOLDOWN] Campaign ${this.campaignId}: Started at ${new Date().toISOString()}, will resume at ${new Date(Date.now() + cooldownMinutes * 60000).toISOString()}`);
            
            await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60000));
            
            console.log(`[COOLDOWN] Campaign ${this.campaignId}: Completed at ${new Date().toISOString()}`);
            
            // Restart browser
            try {
              console.log(`[BROWSER] Campaign ${this.campaignId}: Launching new browser instance`);
              this.browser = await launchBrowser(this.campaignId);
              BROWSER_INSTANCES.set(this.campaignId, this.browser);
              
              // Add failed recipients back to queue
              this.queue = [...recipientsToRetry, ...this.queue];
              recipientsToRetry = [];
              await this.saveToRedis();
              
              continue;
            } catch (restartError) {
              console.error(`[BROWSER] Campaign ${this.campaignId}: Error restarting browser:`, restartError);
              break;
            }
          } else {
            console.error(`[ERROR] Campaign ${this.campaignId}: Regular error for ${recipientId}:`, error);
            this.handleFailedAttempt(recipientId);
          }
        }
        
        await this.saveToRedis();
      }
      
      // Check if all messages processed
      if (this.queue.length === 0) {
        this.status = 'Completed';
        await this.saveToRedis();
        
        await prisma.message.update({
          where: { id: this.campaignId },
          data: { status: 'Completed' }
        });
      }
      
    } catch (error) {
      console.error(`[ERROR] Campaign ${this.campaignId}: Process error:`, error);
    } finally {
      // Remove from active campaigns
      ACTIVE_CAMPAIGNS.delete(this.campaignId);
      
      if (this.browser) {
        console.log(`[BROWSER] Campaign ${this.campaignId}: Closing browser in finally block`);
        try {
          await this.browser.close();
        } catch (error) {
          console.error(`[BROWSER] Campaign ${this.campaignId}: Error closing browser:`, error);
        }
        this.browser = null;
        BROWSER_INSTANCES.delete(this.campaignId);
      }
      
      // Clean up Redis if queue is empty or stopped
      if (this.queue.length === 0 || this.status === 'Stopped') {
        const queueKey = `queue:${this.campaignId}`;
        try {
          await redis.del(queueKey);
          console.log(`[REDIS] Campaign ${this.campaignId}: Cleaned up Redis queue`);
        } catch (redisError) {
          console.error(`[REDIS] Campaign ${this.campaignId}: Failed to clean up Redis:`, redisError);
        }
      }
    }
  }

  handleFailedAttempt(recipientId) {
    this.totalAttempts++;
    if (this.totalAttempts >= MAX_RETRIES) {
      console.log(`[RETRY] Campaign ${this.campaignId}: Max retries reached for ${recipientId}`);
      this.processedRecipients.add(recipientId);
      this.queue.shift();
      this.totalAttempts = 0;
    }
  }

  async stop() {
    this.status = 'Stopped';
    this.queue = [];
    await this.saveToRedis();
    console.log(`[STOP] Campaign ${this.campaignId}: Stopped and Redis updated`);
  }

  async pause() {
    this.status = 'Paused';
    await this.saveToRedis();
    console.log(`[PAUSE] Campaign ${this.campaignId}: Paused`);
  }

  async resume() {
    this.status = 'Running';
    await this.saveToRedis();
    
    if (this.queue.length > 0) {
      this.process().catch(console.error);
    }
    console.log(`[RESUME] Campaign ${this.campaignId}: Resumed with ${this.queue.length} items in queue`);
  }
}

// Launch browser function
async function launchBrowser(campaignId) {
  console.log(`[BROWSER] Campaign ${campaignId}: Launching new browser instance`);
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === 'local';
  const isWindows = process.platform === 'win32';
  const executablePath = isLocal && isWindows ? 
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 
    await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--js-flags="--max-old-space-size=256"',
      '--single-process'
    ],
    executablePath,
    headless: isLocal ? false : chromium.headless,
    defaultViewport: { width: 800, height: 600 },
    protocolTimeout: 180000,
    timeout: 180000
  });
  
  return browser;
}

// Send DM function
async function sendDM(recipientId, message, cookies, browser, campaignId) {
  let page = null;
  
  try {
    console.log(`[SEND] Campaign ${campaignId}: Starting DM process for ${recipientId}`);
    page = await browser.newPage();
    
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
    
    const essentialCookies = cookies.filter(c => 
      ['auth_token', 'ct0'].includes(c.name)
    );
    await page.setCookie(...essentialCookies);
    
    console.log(`[SEND] Campaign ${campaignId}: Navigating to DM page for ${recipientId}`);
    await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log(`[SEND] Campaign ${campaignId}: Waiting for composer for ${recipientId}`);
    await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
      timeout: 60000,
      visible: true
    });
    
    try {
      console.log(`[SEND] Campaign ${campaignId}: Typing message for ${recipientId}`);
      await page.type('[data-testid="dmComposerTextInput"]', message);
    } catch (typeError) {
      console.log(`[SEND] Campaign ${campaignId}: Direct typing failed for ${recipientId}, using alternate method`);
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
      }, message);
    }
    
    console.log(`[SEND] Campaign ${campaignId}: Clicking send button for ${recipientId}`);
    await page.click('[data-testid="dmComposerSendButton"]');
    await page.waitForTimeout(1000);
    console.log(`[SEND] Campaign ${campaignId}: Message sent successfully to ${recipientId}`);
    
    return true;
  } catch (error) {
    console.error(`[SEND] Campaign ${campaignId}: FAILED for ${recipientId}: ${error.message}`);
    
    if (error.message.includes('Target.createTarget timed out') || 
        error.message.includes('TimeoutError') ||
        error.message.includes('out of memory') || 
        error.message.includes('Browser closed') ||
        error.message.includes('Protocol error') || 
        error.message.includes('Increase the \'protocolTimeout\'') ||
        error.message.includes('Waiting for selector') ||
        error.message.includes('Waiting failed:')) {
      throw error;
    }
    
    return false;
  } finally {
    if (page) {
      console.log(`[SEND] Campaign ${campaignId}: Cleaning up page for ${recipientId}`);
      await page.removeAllListeners();
      await page.close();
    }
  }
}

// Message transform function
function messageTransformFunction(message, recipient) {
  let transformedMessage = message.replace("{name}", recipient.name ? recipient.name.split(" ")[0] : "");
  transformedMessage = transformedMessage.replace("{username}", recipient.username ? recipient.username : "");
  transformedMessage = transformedMessage.replace("{url}", recipient.url ? recipient.url : "");
  transformedMessage = transformedMessage.replace("{bio}", recipient.bio ? recipient.bio : "");
  transformedMessage = transformedMessage.replace("{followers}", recipient.followers ? recipient.followers : "");
  transformedMessage = transformedMessage.replace("{following}", recipient.following ? recipient.following : "");
  return transformedMessage;
}

// Daily limit check function
async function checkDailyLimit(userId) {
  if (!userId) {
    console.error("userId is undefined in checkDailyLimit");
    return { canSend: false };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
  
  const currentCount = await redis.get(dailyLimitKey);
  const parsedCount = currentCount ? parseInt(currentCount) : 0;
  
  const userCredits = await prisma.userCredits.findUnique({
    where: { userId }
  });
  
  const userLimit = getUserDailyMessageLimit(userCredits);
  const effectiveLimit = getEnvironmentAdjustedLimit(userLimit);
  
  return {
    canSend: parsedCount < effectiveLimit,
    currentCount: parsedCount
  };
}

// Increment daily limit function
async function incrementDailyLimit(userId) {
  if (!userId) {
    console.error("userId is undefined in incrementDailyLimit");
    return { success: false };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
  
  const newCount = await redis.incr(dailyLimitKey);
  
  if (newCount === 1) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
    await redis.expire(dailyLimitKey, secondsUntilMidnight);
  }
  
  return {
    success: true,
    currentCount: newCount
  };
}

// Poll for active campaigns
async function pollForActiveCampaigns() {
  try {
    const campaignsUpdated = await redis.get('campaigns_updated');
    if (campaignsUpdated) {
      console.log(`[POLL] Campaigns update detected at ${new Date(parseInt(campaignsUpdated)).toISOString()}`);
      const activeCampaignsData = await redis.get('active_campaigns');
      if (activeCampaignsData) {
        let activeCampaignIds;
        try {
          console.log(`[POLL] Raw active_campaigns data: ${activeCampaignsData}`);
          activeCampaignIds = JSON.parse(activeCampaignsData);
          if (!Array.isArray(activeCampaignIds)) {
            throw new Error('active_campaigns is not an array');
          }
          // Filter out any non-string/invalid campaign IDs
          activeCampaignIds = activeCampaignIds.filter(id => typeof id === 'string' && id.length > 0);
          console.log(`[POLL] Parsed ${activeCampaignIds.length} valid active campaigns: ${JSON.stringify(activeCampaignIds)}`);
        } catch (e) {
          console.error(`[POLL] Invalid JSON in active_campaigns: ${activeCampaignsData}`);
          console.error(`[POLL] JSON parse error: ${e.message}`);
          await redis.del('active_campaigns');
          await redis.del('campaigns_updated');
          console.log('[POLL] Cleared invalid Redis keys');
          return;
        }
        if (activeCampaignIds.length === 0) {
          console.log('[POLL] No valid active campaigns to process');
          await redis.del('campaigns_updated');
          return;
        }
        for (const campaignId of activeCampaignIds) {
          if (!ACTIVE_CAMPAIGNS.has(campaignId)) {
            console.log(`[POLL] Starting new campaign: ${campaignId}`);
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();
            console.log(`[POLL] Campaign ${campaignId} status: ${campaignQueue.status}, queue length: ${campaignQueue.queue.length}`);
            if (campaignQueue.status === 'Running' && campaignQueue.queue.length > 0) {
              campaignQueue.process().catch(error => {
                console.error(`[ERROR] Failed to process campaign ${campaignId}:`, error);
              });
            } else {
              console.log(`[POLL] Skipping campaign ${campaignId} with status ${campaignQueue.status} and queue length ${campaignQueue.queue.length}`);
            }
          } else {
            console.log(`[POLL] Campaign ${campaignId} is already being processed`);
          }
        }
        await redis.del('campaigns_updated');
      } else {
        console.log('[POLL] No active_campaigns data found in Redis');
        await redis.del('campaigns_updated');
      }
    }
  } catch (error) {
    console.error('[POLL] Error polling for active campaigns:', error);
    if (error.message && error.message.includes('invalid username-password pair')) {
      console.error('[POLL] Redis authentication error. Check your Redis credentials.');
    }
  }
}

// Recover active campaigns function
async function recoverActiveCampaigns() {
  try {
    console.log("[RECOVER] Recovering active campaigns");
    const queueKeys = await redis.keys('queue:*');
    console.log(`[RECOVER] Found ${queueKeys.length} campaign queues in Redis`);
    
    if (queueKeys.length === 0) {
      return { recovered: 0 };
    }
    
    let recoveredCount = 0;
    const activeCampaignIds = [];
    
    for (const queueKey of queueKeys) {
      const campaignId = queueKey.split(':')[1];
      
      if (!campaignId) continue;
      
      const campaign = await prisma.message.findUnique({
        where: { id: campaignId }
      });
      
      if (!campaign) {
        console.log(`[RECOVER] Campaign ${campaignId} not found in database, skipping`);
        continue;
      }
      
      const campaignQueue = new CampaignQueue(campaignId);
      await campaignQueue.loadFromRedis();
      
      if (campaignQueue.queue.length > 0 && campaignQueue.status !== 'Stopped') {
        console.log(`[RECOVER] Checking campaign ${campaignId} with status ${campaign.status}, queue status: ${campaignQueue.status}`);
        
        // For rate limited campaigns, check if limit has reset
        if (campaign.status === 'Rate Limited') {
          const userId = campaign.userId;
          if (!userId) {
            console.error(`[RECOVER] Campaign ${campaignId} has no userId, skipping`);
            continue;
          }
          
          const limitCheck = await checkDailyLimit(userId);
          
          if (limitCheck.canSend) {
            campaignQueue.status = 'Running';
            await campaignQueue.saveToRedis();
            
            await prisma.message.update({
              where: { id: campaignId },
              data: { status: 'In Progress' }
            });
            
            // Add to active campaigns
            activeCampaignIds.push(campaignId);
            recoveredCount++;
          } else {
            console.log(`[RECOVER] Campaign ${campaignId} still rate limited (${limitCheck.currentCount}/${limitCheck.limit || 'unknown limit'})`);
          }
        }
        // For In Progress or Running campaigns, ensure they're added to active list
        else if (campaignQueue.status === 'Running' || campaign.status === 'In Progress') {
          campaignQueue.status = 'Running';
          await campaignQueue.saveToRedis();
          
          activeCampaignIds.push(campaignId);
          recoveredCount++;
        }
      }
    }
    
    // Update the active campaigns list
    if (activeCampaignIds.length > 0) {
      // Ensure we're storing a valid JSON string
      const activeCampaignsJson = JSON.stringify(activeCampaignIds);
      console.log(`[RECOVER] Setting active_campaigns to: ${activeCampaignsJson}`);
      
      // Make sure we're using JSON.stringify when setting the Redis key
      await redis.set('active_campaigns', activeCampaignsJson);
      await redis.set('campaigns_updated', Date.now().toString());
      
      console.log(`[RECOVER] Active campaigns set successfully`);
    } else {
      console.log(`[RECOVER] No active campaigns to set`);
    }
    
    console.log(`[RECOVER] Recovered ${recoveredCount} campaigns`);
    return { recovered: recoveredCount };
  } catch (error) {
    console.error('[RECOVER] Error recovering campaigns:', error);
    return { recovered: 0, error: error.message };
  }
}

// API endpoints - keep only the health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    activeCampaigns: Array.from(ACTIVE_CAMPAIGNS.keys()),
    activeBrowsers: Array.from(BROWSER_INSTANCES.keys())
  });
});

// Start campaign polling
function startCampaignPolling() {
  // Poll every 30 seconds
  setInterval(pollForActiveCampaigns, 30000);
  console.log('[POLL] Campaign polling started (every 30 seconds)');
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Background worker service running on port ${PORT}`);
  
  // Recover campaigns on startup
  await recoverActiveCampaigns();
  
  // Start polling for new campaigns
  startCampaignPolling();
});

module.exports = {
  CampaignQueue,
  sendDM,
  messageTransformFunction,
  checkDailyLimit,
  incrementDailyLimit,
  recoverActiveCampaigns
}; 