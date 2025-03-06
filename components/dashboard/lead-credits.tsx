"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Zap, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { Progress } from "@/components/ui/progress";

export default function LeadCredits() {
  const { userId } = useUser();
  const [credits, setCredits] = useState({
    leadCredits: 0,
    dmCredits: 0,
    planType: null as string | null,
    loading: true,
  });

  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch("/api/user/credits");
        const data = await response.json();
        
        setCredits({
          leadCredits: data.leadCredits || 0,
          dmCredits: data.dmCredits || 0,
          planType: data.planType,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching user credits:", error);
        setCredits(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserCredits();
  }, [userId]);

  const getTotalCredits = () => {
    switch (credits.planType) {
      case "Mini":
        return 3000;
      case "Starter":
        return 12000;
      case "Pro":
        return 27000;
      default:
        return 0;
    }
  };

  const getTotalDmCredits = () => {
    switch (credits.planType) {
      case "Mini":
        return 1500;
      case "Starter":
        return 6000;
      case "Pro":
        return 13500;
      default:
        return 0;
    }
  };

  const totalCredits = getTotalCredits();
  const totalDmCredits = getTotalDmCredits();
  const leadPercentage = Math.min(100, (credits.leadCredits / totalCredits) * 100);
  const dmPercentage = Math.min(100, (credits.dmCredits / totalDmCredits) * 100);

  if (credits.loading) {
    return (
      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Loading Credits...</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">--</div>
        </CardContent>
      </Card>
    );
  }

  if (!credits.planType) {
    return (
      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lead Credits</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">No Active Subscription</div>
          <p className="text-xs text-muted-foreground mt-2">
            Purchase a plan to get lead credits
          </p>
          <Button className="mt-4" size="sm">
            <a href="/settings">Purchase Plan</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lead Credits</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{credits.leadCredits.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-2">
            {credits.planType} Plan: {totalCredits.toLocaleString()} total credits
          </p>
          <div className="mt-4">
            <Progress value={leadPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {leadPercentage.toFixed(0)}% used
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">DM Credits</CardTitle>
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{credits.dmCredits.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-2">
            {credits.planType} Plan: {totalDmCredits.toLocaleString()} total DMs/month
          </p>
          <div className="mt-4">
            <Progress value={dmPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {dmPercentage.toFixed(0)}% used
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 