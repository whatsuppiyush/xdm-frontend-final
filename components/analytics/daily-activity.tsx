"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart } from "@/components/ui/chart";

export default function DailyActivity() {
  const data = [
    { hour: "00:00", messages: 12 },
    { hour: "03:00", messages: 8 },
    { hour: "06:00", messages: 15 },
    { hour: "09:00", messages: 45 },
    { hour: "12:00", messages: 68 },
    { hour: "15:00", messages: 72 },
    { hour: "18:00", messages: 55 },
    { hour: "21:00", messages: 25 },
  ];

  return (
    <Card data-oid="oskfzv3">
      <CardHeader data-oid="tf7v_:7">
        <CardTitle data-oid="a2215zl">Daily Message Activity</CardTitle>
      </CardHeader>
      <CardContent data-oid="feaw22o">
        <div className="h-[300px]" data-oid="e9s5::y">
          <AreaChart
            data={data}
            index="hour"
            categories={["messages"]}
            colors={["chart-2"]}
            valueFormatter={(value) => value.toString()}
            showLegend={false}
            data-oid="vm_hd:1"
          />
        </div>
      </CardContent>
    </Card>
  );
}
