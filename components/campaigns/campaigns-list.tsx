'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomProgress } from '@/components/ui/custom-progress';
import { MoreHorizontal, Play, Pause } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const campaigns = [
  {
    id: 1,
    name: 'SaaS Founders Outreach',
    description: 'Targeting SaaS founders with 1k+ followers',
    progress: 65,
    sent: 292,
    total: 450,
    status: 'Active',
    leadList: 'Tech Founders',
    startDate: '2024-03-15',
  },
  {
    id: 2,
    name: 'Marketing Leaders',
    description: 'Outreach to marketing directors and VPs',
    progress: 32,
    sent: 144,
    total: 450,
    status: 'Active',
    leadList: 'Marketing Directors',
    startDate: '2024-03-18',
  },
  {
    id: 3,
    name: 'Startup CTOs',
    description: 'Technical decision makers in startups',
    progress: 89,
    sent: 400,
    total: 450,
    status: 'Paused',
    leadList: 'Startup CTOs',
    startDate: '2024-03-10',
  },
];

export default function CampaignsList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Campaigns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="border rounded-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {campaign.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={campaign.status === 'Active' ? 'default' : 'secondary'}
                  >
                    {campaign.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
                      <DropdownMenuItem>View Analytics</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Delete Campaign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="text-muted-foreground">
                    {campaign.sent} / {campaign.total} messages sent
                  </span>
                </div>
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

              <div className="flex items-center justify-between text-sm">
                <div className="space-x-4">
                  <span>Lead List: {campaign.leadList}</span>
                  <span className="text-muted-foreground">
                    Started {campaign.startDate}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  {campaign.status === 'Active' ? (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Resume
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}