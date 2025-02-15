"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomProgress } from "@/components/ui/custom-progress";

const campaigns = [
  {
    name: "SaaS Founders Outreach",
    progress: 65,
    sent: 292,
    total: 450,
    status: "Active",
  },
  {
    name: "Marketing Leaders",
    progress: 32,
    sent: 144,
    total: 450,
    status: "Active",
  },
  {
    name: "Startup CTOs",
    progress: 89,
    sent: 400,
    total: 450,
    status: "Paused",
  },
];

export default function ActiveCampaigns() {
  return (
    <Card data-oid="oj463uj">
      <CardHeader data-oid="mycwl:m">
        <CardTitle data-oid="pkwpczm">Active Campaigns</CardTitle>
      </CardHeader>
      <CardContent data-oid="b6iqhya">
        <div className="space-y-6" data-oid="df07xyn">
          {campaigns.map((campaign) => (
            <div key={campaign.name} className="space-y-2" data-oid="2qv4p_-">
              <div
                className="flex items-center justify-between"
                data-oid="qkrhx3x"
              >
                <div data-oid="r-r5k43">
                  <p className="font-medium" data-oid="40d.q.q">
                    {campaign.name}
                  </p>
                  <p
                    className="text-sm text-muted-foreground"
                    data-oid="ao293y7"
                  >
                    {campaign.sent} / {campaign.total} messages sent
                  </p>
                </div>
                <span
                  className={`text-sm ${
                    campaign.status === "Active"
                      ? "text-green-500"
                      : "text-yellow-500"
                  }`}
                  data-oid="8yr9x40"
                >
                  {campaign.status}
                </span>
              </div>
              <CustomProgress value={campaign.progress} data-oid="w7esbu6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
