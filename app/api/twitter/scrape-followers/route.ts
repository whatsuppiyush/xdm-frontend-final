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
        const input = {
          profileUrl,
          friendshipType,
          count,
          minDelay: 1,
          maxDelay: 15,
          cookie: cookies,
        };

        const run = await client.actor("curious_coder/twitter-scraper").call(input);
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
      } catch (error) {
        console.error('Scraping error:', error);
        // Store error in Redis
        await redis.set(key, JSON.stringify({ 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }));
        await redis.set(leadStatusKey, JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
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