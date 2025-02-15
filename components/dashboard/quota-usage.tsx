"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomProgress } from "@/components/ui/custom-progress";

export default function QuotaUsage() {
  const dailyQuota = {
    used: 836,
    total: 1350,
    percentage: (836 / 1350) * 100,
  };

  return (
    <Card data-oid="6ec2ssv">
      <CardHeader data-oid="80y5jij">
        <CardTitle data-oid="zxeh4gs">Daily Message Quota</CardTitle>
      </CardHeader>
      <CardContent data-oid="l:e5mvc">
        <div className="space-y-4" data-oid="1:m.-t8">
          <div className="space-y-2" data-oid="fvx6yc-">
            <div
              className="flex items-center justify-between"
              data-oid="8iffauy"
            >
              <div data-oid="om7b5n7">
                <p className="font-medium" data-oid="8t786n3">
                  Messages Sent Today
                </p>
                <p className="text-sm text-muted-foreground" data-oid="l7azy:m">
                  {dailyQuota.used} / {dailyQuota.total}
                </p>
              </div>
              <span
                className="text-sm text-muted-foreground"
                data-oid="md_:w9f"
              >
                {dailyQuota.used} / {dailyQuota.total}
              </span>
            </div>
            <CustomProgress value={dailyQuota.percentage} data-oid=".j6w1t4" />
          </div>

          <div
            className="pt-4 text-sm text-muted-foreground"
            data-oid="na_.lg3"
          >
            <p data-oid="9a-o2eb">Quota resets in 4 hours 32 minutes</p>
            <p className="mt-2" data-oid="nwex4-8">
              Average daily usage: 78% of quota
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
