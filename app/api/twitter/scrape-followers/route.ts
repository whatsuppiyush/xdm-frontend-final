import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import redis from '@/lib/redis';
import prisma from '@/lib/prisma';
import { spawn } from 'child_process';
import path from 'path';

const apifyToken = process.env.APIFY_API_TOKEN || "apify_api_bUaS7nKRAGqBdPlwzS7q3Bu9wrR9PJ4wODHE";

if (!apifyToken && process.env.NODE_ENV !== 'development') { // Allow local dev without Apify for Python script
  throw new Error('APIFY_API_TOKEN is not defined in environment variables');
}

const client = new ApifyClient({
  token: apifyToken,
});

export async function POST(request: Request) {
  try {
    const { profileUrl, count, cookies, leadName, userId, friendshipType = "followers" } = await request.json();
    
    // Enhanced count calculation for better scraping capacity
    let updatedCount = count;
    
    // For large requests, be more generous with the multiplier
    if (count > 1000) {
      updatedCount = Math.min(count * 3, 15000); // Cap at 15k for very large requests
    } else if (count > 500) {
      updatedCount = count * 4; // 4x multiplier for medium requests
    } else {
      updatedCount = count * 5; // 5x multiplier for smaller requests
    }
    
    const username = profileUrl.split('/').pop();

    const userCredits = await prisma.userCredits.findUnique({
      where: { userId }
    });

    if (!userCredits || userCredits.leadCredits <= 0) {
      return NextResponse.json({ 
        error: "Insufficient lead credits. Please upgrade your plan to get more credits.",
        success: false
      }, { status: 403 });
    }

    if (updatedCount > userCredits.leadCredits * 3) {
      updatedCount = userCredits.leadCredits * 3;
      console.log(`Limited scrape count to ${updatedCount} based on ${userCredits.leadCredits} available credits (3x multiplier)`);
    }

    const hasAvailableLeads = userCredits && userCredits.leadCredits > 0;
    const newLead = await prisma.automatedLead.create({
      data: {
        leadName,
        followers: [],
        totalLeads: 0,
        userId
      }
    });

    const key = `scrape:${profileUrl}:${friendshipType}`; // Include friendshipType in key
    const leadStatusKey = `lead:${newLead.id}:status`;
    await redis.set(key, JSON.stringify({ 
      status: 'in_progress', 
      message: 'Scraping in progress',
      leadId: newLead.id
    }));
    await redis.set(leadStatusKey, JSON.stringify({
      status: 'in_progress',
      message: 'Scraping in progress'
    }));

    // Define scriptError at the top level of the function to avoid reference errors
    let scriptError = '';

    (async () => {
      try {
        let transformedFollowers: any[] = [];
        let runStatus = 'UNKNOWN';
        let runStatusMessage = 'Scraping did not complete as expected.';

        if (friendshipType === 'followers' && username) {
          // Use improved multi-account Python script for 'followers'
          console.log(`🚀 Using ENHANCED multi-account Python script to scrape followers for ${username}`);
          console.log(`📊 Enhanced scraping parameters: requested=${count}, processing=${updatedCount}, credits=${userCredits.leadCredits}`);
          // Use production-ready Python executable configuration
          const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
          
          // Get user-specific accounts from multi-user pool
          let accountsToUse = [];
          try {
            // First, try to get all available accounts for global pool initialization
            const allAccounts = await prisma.twitterAccount.findMany({
              select: { cookies: true, twitterAccountName: true, userId: true }
            });
            
            // Get user's own accounts
            const userAccounts = await prisma.twitterAccount.findMany({
              where: { userId },
              select: { cookies: true, twitterAccountName: true }
            });
            
            if (userAccounts.length > 0) {
              console.log(`Found ${userAccounts.length} Twitter accounts for user ${userId}`);
              accountsToUse = userAccounts;
            } else {
              // Fallback to single account from request
              console.log(`No stored accounts found, using single account from request`);
              accountsToUse = [{ cookies, twitterAccountName: 'Primary Account' }];
            }
            
            // Pass total accounts count for better distribution info
            console.log(`Total accounts in system: ${allAccounts.length}, User accounts: ${userAccounts.length}`);
          } catch (error) {
            console.error('Error fetching user accounts:', error);
            accountsToUse = [{ cookies, twitterAccountName: 'Primary Account' }];
          }
          
          // Use the optimized smart batch scraper for better performance
          const scriptPath = path.resolve(process.cwd(), 'backend', 'smart_batch_scraper.py');
          const accountsString = JSON.stringify(accountsToUse);

          const pythonProcess = spawn(pythonExecutable, [
            scriptPath,
            username,
            String(updatedCount), // Use full requested count since we now have better pagination
            '--accounts-json', accountsString,
            '--debug' // Enable debug logging to see what's happening
          ]);

          let scriptOutput = '';
          scriptError = ''; // Reset scriptError

          pythonProcess.stdout.on('data', (data) => {
            scriptOutput += data.toString();
          });

          pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Script STDERR: ${data}`);
            scriptError += data.toString();
          });

          await new Promise<void>((resolve, reject) => {
            pythonProcess.on('close', (code) => {
              if (code === 0) {
                try {
                  const items = JSON.parse(scriptOutput);
                  console.log(`Python script returned ${items.length} followers (requested ${updatedCount})`);
                  
                  // Check if we got significantly fewer results than expected
                  const expectedCount = updatedCount;
                  const actualCount = items.length;
                  const completionRate = actualCount / expectedCount;
                  
                  // More realistic thresholds for large follower counts
                  if (completionRate < 0.05 && expectedCount > 1000) {
                    console.warn(`⚠️  Very low completion rate: ${(completionRate * 100).toFixed(1)}% (${actualCount}/${expectedCount})`);
                    console.warn(`This may indicate rate limits, account issues, or exhausted unique followers`);
                  } else if (completionRate < 0.15 && expectedCount > 500) {
                    console.log(`📊 Moderate completion: ${(completionRate * 100).toFixed(1)}% (${actualCount}/${expectedCount}) - Enhanced scraper found available DM users`);
                  } else if (completionRate < 0.3 && expectedCount > 100) {
                    console.log(`📊 Good completion: ${(completionRate * 100).toFixed(1)}% (${actualCount}/${expectedCount}) - Strong DM availability rate`);
                  } else {
                    console.log(`✅ Excellent completion rate: ${(completionRate * 100).toFixed(1)}% (${actualCount}/${expectedCount})`);
                  }
                  
                  // The python script now returns data in the exact format the frontend expects
                  transformedFollowers = items.map((item: any) => ({
                    id: item.id || item.id_str || "", // Ensure we have an ID
                    name: item.name || "",
                    username: item.username || "",
                    bio: item.bio || item.description || "",
                    followers: parseInt(item.followers) || parseInt(item.followers_count) || 0,
                    following: parseInt(item.following) || parseInt(item.friends_count) || 0,
                    canDM: true, // All followers from Python script are DM-available
                    status: item.status || "Active"
                  }));
                  
                  console.log(`Transformed ${transformedFollowers.length} followers for database storage`);
                  
                  // Even if we got fewer results than expected, consider it successful if we got some results
                  if (transformedFollowers.length > 0) {
                    runStatus = 'SUCCEEDED';
                    runStatusMessage = `Python script completed successfully with ${transformedFollowers.length} followers.`;
                  } else {
                    runStatus = 'FAILED';
                    runStatusMessage = 'Python script completed but returned no followers.';
                    reject(new Error(runStatusMessage));
                    return;
                  }
                  
                  resolve();
                } catch (parseError) {
                  console.error('Error parsing Python script output:', parseError);
                  console.error('Python script raw output:', scriptOutput);
                  runStatus = 'FAILED';
                  runStatusMessage = `Error parsing Python script output: ${parseError instanceof Error ? parseError.message : String(parseError)}. Raw output: ${scriptOutput.substring(0, 500)}`;
                  reject(new Error(runStatusMessage));
                }
              } else {
                runStatus = 'FAILED';
                runStatusMessage = `Python script exited with code ${code}. Error: ${scriptError.substring(0,500)}`;
                console.error(runStatusMessage);
                reject(new Error(runStatusMessage));
              }
            });
            pythonProcess.on('error', (err) => {
                runStatus = 'FAILED';
                runStatusMessage = `Failed to start Python script: ${err.message}`;
                console.error(runStatusMessage, err);
                reject(err);
            });
          });

        } else {
          // Use Apify for other friendshipTypes or if username is missing
          console.log(`Using Apify actor for friendshipType: ${friendshipType}`);
          if (!apifyToken) {
            throw new Error('APIFY_API_TOKEN is required for non-follower scraping or if in non-dev environment.');
          }
          const input: {
            profileUrl: string;
            friendshipType: string;
            count: number;
            minDelay: number;
            maxDelay: number;
            cookie: any;
            cursor?: string;
            storeId?: string;
          } = {
            profileUrl,
            friendshipType,
            count: updatedCount,
            minDelay: 1,
            maxDelay: 15,
            cookie: cookies,
          };

          const cursorKey = `cursor:${newLead.id}:${friendshipType}`;
          const storedCursor = await redis.get(cursorKey);
          if (storedCursor && typeof storedCursor === 'string' && storedCursor !== '{}') {
            input.cursor = storedCursor;
            console.log(`Resuming Apify scrape with cursor: ${storedCursor}`);
          }
          console.log("Scraping with Apify actor with input:", input);
          const run = await client.actor("curious_coder/twitter-scraper").call(input);
          console.log("Apify run details:", run);

          runStatus = run.status;
          runStatusMessage = run.statusMessage || 'Apify scraping status message not available.';

          if (run.status !== 'SUCCEEDED') {
            throw new Error(runStatusMessage);
          }

          const { items } = await client.dataset(run.defaultDatasetId).listItems();
          let processedItems = items; // Initialize with all items

          if (friendshipType === "verifiedFollowers") {
            // Filter for blue-verified users if that's the requested friendshipType
            console.log(`Initial item count for verifiedFollowers from Apify: ${items.length}`);
            processedItems = items.filter((item: any) => item.is_blue_verified === true);
            console.log(`After is_blue_verified filter for verifiedFollowers: ${processedItems.length}`);
          }
          
          const dmableFollowers = processedItems.filter((item: any) => item.can_dm === true);
          if (friendshipType === "verifiedFollowers") {
            console.log(`After can_dm filter (for verifiedFollowers): ${dmableFollowers.length}`);
          }
          
          transformedFollowers = dmableFollowers.map((item: any) => ({
            id: item.userId || item.id,
            name: item.name || "",
            username: item.username || item.screen_name || "",
            bio: item.description || item.bio || "",
            followers: item.followers_count || item.followersCount || 0,
            following: item.following_count || item.followingCount || 0,
            canDM: item.can_dm || item.canDM || false, // Should be true due to the filter
            status: "Active",
            isVerified: item.is_blue_verified === true // Store verification status
          }));

          // Save cursor for Apify runs
          if (run.status === 'SUCCEEDED') {
            try {
              let nextCursor = null;
              const runAny = run as any;
              if (runAny.defaultDataJsonObject) {
                nextCursor = runAny.defaultDataJsonObject.cursor || 
                              runAny.defaultDataJsonObject.next_cursor ||
                              runAny.defaultDataJsonObject.next_cursor_str;
              }
              if (!nextCursor) {
                try {
                  const outputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('OUTPUT');
                  if (outputRecord && outputRecord.value && typeof outputRecord.value === 'object' && !Array.isArray(outputRecord.value)) {
                    const valueObj = outputRecord.value as Record<string, any>;
                    nextCursor = valueObj.cursor || 
                                valueObj.next_cursor ||
                                valueObj.next_cursor_str;
                  }
                } catch (e) {
                  console.log('No cursor in Apify OUTPUT record');
                }
              }
              if (nextCursor) {
                console.log(`Apify - Found next cursor: ${nextCursor}`);
                await redis.set(cursorKey, nextCursor);
              } else {
                console.log('Apify - No next cursor found - likely end of results');
                await redis.set(cursorKey, '');
              }
            } catch (cursorError) {
              console.error('Apify - Error saving cursor:', cursorError);
            }
          }
        }

        // Common logic for updating DB and Redis after scraping (either Python or Apify)
        if (runStatus === 'SUCCEEDED') {
            console.log(`Updating database with ${transformedFollowers.length} followers for lead ${newLead.id}`);
            
            await prisma.automatedLead.update({
                where: { id: newLead.id },
                data: {
                followers: transformedFollowers,
                totalLeads: transformedFollowers.length
                }
            });
            
            console.log(`Successfully updated database. Lead ${newLead.id} now has ${transformedFollowers.length} followers`);
            
            await redis.set(key, JSON.stringify({
                status: 'completed',
                leadId: newLead.id,
                count: transformedFollowers.length
            }));
            await redis.set(leadStatusKey, JSON.stringify({
                status: 'completed',
                count: transformedFollowers.length
            }));

            console.log(`Updated Redis status for lead ${newLead.id}`);

            try {
                const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/send-lead-scraping-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listName: newLead.leadName,
                    leadCount: transformedFollowers.length,
                    userId: newLead.userId
                }),
                });
                console.log(`Sent notification email for lead ${newLead.id}`);
            } catch (emailError) {
                console.error('Error sending lead scraping completion email:', emailError);
            }

            if (hasAvailableLeads && transformedFollowers.length > 0) {
                try {
                const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/credits/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                    userId,
                    leadsCount: transformedFollowers.length
                    }),
                });
                const updateResult = await updateResponse.json();
                console.log('Credits update result:', updateResult);
                if (!updateResult.success) {
                    console.error('Failed to update credits:', updateResult.error);
                }
                } catch (creditError) {
                console.error('Error updating credits:', creditError);
                }
            }
        } else {
            // If status is not SUCCEEDED (applies to both Python and Apify paths)
            throw new Error(runStatusMessage);
        }

      } catch (error) {
        console.error('Scraping error (outer try-catch):', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during scraping process';
        const isAuthError = errorMessage.includes('Failed to authorize with twitter') || 
                             errorMessage.includes('authorization') ||
                             errorMessage.includes('auth') || 
                             errorMessage.includes('cookie') || // Python script might output cookie errors
                             (scriptError && (scriptError.includes('auth') || scriptError.includes('cookie'))); // Check python stderr too
        
        await redis.set(key, JSON.stringify({ 
          status: 'error', 
          message: errorMessage.substring(0, 1000), // Limit error message length
          errorType: isAuthError ? 'auth_error' : 'general_error',
          leadId: newLead.id // include leadId in error status
        })); 
        await redis.set(leadStatusKey, JSON.stringify({
          status: 'error',
          message: errorMessage.substring(0, 1000),
          errorType: isAuthError ? 'auth_error' : 'general_error'
        }));
      }
    })();
    
    return NextResponse.json({ 
      status: 'in_progress',
      leadId: newLead.id
    });
  } catch (error) {
    console.error('Failed to start scraping (top-level catch):', error);
    return NextResponse.json({ 
      error: 'Failed to start scraping',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 