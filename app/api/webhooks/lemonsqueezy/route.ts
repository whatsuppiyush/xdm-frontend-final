import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

// Define the plan IDs and their corresponding lead credits
const PLAN_CREDITS = {
  "714800": 25000,  // Starter plan - $87 with 3-day free trial
  "726375": 25000,  // Growth plan - $67 per account (3 accounts)
  "726377": 25000   // Elite plan - $57 per account (5 accounts)
};

// Define the trial credits (limited credits during trial period)
const TRIAL_CREDITS = {
  "714800": 1500,   // Starter plan trial - limited to 1,500 lead credits
};

// Define the plan types
const PLAN_TYPES = {
  "714800": "Starter",
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
  
  // Check if the customer has already had a trial (from custom data)
  const hadTrialFromMeta = meta?.custom_data?.had_trial === "true";
  
  // Extract custom quantity if provided
  const customQuantity = meta?.custom_data?.quantity ? parseInt(meta.custom_data.quantity) : null;
  
  console.log(`Order created with custom data:`, meta?.custom_data);
  console.log(`Had trial from meta: ${hadTrialFromMeta}, Custom quantity: ${customQuantity}`);
  
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
  
  // Check if this user has had a previous trial by checking their userCredits record
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  // Check for any previous subscriptions (excluding this new one)
  const previousSubscriptions = await prisma.userCredits.findMany({
    where: {
      userId: user.id,
      OR: [
        { hadPreviousTrial: true }, // Check if had trial flag is set
        { trialStartDate: { not: null } }, // Check if trial date is set
        { 
          subscriptionId: { 
            not: null,
          },
          AND: {
            subscriptionId: {
              not: orderId.toString()
            }
          }
        } // Check if they had a DIFFERENT subscription
      ]
    }
  });
  
  // Log detailed information
  console.log(`Order: Previous subscriptions query results:`, previousSubscriptions);
  
  // Determine if they've already had a trial based on multiple conditions
  // Be more careful with hadPreviousTrial determination - exclude the current order
  const hadPreviousTrial = hadTrialFromMeta || 
                          (existingCredits?.hadPreviousTrial === true && existingCredits?.trialStartDate !== null) || 
                          previousSubscriptions.length > 0;
  
  console.log(`User had previous trial according to combined checks: ${hadPreviousTrial}`);
  console.log(`Previous subscriptions found count: ${previousSubscriptions.length}`);
  
  // Get the first order item from the first_order_item field
  const firstOrderItem = orderData.first_order_item;
  
  if (!firstOrderItem) {
    console.error('No first order item found in payload');
    return;
  }
  
  // Get the variant ID from the first order item
  const variantId = firstOrderItem.variant_id.toString();
  
  // Use custom quantity from custom_data if available, otherwise from order item
  const quantity = customQuantity || firstOrderItem.quantity || 1;
  
  // For fixed-quantity plans, override with the correct value regardless of order data
  let finalQuantity = quantity;
  if (variantId === "726375") { // Growth plan
    finalQuantity = 3; // Growth plan always has 3 accounts
  } else if (variantId === "726377") { // Elite plan
    finalQuantity = 5; // Elite plan always has 5 accounts
  }
  
  console.log(`Processing order with variantId: ${variantId}, requested quantity: ${quantity}, final quantity: ${finalQuantity}, hadPreviousTrial: ${hadPreviousTrial}`);
  
  // Get the lead credits for this plan
  const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Calculate total lead credits based on the plan type and quantity
  let leadCredits = baseLeadCredits;
  
  // If it's a multi-account plan, multiply by quantity
  if (variantId === "726375" || variantId === "726377") {
    // Calculate total lead credits based on quantity
    leadCredits = baseLeadCredits * finalQuantity;
    console.log(`Multi-account plan detected: ${planType}. Base credits: ${baseLeadCredits}, Quantity: ${finalQuantity}, Total credits: ${leadCredits}`);
  } else {
    console.log(`Standard plan detected: ${planType}. Credits: ${leadCredits}`);
  }
  
  // Check if this is a Starter plan which might be on trial
  const isStarterPlan = variantId === "714800";
  
  // Special case for Growth plan (variant 726375) - 3 accounts
  if (variantId === "726375") {
    leadCredits = 3 * 25000; // Fixed at 3 accounts
  }
  // Special case for Elite plan (variant 726377) - 5 accounts
  else if (variantId === "726377") {
    leadCredits = 5 * 25000; // Fixed at 5 accounts
  }
  // For Starter plan, use the trial credits if it's a trial and not a previous trial user
  else if (isStarterPlan && !hadPreviousTrial) {
    // We'll let the subscription webhook determine if it's actually a trial or not
    leadCredits = baseLeadCredits;
  }
  
  console.log(`Calculated lead credits: ${leadCredits} for plan type ${planType}`);
  
  // Check for existing user credits
  try {
    // If there's an existing subscription, preserve it
    if (existingCredits && existingCredits.subscriptionId) {
      console.log(`User has existing subscription ID: ${existingCredits.subscriptionId}, preserving it`);
      
      // CRITICAL FIX: Don't overwrite trial credits
      // Only update credits if the user doesn't already have trial credits assigned
      if (existingCredits.isTrialActive && existingCredits.leadCredits === TRIAL_CREDITS["714800"]) {
        console.log(`User already has ${existingCredits.leadCredits} trial credits, preserving them`);
      } else {
        // Add existing credits to the new order's credits
        if (existingCredits.leadCredits > 0) {
          // Check if user is upgrading to a new plan
          if (existingCredits.planType !== planType) {
            console.log(`User is upgrading from ${existingCredits.planType} to ${planType} via order`);
            console.log(`Adding remaining credits: ${existingCredits.leadCredits} to new plan credits: ${leadCredits}`);
            leadCredits += existingCredits.leadCredits;
            console.log(`Total credits after upgrade: ${leadCredits}`);
          }
        }
        
        await prisma.userCredits.update({
          where: { userId: user.id },
          data: {
            leadCredits: leadCredits,
            planType,
            orderId,
            quantity: finalQuantity, // Save the quantity from the order
            // Important: Preserve the hadPreviousTrial flag
            hadPreviousTrial: hadPreviousTrial,
            updatedAt: new Date()
            // Note: We don't update subscriptionId to preserve the existing subscription
          }
        });
      }
    } else {
      // No existing subscription, do a regular upsert
      await prisma.userCredits.upsert({
        where: { userId: user.id },
        update: {
          leadCredits: existingCredits && existingCredits.planType !== planType && existingCredits.leadCredits > 0
            ? leadCredits + existingCredits.leadCredits // Add existing credits to new credits when changing plans
            : leadCredits, // Otherwise just use the calculated lead credits
          planType,
          orderId,
          quantity: finalQuantity, // Save the quantity from the order
          // We'll set isTrialActive to false initially, the subscription webhook will update it if needed
          isTrialActive: false,
          trialStartDate: null,
          trialEndDate: null,
          hadPreviousTrial: hadPreviousTrial, // Use our combined flag
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          leadCredits,
          planType,
          orderId,
          quantity: finalQuantity, // Save the quantity from the order
          // We'll set isTrialActive to false initially, the subscription webhook will update it if needed
          isTrialActive: false,
          trialStartDate: null,
          trialEndDate: null,
          hadPreviousTrial: hadPreviousTrial, // Use our combined flag
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // Log if credits were transferred  
      if (existingCredits && existingCredits.planType !== planType && existingCredits.leadCredits > 0) {
        console.log(`Credits transferred: ${existingCredits.leadCredits} credits from ${existingCredits.planType} plan to ${planType} plan, new total: ${leadCredits + existingCredits.leadCredits}`);
      }
    }
    
    console.log(`Successfully updated user credits for user ${user.id} with ${leadCredits} lead credits, plan type ${planType}, and quantity ${finalQuantity}`);
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_created event
async function handleSubscriptionCreated(payload: any) {
  const { data, meta } = payload;
  const subscriptionId = data.id;
  const subscriptionData = data.attributes;
  
  // Check if custom data with user_id is available
  const customUserId = meta?.custom_data?.user_id;
  
  // Check if the customer has already had a trial (from custom data)
  const hadTrialFromMeta = meta?.custom_data?.had_trial === "true";
  
  // Extract custom quantity if provided
  const customQuantity = meta?.custom_data?.quantity ? parseInt(meta.custom_data.quantity) : null;
  
  console.log(`Subscription created with custom data:`, meta?.custom_data);
  console.log(`Had trial from meta: ${hadTrialFromMeta}, Custom quantity: ${customQuantity}`);
  
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
  
  // Use custom quantity from custom_data if available, otherwise from subscription
  const quantity = customQuantity || subscriptionData.quantity || 1;
  
  // For fixed-quantity plans, override with the correct value regardless of subscription data
  let finalQuantity = quantity;
  if (variantId === "726375") { // Growth plan
    finalQuantity = 3; // Growth plan always has 3 accounts
  } else if (variantId === "726377") { // Elite plan
    finalQuantity = 5; // Elite plan always has 5 accounts
  }
  
  console.log(`Processing subscription with variantId: ${variantId}, requested quantity: ${quantity}, final quantity: ${finalQuantity}`);
  
  // Check if this is a trial subscription
  const isOnTrial = subscriptionData.status === 'on_trial';
  const trialEndsAt = subscriptionData.trial_ends_at ? new Date(subscriptionData.trial_ends_at) : null;
  
  // Check if subscription is active (monthly)
  const isMonthly = subscriptionData.status === 'active';
  
  console.log(`Subscription status: ${subscriptionData.status}, Is on trial: ${isOnTrial}, Is monthly: ${isMonthly}`);
  if (trialEndsAt) {
    console.log(`Trial ends at: ${trialEndsAt.toISOString()}`);
  }
  
  // Get the lead credits for this plan
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Check if user has had a previous trial by checking their userCredits record
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  // Additional safety check: Query for ANY previous subscriptions for this user
  const previousSubscriptions = await prisma.userCredits.findMany({
    where: {
      userId: user.id,
      OR: [
        { hadPreviousTrial: true }, // Check if had trial flag is set
        { trialStartDate: { not: null } }, // Check if trial date is set
        { 
          subscriptionId: { 
            not: null,
          },
          AND: {
            subscriptionId: {
              not: subscriptionId.toString()
            }
          }
        } // Check if they had a DIFFERENT subscription
      ]
    }
  });
  
  // Log more detailed information for debugging
  console.log(`Previous subscriptions query results:`, previousSubscriptions);
  console.log(`User ID: ${user.id}, Subscription ID: ${subscriptionId.toString()}`);
  
  // Determine if they've already had a trial based on multiple conditions
  // Be more cautious with hadPreviousTrial determination
  const hadPreviousTrial = hadTrialFromMeta || 
                        (existingCredits?.hadPreviousTrial === true && existingCredits?.trialStartDate !== null) || 
                        previousSubscriptions.length > 0; 
  
  console.log(`User had previous trial based on combined checks: ${hadPreviousTrial}`);
  console.log(`Previous subscriptions found count: ${previousSubscriptions.length}`);

  // Special handling for new trials on Starter plan
  if (isOnTrial && variantId === "714800") {
    console.log('User is on trial, checking if this is first time:');
    console.log(`- hadTrialFromMeta: ${hadTrialFromMeta}`);
    console.log(`- existingCredits: ${Boolean(existingCredits)}`);
    if (existingCredits) {
      console.log(`  - hadPreviousTrial: ${existingCredits.hadPreviousTrial}`);
      console.log(`  - trialStartDate: ${existingCredits.trialStartDate}`);
      console.log(`  - subscriptionId: ${existingCredits.subscriptionId}`);
      console.log(`  - leadCredits: ${existingCredits.leadCredits}`);
      console.log(`  - isTrialActive: ${existingCredits.isTrialActive}`);
    }
    console.log(`- previousSubscriptions.length: ${previousSubscriptions.length}`);
    
    // More accurate check to determine if this is a first-time trial user:
    // Simplify logic to be more reliable
    const isFirstTimeTrial = !hadTrialFromMeta && previousSubscriptions.length === 0;
    
    console.log(`Final determination - Is first time trial: ${isFirstTimeTrial}`);
    
    // Important! Check if an existing credit record already has the trial credits correctly setup
    // This prevents webhook race conditions from downgrading the credits
    if (existingCredits && 
        existingCredits.subscriptionId === subscriptionId.toString() && 
        existingCredits.isTrialActive === true && 
        existingCredits.leadCredits === TRIAL_CREDITS["714800"]) {
      console.log(`Trial has already been set up correctly with ${existingCredits.leadCredits} credits. Skipping update.`);
      return;
    }
    
    let leadCreditsToAssign = isFirstTimeTrial ? TRIAL_CREDITS["714800"] : 0;
    
    // If user already has credits from subscription, don't downgrade them to 0
    if (!isFirstTimeTrial && existingCredits && existingCredits.leadCredits > 0) {
      console.log(`User already has ${existingCredits.leadCredits} credits, not downgrading to 0`);
      return;
    }
    
    // CRITICAL FIX: Don't downgrade if we already have the same subscription and credits are correct
    if (existingCredits?.subscriptionId === subscriptionId.toString() && 
        typeof existingCredits?.leadCredits === 'number' && 
        existingCredits.leadCredits >= leadCreditsToAssign) {
      console.log(`Skipping update: Subscription ${subscriptionId} already processed with ${existingCredits?.leadCredits} credits`);
      return;
    }
    
    if (isFirstTimeTrial) {
      console.log(`First-time trial: Setting trial credits to ${leadCreditsToAssign}`);
    } else {
      console.log(`User had previous trial, setting trial credits to 0`);
    }
    
    // Extract URLs from the subscription data if available
    const urls = subscriptionData.urls || {};
    const customerPortalUrl = urls.customer_portal || null;
    const updatePaymentMethodUrl = urls.update_payment_method || null;
    
    try {
      // Create or update user credits for trial
      if (existingCredits) {
        await prisma.userCredits.update({
          where: { userId: user.id },
          data: {
            subscriptionId: subscriptionId.toString(),
            leadCredits: leadCreditsToAssign,
            planType,
            quantity: finalQuantity,
            isTrialActive: true,
            isMonthly: false,
            hadPreviousTrial: true, // Mark that they've had a trial
            trialStartDate: new Date(),
            trialEndDate: trialEndsAt,
            updatedAt: new Date(),
            customerPortalUrl,
            updatePaymentMethodUrl
          }
        });
      } else {
        // First time user with no records - create a new entry
        await prisma.userCredits.create({
          data: {
            userId: user.id,
            subscriptionId: subscriptionId.toString(),
            leadCredits: leadCreditsToAssign,
            planType,
            quantity: finalQuantity,
            isTrialActive: true,
            isMonthly: false,
            hadPreviousTrial: true, // Mark that they've had a trial
            trialStartDate: new Date(),
            trialEndDate: trialEndsAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            customerPortalUrl,
            updatePaymentMethodUrl
          }
        });
      }
      
      console.log(`Successfully updated subscription for trial user ${user.id} with ${leadCreditsToAssign} credits`);
      return; // Exit early after handling trial
    } catch (error) {
      console.error('Error updating user credits for trial user:', error);
      return;
    }
  }
  
  // Calculate lead credits based on plan type, trial status, and whether it's a resubscription
  let leadCredits = 0;
  
  // If this is a new regular subscription (not on trial), use regular credits
  if (isMonthly || (isOnTrial && hadPreviousTrial)) {
    // Use regular credits for paid subscription
    const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
    
    // Special case for Growth plan (variant 726375) - 3 accounts
    if (variantId === "726375") {
      leadCredits = 3 * 25000; // Fixed at 3 accounts
    }
    // Special case for Elite plan (variant 726377) - 5 accounts
    else if (variantId === "726377") {
      leadCredits = 5 * 25000; // Fixed at 5 accounts
    }
    // For Starter plan, keep the base lead credits (25000)
    else if (isOnTrial && hadPreviousTrial) {
      // If user had a previous trial but is on trial again, they should get 0 credits
      leadCredits = 0;
      console.log(`User had previous trial but is on trial again, setting trial credits to 0`);
    } else {
      leadCredits = baseLeadCredits;
      console.log(`Regular subscription: Setting credits to ${leadCredits}`);
    }
  }
  
  console.log(`Calculated lead credits: ${leadCredits} for plan type ${planType}`);
  
  // Extract URLs from the subscription data if available
  const urls = subscriptionData.urls || {};
  const customerPortalUrl = urls.customer_portal || null;
  const updatePaymentMethodUrl = urls.update_payment_method || null;
  
  try {
    if (existingCredits) {
      // Set the appropriate quantity based on plan type
      let finalUpdateQuantity = finalQuantity;
      
      // For Growth plan, always set quantity to 3
      if (planType === "Growth") {
        finalUpdateQuantity = 3;
      }
      // For Elite plan, always set quantity to 5
      else if (planType === "Elite") {
        finalUpdateQuantity = 5;
      }
      
      // When creating a new subscription, add any existing credits to the new plan's credits
      if (existingCredits.leadCredits > 0 && !isOnTrial) {
        // Check if user is subscribing to a new/different plan
        if (existingCredits.planType !== planType) {
          console.log(`User is subscribing to a new plan: ${planType}`);
          console.log(`Adding remaining credits: ${existingCredits.leadCredits} to new plan credits: ${leadCredits}`);
          leadCredits += existingCredits.leadCredits;
          console.log(`Total credits after subscription: ${leadCredits}`);
        }
      }
      
      console.log(`Final update quantity: ${finalUpdateQuantity}, Final lead credits: ${leadCredits}`);
      
      // Update existing credits
      await prisma.userCredits.update({
        where: { userId: user.id },
        data: {
          subscriptionId: subscriptionId.toString(),
          leadCredits: leadCredits,
          planType,
          quantity: finalUpdateQuantity,
          isTrialActive: isOnTrial,
          isMonthly: isMonthly,
          trialStartDate: isOnTrial && !hadPreviousTrial ? new Date() : existingCredits.trialStartDate, // Only update trialStartDate for first-time trial users
          trialEndDate: isOnTrial && !hadPreviousTrial ? trialEndsAt : existingCredits.trialEndDate, // Only update trialEndDate for first-time trial users
          hadPreviousTrial: true, // Always mark as having had a trial if they're on a trial now or had one before
          updatedAt: new Date(),
          // Store the portal URLs
          customerPortalUrl,
          updatePaymentMethodUrl
        }
      });
      
      // Log if credits were transferred  
      if (existingCredits.planType !== planType && existingCredits.leadCredits > 0 && !isOnTrial) {
        console.log(`Credits transferred: ${existingCredits.leadCredits} credits from ${existingCredits.planType} plan to ${planType} plan for subscription ${subscriptionId}`);
      }
      
      console.log(`Successfully updated subscription for user ${user.id} with ${leadCredits} credits for plan type ${planType}`);
    } else {
      // Create new credits - for new users on trial (who've never had a trial before), set to 1500 lead credits
      const finalLeadCredits = isOnTrial && variantId === "714800" && !hadPreviousTrial ? TRIAL_CREDITS["714800"] : leadCredits;
      
      await prisma.userCredits.create({
        data: {
          userId: user.id,
          subscriptionId: subscriptionId.toString(),
          leadCredits: finalLeadCredits,
          planType,
          quantity: finalQuantity,
          isTrialActive: isOnTrial,
          isMonthly: isMonthly,
          trialStartDate: isOnTrial ? new Date() : null,
          trialEndDate: trialEndsAt,
          hadPreviousTrial: true, // Always mark as having had a trial if they're on a trial
          createdAt: new Date(),
          updatedAt: new Date(),
          // Store the portal URLs
          customerPortalUrl,
          updatePaymentMethodUrl
        }
      });
      
      console.log(`Created new user credits with ${finalLeadCredits} lead credits, isOnTrial: ${isOnTrial}`);
    }
    
    console.log(`Successfully created/updated subscription for user ${user.id} with plan type ${planType}, trial status: ${isOnTrial}, monthly status: ${isMonthly}, and quantity ${finalQuantity}`);
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_updated event
async function handleSubscriptionUpdated(payload: any) {
  const { data, meta } = payload;
  const subscriptionId = data.id;
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
  
  // Get the variant ID from the subscription
  const variantId = subscriptionData.variant_id.toString();
  
  // Get the quantity from the subscription
  const quantity = subscriptionData.quantity || 1;
  
  console.log(`Processing subscription update with variantId: ${variantId}, quantity: ${quantity}`);
  
  // Check if this is a trial subscription or if trial has ended
  const isOnTrial = subscriptionData.status === 'on_trial';
  const trialEndsAt = subscriptionData.trial_ends_at ? new Date(subscriptionData.trial_ends_at) : null;
  const status = subscriptionData.status;
  const isCancelled = status === 'cancelled';
  const isMonthly = status === 'active';
  
  console.log(`Subscription status: ${status}, Is on trial: ${isOnTrial}, Is cancelled: ${isCancelled}, Is monthly: ${isMonthly}`);
  if (trialEndsAt) {
    console.log(`Trial ends at: ${trialEndsAt.toISOString()}`);
  }
  
  // Get the lead credits for this plan
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // First try to find existing user credits
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  // Determine if they've already had a trial or subscription
  // Check for trialStartDate to see if they ever had a trial
  // Also check if current subscription isn't the same as this one (previous subscription)
  const hadPreviousTrial = existingCredits?.trialStartDate !== null || 
                         existingCredits?.hadPreviousTrial === true ||
                         (existingCredits?.subscriptionId !== null && existingCredits.subscriptionId !== subscriptionId.toString());
  
  console.log(`User had previous trial or subscription: ${hadPreviousTrial}`);
  
  // Check if this is a new subscription on trial
  // IMPORTANT: Only give trial credits if the user hasn't had a previous trial
  if (isOnTrial) {
    console.log('User is on trial, checking if it should be a limited trial');
    
    // For Starter plan on trial, only give trial credits if they haven't had a trial before
    if (variantId === "714800") {
      // Extract URLs from the subscription data if available
      const urls = subscriptionData.urls || {};
      const customerPortalUrl = urls.customer_portal || null;
      const updatePaymentMethodUrl = urls.update_payment_method || null;

      // Check previous subscriptions to verify if this user has had a trial before
      const previousSubscriptions = await prisma.userCredits.findMany({
        where: {
          userId: user.id,
          hadPreviousTrial: true
        }
      });
      
      console.log(`Previous subscriptions found: ${previousSubscriptions.length}`);
      
      // Determine if this is really a first-time trial
      // CRITICAL FIX: Don't consider existing credits as a previous trial if it was just created
      // in a previous webhook from this same subscription flow
      const isFirstTimeTrial = (!hadPreviousTrial && previousSubscriptions.length === 0) || 
                             (existingCredits?.subscriptionId === subscriptionId.toString());
      
      let leadCreditsToAssign = 0;
      if (isFirstTimeTrial) {
        leadCreditsToAssign = TRIAL_CREDITS["714800"];
        console.log(`First-time trial: Setting trial credits to ${leadCreditsToAssign}`);
      } else {
        console.log(`Repeat trial detected: Setting lead credits to 0`);
      }
      
      // CRITICAL FIX: Don't update if we already have the same subscription ID and sufficient credits
      if (existingCredits?.subscriptionId === subscriptionId.toString() && 
          typeof existingCredits?.leadCredits === 'number' && 
          existingCredits.leadCredits >= leadCreditsToAssign) {
        console.log(`Skipping update: Subscription ${subscriptionId} already processed with ${existingCredits?.leadCredits} credits`);
        return;
      }
      
      try {
        // Update existing credits with appropriate credits based on trial history
        await prisma.userCredits.update({
          where: { userId: user.id },
          data: {
            subscriptionId: subscriptionId.toString(),
            leadCredits: leadCreditsToAssign,
            planType,
            quantity: quantity,
            isTrialActive: true,
            isMonthly: false,
            hadPreviousTrial: true, // Always mark that they've had a trial, regardless
            trialStartDate: new Date(),
            trialEndDate: trialEndsAt,
            updatedAt: new Date(),
            // Store the portal URLs
            customerPortalUrl,
            updatePaymentMethodUrl
          }
        });
        
        console.log(`Successfully updated subscription for trial user ${user.id} with ${leadCreditsToAssign} credits`);
        return;
      } catch (error) {
        console.error('Error updating user credits for trial user:', error);
        return;
      }
    }
    // For other plans, continue with normal processing
  }
  
  // Calculate lead credits based on plan type and trial status
  let leadCredits = 0;
  
  // If this is a trial for the Starter plan AND they've never had a trial before, use trial credits
  if (isOnTrial && variantId === "714800" && !hadPreviousTrial) {
    leadCredits = TRIAL_CREDITS["714800"]; // Explicitly set to 1500 lead credits during trial
    console.log(`Assigning trial credits: ${leadCredits} for Starter plan - first time trial user`);
  } else if (isOnTrial && variantId === "714800" && hadPreviousTrial) {
    // If user had a previous trial, they should get 0 credits for another trial
    leadCredits = 0;
    console.log(`User had previous trial, setting trial credits to 0`);
  } else if (isCancelled) {
    // If subscription is cancelled and was on trial, set credits to 0
    // If regular subscription cancellation, keep existing credits
    if (existingCredits?.isTrialActive) {
      leadCredits = 0;
      console.log(`Trial subscription cancelled: setting credits to 0`);
    } else {
      leadCredits = existingCredits?.leadCredits || 0;
      console.log(`Regular subscription cancelled: retaining existing credits: ${leadCredits}`);
    }
  } else {
    // Not on trial and not cancelled, use regular credits
    const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
    
    // Special case for Growth plan (variant 726375) - 3 accounts
    if (variantId === "726375") {
      leadCredits = 3 * 25000; // Fixed at 3 accounts
    }
    // Special case for Elite plan (variant 726377) - 5 accounts
    else if (variantId === "726377") {
      leadCredits = 5 * 25000; // Fixed at 5 accounts
    }
    // For Starter plan, keep the base lead credits (25000)
    else {
      leadCredits = baseLeadCredits;
    }
  }
  
  console.log(`Calculated lead credits: ${leadCredits} for plan type ${planType}`);
  
  // Extract URLs from the subscription data if available
  const urls = subscriptionData.urls || {};
  const customerPortalUrl = urls.customer_portal || null;
  const updatePaymentMethodUrl = urls.update_payment_method || null;
  
  try {
    // Set the appropriate quantity based on plan type
    let finalQuantity = quantity;
    
    // For Growth plan, always set quantity to 3
    if (planType === "Growth") {
      finalQuantity = 3;
    }
    // For Elite plan, always set quantity to 5
    else if (planType === "Elite") {
      finalQuantity = 5;
    }
    
    console.log(`Final quantity: ${finalQuantity}, Final lead credits: ${leadCredits}`);
    
    // Check if trial has converted to active subscription
    const trialConverted = existingCredits?.isTrialActive && status === 'active';
    if (trialConverted) {
      console.log('Trial has converted to active subscription, updating lead credits to full amount');
      // When trial converts to active, update to full credits
      if (variantId === "714800") { // Starter plan
        leadCredits = PLAN_CREDITS["714800"] || 25000;
        console.log(`Updating from trial credits to full credits: ${leadCredits}`);
      }
    }
    
    // When updating plan, add any existing credits to the new plan's credits
    if (existingCredits && existingCredits.leadCredits > 0 && !isOnTrial) {
      // Check if user is upgrading their plan from a different plan
      if (existingCredits.planType !== planType && existingCredits.planType) {
        console.log(`User is upgrading from ${existingCredits.planType} to ${planType}`);
        console.log(`Adding remaining credits: ${existingCredits.leadCredits} to new plan credits: ${leadCredits}`);
        leadCredits += existingCredits.leadCredits;
        console.log(`Total credits after upgrade: ${leadCredits}`);
      }
    }
    
    // Update or create user credits
    await prisma.userCredits.upsert({
      where: { userId: user.id },
      update: {
        leadCredits: leadCredits,
        planType,
        subscriptionId: subscriptionId.toString(),
        quantity: finalQuantity,
        isTrialActive: isOnTrial,
        isMonthly: isMonthly,
        trialEndDate: trialEndsAt,
        updatedAt: new Date(),
        // Store the portal URLs
        customerPortalUrl,
        updatePaymentMethodUrl,
        // If they are or were on a trial, mark that they've had one
        hadPreviousTrial: isOnTrial || existingCredits?.hadPreviousTrial || false
      },
      create: {
        userId: user.id,
        leadCredits: leadCredits,
        planType,
        subscriptionId: subscriptionId.toString(),
        quantity,
        isTrialActive: isOnTrial,
        isMonthly: isMonthly,
        trialStartDate: isOnTrial ? new Date() : null,
        trialEndDate: trialEndsAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Store the portal URLs
        customerPortalUrl,
        updatePaymentMethodUrl,
        // If they are on a trial, mark that they've had one
        hadPreviousTrial: isOnTrial
      }
    });
    
    // Log if credits were transferred
    if (existingCredits && existingCredits.planType !== planType && existingCredits.leadCredits > 0 && !isOnTrial) {
      console.log(`Credits transferred: ${existingCredits.leadCredits} credits from ${existingCredits.planType} plan to ${planType} plan for subscription update ${subscriptionId}`);
    }
    
    console.log(`Successfully updated subscription for user ${user.id} with plan type ${planType}, trial status: ${isOnTrial}, monthly status: ${isMonthly}, and quantity ${finalQuantity}`);
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_cancelled event
async function handleSubscriptionCancelled(payload: any) {
  const { data, meta } = payload;
  const subscriptionId = data.id;
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
    // Check if this was a trial cancellation
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId: user.id }
    });
    
    const wasOnTrial = userCredits?.isTrialActive || false;
    console.log(`Cancelling subscription for user ${user.id}, was on trial: ${wasOnTrial}`);
    
    // If it was a trial, set credits to 0 immediately
    // If it was a regular subscription, keep the credits (they'll expire 30 days from creation)
    const shouldResetCredits = wasOnTrial;
    
    // Preserve existing credits for regular subscription cancellations
    // Only set credits to 0 for trial cancellations
    const updatedLeadCredits = shouldResetCredits ? 0 : userCredits?.leadCredits || 0;
    
    console.log(`Cancellation: ${shouldResetCredits ? 'Resetting credits to 0 (trial)' : 'Keeping existing credits: ' + updatedLeadCredits + ' (regular subscription)'}`);
    
    await prisma.userCredits.update({
      where: { userId: user.id },
      data: {
        subscriptionId: null,
        isTrialActive: false,
        isMonthly: false,
        leadCredits: updatedLeadCredits,
        trialEndDate: wasOnTrial ? new Date() : userCredits?.trialEndDate,
        hadPreviousTrial: true, // Always true after any subscription or trial
        updatedAt: new Date()
      }
    });
    
    console.log(`Successfully cancelled subscription for user ${user.id}. Credits ${shouldResetCredits ? 'reset to 0' : 'retained until grace period expires'}`);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
  }
} 