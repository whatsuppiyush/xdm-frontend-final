// pages/api/scheduler.js

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import redis from '../../lib/redis';
import { getUserDailyMessageLimit, getEnvironmentAdjustedLimit } from '../../lib/planLimits';
import { createServer } from 'http';
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
    // --- The following block should only run in the background worker, not in the API route ---
    /*
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;
    let limitCheckCounter = 0;
    let recipientsToRetry = [];
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
      console.log(`Browser launched for campaign ${this.campaignId}`);
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
        console.log("userId and recipientId", userId, recipientId);
        if (this.processedRecipients.has(recipientId)) {
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }
        // ... (rest of DM sending and browser logic)
      }
    } catch (error) {
      // ... error handling
    }
    */
    // --- End block ---
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
    console.log(`Campaign ${this.campaignId} resumed and items in queue`,this.queue.length);
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

// --- The following function should only run in the background worker, not in the API route ---
/*
const sendDM = async (recipientId, message, cookies, browser) => {
  // ... browser and DM sending logic ...
};
*/
// --- End block ---

const messageTransformFunction = (message,recipient) => {
    let transformedMessage = message.replace("{name}",recipient.name?recipient.name.split(" ")[0]:"");
    transformedMessage = transformedMessage.replace("{username}",recipient.username?recipient.username:"");
    transformedMessage = transformedMessage.replace("{url}",recipient.url?recipient.url:"");
    transformedMessage = transformedMessage.replace("{bio}",recipient.bio?recipient.bio:"");
    transformedMessage = transformedMessage.replace("{followers}",recipient.followers?recipient.followers:"");
    transformedMessage = transformedMessage.replace("{following}",recipient.following?recipient.following:"");
    return transformedMessage;
}

// Split the function into check and increment
async function checkDailyLimit(userId) {
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

// New function to increment the counter only after successful send
async function incrementDailyLimit(userId) {
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

// Update the existing function to use the new split functions
async function checkAndIncrementDailyLimit(userId) {
  const checkResult = await checkDailyLimit(userId);
  
  if (!checkResult.canSend) {
    return {
      canSend: false,
      currentCount: checkResult.currentCount
    };
  }
  
  // Only increment if we're going to send
  const incrementResult = await incrementDailyLimit(userId);
  
  return {
    canSend: true,
    currentCount: incrementResult.currentCount
  };
}

// Update the recoverActiveCampaigns function to also process queues with "Running" status
async function recoverActiveCampaigns() {
  try {
    // Use queue:* pattern to find all campaign queues
    console.log("Recovering active campaigns");
    const queueKeys = await redis.keys('queue:*');
    console.log(`Found ${queueKeys.length} campaign queues in Redis`);
    
    if (queueKeys.length === 0) {
      return { recovered: 0 };
    }
    
    let recoveredCount = 0;
    
    // Process each queue found in Redis
    for (const queueKey of queueKeys) {
      // Extract campaign ID from the key (queue:campaignId)
      const campaignId = queueKey.split(':')[1];
      
      if (!campaignId) continue;
      
      // Get campaign data from database
      const campaign = await prisma.message.findUnique({
        where: { id: campaignId }
      });
      
      // Skip if campaign doesn't exist in database
      if (!campaign) continue;
      
      // Load queue state from Redis
      const campaignQueue = new CampaignQueue(campaignId);
      await campaignQueue.loadFromRedis();
      
      // Only process if queue has messages
      if (campaignQueue.queue.length > 0 && campaignQueue.status !== 'Stopped') {
        console.log(`Checking campaign ${campaignId} with status ${campaign.status}, queue status: ${campaignQueue.status}`);
        
        // For rate limited campaigns, check if limit has reset
        if (campaign.status === 'Rate Limited') {
          const userId = campaign.userId;
          const today = new Date().toISOString().split('T')[0];
          const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
          const dailyUsage = await redis.get(dailyLimitKey);
          const dailyUsageStr = typeof dailyUsage === 'string' ? dailyUsage : JSON.stringify(dailyUsage);
          console.log('Rate Limited campaign',recoveredCount);
          // Get user's plan type and calculate their limit
          const userCredits = await prisma.userCredits.findUnique({
            where: { userId }
          });
          
          // Use utility function to get user's daily message limit
          const userLimit = getUserDailyMessageLimit(userCredits);
          const adjustedLimit = getEnvironmentAdjustedLimit(userLimit);
          
          if (!dailyUsageStr || parseInt(dailyUsageStr) < adjustedLimit) {
            // Resume campaign
            campaignQueue.status = 'Running';
            await campaignQueue.saveToRedis();
            
            await prisma.message.update({
              where: { id: campaignId },
              data: { status: 'In Progress' }
            });
            
            // Start processing this campaign
            campaignQueue.process().catch(console.error);
            recoveredCount++;
          }
        }
        // For In Progress or Running campaigns, ensure they're actually running
        else if (campaignQueue.status === 'Running') {
          // Always set to Running to ensure it's processed
          campaignQueue.status = 'Running';
          await campaignQueue.saveToRedis();
          
          // Start processing this campaign
          campaignQueue.process().catch(console.error);
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

// Run recovery on server start
if (process.env.NODE_ENV !== 'development') {
  // In production, run immediately
  //recoverActiveCampaigns();
} else {
  // In development, wait a bit for everything to initialize
  console.log("Waiting 5 seconds for development recovery");
  //setTimeout(recoverActiveCampaigns, 5000);
}

// Function to check if there are active workers running
async function checkForActiveWorkers() {
  try {
    const workerHeartbeatKey = 'worker:heartbeat';
    const lastHeartbeat = await redis.get(workerHeartbeatKey);
    
    if (!lastHeartbeat) {
      console.log("No worker heartbeat found, workers may not be running");
      return false;
    }
    
    const heartbeatTime = parseInt(lastHeartbeat);
    const currentTime = Date.now();
    
    // Check if heartbeat is within the last 5 minutes
    if ((currentTime - heartbeatTime) > 5 * 60 * 1000) {
      console.log("Worker heartbeat is stale, workers may not be running");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error checking worker status:", error);
    return false;
  }
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, message, cookies, recipients, campaignId, cron = false } = req.body;
        
        if (action === 'stop') {
            console.log(`Received stop request for campaign ${campaignId}`);
            
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
            console.log("campaignQueue.status and cron", campaignQueue.status, cron);
            
            if (campaignQueue.status === 'Paused' || cron) {
                await campaignQueue.resume();
                console.log(`Resumed paused queue for campaign ${campaignId}`);
                
                // Check if workers are running
                const workersRunning = await checkForActiveWorkers();
                if (!workersRunning) {
                    console.log("Warning: No active workers detected. Messages may not be processed.");
                }
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
        if (cookies) {
            for (let cookie of cookies) {
                if (cookie.name == "ct0" || cookie.name == "auth_token") {
                    updatedCookies.push(cookie);
                }
            }
        }
        
        if (action === 'start') {
            const { userId } = req.body;
            console.log('req.body', req.body);
            
            if (!userId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'userId is required'
                });
            }
            
            // Check if we have workers running before starting
            const workersRunning = await checkForActiveWorkers();
            if (!workersRunning) {
                console.log("Warning: No active workers detected. Starting campaign, but it may not be processed.");
            }
            
            console.log("Starting campaign with userId:", userId);
            
            // Create or get existing campaign queue
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();

            // Add recipients to queue
            await campaignQueue.addRecipients(recipients, message, updatedCookies, userId);
            console.log("Campaign queued with status:", campaignQueue.status);
            
            // Set status to Running in Redis
            campaignQueue.status = 'Running';
            await campaignQueue.saveToRedis();
            
            // Update status in database
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
                message: 'Campaign started',
                queueLength: campaignQueue.queue.length,
                totalRecipients: recipients.length,
                workersActive: workersRunning
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
        
        // Check if we have workers running
        const workersRunning = await checkForActiveWorkers();
        
        // Get campaign details from database
        let campaignDetails = null;
        try {
            campaignDetails = await prisma.message.findUnique({
                where: { id: campaignId }
            });
        } catch (error) {
            console.error('Failed to fetch campaign details:', error);
        }
        
        // Check if the campaign is rate limited and potentially resumable
        if (campaignQueue.status === 'Rate Limited') {
            // Get the userId from the first item in the queue or from the campaign
            let userId = campaignQueue.queue.length > 0 ? campaignQueue.queue[0].userId : null;
            
            if (!userId && campaignDetails) {
                userId = campaignDetails.userId;
            }
            
            if (userId) {
                const today = new Date().toISOString().split('T')[0];
                const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
                
                // Check if we're in a new day by checking if the daily counter exists or is reset
                const dailyUsage = await redis.get(dailyLimitKey);
                console.log(`Checking rate limit for auto-resume: key=${dailyLimitKey}, value=${dailyUsage}`);
                
                // Get user's plan type and calculate their limit
                const userCredits = await prisma.userCredits.findUnique({
                  where: { userId }
                });
                
                // Use utility function to get user's daily message limit
                const userLimit = getUserDailyMessageLimit(userCredits);
                const adjustedLimit = getEnvironmentAdjustedLimit(userLimit);
                
                // If the key doesn't exist or the value is below the limit, we can resume
                if (!dailyUsage || parseInt(dailyUsage) < adjustedLimit) {
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
                }
            }
        }
        
        // Calculate processed count from database if available
        let processedCount = campaignQueue.processedRecipients.size;
        if (campaignDetails && campaignDetails.messages) {
            processedCount = campaignDetails.messages.filter(msg => msg.status).length;
        }
        
        res.json({
            isActive: campaignQueue.status !== 'Stopped',
            remainingTasks: campaignQueue.queue.length,
            processedCount,
            status: campaignQueue.status,
            workersActive: workersRunning
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
