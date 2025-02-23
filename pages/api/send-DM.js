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
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        executablePath,
        headless: isLocal ? false : chromium.headless,
        defaultViewport: { width: 1920, height: 1080 }
      });
      console.log("----- browser launched for campaign",this.campaignId);
      while (this.queue.length > 0) {
        await this.loadFromRedis();
        console.log("----- queue length",this.queue.length,this.isStopped);
        if (this.isStopped) break;

        const { recipientId, message, cookies } = this.queue[0];

        if (this.processedRecipients.has(recipientId)) {
          this.queue.shift();
          await this.saveToRedis();
          continue;
        }

        const delay = 2 * 60000;
        console.log(`Waiting ${delay/60000} minutes before sending next message...`);
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
    await this.loadFromRedis();
    this.isStopped = true;
    await this.saveToRedis();
    console.log(`Campaign ${this.campaignId} marked as stopped in Redis`);
  }
}

// Update sendDM to accept browser instance
const sendDM = async (recipientId, message, cookies, browser) => {
    let page = null;
    
    try {
        // Set viewport
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set cookies
        await page.setCookie(...cookies);

        // Navigate to Twitter and verify authentication
        console.log('Navigating to Twitter...',recipientId);
        await page.goto('https://twitter.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });

        // Debug: Check initial Twitter page state
        const initialState = await page.evaluate(() => {
            return {
                url: window.location.href,
                readyState: document.readyState,
                bodyContent: document.body.innerHTML.length,
                availableElements: {
                    primaryColumn: !!document.querySelector('div[data-testid="primaryColumn"]'),
                    sideNavigation: !!document.querySelector('div[data-testid="sideNavigation"]'),
                    appContent: !!document.querySelector('div[data-testid="appContent"]')
                }
            };
        });
        console.log('Initial Twitter page state:');

        // Wait for authentication
        await page.waitForSelector('div[data-testid="primaryColumn"]', { 
            timeout: 60000,
            visible: true 
        });

        console.log('Successfully authenticated, navigating to DM page...',recipientId);

        // Navigate to DM compose page
        await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });

        // Debug: Check DM page initial load
        const dmPageInitialState = await page.evaluate(() => {
            const allDataTestIds = Array.from(document.querySelectorAll('[data-testid]'))
                .map(el => el.getAttribute('data-testid'));
            
            return {
                url: window.location.href,
                readyState: document.readyState,
                dataTestIds: allDataTestIds,
                dmElements: {
                    drawer: !!document.querySelector('div[data-testid="DMDrawer"]'),
                    composer: !!document.querySelector('[data-testid="dmComposerTextInput"]'),
                    sendButton: !!document.querySelector('[data-testid="dmComposerSendButton"]')
                },
                inputElements: {
                    contentEditables: document.querySelectorAll('[contenteditable="true"]').length,
                    textboxRoles: document.querySelectorAll('[role="textbox"]').length,
                    textareas: document.querySelectorAll('textarea').length
                }
            };
        });
        console.log('DM page initial state:',recipientId);

        // Wait a bit and check again (sometimes elements load dynamically)
        await page.waitForTimeout(5000);
        const dmPageAfterWait = await page.evaluate(() => {
            const getElementDetails = (selector) => {
                const el = document.querySelector(selector);
                if (!el) return null;
                return {
                    exists: true,
                    visible: el.offsetParent !== null,
                    attributes: {
                        role: el.getAttribute('role'),
                        contentEditable: el.getAttribute('contenteditable'),
                        dataTestId: el.getAttribute('data-testid'),
                        ariaLabel: el.getAttribute('aria-label')
                    },
                    computedStyle: {
                        display: window.getComputedStyle(el).display,
                        visibility: window.getComputedStyle(el).visibility
                    }
                };
            };

            return {
                dmComposer: getElementDetails('[data-testid="dmComposerTextInput"]'),
                dmDrawer: getElementDetails('div[data-testid="DMDrawer"]'),
                sendButton: getElementDetails('[data-testid="dmComposerSendButton"]'),
                allVisibleInputs: Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
                    .filter(el => el.offsetParent !== null)
                    .map(el => ({
                        tag: el.tagName,
                        role: el.getAttribute('role'),
                        dataTestId: el.getAttribute('data-testid'),
                        ariaLabel: el.getAttribute('aria-label')
                    }))
            };
        });
        //console.log('DM page state after waiting:', dmPageAfterWait);


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
        // Ensure the page is fully loaded and interactive
        // await page.waitForFunction(() => {
        //     return document.readyState === 'complete' && 
        //            !document.querySelector('.DMComposer-loading') &&
        //            document.querySelector('[data-testid="dmComposerTextInput"]')?.getAttribute('contenteditable') === 'true';
        // }, { timeout: 300000 });

        console.log('Found composer, typing message...',recipientId);

        // Try different methods to input text
        try {
            // Method 1: Using type
            await composerElement.type(message, { delay: 200 });
        } catch (error) {
            console.log('Type method failed, trying focus and keyboard send...');
            try {
                // Method 2: Using focus and keyboard send
                await composerElement.focus();
                await page.keyboard.type(message, { delay: 200 });
            } catch (error) {
                console.log('Keyboard method failed, trying evaluate...');
                // Method 3: Using evaluate
                await page.evaluate((selector, text) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.textContent = text;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, '[data-testid="dmComposerTextInput"]', message);
            }
        }

        console.log('Message typed, waiting for send button...');

        // Wait for and click the send button
        const sendButtonSelectors = [
            'button[data-testid="dmComposerSendButton"]',
            'div[data-testid="dmComposerSendButton"]',
            '[role="button"][data-testid="dmComposerSendButton"]'
        ];

        let sendButton = null;
        for (const selector of sendButtonSelectors) {
            try {
                sendButton = await page.waitForSelector(selector, {
                    timeout: 20000,
                    visible: true
                });
                if (sendButton) {
                    console.log(`Found send button with selector: ${selector}`);
                    break;
                }
            } catch (error) {
                console.log(`Send button selector ${selector} not found, trying next...`);
            }
        }

        if (!sendButton) {
            throw new Error('Could not find send button with any known selector');
        }

        // Click the send button
        await sendButton.click();
        console.log("sendButton clicked",message.slice(0, 10));
        // Wait for the message to be sent

        console.log(`Message sent to recipient: ${recipientId} ${message.slice(0, 10)}`);
        return true;
    } catch (error) {
        console.log(`Failed to send message to recipient: ${recipientId}. Error: ${error.message}`);
        // Take a screenshot on error for debugging
        if (page) {
            try {
                // Create screenshots directory if it doesn't exist
                const screenshotsDir = path.join(process.cwd(), 'screenshots');
                await fs.promises.mkdir(screenshotsDir, { recursive: true });
                
                // Save screenshot with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const screenshotPath = path.join(screenshotsDir, `error-${timestamp}.png`);
                await page.screenshot({ path: screenshotPath });
                console.log('Error screenshot saved to:', screenshotPath);

                // Store the latest screenshot path in a .json file for tracking
                const metadataPath = path.join(screenshotsDir, 'latest.json');
                await fs.promises.writeFile(
                    metadataPath,
                    JSON.stringify({ 
                        latestScreenshot: screenshotPath,
                        timestamp: new Date().toISOString(),
                        error: error.message
                    })
                );
            } catch (screenshotError) {
                console.error('Failed to take error screenshot:', screenshotError.message);
            }
        }
        return false;
    } finally {
        console.log("---- closing page");
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
