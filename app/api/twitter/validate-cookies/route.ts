import { NextResponse } from "next/server";
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

interface TwitterCookie {
  name: string;
  value: string;
}

interface TwitterAccount {
  id: string;
  cookies: TwitterCookie[];
}

export async function POST(request: Request) {
  try {
    const { accounts } = await request.json();
    
    if (!accounts || !Array.isArray(accounts)) {
      return NextResponse.json({ 
        error: "Invalid accounts format. Expected array of Twitter accounts" 
      }, { status: 400 });
    }

    const results = await validateMultipleAccounts(accounts);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error validating Twitter cookies:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

async function validateMultipleAccounts(accounts: TwitterAccount[]) {
  const results: Record<string, any> = {};
  let browser = null;
  
  try {
    // Launch browser with local or remote Chrome
    const isLocal = process.env.NEXT_PUBLIC_APP_ENV === 'local';
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const executablePath = isLocal ? (
      isWindows ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' :
      isMac ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' :
      await chromium.executablePath()
    ) : await chromium.executablePath();
  
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log("Browser launched successfully");
    
    // Process each account sequentially
    for (const account of accounts) {
      try {
        if (!account.id || !account.cookies || !Array.isArray(account.cookies)) {
          results[account.id] = { valid: false, error: "Invalid account data" };
          continue;
        }
        
        // Create a new page for each account
        const page = await browser.newPage();
        
        // Set Twitter cookies directly on the page
        const essentialCookies = account.cookies.filter(c => 
          ['auth_token', 'ct0'].includes(c.name)
        );
        await page.setCookie(...essentialCookies);
        
        console.log("Essential cookies set for account:", account.id, essentialCookies.length);
        // Navigate to Twitter
        await page.goto('https://twitter.com', { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        
        // Check if authentication was successful using exact same method as example
        let isValid = false;
        try {
          await page.waitForSelector('div[data-testid="primaryColumn"]', { timeout: 3000 });
          console.log(`Account ${account.id}: Successfully authenticated!`);
          isValid = true;
        } catch (e) {
          console.log(`Account ${account.id}: Failed to authenticate!`);
          isValid = false;
        }
        
        // Record the result
        results[account.id] = {
          valid: isValid,
          finalUrl: page.url()
        };
        
        // Close the page
        await page.close();
        
        // Add a delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`Error validating account ${account.id}:`, error);
        results[account.id] = { 
          valid: false, 
          error: error instanceof Error ? error.message : "Browser automation error" 
        };
      }
    }
  } catch (error) {
    console.error("Browser launch error:", error);
  } finally {
    // Make sure to close the browser
    if (browser) {
      await browser.close();
    }
  }
  
  return results;
} 