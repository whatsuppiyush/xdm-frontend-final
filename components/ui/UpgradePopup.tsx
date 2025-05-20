"use client";

import React from 'react';
import { Button } from './button'; // Assuming you have a Button component
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog'; // Assuming you have Dialog components

interface UpgradePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const UpgradePopup: React.FC<UpgradePopupProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            Unlock the full benefits of XAutoDM by upgrading your plan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Your current free plan includes:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Send 50 DMs/day</li>
            <li>Campaigns need manual resumption after 72 hours</li>
            <li>Limited lead extraction</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={onUpgrade}>Upgrade to Subscription</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePopup; 