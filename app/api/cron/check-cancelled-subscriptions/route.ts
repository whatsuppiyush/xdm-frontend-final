import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    // Verify the request is from a cron job using a secret header
    const authHeader = request.headers.get('x-cron-secret');
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all cancelled subscriptions that still have credits
    // and were CREATED more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`Checking for subscriptions created before: ${thirtyDaysAgo.toISOString()}`);

    const expiredSubscriptions = await prisma.userCredits.findMany({
      where: {
        isMonthly: false, // Not active subscription
        isTrialActive: false, // Not a trial
        leadCredits: { gt: 0 }, // Still has credits
        createdAt: {
          lt: thirtyDaysAgo // Created more than 30 days ago
        }
      }
    });

    console.log(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

    // Log details about each expired subscription
    expiredSubscriptions.forEach((sub, index) => {
      console.log(`Subscription ${index + 1}:`);
      console.log(`- User ID: ${sub.userId}`);
      console.log(`- Plan Type: ${sub.planType}`);
      console.log(`- Lead Credits: ${sub.leadCredits}`);
      console.log(`- Created At: ${sub.createdAt}`);
      console.log(`- Days since creation: ${Math.floor((new Date().getTime() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24))}`);
    });

    // Reset credits for all expired subscriptions
    const updates = await Promise.all(
      expiredSubscriptions.map(subscription =>
        prisma.userCredits.update({
          where: { userId: subscription.userId },
          data: {
            leadCredits: 0,
            updatedAt: new Date()
          }
        })
      )
    );

    console.log(`Successfully processed ${updates.length} expired subscriptions`);

    return NextResponse.json({
      success: true,
      processedCount: updates.length,
      expiredSubscriptions: expiredSubscriptions.map(sub => ({
        userId: sub.userId,
        planType: sub.planType,
        leadCredits: sub.leadCredits,
        createdAt: sub.createdAt,
        daysSinceCreation: Math.floor((new Date().getTime() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      }))
    });
  } catch (error) {
    console.error('Error processing cancelled subscriptions:', error);
    return NextResponse.json({ error: 'Failed to process cancelled subscriptions' }, { status: 500 });
  }
} 