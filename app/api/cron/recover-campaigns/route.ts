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
    // Verify this is a legitimate cron request (add authentication as needed)
    const { searchParams } = new URL(request.url);
    const authToken = searchParams.get('token');
    
    if (authToken !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Find only campaigns that should be running (exclude Paused)
    const activeCampaigns = await prisma.message.findMany({
      where: {
        status: {
          in: ['In Progress', 'Rate Limited']
        }
      }
    });
    
    console.log(`Found ${activeCampaigns.length} campaigns to recover`);
    
    let recoveredCount = 0;
    
    // Process each campaign
    for (const campaign of activeCampaigns) {
      const campaignQueue = new CampaignQueue(campaign.id);
      await campaignQueue.loadFromRedis();
      
      // Check if campaign is actually running in Redis and has messages in queue
      if (campaignQueue.queue.length > 0) {
        if (campaign.status === 'Rate Limited') {
          // Check if rate limit has reset
          const userId = campaign.userId;
          if (userId) {
            const today = new Date().toISOString().split('T')[0];
            const dailyLimitKey = `user:${userId}:daily_messages:${today}`;
            const dailyUsage = await redis.get(dailyLimitKey);
            const dailyUsageStr = typeof dailyUsage === 'string' ? dailyUsage : JSON.stringify(dailyUsage);
            
            if (!dailyUsageStr || parseInt(dailyUsageStr) < DAILY_MESSAGE_LIMIT) {
              console.log(`Rate limit reset detected for campaign ${campaign.id}, resuming`);
              campaignQueue.status = 'Running';
              await campaignQueue.saveToRedis();
              
              await prisma.message.update({
                where: { id: campaign.id },
                data: { status: 'In Progress' }
              });
              
              // Start processing by calling the send-DM API
              try {
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
              } catch (error) {
                console.error(`Error resuming campaign ${campaign.id}:`, error);
              }
            }
          }
        } else if (campaign.status === 'In Progress' && campaignQueue.status !== 'Running') {
          // Resume campaign that should be running but isn't
          console.log(`Recovering interrupted campaign ${campaign.id}`);
          campaignQueue.status = 'Running';
          await campaignQueue.saveToRedis();
          
          // Start processing by calling the send-DM API
          try {
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
          } catch (error) {
            console.error(`Error resuming campaign ${campaign.id}:`, error);
          }
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