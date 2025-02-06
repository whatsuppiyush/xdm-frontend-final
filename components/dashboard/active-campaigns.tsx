'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CustomProgress } from '@/components/ui/custom-progress';

const campaigns = [
  {
    name: 'SaaS Founders Outreach',
    progress: 65,
    sent: 292,
    total: 450,
    status: 'Active',
  },
  {
    name: 'Marketing Leaders',
    progress: 32,
    sent: 144,
    total: 450,
    status: 'Active',
  },
  {
    name: 'Startup CTOs',
    progress: 89,
    sent: 400,
    total: 450,
    status: 'Paused',
  },
];

export default function ActiveCampaigns() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Campaigns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {campaigns.map((campaign) => (
            <div key={campaign.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.sent} / {campaign.total} messages sent
                  </p>
                </div>
                <span className={`text-sm ${
                  campaign.status === 'Active' ? 'text-green-500' : 'text-yellow-500'
                }`}>
                  {campaign.status}
                </span>
              </div>
              <CustomProgress value={campaign.progress} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}