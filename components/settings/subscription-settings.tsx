"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { Slider } from "@/components/ui/slider";

// Define the plans based on the provided information
const plans = [
  {
    name: "Mini",
    price: "$19",
    description: "Perfect for individuals just getting started",
    features: [
      "50 DMs per day",
      "3,000 Lead Credits",
      "1 Twitter Account",
      "Basic Analytics",
      "Email Support",
    ],
    variantId: "462170",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/2653f93c-dcef-43a5-ab21-4fe784700175",
  },
  {
    name: "Starter",
    price: "$57",
    description: "For growing businesses",
    features: [
      "200 DMs per day",
      "12,000 Lead Credits",
      "1 Twitter Account",
      "Advanced Analytics",
      "Priority Support",
    ],
    popular: true,
    variantId: "462171",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/3295469d-2f93-4ebc-85d8-df07aebec36e",
  },
  {
    name: "Pro",
    price: "$97",
    description: "For power users and teams",
    features: [
      "450 DMs per day (per account)",
      "27,000 Lead Credits (per account)",
      "Multiple Twitter Accounts",
      "Comprehensive Analytics",
      "24/7 Priority Support",
      "API Access",
    ],
    variantId: "462172",
    purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/68f27604-6772-4cec-941f-c1e83e9b6ebe",
    tiers: [
      { 
        name: "Standard Tier", 
        minQuantity: 1, 
        maxQuantity: 2,
        pricePerAccount: 97,
        variantId: "462172",
        purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/68f27604-6772-4cec-941f-c1e83e9b6ebe"
      },
      { 
        name: "Team Tier", 
        minQuantity: 3, 
        maxQuantity: 4,
        pricePerAccount: 75,
        variantId: "469279",
        purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/194b3397-2038-492d-9184-5718800219d0"
      },
      { 
        name: "Growth Tier", 
        minQuantity: 5, 
        maxQuantity: 9,
        pricePerAccount: 67,
        variantId: "469280",
        purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/fa5fdff6-31e0-49d7-8166-9d13e8e45205"
      },
      { 
        name: "Enterprise Tier", 
        minQuantity: 10, 
        maxQuantity: 15,
        pricePerAccount: 49,
        variantId: "469282",
        purchaseUrl: "https://xautodm.lemonsqueezy.com/buy/e8e0faaf-488d-4d9f-bb8e-c6a248917adb"
      }
    ]
  },
];

export default function SubscriptionSettings() {
  const { userId } = useUser();
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    leadCredits: number;
    planType: string | null;
  }>({
    name: "No Plan",
    leadCredits: 0,
    planType: null,
  });
  const [loading, setLoading] = useState(true);
  const [proQuantity, setProQuantity] = useState(1);

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

  // Get current price per account for Pro plan based on quantity
  const getProPriceForQuantity = (quantity: number) => {
    const proPlan = plans[2]; // Pro plan
    
    // Add null check before accessing tiers
    if (!proPlan || !proPlan.tiers) {
      return 0; // Or some default price
    }
    
    const tier = proPlan.tiers.find(t =>
      quantity >= t.minQuantity && quantity <= t.maxQuantity
    );
    
    return tier ? tier.pricePerAccount : 97; // Return tier price or default
  };

  // Get current tier for Pro plan based on quantity
  const getProTierForQuantity = (quantity: number) => {
    const proPlan = plans[2]; // Pro plan
    
    // Add null check before accessing tiers
    if (!proPlan || !proPlan.tiers) {
      return "Standard Tier"; // Default tier name
    }
    
    return proPlan.tiers.find(
      tier => quantity >= tier.minQuantity && quantity <= tier.maxQuantity
    )?.name || "Standard Tier";
  };

  // Get the current tier object for Pro plan based on quantity
  const getProTierObjectForQuantity = (quantity: number) => {
    const proPlan = plans[2]; // Pro plan
    
    // Add null check before accessing tiers
    if (!proPlan || !proPlan.tiers) {
      return { 
        name: "Standard Tier", 
        minQuantity: 1, 
        maxQuantity: 2,
        pricePerAccount: 97,
        variantId: "462172",
        purchaseUrl: plans[2].purchaseUrl
      }; // Default tier object
    }
    
    return proPlan.tiers.find(
      tier => quantity >= tier.minQuantity && quantity <= tier.maxQuantity
    ) || proPlan.tiers[0]; // Default to first tier if not found
  };

  // Calculate total price and savings
  const calculateProTotalPrice = (quantity: number) => {
    const tier = getProTierObjectForQuantity(quantity);
    const pricePerAccount = tier.pricePerAccount;
    const totalPrice = pricePerAccount * quantity;
    const regularPrice = 97 * quantity; // Regular price without volume discount
    const savings = regularPrice - totalPrice;
    
    // Each Pro account gets 27,000 lead credits
    const leadCreditsPerAccount = 27000;
    const totalLeadCredits = leadCreditsPerAccount * quantity;
    
    return {
      pricePerAccount,
      totalPrice,
      savings,
      totalDMs: 13500 * quantity,
      totalLeadCredits
    };
  };

  const proDetails = calculateProTotalPrice(proQuantity);

  // Test function for Lemon Squeezy URL format
  const getDirectLemonSqueezyUrl = (plan: any, quantity: number) => {
    try {
      console.log("Original Purchase URL:", plan.purchaseUrl);
      
      // Get the tier for this quantity to use the correct purchase URL
      if (plan.name === "Pro") {
        const tier = getProTierObjectForQuantity(quantity);
        console.log("Selected tier:", tier.name, "Price per account:", tier.pricePerAccount);
        console.log("Selected quantity:", quantity);
        
        // Use the tier-specific purchase URL with quantity parameter
        const checkoutUrl = `${tier.purchaseUrl}?quantity=${quantity}&checkout[custom][user_id]=${userId}`;
        console.log("Final checkout URL:", checkoutUrl);
        return checkoutUrl;
      }
      
      // For non-Pro plans, use the original URL
      const checkoutUrl = `${plan.purchaseUrl}?quantity=${quantity}&checkout[custom][user_id]=${userId}`;
      console.log("Final checkout URL:", checkoutUrl);
      return checkoutUrl;
    } catch (error) {
      console.error("Error creating checkout URL:", error);
      return plan.purchaseUrl + `?quantity=${quantity}&checkout[custom][user_id]=${userId}`;
    }
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
                  <p>Billed monthly</p>
                  <p>Available Lead Credits: {currentPlan.leadCredits}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {currentPlan.planType ? (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => window.open("https://app.lemonsqueezy.com/my-orders", "_blank")}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Manage Subscription
                    </Button>
                    <Button 
                      onClick={() => {
                        const nextPlanBaseUrl = currentPlan.planType === "Mini" 
                          ? plans[1].purchaseUrl 
                          : currentPlan.planType === "Starter" 
                            ? plans[2].purchaseUrl 
                            : plans[2].purchaseUrl;
                        window.open(getCheckoutUrl(nextPlanBaseUrl), "_blank");
                      }}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Upgrade Plan
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={() => window.open(getCheckoutUrl(plans[0].purchaseUrl), "_blank")}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Get Started
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
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative",
                  plan.popular && "border-primary",
                  currentPlan.planType === plan.name && "bg-muted"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 right-4">
                    Most Popular
                  </Badge>
                )}
                {currentPlan.planType === plan.name && (
                  <Badge className="absolute -top-2 left-4 bg-green-500">
                    Current Plan
                  </Badge>
                )}
                <CardContent className="flex flex-col h-full pt-6">
                  <div className="space-y-6 flex-grow">
                    <div className="space-y-2">
                      <h3 className="font-medium text-lg">
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1">
                        {plan.name === "Pro" ? (
                          <>
                            <span className="text-3xl font-bold">
                              ${proDetails.pricePerAccount.toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              per account / month
                            </span>
                            <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              {getProTierForQuantity(proQuantity)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-bold">
                              {plan.price}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              /month
                            </span>
                          </>
                        )}
                      </div>
                      {plan.name === "Pro" && (
                        <div className="mt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Number of accounts:</span>
                            <span className="font-semibold">{proQuantity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => setProQuantity(Math.max(1, proQuantity - 1))}
                              disabled={proQuantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Slider
                              value={[proQuantity]}
                              min={1}
                              max={15}
                              step={1}
                              className="flex-1"
                              onValueChange={(value) => setProQuantity(value[0])}
                            />
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => setProQuantity(Math.min(15, proQuantity + 1))}
                              disabled={proQuantity >= 15}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>1-2</span>
                            <span>3-4</span>
                            <span>5-9</span>
                            <span>10-15</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>$97/acct</span>
                            <span>$75/acct</span>
                            <span>$67/acct</span>
                            <span>$49/acct</span>
                          </div>
                          <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-md text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 bg-green-500 rounded-full" />
                              <span>
                                <strong>Total: ${proDetails.totalPrice.toFixed(2)}</strong> 
                                {proDetails.savings > 0 && ` (Save $${proDetails.savings.toFixed(2)} with volume discount)`}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    
                    {plan.name === "Pro" ? (
                      <>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium">450 DMs per day (per account)</h4>
                            <p className="text-xs text-muted-foreground">
                              13,500 DMs per month × {proQuantity} = {proDetails.totalDMs.toLocaleString()} total
                            </p>
                            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 w-full" />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium">27,000 Lead Credits (per account)</h4>
                            <p className="text-xs text-muted-foreground">
                              Total: {proDetails.totalLeadCredits.toLocaleString()} lead credits
                            </p>
                            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 w-full" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">What&apos;s included:</h4>
                          <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Connect up to {proQuantity} Twitter {proQuantity === 1 ? 'account' : 'accounts'}</span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Advanced AI personalization</span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Priority email support</span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Unlimited message history</span>
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-4">
                            Cost per DM: ${(proDetails.pricePerAccount / 13500).toFixed(3)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Check className="h-4 w-4 text-primary shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <Button
                      className="w-full"
                      variant={currentPlan.planType === plan.name ? "outline" : "default"}
                      onClick={() => {
                        if (plan.name === "Pro") {
                          // Use the direct URL format with quantity parameter for Lemon Squeezy
                          const checkoutUrl = getDirectLemonSqueezyUrl(plan, proQuantity);
                          console.log("Opening checkout URL:", checkoutUrl);
                          window.open(checkoutUrl, "_blank");
                        } else {
                          window.open(getCheckoutUrl(plan.purchaseUrl), "_blank");
                        }
                      }}
                    >
                      {plan.name === "Pro" ? "Get Pro" : (currentPlan.planType === plan.name ? "Current Plan" : "Subscribe")}
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
