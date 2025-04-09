import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { formatSubscriptionId } from "@/lib/subscription-utils";

// Define the plan IDs and their corresponding lead credits
const PLAN_CREDITS = {
  "714799": 25000,  // Starter plan
  "726375": 75000,  // Growth plan - 25000 × 3 accounts
  "726377": 125000  // Elite plan - 25000 × 5 accounts
};

// Define the plan types
const PLAN_TYPES = {
  "714799": "Starter",
  "726375": "Growth",
  "726377": "Elite"
};

export async function POST(request: Request) {
  try {
    // Get the raw request body
    const rawBody = await request.text();
    
    // Get the signature from the headers
    const signature = request.headers.get('x-signature');
    
    // Verify the webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const eventName = payload.meta.event_name;
    
    // Log the incoming webhook
    console.log(`Received webhook: ${eventName}`, {
      event: eventName,
      id: payload.data?.id,
      attributes: {
        status: payload.data?.attributes?.status,
        variantId: payload.data?.attributes?.variant_id,
        isRenewal: payload.meta?.custom_data?.is_renewal,
        eventType: payload.meta?.custom_data?.event_type,
        renewsAt: payload.data?.attributes?.renews_at,
      }
    });
    
    // Check if this is specifically a subscription renewal event
    const isRenewal = isSubscriptionRenewal(payload);
    if (isRenewal) {
      console.log('Subscription renewal detected! Processing...');
      // Process renewal as subscription update
      await handleSubscriptionUpdated(payload);
      return NextResponse.json({ success: true, message: 'Renewal processed' });
    }
    
    // Handle different webhook events
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(payload);
        break;
      case 'subscription_created':
        await handleSubscriptionCreated(payload);
        break;
      case 'subscription_updated':
        await handleSubscriptionUpdated(payload);
        break;
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(payload);
        break;
      case 'subscription_resumed':
        // Handle resumed subscriptions like updates
        await handleSubscriptionUpdated(payload);
        break;
      case 'subscription_expired':
        // Handle expired as cancelled but with no grace period
        await handleSubscriptionCancelled(payload);
        break;
      case 'subscription_payment_success':
        // This might be a renewal payment - process as update
        await handleSubscriptionUpdated({
          ...payload,
          meta: {
            ...payload.meta,
            custom_data: {
              ...payload.meta.custom_data,
              is_renewal: true
            }
          }
        });
        break;
      default:
        console.log(`Unhandled event: ${eventName}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Verify the webhook signature
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    return false;
  }
  
  try {
    const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET);
    const digest = hmac.update(payload).digest('hex');
    
    return crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(digest)),
      new Uint8Array(Buffer.from(signature))
    );
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

// Handle order_created event
async function handleOrderCreated(payload: any) {
  const { data, meta } = payload;
  const orderId = data.id;
  const orderData = data.attributes;
  
  // Check if custom data with user_id is available
  const customUserId = meta?.custom_data?.user_id;
  
  // Get the customer email from the order
  const customerEmail = orderData.user_email;
  
  // Find the user by custom user ID first, then fall back to email
  let user = null;
  
  if (customUserId) {
    user = await prisma.user.findUnique({
      where: { id: customUserId }
    });
  }
  
  // If user not found by custom ID, try to find by email
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: customerEmail }
    });
  }
  
  if (!user) {
    console.error(`User not found. Email: ${customerEmail}, Custom ID: ${customUserId}`);
    return;
  }
  
  // Get the first order item
  const firstOrderItem = orderData.first_order_item;
  
  if (!firstOrderItem) {
    console.error('No first order item found in payload');
    return;
  }
  
  // Get the variant ID
  const variantId = firstOrderItem.variant_id.toString();
  
  // For fixed-quantity plans, override with the correct value
  let finalQuantity = 1;
  if (variantId === "726375") { // Growth plan
    finalQuantity = 3;
  } else if (variantId === "726377") { // Elite plan
    finalQuantity = 5;
  }
  
  console.log(`Processing order with variantId: ${variantId}, final quantity: ${finalQuantity}`);
  
  // Get the plan type
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Only update the orderId in userCredits
  // Let the subscription webhook handle the credit updates
  try {
    const existingCredits = await prisma.userCredits.findUnique({
      where: { userId: user.id }
    });
    
    if (existingCredits) {
      await prisma.userCredits.update({
        where: { userId: user.id },
        data: {
          orderId,
          updatedAt: new Date()
        }
      });
    } else {
      // If no credits record exists yet, create a minimal one
      await prisma.userCredits.create({
        data: {
          userId: user.id,
          orderId,
          leadCredits: 0,
          planType,
          quantity: finalQuantity,
          isMonthly: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    console.log(`Updated order ID for user ${user.id} to ${orderId}`);
  } catch (error) {
    console.error('Error updating order ID:', error);
  }
}

// Handle subscription_created event
async function handleSubscriptionCreated(payload: any) {
  const { data, meta } = payload;
  const subscriptionId = data.id.toString();
  const subscriptionData = data.attributes;
  
  console.log(`Processing new subscription ${subscriptionId} with status ${subscriptionData.status}`);
  
  // Check subscription status first
  const status = subscriptionData.status;
  if (status !== 'active') {
    console.log(`New subscription ${subscriptionId} is not active (status: ${status}). Waiting for activation before proceeding.`);
    return;
  }

  // Check if custom data with user_id is available
  const customUserId = meta?.custom_data?.user_id;
  
  // Get the customer email from the subscription
  const customerEmail = subscriptionData.user_email;
  
  // Find the user by custom user ID first, then fall back to email
  let user = null;
  
  if (customUserId) {
    user = await prisma.user.findUnique({
      where: { id: customUserId }
    });
  }
  
  // If user not found by custom ID, try to find by email
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: customerEmail }
    });
  }
  
  if (!user) {
    console.error(`User not found. Email: ${customerEmail}, Custom ID: ${customUserId}`);
    return;
  }

  // Get the variant ID from the subscription
  const variantId = subscriptionData.variant_id.toString();
  
  // For fixed-quantity plans, override with the correct value
  let finalQuantity = 1;
  if (variantId === "726375") { // Growth plan
    finalQuantity = 3;
  } else if (variantId === "726377") { // Elite plan
    finalQuantity = 5;
  }

  // Get the plan type and base credits
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;

  // Check for existing subscription and credits
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });

  // Determine if this is an upgrade/plan change
  const isUpgrade = existingCredits?.planType !== planType && existingCredits?.planType !== null;
  const isNewSubscription = !existingCredits?.subscriptionId || existingCredits.subscriptionId === null;

  // Always use the base credits for the new plan - don't add to existing credits
  // This fixes the credit doubling issues
  let finalCredits = baseLeadCredits;
  
  console.log(`Setting credits for new subscription: ${baseLeadCredits} (not adding to existing)`);

  console.log(`Final credit calculation for new subscription: `, {
    planType,
    baseCredits: baseLeadCredits,
    existingCredits: existingCredits?.leadCredits || 0,
    finalCredits,
    previousSubscriptionId: existingCredits?.subscriptionId,
    newSubscriptionId: subscriptionId,
    isUpgrade,
    isNewSubscription
  });

  // Extract URLs from the subscription data
  const urls = subscriptionData.urls || {};
  const customerPortalUrl = urls.customer_portal || null;
  const updatePaymentMethodUrl = urls.update_payment_method || null;

  // First update the user credits with the new subscription
  const updatedCredits = await prisma.userCredits.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      subscriptionId: subscriptionId.toString(),
      leadCredits: finalCredits,
      planType,
      quantity: finalQuantity,
      customerPortalUrl,
      updatePaymentMethodUrl,
      isMonthly: true, // Always true for new active subscriptions
      createdAt: new Date(),
      updatedAt: new Date()
    },
    update: {
      subscriptionId: subscriptionId.toString(),
      leadCredits: finalCredits,
      planType,
      quantity: finalQuantity,
      customerPortalUrl,
      updatePaymentMethodUrl,
      isMonthly: true, // Always true for new active subscriptions
      updatedAt: new Date()
    }
  });

  // Now that the new subscription is confirmed active and credits are updated,
  // we can safely cancel the old subscription if it exists
  if (existingCredits?.subscriptionId && existingCredits.subscriptionId !== subscriptionId) {
    try {
      const LEMON_SQUEEZY_API_KEY = process.env.LEMON_SQUEEZY_API_KEY;
      
      console.log(`Attempting to cancel previous subscription ${existingCredits.subscriptionId}`);
      
      // Try to cancel the old subscription
      const cancelResponse = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${existingCredits.subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${LEMON_SQUEEZY_API_KEY}`
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: existingCredits.subscriptionId,
            attributes: {
              cancelled: true
            }
          }
        })
      });

      if (!cancelResponse.ok) {
        console.error(`Failed to cancel previous subscription: ${existingCredits.subscriptionId}`);
        const errorData = await cancelResponse.json();
        console.error('Error details:', errorData);
      } else {
        console.log(`Successfully cancelled previous subscription ${existingCredits.subscriptionId}`);
      }
    } catch (error) {
      console.error(`Error handling previous subscription:`, error);
    }
  }

  // Log the final status
  console.log(`Updated subscription for user ${user.id}:`, {
    planType,
    finalCredits,
    finalQuantity,
    previousCredits: existingCredits?.leadCredits || 0,
    newSubscriptionId: subscriptionId,
    oldSubscriptionId: existingCredits?.subscriptionId
  });

  return updatedCredits;
}

// Helper function to determine if this is an upgrade
function determineIfUpgrade(currentPlanType: string | null, newPlanType: string): boolean {
  if (!currentPlanType) return true;

  const planValues = {
    "Starter": 1,
    "Growth": 2,
    "Elite": 3
  };

  const currentValue = planValues[currentPlanType as keyof typeof planValues] || 0;
  const newValue = planValues[newPlanType as keyof typeof planValues] || 0;

  // Added logging to help debug
  console.log(`Plan comparison: ${currentPlanType}(${currentValue}) -> ${newPlanType}(${newValue})`);

  return newValue >= currentValue; // Changed to >= to ensure same plan is considered an upgrade
}

// Add this function to detect subscription renewals
function isSubscriptionRenewal(payload: any): boolean {
  const { data, meta } = payload;
  const eventName = meta.event_name;
  const subscriptionData = data.attributes;
  
  // Check if this is a subscription_updated event for an active subscription
  if (eventName === 'subscription_updated' && subscriptionData.status === 'active') {
    // A renewal occurs when the renews_at date is updated
    // We can also look at the meta.event_name for specific renewal events
    const isRenewalEvent = meta.custom_data?.is_renewal === true || 
                          meta.custom_data?.event_type === 'renewal';
    
    return isRenewalEvent;
  }
  
  return false;
}

// Handle subscription_updated event
async function handleSubscriptionUpdated(payload: any) {
  const { data, meta } = payload;
  const subscriptionId = data.id.toString();
  const subscriptionData = data.attributes;
  
  console.log(`Processing subscription update for user ${meta?.custom_data?.user_id}: `, {
    subscriptionId,
    status: subscriptionData.status,
    variantId: subscriptionData.variant_id
  });
  
  // Check if this is a renewal event
  const isRenewal = isSubscriptionRenewal(payload);
  if (isRenewal) {
    console.log(`Detected subscription renewal for subscription ${subscriptionId}`);
  }
  
  // Check if custom data with user_id is available
  const customUserId = meta?.custom_data?.user_id;
  
  // Get the customer email from the subscription
  const customerEmail = subscriptionData.user_email;
  
  // Find the user by custom user ID first, then fall back to email
  let user = null;
  
  if (customUserId) {
    user = await prisma.user.findUnique({
      where: { id: customUserId }
    });
  }
  
  // If user not found by custom ID, try to find by email
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: customerEmail }
    });
  }
  
  if (!user) {
    console.error(`User not found. Email: ${customerEmail}, Custom ID: ${customUserId}`);
    return;
  }
  
  // Get the variant ID from the subscription
  const variantId = subscriptionData.variant_id.toString();
  
  // Check subscription status
  const status = subscriptionData.status;
  const isCancelled = status === 'cancelled';
  const isMonthly = status === 'active';
  const isPastDue = status === 'past_due';
  const isExpired = status === 'expired';
  
  // Get the plan type
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Get existing record first
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  // IMPORTANT: We need to determine if this is a reprocessing of the same subscription
  // If the subscriptionId matches our existing record, don't add credits again
  const isExistingSubscription = existingCredits?.subscriptionId === subscriptionId;
  
  // If this is a cancelled subscription, check if user has any other active subscriptions 
  // before proceeding with the cancellation logic
  if (isCancelled) {
    const otherActiveSubscription = await prisma.userCredits.findFirst({
      where: {
        userId: user.id,
        AND: [
          { subscriptionId: { not: subscriptionId } },
          { subscriptionId: { not: null } }
        ],
        isMonthly: true
      }
    });
    
    if (otherActiveSubscription) {
      console.log(`User ${user.id} has another active subscription (${otherActiveSubscription.subscriptionId}). Not updating subscription status for cancelled subscription ${subscriptionId}.`);
      return; // Skip further processing as there's an active subscription
    }
  }
  
  // Calculate lead credits based on plan type and status
  let leadCredits = 0;
  
  if (isPastDue || isExpired) {
    // For past due or expired subscriptions, zero out credits
    leadCredits = 0;
    console.log(`Subscription is ${status}, setting credits to 0`);
  } else if (isCancelled) {
    // For cancelled subscriptions, simply maintain existing credits (don't add new ones)
    leadCredits = existingCredits?.leadCredits || 0;
    console.log(`Subscription cancelled: maintaining existing credits ${leadCredits}`);
  } else if (isMonthly) {
    // For active subscriptions
    const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
    
    // Check if this is a brand new subscription (no subscription ID in existing credits)
    const isNewSubscription = !existingCredits?.subscriptionId;
    
    // Look for upgrade scenario - when changing from one plan to another
    const isPlanChange = existingCredits?.planType !== planType && existingCredits?.planType !== null;
    
    // Check if the plan has been updated outside of the webhook
    // If the planType matches but it's not from a renewal
    const isPlanAlreadyUpdated = existingCredits?.planType === planType && !isRenewal && !isNewSubscription;
    
    if (isRenewal && isExistingSubscription) {
      // For subscription renewals, reset credits to monthly base amount instead of adding
      leadCredits = baseLeadCredits;
      console.log(`Monthly renewal detected! Resetting credits to ${baseLeadCredits} (not adding to existing ${existingCredits?.leadCredits || 0})`);
    } else if (isExistingSubscription && isPlanAlreadyUpdated) {
      // If this is a reprocessing of a plan change that was already processed by the API,
      // just keep existing credits to prevent double-counting
      leadCredits = existingCredits?.leadCredits || baseLeadCredits;
      console.log(`Plan already updated via API for subscription ${subscriptionId}, keeping existing credits: ${leadCredits}`);
    } else if (isExistingSubscription) {
      // If this is a reprocessing of the same subscription, don't double-count
      leadCredits = existingCredits?.leadCredits || baseLeadCredits;
      console.log(`Reprocessing same subscription ${subscriptionId}, keeping existing credits: ${leadCredits}`);
    } else if (isNewSubscription) {
      // If this is the first subscription, just use base credits
      leadCredits = baseLeadCredits;
      console.log(`New subscription (first time), setting base credits: ${baseLeadCredits}`);
    } else if (isPlanChange) {
      // For plan changes (upgrades/downgrades), set credits to just the new plan amount - not additive
      leadCredits = baseLeadCredits;
      console.log(`Plan change detected from ${existingCredits?.planType} to ${planType}. Setting to new plan credits: ${baseLeadCredits} (not adding to existing ${existingCredits?.leadCredits || 0})`);
    } else {
      // No existing credits
      leadCredits = baseLeadCredits;
      console.log(`No existing credits, setting base credits: ${baseLeadCredits}`);
    }
  }
  
  console.log(`Final credit calculation for ${planType}: `, {
    planType,
    baseCredits: PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0,
    existingCredits: existingCredits?.leadCredits || 0,
    finalCredits: leadCredits,
    status,
    isMonthly,
    isCancelled,
    isExistingSubscription
  });
  
  // Extract URLs from the subscription data
  const urls = subscriptionData.urls || {};
  const customerPortalUrl = urls.customer_portal || null;
  const updatePaymentMethodUrl = urls.update_payment_method || null;
  
  try {
    // Set the appropriate quantity based on plan type
    let finalQuantity = 1;
    if (planType === "Growth") {
      finalQuantity = 3;
    } else if (planType === "Elite") {
      finalQuantity = 5;
    }
    
    // Update user credits
    await prisma.userCredits.upsert({
      where: { userId: user.id },
      update: {
        leadCredits,
        planType,
        subscriptionId: isMonthly ? subscriptionId.toString() : existingCredits?.subscriptionId, // Only update if active
        quantity: finalQuantity,
        isMonthly, // This will be true for active subscriptions, false for cancelled
        updatedAt: new Date(),
        customerPortalUrl,
        updatePaymentMethodUrl
      },
      create: {
        userId: user.id,
        leadCredits,
        planType,
        subscriptionId: isMonthly ? subscriptionId.toString() : null, // Only set if active
        quantity: finalQuantity,
        isMonthly,
        createdAt: new Date(),
        updatedAt: new Date(),
        customerPortalUrl,
        updatePaymentMethodUrl
      }
    });
    
    // If this subscription is active, ensure all other subscriptions are marked as inactive
    if (isMonthly) {
      await prisma.userCredits.updateMany({
        where: {
          userId: user.id,
          AND: [
            { subscriptionId: { not: subscriptionId } }
          ]
        },
        data: {
          isMonthly: false
        }
      });
    }
    
    console.log(`Successfully updated subscription for user ${user.id}: `, {
      planType,
      baseCredits: PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0,
      existingCredits: existingCredits?.leadCredits || 0,
      finalCredits: leadCredits,
      finalQuantity,
      isMonthly,
      status
    });
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_cancelled event
async function handleSubscriptionCancelled(payload: any) {
  const { data, meta } = payload;
  const subscriptionId = data.id.toString();
  const subscriptionData = data.attributes;
  
  // Check if custom data with user_id is available
  const customUserId = meta?.custom_data?.user_id;
  
  // Get the customer email from the subscription
  const customerEmail = subscriptionData.user_email;
  
  // Find the user by custom user ID first, then fall back to email
  let user = null;
  
  if (customUserId) {
    user = await prisma.user.findUnique({
      where: { id: customUserId }
    });
  }
  
  // If user not found by custom ID, try to find by email
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: customerEmail }
    });
  }
  
  if (!user) {
    console.error(`User not found. Email: ${customerEmail}, Custom ID: ${customUserId}`);
    return;
  }
  
  try {
    // Get the user's current credits
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId: user.id }
    });
    
    console.log(`Cancelling subscription for user ${user.id}`);
    
    // Simply keep the existing credits without any logic - don't add or adjust them
    // This fixes credit duplication issues
    const currentCredits = userCredits?.leadCredits || 0;
    
    console.log(`Cancellation: Keeping existing credits: ${currentCredits} (no adjustments)`);
    
    // Calculate the grace period for reference only (not used in credit calculations)
    const currentRenewalDate = new Date(userCredits?.updatedAt ?? userCredits?.createdAt ?? new Date());
    const nextRenewalDate = new Date(currentRenewalDate);
    nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    
    const today = new Date();
    const daysUntilNextRenewal = Math.ceil((nextRenewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`Current renewal period started: ${currentRenewalDate}`);
    console.log(`Next renewal would have been: ${nextRenewalDate}`);
    console.log(`Grace period (days until next renewal): ${daysUntilNextRenewal}`);
    
    // IMPORTANT: Check for other active subscriptions before updating
    // Find if the user has any other active subscriptions
    const otherActiveSubscription = await prisma.userCredits.findFirst({
      where: {
        userId: user.id,
        AND: [
          { subscriptionId: { not: subscriptionId } },
          { subscriptionId: { not: null } }
        ],
        isMonthly: true
      }
    });
    
    if (otherActiveSubscription) {
      console.log(`User ${user.id} has another active subscription. Not updating subscription status.`);
      
      // Only update this specific subscription record if needed
      if (userCredits && userCredits.subscriptionId === subscriptionId) {
        await prisma.userCredits.update({
          where: { userId: user.id },
          data: {
            subscriptionId: null
            // Do NOT change isMonthly or leadCredits as user has another active subscription
          }
        });
      }
    } else {
      // Add a safety check to make sure we're not storing a timestamp in the subscription ID
      if (userCredits && userCredits.subscriptionId === subscriptionId) {
        // Update user credits - simply set the subscription to inactive, keep credits unchanged
        await prisma.userCredits.update({
          where: { userId: user.id },
          data: {
            subscriptionId: null,
            isMonthly: false
            // No changes to leadCredits - keeps whatever is currently in the database
            // Important: We don't update the updatedAt timestamp for cancellations
            // This preserves the original renewal date for grace period calculations
          }
        });
      } else {
        console.log(`Subscription ID mismatch during cancellation: Expected ${subscriptionId}, found ${userCredits?.subscriptionId}`);
      }
      
      console.log(`Regular subscription cancelled for user ${user.id}. Campaigns will continue during the grace period until ${nextRenewalDate}.`);
    }
    
    console.log(`Successfully handled cancellation event for user ${user.id}. Credits maintained at ${currentCredits} until next renewal date: ${nextRenewalDate}`);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
  }
} 