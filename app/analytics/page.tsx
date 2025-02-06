'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const campaignMetrics = [
  {
    name: 'SaaS Founders Outreach',
    totalSent: 450,
    replyRate: '18.9%',
    conversionRate: '37.6%',
    status: 'Active',
  },
  {
    name: 'Marketing Leaders',
    totalSent: 380,
    replyRate: '16.3%',
    conversionRate: '45.2%',
    status: 'Active',
  },
  {
    name: 'Startup CTOs',
    totalSent: 420,
    replyRate: '22.6%',
    conversionRate: '47.4%',
    status: 'Paused',
  },
];

export default function AnalyticsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Campaign Analytics</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Messages Sent</TableHead>
                <TableHead className="text-right">Reply Rate</TableHead>
                <TableHead className="text-right">Conversion Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignMetrics.map((campaign) => (
                <TableRow key={campaign.name}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="text-right">{campaign.totalSent}</TableCell>
                  <TableCell className="text-right">{campaign.replyRate}</TableCell>
                  <TableCell className="text-right">{campaign.conversionRate}</TableCell>
                  <TableCell>
                    <Badge
                      variant={campaign.status === 'Active' ? 'default' : 'secondary'}
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}