"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap, Minus, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Toast } from "@/components/ui/toast";

// Define interface for plan objects
interface Plan {
  name: string;
  price: string;
  bundlePrice?: string;
  description: string;
  features: string[];
  variantId: string;
  purchaseUrl: string;
  quantity: number;
  fixedQuantity?: boolean;
  popular?: boolean;
}

// Define the plans based on the provided information
const plans: Plan[] = [
  {
    name: "Starter",
    price: "$59",
    description: "For individuals getting started",
    features: [
      "450 DMs per day",
      "25,000 Lead Credits",
      "1 Twitter Account",
      "Advanced AI personalization",
      "Priority email support",
      "Unlimited message history"
    ],
    variantId: "714799",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/3295469d-2f93-4ebc-85d8-df07aebec36e",
    quantity: 1
  },
  {
    name: "Growth",
    price: "$49",
    bundlePrice: "$147",
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
    fixedQuantity: true
  },
  {
    name: "Elite",
    price: "$39",
    bundlePrice: "$195",
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
    fixedQuantity: true
  }
];

export default function SubscriptionSettings() {
  const { userId } = useUser();
  const { toast } = useToast();
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    leadCredits: number;
    planType: string | null;
    isMonthly: boolean;
    customerPortalUrl?: string | null;
    updatePaymentMethodUrl?: string | null;
    createdAt?: Date | null;
    subscriptionId?: string | null;
    updatedAt?: Date | null;
  }>({
    name: "Free",
    leadCredits: 0,
    planType: null,
    isMonthly: false,
    subscriptionId: null
  });
  const [loading, setLoading] = useState(true);
  // Add a state to track which button is loading
  const [buttonLoadingState, setButtonLoadingState] = useState<{
    [key: string]: boolean;
  }>({});
  // No longer need to track quantity for individual plans as they have fixed quantities

  // Add state for plan change dialog
  const [planChangeDialog, setPlanChangeDialog] = useState<{
    isOpen: boolean;
    targetPlan: Plan | null;
    isUpgrade: boolean;
  }>({
    isOpen: false,
    targetPlan: null,
    isUpgrade: false
  });

  // Add new state to track prorated amount
  const [proratedAmount, setProratedAmount] = useState<string | null>(null);

  // Update the fetchUserCredits function to be accessible outside useEffect
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
          createdAt: data.createdAt,
          subscriptionId: data.subscriptionId,
          updatedAt: data.updatedAt
        });
      }
    } catch (error) {
      console.error("Error fetching user credits:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update useEffect to use fetchUserCredits
  useEffect(() => {
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

  // Function to handle opening checkout URLs
  const openCheckoutWithRetry = (checkoutUrl: string) => {
    // Store the checkout URL in sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pendingCheckoutUrl', checkoutUrl);
    }
    
    // Simply open the checkout URL in a new tab
    window.open(checkoutUrl, "_blank");
  };

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
    
    if (currentPlan.isMonthly) {
      return "Active subscription";
    } else {
      return "Cancelled subscription";
    }
  };

  // Update function to calculate grace period status based on billing cycle
  const getGracePeriodStatus = () => {
    if (!currentPlan.createdAt || currentPlan.isMonthly) return null;
    
    // Use updatedAt to determine when the last payment was made
    const lastRenewalDate = new Date(currentPlan.updatedAt || currentPlan.createdAt);
    
    // Calculate when the next renewal would have been (1 month after last renewal)
    const nextRenewalDate = new Date(lastRenewalDate);
    nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    
    // This is when grace period ends - on the date of what would have been the next renewal
    const gracePeriodEnd = nextRenewalDate;
    
    const now = new Date();
    const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 0) {
      return "Grace period expired. Your campaigns have been stopped.";
    } else {
      return `Grace period: ${daysRemaining} days remaining before your campaigns stop.`;
    }
  };

  // New function to get a more detailed explanation of subscription status
  const getSubscriptionStatusExplanation = () => {
    if (!currentPlan.planType) return null;
    
    if (currentPlan.isMonthly) {
      return `Your subscription is active. You have ${currentPlan.leadCredits} lead credits available.`;
    } else {
      // Cancelled subscription
      const gracePeriod = getGracePeriodStatus();
      if (gracePeriod && gracePeriod.includes("expired")) {
        return "Your subscription has been cancelled and the grace period has expired. Your campaigns have been stopped.";
      } else if (gracePeriod) {
        return `Your subscription has been cancelled. You can continue using your remaining ${currentPlan.leadCredits} lead credits during the grace period. ${gracePeriod}`;
      } else {
        return "Your subscription status could not be determined.";
      }
    }
  };

  // Use this function to safely close the dialog
  const closePlanChangeDialog = () => {
    setPlanChangeDialog({
      isOpen: false,
      targetPlan: null,
      isUpgrade: false
    });
    // Clear the prorated amount when closing the dialog
    setProratedAmount(null);
  };

  // Update handlePlanChange to always use checkout URL for simplicity
  const handlePlanChange = async (plan: Plan) => {
    try {
      // Set loading state for this specific plan button
      setButtonLoadingState(prev => ({ ...prev, [plan.name]: true }));
      
      // If the plan is the same as current plan, do nothing
      if (currentPlan.planType === plan.name && currentPlan.isMonthly) {
        console.log("Already on this plan");
        setButtonLoadingState(prev => ({ ...prev, [plan.name]: false }));
        return;
      }
      
      // Always use the checkout flow for all plan changes for simplicity
      // This ensures a clean payment process and avoids proration complexity
      
      // Get checkout URL first
      const checkoutUrl = await getDirectLemonSqueezyUrl(plan);
      
      // If user has an existing subscription, we'll cancel it after the new one is activated
      // The webhook will handle this automatically based on the user ID
      
      // Close the dialog now that we're proceeding with checkout
      closePlanChangeDialog();
      
      // Open checkout using the enhanced retry function
      openCheckoutWithRetry(checkoutUrl);
      
      toast({
        title: "Checkout Started",
        description: `We're preparing your ${plan.name} plan. Please complete the checkout process.`,
        variant: "default"
      });
      
    } catch (error) {
      console.error("Error during plan change process:", error);
      toast({
        title: "Error Processing Request",
        description: "There was an error processing your request. Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      // Reset loading state
      setButtonLoadingState(prev => ({ ...prev, [plan.name]: false }));
    }
  };

  // Helper function to get max credits for a plan
  function getPlanMaxCredits(planType: string): number {
    switch(planType) {
      case "Starter":
        return 25000;
      case "Growth":
        return 75000;
      case "Elite":
        return 125000;
      case "free":
        return 2000;
      default:
        return 25000;
    }
  }

  // Add function to calculate estimated prorated amount (this is an estimate, actual amount will be calculated by Lemon Squeezy)
  const calculateProratedAmount = (currentPlan: string, targetPlan: string): string => {
    // Get current plan price without $ and convert to number
    const currentPlanObj = plans.find(p => p.name === currentPlan);
    const targetPlanObj = plans.find(p => p.name === targetPlan);
    
    if (!currentPlanObj || !targetPlanObj) return "$0";
    
    // Use bundlePrice if available, otherwise use price
    const currentPrice = parseFloat((currentPlanObj.bundlePrice || currentPlanObj.price).replace('$', ''));
    const targetPrice = parseFloat((targetPlanObj.bundlePrice || targetPlanObj.price).replace('$', ''));
    
    // Assume we're halfway through the billing cycle on average (adjust if needed)
    // This is just an estimate - Lemon Squeezy will calculate the actual amount
    const proratedDifference = (targetPrice - currentPrice) / 2;
    
    return `$${proratedDifference.toFixed(2)}`;
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <Card className="border-slate-700 dark:bg-slate-800/60 shadow-md">
        <CardHeader className="dark:border-slate-700">
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
                    {currentPlan.planType === "free" ? "Free" : currentPlan.planType || "Free"}
                  </h3>
                  {currentPlan.planType ? (
                    <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Current Plan</Badge>
                  ) : (
                    <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Free Forever</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {(!currentPlan.planType || currentPlan.planType === "free") && (
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                          <span>50 DMs per day (1,500/month)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                          <span>2,000 Lead Credits</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                          <span>1 Twitter Account</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                          <span>Basic AI personalization</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                          <span>Email support</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                          <span>30 days message history</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {currentPlan.isMonthly ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50">
                        Active Subscription
                      </Badge>
                    </div>
                  ) : currentPlan.planType && currentPlan.planType !== "free" ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50">
                        Cancelled
                      </Badge>
                      {getGracePeriodStatus() && (
                        <span className="ml-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                          {getGracePeriodStatus()}
                        </span>
                      )}
                    </div>
                  ) : null}
                  
                  {/* Credits display with visual indicator */}
                  {currentPlan.planType && (
                    <div className="mt-4 mb-2">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Available Lead Credits:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{currentPlan.leadCredits.toLocaleString()}</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-1">
                        <div 
                          className="bg-green-600 h-2.5 rounded-full dark:bg-green-500" 
                          style={{ 
                            width: `${Math.min(100, (currentPlan.leadCredits / getPlanMaxCredits(currentPlan.planType)) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {!currentPlan.isMonthly && !currentPlan.planType && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      Subscribe to a plan to get more lead credits for your campaigns.
                    </p>
                  )}
                  
                  {!currentPlan.isMonthly && currentPlan.planType && currentPlan.planType !== "free" && (
                    <p className="text-xs text-red-700 dark:text-red-400">
                      {getGracePeriodStatus() && getGracePeriodStatus()?.includes("expired") ? (
                        "Your subscription has been cancelled and the grace period has expired. Your campaigns have been stopped."
                      ) : getGracePeriodStatus() ? (
                        <>Your subscription has been cancelled. You can continue using your remaining lead credits during the grace period. {getGracePeriodStatus()}</>
                      ) : (
                        "Your subscription has been cancelled. Subscribe again to get more lead credits."
                      )}
                    </p>
                  )}
                  
                  {currentPlan.planType === "free" && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      You&apos;re on the free plan with 2,000 lead credits. Upgrade to a paid plan for more features and credits.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap w-full gap-2">
                {currentPlan.planType && currentPlan.planType !== "free" ? (
                  <>
                    <Button 
                      size="sm"
                      className="text-xs sm:text-sm dark:bg-neutral-600 dark:hover:bg-neutral-700"
                      variant="secondary"
                      onClick={() => {
                        if (currentPlan.customerPortalUrl) {
                          window.open(currentPlan.customerPortalUrl, "_blank");
                        } else {
                          alert("No subscription management portal available. Please contact support.");
                        }
                      }}
                    >
                      <CreditCard className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                      Manage Subscription
                    </Button>
                    {currentPlan.updatePaymentMethodUrl && (
                      <Button 
                        size="sm"
                        className="text-xs sm:text-sm dark:bg-neutral-600 dark:hover:bg-neutral-700"
                        variant="secondary"
                        onClick={() => {
                          if (typeof currentPlan.updatePaymentMethodUrl === 'string') {
                            window.open(currentPlan.updatePaymentMethodUrl, "_blank");
                          }
                        }}
                      >
                        <CreditCard className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                        Update Payment
                      </Button>
                    )}
                  </>
                ) : (
                  <Button 
                    size="sm"
                    className="text-xs sm:text-sm dark:bg-purple-600 dark:hover:bg-purple-700"
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
                        <span className="text-white">Processing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4 text-white" />
                        <span className="text-white">{currentPlan.planType === "free" ? "Upgrade Plan" : "Get Started"}</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Change Confirmation Dialog */}
      <Dialog 
        open={planChangeDialog.isOpen} 
        onOpenChange={(open) => {
          if (!open) closePlanChangeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {planChangeDialog.isUpgrade ? (
                <>
                  <span className="text-green-600 dark:text-green-400">Upgrade</span> to {planChangeDialog.targetPlan?.name}
                </>
              ) : (
                <>
                  <span className="text-amber-600 dark:text-amber-400">Downgrade</span> to {planChangeDialog.targetPlan?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pt-2 space-y-2">
                {planChangeDialog.isUpgrade ? (
                  <>
                    <div>
                      You are upgrading from <strong>{currentPlan.planType}</strong> to <strong>{planChangeDialog.targetPlan?.name}</strong>.
                    </div>
                    <div className="my-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Plan Change Process
                      </h4>
                      <ul className="mt-1 text-sm text-green-700 dark:text-green-400 space-y-1">
                        <li>• You&apos;ll be taken to the checkout page to complete your payment</li>
                        <li>• Your previous plan will be automatically canceled when the new one is active</li>
                        <li>• Your existing credits will be preserved</li>
                        <li>• New features will be available immediately after payment</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      You are downgrading from <strong>{currentPlan.planType}</strong> to <strong>{planChangeDialog.targetPlan?.name}</strong>.
                    </div>
                    <div className="my-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                      <h4 className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> Plan Change Process
                      </h4>
                      <ul className="mt-1 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                        <li>• You&apos;ll be taken to the checkout page to complete your payment</li>
                        <li>• Your previous plan will be automatically canceled when the new one is active</li>
                        <li>• Your existing credits will be preserved</li>
                        <li>• Your account will be limited to the new plan&apos;s features immediately</li>
                      </ul>
                    </div>
                  </>
                )}
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-2">
                  By confirming, you agree to the plan change terms.
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-between mt-4 gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={closePlanChangeDialog}
              className="mt-2 sm:mt-0"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={() => {
                if (planChangeDialog.targetPlan) {
                  handlePlanChange(planChangeDialog.targetPlan);
                }
              }}
              className={cn(
                planChangeDialog.isUpgrade 
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700" 
                  : "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
              )}
              disabled={buttonLoadingState[planChangeDialog.targetPlan?.name || ""]}
            >
              {buttonLoadingState[planChangeDialog.targetPlan?.name || ""] ? (
                <div className="flex items-center justify-center">
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></span>
                  <span>Processing...</span>
                </div>
              ) : (
                `Confirm ${planChangeDialog.isUpgrade ? "Upgrade" : "Downgrade"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plans Comparison */}
      <Card className="border-slate-700 dark:bg-slate-800/60 shadow-md">
        <CardHeader className="dark:border-slate-700">
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative border-slate-600 dark:bg-slate-900/80 shadow-md backdrop-blur-sm",
                  plan.popular && "border-primary dark:border-purple-500",
                  currentPlan.planType === plan.name && currentPlan.isMonthly && "bg-muted dark:bg-slate-700/50"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 right-4 dark:bg-purple-600 dark:border dark:border-purple-400 dark:text-white">
                    Most Popular
                  </Badge>
                )}
                {currentPlan.planType === plan.name && currentPlan.isMonthly && (
                  <Badge className="absolute -top-2 left-4 bg-green-500 dark:bg-green-600 dark:border dark:border-green-500 text-white">
                    Current Plan
                  </Badge>
                )}
                {currentPlan.planType === plan.name && !currentPlan.isMonthly && (
                  <Badge className="absolute -top-2 left-4 bg-red-500 dark:bg-red-600 dark:border dark:border-red-500 text-white">
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
                        <span className="text-3xl font-bold text-foreground">
                          {plan.bundlePrice || plan.price}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {plan.fixedQuantity ? `/month` : `/month`}
                        </span>
                        {plan.bundlePrice && (
                          <span className="text-md ml-1 block w-full mt-1">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {plan.price} per account × {plan.quantity} accounts
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    
                    <ul className="space-y-2">
                        {plan.features.map((feature) => (
                            <li key={feature} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                              <span>{feature}</span>
                            </li>
                        ))}
                      </ul>
                  </div>
                  
                  <div className="mt-6">
                    <Button
                      className={cn(
                        "w-full mt-auto",
                        currentPlan.planType === plan.name && currentPlan.isMonthly 
                          ? "dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:hover:bg-slate-700" 
                          : "dark:bg-purple-600 dark:hover:bg-purple-700 dark:text-white"
                      )}
                      variant={currentPlan.planType === plan.name && currentPlan.isMonthly ? "outline" : "default"}
                      onClick={async () => {
                        // Set loading state for this specific plan button
                        setButtonLoadingState(prev => ({ ...prev, [plan.name]: true }));
                        
                        try {
                          // If the user already has a subscription and it's active,
                          // show the confirmation dialog first
                          if (currentPlan.subscriptionId && currentPlan.isMonthly) {
                            // Determine if this is an upgrade or downgrade
                            const planValues = {
                              "Starter": 1,
                              "Growth": 2,
                              "Elite": 3
                            };
                            
                            const currentValue = planValues[currentPlan.planType as keyof typeof planValues] || 0;
                            const newValue = planValues[plan.name as keyof typeof planValues] || 0;
                            
                            const isUpgrade = newValue > currentValue;
                            
                            // Open dialog for confirmation
                            setPlanChangeDialog({
                              isOpen: true,
                              targetPlan: plan,
                              isUpgrade
                            });
                            setProratedAmount(isUpgrade ? calculateProratedAmount(currentPlan.planType as string, plan.name) : null);
                          } else {
                            // Otherwise, use the checkout flow for new subscriptions
                            // Get checkout URL first
                            const checkoutUrl = await getDirectLemonSqueezyUrl(plan);
                            
                            // If user has an existing subscription but it's not active (e.g., cancelled),
                            // cancel it before subscribing to a new plan
                            if (currentPlan.subscriptionId && 
                                currentPlan.planType !== plan.name && 
                                !currentPlan.isMonthly) {
                              
                              console.log(`Cancelling existing subscription ${currentPlan.subscriptionId} before subscribing to ${plan.name}`);
                              
                              const cancelResponse = await fetch('/api/subscription/cancel', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  subscriptionId: currentPlan.subscriptionId,
                                  isUpgrade: true // Flag to indicate this is part of an upgrade
                                }),
                              });
                              
                              if (!cancelResponse.ok) {
                                const errorData = await cancelResponse.json();
                                console.error('Error cancelling subscription before upgrade:', errorData);
                                throw new Error(`Failed to cancel subscription: ${errorData.error || 'Unknown error'}`);
                              }
                              
                              console.log(`Successfully cancelled subscription before subscribing to ${plan.name}`);
                            }
                            
                            // Open checkout using the enhanced retry function
                            openCheckoutWithRetry(checkoutUrl);
                          }
                        } catch (error) {
                          console.error("Error during plan change process:", error);
                          alert("There was an error processing your request. Please try again or contact support.");
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
                            (currentPlan.isMonthly ? "Change Plan" : "Subscribe")
                          )
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
