"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Plus, Zap } from "lucide-react";
import DashboardMetrics from "@/components/dashboard/metrics";
import OnboardingChecklist from "@/components/dashboard/onboarding-checklist";
import { useUser } from "@/contexts/user-context";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
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

  const handleVideoClick = () => {
    setIsVideoPlaying(true);
  };

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
        {/* Header section with animation */}
        <motion.div 
          className="mb-2" 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.h1 
            className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Welcome to XAutoDM
          </motion.h1>
          <motion.p 
            className="text-md md:text-lg text-slate-500 dark:text-slate-400 mt-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Automate your{" "}
            <span className="relative inline-block group">
              <span className="relative z-10 font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500 dark:from-purple-400 dark:to-blue-400 px-1">
                X direct messages
              </span>
              {/* Gradient underline with subtle animation */}
              <span className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-blue-500 dark:from-purple-400 dark:to-blue-400 rounded-full opacity-70 animate-shimmer"></span>
              {/* Subtle highlight effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 dark:from-purple-500/20 dark:to-blue-500/20 rounded-md -z-10 group-hover:animate-pulse duration-1000"></span>
            </span>
            {" "}to grow your audience
          </motion.p>
        </motion.div>
        
        {/* Onboarding Checklist */}
        <OnboardingChecklist />
        
        {/* Status Cards with animated title */}
        <section>
          <motion.h2 
            className="text-xl md:text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Account Status
          </motion.h2>
          <DashboardMetrics />
        </section>
        
        {/* Subscription Card - Only show if no active plan/trial */}
        {!planDetails.isTrialActive && !planDetails.isMonthly && (
          <motion.section 
            className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-md overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start md:items-center gap-4">
                  <motion.div 
                    className="bg-purple-500 p-3 rounded-lg shadow-sm"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <Zap className="h-5 w-5 text-white" />
                  </motion.div>
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
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      className={`${!planDetails.planType && !planDetails.hadPreviousTrial 
                        ? 'bg-purple-600 hover:bg-purple-700 relative overflow-hidden group' 
                        : 'bg-purple-600/90 hover:bg-purple-700'} 
                        text-white shadow-sm transition-all duration-200`}
                      onClick={actionButton.action}
                    >
                      {/* Ripple effect for trial button */}
                      {!planDetails.planType && !planDetails.hadPreviousTrial && (
                        <span className="absolute inset-0 overflow-hidden rounded-md">
                          <span className="absolute left-0 aspect-square w-8 -translate-x-full rounded-full bg-white/20 group-hover:animate-[ripple_0.7s_ease-out_infinite]"></span>
                        </span>
                      )}
                      <Zap className={`h-4 w-4 mr-2 ${!planDetails.planType && !planDetails.hadPreviousTrial ? 'animate-pulse' : ''}`} />
                      {actionButton.text}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.section>
        )}
        
        {/* Tutorial Video with animations */}
        <section>
          <motion.h2 
            className="text-xl md:text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            Tutorial Video
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.2 }}
            className="relative rounded-xl overflow-hidden shadow-lg cursor-pointer w-full group transition-all duration-300 hover:shadow-xl"
            style={{ paddingBottom: '56.25%' }} /* 16:9 aspect ratio */
            onClick={handleVideoClick}
          >
            {isVideoPlaying ? (
              // Embedded video player (shown when play is clicked on desktop)
              <iframe
                className="absolute top-0 left-0 w-full h-full z-10"
                src="https://www.youtube.com/embed/OZUfUaEAHbA?autoplay=1&modestbranding=1&rel=0&fs=1&showinfo=0&color=white"
                title="XAutoDM Tutorial"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder="0"
              />
            ) : (
              <>
                {/* Video Thumbnail with Gradient Overlay */}
                <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
                  <img 
                    src="/thumbnail.png" 
                    alt="XAutoDM Tutorial Video Thumbnail" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Simplified gradient overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-60 group-hover:opacity-40 transition-opacity duration-300"></div>
                </div>
                
                {/* Overlay Elements with Glass Effect */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  {/* Colorful play button with glow effect */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-70 animate-pulse"></div>
                    <div className="backdrop-blur-md bg-gradient-to-r from-purple-600 to-blue-600 p-5 rounded-full border border-white/30 hover:from-purple-500 hover:to-blue-500 transition-all duration-300 group-hover:scale-110 relative z-10 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                      <Play className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  <p className="text-white font-medium mt-6 px-6 py-2 rounded-full backdrop-blur-sm bg-gradient-to-r from-purple-600/80 to-blue-600/80 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    How to use xAutoDM
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </section>
      </main>
    </div>
  );
}