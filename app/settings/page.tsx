"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileSettings from "@/components/settings/profile-settings";
import SubscriptionSettings from "@/components/settings/subscription-settings";
import TwitterAccounts from "@/components/settings/twitter-accounts";
import DoNotContact from "@/components/settings/do-not-contact";
import { useUser } from "@/contexts/user-context";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Create a wrapper component that uses useSearchParams
function SettingsContent() {
  const { userId, isLoading } = useUser();
  const [activeTab, setActiveTab] = useState("twitter");
  const searchParams = useSearchParams();

  // Use useCallback to memoize the function
  const handleTabChange = useCallback((value: string) => {
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
    <div className="w-full px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center py-4 border-b border-gray-200 dark:border-[#242f44]">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <div className="w-full bg-gray-50 dark:bg-[#131c2e]/50 p-1.5 rounded-lg">
          <TabsList className="w-full grid grid-cols-4 gap-1 dark:bg-[#0c1221]">
            <TabsTrigger 
              value="twitter" 
              className="text-[11px] leading-tight sm:text-sm py-2 px-1 sm:px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:text-gray-300 dark:data-[state=active]:bg-[#1c2739] dark:data-[state=active]:text-white"
            >
              Twitter
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="text-[11px] leading-tight sm:text-sm py-2 px-1 sm:px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:text-gray-300 dark:data-[state=active]:bg-[#1c2739] dark:data-[state=active]:text-white"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger 
              value="subscription" 
              className="text-[11px] leading-tight sm:text-sm py-2 px-1 sm:px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:text-gray-300 dark:data-[state=active]:bg-[#1c2739] dark:data-[state=active]:text-white"
            >
              Subscription
            </TabsTrigger>
            <TabsTrigger 
              value="dnc" 
              className="text-[11px] leading-tight sm:text-sm py-2 px-1 sm:px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm dark:text-gray-300 dark:data-[state=active]:bg-[#1c2739] dark:data-[state=active]:text-white"
            >
              Do Not Contact
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
          <DoNotContact />
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
