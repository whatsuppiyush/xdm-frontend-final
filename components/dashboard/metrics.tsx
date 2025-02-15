"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, Target, BarChart } from "lucide-react";

const metrics = [
  {
    title: "Total Messages Sent",
    value: "2,345",
    icon: MessageSquare,
    change: "+12.5%",
  },
  {
    title: "Active Leads",
    value: "1,234",
    icon: Users,
    change: "+7.2%",
  },
  {
    title: "Conversion Rate",
    value: "24.3%",
    icon: Target,
    change: "+4.1%",
  },
  {
    title: "Active Campaigns",
    value: "12",
    icon: BarChart,
    change: "0%",
  },
];

export default function DashboardMetrics() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      data-oid="3yecmaj"
    >
      {metrics.map((metric) => (
        <Card key={metric.title} data-oid="on:shgp">
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2"
            data-oid="e8ch8y6"
          >
            <CardTitle className="text-sm font-medium" data-oid="3ffoljs">
              {metric.title}
            </CardTitle>
            <metric.icon
              className="h-4 w-4 text-muted-foreground"
              data-oid="_p.pljf"
            />
          </CardHeader>
          <CardContent data-oid="o7a-gxc">
            <div className="text-2xl font-bold" data-oid="_29z8sy">
              {metric.value}
            </div>
            <p className="text-xs text-muted-foreground" data-oid="1c63bid">
              {metric.change} from last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
