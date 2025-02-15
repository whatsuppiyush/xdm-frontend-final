"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCampaignDialog({
  open,
  onOpenChange,
}: CreateCampaignDialogProps) {
  const [step, setStep] = useState(1);
  const [campaign, setCampaign] = useState({
    name: "",
    leadList: "",
    initialMessage: "",
    followUps: [""],
    delays: [1],
  });

  const addFollowUp = () => {
    setCampaign({
      ...campaign,
      followUps: [...campaign.followUps, ""],
      delays: [...campaign.delays, 1],
    });
  };

  const removeFollowUp = (index: number) => {
    setCampaign({
      ...campaign,
      followUps: campaign.followUps.filter((_, i) => i !== index),
      delays: campaign.delays.filter((_, i) => i !== index),
    });
  };

  const updateFollowUp = (index: number, value: string) => {
    const newFollowUps = [...campaign.followUps];
    newFollowUps[index] = value;
    setCampaign({ ...campaign, followUps: newFollowUps });
  };

  const updateDelay = (index: number, value: number) => {
    const newDelays = [...campaign.delays];
    newDelays[index] = value;
    setCampaign({ ...campaign, delays: newDelays });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-oid="pdni7.t">
      <DialogContent className="sm:max-w-[600px]" data-oid="y8vv22c">
        <DialogHeader data-oid="igcztcv">
          <DialogTitle data-oid="55f_9zg">
            Create Campaign - Step {step} of 2
          </DialogTitle>
          <DialogDescription data-oid="a:.462x">
            {step === 1 && "Set up your campaign details"}
            {step === 2 && "Configure your campaign messages"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4" data-oid="dc:hr.0">
            <div className="space-y-2" data-oid="xe7zo2l">
              <Label data-oid="qk7fkv7">Campaign Name</Label>
              <Input
                placeholder="e.g., Q1 SaaS Founders Outreach"
                value={campaign.name}
                onChange={(e) =>
                  setCampaign({ ...campaign, name: e.target.value })
                }
                data-oid="5:9afry"
              />
            </div>

            <div className="space-y-2" data-oid="5ju80:t">
              <Label data-oid="ddjwo5u">Lead List</Label>
              <Select
                value={campaign.leadList}
                onValueChange={(value) =>
                  setCampaign({ ...campaign, leadList: value })
                }
                data-oid="it-d6h6"
              >
                <SelectTrigger data-oid="mi.l69.">
                  <SelectValue
                    placeholder="Select a lead list"
                    data-oid="-yrkwo9"
                  />
                </SelectTrigger>
                <SelectContent data-oid="zs4pc5f">
                  <SelectItem value="tech-founders" data-oid="u4tspo2">
                    Tech Founders
                  </SelectItem>
                  <SelectItem value="marketing-directors" data-oid="3lxlbya">
                    Marketing Directors
                  </SelectItem>
                  <SelectItem value="startup-ctos" data-oid="vjt3_pu">
                    Startup CTOs
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6" data-oid="ki9d.ce">
            <div className="space-y-2" data-oid="g:5.inq">
              <Label data-oid="qym6sdd">Initial Message</Label>
              <Textarea
                placeholder="Write your initial message..."
                value={campaign.initialMessage}
                onChange={(e) =>
                  setCampaign({ ...campaign, initialMessage: e.target.value })
                }
                className="min-h-[100px]"
                data-oid="4g8ue9a"
              />

              <p className="text-sm text-muted-foreground" data-oid="yl1.2i4">
                Use {"{first_name}"} to personalize your message
              </p>
            </div>

            {campaign.followUps.map((followUp, index) => (
              <div key={index} className="space-y-2" data-oid="26.g5:7">
                <div
                  className="flex items-center justify-between"
                  data-oid="28iypnr"
                >
                  <Label data-oid="23aapmd">
                    Follow-up Message {index + 1}
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFollowUp(index)}
                    data-oid="xxu-y28"
                  >
                    <X className="h-4 w-4" data-oid="scaasor" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Write your follow-up message..."
                  value={followUp}
                  onChange={(e) => updateFollowUp(index, e.target.value)}
                  className="min-h-[100px]"
                  data-oid="rk:72qp"
                />

                <div className="flex items-center gap-2" data-oid="9spr3kq">
                  <Label data-oid="-05vhmz">Send after</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={campaign.delays[index]}
                    onChange={(e) =>
                      updateDelay(index, parseInt(e.target.value))
                    }
                    className="w-20"
                    data-oid="ohby0qh"
                  />

                  <span
                    className="text-sm text-muted-foreground"
                    data-oid="d3lt_04"
                  >
                    days
                  </span>
                </div>
              </div>
            ))}

            {campaign.followUps.length < 3 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={addFollowUp}
                data-oid="2x74wa6"
              >
                <PlusCircle className="mr-2 h-4 w-4" data-oid="2cdxx:h" />
                Add Follow-up Message
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2" data-oid="h7c5ozo">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              data-oid="5blwn:m"
            >
              Back
            </Button>
          )}
          <Button
            onClick={() => {
              if (step === 1) setStep(2);
              else onOpenChange(false);
            }}
            data-oid="l15k8c-"
          >
            {step === 1 ? "Next" : "Create Campaign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
