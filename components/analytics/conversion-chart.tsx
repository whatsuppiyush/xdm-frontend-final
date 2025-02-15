"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/ui/chart";

export default function ConversionChart() {
  const data = [
    { date: "2024-03-01", rate: 32 },
    { date: "2024-03-02", rate: 35 },
    { date: "2024-03-03", rate: 30 },
    { date: "2024-03-04", rate: 38 },
    { date: "2024-03-05", rate: 42 },
    { date: "2024-03-06", rate: 40 },
    { date: "2024-03-07", rate: 45 },
  ].map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card data-oid="phrvx58">
      <CardHeader data-oid="2nelz-a">
        <CardTitle data-oid="kl8c0j7">Conversion Rate Trend</CardTitle>
      </CardHeader>
      <CardContent data-oid="v_us5h7">
        <div className="h-[300px]" data-oid="09791sj">
          <LineChart
            data={data}
            index="date"
            categories={["rate"]}
            colors={["chart-1"]}
            valueFormatter={(value) => `${value}%`}
            showLegend={false}
            data-oid="ujh5aw9"
          />
        </div>
      </CardContent>
    </Card>
  );
}
