'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomProgress } from '@/components/ui/custom-progress';

export default function QuotaUsage() {
  const dailyQuota = {
    used: 836,
    total: 1350,
    percentage: (836 / 1350) * 100,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Message Quota</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Messages Sent Today</p>
                <p className="text-sm text-muted-foreground">
                  {dailyQuota.used} / {dailyQuota.total}
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {dailyQuota.used} / {dailyQuota.total}
              </span>
            </div>
            <CustomProgress value={dailyQuota.percentage} />
          </div>
          
          <div className="pt-4 text-sm text-muted-foreground">
            <p>Quota resets in 4 hours 32 minutes</p>
            <p className="mt-2">
              Average daily usage: 78% of quota
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}