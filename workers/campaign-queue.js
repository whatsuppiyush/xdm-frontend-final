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

  // Debounced save logic
  _debounceTimer = null;
  _pendingSave = false;
  _lastSaveState = null;

  async loadFromRedis(force = false) {
    // Only load if we haven't loaded recently or if forced
    if (!this._lastSaveState || force) {
      const queueData = await redis.get(`${QUEUE_PREFIX}${this.campaignId}`);
      if (queueData) {
        this.queue = queueData.queue || [];
        this.processedRecipients = queueData.processedRecipients || [];
        this.status = queueData.status || 'Ready';
        this.totalAttempts = queueData.totalAttempts || 0;
        this._lastSaveState = JSON.stringify(queueData);
      }
    }
  }

  debouncedSaveToRedis(delay = 10000) {
    if (this._debounceTimer) return;
    this._debounceTimer = setTimeout(async () => {
      await this.saveToRedis();
      this._debounceTimer = null;
    }, delay);
  }

  async saveToRedis(force = false) {
    // Only save if state has changed or if forced
    const queueState = {
      queue: this.queue,
      processedRecipients: this.processedRecipients,
      status: this.status,
      totalAttempts: this.totalAttempts
    };
    const stateStr = JSON.stringify(queueState);
    if (force || stateStr !== this._lastSaveState) {
      await redis.set(`${QUEUE_PREFIX}${this.campaignId}`, queueState);
      this._lastSaveState = stateStr;
    }
  }

  async process(dmWorker) {
    await this.loadFromRedis();
    console.log(`Processing campaign ${this.campaignId}, status: ${this.status}`);
    if (this.status === 'Stopped' || this.status === 'Paused') return;
    this.status = 'Running';
    await this.saveToRedis();
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
    let messageCounter = 0;
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
      while (this.queue.length > 0 && this.status === 'Running') {
        // Only reload from Redis every 10 messages or if forced
        if (messageCounter % 10 === 0 && messageCounter !== 0) {
          await this.loadFromRedis();
          if (this.status !== 'Running') break;
        }
        const { recipientId, message, cookies, userId } = this.queue[0];
        if (this.processedRecipients.includes(recipientId)) {
          this.queue.shift();
          this.debouncedSaveToRedis();
          messageCounter++;
          continue;
        }
        if (limitCheckCounter % 5 === 0) {
          if (!userId) {
            console.error(`userId is undefined for campaign: ${this.campaignId}`);
            try {
              const campaign = await prisma.message.findUnique({
                where: { id: this.campaignId },
                select: { userId: true }
              });
              if (campaign?.userId) {
                console.log(`Found userId ${campaign.userId} from database for campaign ${this.campaignId}`);
                this.queue[0].userId = campaign.userId;
                this.debouncedSaveToRedis();
                const limitCheck = await dmWorker.checkDailyLimit(campaign.userId);
                if (!limitCheck.canSend) {
                  console.log(`Daily limit reached for user ${campaign.userId}. Setting campaign to Rate Limited.`);
                  this.status = 'Rate Limited';
                  await this.saveToRedis(true);
                  await prisma.message.update({
                    where: { id: this.campaignId },
                    data: { status: 'Rate Limited' }
                  });
                  return;
                }
              }
            } catch (error) {
              console.error("Error fetching userId from database:", error);
            }
            this.queue.shift();
            this.debouncedSaveToRedis();
            messageCounter++;
            continue;
          }
          const limitCheck = await dmWorker.checkDailyLimit(userId);
          if (!limitCheck.canSend) {
            console.log(`Daily limit reached for user ${userId}. Setting campaign to Rate Limited.`);
            this.status = 'Rate Limited';
            await this.saveToRedis(true);
            await prisma.message.update({
              where: { id: this.campaignId },
              data: { status: 'Rate Limited' }
            });
            return;
          }
        }
        limitCheckCounter++;
        const delay = Math.floor(Math.random() * (240000 - 120000 + 1) + 120000);
        console.log(`Waiting ${delay/60000} minutes before sending next message`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Only reload from Redis every 10 messages or if forced
        if (messageCounter % 10 === 0 && messageCounter !== 0) {
          await this.loadFromRedis();
          if (this.status !== 'Running') {
            console.log(`Campaign ${this.campaignId} status changed to ${this.status} during delay, stopping processing`);
            break;
          }
        }
        try {
          const success = await dmWorker.sendDM(recipientId, message, cookies);
          if (success) {
            if (userId) {
              await dmWorker.incrementDailyLimit(userId);
              console.log(`Incremented daily message count for user ${userId} after successful send`);
            }
            await dmWorker.updateMessageStatus(this.campaignId, recipientId);
            this.processedRecipients.push(recipientId);
            this.queue.shift();
            this.totalAttempts = 0;
            consecutiveMemoryErrors = 0;
            this.recipientErrorCounts[recipientId] = 0;
            this.debouncedSaveToRedis();
          } else {
            this.handleFailedAttempt(recipientId);
            this.debouncedSaveToRedis();
          }
        } catch (error) {
          const MAX_BROWSER_RESTARTS_PER_RECIPIENT = 3;
          this.recipientErrorCounts[recipientId] = (this.recipientErrorCounts[recipientId] || 0) + 1;
          console.error(`[${recipientId}] Browser restart/cooldown error: ${error.message}`);
          if (this.recipientErrorCounts[recipientId] >= MAX_BROWSER_RESTARTS_PER_RECIPIENT) {
            console.log(`[${recipientId}] Hit max browser restarts (${MAX_BROWSER_RESTARTS_PER_RECIPIENT}), skipping recipient.`);
            this.processedRecipients.push(recipientId);
            this.queue.shift();
            this.debouncedSaveToRedis();
            messageCounter++;
            continue;
          }
          console.log("Error in send attempt:", error);
          if (isMemoryError(error)) {
            consecutiveMemoryErrors++;
            console.log(`Browser memory issue detected: ${error.message}`);
            console.log(`Performing browser restart and cooldown (attempt ${++browserRestartCount}, consecutive: ${consecutiveMemoryErrors})`);
            await this.saveToRedis(true);
            const currentRecipient = this.queue[0];
            recipientsToRetry.push(currentRecipient);
            console.log("Recipients to retry:", recipientsToRetry);
            this.queue.shift();
            await this.saveToRedis(true);
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors * 2), 10);
            console.log(`Cooling down for ${cooldownMinutes} minutes before restarting browser`);
            await dmWorker.closeBrowser();
            await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60000));
            console.log(`Cooldown completed, restarting browser`);
            try {
              await dmWorker.launchBrowser();
              console.log("Browser restarted successfully after cooldown");
              this.queue = [...recipientsToRetry, ...this.queue];
              recipientsToRetry = [];
              await this.saveToRedis(true);
              continue;
            } catch (restartError) {
              console.error('Error restarting browser:', restartError);
              break;
            }
          } else {
            console.error(`Error sending DM to ${recipientId}:`, error);
            this.handleFailedAttempt(recipientId);
            this.debouncedSaveToRedis();
          }
        }
        messageCounter++;
      }
      if (this.queue.length === 0) {
        this.status = 'Completed';
        await this.saveToRedis(true);
        await prisma.message.update({
          where: { id: this.campaignId },
          data: { status: 'Completed' }
        });
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