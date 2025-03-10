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
  const [activeTab, setActiveTab] = useState("profile");
  const searchParams = useSearchParams();

  // Use useCallback to memoize the function
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  useEffect(() => {
    // Check if tab parameter exists and set active tab accordingly
    const tabParam = searchParams?.get("tab");
    if (tabParam === "twitter") {
      setActiveTab("twitter");
    } else if (tabParam === "subscription") {
      setActiveTab("subscription");
    } else if (tabParam === "dnc") {
      setActiveTab("dnc");
    } else {
      setActiveTab("profile"); // Default to profile if no valid tab is specified
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Add a guard for userId
  if (!userId) {
    return <div className="p-8">Please log in to view settings</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="twitter">Twitter Accounts</TabsTrigger>
          <TabsTrigger value="dnc">Do Not Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionSettings />
        </TabsContent>

        <TabsContent value="twitter">
          <TwitterAccounts userId={userId} />
        </TabsContent>

        <TabsContent value="dnc">
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
