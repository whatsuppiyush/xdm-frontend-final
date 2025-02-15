"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const campaignMetrics = [
  {
    name: "SaaS Founders Outreach",
    totalSent: 450,
    replyRate: "18.9%",
    conversionRate: "37.6%",
    status: "Active",
  },
  {
    name: "Marketing Leaders",
    totalSent: 380,
    replyRate: "16.3%",
    conversionRate: "45.2%",
    status: "Active",
  },
  {
    name: "Startup CTOs",
    totalSent: 420,
    replyRate: "22.6%",
    conversionRate: "47.4%",
    status: "Paused",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8" data-oid="mnq205q">
      <div className="flex justify-between items-center" data-oid="5y_xzl2">
        <h1 className="text-3xl font-bold" data-oid="2y6qjre">
          Campaign Analytics
        </h1>
      </div>

      <Card data-oid="i8lnyv0">
        <CardHeader data-oid="ans9t3s">
          <CardTitle data-oid="tjn07eo">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent data-oid="kh683h0">
          <Table data-oid="va:qn3r">
            <TableHeader data-oid="6b65:-2">
              <TableRow data-oid="m3sz9.k">
                <TableHead data-oid="fr5qi-2">Campaign</TableHead>
                <TableHead className="text-right" data-oid="ub4q-a3">
                  Messages Sent
                </TableHead>
                <TableHead className="text-right" data-oid="644h.xx">
                  Reply Rate
                </TableHead>
                <TableHead className="text-right" data-oid="t:zvra3">
                  Conversion Rate
                </TableHead>
                <TableHead data-oid="lzs1vnq">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-oid="io1lpo2">
              {campaignMetrics.map((campaign) => (
                <TableRow key={campaign.name} data-oid="2p7.y8h">
                  <TableCell className="font-medium" data-oid="k:ja0sx">
                    {campaign.name}
                  </TableCell>
                  <TableCell className="text-right" data-oid="5d7mtuy">
                    {campaign.totalSent}
                  </TableCell>
                  <TableCell className="text-right" data-oid="2w9ir0l">
                    {campaign.replyRate}
                  </TableCell>
                  <TableCell className="text-right" data-oid="ig2hr.d">
                    {campaign.conversionRate}
                  </TableCell>
                  <TableCell data-oid="82fv97.">
                    <Badge
                      variant={
                        campaign.status === "Active" ? "default" : "secondary"
                      }
                      data-oid="d4pb7:b"
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
