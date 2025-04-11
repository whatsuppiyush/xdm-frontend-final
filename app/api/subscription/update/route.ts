import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

const LEMON_SQUEEZY_API_KEY = process.env.LEMON_SQUEEZY_API_KEY;

// Define your product IDs in Lemon Squeezy
const PRODUCT_ID = "64698"; // The main product ID for all variants

// Define variant IDs from LemonSqueezy
const VARIANT_IDS = {
  STARTER: "757154", // Starter plan
  GROWTH: "757156",  // Growth plan (fixed quantity: 3 accounts)
  ELITE: "757158"    // Elite plan (fixed quantity: 5 accounts)
};

// Define plan types
const PLAN_TYPES = {
  "757154": "Starter",
  "757156": "Growth",
  "757158": "Elite"
};

// Define lead credits for each plan
const PLAN_CREDITS = {
  "757154": 25000,  // Starter plan
  "757156": 75000,  // Growth plan (25000 × 3 accounts)
  "757158": 125000  // Elite plan (25000 × 5 accounts)
};

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { subscriptionId, newPlanId, disableProrations = false, invoiceImmediately = false } = body;

    if (!subscriptionId || !newPlanId) {
      return NextResponse.json({ error: 'Subscription ID and new plan ID are required' }, { status: 400 });
    }

    // Ensure subscription ID is a string
    const safeSubscriptionId = subscriptionId.toString();

    // Get user from session
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user credits to check if the subscription belongs to this user
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId: user.id }
    });

    if (!userCredits || userCredits.subscriptionId !== safeSubscriptionId) {
      return NextResponse.json({ error: 'Subscription not found or does not belong to this user' }, { status: 404 });
    }

    // Determine if this is an upgrade or downgrade
    const currentPlanId = userCredits.planType;
    const newPlanType = PLAN_TYPES[newPlanId as keyof typeof PLAN_TYPES];
    const isUpgrade = determineIfUpgrade(currentPlanId, newPlanType);

    // IMPORTANT: For upgrades, force immediate invoicing to prevent abuse
    // For downgrades, respect the client preference (typically delayed until next cycle)
    const shouldInvoiceImmediately = isUpgrade ? true : invoiceImmediately;

    console.log(`Updating subscription ${safeSubscriptionId} from ${currentPlanId} to ${newPlanType}`);
    console.log(`This is an ${isUpgrade ? 'upgrade' : 'downgrade'}`);
    console.log(`Invoice immediately: ${shouldInvoiceImmediately}`);

    // Make request to Lemon Squeezy API to update the subscription
    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${safeSubscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${LEMON_SQUEEZY_API_KEY}`
      },
      body: JSON.stringify({
        data: {
          type: "subscriptions",
          id: safeSubscriptionId,
          attributes: {
            product_id: parseInt(PRODUCT_ID, 10),
            variant_id: parseInt(newPlanId, 10),
            disable_prorations: disableProrations,
            invoice_immediately: shouldInvoiceImmediately
          }
        }
      })
    });

    const updateResponse = await response.json();

    if (!response.ok) {
      console.error('Error updating subscription:', updateResponse);

      // Check if this is a PayPal subscription that requires customer portal
      if (updateResponse?.errors?.[0]?.detail?.includes('PayPal')) {
        const customerPortalUrl = userCredits.customerPortalUrl;
        return NextResponse.json({ 
          error: 'PayPal subscription requires customer portal', 
          customerPortalUrl,
          isPayPal: true
        }, { status: 400 });
      }

      return NextResponse.json({ 
        error: 'Failed to update subscription', 
        details: updateResponse 
      }, { status: response.status });
    }

    // IMPORTANT: DON'T update credits here. The webhook handler will take care of this.
    // This prevents double counting of credits when both routes modify the credits.
    console.log(`Subscription update successful for user ${user.id}. Credit updates will be handled by webhook.`);

    // Determine new quantity based on plan
    let newQuantity = 1;
    if (newPlanType === "Growth") {
      newQuantity = 3;
    } else if (newPlanType === "Elite") {
      newQuantity = 5;
    }

    // Update user credits in our database - only update plan type and quantity,
    // but NOT the leadCredits - let the webhook handle that
    const updatedCredits = await prisma.userCredits.update({
      where: { userId: user.id },
      data: {
        planType: newPlanType,
        quantity: newQuantity,
        // URLs might change with an update, so we should get them from the response
        customerPortalUrl: updateResponse?.data?.attributes?.urls?.customer_portal || userCredits.customerPortalUrl,
        updatePaymentMethodUrl: updateResponse?.data?.attributes?.urls?.update_payment_method || userCredits.updatePaymentMethodUrl,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true,
      message: `Successfully updated subscription from ${currentPlanId} to ${newPlanType}`,
      newPlanType,
      currentCredits: userCredits.leadCredits, // Return existing credits, don't modify here
      isUpgrade
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to determine if this is an upgrade or downgrade
function determineIfUpgrade(currentPlanType: string | null, newPlanType: string): boolean {
  if (!currentPlanType) return true; // If no current plan, any new plan is an upgrade

  const planValues = {
    "Starter": 1,
    "Growth": 2,
    "Elite": 3
  };

  const currentValue = planValues[currentPlanType as keyof typeof planValues] || 0;
  const newValue = planValues[newPlanType as keyof typeof planValues] || 0;

  return newValue > currentValue;
}

// Helper function to get the total credits for a plan type
function getPlanTotalCredits(planType: string | null): number {
  switch(planType) {
    case "Starter":
      return 25000;
    case "Growth":
      return 75000;
    case "Elite":
      return 125000;
    default:
      return 0;
  }
} 