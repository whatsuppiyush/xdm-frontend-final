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

    try {
      // Launch browser once for the campaign
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
          '--disable-gpu',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
          `--window-size=1920,1080`,
          '--start-maximized'
        ],
        executablePath,
        headless: isLocal ? false : chromium.headless,
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        timeout: 90000,
        protocolTimeout: 90000
      });
      console.log("----- browser launched for campaign",this.campaignId);
      while (this.queue.length > 0) {
        // Check stopped status before each message
        await this.loadFromRedis();
        if (this.isStopped) {
          console.log(`Campaign ${this.campaignId} stopped, breaking process`);
          break;
        }

        const { recipientId, message, cookies } = this.queue[0];

        // Check if already processed
        if (this.processedRecipients.has(recipientId)) {
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }

        // Check stopped status after delay
        const delay = 1 * 60000;
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.loadFromRedis();
        if (this.isStopped) break;

        const success = await sendDM(recipientId, message, cookies, this.browser);
        
        if (success) {
          await this.updateMessageStatus(recipientId, message);
          this.processedRecipients.add(recipientId);
          this.queue.shift();
          this.totalAttempts = 0;
        } else {
          this.handleFailedAttempt(recipientId);
        }
        await this.saveToRedis();
      }
    } catch (error) {
      console.error(`Error in campaign ${this.campaignId}:`, error);
    } finally {
      if (this.browser) {
        console.log("Closing browser");
        await this.browser.close();
        this.browser = null;
      }
      this.isProcessing = false;
      this.queue = [];
      await redis.del(`queue:${this.campaignId}`);
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
        page = await browser.newPage();
        await page.setDefaultNavigationTimeout(90000);
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setCookie(...cookies);

        // Navigate directly to DM compose page
        await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        console.log("----- page loaded",recipientId);
        // Wait for page load
        await page.waitForTimeout(5000);

        // Try to find composer with multiple methods
        // Try multiple selectors for the DM composer
        const possibleSelectors = [
          '[data-testid="dmComposerTextInput"]',
          'div[role="textbox"][data-testid="dmComposerTextInput"]',
          'div[contenteditable="true"][data-testid="dmComposerTextInput"]',
          'div[data-contents="true"]'
      ];

      // Wait longer for Twitter's dynamic content
      await page.waitForTimeout(10000);

      // Try each selector with increased timeout
      let composerElement = null;
      for (const selector of possibleSelectors) {
          try {
              composerElement = await page.waitForSelector(selector, {
                  timeout: 20000,
                  visible: true
              });
              if (composerElement) {
                  console.log(`Found composer with selector: ${selector}`);
                  break;
              }
          } catch (error) {
              console.log(`Selector ${selector} not found, trying next...`);
          }
      }

      if (!composerElement) {
          throw new Error('DM composer not found after trying all selectors');
      }

        // Type and send message
        await page.type('[data-testid="dmComposerTextInput"]', message);
        console.log("----- message typed",recipientId);
        await page.click('[data-testid="dmComposerSendButton"]');
        await page.waitForTimeout(2000);
        console.log("----- message sent",recipientId);
        return true;
    } catch (error) {
        console.error(`Failed to send message to ${recipientId}:`, error.message);
        return false;
    } finally {
        if (page) await page.close().catch(console.error);
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

