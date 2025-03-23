import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

// Define the plan IDs and their corresponding lead credits
const PLAN_CREDITS = {
  "714798": 3000,  // Mini plan - $19
  "714799": 12000, // Starter plan - $57
  "714800": 27000, // Pro plan - $97 (Standard Tier 1-2 accounts)
  "726374": 27000, // Pro plan - $75 (Team Tier 3-4 accounts)
  "726375": 27000, // Pro plan - $67 (Growth Tier 5-9 accounts)
  "726377": 27000  // Pro plan - $49 (Enterprise Tier 10-15 accounts)
};

// Define the plan types
const PLAN_TYPES = {
  "714798": "Mini",
  "714799": "Starter",
  "714800": "Pro",
  "726374": "Pro",
  "726375": "Pro",
  "726377": "Pro"
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
  
  // Get the first order item from the first_order_item field
  const firstOrderItem = orderData.first_order_item;
  
  if (!firstOrderItem) {
    console.error('No first order item found in payload');
    return;
  }
  
  // Get the variant ID from the first order item
  const variantId = firstOrderItem.variant_id.toString();
  
  // Get the quantity from the first order item
  const quantity = firstOrderItem.quantity || 1;
  
  console.log(`Processing order with variantId: ${variantId}, quantity: ${quantity}`);
  
  // Get the lead credits for this plan
  const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Calculate total lead credits based on the plan type and quantity
  const leadCredits = baseLeadCredits * quantity;
  
  console.log(`Calculated lead credits: ${leadCredits} (${baseLeadCredits} per account × ${quantity} accounts)`);
  
  // Check for existing user credits
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  // Update or create user credits
  try {
    // If there's an existing subscription, preserve it
    if (existingCredits && existingCredits.subscriptionId) {
      console.log(`User has existing subscription ID: ${existingCredits.subscriptionId}, preserving it`);
      
      await prisma.userCredits.update({
        where: { userId: user.id },
        data: {
          leadCredits: leadCredits,
          planType,
          orderId,
          quantity, // Save the quantity from the order
          updatedAt: new Date()
          // Note: We don't update subscriptionId to preserve the existing subscription
        }
      });
    } else {
      // No existing subscription, do a regular upsert
      await prisma.userCredits.upsert({
        where: { userId: user.id },
        update: {
          leadCredits: leadCredits, // Set the total lead credits based on quantity
          planType,
          orderId,
          quantity, // Save the quantity from the order
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          leadCredits,
          planType,
          orderId,
          quantity, // Save the quantity from the order
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    console.log(`Successfully updated user credits for user ${user.id} with ${leadCredits} lead credits, plan type ${planType}, and quantity ${quantity}`);
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
  
  console.log(`Processing subscription with variantId: ${variantId}, quantity: ${quantity}`);
  
  // Get the lead credits for this plan
  const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Extract URLs from the subscription data if available
  const urls = subscriptionData.urls || {};
  const customerPortalUrl = urls.customer_portal || null;
  const updatePaymentMethodUrl = urls.update_payment_method || null;
  
  // First try to find existing user credits
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  try {
    if (existingCredits) {
      // For Pro plans, preserve the existing quantity if it's higher
      // This ensures we don't overwrite a multi-account purchase with a subscription event
      let finalQuantity = quantity;
      let finalLeadCredits = baseLeadCredits * quantity;
      
      if (planType === "Pro" && existingCredits.quantity > quantity) {
        console.log(`Preserving existing quantity ${existingCredits.quantity} which is higher than subscription quantity ${quantity}`);
        finalQuantity = existingCredits.quantity;
        finalLeadCredits = baseLeadCredits * finalQuantity;
      }
      
      console.log(`Final quantity: ${finalQuantity}, Final lead credits: ${finalLeadCredits}`);
      
      // Update existing credits
      await prisma.userCredits.update({
        where: { userId: user.id },
        data: {
          subscriptionId: subscriptionId.toString(),
          leadCredits: finalLeadCredits,
          planType,
          quantity: finalQuantity, // Use the preserved quantity
          updatedAt: new Date(),
          // Store the portal URLs
          customerPortalUrl,
          updatePaymentMethodUrl
        }
      });
    } else {
      // Create new credits
      await prisma.userCredits.create({
        data: {
          userId: user.id,
          subscriptionId: subscriptionId.toString(),
          leadCredits: baseLeadCredits * quantity,
          planType,
          quantity, // Save the quantity from the subscription
          createdAt: new Date(),
          updatedAt: new Date(),
          // Store the portal URLs
          customerPortalUrl,
          updatePaymentMethodUrl
        }
      });
    }
    
    console.log(`Successfully created/updated subscription for user ${user.id} with plan type ${planType}, and quantity ${quantity}`);
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
  
  // Get the lead credits for this plan
  const baseLeadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  
  // Extract URLs from the subscription data if available
  const urls = subscriptionData.urls || {};
  const customerPortalUrl = urls.customer_portal || null;
  const updatePaymentMethodUrl = urls.update_payment_method || null;
  
  // First try to find existing user credits
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  try {
    // For Pro plans, preserve the existing quantity if it's higher
    // This ensures we don't overwrite a multi-account purchase with a subscription event
    let finalQuantity = quantity;
    let finalLeadCredits = baseLeadCredits * quantity;
    
    if (existingCredits && planType === "Pro" && existingCredits.quantity > quantity) {
      console.log(`Preserving existing quantity ${existingCredits.quantity} which is higher than subscription quantity ${quantity}`);
      finalQuantity = existingCredits.quantity;
      finalLeadCredits = baseLeadCredits * finalQuantity;
    }
    
    console.log(`Final quantity: ${finalQuantity}, Final lead credits: ${finalLeadCredits}`);
    
    // Update or create user credits
    await prisma.userCredits.upsert({
      where: { userId: user.id },
      update: {
        leadCredits: finalLeadCredits,
        planType,
        subscriptionId: subscriptionId.toString(),
        quantity: finalQuantity, // Use the preserved quantity
        updatedAt: new Date(),
        // Store the portal URLs
        customerPortalUrl,
        updatePaymentMethodUrl
      },
      create: {
        userId: user.id,
        leadCredits: baseLeadCredits * quantity,
        planType,
        subscriptionId: subscriptionId.toString(),
        quantity, // Save the quantity from the subscription
        createdAt: new Date(),
        updatedAt: new Date(),
        // Store the portal URLs
        customerPortalUrl,
        updatePaymentMethodUrl
      }
    });
    
    console.log(`Successfully updated subscription for user ${user.id} with plan type ${planType}, and quantity ${finalQuantity}`);
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
    // Update the user credits to indicate the subscription is cancelled
    await prisma.userCredits.update({
      where: { userId: user.id },
      data: {
        subscriptionId: null,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
  }
} 