const { redis, prisma, MAX_RETRIES, messageTransformFunction } = require('./config');
const { BROWSER_INSTANCES, launchBrowser } = require('./browser-manager');
const { sendDM } = require('./message-sender');
const { checkDailyLimit, incrementDailyLimit } = require('./limit-manager');

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
    // Get the ACTIVE_CAMPAIGNS from the campaign-manager
    const { ACTIVE_CAMPAIGNS, addCampaignToActiveList } = require('./campaign-manager');
    
    // Add to local tracking
    ACTIVE_CAMPAIGNS.set(this.campaignId, this);
    
    // Add to Redis using the new function that guarantees valid JSON
    await addCampaignToActiveList(this.campaignId);
    
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
      const { ACTIVE_CAMPAIGNS } = require('./campaign-manager');
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

module.exports = {
  CampaignQueue
}; 