'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart } from '@/components/ui/chart';

export default function DailyActivity() {
  const data = [
    { hour: '00:00', messages: 12 },
    { hour: '03:00', messages: 8 },
    { hour: '06:00', messages: 15 },
    { hour: '09:00', messages: 45 },
    { hour: '12:00', messages: 68 },
    { hour: '15:00', messages: 72 },
    { hour: '18:00', messages: 55 },
    { hour: '21:00', messages: 25 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Message Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <AreaChart
            data={data}
            index="hour"
            categories={['messages']}
            colors={['chart-2']}
            valueFormatter={(value) => value.toString()}
            showLegend={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}