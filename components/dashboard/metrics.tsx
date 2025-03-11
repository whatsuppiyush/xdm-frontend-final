"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, Target, BarChart, Twitter } from "lucide-react";
import LeadCredits from "@/components/dashboard/lead-credits";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/user-context";
import Link from "next/link";

export default function DashboardMetrics() {
  const { userId } = useUser();
  const [metrics, setMetrics] = useState([
    {
      title: "Total Messages Sent",
      value: "N/A",
      icon: MessageSquare,
      change: "Subscribe to get started",
    },
    {
      title: "Connected Accounts",
      value: "0",
      icon: Twitter,
      change: "No accounts connected",
    },
    {
      title: "Campaigns Created",
      value: "N/A",
      icon: Target,
      change: "Subscribe to get started",
    },
  ]);
  
  const [loading, setLoading] = useState(true);
  const [twitterAccounts, setTwitterAccounts] = useState(0);
  const [hasPaidPlan, setHasPaidPlan] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!userId) return;
      
      try {
        // Fetch Twitter accounts count
        const accountsResponse = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
        const accountsData = await accountsResponse.json();
        const accountsCount = accountsData.accounts?.length || 0;
        setTwitterAccounts(accountsCount);
        
        // Fetch user subscription status
        const userResponse = await fetch("/api/user/credits");
        const userData = await userResponse.json();
        const isPaid = !!userData.planType;
        setHasPaidPlan(isPaid);
        
        // Set metrics based on subscription status
        if (isPaid) {
          // Fetch total messages sent
          const messagesResponse = await fetch(`/api/messages?userId=${userId}`);
          const messagesData = await messagesResponse.json();
          const totalMessages = messagesData.messages?.length || 0;
          
          // Count total message items sent
          let totalMessageItems = 0;
          messagesData.messages?.forEach((message) => {
            totalMessageItems += message.messages?.length || 0;
          });
          
          setMetrics([
            {
              title: "Total Messages Sent",
              value: totalMessageItems > 0 ? totalMessageItems.toString() : "0",
              icon: MessageSquare,
              change: "Active",
            },
            {
              title: "Connected Accounts",
              value: accountsCount.toString(),
              icon: Twitter,
              change: accountsCount > 0 ? "Active" : "No accounts connected",
            },
            {
              title: "Campaigns Created",
              value: totalMessages > 0 ? totalMessages.toString() : "0",
              icon: Target,
              change: "Active",
            },
          ]);
        } else {
          setMetrics([
            {
              title: "Total Messages Sent",
              value: "N/A",
              icon: MessageSquare,
              change: "Subscribe to get started",
            },
            {
              title: "Connected Accounts",
              value: accountsCount.toString(),
              icon: Twitter,
              change: accountsCount > 0 ? "Active" : "No accounts connected",
            },
            {
              title: "Campaigns Created",
              value: "N/A",
              icon: Target,
              change: "Subscribe to get started",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [userId]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric, index) => (
        <Card key={index} className="w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {metric.title}
            </CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">
              {metric.change}
            </p>
          </CardContent>
        </Card>
      ))}
      
      <LeadCredits twitterAccountsCount={twitterAccounts} />
    </div>
  );
}
