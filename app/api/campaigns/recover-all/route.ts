import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { getUserDailyMessageLimit } from "@/lib/planLimits";

// This is a simplified version of the CampaignQueue class
// You should extract this to a shared file to avoid duplication
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

  async process() {
    // This is just a stub - the actual implementation is in send-DM.js
    // We'll use fetch to call the actual processing endpoint
    try {
      await fetch(`/api/send-DM`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resume',
          campaignId: this.campaignId
        }),
      });
    } catch (error) {
      console.error(`Error processing campaign ${this.campaignId}:`, error);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    // Find all campaigns for this user that should be running
    const activeCampaigns = await prisma.message.findMany({
      where: {
        userId: userId,
        status: {
          in: ['In Progress', 'Rate Limited', 'Paused']
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
          
          // Get user's plan type and calculate their limit
          const userCredits = await prisma.userCredits.findUnique({
            where: { userId }
          });
          
          // Use the centralized utility function to get the limit
          const userLimit = getUserDailyMessageLimit(userCredits);
          
          if (!dailyUsageStr || parseInt(dailyUsageStr) < userLimit) {
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
        // For paused campaigns, resume them
        else if (campaign.status === 'Paused') {
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