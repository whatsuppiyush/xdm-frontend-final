"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";

// Define the plans based on the provided information
const plans = [
  {
    name: "Mini",
    price: "$19",
    description: "Perfect for individuals just getting started",
    features: [
      "50 DMs per day",
      "3,000 Lead Credits",
      "1,500 DMs per month",
      "1 Twitter Account",
      "Basic Analytics",
      "Email Support",
    ],
    variantId: "714632",
    purchaseUrl: "https://x-dm.lemonsqueezy.com/buy/1fbd56ff-37e6-4294-b98e-171a73c58e73",
  },
  {
    name: "Starter",
    price: "$57",
    description: "For growing businesses",
    features: [
      "200 DMs per day",
      "12,000 Lead Credits",
      "6,000 DMs per month",
      "1 Twitter Account",
      "Advanced Analytics",
      "Priority Support",
    ],
    popular: true,
    variantId: "714642",
    purchaseUrl: "https://x-dm.lemonsqueezy.com/buy/73a378d2-344a-4466-af2d-fe2de72e399b",
  },
  {
    name: "Pro",
    price: "$97",
    description: "For power users and teams",
    features: [
      "450 DMs per day",
      "27,000 Lead Credits",
      "13,500 DMs per month",
      "Multiple Twitter Accounts",
      "Comprehensive Analytics",
      "24/7 Priority Support",
      "API Access",
    ],
    variantId: "714652",
    purchaseUrl: "https://x-dm.lemonsqueezy.com/buy/16cc2dcc-224e-497a-b6f6-a12086038192",
  },
];

export default function SubscriptionSettings() {
  const { userId } = useUser();
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    leadCredits: number;
    dmCredits: number;
    planType: string | null;
  }>({
    name: "No Plan",
    leadCredits: 0,
    dmCredits: 0,
    planType: null,
  });
  const [loading, setLoading] = useState(true);

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
            dmCredits: data.dmCredits || 0,
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

  return (
    <div className="space-y-8" data-oid="z.:q:g7">
      {/* Current Plan Card */}
      <Card data-oid="unfro4h">
        <CardHeader data-oid="4kz52wo">
          <CardTitle data-oid="hco9kxd">Current Plan</CardTitle>
        </CardHeader>
        <CardContent data-oid="i.ya:vd">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div
              className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              data-oid="iovj-2o"
            >
              <div className="space-y-2" data-oid="nh_5blf">
                <div className="flex items-center gap-2" data-oid="z15nmwd">
                  <h3 className="text-xl font-semibold" data-oid=".cy.ebj">
                    {currentPlan.planType || "No Active Plan"}
                  </h3>
                  {currentPlan.planType && (
                    <Badge variant="secondary" data-oid="cvpf_ki">
                      Current Plan
                    </Badge>
                  )}
                </div>
                <div
                  className="text-sm text-muted-foreground space-y-1"
                  data-oid="d81vqhp"
                >
                  <p data-oid=".s4kgw8">Billed monthly</p>
                  <p data-oid="b_-wq83">
                    Available Lead Credits: {currentPlan.leadCredits}
                  </p>
                  <p data-oid="dm-credits">
                    Available DM Credits: {currentPlan.dmCredits}
                  </p>
                </div>
              </div>
              <div className="flex gap-3" data-oid=".rhv60m">
                {currentPlan.planType ? (
                  <>
                    <Button 
                      variant="outline" 
                      data-oid="6h:eavv"
                      onClick={() => window.open("https://app.lemonsqueezy.com/my-orders", "_blank")}
                    >
                      <CreditCard className="mr-2 h-4 w-4" data-oid="cpmjubl" />
                      Manage Subscription
                    </Button>
                    <Button 
                      data-oid="7dph_p5"
                      onClick={() => {
                        const nextPlan = currentPlan.planType === "Mini" 
                          ? plans[1].purchaseUrl 
                          : currentPlan.planType === "Starter" 
                            ? plans[2].purchaseUrl 
                            : plans[2].purchaseUrl;
                        window.open(nextPlan, "_blank");
                      }}
                    >
                      <Zap className="mr-2 h-4 w-4" data-oid="sv3jz8m" />
                      Upgrade Plan
                    </Button>
                  </>
                ) : (
                  <Button 
                    data-oid="7dph_p5"
                    onClick={() => window.open(plans[0].purchaseUrl, "_blank")}
                  >
                    <Zap className="mr-2 h-4 w-4" data-oid="sv3jz8m" />
                    Get Started
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Comparison */}
      <Card data-oid="xtfh5kr">
        <CardHeader data-oid="pe47g93">
          <CardTitle data-oid="4gg9c::">Available Plans</CardTitle>
        </CardHeader>
        <CardContent data-oid="3j1e:fq">
          <div className="grid gap-6 md:grid-cols-3" data-oid="t2ugjil">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative", 
                  plan.popular && "border-primary",
                  currentPlan.planType === plan.name && "bg-muted"
                )}
                data-oid="p7ddn3q"
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 right-4" data-oid="t-p_2:_">
                    Most Popular
                  </Badge>
                )}
                {currentPlan.planType === plan.name && (
                  <Badge className="absolute -top-2 left-4 bg-green-500" data-oid="current-plan">
                    Current Plan
                  </Badge>
                )}
                <CardContent className="space-y-6 pt-6" data-oid="36gy:qh">
                  <div className="space-y-2" data-oid="syfu.g.">
                    <h3 className="font-medium text-lg" data-oid="1cb:m:x">
                      {plan.name}
                    </h3>
                    <div
                      className="flex items-baseline gap-1"
                      data-oid="-9gmt7b"
                    >
                      <span className="text-3xl font-bold" data-oid="wfjyxjn">
                        {plan.price}
                      </span>
                      <span
                        className="text-sm text-muted-foreground"
                        data-oid="kajr:_."
                      >
                        /month
                      </span>
                    </div>
                    <p
                      className="text-sm text-muted-foreground"
                      data-oid="r9s3pnq"
                    >
                      {plan.description}
                    </p>
                  </div>
                  <ul className="space-y-2 min-h-[280px]" data-oid="4bs5tys">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm"
                        data-oid=".k_wiq:"
                      >
                        <Check
                          className="h-4 w-4 text-primary shrink-0"
                          data-oid="zgy1ak4"
                        />
                        <span data-oid="q4-ehra">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={currentPlan.planType === plan.name ? "outline" : "default"}
                    onClick={() => window.open(plan.purchaseUrl, "_blank")}
                    data-oid=".q8lgsg"
                  >
                    {currentPlan.planType === plan.name ? "Current Plan" : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
