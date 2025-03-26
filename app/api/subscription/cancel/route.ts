import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

const LEMON_SQUEEZY_API_KEY = process.env.LEMON_SQUEEZY_API_KEY as string;

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { subscriptionId, isUpgrade = false } = body;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has the subscription
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId: user.id },
    });

    if (!userCredits || userCredits.subscriptionId !== subscriptionId) {
      return NextResponse.json({ 
        error: 'Subscription not found for this user' 
      }, { status: 404 });
    }

    console.log(`Cancelling subscription ${subscriptionId} for user ${user.id}, as part of upgrade: ${isUpgrade}`);

    // Make request to LemonSqueezy API to cancel the subscription
    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${LEMON_SQUEEZY_API_KEY}`
      },
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: subscriptionId,
          attributes: {
            cancelled: true
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error cancelling subscription:', errorData);
      return NextResponse.json({ 
        error: 'Failed to cancel subscription', 
        details: errorData 
      }, { status: response.status });
    }

    // If this is part of an upgrade, don't update the database as the webhook will handle it
    // This prevents the user from losing credits during the upgrade process
    if (!isUpgrade) {
      // Update user credits to mark subscription as cancelled
      await prisma.userCredits.update({
        where: { userId: user.id },
        data: {
          isMonthly: false,
          isTrialActive: false,
          // Don't reset subscriptionId or leadCredits here - the webhook will handle that
          // This allows the user to keep using their credits until the grace period expires
          updatedAt: new Date()
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription cancelled successfully',
      isUpgrade
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
