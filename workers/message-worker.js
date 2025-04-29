const { Queue, Worker } = require('bullmq');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const express = require('express');
const app = express();
const path = require('path');
//  import path is problematic with the Render configuration
function getUserDailyMessageLimit(userCredits, defaultLimit = 50) {
  if (!userCredits) {
    return defaultLimit;
  }
  
  const { planType } = userCredits;
  
  // Use plan-based limits
  switch(planType) {
    case 'Starter': return 450;
    case 'Growth': return 1250;
    case 'Elite': return 450;
    case 'free': return 50;
    default: return defaultLimit;
  }
}

function getEnvironmentAdjustedLimit(limit) {
  if (process.env.NODE_ENV === 'development') {
    return 25; // Lower limit for development
  }
  return limit;
}

const prisma = new PrismaClient();
const MAX_CONCURRENT_CAMPAIGNS = parseInt(process.env.MAX_CONCURRENT_CAMPAIGNS) || 10;
const MESSAGES_PER_CAMPAIGN = parseInt(process.env.MESSAGES_PER_CAMPAIGN) || 400;
const MAX_RETRIES = 2;

// Initialize Redis client early
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create separate queues for each campaign
const campaignQueues = new Map();
// Store browser instances for each campaign
const campaignBrowsers = new Map();

const upstashConnection = {
  host: 'settling-mackerel-23947.upstash.io',
  port: 6379,
  password: 'AV2LAAIjcDE1NzQyOTg4MzRmN2M0YzBkYTgxMWZiNjBlNWZkODI2Y3AxMA',
  tls: {}
};

// Function to launch a browser for a campaign
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
    protocolTimeout: 180000, // Increase timeout to 3 minutes
    timeout: 180000 // Increase timeout to 3 minutes
  });
  
  // Store the browser instance
  campaignBrowsers.set(campaignId, browser);
  console.log(`[BROWSER] Campaign ${campaignId}: Browser launched successfully`);
  return browser;
}

// Function to get or create a browser for a campaign
async function getOrCreateBrowser(campaignId) {
  // Check if we have an existing browser
  let browser = campaignBrowsers.get(campaignId);
  
  // If browser exists, check if it's still usable
  if (browser) {
    try {
      // Test if the browser is still responsive
      await browser.version();
      console.log(`[BROWSER] Campaign ${campaignId}: Using existing browser instance`);
      return browser;
    } catch (error) {
      console.log(`[BROWSER] Campaign ${campaignId}: Existing browser not usable, creating new one`);
      // If there was an error, the browser might be dead, so we'll create a new one
      try {
        await browser.close();
      } catch (closeError) {
        // Ignore errors when closing an already dead browser
      }
    }
  }
  
  // Create a new browser
  return await launchBrowser(campaignId);
}

// Function to close a campaign's browser
async function closeBrowser(campaignId) {
  const browser = campaignBrowsers.get(campaignId);
  if (browser) {
    console.log(`[BROWSER] Campaign ${campaignId}: Closing browser instance`);
    try {
      await browser.close();
    } catch (error) {
      console.error(`[BROWSER] Campaign ${campaignId}: Error closing browser:`, error);
    }
    campaignBrowsers.delete(campaignId);
  }
}

// Add BullMQ Worker for each campaign queue
function setupBullMQWorker(campaignId) {
  // Track error counts and retries
  let consecutiveMemoryErrors = 0;
  let browserRestartCount = 0;
  let recipientsToRetry = [];
  let cooldownActive = false;

  const worker = new Worker(
    `campaign-${campaignId}`,
    async (job) => {
      const { recipientId, message, cookies, userId, recipient } = job.data;
      console.log(`[PROCESS] Campaign ${campaignId}: Processing job for recipient ${recipientId}`);
      try {
        // Skip if we're currently in cooldown
        if (cooldownActive) {
          console.log(`[COOLDOWN] Campaign ${campaignId}: In cooldown period, delaying job for recipient ${recipientId}`);
          throw new Error('Campaign is in cooldown period');
        }

        const campaignState = await redis.get(`queue:${campaignId}`);
        const state = campaignState ? 
          (typeof campaignState === 'object' ? campaignState : JSON.parse(campaignState)) : {};
        if (state.status === 'Paused' || state.status === 'Stopped' || state.status === 'Rate Limited') {
          console.log(`[SKIP] Campaign ${campaignId}: Status is ${state.status}, skipping job for recipient ${recipientId}`);
          throw new Error(`Campaign is ${state.status}`);
        }
        const today = new Date().toISOString().split('T')[0];
        const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
        const currentCount = await redis.get(dailyLimitKey);
        const parsedCount = currentCount ? parseInt(currentCount) : 0;
        const userCredits = await prisma.userCredits.findUnique({ where: { userId } });
        const userLimit = getUserDailyMessageLimit(userCredits);
        const effectiveLimit = getEnvironmentAdjustedLimit(userLimit);
        if (parsedCount >= effectiveLimit) {
          console.log(`[LIMIT] Campaign ${campaignId}: Daily limit reached for user ${userId}`);
          state.status = 'Rate Limited';
          await redis.set(`queue:${campaignId}`, JSON.stringify(state));
          throw new Error('Daily limit reached');
        }
        console.log(`[SEND] Campaign ${campaignId}: Sending DM to recipient ${recipientId}`);
        
        // Use random delay between 2-4 minutes to avoid rate limiting
        const randomDelay = Math.floor(Math.random() * (4 - 2 + 1) + 2) * 60000; 
        console.log(`[DELAY] Campaign ${campaignId}: Waiting ${randomDelay/60000} minutes before sending to ${recipientId}`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        // Get or create a browser for this campaign
        const browser = await getOrCreateBrowser(campaignId);
        
        // Transform the message
        const personalizedMessage = recipient ? messageTransformFunction(message, recipient) : message;
        
        // Send the DM using the campaign browser
        const success = await sendDM(recipientId, personalizedMessage, cookies, browser, campaignId);
        
        if (success) {
          // Reset consecutive errors on success
          consecutiveMemoryErrors = 0;
          
          await redis.incr(dailyLimitKey);
          await prisma.message.update({
            where: { id: campaignId },
            data: {
              messages: {
                updateMany: {
                  where: { recipientId },
                  data: { status: true }
                }
              }
            }
          });
          if (!state.processedRecipients) {
            state.processedRecipients = [];
          }
          state.processedRecipients.push(recipientId);
          await redis.set(`queue:${campaignId}`, JSON.stringify(state));
          console.log(`[SUCCESS] Campaign ${campaignId}: DM sent to recipient ${recipientId}`);
        } else {
          console.log(`[FAIL] Campaign ${campaignId}: Failed to send DM to recipient ${recipientId}`);
        }
        return { success };
      } catch (error) {
        console.error(`[ERROR] Campaign ${campaignId}: Job failed for recipient ${recipientId}:`, error);
        
        // Check for memory-related or rate-limit errors
        if (error.message.includes('Target.createTarget timed out') || 
            error.message.includes('out of memory') || 
            error.message.includes('TimeoutError') ||
            error.message.includes('Browser closed') ||
            error.message.includes('Protocol error') || 
            error.message.includes('Increase the \'protocolTimeout\'') ||
            error.message.includes('Waiting for selector') ||
            error.message.includes('Waiting failed:')) {
          
          // Implement cooldown logic
          consecutiveMemoryErrors++;
          console.log(`[COOLDOWN] Campaign ${campaignId}: Browser issue detected, consecutive errors: ${consecutiveMemoryErrors}`);
          
          // Close the problematic browser
          await closeBrowser(campaignId);
          
          // Start cooldown if we're hitting repeated errors
          if (consecutiveMemoryErrors >= 2) {
            // Save the recipient to retry later
            recipientsToRetry.push({
              recipientId,
              message,
              cookies,
              userId
            });
            
            // Progressive cooldown period - increases with consecutive errors
            const cooldownMinutes = Math.min(3 + (consecutiveMemoryErrors), 10);
            console.log(`[COOLDOWN] Campaign ${campaignId}: Starting cooldown of ${cooldownMinutes} minutes`);
            
            // Set cooldown flag and schedule reset
            cooldownActive = true;
            
            // Log cooldown times
            const resumeTime = new Date(Date.now() + cooldownMinutes * 60000);
            console.log(`[COOLDOWN] Campaign ${campaignId}: Started at ${new Date().toISOString()}, will resume at ${resumeTime.toISOString()}`);
            
            // Schedule end of cooldown
            setTimeout(() => {
              cooldownActive = false;
              console.log(`[COOLDOWN] Campaign ${campaignId}: Cooldown completed at ${new Date().toISOString()}`);
              
              // Re-add the jobs that failed during cooldown
              const reAddJobs = async () => {
                try {
                  console.log(`[RETRY] Campaign ${campaignId}: Re-adding ${recipientsToRetry.length} failed jobs`);
                  
                  // Get the queue
                  const queue = campaignQueues.get(campaignId);
                  if (!queue) return;
                  
                  // Create a fresh browser for the campaign after cooldown
                  await launchBrowser(campaignId);
                  
                  // Add the jobs back to the queue
                  for (const jobData of recipientsToRetry) {
                    await queue.add('sendDM', jobData, {
                      attempts: 2,
                      backoff: {
                        type: 'exponential',
                        delay: 60000 // 1 minute
                      }
                    });
                  }
                  
                  // Clear retry list
                  recipientsToRetry = [];
                  
                  console.log(`[RETRY] Campaign ${campaignId}: Re-added failed jobs to queue`);
                } catch (error) {
                  console.error(`[RETRY] Campaign ${campaignId}: Error re-adding jobs:`, error);
                }
              };
              
              // Schedule job re-addition after cooldown
              reAddJobs();
            }, cooldownMinutes * 60000);
          }
        }
        
        throw error;
      }
    },
    { 
      connection: upstashConnection,
      concurrency: 1 // Process one message at a time to avoid rate limits
    }
  );
  
  worker.on('failed', async (job, error) => {
    console.error(`[FAILED] Campaign ${campaignId}: Job ${job.id} failed for recipient ${job.data.recipientId}:`, error);
    const campaignState = await redis.get(`queue:${campaignId}`);
    const state = campaignState ? 
      (typeof campaignState === 'object' ? campaignState : JSON.parse(campaignState)) : {};
    if (!state.totalAttempts) {
      state.totalAttempts = 0;
    }
    state.totalAttempts++;
    if (state.totalAttempts >= MAX_RETRIES) {
      state.totalAttempts = 0;
      await redis.set(`queue:${campaignId}`, JSON.stringify(state));
      console.log(`[FAILED] Campaign ${campaignId}: Max retries reached for job ${job.id}`);
    } else {
      // BullMQ automatically handles retries if configured in job options
      console.log(`[RETRY] Campaign ${campaignId}: Retrying job ${job.id}`);
    }
  });
  
  // Clean up browser when worker is closed
  worker.on('closed', async () => {
    console.log(`[WORKER] Campaign ${campaignId}: Worker closed, cleaning up browser`);
    await closeBrowser(campaignId);
  });
  
  return worker;
}

// Initialize queues for each campaign
async function initializeCampaignQueues() {
  const campaigns = await prisma.message.findMany({
    where: { status: 'In Progress' }
  });
  // Each campaign gets its own dedicated queue named campaign-{campaignId}
  // This ensures that each campaign is processed independently and avoids conflicts
  for (const campaign of campaigns) {
    const queue = new Queue(`campaign-${campaign.id}`, { connection: upstashConnection });
    campaignQueues.set(campaign.id, queue);
    setupBullMQWorker(campaign.id);
    await redis.set(`queue:${campaign.id}`, JSON.stringify({ status: 'Running' }));
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Queue status endpoint
app.get('/queue-status', async (req, res) => {
  try {
    const campaignStatuses = [];
    let totalWaiting = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const [campaignId, queue] of campaignQueues) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);

      totalWaiting += waiting;
      totalActive += active;
      totalCompleted += completed;
      totalFailed += failed;

      // Get campaign status from Redis
      const campaignState = await redis.get(`queue:${campaignId}`);
      const state = campaignState ? 
        (typeof campaignState === 'object' ? campaignState : JSON.parse(campaignState)) : { status: 'Ready' };

      campaignStatuses.push({
        campaignId,
        status: state.status,
        waiting,
        active,
        completed,
        failed,
        processingRate: completed / (process.uptime() / 60)
      });
    }

    res.json({
      total: {
        waiting: totalWaiting,
        active: totalActive,
        completed: totalCompleted,
        failed: totalFailed
      },
      campaigns: campaignStatuses,
      metrics: {
        totalJobs: totalWaiting + totalActive,
        processingRate: totalCompleted / (process.uptime() / 60),
        errorRate: totalFailed / (totalCompleted + totalFailed) * 100,
        shouldScale: totalWaiting > 50 && (totalCompleted / (process.uptime() / 60)) < 20
      }
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Campaign control endpoints
app.post('/campaign/:campaignId/pause', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const queue = campaignQueues.get(campaignId);
    
    if (!queue) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Update campaign state in Redis
    const campaignState = await redis.get(`queue:${campaignId}`);
    const state = campaignState ? 
      (typeof campaignState === 'object' ? campaignState : JSON.parse(campaignState)) : {};
    state.status = 'Paused';
    await redis.set(`queue:${campaignId}`, JSON.stringify(state));

    // Update database
    await prisma.message.update({
      where: { id: campaignId },
      data: { status: 'Paused' }
    });

    res.json({ success: true, status: 'Paused' });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

app.post('/campaign/:campaignId/resume', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const queue = campaignQueues.get(campaignId);
    
    if (!queue) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Update campaign state in Redis
    const campaignState = await redis.get(`queue:${campaignId}`);
    const state = campaignState ? 
      (typeof campaignState === 'object' ? campaignState : JSON.parse(campaignState)) : {};
    state.status = 'Running';
    await redis.set(`queue:${campaignId}`, JSON.stringify(state));

    // Update database
    await prisma.message.update({
      where: { id: campaignId },
      data: { status: 'In Progress' }
    });

    res.json({ success: true, status: 'Running' });
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

app.post('/campaign/:campaignId/stop', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const queue = campaignQueues.get(campaignId);
    
    if (!queue) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Remove all jobs from queue
    await queue.clean(0, 'waiting');
    await queue.clean(0, 'active');
    await queue.clean(0, 'delayed');

    // Close browser for this campaign
    await closeBrowser(campaignId);

    // Update campaign state in Redis
    const campaignState = await redis.get(`queue:${campaignId}`);
    const state = campaignState ? 
      (typeof campaignState === 'object' ? campaignState : JSON.parse(campaignState)) : {};
    state.status = 'Stopped';
    state.queue = [];
    state.processedRecipients = [];
    await redis.set(`queue:${campaignId}`, JSON.stringify(state));

    // Update database
    await prisma.message.update({
      where: { id: campaignId },
      data: { status: 'Stopped' }
    });

    res.json({ success: true, status: 'Stopped' });
  } catch (error) {
    console.error('Error stopping campaign:', error);
    res.status(500).json({ error: 'Failed to stop campaign' });
  }
});

// Polling function to check for new campaigns
async function pollForNewCampaigns() {
  try {
    const campaigns = await prisma.message.findMany({
      where: {
        status: 'In Progress',
        id: { notIn: Array.from(campaignQueues.keys()) }
      }
    });
    for (const campaign of campaigns) {
      const queue = new Queue(`campaign-${campaign.id}`, { connection: upstashConnection });
      campaignQueues.set(campaign.id, queue);
      setupBullMQWorker(campaign.id);
      console.log(`Created queue for new campaign: ${campaign.id}`);
    }
  } catch (err) {
    console.error('Error polling for new campaigns:', err);
  }
}

// Start polling every 30 seconds
setInterval(pollForNewCampaigns, 30000);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initializeCampaignQueues();
  console.log(`Worker service running on port ${PORT}`);
  console.log(`Configured for ${MAX_CONCURRENT_CAMPAIGNS} concurrent campaigns`);
  console.log(`Target: ${MESSAGES_PER_CAMPAIGN} messages per campaign`);
});

// Modified sendDM to accept a browser instance
async function sendDM(recipientId, message, cookies, browser, campaignId) {
  let page = null;
  
  try {
    console.log(`[sendDM] Using campaign browser for recipient ${recipientId}`);
    
    // Create a new page in the existing browser
    page = await browser.newPage();
    console.log(`[sendDM] New page created for recipient ${recipientId}`);
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    console.log(`[sendDM] Set request interception for recipient ${recipientId}`);
    
    const essentialCookies = cookies.filter(c => ['auth_token', 'ct0'].includes(c.name));
    await page.setCookie(...essentialCookies);
    console.log(`[sendDM] Set cookies for recipient ${recipientId}`);
    
    const dmUrl = `https://twitter.com/messages/compose?recipient_id=${recipientId}`;
    console.log(`[sendDM] Navigating to ${dmUrl}`);
    
    await page.goto(dmUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log(`[sendDM] Page loaded for recipient ${recipientId}`);
    
    try {
      await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
        timeout: 60000,
        visible: true
      });
      console.log(`[sendDM] DM composer input found for recipient ${recipientId}`);
    } catch (waitError) {
      console.error(`[sendDM] Timeout waiting for DM composer input for recipient ${recipientId}`);
      const content = await page.content();
      console.error(`[sendDM] Page content for recipient ${recipientId}:\n${content.substring(0, 1000)}...`);
      try {
        await page.screenshot({ path: `senddm_error_${recipientId}.png` });
        console.log(`[sendDM] Screenshot saved for recipient ${recipientId}`);
      } catch (screenshotError) {
        console.error(`[sendDM] Failed to save screenshot for recipient ${recipientId}:`, screenshotError);
      }
      throw waitError;
    }
    
    // Use a more reliable typing method
    try {
      // Try direct typing first (most reliable)
      await page.type('[data-testid="dmComposerTextInput"]', message);
      console.log(`[sendDM] Typed message for recipient ${recipientId}`);
    } catch (typeError) {
      console.log(`[sendDM] Direct typing failed, trying evaluate method for ${recipientId}`);
      // Fallback method using evaluate with better error checking
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
      }, message);
    }
    
    await page.click('[data-testid="dmComposerSendButton"]');
    console.log(`[sendDM] Clicked send button for recipient ${recipientId}`);
    await page.waitForTimeout(1000);
    console.log(`[sendDM] DM sent for recipient ${recipientId}`);
    return true;
  } catch (error) {
    console.error(`[sendDM] Error sending DM to ${recipientId}:`, error);
    if (page) {
      try {
        const content = await page.content();
        console.error(`[sendDM] Error page content for recipient ${recipientId}:\n${content.substring(0, 1000)}...`);
        await page.screenshot({ path: `senddm_error_final_${recipientId}.png` });
        console.log(`[sendDM] Final error screenshot saved for recipient ${recipientId}`);
      } catch (err) {
        console.error(`[sendDM] Failed to log error page content or screenshot for recipient ${recipientId}:`, err);
      }
    }
    
    // If we get a serious browser error, we should signal the campaign to restart the browser
    if (error.message.includes('Target.createTarget timed out') || 
        error.message.includes('out of memory') || 
        error.message.includes('Browser closed') ||
        error.message.includes('Protocol error')) {
      throw error; // Rethrow these specific errors for campaign-level handling
    }
    
    return false;
  } finally {
    if (page) {
      await page.close();
      console.log(`[sendDM] Page closed for recipient ${recipientId}`);
    }
    // We don't close the browser here anymore, it's managed at the campaign level
  }
}

console.log('Message worker started');

// Add this function near the top of the file
function messageTransformFunction(message, recipient) {
  let transformedMessage = message.replace("{name}", recipient.name ? recipient.name.split(" ")[0] : "");
  transformedMessage = transformedMessage.replace("{username}", recipient.username ? recipient.username : "");
  transformedMessage = transformedMessage.replace("{url}", recipient.url ? recipient.url : "");
  transformedMessage = transformedMessage.replace("{bio}", recipient.bio ? recipient.bio : "");
  transformedMessage = transformedMessage.replace("{followers}", recipient.followers ? recipient.followers : "");
  transformedMessage = transformedMessage.replace("{following}", recipient.following ? recipient.following : "");
  return transformedMessage;
}

console.log('Message worker started'); 