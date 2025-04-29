const { Queue, Worker } = require('bullmq');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const express = require('express');
const app = express();
const path = require('path');

// Define utility functions directly since the import path is problematic with the Render configuration
function getUserDailyMessageLimit(userCredits, defaultLimit = 50) {
  if (!userCredits) {
    return defaultLimit;
  }
  
  const { planType } = userCredits;
  
  // Use plan-based limits
  switch(planType) {
    case 'Starter': return 100;
    case 'Growth': return 150;
    case 'Elite': 
    case 'ENTERPRISE': return 450;
    case 'free': 
    case 'FREE': return 50;
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

const upstashConnection = {
  host: 'settling-mackerel-23947.upstash.io',
  port: 6379,
  password: 'AV2LAAIjcDE1NzQyOTg4MzRmN2M0YzBkYTgxMWZiNjBlNWZkODI2Y3AxMA',
  tls: {}
};

// Add BullMQ Worker for each campaign queue
function setupBullMQWorker(campaignId) {
  const worker = new Worker(
    `campaign-${campaignId}`,
    async (job) => {
      const { recipientId, message, cookies, userId } = job.data;
      console.log(`[PROCESS] Campaign ${campaignId}: Processing job for recipient ${recipientId}`);
      try {
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
        const success = await sendDM(recipientId, message, cookies);
        if (success) {
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
        throw error;
      }
    },
    { connection: upstashConnection }
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
  return worker;
}

// Initialize queues for each campaign
async function initializeCampaignQueues() {
  const campaigns = await prisma.message.findMany({
    where: { status: 'In Progress' }
  });
  
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

async function sendDM(recipientId, message, cookies) {
  let browser = null;
  let page = null;
  try {
    console.log(`[sendDM] Launching browser for recipient ${recipientId}`);
    const isLocal = process.env.NEXT_PUBLIC_APP_ENV === 'local';
    const isWindows = process.platform === 'win32';
    const executablePath = isLocal && isWindows ? 
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 
      await chromium.executablePath();

    browser = await puppeteer.launch({
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
      defaultViewport: { width: 800, height: 600 }
    });

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
    await page.type('[data-testid="dmComposerTextInput"]', message);
    console.log(`[sendDM] Typed message for recipient ${recipientId}`);
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
    return false;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

console.log('Message worker started'); 