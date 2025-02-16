// pages/api/scheduler.js

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

let currentJob = null;
let queue = [];
let processedRecipients = new Set();
let totalAttempts = 0;
const MAX_RETRIES = 2;

const sendDM = async (recipientId, message, cookies) => {
    let browser = null;
    let page = null;
    
    try {
        // Configure browser launch options based on environment
        const isLocal = process.env.NEXT_PUBLIC_APP_ENV === 'local';
        const isWindows = process.platform === 'win32';

        let executablePath;
        if (isLocal && isWindows) {
            try {
                // For local Windows development
                const localChromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
                if (fs.existsSync(localChromePath)) {
                    executablePath = localChromePath;
                } else {
                    executablePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
                }
            } catch (error) {
                console.error('Error finding local Chrome:', error);
                executablePath = await chromium.executablePath('win32');
            }
        } else {
            // For production or non-Windows environments
            executablePath = await chromium.executablePath();
        }

        console.log('Environment:', process.env.NEXT_PUBLIC_APP_ENV);
        console.log('Platform:', process.platform);
        console.log('Using Chrome path:', executablePath);

        // Launch browser with appropriate options
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            executablePath,
            headless: isLocal ? false : chromium.headless,
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            ignoreHTTPSErrors: true
        });

        console.log('Browser launched successfully');

        // Create a new page
        page = await browser.newPage();
        
        // Set default timeouts
        // await page.setDefaultNavigationTimeout(90000);
        // await page.setDefaultTimeout(90000);
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set cookies
        await page.setCookie(...cookies);

        // Navigate to Twitter and verify authentication
        console.log('Navigating to Twitter...');
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
        console.log('Initial Twitter page state:', initialState);

        // Wait for authentication
        await page.waitForSelector('div[data-testid="primaryColumn"]', { 
            timeout: 60000,
            visible: true 
        });

        console.log('Successfully authenticated, navigating to DM page...');

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
        //console.log('DM page initial state:', dmPageInitialState);

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
            throw new Error('Could not find DM composer with any known selector');
        }
        // Ensure the page is fully loaded and interactive
        await page.waitForFunction(() => {
            return document.readyState === 'complete' && 
                   !document.querySelector('.DMComposer-loading') &&
                   document.querySelector('[data-testid="dmComposerTextInput"]')?.getAttribute('contenteditable') === 'true';
        }, { timeout: 300000 });

        console.log('Found composer, typing message...');

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

        // Wait for the message to be sent
        await page.waitForFunction(
            (text) => {
                const messages = document.querySelectorAll('[data-testid="messageEntry"]');
                return Array.from(messages).some(msg => msg.textContent.includes(text));
            },
            { timeout: 30000 },
            message
        );

        console.log(`Message sent to recipient: ${recipientId}`);
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
        if (page) await page.close().catch(console.error);
        if (browser) await browser.close().catch(console.error);
    }
};

const processQueue = async () => {
    console.log('Processing queue...');

    try {
        while (queue.length > 0 && currentJob) {
            const { recipientId, message, cookies } = queue[0];

            // Check if we've already processed this recipient
            if (processedRecipients.has(recipientId)) {
                console.log(`Skipping already processed recipient: ${recipientId}`);
                queue.shift();
                continue;
            }

            // Random delay between messages (30 seconds)
            const delay = Math.floor(Math.random() * (5 - 2 + 1) + 2) * 60000;
            console.log(`Waiting ${delay/60000} minutes before sending next message...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            const success = await sendDM(recipientId, message, cookies);
            
            if (success) {
                // Update message status in database
                try {
                    const messages = await prisma.message.findMany({
                        where: {
                            messageSent: message,
                            messages: {
                                some: {
                                    recipientId: recipientId,
                                    status: false
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 1
                    });

                    if (messages.length > 0) {
                        const currentMessage = messages[0];
                        const updatedMessages = currentMessage.messages.map(msg => 
                            msg.recipientId === recipientId 
                                ? { ...msg, status: true }
                                : msg
                        );

                        await prisma.message.update({
                            where: { id: currentMessage.id },
                            data: { messages: updatedMessages }
                        });
                    }
                } catch (error) {
                    console.error('Failed to update message status:', error);
                }

                // Mark recipient as processed and remove from queue
                processedRecipients.add(recipientId);
                queue.shift();
                totalAttempts = 0; // Reset attempts counter on success
            } else {
                totalAttempts++;
                if (totalAttempts >= MAX_RETRIES) {
                    console.log(`Failed to send message to ${recipientId} after ${MAX_RETRIES} attempts, skipping...`);
                    processedRecipients.add(recipientId); // Mark as processed even though failed
                    queue.shift();
                    totalAttempts = 0; // Reset attempts counter
                } else {
                    // If failed but still have retries, wait 30 seconds and try again
                    console.log(`Retry attempt ${totalAttempts} for recipient ${recipientId}`);
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }
        }
    } catch (error) {
        console.error('Error in process queue:', error);
    } finally {
        // Clean up when queue is empty or job is stopped
        currentJob = null;
        queue = [];
        processedRecipients.clear();
        totalAttempts = 0;
        console.log('Queue processing completed');
    }
};

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, message, cookies,recipients } = req.body;
        console.log("recipientIds",recipients);
        let updatedCookies = [];
        for(let cookie of cookies){
            if(cookie.name=="ct0"||cookie.name=="auth_token"){
                updatedCookies.push(cookie);
            }
        }
        console.log('updatedCookies',updatedCookies);
        //const recipientIds = ['1393223661851607042']//['1393223661851607042',"1151640228349612032"];
        
        if (action === 'start') {
            // Clear previous state
            processedRecipients.clear();
            totalAttempts = 0;
            queue = [];

            // Add new recipients to queue
            recipients.forEach(recipientId => 
                queue.push({ recipientId, message, cookies: updatedCookies })
            );

            if (!currentJob) {
                currentJob = true;
                processQueue().catch(error => {
                    console.error('Process queue error:', error);
                    currentJob = null;
                });
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Messages are being sent in the background.',
                queueLength: queue.length,
                totalRecipients: recipients.length
            });
        }

        if (action === 'stop') {
            currentJob = null;
            queue = [];
            processedRecipients.clear();
            totalAttempts = 0;
            return res.status(200).json({ 
                success: true, 
                message: 'Scheduler stopped successfully.' 
            });
        }
    } else if (req.method === 'GET') {
        res.json({
            remainingTasks: queue.length,
            processedCount: processedRecipients.size,
            currentJob: !!currentJob,
            currentAttempt: totalAttempts
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
