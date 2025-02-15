"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const currentPlan = {
  name: "Professional",
  billingCycle: "monthly",
  nextBilling: "2024-04-20",
  amount: "$79",
};

const plans = [
  {
    name: "Starter",
    price: "$29",
    description: "Perfect for individuals and small teams",
    features: [
      "1 Twitter Account",
      "Up to 1,000 leads",
      "2 Active Campaigns",
      "Basic Analytics",
      "Email Support",
    ],

    purchaseUrl:
      "https://aiblogbot.lemonsqueezy.com/buy/d64b89bb-58a7-4a55-be92-35288ae7e60e",
  },
  {
    name: "Professional",
    price: "$79",
    description: "For growing businesses",
    features: [
      "3 Twitter Accounts",
      "Up to 5,000 leads",
      "5 Active Campaigns",
      "Advanced Analytics",
      "Priority Support",
      "Campaign Templates",
    ],

    popular: true,
    purchaseUrl:
      "https://aiblogbot.lemonsqueezy.com/buy/d64b89bb-58a7-4a55-be92-35288ae7e60e",
  },
  {
    name: "Enterprise",
    price: "$199",
    description: "For large organizations",
    features: [
      "Unlimited Twitter Accounts",
      "Unlimited leads",
      "Unlimited Campaigns",
      "Custom Analytics",
      "24/7 Priority Support",
      "API Access",
      "Custom Integration",
      "Dedicated Account Manager",
    ],

    purchaseUrl:
      "https://aiblogbot.lemonsqueezy.com/buy/580821f5-3a70-4989-abdd-c642d37213e4",
  },
];

export default function SubscriptionSettings() {
  return (
    <div className="space-y-8" data-oid="z.:q:g7">
      {/* Current Plan Card */}
      <Card data-oid="unfro4h">
        <CardHeader data-oid="4kz52wo">
          <CardTitle data-oid="hco9kxd">Current Plan</CardTitle>
        </CardHeader>
        <CardContent data-oid="i.ya:vd">
          <div
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            data-oid="iovj-2o"
          >
            <div className="space-y-2" data-oid="nh_5blf">
              <div className="flex items-center gap-2" data-oid="z15nmwd">
                <h3 className="text-xl font-semibold" data-oid=".cy.ebj">
                  {currentPlan.name}
                </h3>
                <Badge variant="secondary" data-oid="cvpf_ki">
                  Current Plan
                </Badge>
              </div>
              <div
                className="text-sm text-muted-foreground space-y-1"
                data-oid="d81vqhp"
              >
                <p data-oid=".s4kgw8">Billed {currentPlan.billingCycle}</p>
                <p data-oid="b_-wq83">
                  Next billing date: {currentPlan.nextBilling}
                </p>
              </div>
            </div>
            <div className="flex gap-3" data-oid=".rhv60m">
              <Button variant="outline" data-oid="6h:eavv">
                <CreditCard className="mr-2 h-4 w-4" data-oid="cpmjubl" />
                Manage Subscription
              </Button>
              <Button data-oid="7dph_p5">
                <Zap className="mr-2 h-4 w-4" data-oid="sv3jz8m" />
                Upgrade Plan
              </Button>
            </div>
          </div>
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
                className={cn("relative", plan.popular && "border-primary")}
                data-oid="p7ddn3q"
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 right-4" data-oid="t-p_2:_">
                    Most Popular
                  </Badge>
                )}
                <CardContent className="space-y-6" data-oid="36gy:qh">
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
                    variant="default"
                    onClick={() => window.open(plan.purchaseUrl, "_blank")}
                    data-oid=".q8lgsg"
                  >
                    Upgrade
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
