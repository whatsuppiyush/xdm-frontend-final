import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    // Verify the request is from a cron job using a secret header
    const authHeader = request.headers.get('x-cron-secret');
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle regular subscription cancellations (billing cycle-based grace period)
    // Get current date for comparison
    const currentDate = new Date();

    console.log(`Checking for regular subscriptions with expired billing cycles`);

    const expiredSubscriptions = await prisma.userCredits.findMany({
      where: {
        isMonthly: false, // Not active subscription
        leadCredits: { gt: 0 }, // Still has credits
        subscriptionId: null, // Make sure it's a cancelled subscription
      }
    });

    console.log(`Found ${expiredSubscriptions.length} cancelled regular subscriptions to check`);

    // Reset credits for expired regular subscriptions and store user IDs
    const expiredUserIds = [];
    for (const subscription of expiredSubscriptions) {
      // Calculate when the next renewal would have been (1 month after last renewal)
      const lastRenewalDate = new Date(subscription.updatedAt || subscription.createdAt);
      const nextRenewalDate = new Date(lastRenewalDate);
      nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
      
      // Only process if the grace period has expired (current date is after next renewal date)
      if (currentDate > nextRenewalDate) {
        expiredUserIds.push(subscription.userId);
        
        // Log details about each expired subscription
        console.log(`Processing expired regular subscription for user: ${subscription.userId}`);
        console.log(`- Plan Type: ${subscription.planType}`);
        console.log(`- Lead Credits: ${subscription.leadCredits}`);
        console.log(`- Last Renewal: ${lastRenewalDate}`);
        console.log(`- Grace Period End Date: ${nextRenewalDate}`);
        console.log(`- Days Since Grace Period Expired: ${Math.floor((currentDate.getTime() - nextRenewalDate.getTime()) / (1000 * 60 * 60 * 24))}`);
        
        // Reset credits to zero
        await prisma.userCredits.update({
          where: { userId: subscription.userId },
          data: {
            leadCredits: 0,
            updatedAt: new Date()
          }
        });
        
        console.log(`Billing cycle grace period expired: Reset credits to 0 for user: ${subscription.userId}`);
      } else {
        // Calculate days remaining in grace period
        const daysRemaining = Math.ceil((nextRenewalDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`User ${subscription.userId} still has ${daysRemaining} days remaining in grace period. Next renewal would have been: ${nextRenewalDate}`);
      }
    }

    // Stop campaigns for expired regular subscriptions
    if (expiredUserIds.length > 0) {
      const stoppedExpiredCampaigns = await prisma.message.updateMany({
        where: {
          userId: { in: expiredUserIds },
          status: { in: ['Active', 'Paused', 'Rate Limited'] }
        },
        data: {
          status: 'Stopped'
        }
      });
      
      console.log(`Stopped ${stoppedExpiredCampaigns.count} campaigns for ${expiredUserIds.length} users with expired grace periods`);
    }

    return NextResponse.json({
      success: true,
      processedRegularSubscriptions: {
        count: expiredUserIds.length,
        details: expiredSubscriptions.map(sub => ({
          userId: sub.userId,
          planType: sub.planType,
          leadCredits: sub.leadCredits,
          lastRenewalDate: sub.updatedAt,
          originalCreationDate: sub.createdAt,
          daysSinceLastRenewal: Math.floor((new Date().getTime() - new Date(sub.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        })),
        stoppedCampaigns: expiredUserIds.length > 0
      },
      totalProcessedUsers: expiredUserIds.length
    });
  } catch (error) {
    console.error('Error processing cancelled subscriptions:', error);
    return NextResponse.json({ error: 'Failed to process cancelled subscriptions' }, { status: 500 });
  }
} 