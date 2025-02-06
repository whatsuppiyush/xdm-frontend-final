const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Render
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  // Skip downloading Chromium on npm install
  skipDownload: true,
  // Use the installed version from @sparticuz/chromium
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
}; 