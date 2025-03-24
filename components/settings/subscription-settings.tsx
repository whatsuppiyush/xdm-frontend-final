"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { Slider } from "@/components/ui/slider";

// Define interface for plan objects
interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  variantId: string;
  purchaseUrl: string;
  freeTrial: boolean;
  freeTrialDays: number;
  trialCredits: number;
  popular?: boolean;
  quantity?: number;
  fixedQuantity?: boolean;
  hasHadTrial?: boolean;
}

// Define the plans based on the provided information
const plans: Plan[] = [
  {
    name: "Starter",
    price: "$87",
    description: "For individuals getting started",
    features: [
      "450 DMs per day",
      "25,000 Lead Credits",
      "1 Twitter Account",
      "Advanced AI personalization",
      "Priority email support",
      "Unlimited message history",
      "✨ 3-DAY FREE TRIAL ✨"
    ],
    variantId: "714800",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/68f27604-6772-4cec-941f-c1e83e9b6ebe",
    freeTrial: true,
    freeTrialDays: 3,
    trialCredits: 1500
  },
  {
    name: "Growth",
    price: "$67",
    description: "For serious professionals",
    features: [
      "1350 DMs per day (450 × 3 accounts)",
      "75,000 Lead Credits (25,000 × 3 accounts)",
      "3 Twitter Accounts",
      "Advanced AI personalization",
      "Priority email support",
      "Unlimited message history"
    ],
    popular: true,
    variantId: "726375",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/fa5fdff6-31e0-49d7-8166-9d13e8e45205",
    quantity: 3,
    fixedQuantity: true,
    freeTrial: false,
    freeTrialDays: 0,
    trialCredits: 0
  },
  {
    name: "Elite",
    price: "$57",
    description: "For power users & teams",
    features: [
      "2250 DMs per day (450 × 5 accounts)",
      "125,000 Lead Credits (25,000 × 5 accounts)",
      "5 Twitter Accounts",
      "Advanced AI personalization",
      "Priority email support",
      "Unlimited message history"
    ],
    variantId: "726377",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/e8e0faaf-488d-4d9f-bb8e-c6a248917adb",
    quantity: 5,
    fixedQuantity: true,
    freeTrial: false,
    freeTrialDays: 0,
    trialCredits: 0
  }
];

export default function SubscriptionSettings() {
  const { userId } = useUser();
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    leadCredits: number;
    planType: string | null;
    isMonthly: boolean;
    customerPortalUrl?: string | null;
    updatePaymentMethodUrl?: string | null;
    isTrialActive?: boolean;
    trialStartDate?: Date | null;
    trialEndDate?: Date | null;
    trialStatus?: string | null;
    hadPreviousTrial?: boolean;
    createdAt?: Date | null;
    subscriptionId?: string | null;
  }>({
    name: "No Plan",
    leadCredits: 0,
    planType: null,
    isMonthly: false,
    isTrialActive: false,
    trialStatus: null,
    subscriptionId: null
  });
  const [loading, setLoading] = useState(true);
  // Add a state to track which button is loading
  const [buttonLoadingState, setButtonLoadingState] = useState<{
    [key: string]: boolean;
  }>({});
  // No longer need to track quantity for individual plans as they have fixed quantities

  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        const response = await fetch("/api/user/credits");
        const data = await response.json();
        
        if (data.planType) {
          setCurrentPlan({
            name: data.planType,
            leadCredits: data.leadCredits,
            planType: data.planType,
            isMonthly: data.isMonthly || false,
            customerPortalUrl: data.customerPortalUrl,
            updatePaymentMethodUrl: data.updatePaymentMethodUrl,
            isTrialActive: data.isTrialActive,
            trialStartDate: data.trialStartDate,
            trialEndDate: data.trialEndDate,
            trialStatus: data.trialStatus,
            hadPreviousTrial: data.hadPreviousTrial,
            createdAt: data.createdAt,
            subscriptionId: data.subscriptionId
          });
        }
      } catch (error) {
        console.error("Error fetching user credits:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCredits();
  }, [userId]);

  const getPlanDetails = (planType: string | null) => {
    if (!planType) return null;
    return plans.find(plan => plan.name === planType);
  };

  const currentPlanDetails = getPlanDetails(currentPlan.planType);

  // Function to get checkout URL with user ID as custom data
  const getCheckoutUrl = (baseUrl: string, quantity = 1) => {
    if (!userId) return baseUrl;
    
    // Add quantity and user ID directly to the original purchase URL
    return `${baseUrl}?quantity=${quantity}&checkout[custom][user_id]=${userId}`;
  };

  // No longer need tier-specific functions since plans have fixed quantities

  // Generate checkout URL using the Checkouts API endpoint
  const getDirectLemonSqueezyUrl = async (plan: any) => {
    try {
      console.log("Creating checkout through API for plan:", plan.name);
      
      // Use the plan's fixed quantity if available, otherwise default to 1
      const quantity = plan.fixedQuantity ? plan.quantity : 1;
      
      // Use variant ID directly from the plan object
      const variantId = plan.variantId;
      
      if (!variantId) {
        console.error(`No variant ID found for plan: ${plan.name}`);
        throw new Error(`Unknown plan type: ${plan.name}`);
      }
      
      console.log(`Sending request to create checkout for plan: ${plan.name}, variant ID: ${variantId}, quantity: ${quantity}`);
      
      // Call our custom API endpoint which uses LemonSqueezy's Checkouts API
      const response = await fetch('/api/checkout/lemonsqueezy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: variantId,
          quantity: quantity,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating checkout:', errorData);
        throw new Error(`Failed to create checkout: ${errorData.error || 'Unknown error'}`);
      }
      
      const data = await response.json();
      console.log('Checkout created successfully, URL:', data.url);
      
      // Check if user previously had a trial (we still need this for the UI)
      const hadPreviousTrial = currentPlan.hadPreviousTrial || 
                               currentPlan.trialStartDate !== null || 
                               (!currentPlan.isTrialActive && !currentPlan.isMonthly && currentPlan.planType) ||
                               currentPlan.subscriptionId !== null;
      
      // If user had a previous trial, update the plan object to remove trial text in UI
      if (hadPreviousTrial) {
        plan.hasHadTrial = true;
      }
      
      return data.url;
    } catch (error) {
      console.error("Error creating checkout URL:", error);
      // Fallback to standard URL with user ID if our API fails
      return plan.purchaseUrl + `?checkout[custom][user_id]=${userId}`;
    }
  };

  // Get subscription status message
  const getSubscriptionStatusMessage = () => {
    if (!currentPlan.planType) return null;
    
    if (currentPlan.isTrialActive) {
      if (currentPlan.trialStatus?.startsWith('active-')) {
        const daysRemaining = currentPlan.trialStatus.replace('active-', '');
        return `Trial - ${daysRemaining} days remaining`;
      } else if (currentPlan.trialStatus === 'ended') {
        return "Trial ended - Please upgrade";
      }
      return "Free Trial";
    } else if (currentPlan.isMonthly) {
      return "Active subscription";
    } else {
      return "Cancelled subscription";
    }
  };

  // Update function to calculate grace period status based on creation date
  const getGracePeriodStatus = () => {
    if (!currentPlan.createdAt || currentPlan.isMonthly || currentPlan.isTrialActive) return null;
    
    const creationDate = new Date(currentPlan.createdAt);
    const gracePeriodEnd = new Date(creationDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);
    
    const now = new Date();
    const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
 
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="flex flex-col justify-between items-start gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">
                    {currentPlan.planType || "No Active Plan"}
                  </h3>
                  {currentPlan.planType && (
                    <Badge variant="secondary">Current Plan</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {currentPlan.isTrialActive ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300">
                        Free Trial
                      </Badge>
                      {currentPlan.trialStatus?.startsWith('active-') && (
                        <span className="ml-2 text-xs font-medium text-yellow-700">
                          {currentPlan.trialStatus.replace('active-', '')} days remaining
                        </span>
                      )}
                      {currentPlan.trialStatus === 'ended' && (
                        <span className="ml-2 text-xs font-medium text-red-600">
                          Trial ended - Please upgrade
                        </span>
                      )}
                    </div>
                  ) : currentPlan.isMonthly ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
                        Active Subscription
                      </Badge>
                    </div>
                  ) : currentPlan.planType ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300">
                        Cancelled
                      </Badge>
                      {getGracePeriodStatus() && (
                        <span className="ml-2 text-xs font-medium text-orange-600">
                          {getGracePeriodStatus()}
                        </span>
                      )}
                    </div>
                  ) : null}
                  <p>Available Lead Credits: {currentPlan.leadCredits}</p>
                  {currentPlan.isTrialActive && (
                    <p className="text-xs text-yellow-700">
                       During trial, you have 1,500 lead credits. After trial ends, you&apos;ll get 25,000 credits.
                    </p>
                  )}
                  {!currentPlan.isMonthly && !currentPlan.isTrialActive && currentPlan.planType && (
                    <p className="text-xs text-red-700">
                      Your subscription has been cancelled. {getGracePeriodStatus() ? 
                        "You can continue using your remaining credits during the grace period." : 
                        "Subscribe again to get more lead credits."}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap w-full gap-2">
                {currentPlan.planType ? (
                  <>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={() => {
                        // Use the customer portal URL if available, otherwise fallback to the generic URL
                        const portalUrl = currentPlan.customerPortalUrl || "https://app.lemonsqueezy.com/my-orders";
                        window.open(portalUrl, "_blank");
                      }}
                    >
                      <CreditCard className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                      Manage Subscription
                    </Button>
                    {currentPlan.updatePaymentMethodUrl && currentPlan.isMonthly && (
                      <Button 
                        variant="outline"
                        size="sm"
                        className="text-xs sm:text-sm"
                        onClick={() => window.open(currentPlan.updatePaymentMethodUrl!, "_blank")}
                      >
                        <CreditCard className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                        Update Payment
                      </Button>
                    )}
                    <Button 
                      size="sm"
                      className="text-xs sm:text-sm"
                      variant={!currentPlan.isMonthly && !currentPlan.isTrialActive ? "destructive" : "default"}
                      onClick={async () => {
                        try {
                          // Set loading state
                          setButtonLoadingState(prev => ({ ...prev, upgrade: true }));
                          
                          // Get current plan details
                          const currentPlanIndex = plans.findIndex(p => p.name === currentPlan.planType);
                          
                          // Get next plan or fallback to last plan
                          const nextPlanIndex = currentPlanIndex < plans.length - 1 ? currentPlanIndex + 1 : plans.length - 1;
                          const nextPlan = plans[nextPlanIndex];
                          
                          // Get checkout URL and open it
                          const checkoutUrl = await getDirectLemonSqueezyUrl(nextPlan);
                          window.open(checkoutUrl, "_blank");
                        } catch (error) {
                          console.error("Error getting checkout URL:", error);
                        } finally {
                          // Reset loading state
                          setButtonLoadingState(prev => ({ ...prev, upgrade: false }));
                        }
                      }}
                      disabled={buttonLoadingState.upgrade}
                    >
                      {buttonLoadingState.upgrade ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                          {!currentPlan.isMonthly && !currentPlan.isTrialActive ? "Resubscribe Now" : "Upgrade Plan"}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button 
                    size="sm"
                    className="text-xs sm:text-sm"
                    onClick={async () => {
                      try {
                        // Set loading state
                        setButtonLoadingState(prev => ({ ...prev, getStarted: true }));
                        
                        const checkoutUrl = await getDirectLemonSqueezyUrl(plans[0]);
                        window.open(checkoutUrl, "_blank");
                      } catch (error) {
                        console.error("Error getting checkout URL:", error);
                      } finally {
                        // Reset loading state
                        setButtonLoadingState(prev => ({ ...prev, getStarted: false }));
                      }
                    }}
                    disabled={buttonLoadingState.getStarted}
                  >
                    {buttonLoadingState.getStarted ? (
                      <>
                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                        Get Started
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative",
                  plan.popular && "border-primary",
                  currentPlan.planType === plan.name && currentPlan.isMonthly && "bg-muted"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 right-4">
                    Most Popular
                  </Badge>
                )}
                {currentPlan.planType === plan.name && currentPlan.isMonthly && (
                  <Badge className="absolute -top-2 left-4 bg-green-500">
                    Current Plan
                  </Badge>
                )}
                {currentPlan.planType === plan.name && !currentPlan.isMonthly && !currentPlan.isTrialActive && (
                  <Badge className="absolute -top-2 left-4 bg-red-500">
                    Cancelled
                  </Badge>
                )}
                <CardContent className="flex flex-col h-full pt-6 px-3 sm:px-6">
                  <div className="space-y-6 flex-grow">
                    <div className="space-y-2">
                      <h3 className="font-medium text-lg">
                        {plan.name}
                      </h3>
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="text-3xl font-bold">
                          {plan.price}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {plan.fixedQuantity ? `per account / month` : `/month`}
                        </span>
                        {plan.fixedQuantity && (
                          <span className="text-md ml-1 block w-full mt-1">
                            <span className="font-semibold text-blue-600">
                              {plan.name === "Growth" ? "$67 × 3 = $201/mo total" : "$57 × 5 = $285/mo total"}
                            </span>
                          </span>
                        )}
                        {plan.freeTrial && !plan.hasHadTrial && (
                          <span className="ml-2 text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full font-bold">
                            {plan.freeTrialDays}-DAY FREE TRIAL
                          </span>
                        )}
                        {plan.freeTrial && plan.hasHadTrial && (
                          <span className="ml-2 text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded-full font-medium line-through">
                            No free trial available
                          </span>
                        )}
                      </div>
                      {plan.fixedQuantity && (
                        <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
                          <div className="flex items-start gap-2">
                            <div className="h-2 w-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                            <div>
                              
                              <div className="text-xs mt-0.5">
                                {plan.name === "Growth" ? "Perfect for small teams" : "Ideal for larger teams"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    
                    <ul className="space-y-2">
                        {plan.features.map((feature) => {
                          // Check if this is the free trial feature and it's not available
                          const isFreeTrial = feature.includes('FREE TRIAL');
                          
                          // Skip the free trial feature if it's not available
                          if (isFreeTrial && plan.hasHadTrial) {
                            return null;
                          }
                          
                          return (
                            <li
                              key={feature}
                              className={`flex items-center gap-2 text-sm ${isFreeTrial ? 'py-1 my-1' : ''}`}
                            >
                              <Check className={`h-4 w-4 shrink-0 ${isFreeTrial ? 'text-yellow-500' : 'text-primary'}`} />
                              <span className={isFreeTrial ? 'font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-md' : ''}>{feature}</span>
                            </li>
                          );
                        })}
                      </ul>
                  </div>
                  
                  <div className="mt-6">
                    <Button
                      className="w-full mt-auto"
                      variant={currentPlan.planType === plan.name && currentPlan.isMonthly ? "outline" : "default"}
                      onClick={async () => {
                        try {
                          // Set loading state for this specific plan button
                          setButtonLoadingState(prev => ({ ...prev, [plan.name]: true }));
                          
                          // Use the direct URL format with user ID and fixed quantity if applicable
                          const checkoutUrl = await getDirectLemonSqueezyUrl(plan);
                          console.log("Opening checkout URL:", checkoutUrl);
                          window.open(checkoutUrl, "_blank");
                        } catch (error) {
                          console.error("Error getting checkout URL:", error);
                        } finally {
                          // Reset loading state
                          setButtonLoadingState(prev => ({ ...prev, [plan.name]: false }));
                        }
                      }}
                      disabled={buttonLoadingState[plan.name]}
                    >
                      {buttonLoadingState[plan.name] ? (
                        <div className="flex items-center justify-center">
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></span>
                          <span>Processing...</span>
                        </div>
                      ) : (
                        currentPlan.planType === plan.name && currentPlan.isMonthly ? 
                          "Current Plan" : 
                          (currentPlan.planType === plan.name && !currentPlan.isMonthly ? 
                            "Resubscribe" : 
                            (plan.freeTrial && !plan.hasHadTrial ? `START ${plan.freeTrialDays}-DAY FREE TRIAL` : "Subscribe"))
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
