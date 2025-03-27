"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Plus, Zap } from "lucide-react";
import DashboardMetrics from "@/components/dashboard/metrics";
import TutorialDialog from "@/components/dashboard/tutorial-dialog";
import { useUser } from "@/contexts/user-context";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { userId } = useUser();
  const [planDetails, setPlanDetails] = useState<{
    name: string;
    leadCredits: number;
    planType: string | null;
    isMonthly: boolean;
    isTrialActive: boolean;
    trialStatus: string | null;
    dmsPerDay: number;
    hadPreviousTrial: boolean;
  }>({
    name: "No Active Plan",
    leadCredits: 0,
    planType: null,
    isMonthly: false,
    isTrialActive: false,
    trialStatus: null,
    dmsPerDay: 450,
    hadPreviousTrial: false
  });

  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch("/api/user/credits");
        const data = await response.json();
        
        // Calculate DMs per day based on plan type
        let dmsPerDay = 450; // Default for trial
        if (data.planType === "Starter") {
          dmsPerDay = 450;
        } else if (data.planType === "Growth") {
          dmsPerDay = 1350;
        } else if (data.planType === "Elite") {
          dmsPerDay = 2250;
        }

        setPlanDetails({
          name: data.planType || "No Active Plan",
          leadCredits: data.leadCredits,
          planType: data.planType,
          isMonthly: data.isMonthly || false,
          isTrialActive: data.isTrialActive || false,
          trialStatus: data.trialStatus,
          dmsPerDay,
          hadPreviousTrial: data.hadPreviousTrial || false
        });
      } catch (error) {
        console.error("Error fetching user credits:", error);
      }
    };

    fetchUserCredits();
  }, [userId]);

  // Function to get remaining trial days
  const getRemainingDays = () => {
    if (planDetails.trialStatus?.startsWith('active-')) {
      return planDetails.trialStatus.replace('active-', '');
    }
    return null;
  };

  // Function to get plan status badge
  const getPlanStatusBadge = () => {
    // Don't show badge if plan is active or trial is active
    if (planDetails.isTrialActive || planDetails.isMonthly) {
      return null;
    }
    
    if (planDetails.planType) {
      return (
        <Badge className="bg-red-500 text-white hover:bg-red-600">
          Inactive
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-700 text-white border-slate-600">
        No Plan
      </Badge>
    );
  };

  // Function to get action button configuration
  const getActionButton = () => {
    // For first time users with no previous trial
    if (!planDetails.planType && !planDetails.hadPreviousTrial) {
      return {
        text: "Start Free Trial",
        action: () => window.location.href = '/settings?tab=subscription'
      };
    }
    
    // For users with active plans or previous trials
    if (planDetails.isTrialActive || planDetails.isMonthly) {
      return {
        text: "Manage Plan",
        action: () => window.location.href = '/settings?tab=subscription'
      };
    }
    
    // For users with expired/cancelled plans
    return {
      text: "Upgrade to starter",
      action: () => window.location.href = '/settings?tab=subscription'
    };
  };

  const actionButton = getActionButton();

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
        {/* Header section */}
        <div className="mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Welcome to XAutoDM</h1>
          <p className="text-md md:text-lg text-slate-500 dark:text-slate-400 mt-2">
            Automate your X direct messages to grow your audience
          </p>
        </div>
        
        {/* Status Cards */}
        <section>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">Account Status</h2>
          <DashboardMetrics />
        </section>
        
        {/* Subscription Card - Only show if no active plan/trial */}
        {!planDetails.isTrialActive && !planDetails.isMonthly && (
          <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-md overflow-hidden">
            <div className="p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start md:items-center gap-4">
                  <div className="bg-purple-500 p-3 rounded-lg shadow-sm">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl md:text-2xl font-bold text-white">
                        {planDetails.name}
                      </h2>
                      {getPlanStatusBadge()}
                    </div>
                    <p className="text-gray-300 text-sm md:text-base">
                      {planDetails.dmsPerDay.toLocaleString()} DMs/day limit
                    </p>
                    {/* Only show trial message for first time users with no plan */}
                    {!planDetails.planType && !planDetails.hadPreviousTrial && !planDetails.isTrialActive && (
                      <p className="text-purple-300 text-sm">
                        Start your 3-day free trial today!
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
                  <Button 
                    className={`${!planDetails.planType && !planDetails.hadPreviousTrial 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-purple-600/90 hover:bg-purple-700'} 
                      text-white shadow-sm transition-all duration-200`}
                    onClick={actionButton.action}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {actionButton.text}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
        
        {/* Tutorial Video */}
        <section>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200">Tutorial Video</h2>
          <div 
            className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl overflow-hidden aspect-video shadow-md cursor-pointer"
            onClick={() => setTutorialOpen(true)}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-6">XAutoDM Tutorial</h3>
              
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full hover:bg-white/30 transition-all duration-200">
                <Play className="h-8 w-8 text-white" />
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-5 text-left bg-gradient-to-t from-black/70 to-transparent">
                <h4 className="text-lg md:text-xl font-semibold text-white">How to automate your X messages</h4>
                <p className="text-gray-200 mt-1 text-sm md:text-base">
                  Learn how to set up your first automated messaging campaign in under 5 minutes.
                </p>
              </div>
            </div>
          </div>
        </section>

        <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
      </main>
    </div>
  );
}