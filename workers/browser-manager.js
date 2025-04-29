const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Track browser instances
const BROWSER_INSTANCES = new Map();

// Launch browser function
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
    protocolTimeout: 180000,
    timeout: 180000
  });
  
  return browser;
}

module.exports = {
  BROWSER_INSTANCES,
  launchBrowser
}; 