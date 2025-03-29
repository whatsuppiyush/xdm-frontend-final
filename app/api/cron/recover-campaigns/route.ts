import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { DAILY_MESSAGE_LIMIT } from "@/lib/constants";

// This is a simplified version of the CampaignQueue class
class CampaignQueue {
  campaignId: string;
  queue: any[];
  processedRecipients: Set<string>;
  status: string;

  constructor(campaignId: string) {
    this.campaignId = campaignId;
    this.queue = [];
    this.processedRecipients = new Set();
    this.status = 'Ready';
  }

  async saveToRedis() {
    const queueState = {
      campaignId: this.campaignId,
      queue: this.queue,
      processedRecipients: Array.from(this.processedRecipients),
      status: this.status
    };
    await redis.set(`queue:${this.campaignId}`, JSON.stringify(queueState));
  }

  async loadFromRedis() {
    const queueState = await redis.get(`queue:${this.campaignId}`);
    if (queueState) {
      const state = typeof queueState === 'string' ? JSON.parse(queueState) : queueState;
      this.queue = state.queue || [];
      this.processedRecipients = new Set(state.processedRecipients || []);
      this.status = state.status || 'Ready';
    }
  }
}

export async function GET(request: Request) {
  try {
    // Verify this is a legitimate cron request
    const { searchParams } = new URL(request.url);
    const authToken = searchParams.get('token');
    
    if (authToken !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("Running campaign recovery and rate limit check CRON job");
    
    // Get all campaign queues from Redis
    const queueKeys = await redis.keys('queue:*');
    console.log(`Found ${queueKeys.length} campaign queues in Redis`);
    
    if (queueKeys.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No campaign queues found in Redis" 
      });
    }
    
    let resumedRateLimitedCount = 0;
    let recoveredRunningCount = 0;
    let fixedQueueCount = 0;
    
    // Process each queue found in Redis
    for (const queueKey of queueKeys) {
      // Extract campaign ID from the key (queue:campaignId)
      const campaignId = queueKey.split(':')[1];
      if (!campaignId) continue;
      
      // Get queue data from Redis
      const queueData = await redis.get(queueKey);
      if (!queueData) continue;
      
      // Parse queue state
      const queueState = typeof queueData === 'string' ? JSON.parse(queueData) : queueData;
      
      // Skip empty queues or stopped campaigns
      if (!queueState.queue || queueState.queue.length === 0 || queueState.status === 'Stopped') {
        continue;
      }
      
      // Get campaign data from database (we still need this for userId and status)
      const campaign = await prisma.message.findUnique({
        where: { id: campaignId }
      });
      
      // Skip if campaign doesn't exist in database
      if (!campaign) {
        console.log(`Campaign ${campaignId} exists in Redis but not in database, cleaning up...`);
        await redis.del(queueKey);
        continue;
      }
      
      console.log(`Processing campaign ${campaignId}: DB status=${campaign.status}, Redis status=${queueState.status}`);
      
      // CASE 1: Rate Limited campaigns - check if limit has reset
      if (campaign.status === 'Rate Limited') {
        const userId = campaign.userId;
        if (!userId) continue;
        
        // Get the current date in YYYY-MM-DD format for the daily limit key
        const today = new Date().toISOString().split('T')[0];
        const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
        
        // Check if the daily limit key exists and get its value
        const dailyUsage = await redis.get(dailyLimitKey);
        
        // Handle different return types from Redis
        let currentUsage = 0;
        if (dailyUsage) {
          if (typeof dailyUsage === 'string') {
            try {
              currentUsage = parseInt(dailyUsage);
            } catch (e) {
              console.error(`Error parsing daily usage for user ${userId}:`, e);
            }
          } else if (typeof dailyUsage === 'number') {
            currentUsage = dailyUsage;
          } else {
            try {
              // Check if dailyUsage is an object but not null
              if (dailyUsage && typeof dailyUsage === 'object') {
                // If it's an empty object or has a numeric value property, handle accordingly
                const stringified = JSON.stringify(dailyUsage);
                if (stringified !== '{}') {
                  const parsedUsage = JSON.parse(stringified);
                  if (typeof parsedUsage === 'number') {
                    currentUsage = parsedUsage;
                  }
                }
              }
            } catch (e) {
              console.error(`Error parsing JSON daily usage for user ${userId}:`, e);
            }
          }
        }
        
        console.log(`User ${userId} daily usage: ${currentUsage}/${DAILY_MESSAGE_LIMIT}`);
        
        // Check if we're below the limit (either key doesn't exist or count is below limit)
        if (currentUsage < DAILY_MESSAGE_LIMIT) {
          console.log(`Resuming rate-limited campaign ${campaignId} - under daily limit`);
          
          // Update campaign status in database
          await prisma.message.update({
            where: { id: campaignId },
            data: { status: 'In Progress' }
          });
          
          // Update queue status in Redis
          queueState.status = 'Running';
          await redis.set(queueKey, JSON.stringify(queueState));
          
          // Call the send-DM API to resume processing
          await fetch(`${process.env.NEXTAUTH_URL}/api/send-DM`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'resume',
              campaignId: campaignId
            }),
          });
          
          resumedRateLimitedCount++;
        } else {
          // Still rate limited - check when the key will expire
          const ttl = await redis.ttl(dailyLimitKey);
          if (ttl > 0) {
            const expiryHours = Math.floor(ttl / 3600);
            const expiryMinutes = Math.floor((ttl % 3600) / 60);
            console.log(`Campaign ${campaignId} still rate limited. Limit will reset in ${expiryHours}h ${expiryMinutes}m`);
          } else if (ttl === -1) {
            // Key exists but has no expiry - this shouldn't happen, but let's fix it
            console.log(`Campaign ${campaignId} rate limit key has no expiry, setting 24h expiry`);
            await redis.expire(dailyLimitKey, 24 * 60 * 60); // 24 hours in seconds
          }
        }
      }
      // CASE 2: In Progress campaigns with non-Running queue status
      else if (campaign.status === 'In Progress' && queueState.status !== 'Running') {
        console.log(`Recovering in-progress campaign ${campaignId} with queue status ${queueState.status}`);
        
        // Set queue status to Running
        queueState.status = 'Running';
        await redis.set(queueKey, JSON.stringify(queueState));
        
        // Call the send-DM API to resume processing
        await fetch(`${process.env.NEXTAUTH_URL}/api/send-DM`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'resume',
            campaignId: campaignId
          }),
        });
        
        recoveredRunningCount++;
      }
      // CASE 3: Running queue but database status is not In Progress
      else if (queueState.status === 'Running' && campaign.status !== 'In Progress') {
        console.log(`Fixing database status for campaign ${campaignId}: ${campaign.status} -> In Progress`);
        
        await prisma.message.update({
          where: { id: campaignId },
          data: { status: 'In Progress' }
        });
        
        fixedQueueCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Processed campaigns: resumed ${resumedRateLimitedCount} rate-limited, recovered ${recoveredRunningCount} in-progress, fixed ${fixedQueueCount} database statuses` 
    });
  } catch (error) {
    console.error('Error in campaign recovery CRON job:', error);
    return NextResponse.json({ 
      error: 'Failed to process campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also add POST method for manual recovery from UI
export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    // Find only campaigns that should be running (exclude Paused)
    const activeCampaigns = await prisma.message.findMany({
      where: {
        userId: userId,
        status: {
          in: ['In Progress', 'Rate Limited'] // Explicitly exclude Paused
        }
      }
    });
    
    console.log(`Found ${activeCampaigns.length} campaigns to recover for user ${userId}`);
    
    let recoveredCount = 0;
    
    // Process each campaign
    for (const campaign of activeCampaigns) {
      const campaignQueue = new CampaignQueue(campaign.id);
      await campaignQueue.loadFromRedis();
      
      // Check if campaign has messages in queue
      if (campaignQueue.queue.length > 0) {
        // For rate limited campaigns, check if limit has reset
        if (campaign.status === 'Rate Limited') {
          const today = new Date().toISOString().split('T')[0];
          const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
          const dailyUsage = await redis.get(dailyLimitKey);
          const dailyUsageStr = typeof dailyUsage === 'string' ? dailyUsage : JSON.stringify(dailyUsage);
          
          if (!dailyUsageStr || parseInt(dailyUsageStr) < DAILY_MESSAGE_LIMIT) {
            // Rate limit has reset, resume campaign
            campaignQueue.status = 'Running';
            await campaignQueue.saveToRedis();
            
            await prisma.message.update({
              where: { id: campaign.id },
              data: { status: 'In Progress' }
            });
            
            // Use the API route to resume processing
            await fetch(`${process.env.NEXTAUTH_URL}/api/send-DM`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'resume',
                campaignId: campaign.id
              }),
            });
            
            recoveredCount++;
          }
        } 
        // For in progress campaigns that aren't running, restart them
        else if (campaign.status === 'In Progress' && campaignQueue.status !== 'Running') {
          campaignQueue.status = 'Running';
          await campaignQueue.saveToRedis();
          
          // Use the API route to resume processing
          await fetch(`${process.env.NEXTAUTH_URL}/api/send-DM`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'resume',
              campaignId: campaign.id
            }),
          });
          
          recoveredCount++;
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      recovered: recoveredCount,
      total: activeCampaigns.length
    });
  } catch (error) {
    console.error('Error recovering campaigns:', error);
    return NextResponse.json({ 
      error: 'Failed to recover campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 