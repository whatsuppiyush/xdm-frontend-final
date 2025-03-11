import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import redis from '@/lib/redis';
import prisma from '@/lib/prisma';

const apifyToken = process.env.APIFY_API_TOKEN || "apify_api_bUaS7nKRAGqBdPlwzS7q3Bu9wrR9PJ4wODHE";

if (!apifyToken) {
  throw new Error('APIFY_API_TOKEN is not defined in environment variables');
}

const client = new ApifyClient({
  token: apifyToken,
});

export async function POST(request: Request) {
  try {
    const { profileUrl, count, cookies, leadName, userId, friendshipType = "followers" } = await request.json();
    let updatedCount = count*2;
    // Extract username from profile URL
    const username = profileUrl.split('/').pop();
    
    // Create the lead immediately with 0 leads but "in_progress" status
    const newLead = await prisma.automatedLead.create({
      data: {
        leadName,
        followers: [],
        totalLeads: 0,
        userId
      }
    });
    
    // Store status in Redis with the lead ID
    const key = `scrape:${profileUrl}`;
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
    
    // Start scraping in background
    (async () => {
      try {
        // When creating input, define cursor properly
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

        // Only set cursor if it's a valid string
        const cursorKey = `cursor:${newLead.id}`;
        const storedCursor = await redis.get(cursorKey);
        if (storedCursor && typeof storedCursor === 'string' && storedCursor !== '{}') {
          input.cursor = storedCursor;
          console.log(`Resuming scrape with cursor: ${storedCursor}`);
        }
        console.log("Scraping with cursor:", input.cursor);
        const run = await client.actor("curious_coder/twitter-scraper").call(input);
        console.log("run", run);

        // Check if the run failed
        if (run.status === 'FAILED' || run.status !== 'SUCCEEDED') {
          const errorMessage = run.statusMessage || 'Twitter scraping failed';
          throw new Error(errorMessage);
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        // Filter followers who can receive DMs
        const dmableFollowers = items.filter((item: any) => {
          return item.can_dm === true;
        });
        
        console.log('Total followers:', items.length);
        console.log('DM-able followers:', dmableFollowers.length);
        
        // Transform the scraped data to match our Lead interface
        const transformedFollowers = dmableFollowers.map((item: any) => ({
          id: item.userId || item.id,
          name: item.name || "",
          username: item.username || item.screen_name || "",
          bio: item.description || item.bio || "",
          followers: item.followers_count || item.followersCount || 0,
          following: item.following_count || item.followingCount || 0,
          canDM: item.can_dm || item.canDM || false,
          status: "Active" // Add default status
        }));
        
        // Update the existing lead when scraping completes
        await prisma.automatedLead.update({
          where: { id: newLead.id },
          data: {
            followers: transformedFollowers,
            totalLeads: transformedFollowers.length
          }
        });
        
        // Update Redis status
        await redis.set(key, JSON.stringify({
          status: 'completed',
          leadId: newLead.id,
          count: transformedFollowers.length
        }));
        await redis.set(leadStatusKey, JSON.stringify({
          status: 'completed',
          count: transformedFollowers.length
        }));

        // After run completes, check the Actor execution status
        if (run.status === 'SUCCEEDED') {
          try {
            // Get cursor from dataset info
            const datasetInfo = await client.dataset(run.defaultDatasetId).listItems();
            console.log('Dataset info:', JSON.stringify(datasetInfo || {}));
            
            // Get any metadata from the dataset that might contain the cursor
            const metadata = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
            console.log('Dataset metadata:', JSON.stringify(metadata));
            
            // According to the schema, the actor should provide a cursor directly
            // Check on actorRun data for cursor
            console.log('Run metadata:', JSON.stringify(run));
            
            // Try to find cursor in common locations
            let nextCursor = null;
            
            // Check if the property might exist using 'any' type
            const runAny = run as any;
            if (runAny.defaultDataJsonObject) {
              nextCursor = runAny.defaultDataJsonObject.cursor || 
                          runAny.defaultDataJsonObject.next_cursor ||
                          runAny.defaultDataJsonObject.next_cursor_str;
            }
            
            // If not found, try to access it another way with client.keyValueStore
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
                console.log('No cursor in OUTPUT record');
              }
            }
            
            if (nextCursor) {
              console.log(`Found next cursor: ${nextCursor}`);
              await redis.set(cursorKey, nextCursor);
            } else {
              console.log('No next cursor found - likely end of results');
              // If we're at the end, store empty string
              await redis.set(cursorKey, '');
            }
          } catch (cursorError) {
            console.error('Error saving cursor:', cursorError);
          }
        }
      } catch (error) {
        console.error('Scraping error:', error);
        // Store error in Redis
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAuthError = errorMessage.includes('Failed to authorize with twitter') || 
                             errorMessage.includes('authorization') ||
                             errorMessage.includes('auth');
        await redis.set(key, JSON.stringify({ 
          status: 'error', 
          message: errorMessage,
          errorType: isAuthError ? 'auth_error' : 'general_error'
        }));
        await redis.set(leadStatusKey, JSON.stringify({
          status: 'error',
          message: errorMessage,
          errorType: isAuthError ? 'auth_error' : 'general_error'
        }));
      }
    })();
    
    // Return the lead ID immediately
    return NextResponse.json({ 
      status: 'in_progress',
      leadId: newLead.id
    });
  } catch (error) {
    console.error('Failed to start scraping:', error);
    return NextResponse.json({ 
      error: 'Failed to start scraping',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 