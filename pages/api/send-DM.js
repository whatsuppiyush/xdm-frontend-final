// pages/api/scheduler.js

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import redis from '@/lib/redis';
import { DAILY_MESSAGE_LIMIT } from '@/lib/constants';
const prisma = new PrismaClient();
const MAX_RETRIES = 2;

// Add campaign queue management
// const campaignQueues = new Map(); // Store queues for each campaign
// Update the queue structure
class CampaignQueue {
  constructor(campaignId) {
    this.campaignId = campaignId;
    this.queue = [];
    this.processedRecipients = new Set();
    this.totalAttempts = 0;
    // Use a single status field instead of multiple flags
    this.status = 'Ready'; // Ready, Running, Paused, Stopped
    this.browser = null;
    this.browserWSEndpoint = null;
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
      console.log(`Loaded queue state for ${this.campaignId}: status=${this.status}`);
    }
  }

  async addRecipients(recipients, message, cookies, userId) {
    await this.loadFromRedis();
    recipients.forEach(recipient => {
      let transformedMessage = messageTransformFunction(message, recipient);
      this.queue.push({ 
        recipientId: recipient.id, 
        message: transformedMessage, 
        cookies,
        userId  // Add userId to each queue item
      });
    });
    await this.saveToRedis();
  }

  async updateMessageStatus(recipientId, message) {
    try {
      // Find and update the message for this specific campaign
      const messageRecord = await prisma.message.findUnique({
        where: { 
          id: this.campaignId 
        }
      });

      if (messageRecord) {
        const updatedMessages = messageRecord.messages.map(msg => 
          msg.recipientId === recipientId 
            ? { ...msg, status: true }
            : msg
        );

        await prisma.message.update({
          where: { 
            id: this.campaignId 
          },
          data: { 
            messages: updatedMessages 
          }
        });
                }
            } catch (error) {
      console.error('Failed to update message status:', error);
    }
  }

  async process() {
    await this.loadFromRedis();
    console.log("process started", this.status);
    // Only proceed if status is Ready or Running
    if (this.status === 'Stopped' || this.status === 'Paused') return;
    
    // Set status to Running
    this.status = 'Running';
    await this.saveToRedis();
    
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;

    try {
      // Launch browser with memory optimization arguments
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

      console.log(`Browser launched for campaign ${this.campaignId}`);

      while (this.queue.length > 0 && this.status === 'Running') {
        await this.loadFromRedis();
        if (this.status !== 'Running') break;

        const { recipientId, message, cookies, userId } = this.queue[0];
        console.log("userId and recipientId", userId, recipientId);
        
        if (this.processedRecipients.has(recipientId)) {
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }

        // Check daily limit every 5 messages or on the first message
        if (limitCheckCounter % 5 === 0) {
          // Ensure userId is defined before checking limit
          if (!userId) {
            console.error("userId is undefined for campaign:", this.campaignId);
            
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
                const limitCheck = await checkAndIncrementDailyLimit(campaign.userId);
                if (!limitCheck.canSend) {
                  console.log(`Daily limit reached for user ${campaign.userId}. Setting campaign to Rate Limited.`);
                  
                  // Set campaign status to Rate Limited
                  this.status = 'Rate Limited';
                  await this.saveToRedis();
                  
                  // Update the message status in database
                  try {
                    await prisma.message.update({
                      where: { id: this.campaignId },
                      data: { status: 'Rate Limited' }
                    });
                  } catch (error) {
                    console.error('Failed to update message status:', error);
                  }
                  
                  // Exit the processing loop
                  return;
                }
                
                console.log(`Daily limit check passed. Current count: ${limitCheck.currentCount}`);
              }
            } catch (error) {
              console.error("Error fetching userId from database:", error);
            }
            
            // Skip this message if no userId found
            this.queue.shift();
            await this.saveToRedis();
            continue;
          }
          
          const limitCheck = await checkAndIncrementDailyLimit(userId);
          
          if (!limitCheck.canSend) {
            console.log(`Daily limit reached for user ${userId}. Setting campaign to Rate Limited.`);
            
            // Set campaign status to Rate Limited
            this.status = 'Rate Limited';
            await this.saveToRedis();
            
            // Update the message status in database
            try {
              await prisma.message.update({
                where: { id: this.campaignId },
                data: { status: 'Rate Limited' }
              });
            } catch (error) {
              console.error('Failed to update message status:', error);
            }
            
            break; // Exit the processing loop
          }
          
          console.log(`Daily limit check passed. Current count: ${limitCheck.currentCount}`);
        } else {
          // Ensure userId is defined before incrementing counter
          if (userId) {
            // Still increment counter for each message, just don't check limit
            await redis.incr(`user:${userId}:daily_messages:${new Date().toISOString().split('T')[0]}`);
          }
        }
        limitCheckCounter++;

        // Apply delay between messages
        const delay = 1 * 60000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await this.loadFromRedis();
        if (this.status !== 'Running') break;

        try {
          const success = await sendDM(recipientId, message, cookies, this.browser);
          
          if (success) {
            await this.updateMessageStatus(recipientId, message);
            this.processedRecipients.add(recipientId);
            this.queue.shift();
            this.totalAttempts = 0;
            // Reset consecutive errors counter on success
            consecutiveMemoryErrors = 0;
          } else {
            this.handleFailedAttempt(recipientId);
          }
        } catch (error) {
          // Check for memory-related errors - add the specific Target.createTarget error
          console.log("error inside process catch block",error);
          if (error.message.includes('Target.createTarget timed out') || 
              error.message.includes('out of memory') || 
              error.message.includes('Browser closed') ||
              error.message.includes('Protocol error') || 
              error.message.includes('Increase the \'protocolTimeout\'')) {
            
            // Increment consecutive errors
            consecutiveMemoryErrors++;
            console.log(`Browser memory issue detected: ${error.message}`);
            console.log(`Performing browser restart and cooldown (attempt ${++browserRestartCount}, consecutive: ${consecutiveMemoryErrors})`);
            
            // Save current state
            await this.saveToRedis();
            
            // Close browser
            if (this.browser) {
              await this.browser.close().catch(console.error);
              this.browser = null;
            }
            
            // Progressive cooldown period - increases with consecutive errors
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors * 2), 15);
            console.log(`Cooling down for ${cooldownMinutes} minutes before restarting browser`);
            await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60000));
            
            // Restart browser with minimal settings
            this.browser = await puppeteer.launch({
              args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--js-flags="--max-old-space-size=256"'
              ],
              executablePath,
              headless: isLocal ? false : chromium.headless,
              defaultViewport: { width: 800, height: 600 }
            });
            
            console.log("Browser restarted after cooldown");
            
            // Don't count this as a failure
            continue;
          } else {
            // For other errors, count as a failure
            console.error(`Error sending message to ${recipientId}:`, error);
            this.handleFailedAttempt(recipientId);
          }
        }
        
        await this.saveToRedis();
      }
      
      // If we've processed all messages, mark as Completed
      if (this.queue.length === 0) {
        this.status = 'Completed';
        await this.saveToRedis();
        
        // Update the message status in database
        try {
          await prisma.message.update({
            where: { id: this.campaignId },
            data: { status: 'Completed' }
          });
        } catch (error) {
          console.error('Failed to update message status:', error);
        }
      }
      
    } catch (error) {
      console.error(`Error processing campaign ${this.campaignId}:`, error);
    } finally {
      if (this.browser) {
        console.log("Closing browser");
        await this.browser.close().catch(console.error);
        this.browser = null;
      }
      
      // Delete the queue from Redis if empty or stopped
      if (this.queue.length === 0 || this.status === 'Stopped') {
        const queueKey = `queue:${this.campaignId}`;
        try {
          await redis.del(queueKey);
          console.log(`Cleaned up Redis queue for campaign ${this.campaignId}`);
        } catch (redisError) {
          console.error(`Failed to clean up Redis queue for campaign ${this.campaignId}:`, redisError);
        }
      }
    }
  }

  handleFailedAttempt(recipientId) {
    this.totalAttempts++;
    if (this.totalAttempts >= MAX_RETRIES) {
    console.log("processedRecipients handleFailedAttempt",this.totalAttempts,recipientId);
      this.processedRecipients.add(recipientId);
      this.queue.shift();
      this.totalAttempts = 0;
    }
  }

  async stop() {
    this.status = 'Stopped';
    this.queue = []; // Clear the queue
    await this.saveToRedis();
    console.log(`Campaign ${this.campaignId} stopped and Redis state updated`);
  }

  async pause() {
    this.status = 'Paused';
    await this.saveToRedis();
    console.log(`Campaign ${this.campaignId} paused`);
  }

  async resume() {
    this.status = 'Running';
    await this.saveToRedis();
    
    // Restart processing only if we have items in the queue
    if (this.queue.length > 0) {
      this.process().catch(console.error);
    }
    console.log(`Campaign ${this.campaignId} resumed`);
  }

  async updateQueueWithUserId(userId) {
    await this.loadFromRedis();
    
    // Add userId to all queue items that don't have it
    this.queue = this.queue.map(item => {
      if (!item.userId) {
        return { ...item, userId };
      }
      return item;
    });
    
    await this.saveToRedis();
    console.log(`Updated queue items with userId: ${userId} for campaign: ${this.campaignId}`);
  }
}

// Update sendDM to accept browser instance
const sendDM = async (recipientId, message, cookies, browser) => {
  let page = null;
  
  try {
    console.log(`[${recipientId}] Starting DM process`);
    page = await browser.newPage();
    
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
      timeout: 30000,
      visible: true
    });
    console.log(`[${recipientId}] Composer found, attempting to type`);
    
    // Use a more reliable typing method
    try {
      // Try direct typing first (most reliable)
      console.log(`[${recipientId}] Trying page.type method`);
      await page.type('[data-testid="dmComposerTextInput"]', message);
      console.log(`[${recipientId}] page.type succeeded`);
    } catch (error) {
      console.log(`[${recipientId}] page.type failed: ${error.message}`);
      // Fallback method using evaluate with better error checking
      console.log(`[${recipientId}] Trying evaluate method`);
      await page.evaluate((msg) => {
        const composer = document.querySelector('[data-testid="dmComposerTextInput"]');
        if (composer) {
          console.log('Found composer via main selector');
          composer.innerText = msg;
          composer.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } else {
          console.log('Main selector failed, trying alternatives');
          // Try alternative selectors
          const alternatives = [
            '[role="textbox"]',
            '[contenteditable="true"]',
            'div[data-contents="true"]'
          ];
          
          for (const selector of alternatives) {
            const element = document.querySelector(selector);
            if (element) {
              console.log(`Found element via ${selector}`);
              element.innerText = msg;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            }
          }
          return false;
        }
      }, message).then(result => {
        console.log(`[${recipientId}] Evaluate method result: ${result}`);
      });
    }
    
    // Click send
    console.log(`[${recipientId}] Attempting to click send button`);
    await page.click('[data-testid="dmComposerSendButton"]');
    await page.waitForTimeout(1000);
    console.log(`[${recipientId}] Message sent successfully`);
    
    return true;
  } catch (error) {
    console.error(`[${recipientId}] FAILED: ${error.message}`);
    console.error(`[${recipientId}] Error stack: ${error.stack.split('\n')[0]}`);
    
    // Check if it's a memory-related error and rethrow it so the outer catch block can handle it
    if (error.message.includes('Target.createTarget timed out') || 
        error.message.includes('TimeoutError') ||
        error.message.includes('out of memory') || 
        error.message.includes('Browser closed') ||
        error.message.includes('Protocol error') || 
        error.message.includes('Increase the \'protocolTimeout\'')) {
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
};

const messageTransformFunction = (message,recipient) => {
    let transformedMessage = message.replace("{name}",recipient.name?recipient.name.split(" ")[0]:"");
    transformedMessage = transformedMessage.replace("{username}",recipient.username?recipient.username:"");
    transformedMessage = transformedMessage.replace("{url}",recipient.url?recipient.url:"");
    transformedMessage = transformedMessage.replace("{bio}",recipient.bio?recipient.bio:"");
    transformedMessage = transformedMessage.replace("{followers}",recipient.followers?recipient.followers:"");
    transformedMessage = transformedMessage.replace("{following}",recipient.following?recipient.following:"");
    return transformedMessage;
}

// Optimize the checkAndIncrementDailyLimit function
async function checkAndIncrementDailyLimit(userId) {
  if (!userId) {
    console.error("userId is undefined in checkAndIncrementDailyLimit");
    return { canSend: false };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
  
  // First check if we're already at the limit before incrementing
  const currentCount = await redis.get(dailyLimitKey);
  const parsedCount = currentCount ? parseInt(currentCount) : 0;
  
  // For testing: use a very low limit in development
  const effectiveLimit = process.env.NODE_ENV === 'development' ? 10 : DAILY_MESSAGE_LIMIT;
  console.log(`Current count: ${parsedCount}, Limit: ${effectiveLimit}`);
  
  // If already at limit, don't increment
  if (parsedCount >= effectiveLimit) {
    console.log(`Daily limit of ${effectiveLimit} reached for user ${userId}`);
    return {
      canSend: false,
      currentCount: parsedCount
    };
  }
  
  // Increment the counter
  const newCount = await redis.incr(dailyLimitKey);
  
  // If this is the first increment, set expiration
  if (newCount === 1) {
    // For testing in development: use a very short expiration time
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // For testing: expire in 2 minutes
      console.log('TESTING MODE: Setting rate limit key to expire in 2 minutes');
      await redis.expire(dailyLimitKey, 120); // 120 seconds
    } else {
      // Production: Calculate seconds until midnight of the next day
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
      await redis.expire(dailyLimitKey, secondsUntilMidnight);
    }
  }
  
  console.log(`Daily message count for user ${userId}: ${newCount}/${effectiveLimit}`);
  
  return {
    canSend: true,
    currentCount: newCount
  };
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, message, cookies,recipients, campaignId } = req.body;
        //const recipients = [{id:'1393223661851607042'},{id:'1393223661851607042'},{id:'1393223661851607042'},{id:'1393223661851607042'}]//['1393223661851607042',"1151640228349612032"];
        //console.log("recipientIds",recipients);
        if (action === 'stop') {
            console.log(`Received stop request for campaign ${campaignId}`);
            console.log("Active campaign queues:", Array.from(redis.keys('queue:*')));
            
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();
            
            if (campaignQueue.status !== 'Stopped') {
                await campaignQueue.stop();
                console.log(`Stopped existing queue for campaign ${campaignId}`);
            }

            // Update the message status in database
            try {
                await prisma.message.update({
                    where: { id: campaignId },
                    data: { status: 'Stopped' }
                });
            } catch (error) {
                console.error('Failed to update message status:', error);
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Campaign stopped',
                campaignId 
            });
        }
        if (action === 'pause') {
            console.log(`Received pause request for campaign ${campaignId}`);
            
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();
            
            await campaignQueue.pause();
            
            // Update the message status in database
            try {
                await prisma.message.update({
                    where: { id: campaignId },
                    data: { status: 'Paused' }
                });
            } catch (error) {
                console.error('Failed to update message status:', error);
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Campaign paused',
                campaignId 
            });
        }
        if (action === 'resume') {
            console.log(`Received resume request for campaign ${campaignId}`);
            
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();
            console.log("campaignQueue.status",campaignQueue.status);
            if (campaignQueue.status === 'Paused') {
                await campaignQueue.resume();
                console.log(`Resumed paused queue for campaign ${campaignId}`);
            }

            // Update the message status in database
            try {
                await prisma.message.update({
                    where: { id: campaignId },
                    data: { status: 'In Progress' }
                });
            } catch (error) {
                console.error('Failed to update message status:', error);
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Campaign resumed',
                campaignId 
            });
        }
        let updatedCookies = [];
        if(cookies){
        for(let cookie of cookies){
            if(cookie.name=="ct0"||cookie.name=="auth_token"){
                updatedCookies.push(cookie);
            }
        }
        }
        //console.log('updatedCookies',updatedCookies);
        
        if (action === 'start') {
            const { userId } = req.body; // Get the user ID from the request
            console.log('req.body',req.body);
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'userId is required'
                });
            }
            
            console.log("Starting campaign with userId:", userId);
            
            // Create or get existing campaign queue
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();

            // Add recipients to queue and start processing
            await campaignQueue.addRecipients(recipients, message, updatedCookies, userId);
            console.log("Active campaign queues in start action:", Array.from(redis.keys('queue:*')));
            campaignQueue.process().catch(console.error);

            return res.status(200).json({ 
                success: true, 
                message: 'Campaign started',
                queueLength: campaignQueue.queue.length,
                totalRecipients: recipients.length
            });
        }

        // Add a testing action to reset rate limits
        if (action === 'reset_rate_limit' && process.env.NODE_ENV === 'development') {
            const { userId } = req.body;
            if (userId) {
                const today = new Date().toISOString().split('T')[0];
                const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
                await redis.del(dailyLimitKey);
                return res.status(200).json({ 
                    success: true, 
                    message: 'Rate limit reset for testing'
                });
            }
        }
    } else if (req.method === 'GET') {
        const { campaignId, userId } = req.query;
        const campaignQueue = new CampaignQueue(campaignId);
        await campaignQueue.loadFromRedis();
        
        // If userId is provided and campaign exists, update queue items
        if (userId && campaignQueue.queue.length > 0) {
            await campaignQueue.updateQueueWithUserId(userId);
        }
        
        // Check if the campaign is rate limited and potentially resumable
        if (campaignQueue.status === 'Rate Limited') {
            // Get the userId from the first item in the queue
            const userId = campaignQueue.queue.length > 0 ? campaignQueue.queue[0].userId : null;
            
            if (userId) {
                const today = new Date().toISOString().split('T')[0];
                const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
                
                // Check if we're in a new day by checking if the daily counter exists or is reset
                const dailyUsage = await redis.get(dailyLimitKey);
                console.log(`Checking rate limit for auto-resume: key=${dailyLimitKey}, value=${dailyUsage}`);
                
                // If the key doesn't exist or the value is below the limit, we can resume
                if (!dailyUsage || parseInt(dailyUsage) < DAILY_MESSAGE_LIMIT) {
                    console.log(`Auto-resuming rate-limited campaign ${campaignId} - limit reset detected`);
                    campaignQueue.status = 'Running';
                    await campaignQueue.saveToRedis();
                    
                    // Update database status
                    try {
                        await prisma.message.update({
                            where: { id: campaignId },
                            data: { status: 'In Progress' }
                        });
                    } catch (error) {
                        console.error('Failed to update message status:', error);
                    }
                    
                    // Start processing again
                    setTimeout(() => {
                        campaignQueue.process().catch(console.error);
                    }, 100);
                }
            }
        }
        
        res.json({
            isActive: campaignQueue.status !== 'Stopped',
            remainingTasks: campaignQueue.queue.length,
            processedCount: campaignQueue.processedRecipients.size,
            status: campaignQueue.status === 'Running' ? 'processing' : 'waiting'
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

