import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

// Define the plan IDs and their corresponding lead credits
const PLAN_CREDITS = {
  "714632": 3000,  // Mini plan - $19
  "714642": 12000, // Starter plan - $57
  "714643": 27000  // Pro plan - $97
};

// Define the plan types
const PLAN_TYPES = {
  "714632": "Mini",
  "714642": "Starter",
  "714643": "Pro"
};

// Define the DM credits for each plan
const DM_CREDITS = {
  "714632": 1500,  // Mini plan - 1,500 DMs/month
  "714642": 6000,  // Starter plan - 6,000 DMs/month
  "714643": 13500  // Pro plan - 13,500 DMs/month
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
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

// Handle order_created event
async function handleOrderCreated(payload: any) {
  const { data } = payload;
  const orderId = data.id;
  const orderData = data.attributes;
  
  // Get the customer email from the order
  const customerEmail = orderData.user_email;
  
  // Find the user by email
  let user = await prisma.user.findUnique({
    where: { email: customerEmail }
  });
  
  if (!user) {
    console.error(`User with email ${customerEmail} not found`);
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
  
  // Get the lead credits for this plan
  const leadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  const dmCredits = DM_CREDITS[variantId as keyof typeof DM_CREDITS] || 0;
  
  // Update or create user credits
  try {
    await prisma.userCredits.upsert({
      where: { userId: user.id },
      update: {
        leadCredits: { increment: leadCredits },
        dmCredits,
        planType,
        orderId,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        leadCredits,
        dmCredits,
        planType,
        orderId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_created event
async function handleSubscriptionCreated(payload: any) {
  const { data } = payload;
  const subscriptionId = data.id;
  const subscriptionData = data.attributes;
  
  // Get the customer email from the subscription
  const customerEmail = subscriptionData.user_email;
  
  // Find the user by email
  let user = await prisma.user.findUnique({
    where: { email: customerEmail }
  });
  
  if (!user) {
    console.error(`User with email ${customerEmail} not found`);
    return;
  }
  
  // Get the variant ID from the subscription
  const variantId = subscriptionData.variant_id.toString();
  
  // Get the lead credits for this plan
  const leadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  const dmCredits = DM_CREDITS[variantId as keyof typeof DM_CREDITS] || 0;
  
  // First try to find existing user credits
  const existingCredits = await prisma.userCredits.findUnique({
    where: { userId: user.id }
  });
  
  try {
    if (existingCredits) {
      // Update existing credits
      await prisma.userCredits.update({
        where: { userId: user.id },
        data: {
          subscriptionId: subscriptionId.toString(),
          leadCredits: leadCredits,
          dmCredits,
          planType,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new credits
      await prisma.userCredits.create({
        data: {
          userId: user.id,
          subscriptionId: subscriptionId.toString(),
          leadCredits,
          dmCredits,
          planType,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_updated event
async function handleSubscriptionUpdated(payload: any) {
  const { data } = payload;
  const subscriptionId = data.id;
  const subscriptionData = data.attributes;
  
  // Get the customer email from the subscription
  const customerEmail = subscriptionData.user_email;
  
  // Find the user by email
  let user = await prisma.user.findUnique({
    where: { email: customerEmail }
  });
  
  if (!user) {
    console.error(`User with email ${customerEmail} not found`);
    return;
  }
  
  // Get the variant ID from the subscription
  const variantId = subscriptionData.variant_id.toString();
  
  // Get the lead credits for this plan
  const leadCredits = PLAN_CREDITS[variantId as keyof typeof PLAN_CREDITS] || 0;
  const planType = PLAN_TYPES[variantId as keyof typeof PLAN_TYPES] || 'Unknown';
  const dmCredits = DM_CREDITS[variantId as keyof typeof DM_CREDITS] || 0;
  
  try {
    // Update or create user credits
    await prisma.userCredits.upsert({
      where: { userId: user.id },
      update: {
        leadCredits,
        dmCredits,
        planType,
        subscriptionId: subscriptionId.toString(),
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        leadCredits,
        dmCredits,
        planType,
        subscriptionId: subscriptionId.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
}

// Handle subscription_cancelled event
async function handleSubscriptionCancelled(payload: any) {
  const { data } = payload;
  const subscriptionId = data.id;
  const subscriptionData = data.attributes;
  
  // Get the customer email from the subscription
  const customerEmail = subscriptionData.user_email;
  
  // Find the user by email
  let user = await prisma.user.findUnique({
    where: { email: customerEmail }
  });
  
  if (!user) {
    console.error(`User with email ${customerEmail} not found`);
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