const Queue = require('bull');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');
const express = require('express');
const app = express();

const prisma = new PrismaClient();
const MAX_CONCURRENT_CAMPAIGNS = parseInt(process.env.MAX_CONCURRENT_CAMPAIGNS) || 10;
const MESSAGES_PER_CAMPAIGN = parseInt(process.env.MESSAGES_PER_CAMPAIGN) || 400;
const MAX_RETRIES = 2;

// Create separate queues for each campaign
const campaignQueues = new Map();

// Initialize queues for each campaign
async function initializeCampaignQueues() {
  const campaigns = await prisma.message.findMany({
    where: { status: 'In Progress' }
  });
  
  for (const campaign of campaigns) {
    const queue = new Queue(`campaign-${campaign.id}`, process.env.UPSTASH_REDIS_URL);
    campaignQueues.set(campaign.id, queue);
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
      const state = campaignState ? JSON.parse(campaignState) : { status: 'Ready' };

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
    const state = campaignState ? JSON.parse(campaignState) : {};
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
    const state = campaignState ? JSON.parse(campaignState) : {};
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
    const state = campaignState ? JSON.parse(campaignState) : {};
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

// Process jobs with campaign-specific concurrency
for (const [campaignId, queue] of campaignQueues) {
  queue.process(1, async (job) => {
    const { recipientId, message, cookies, userId } = job.data;
    
    try {
      // Check campaign status
      const campaignState = await redis.get(`queue:${campaignId}`);
      const state = campaignState ? JSON.parse(campaignState) : {};
      
      if (state.status !== 'Running') {
        throw new Error(`Campaign is ${state.status}`);
      }

      // Check daily limit before processing
      const today = new Date().toISOString().split('T')[0];
      const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
      const currentCount = await redis.get(dailyLimitKey);
      const parsedCount = currentCount ? parseInt(currentCount) : 0;
      
      // Get user's plan type and calculate limit
      const userCredits = await prisma.userCredits.findUnique({
        where: { userId }
      });
      
      const userLimit = getUserDailyMessageLimit(userCredits);
      const effectiveLimit = getEnvironmentAdjustedLimit(userLimit);
      
      if (parsedCount >= effectiveLimit) {
        // Update campaign status to Rate Limited
        state.status = 'Rate Limited';
        await redis.set(`queue:${campaignId}`, JSON.stringify(state));
        throw new Error('Daily limit reached');
      }
      
      // Send the message
      const success = await sendDM(recipientId, message, cookies);
      
      if (success) {
        // Increment daily count
        await redis.incr(dailyLimitKey);
        
        // Update message status in database
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

        // Update processed recipients in Redis
        if (!state.processedRecipients) {
          state.processedRecipients = [];
        }
        state.processedRecipients.push(recipientId);
        await redis.set(`queue:${campaignId}`, JSON.stringify(state));
      }
      
      return { success };
    } catch (error) {
      console.error('Job failed:', error);
      throw error;
    }
  });

  // Handle failed jobs with retry logic
  queue.on('failed', async (job, error) => {
    console.error(`Job ${job.id} failed in campaign ${campaignId}:`, error);
    
    // Get campaign state
    const campaignState = await redis.get(`queue:${campaignId}`);
    const state = campaignState ? JSON.parse(campaignState) : {};
    
    // Handle retries
    if (!state.totalAttempts) {
      state.totalAttempts = 0;
    }
    state.totalAttempts++;
    
    if (state.totalAttempts >= MAX_RETRIES) {
      // Max retries reached, mark as failed
      state.totalAttempts = 0;
      await redis.set(`queue:${campaignId}`, JSON.stringify(state));
    } else {
      // Retry the job
      await job.retry();
    }
  });
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initializeCampaignQueues();
  console.log(`Worker service running on port ${PORT}`);
  console.log(`Configured for ${MAX_CONCURRENT_CAMPAIGNS} concurrent campaigns`);
  console.log(`Target: ${MESSAGES_PER_CAMPAIGN} messages per campaign`);
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function sendDM(recipientId, message, cookies) {
  let browser = null;
  let page = null;
  
  try {
    // Launch browser with memory optimization arguments
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
    
    // Set minimal cookies
    const essentialCookies = cookies.filter(c => 
      ['auth_token', 'ct0'].includes(c.name)
    );
    await page.setCookie(...essentialCookies);
    
    // Navigate to DM page
    await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Wait for composer and send message
    await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
      timeout: 60000,
      visible: true
    });
    
    await page.type('[data-testid="dmComposerTextInput"]', message);
    await page.click('[data-testid="dmComposerSendButton"]');
    await page.waitForTimeout(1000);
    
    return true;
  } catch (error) {
    console.error(`Error sending DM to ${recipientId}:`, error);
    return false;
  } finally {
    // Clean up resources
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

console.log('Message worker started'); 