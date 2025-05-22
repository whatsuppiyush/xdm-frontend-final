// workers/send-DM.js
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const http = require('http');
const { getUserDailyMessageLimit, getEnvironmentAdjustedLimit, isFreeUser } = require('./planLimits');
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

// Helper function for random delays
async function randomDelay(min = 50, max = 500) {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

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
  constructor(campaignId, campaignName = 'Unknown') {
    this.campaignId = campaignId;
    this.campaignName = campaignName;
    this.queue = [];
    this.processedRecipients = [];
    this.totalAttempts = 0;
    this.status = 'Ready'; // Ready, Running, Paused, Stopped, Rate Limited, Account Issue
    this.browser = null;
    // Add error count tracking for browser restarts per recipient
    this.recipientErrorCounts = {};
    this.composerErrorCounts = {};
  }

  async loadFromRedis() {
    console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Loading campaign state from Redis`);
    console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Recipients left in queue: ${this.queue.length}`);
    const queueData = await redis.get(`${QUEUE_PREFIX}${this.campaignId}`);
    if (queueData) {
      this.queue = queueData.queue || [];
      this.processedRecipients = queueData.processedRecipients || [];
      this.status = queueData.status || 'Ready';
      this.totalAttempts = Number(queueData.totalAttempts || 0);
    } else {
      // If no data in Redis, ensure defaults are set (constructor initializes, but good for clarity)
      this.queue = [];
      this.processedRecipients = [];
      this.status = 'Ready';
      this.totalAttempts = 0;
    }
  }

  async saveToRedis() {
    console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Saving campaign state to Redis`);
    const queueState = {
      queue: this.queue,
      processedRecipients: this.processedRecipients,
      status: this.status,
      totalAttempts: Number(this.totalAttempts || 0)
    };
    await redis.set(`${QUEUE_PREFIX}${this.campaignId}`, queueState);
  }

  async process(dmWorker) {
    await this.loadFromRedis();
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;
    let recipientsToRetry = [];
    let consecutiveSkips = 0;
    const SKIP_THRESHOLD = 7;
    let lastPreemptionCheck = Date.now();
    const PREEMPTION_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
    let userEmail = 'Unknown';
    let twitterUsername = 'Unknown';
    let campaignOwnerUserId = null;
    let campaignOwnerPlanType = null;
    
    try {
      if (!dmWorker.browser) {
        await dmWorker.launchBrowser();
      }
      if (recipientsToRetry.length > 0) {
        console.log(`Adding ${recipientsToRetry.length} recipients back to the queue for retry`);
        this.queue = [...recipientsToRetry, ...this.queue];
        recipientsToRetry = [];
        await this.saveToRedis();
      }

      // Fetch user email, twitter username, and plan type once at the start of processing a campaign
      try {
          const campaignData = await prisma.message.findUnique({
              where: { id: this.campaignId },
              select: { userId: true }
          });
          if (campaignData && campaignData.userId) {
              campaignOwnerUserId = campaignData.userId; // Store campaign owner's userId
              const user = await prisma.user.findUnique({
                  where: { id: campaignData.userId },
                  select: { 
                      email: true, 
                      twitterAccounts: { select: { twitterAccountName: true }, take: 1 },
                      userCredits: { select: { planType: true } } // Fetch planType from UserCredits
                  }
              });
              if (user && user.email) {
                  userEmail = user.email;
              }
              if (user && user.twitterAccounts && user.twitterAccounts.length > 0 && user.twitterAccounts[0].twitterAccountName) {
                  twitterUsername = user.twitterAccounts[0].twitterAccountName;
              } else if (user && user.twitterAccounts && user.twitterAccounts.length > 0) {
                  console.warn(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] User ID ${campaignData.userId} has a Twitter account linked, but twitterAccountName is missing.`);
              } 
              // Fetch and store planType
              if (user && user.userCredits) {
                campaignOwnerPlanType = user.userCredits.planType;
              } else if (user) {
                console.warn(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] User ID ${campaignData.userId} found, but UserCredits (for planType) not found.`);
              }
              
              if (!userEmail && !twitterUsername && !campaignOwnerPlanType && user) {
                console.warn(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] User ID ${campaignData.userId} (from campaign) found, but no email, twitter account, or planType associated/retrieved.`);
              } else if (!user) {
                  console.warn(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] User ID ${campaignData.userId} (from campaign) not found in database.`);
              }
          } else {
              console.warn(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Could not retrieve userId for campaign to fetch email/twitter username/planType.`);
          }
      } catch (error) {
          console.error(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Error fetching user email/twitter username/planType for campaign user:`, error);
      }

      while (this.queue.length > 0 && this.status === 'Running') {
        // Preemption: check for new high-priority campaign every 3 hours
        if (Date.now() - lastPreemptionCheck >= PREEMPTION_INTERVAL_MS) {
          const highPriorityCampaignIds = await redis.smembers('high_priority_campaigns') || [];
          if (
            highPriorityCampaignIds.length > 0 &&
            !highPriorityCampaignIds.includes(this.campaignId)
          ) {
            console.log(`[${process.pid}] Preempting campaign ${this.campaignId} for high-priority campaign ${highPriorityCampaignIds[0]}`);
            return; // Immediately exit to allow worker to pick up high-priority campaign
          }
          lastPreemptionCheck = Date.now();
        }

        console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Recipients left in queue: ${this.queue.length}`);
        if (this.status !== 'Running') {
          console.log(`[${process.pid}] Campaign ${this.campaignId} (${this.campaignName}) status changed to ${this.status} during delay, stopping processing`);
          break;
        }

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
            // Add detailed rate limit log
            const userCredits = await prisma.userCredits.findUnique({ where: { userId } });
            const planType = userCredits?.planType;
            const planLimit = getUserDailyMessageLimit(userCredits);
            const effectiveLimit = getEnvironmentAdjustedLimit(planLimit);
            // Include user email and twitter username in rate limit log
            console.log(`RATE LIMIT: User ${userId} (plan: ${planType}, email: ${userEmail}, twitter: ${twitterUsername}) has sent ${limitCheck.currentCount} DMs, limit is ${effectiveLimit}. Campaign ${this.campaignId} will be set to Rate Limited.`);
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

        // Apply random delay between messages (2.7-4 minutes)
        const delay = Math.floor(Math.random() * (240000 - 162000 + 1) + 162000);
        console.log(`Waiting ${delay/60000} minutes before sending next message`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reload queue state after delay to check for status changes
        await this.loadFromRedis();
        if (this.status !== 'Running') {
          console.log(`[${process.pid}] Campaign ${this.campaignId} (${this.campaignName}) status changed to ${this.status} during delay, stopping processing`);
          break;
        }

        try {
          // Log DM attempt - Include user email and twitter username
          console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] [User: ${userEmail}] [Twitter: ${twitterUsername}] Attempting DM to recipient ${recipientId}`);
          const result = await dmWorker.sendDM(recipientId, message, cookies);
          if (result === true) {
            if (userId) {
              await dmWorker.incrementDailyLimit(userId);
              console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Incremented daily message count for user ${userId} after successful send`);
            }
            
            // Log DB update
            console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] [User: ${userEmail}] [Twitter: ${twitterUsername}] Updating DB status for recipient ${recipientId}`);
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
            consecutiveSkips = 0;
            console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] [User: ${userEmail}] [Twitter: ${twitterUsername}] DM to recipient ${recipientId} succeeded`);

            // --- Free User Campaign DM Limit Logic (Applied only to free users) ---
            if (campaignOwnerUserId && campaignOwnerPlanType && isFreeUser(campaignOwnerPlanType)) {
              const campaignDmCountKey = `campaign:${this.campaignId}:sentDMs`;
              const currentCampaignDMSentCount = await redis.incr(campaignDmCountKey);
              console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] DMs sent for this free user campaign: ${currentCampaignDMSentCount} (Limit: 150)`);

              if (currentCampaignDMSentCount >= 150) {
                console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Free user campaign DM limit (150) reached for user ${userEmail} (ID: ${campaignOwnerUserId}). Pausing campaign.`);
                this.status = 'Paused';
                await this.saveToRedis(); 
                
                await prisma.message.update({
                  where: { id: this.campaignId },
                  data: { status: 'Paused' }
                });
                console.log(`PAUSE EVENT: Campaign ${this.campaignId} (${this.campaignName}) for free user ${userEmail} (ID: ${campaignOwnerUserId}) paused due to reaching 150 DMs for this campaign.`);
                break; 
              }
            }
            // --- End Free User Logic ---

          } else if (result === 'composer_not_found') {
            this.composerErrorCounts = this.composerErrorCounts || {};
            this.composerErrorCounts[recipientId] = (this.composerErrorCounts[recipientId] || 0) + 1;
            if (this.composerErrorCounts[recipientId] >= 2) { // Reduced retries for composer not found
              console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Skipping recipient ${recipientId} due to: composer_not_found (max errors - 2 attempts)`);
              await dmWorker.updateMessageStatus(this.campaignId, recipientId, 'failed_composer_not_found');
              this.processedRecipients.push(recipientId);
              this.queue.shift();
              this.totalAttempts = 0; // Reset for next recipient
              await this.saveToRedis();
              consecutiveSkips++;
              if (consecutiveSkips >= SKIP_THRESHOLD) {
                this.status = 'Paused';
                await this.saveToRedis();
                await prisma.message.update({ where: { id: this.campaignId }, data: { status: 'Paused' } });
                console.log(`Paused campaign ${this.campaignId} [User: ${userEmail}] [Twitter: ${twitterUsername}] due to ${SKIP_THRESHOLD} consecutive skips (composer not found)`);
                break;
              }
              continue; // Continue to next iteration, which will process the next recipient or this one if re-added.
            } else {
              console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Composer not found for recipient ${recipientId}, will retry (attempt ${this.composerErrorCounts[recipientId]} of 2)`);
              // No immediate retry from here, let the loop continue with a delay
              // Move to next recipient or retry after main loop delay.
              // To retry this specific recipient, it needs to be re-added or not shifted.
              // For simplicity, we'll let it be skipped if it fails twice.
              // To retry immediately, you'd manage it like other errors.
              // For now, let's just log and it will be picked up again or shifted after max attempts.
              // Adding a small delay before continuing the loop might be good if you intend to retry the same user.
              // However, current logic will retry the *next* user after the main delay.
              // To retry *this* user, move it to the end of the queue or handle like other retries.
              // For now, we'll let it proceed to the next recipient or fail out.
              // This means it won't retry the same user immediately for composer_not_found.
              // The current structure would require shifting and re-adding to retry.
              // Let's assume for now that 2 failed attempts means we skip.
               this.queue.shift(); // Remove from queue
               this.queue.push({ recipientId, message, cookies, userId }); // Add to end of queue for later retry
               await this.saveToRedis();
               console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Recipient ${recipientId} moved to end of queue for later retry (composer_not_found).`);
               consecutiveSkips++;
               if (consecutiveSkips >= SKIP_THRESHOLD) {
                 this.status = 'Paused';
                 await this.saveToRedis();
                 await prisma.message.update({ where: { id: this.campaignId }, data: { status: 'Paused' } });
                 console.log(`Paused campaign ${this.campaignId} [User: ${userEmail}] [Twitter: ${twitterUsername}] due to ${SKIP_THRESHOLD} consecutive skips (composer not found)`);
                 break;
               }
               continue; // Continue to next iteration, which will process the next recipient or this one if re-added.
            }
          } else if (result === 'account_restricted') {
            console.warn(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Account associated with this campaign is RESTRICTED. Pausing campaign and putting account on cooldown.`);
            this.status = 'Account Issue'; // New status
            await this.saveToRedis();
            await prisma.message.update({
              where: { id: this.campaignId },
              data: { status: 'Account Issue' } // Update DB status
            });
            // Implement account cooldown logic here (e.g., add account ID to a Redis set with an expiry)
            // For now, we just pause the campaign. The worker should not pick up 'Account Issue' campaigns
            // until this status is manually or automatically cleared after a cooldown.
            console.log(`ACCOUNT RESTRICTION: Campaign ${this.campaignId} for user ${userEmail} (Twitter: ${twitterUsername}) paused due to account restriction.`);
            // Potentially log which cookies/account caused this if you have that mapping.
            break; // Stop processing this campaign
          } else {
            console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] DM to recipient ${recipientId} failed (result: ${result}), will retry if under max attempts`);
            this.handleFailedAttempt(recipientId);
            consecutiveSkips++;
            if (consecutiveSkips >= SKIP_THRESHOLD) {
              this.status = 'Paused';
              await this.saveToRedis();
              await prisma.message.update({ where: { id: this.campaignId }, data: { status: 'Paused' } });
              console.log(`Paused campaign ${this.campaignId} [User: ${userEmail}] [Twitter: ${twitterUsername}] due to ${SKIP_THRESHOLD} consecutive skips (send error)`);
              break;
            }
          }
        } catch (error) {
          // Track browser restart/cooldown attempts per recipient
          const MAX_BROWSER_RESTARTS_PER_RECIPIENT = 3;
          this.recipientErrorCounts[recipientId] = (this.recipientErrorCounts[recipientId] || 0) + 1;
          // Log the error reason
          console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] [User: ${userEmail}] [Twitter: ${twitterUsername}] Retrying recipient ${recipientId} due to error: ${error.message}`);
          if (this.recipientErrorCounts[recipientId] >= MAX_BROWSER_RESTARTS_PER_RECIPIENT) {
            console.log(`[${process.pid}] [${this.campaignId} - ${this.campaignName}] Max retries reached for recipient ${recipientId}, skipping.`);
            this.processedRecipients.push(recipientId);
            this.queue.shift();
            await this.saveToRedis();
            consecutiveSkips++;
            if (consecutiveSkips >= SKIP_THRESHOLD) {
              this.status = 'Paused';
              await this.saveToRedis();
              await prisma.message.update({ where: { id: this.campaignId }, data: { status: 'Paused' } });
              console.log(`Paused campaign ${this.campaignId} [User: ${userEmail}] [Twitter: ${twitterUsername}] due to ${SKIP_THRESHOLD} consecutive skips (browser restart/cooldown)`);
              break;
            }
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
            consecutiveSkips++;
            if (consecutiveSkips >= SKIP_THRESHOLD) {
              this.status = 'Paused';
              await this.saveToRedis();
              await prisma.message.update({ where: { id: this.campaignId }, data: { status: 'Paused' } });
              console.log(`Paused campaign ${this.campaignId} [User: ${userEmail}] [Twitter: ${twitterUsername}] due to ${SKIP_THRESHOLD} consecutive skips (send error)`);
              break;
            }
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
        console.log(`[${process.pid}] Campaign ${this.campaignId} (${this.campaignName}) [User: ${userEmail}] [Twitter: ${twitterUsername}] completed. Total recipients processed: ${this.processedRecipients.length}`);
      }
      
    } catch (error) {
      console.error(`Error processing campaign ${this.campaignId} (${this.campaignName}):`, error);
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
    this.lastStatusMap = new Map();
    this.idleStart = null;
    // this.idleTimeoutMs = 5 * 60 * 1000; // Default idle timeout
    this.startHeartbeat();

    // Added for periodic browser restart
    this.lastBrowserRestartTime = Date.now();
    this.browserRestartInterval = 4 * 60 * 60 * 1000; // 4 hours
    this.browserRestartCooldown = 10 * 60 * 1000; // 10 minutes
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
    console.log(`[${process.pid}] Starting processing loop...`);
    this.idleStart = null; 
    const idleTimeoutMs = 3 * 60 * 1000; // 3 minutes

    while (true) {
      try {
        // Perform periodic browser restart if not currently processing a campaign
        if (!this.isProcessing && (Date.now() - this.lastBrowserRestartTime > this.browserRestartInterval)) {
          console.log(`[${process.pid}] Scheduled 4-hourly browser restart initiated.`);

          console.log(`[${process.pid}] Closing browser for scheduled restart.`);
          await this.closeBrowser();

          // Regarding locks: Campaign-specific locks are lease-based (e.g., 5 minutes)
          // and are normally released by processNextTask. The 10-minute cooldown
          // ensures any unreleased lock held by this worker instance would expire.
          // Direct deletion of lock keys is avoided to maintain lock system integrity.
          console.log(`[${process.pid}] Entering ${this.browserRestartCooldown / 60000}-minute cooldown period. Existing campaign locks are expected to expire if not already released.`);
          await new Promise(resolve => setTimeout(resolve, this.browserRestartCooldown));

          console.log(`[${process.pid}] Cooldown finished. Relaunching browser.`);
          const browserLaunched = await this.launchBrowser();
          if (!browserLaunched) {
            console.error(`[${process.pid}] Failed to relaunch browser after scheduled restart. Will retry in the next loop iteration after a short delay.`);
            // Adjust restart time to attempt again relatively soon, e.g., in 1 minute.
            this.lastBrowserRestartTime = Date.now() - this.browserRestartInterval + (1 * 60 * 1000);
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute before continuing loop
            continue;
          }

          this.lastBrowserRestartTime = Date.now(); // Reset timer only after successful restart
          console.log(`[${process.pid}] Scheduled browser restart completed successfully.`);
          // The loop will continue, and processNextTask will be called if conditions are met.
        }

        if (!this.isProcessing) {
          const hasActive = await this.processNextTask();
          if (!hasActive) {
            if (!this.idleStart) {
              this.idleStart = Date.now();
            }
            if (Date.now() - this.idleStart > idleTimeoutMs) {
              console.log(`[${process.pid}] Worker idle for ${idleTimeoutMs / 60000} minutes, closing browser and exiting.`);
              await this.closeBrowser(); // Ensure browser is closed before exiting
              process.exit(0);
            }
          } else {
            this.idleStart = null; // Reset idle timer if a task was processed
          }
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Main loop delay
      } catch (error) {
        console.error(`[${process.pid}] Error in main processing loop:`, error);
        // To prevent immediate re-triggering of restart logic after a loop error,
        // update lastBrowserRestartTime. This keeps the restart as a scheduled maintenance.
        this.lastBrowserRestartTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait before retrying loop
      }
    }
  }

  async processNextTask() {
    // Check high-priority campaigns first
    const highPriorityCampaignIds = await redis.smembers('high_priority_campaigns') || [];
    let queueKeys = await redis.keys(`${QUEUE_PREFIX}*`);
    let prioritizedQueueKeys = [];
    if (highPriorityCampaignIds.length > 0) {
      prioritizedQueueKeys = queueKeys.filter(key => highPriorityCampaignIds.includes(key.split(':')[1]));
      // Place high-priority campaigns at the front
      queueKeys = [...prioritizedQueueKeys, ...queueKeys.filter(key => !highPriorityCampaignIds.includes(key.split(':')[1]))];
    }
    console.log(`Found ${queueKeys.length} campaign queues in Redis (high-priority: ${highPriorityCampaignIds.length})`);
    let hasActive = false;
    for (const queueKey of queueKeys) {
      const campaignId = queueKey.split(':')[1];
      if (!campaignId) continue;
      let campaignName = 'Unknown';
      let userPlanType = null;
      let userEmail = 'Unknown'; // Initialize userEmail
      let twitterUsername = 'Unknown'; // Initialize twitterUsername
      try {
        const campaign = await prisma.message.findUnique({
          where: { id: campaignId },
          select: { campaignName: true, userId: true }
        });
        if (campaign && campaign.campaignName) campaignName = campaign.campaignName;
        if (campaign && campaign.userId) {
          // Fetch user email and twitter username
          const user = await prisma.user.findUnique({
              where: { id: campaign.userId },
              select: { email: true, twitterAccounts: { select: { twitterAccountName: true }, take: 1 }, userCredits: { select: { planType: true } } }
          });
          if (user && user.email) {
              userEmail = user.email;
          }
          if (user && user.twitterAccounts && user.twitterAccounts.length > 0 && user.twitterAccounts[0].twitterAccountName) {
              twitterUsername = user.twitterAccounts[0].twitterAccountName;
          } else if (user && user.twitterAccounts && user.twitterAccounts.length > 0) {
              console.warn(`[${process.pid}] Worker: User ID ${campaign.userId} has a Twitter account linked, but twitterAccountName is missing for campaign ${campaignId}.`);
          } else if (user) {
              console.warn(`[${process.pid}] Worker: User ID ${campaign.userId} found, but no email or twitter account associated/retrieved for campaign ${campaignId}.`);
          } else {
              console.warn(`[${process.pid}] Worker: User ID ${campaign.userId} (from campaign ${campaignId}) not found in database.`);
          }

          const userCredits = await prisma.userCredits.findUnique({ where: { userId: campaign.userId } });
          userPlanType = userCredits?.planType;
          // If free user, ensure campaignId is in high_priority_campaigns set
          if (isFreeUser(userPlanType)) {
            await redis.sadd('high_priority_campaigns', campaignId);
          } else {
            await redis.srem('high_priority_campaigns', campaignId);
          }
        }
      } catch (e) {
        console.error(`Error fetching campaign/user info for ${campaignId}:`, e);
      }
      // Generate a unique lock owner ID before acquiring the lock
      const lockOwnerId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const lock = new Lock({
        id: `lock:campaign:${campaignId}`,
        redis: redis,
        lease: 300000, // 5 minutes
        owner: lockOwnerId
      });
      if (await lock.acquire()) {
        let lockRenewal;
        try {
          console.log(`[${process.pid}] [${campaignId} - ${campaignName}] [User: ${userEmail}] [Twitter: ${twitterUsername}] Acquired lock at ${new Date().toISOString()} (owner: ${lockOwnerId})`);
          lockRenewal = setInterval(async () => {
            const extended = await lock.extend(300000);
            if (extended) {
              console.log(`[${process.pid}] [${campaignId} - ${campaignName}] Lock renewed at ${new Date().toISOString()} (owner: ${lockOwnerId})`);
            } else {
              console.error(`[${process.pid}] [${campaignId} - ${campaignName}] Failed to extend lock (owner: ${lockOwnerId})`);
            }
          }, 90000);
          const campaignQueue = new CampaignQueue(campaignId, campaignName);
          await campaignQueue.loadFromRedis();
          // Verify the lock is still held by this worker before processing
          if (typeof lock.getOwner === 'function') {
            const currentOwner = await lock.getOwner();
            if (currentOwner !== lockOwnerId) {
              console.log(`[${process.pid}] [${campaignId} - ${campaignName}] Lock ownership lost before processing (expected: ${lockOwnerId}, got: ${currentOwner})`);
              continue;
            }
          }
          if (["Running"].includes(campaignQueue.status)) {
            hasActive = true;
            const lastStatus = this.lastStatusMap.get(campaignId);
            if (campaignQueue.status !== lastStatus) {
              console.log(`[${process.pid}] Campaign ${campaignId} (${campaignName}) [User: ${userEmail}] [Twitter: ${twitterUsername}] status changed to: ${campaignQueue.status}`);
              this.lastStatusMap.set(campaignId, campaignQueue.status);
            }
            await redis.sadd('active_campaigns', campaignId);
            this.isProcessing = true;
            this.currentCampaignId = campaignId;
            await campaignQueue.process(this);
            // Remove from high-priority set if campaign is no longer running
            const updatedQueue = await redis.get(`${QUEUE_PREFIX}${campaignId}`);
            if (updatedQueue) {
              const status = updatedQueue.status || campaignQueue.status;
              if (["Paused", "Stopped", "Completed", "Rate Limited", "Account Issue"].includes(status)) {
                await redis.srem('high_priority_campaigns', campaignId);
              }
            } else {
              // If queue is deleted, remove from high-priority set
              await redis.srem('high_priority_campaigns', campaignId);
            }
            this.isProcessing = false;
            this.currentCampaignId = null;
            break;
          } else {
            await redis.srem('active_campaigns', campaignId);
            const lastStatus = this.lastStatusMap.get(campaignId);
            if (campaignQueue.status !== lastStatus) {
              console.log(`[${process.pid}] Campaign ${campaignId} (${campaignName}) [User: ${userEmail}] [Twitter: ${twitterUsername}] status changed to: ${campaignQueue.status}`);
              this.lastStatusMap.set(campaignId, campaignQueue.status);
            }
            continue;
          }
        } finally {
          clearInterval(lockRenewal);
          await lock.release();
          console.log(`[${process.pid}] [${campaignId} - ${campaignName}] Released lock at ${new Date().toISOString()} (owner: ${lockOwnerId})`);
        }
      } else {
        console.log(`[${process.pid}] [${campaignId} - ${campaignName}] Could not acquire lock at ${new Date().toISOString()} (owner: ${lockOwnerId})`);
      }
    }
    return hasActive;
  }

  async updateMessageStatus(campaignId, recipientId, statusOverride = null) {
    try {
      // Find and update the message for this specific campaign
      const messageRecord = await prisma.message.findUnique({
        where: { id: campaignId }
      });
      const campaignName = messageRecord?.campaignName || 'Unknown';
      if (messageRecord) {
        const updatedMessages = messageRecord.messages.map(msg => 
          msg.recipientId === recipientId 
            ? { ...msg, status: statusOverride ? statusOverride : true } // Use statusOverride if provided
            : msg
        );
        await prisma.message.update({
          where: { id: campaignId },
          data: { messages: updatedMessages }
        });
        console.log(`[${process.pid}] [${campaignId} - ${campaignName}] Updated message status for recipient ${recipientId} in DB`);
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
      
      await randomDelay(100, 300); // Delay before setting up request interception
      
      // Block unnecessary resources - consider making this less aggressive
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        // Reduced blocking: allow stylesheets and fonts, as real browsers load them.
        // Consider further reducing blocking or making it random.
        if (['image', 'media', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Set minimal viewport - consider randomizing this
      await page.setViewport({ width: 800, height: 600 });
      const essentialCookies = cookies.filter(c => ['auth_token', 'ct0'].includes(c.name));
      await page.setCookie(...essentialCookies);
      console.log(`[${recipientId}] Cookies set, essential count: ${essentialCookies.length}`);
      await randomDelay();
      
      // Navigate directly with minimal wait
      console.log(`[${recipientId}] Navigating to DM page`);
      await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
        waitUntil: 'domcontentloaded', // Changed from 'networkidle0' for speed, but 'networkidle2' might be safer
        timeout: 60000
      });
      await randomDelay(200, 700); // Longer delay after page navigation
      console.log(`[${recipientId}] Navigation complete`);

      // Check for account restriction warning
      try {
        const restrictedAccountTextSelector = '//span[contains(text(), "Caution: This account is temporarily restricted")]';
        const restrictedAccountButtonSelector = '//span[contains(text(), "Yes, view profile")]/ancestor::div[@role="button"]';
        
        const restrictedTextElement = await page.waitForXPath(restrictedAccountTextSelector, { timeout: 5000, visible: true });
        if (restrictedTextElement) {
          console.warn(`[${recipientId}] Account restriction detected for campaign ${this.currentCampaignId}. Attempting to click 'Yes, view profile'.`);
          await randomDelay();
          const viewProfileButton = await page.waitForXPath(restrictedAccountButtonSelector, { timeout: 5000, visible: true });
          if (viewProfileButton) {
            await randomDelay(50, 150);
            await viewProfileButton.click();
            await randomDelay(200, 500);
            await page.waitForTimeout(5000); // Wait for page to potentially reload/change
            console.log(`[${recipientId}] Clicked 'Yes, view profile'.`);
            // Re-check if composer is now available or if restriction is gone.
            // For now, we will assume the action might take time to reflect or may not resolve immediately.
            return 'account_restricted'; // Signal that account encountered a restriction.
          } else {
             console.warn(`[${recipientId}] Account restriction text found, but 'Yes, view profile' button not found.`);
             return 'account_restricted'; // Still signal restriction
          }
        }
      } catch (e) {
        // Not an error if selectors are not found, means no restriction page (or different layout)
        if (e.name === 'TimeoutError') {
          console.log(`[${recipientId}] No account restriction warning detected (or selectors timed out).`);
        } else {
          console.log(`[${recipientId}] Minor error checking for restriction: ${e.message}`);
        }
      }
      
      // Find composer with minimal DOM operations
      console.log(`[${recipientId}] Waiting for composer selector`);
      try {
        await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
          timeout: 60000, // Increased timeout for composer
          visible: true
        });
        await randomDelay(100, 300); // Delay after composer is found
      } catch (e) {
        if (e.name === 'TimeoutError') {
          console.error(`[${recipientId}] DM composer not found. This could be due to a profile not accepting DMs, a page load issue, or a change in Twitter UI.`);
          return 'composer_not_found'; // Specific return for composer issues
        }
        // For other errors during waitForSelector, rethrow to be caught by the main try-catch
        console.error(`[${recipientId}] Error waiting for composer: ${e.message}`);
        throw e;
      }
      console.log(`[${recipientId}] Composer found, attempting to type`);
      
      // Use a more reliable typing method
      try {
        // Try direct typing first (most reliable)
        console.log(`[${recipientId}] Typing message (line by line, Shift+Enter for newlines): ${message}`);
        const lines = message.split('\n');
        const composerSelector = '[data-testid="dmComposerTextInput"]';

        for (let i = 0; i < lines.length; i++) {
          await page.type(composerSelector, lines[i], { delay: Math.floor(Math.random() * (150 - 50 + 1) + 50) }); // Random char typing delay
          await randomDelay(30, 100); // Small delay after typing a line part
          if (i < lines.length - 1) { // If it's not the last line
            await page.keyboard.down('Shift');
            await page.keyboard.press('Enter');
            await page.keyboard.up('Shift');
            await randomDelay(50, 150); // Delay after newline
            await page.waitForTimeout(50); // Small delay after newline
          }
        }
        console.log(`[${recipientId}] Message typed (line by line, Shift+Enter) successfully: ${message}`);
      } catch (error) {
        console.log(`[${recipientId}] page.type (line by line, Shift+Enter) failed: ${error.message}`);
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
        await randomDelay(100, 400); // Delay before clicking send
        await page.click('[data-testid="dmComposerSendButton"]');
        await randomDelay(50, 150); // Small delay after click
        console.log(`[${recipientId}] Send button clicked successfully, message: ${message}`);
      } catch (clickError) {
        console.error(`[${recipientId}] Error clicking send button: ${clickError.message}`);
      }
      await page.waitForTimeout(1000); // Existing delay, kept for now
      await randomDelay(200, 600); // Final random delay before concluding success
      console.log(`[${recipientId}] Message sent successfully (browser action complete)`);
      
      return true;
    } catch (error) {
      console.error(`[${recipientId}] FAILED: ${error.message}`);
      console.error(`[${recipientId}] Error stack: ${error.stack.split('\n')[0]}`);
      
      // Check if it's a memory-related error and rethrow it so the outer catch block can handle it
      if (this.isMemoryError(error)) {
        throw error; // Rethrow memory errors
      }
      // Check if the error indicates a navigation timeout or other critical browser issue
      if (error.message.includes('Navigation timeout') || error.message.includes('Target closed') || error.message.includes('Session closed')) {
        console.error(`[${recipientId}] Critical browser/navigation error: ${error.message}. Rethrowing to trigger browser restart logic.`);
        throw error; // Rethrow to be handled by the CampaignQueue's error handling
      }
      
      return false; // Return false for other non-memory errors
    } finally {
      if (page) {
        console.log(`[${this.currentCampaignId}] Cleaning up Puppeteer page for recipient ${recipientId}`);
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