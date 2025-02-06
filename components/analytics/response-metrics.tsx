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

interface ResponseMetricsProps {
  detailed?: boolean;
}

export default function ResponseMetrics({ detailed = false }: ResponseMetricsProps) {
  const metrics = [
    {
      campaign: 'SaaS Founders',
      sent: 450,
      responses: 85,
      responseRate: '18.9%',
      positiveResponses: 32,
      conversionRate: '37.6%',
    },
    {
      campaign: 'Marketing Leaders',
      sent: 380,
      responses: 62,
      responseRate: '16.3%',
      positiveResponses: 28,
      conversionRate: '45.2%',
    },
    {
      campaign: 'Startup CTOs',
      sent: 420,
      responses: 95,
      responseRate: '22.6%',
      positiveResponses: 45,
      conversionRate: '47.4%',
    },
  ];

  return (
    <Card className={detailed ? 'col-span-2' : ''}>
      <CardHeader>
        <CardTitle>Response Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Responses</TableHead>
              <TableHead className="text-right">Response Rate</TableHead>
              <TableHead className="text-right">Positive</TableHead>
              <TableHead className="text-right">Conversion Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.campaign}>
                <TableCell>{metric.campaign}</TableCell>
                <TableCell className="text-right">{metric.sent}</TableCell>
                <TableCell className="text-right">{metric.responses}</TableCell>
                <TableCell className="text-right">{metric.responseRate}</TableCell>
                <TableCell className="text-right">{metric.positiveResponses}</TableCell>
                <TableCell className="text-right">{metric.conversionRate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}