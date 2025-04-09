"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Check, Twitter, Zap, UserPlus, SendHorizontal, Info } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/contexts/user-context";
import { useToast } from "@/components/ui/use-toast";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  buttonText: string;
  completed: boolean;
}

export default function OnboardingChecklist() {
  const { userId } = useUser();
  const { toast } = useToast();
  // Start with isVisible true for server rendering, then let useEffect determine the actual value
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasFreeAccount, setHasFreeAccount] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: "connect-twitter",
      title: "Connect Twitter account",
      description: "Link your Twitter account to send direct messages",
      icon: Twitter,
      href: "/settings?tab=twitter",
      buttonText: "Connect account",
      completed: false,
    },
    {
      id: "import-leads",
      title: "Import leads",
      description: "Add people you want to message we have leads for you",
      icon: UserPlus,
      href: "/leads",
      buttonText: "Import leads",
      completed: false,
    },
    {
      id: "start-campaign",
      title: "Start campaign",
      description: "Create your first messaging campaign",
      icon: SendHorizontal,
      href: "/campaign",
      buttonText: "Create campaign",
      completed: false,
    },
    {
      id: "subscription",
      title: "Subscribe to a plan",
      description: "Choose a subscription plan to continue",
      icon: Zap,
      href: "/settings?tab=subscription",
      buttonText: "Choose plan",
      completed: false,
    },
  ]);

  // Check localStorage on client-side only (useEffect runs only on client)
  useEffect(() => {
    // Check if completion status is in localStorage
    const completedStatus = localStorage.getItem('onboardingCompleted');
    if (completedStatus === 'true') {
      setIsVisible(false);
    }
    setIsInitialized(true);
  }, []);

  // Show welcome toast for free users (only once)
  useEffect(() => {
    if (hasFreeAccount) {
      const hasShownFreeWelcome = localStorage.getItem('shownFreeWelcome');
      if (!hasShownFreeWelcome) {
        toast({
          title: "Welcome to XAutoDM!",
          description: "You've been given 2,000 lead credits on our free plan to get started. Upgrade for more features!",
          variant: "default",
          duration: 6000,
        });
        localStorage.setItem('shownFreeWelcome', 'true');
      }
    }
  }, [hasFreeAccount, toast]);

  // Fetch data for the checklist
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      try {
        // Check Twitter accounts
        const accountsResponse = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
        const accountsData = await accountsResponse.json();
        const hasTwitterAccount = accountsData.accounts?.length > 0;
        
        // Check leads
        const leadsResponse = await fetch(`/api/leads?userId=${userId}`);
        const leadsData = await leadsResponse.json();
        const hasLeads = leadsData.leads?.length > 0;
        
        // Check campaigns
        const messagesResponse = await fetch(`/api/messages?userId=${userId}`);
        const messagesData = await messagesResponse.json();
        const hasCampaigns = messagesData.messages?.length > 0;

        // Check subscription status
        const userResponse = await fetch("/api/user/credits");
        const userData = await userResponse.json();
        const hasSubscription = !!userData.planType;
        const hasFree = userData.planType === "free";
        
        if (hasFree) {
          setHasFreeAccount(true);
          
          // Update subscription description for free users
          setChecklist(prev => 
            prev.map(item => {
              if (item.id === "subscription") {
                return { 
                  ...item, 
                  description: "You have 2,000 lead credits on the free plan. Upgrade for more.",
                  buttonText: "Upgrade plan"
                };
              }
              return item;
            })
          );
        }
        
        // Update checklist with completed items
        setChecklist(prev => 
          prev.map(item => {
            if (item.id === "connect-twitter") return { ...item, completed: hasTwitterAccount };
            if (item.id === "import-leads") return { ...item, completed: hasLeads };
            if (item.id === "start-campaign") return { ...item, completed: hasCampaigns };
            if (item.id === "subscription") return { ...item, completed: hasSubscription };
            return item;
          })
        );
        
        // Check if all items are completed
        const allCompleted = hasTwitterAccount && hasLeads && hasCampaigns && hasSubscription;
        
        // Only update visibility if we haven't already set it as invisible
        if (allCompleted) {
          setIsVisible(false);
          // Store completion status in localStorage to prevent flashing on future visits
          localStorage.setItem('onboardingCompleted', 'true');
        }
        
      } catch (error) {
        console.error("Error fetching onboarding data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isInitialized && userId) {
      fetchData();
    }
  }, [userId, isInitialized]);

  // If we're not visible, don't render anything
  if (!isVisible) return null;
  
  // Only show the UI after client initialization to prevent hydration errors
  if (!isInitialized) {
    return (
      <div className="mb-8 opacity-0">
        <div className="h-[300px]"></div>
      </div>
    );
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mb-8"
    >
      <div className="flex items-center mb-4">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200">
          Onboarding Checklist
        </h2>
        <div className="ml-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full text-xs font-medium text-purple-600 dark:text-purple-400">
          Get Started
        </div>
      </div>
      {hasFreeAccount && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-start gap-2">
          <Info className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">Welcome to XAutoDM!</p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
              You&apos;ve been given 2,000 lead credits on our free plan to get you started. Complete the checklist below to begin using XAutoDM.
            </p>
          </div>
        </div>
      )}
      <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border dark:border-slate-700 rounded-xl shadow-sm overflow-hidden relative">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.4' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '20px 20px'
          }} 
        />
        <CardContent className="p-4 md:p-6 relative">
          <div className="space-y-4 md:space-y-5">
            {checklist.map((item, index) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="flex flex-col sm:flex-row sm:items-center gap-3 relative rounded-lg p-3 bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700"
              >
                {/* Fixed color border - always purple unless explicitly completed and not loading */}
                <div 
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    !isLoading && item.completed ? 'bg-green-500' : 'bg-purple-500'
                  } rounded-l-lg`} 
                />
              
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <AnimatePresence mode="wait">
                    {!isLoading && item.completed ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"
                      >
                        <Check className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-xs font-medium text-purple-600 dark:text-purple-400 ring-offset-background"
                      >
                        {index + 1}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${
                      !isLoading && item.completed ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'
                    } flex-shrink-0`} />
                    <span className={`text-sm font-medium ${
                      !isLoading && item.completed ? 'text-green-600 dark:text-green-400' : ''
                    }`}>{item.title}</span>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between pl-9 sm:pl-0 mt-1 sm:mt-0">
                  <p className="text-xs text-muted-foreground pr-2 line-clamp-2 sm:line-clamp-none">{item.description}</p>
                  
                  {(isLoading || !item.completed) && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild 
                      className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all mt-2 sm:mt-0 rounded-full w-full sm:w-auto whitespace-nowrap flex-shrink-0"
                    >
                      <Link href={item.href}>
                        {item.buttonText}
                      </Link>
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
} 