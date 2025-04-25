"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileSettings from "@/components/settings/profile-settings";
import SubscriptionSettings from "@/components/settings/subscription-settings";
import TwitterAccounts from "@/components/settings/twitter-accounts";
import DoNotContact from "@/components/settings/do-not-contact";
import { useUser } from "@/contexts/user-context";
import { Loader2, Twitter, UserCircle, CreditCard, Shield } from "lucide-react";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Create a wrapper component that uses useSearchParams
function SettingsContent() {
  const { userId, isLoading } = useUser();
  const [activeTab, setActiveTab] = useState("twitter");
  const [showComingSoon, setShowComingSoon] = useState(false);
  const searchParams = useSearchParams();

  // Use useCallback to memoize the function
  const handleTabChange = useCallback((value: string) => {
    if (value === "dnc") {
      setShowComingSoon(true);
    }
    setActiveTab(value);
  }, []);

  useEffect(() => {
    // Check if tab parameter exists and set active tab accordingly
    const tabParam = searchParams?.get("tab");
    if (tabParam === "profile") {
      setActiveTab("profile");
    } else if (tabParam === "subscription") {
      setActiveTab("subscription");
    } else if (tabParam === "dnc") {
      setActiveTab("dnc");
    } else {
      setActiveTab("twitter"); // Default to twitter if no valid tab is specified
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin dark:text-gray-400" />
      </div>
    );
  }

  // Add a guard for userId
  if (!userId) {
    return <div className="p-8 dark:text-gray-300">Please log in to view settings</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center py-4 border-b border-gray-200 dark:border-[#242f44]">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <div className="w-full bg-gray-50/90 dark:bg-[#131c2e]/70 p-2.5 rounded-xl shadow-sm">
          <TabsList className="w-full grid grid-cols-4 gap-2 dark:bg-[#0c1221]/90 p-1.5 rounded-lg">
            <TabsTrigger 
              value="twitter" 
              className="flex items-center justify-center gap-2 font-medium text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-lg 
              transition-all duration-300 delay-75 ease-out
              text-gray-600 dark:text-gray-300
              hover:bg-gradient-to-b hover:from-white hover:to-gray-50 hover:text-blue-600 dark:hover:from-[#223047] dark:hover:to-[#1a2536] dark:hover:text-blue-400
              hover:shadow-md hover:scale-[1.02] transform  
              data-[state=active]:scale-100 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white 
              data-[state=active]:shadow-lg dark:data-[state=active]:from-blue-600 dark:data-[state=active]:to-blue-700 dark:data-[state=active]:text-white 
              dark:data-[state=active]:shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
            >
              <Twitter className="h-4 w-4" />
              <span className="hidden sm:inline">Twitter</span>
              <span className="sm:hidden">Twitter</span>
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="flex items-center justify-center gap-2 font-medium text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-lg 
              transition-all duration-300 delay-75 ease-out
              text-gray-600 dark:text-gray-300
              hover:bg-gradient-to-b hover:from-white hover:to-gray-50 hover:text-purple-600 dark:hover:from-[#223047] dark:hover:to-[#1a2536] dark:hover:text-purple-400
              hover:shadow-md hover:scale-[1.02] transform  
              data-[state=active]:scale-100 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white 
              data-[state=active]:shadow-lg dark:data-[state=active]:from-purple-600 dark:data-[state=active]:to-purple-700 dark:data-[state=active]:text-white 
              dark:data-[state=active]:shadow-[0_4px_12px_rgba(168,85,247,0.3)]"
            >
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger 
              value="subscription" 
              className="flex items-center justify-center gap-2 font-medium text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-lg 
              transition-all duration-300 delay-75 ease-out
              text-gray-600 dark:text-gray-300
              hover:bg-gradient-to-b hover:from-white hover:to-gray-50 hover:text-green-600 dark:hover:from-[#223047] dark:hover:to-[#1a2536] dark:hover:text-green-400
              hover:shadow-md hover:scale-[1.02] transform  
              data-[state=active]:scale-100 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white 
              data-[state=active]:shadow-lg dark:data-[state=active]:from-green-600 dark:data-[state=active]:to-green-700 dark:data-[state=active]:text-white 
              dark:data-[state=active]:shadow-[0_4px_12px_rgba(34,197,94,0.3)]"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Subscription</span>
              <span className="sm:hidden">Plan</span>
            </TabsTrigger>
            <TabsTrigger 
              value="dnc" 
              className="flex items-center justify-center gap-2 font-medium text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-lg 
              transition-all duration-300 delay-75 ease-out
              text-gray-600 dark:text-gray-300
              hover:bg-gradient-to-b hover:from-white hover:to-gray-50 hover:text-amber-600 dark:hover:from-[#223047] dark:hover:to-[#1a2536] dark:hover:text-amber-400
              hover:shadow-md hover:scale-[1.02] transform  
              data-[state=active]:scale-100 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white 
              data-[state=active]:shadow-lg dark:data-[state=active]:from-amber-600 dark:data-[state=active]:to-amber-700 dark:data-[state=active]:text-white 
              dark:data-[state=active]:shadow-[0_4px_12px_rgba(217,119,6,0.3)]"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Do Not Contact</span>
              <span className="sm:hidden">DNC</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="twitter" className="mt-4 w-full bg-white dark:bg-transparent rounded-lg shadow-sm border border-gray-200 dark:border-transparent p-1 sm:p-4">
          <TwitterAccounts userId={userId} />
        </TabsContent>

        <TabsContent value="profile" className="mt-4 w-full bg-white dark:bg-transparent rounded-lg shadow-sm border border-gray-200 dark:border-transparent p-1 sm:p-4">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="subscription" className="mt-4 w-full bg-white dark:bg-transparent rounded-lg shadow-sm border border-gray-200 dark:border-transparent p-1 sm:p-4">
          <SubscriptionSettings />
        </TabsContent>

        <TabsContent value="dnc" className="mt-4 w-full bg-white dark:bg-transparent rounded-lg shadow-sm border border-gray-200 dark:border-transparent p-1 sm:p-4">
          <DoNotContact showComingSoon={showComingSoon} setShowComingSoon={setShowComingSoon} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Main page component with Suspense boundary
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
