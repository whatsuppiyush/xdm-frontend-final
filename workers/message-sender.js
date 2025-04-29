// Send DM function
async function sendDM(recipientId, message, cookies, browser, campaignId) {
  let page = null;
  
  try {
    console.log(`[SEND] Campaign ${campaignId}: Starting DM process for ${recipientId}`);
    page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setViewport({ width: 800, height: 600 });
    
    const essentialCookies = cookies.filter(c => 
      ['auth_token', 'ct0'].includes(c.name)
    );
    await page.setCookie(...essentialCookies);
    
    console.log(`[SEND] Campaign ${campaignId}: Navigating to DM page for ${recipientId}`);
    await page.goto(`https://twitter.com/messages/compose?recipient_id=${recipientId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log(`[SEND] Campaign ${campaignId}: Waiting for composer for ${recipientId}`);
    await page.waitForSelector('[data-testid="dmComposerTextInput"]', {
      timeout: 60000,
      visible: true
    });
    
    try {
      console.log(`[SEND] Campaign ${campaignId}: Typing message for ${recipientId}`);
      await page.type('[data-testid="dmComposerTextInput"]', message);
    } catch (typeError) {
      console.log(`[SEND] Campaign ${campaignId}: Direct typing failed for ${recipientId}, using alternate method`);
      await page.evaluate((msg) => {
        const composer = document.querySelector('[data-testid="dmComposerTextInput"]');
        if (composer) {
          composer.innerText = msg;
          composer.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } else {
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
    
    console.log(`[SEND] Campaign ${campaignId}: Clicking send button for ${recipientId}`);
    await page.click('[data-testid="dmComposerSendButton"]');
    await page.waitForTimeout(1000);
    console.log(`[SEND] Campaign ${campaignId}: Message sent successfully to ${recipientId}`);
    
    return true;
  } catch (error) {
    console.error(`[SEND] Campaign ${campaignId}: FAILED for ${recipientId}: ${error.message}`);
    
    if (error.message.includes('Target.createTarget timed out') || 
        error.message.includes('TimeoutError') ||
        error.message.includes('out of memory') || 
        error.message.includes('Browser closed') ||
        error.message.includes('Protocol error') || 
        error.message.includes('Increase the \'protocolTimeout\'') ||
        error.message.includes('Waiting for selector') ||
        error.message.includes('Waiting failed:')) {
      throw error;
    }
    
    return false;
  } finally {
    if (page) {
      console.log(`[SEND] Campaign ${campaignId}: Cleaning up page for ${recipientId}`);
      await page.removeAllListeners();
      await page.close();
    }
  }
}

module.exports = {
  sendDM
}; 