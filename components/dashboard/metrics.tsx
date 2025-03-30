"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/user-context";
import Link from "next/link";
import { motion } from "framer-motion";

// Add this interface near the top of your file
interface MessageData {
  id: string;
  messages: any[];
  [key: string]: any;
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  button?: {
    label: string;
    href: string;
  };
  delay?: number;
}

// X logo as component
const XLogo = () => {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
};

const MetricCard = ({ title, value, icon: Icon, button, delay = 0 }: MetricCardProps) => {
  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6, 
        delay,
        ease: "easeOut"
      }
    }
  };

  const iconVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: {
        duration: 0.4,
        delay: delay + 0.2,
        ease: "backOut"
      }
    }
  };

  const valueVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: delay + 0.3,
        ease: "easeOut"
      }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        delay: delay + 0.4
      }
    },
    hover: { 
      scale: 1.05,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border dark:border-slate-700 rounded-xl overflow-hidden transition-all hover:shadow-lg relative group h-full flex flex-col">
        {/* Animated gradient border */}
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[1px] group-hover:animate-gradient-x"></div>
        
        {/* Card content */}
        <CardContent className="p-6 relative z-10 backdrop-blur-sm flex-1 flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <motion.div 
              variants={iconVariants}
              className="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-indigo-900/30 p-3 rounded-lg shadow-sm overflow-hidden relative flex-shrink-0"
            >
              {/* Inner glow effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Icon className="h-6 w-6 text-purple-600 dark:text-purple-400 relative z-10" />
            </motion.div>
            
            <div className="flex-1">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
              <motion.p 
                variants={valueVariants} 
                className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-600 dark:from-purple-400 dark:to-blue-400 mt-1"
              >
                {value}
              </motion.p>
              
              {button && (
                <div className="mt-4">
                  <motion.div variants={buttonVariants} whileHover="hover">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild 
                      className="rounded-full text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 transition-all"
                    >
                      <Link href={button.href}>
                        <span className="flex items-center">
                          <span className="mr-1">+</span> {button.label}
                        </span>
                      </Link>
                    </Button>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function DashboardMetrics() {
  const { userId } = useUser();
  const [metrics, setMetrics] = useState([
    {
      title: "Total Messages Sent",
      value: "0",
      icon: MessageSquare,
    },
    {
      title: "X Accounts Connected",
      value: "0",
      icon: XLogo,
      button: {
        label: "Add More",
        href: "/settings?tab=twitter"
      }
    },
    {
      title: "Campaigns Created",
      value: "0",
      icon: BarChart3,
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
          messagesData.messages?.forEach((message: MessageData) => {
            totalMessageItems += message.messages?.length || 0;
            console.log(message);
          });
          
          setMetrics([
            {
              title: "Total Messages Sent",
              value: totalMessageItems > 0 ? totalMessageItems.toString() : "0",
              icon: MessageSquare,
            },
            {
              title: "X Accounts Connected",
              value: accountsCount.toString(),
              icon: XLogo,
              button: {
                label: "Add More",
                href: "/settings?tab=twitter"
              }
            },
            {
              title: "Campaigns Created",
              value: totalMessages > 0 ? totalMessages.toString() : "0",
              icon: BarChart3,
            },
          ]);
        } else {
          setMetrics([
            {
              title: "Total Messages Sent",
              value: "0",
              icon: MessageSquare,
            },
            {
              title: "X Accounts Connected",
              value: accountsCount.toString(),
              icon: XLogo,
              button: {
                label: "Add More",
                href: "/settings?tab=twitter"
              }
            },
            {
              title: "Campaigns Created",
              value: "0",
              icon: BarChart3,
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
    <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3 auto-rows-fr">
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          icon={metric.icon}
          button={metric.button}
          delay={index * 0.15}
        />
      ))}
    </div>
  );
}
