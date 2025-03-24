import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import prisma from '@/lib/prisma';

const LEMON_SQUEEZY_API_KEY = process.env.LEMON_SQUEEZY_API_KEY as string;

// Define variant IDs from LemonSqueezy
const VARIANT_IDS = {
  STARTER: "714800", // $87 plan with 3-day trial (1500 credits during trial, 25000 after)
  GROWTH: "726375",  // $67 per account plan (fixed quantity: 3 accounts)
  ELITE: "726377"    // $57 per account plan (fixed quantity: 5 accounts)
};

// Define lead credits for trial
const TRIAL_CREDITS = 1500; // Limited credits during trial period

// Define checkout options interface
interface CheckoutOptions {
  embed: boolean;
  media: boolean;
  logo: boolean;
  desc: boolean;
  discount: boolean;
  subscription_preview: boolean;
  quantity: any;
  skip_trial?: boolean;
}

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { planId, quantity = 1 } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has had a previous trial
    const userCredits = await prisma.userCredits.findUnique({
      where: { userId: user.id },
    });

    // If userCredits doesn't exist, this is definitely a new user
    // Only consider user as having had a previous trial if specific trial fields are set
    const hadPreviousTrial = userCredits ? (
      userCredits.hadPreviousTrial === true || 
      userCredits.trialStartDate !== null ||
      (userCredits.subscriptionId !== null && userCredits.isTrialActive === false)
    ) : false;

    console.log(`Creating checkout for user ${user.id}, hadPreviousTrial: ${hadPreviousTrial}`);

    // Determine correct quantity based on plan type
    let finalQuantity = quantity;
    if (planId === VARIANT_IDS.GROWTH) {
      finalQuantity = 3; // Growth plan has fixed 3 accounts
    } else if (planId === VARIANT_IDS.ELITE) {
      finalQuantity = 5; // Elite plan has fixed 5 accounts
    }

    // Generate custom data for the checkout
    const customData = {
      user_id: user.id,
      timestamp: Date.now().toString(),
      had_trial: hadPreviousTrial ? 'true' : 'false',
      plan_id: planId,
      quantity: finalQuantity.toString() // Convert to string to ensure it's passed correctly
    };

    // Create checkout options
    const checkoutOptions: CheckoutOptions = {
      embed: false,
      media: true,
      logo: true,
      desc: true,
      discount: true,
      subscription_preview: true,
      quantity: finalQuantity,
    };

    // If user has had a previous trial, skip the trial period
    if (hadPreviousTrial && planId === VARIANT_IDS.STARTER) {
      console.log('User previously had a trial, forcing immediate payment with skip_trial');
      checkoutOptions.skip_trial = true;
    } else if (planId === VARIANT_IDS.STARTER) {
      console.log('First time user, offering 3-day free trial');
    }

    // Create checkout data
    const checkoutData = {
      custom: customData,
      variant_quantities: [
        {
          variant_id: parseInt(planId, 10),
          quantity: finalQuantity
        }
      ]
    };

    // Make request to LemonSqueezy API to create a checkout
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${LEMON_SQUEEZY_API_KEY}`
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: checkoutData,
            checkout_options: checkoutOptions,
            product_options: {
              name: planId === VARIANT_IDS.GROWTH ? "Growth Plan - 3 Accounts ($201/mo)" : 
                   planId === VARIANT_IDS.ELITE ? "Elite Plan - 5 Accounts ($285/mo)" : 
                   "Starter Plan",
              description: planId === VARIANT_IDS.GROWTH ? 
                         "3 accounts at $67 each = $201/mo total. Includes 75,000 Lead Credits and 1350 DMs per day." :
                         planId === VARIANT_IDS.ELITE ? 
                         "5 accounts at $57 each = $285/mo total. Includes 125,000 Lead Credits and 2250 DMs per day." :
                         "Individual plan with 25,000 Lead Credits and 450 DMs per day."
            },
            expires_at: null,
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: '156484' // Your store ID
              }
            },
            variant: {
              data: {
                type: 'variants',
                id: planId
              }
            }
          }
        }
      })
    });

    const checkoutResponse = await response.json();
    
    if (!response.ok) {
      console.error('Error creating checkout:', checkoutResponse);
      return NextResponse.json({ 
        error: 'Failed to create checkout', 
        details: checkoutResponse 
      }, { status: response.status });
    }

    // Log successful checkout creation with details
    console.log('Checkout created successfully:', {
      url: checkoutResponse?.data?.attributes?.url,
      product: planId === VARIANT_IDS.GROWTH ? "Growth Plan" : 
              planId === VARIANT_IDS.ELITE ? "Elite Plan" : "Starter Plan",
      quantity: finalQuantity,
      total: planId === VARIANT_IDS.GROWTH ? "$201/mo" : 
            planId === VARIANT_IDS.ELITE ? "$285/mo" : "$87/mo"
    });

    // Extract the URL from the response
    const checkoutUrl = checkoutResponse?.data?.attributes?.url;
    if (!checkoutUrl) {
      return NextResponse.json({ 
        error: 'No checkout URL in response', 
        details: checkoutResponse 
      }, { status: 500 });
    }

    // Return the unmodified checkout URL directly
    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Error creating checkout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
