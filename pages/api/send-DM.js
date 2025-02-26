// pages/api/scheduler.js

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import redis from '@/lib/redis';
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
    this.isProcessing = false;
    this.isStopped = false;
    this.browser = null; // Add browser instance tracking
    this.browserWSEndpoint = null; // Add this line
  }

  async saveToRedis() {
    const queueState = {
      campaignId: this.campaignId,
      queue: this.queue,
      processedRecipients: Array.from(this.processedRecipients),
      isProcessing: this.isProcessing,
      isStopped: this.isStopped,
      status: this.isStopped ? 'Stopped' : 'Running'
    };
    await redis.set(`queue:${this.campaignId}`, JSON.stringify(queueState));
  }

  async loadFromRedis() {
    const queueState = await redis.get(`queue:${this.campaignId}`);
    if (queueState) {
      const state = typeof queueState === 'string' ? JSON.parse(queueState) : queueState;
      this.queue = state.queue || [];
      this.processedRecipients = new Set(state.processedRecipients || []);
      this.isProcessing = state.isProcessing || false;
      this.isStopped = state.isStopped || false;
      console.log(`Loaded queue state for ${this.campaignId}:`);
    }
  }

  async addRecipients(recipients, message, cookies) {
    await this.loadFromRedis();
    recipients.forEach(recipient => {
      let transformedMessage = messageTransformFunction(message, recipient);
      this.queue.push({ 
        recipientId: recipient.id, 
        message: transformedMessage, 
        cookies 
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
    if (this.isProcessing || this.isStopped) return;
    
    this.isProcessing = true;
    await this.saveToRedis();
    
    let browserRestartCount = 0;
    let consecutiveMemoryErrors = 0;

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

      while (this.queue.length > 0) {
        await this.loadFromRedis();
        if (this.isStopped) break;

        const { recipientId, message, cookies } = this.queue[0];
        
        if (this.processedRecipients.has(recipientId)) {
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }

        // Apply delay between messages
        const delay = 2 * 60000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await this.loadFromRedis();
        if (this.isStopped) break;

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
    } catch (error) {
      console.error(`Error in campaign ${this.campaignId}:`, error);
    } finally {
      if (this.browser) {
        console.log("Closing browser");
        await this.browser.close().catch(console.error);
        this.browser = null;
      }
      this.isProcessing = false;
      await this.saveToRedis();
    }
  }

  handleFailedAttempt(recipientId) {
    this.totalAttempts++;
    if (this.totalAttempts >= MAX_RETRIES) {
    console.log("processedRecipients",this.totalAttempts,recipientId);
      this.processedRecipients.add(recipientId);
      this.queue.shift();
      this.totalAttempts = 0;
    }
  }

  async stop() {
    try {
      // Force update Redis state
      await redis.set(`queue:${this.campaignId}`, JSON.stringify({
        campaignId: this.campaignId,
        queue: [],
        processedRecipients: Array.from(this.processedRecipients),
        isProcessing: false,
        isStopped: true,
        status: 'Stopped'
      }));
      
      this.isStopped = true;
      this.isProcessing = false;
      this.queue = [];
      
      console.log(`Campaign ${this.campaignId} stopped and Redis state updated`);
    } catch (error) {
      console.error('Error stopping campaign:', error);
    }
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

// Add these helper functions at the top level
function getMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  console.log("memoryUsage", memoryUsage);
  return {
    percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)
  };
}

async function performMemoryCleanup() {
  // Remove global.gc() call as it won't work on Render
  
  // Run some lightweight operations to encourage GC
  const temp = [];
  for (let i = 0; i < 1000; i++) {
    temp.push({});
    if (i % 100 === 0) temp.length = 0;
  }
  
  console.log("Performing memory cleanup and waiting for 3 minutes");
  // The 5-minute cooldown is good for a 2GB/1CPU machine
  return new Promise(resolve => setTimeout(resolve, 180000));
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
            
            if (!campaignQueue.isStopped) {
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
            // Create or get existing campaign queue
            const campaignQueue = new CampaignQueue(campaignId);
            await campaignQueue.loadFromRedis();

            // Add recipients to queue and start processing
            await campaignQueue.addRecipients(recipients, message, updatedCookies);
            console.log("Active campaign queues in start action:", Array.from(redis.keys('queue:*')));
            campaignQueue.process().catch(console.error);

            return res.status(200).json({ 
                success: true, 
                message: 'Campaign started',
                queueLength: campaignQueue.queue.length,
                totalRecipients: recipients.length
            });
        }
    } else if (req.method === 'GET') {
        const { campaignId } = req.query;
        const campaignQueue = new CampaignQueue(campaignId);
        await campaignQueue.loadFromRedis();
        
        res.json({
            isActive: !campaignQueue.isStopped,
            remainingTasks: campaignQueue.queue.length,
            processedCount: campaignQueue.processedRecipients.size,
            status: campaignQueue.isProcessing ? 'processing' : 'waiting'
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

