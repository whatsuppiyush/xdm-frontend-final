'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProfileSettings from '@/components/settings/profile-settings';
import SubscriptionSettings from '@/components/settings/subscription-settings';
import TwitterAccounts from '@/components/settings/twitter-accounts';
import DoNotContact from '@/components/settings/do-not-contact';

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
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
          <TwitterAccounts />
        </TabsContent>

        <TabsContent value="dnc">
          <DoNotContact />
        </TabsContent>
      </Tabs>
    </div>
  );
}