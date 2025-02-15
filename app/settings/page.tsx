"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileSettings from "@/components/settings/profile-settings";
import SubscriptionSettings from "@/components/settings/subscription-settings";
import TwitterAccounts from "@/components/settings/twitter-accounts";
import DoNotContact from "@/components/settings/do-not-contact";
import { useUser } from "@/contexts/user-context";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { userId, isLoading } = useUser();

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        data-oid="wi7vvl-"
      >
        <Loader2 className="h-6 w-6 animate-spin" data-oid="vzsq6j5" />
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8" data-oid="zigr9an">
      <div className="flex justify-between items-center" data-oid="b-.ekon">
        <h1 className="text-3xl font-bold" data-oid="ac1g1o3">
          Settings
        </h1>
      </div>

      <Tabs defaultValue="profile" className="space-y-6" data-oid="sdu2iiv">
        <TabsList data-oid="r71a6ue">
          <TabsTrigger value="profile" data-oid="f4qbx_d">
            Profile
          </TabsTrigger>
          <TabsTrigger value="subscription" data-oid="f8rit69">
            Subscription
          </TabsTrigger>
          <TabsTrigger value="twitter" data-oid="wpejzi.">
            Twitter Accounts
          </TabsTrigger>
          <TabsTrigger value="dnc" data-oid="qgo_y1n">
            Do Not Contact
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" data-oid=":3:0eta">
          <ProfileSettings data-oid="td1sn91" />
        </TabsContent>

        <TabsContent value="subscription" data-oid="4:1n3zn">
          <SubscriptionSettings data-oid="diltl1u" />
        </TabsContent>

        <TabsContent value="twitter" data-oid="hgu26hi">
          <TwitterAccounts userId={userId} data-oid="2o7cnh." />
        </TabsContent>

        <TabsContent value="dnc" data-oid="c_2_:am">
          <DoNotContact data-oid="yzg1k2c" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
