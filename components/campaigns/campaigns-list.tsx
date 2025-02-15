"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomProgress } from "@/components/ui/custom-progress";
import { MoreHorizontal, Play, Pause } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface Campaign {
  id: number;
  name: string;
  description: string;
  progress: number;
  sent: number;
  total: number;
  status: string;
  leadList: string;
  startDate: string;
  message: string;
  dailyLimit: number;
}

export default function CampaignsList() {
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: 1,
      name: "PH Reachout",
      description: "Targeting Product Hunt makers",
      progress: 65,
      sent: 150,
      total: 928,
      status: "Paused",
      leadList: "PH Launch",
      startDate: "2024-03-15",
      message: "Hi {name}, I noticed you're building something interesting on Product Hunt. Would love to connect!",
      dailyLimit: 50
    }
  ]);

  const updateCampaign = (updatedCampaign: Campaign) => {
    setCampaigns(campaigns.map(c => 
      c.id === updatedCampaign.id ? updatedCampaign : c
    ));
    setEditingCampaign(null);
  };

  return (
    <>
      <Card data-oid="mit.3ly">
        <CardHeader data-oid="y:s-i90">
          <CardTitle data-oid="fbn.trm">Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent data-oid="neu7vcc">
          <div className="space-y-6" data-oid="r_c-o5d">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="border rounded-lg p-6 space-y-4"
                data-oid="iok0k_o"
              >
                <div
                  className="flex items-center justify-between"
                  data-oid="0fi-92k"
                >
                  <div data-oid="2lun9h0">
                    <h3 className="font-medium" data-oid="_byyjbf">
                      {campaign.name}
                    </h3>
                    <p
                      className="text-sm text-muted-foreground"
                      data-oid="o0mv29w"
                    >
                      {campaign.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" data-oid="t9v.5k1">
                    <Badge
                      variant={
                        campaign.status === "Active" ? "default" : "secondary"
                      }
                      data-oid="jscsimv"
                    >
                      {campaign.status}
                    </Badge>
                    <DropdownMenu data-oid="i.tgns_">
                      <DropdownMenuTrigger asChild data-oid="5mcwykf">
                        <Button variant="ghost" size="icon" data-oid="dxrnksx">
                          <MoreHorizontal
                            className="h-4 w-4"
                            data-oid="2or8jh0"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" data-oid="3iflq1n">
                        <DropdownMenuItem data-oid="rr8ez9s" onClick={() => setEditingCampaign(campaign)}>
                          Edit Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem data-oid="a4g9tth">
                          View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          data-oid="wfyws9n"
                        >
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2" data-oid="fcsc4tm">
                  <div
                    className="flex justify-between text-sm"
                    data-oid="cknrdtw"
                  >
                    <span data-oid="lts8_4h">Progress</span>
                    <span className="text-muted-foreground" data-oid="_-n3:8g">
                      {campaign.sent} / {campaign.total} messages sent
                    </span>
                  </div>
                  <div data-oid="d1ceu8w">
                    <p className="font-medium" data-oid="32xlrx2">
                      {campaign.name}
                    </p>
                    <p
                      className="text-sm text-muted-foreground"
                      data-oid="2z0-ago"
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
                    data-oid="9t036fu"
                  >
                    {campaign.status}
                  </span>
                </div>

                <CustomProgress value={campaign.progress} data-oid="nj7xi9d" />

                <div
                  className="flex items-center justify-between text-sm"
                  data-oid="fu_5m.."
                >
                  <div className="space-x-4" data-oid="7ng79em">
                    <span data-oid="69alpm4">Lead List: {campaign.leadList}</span>
                    <span className="text-muted-foreground" data-oid="bft81d9">
                      Started {campaign.startDate}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    data-oid="j-ty0.4"
                  >
                    {campaign.status === "Active" ? (
                      <>
                        <Pause className="h-4 w-4" data-oid="o.tc473" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" data-oid="c4j2c_8" />
                        Resume
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Campaign Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>

          {editingCampaign && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  value={editingCampaign.name}
                  onChange={(e) => setEditingCampaign({
                    ...editingCampaign,
                    name: e.target.value
                  })}
                  className="border-2"
                />
              </div>

              <div className="space-y-2">
                <Label>Message Template</Label>
                <Textarea
                  value={editingCampaign.message}
                  onChange={(e) => setEditingCampaign({
                    ...editingCampaign,
                    message: e.target.value
                  })}
                  className="min-h-[150px] border-2"
                />
                <p className="text-sm text-muted-foreground">
                  Use {"{name}"} to personalize your message
                </p>
              </div>

              <div className="space-y-2">
                <Label>Daily Message Limit</Label>
                <Select
                  value={editingCampaign.dailyLimit.toString()}
                  onValueChange={(value) => setEditingCampaign({
                    ...editingCampaign,
                    dailyLimit: parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 messages</SelectItem>
                    <SelectItem value="100">100 messages</SelectItem>
                    <SelectItem value="150">150 messages</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingCampaign(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateCampaign(editingCampaign)}
                  disabled={!editingCampaign.name.trim() || !editingCampaign.message.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
