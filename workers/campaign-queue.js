const { prisma, redis, QUEUE_PREFIX, MAX_RETRIES } = require('./config');
const { isMemoryError } = require('./utils');

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
          // Send the DM
          const success = await dmWorker.sendDM(recipientId, message, cookies);
          
          if (success) {
            // Only increment the counter AFTER successful message sending
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
          if (isMemoryError(error)) {
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

module.exports = { CampaignQueue }; 