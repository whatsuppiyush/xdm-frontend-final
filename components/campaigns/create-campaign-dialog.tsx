'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    name: '',
    leadList: '',
    initialMessage: '',
    followUps: [''],
    delays: [1],
  });

  const addFollowUp = () => {
    setCampaign({
      ...campaign,
      followUps: [...campaign.followUps, ''],
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Campaign - Step {step} of 2</DialogTitle>
          <DialogDescription>
            {step === 1 && "Set up your campaign details"}
            {step === 2 && "Configure your campaign messages"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                placeholder="e.g., Q1 SaaS Founders Outreach"
                value={campaign.name}
                onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Lead List</Label>
              <Select
                value={campaign.leadList}
                onValueChange={(value) => setCampaign({ ...campaign, leadList: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a lead list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech-founders">Tech Founders</SelectItem>
                  <SelectItem value="marketing-directors">Marketing Directors</SelectItem>
                  <SelectItem value="startup-ctos">Startup CTOs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Initial Message</Label>
              <Textarea
                placeholder="Write your initial message..."
                value={campaign.initialMessage}
                onChange={(e) => setCampaign({ ...campaign, initialMessage: e.target.value })}
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">
                Use {'{first_name}'} to personalize your message
              </p>
            </div>

            {campaign.followUps.map((followUp, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Follow-up Message {index + 1}</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFollowUp(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Write your follow-up message..."
                  value={followUp}
                  onChange={(e) => updateFollowUp(index, e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex items-center gap-2">
                  <Label>Send after</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={campaign.delays[index]}
                    onChange={(e) => updateDelay(index, parseInt(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            ))}

            {campaign.followUps.length < 3 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={addFollowUp}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Follow-up Message
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button
            onClick={() => {
              if (step === 1) setStep(2);
              else onOpenChange(false);
            }}
          >
            {step === 1 ? 'Next' : 'Create Campaign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}