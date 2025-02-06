'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Zap } from 'lucide-react';

const currentPlan = {
  name: 'Professional',
  billingCycle: 'monthly',
  nextBilling: '2024-04-20',
  amount: '$79',
};

const plans = [
  {
    name: 'Starter',
    price: '$29',
    description: 'Perfect for individuals and small teams',
    features: [
      '1 Twitter Account',
      'Up to 1,000 leads',
      '2 Active Campaigns',
      'Basic Analytics',
      'Email Support',
    ],
    current: false,
  },
  {
    name: 'Professional',
    price: '$79',
    description: 'For growing businesses',
    features: [
      '3 Twitter Accounts',
      'Up to 5,000 leads',
      '5 Active Campaigns',
      'Advanced Analytics',
      'Priority Support',
      'Campaign Templates',
    ],
    current: true,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    description: 'For large organizations',
    features: [
      'Unlimited Twitter Accounts',
      'Unlimited leads',
      'Unlimited Campaigns',
      'Custom Analytics',
      '24/7 Priority Support',
      'API Access',
      'Custom Integration',
      'Dedicated Account Manager',
    ],
    current: false,
  },
];

export default function SubscriptionSettings() {
  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">{currentPlan.name}</h3>
                <Badge variant="secondary">Current Plan</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Billed {currentPlan.billingCycle}</p>
                <p>Next billing date: {currentPlan.nextBilling}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscription
              </Button>
              <Button>
                <Zap className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            </div>
          </div>
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
              <div
                key={plan.name}
                className={`rounded-lg border p-6 space-y-4 relative ${
                  plan.current ? 'border-primary' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 right-4">
                    Most Popular
                  </Badge>
                )}
                <div className="space-y-2">
                  <h3 className="font-medium text-lg">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
                <ul className="space-y-2 min-h-[280px]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.current ? 'outline' : 'default'}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}