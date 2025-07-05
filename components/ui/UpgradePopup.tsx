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
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">
              Special Offer!
            </p>
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Get the Starter Plan for just <span className="line-through text-red-500/80">$89</span> <span className="font-bold text-xl">$57</span>/month!
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Your current free plan includes:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Send 0 DMs/day</li>
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