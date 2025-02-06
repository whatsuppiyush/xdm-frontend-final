'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart } from '@/components/ui/chart';

interface CampaignPerformanceProps {
  detailed?: boolean;
}

export default function CampaignPerformance({ detailed = false }: CampaignPerformanceProps) {
  const data = [
    { name: 'SaaS Founders', sent: 450, responses: 85, conversions: 32 },
    { name: 'Marketing Leaders', sent: 380, responses: 62, conversions: 28 },
    { name: 'Startup CTOs', sent: 420, responses: 95, conversions: 45 },
  ];

  return (
    <Card className={detailed ? 'col-span-2' : ''}>
      <CardHeader>
        <CardTitle>Campaign Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <BarChart
            data={data}
            index="name"
            categories={['sent', 'responses', 'conversions']}
            colors={['chart-1', 'chart-2', 'chart-3']}
            valueFormatter={(value) => value.toString()}
            stack={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}