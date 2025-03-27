"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TutorialDialog({
  open,
  onOpenChange,
}: TutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-xl bg-slate-900">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-white">
            How to Use XAutoDM
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-sm">
            Watch this quick tutorial to learn how to use the platform effectively
          </DialogDescription>
        </DialogHeader>
        
        <div className="aspect-video border-t border-slate-800">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
            title="XAutoDM Tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        
        <div className="bg-slate-900 p-4 flex justify-end border-t border-slate-800">
         
        </div>
      </DialogContent>
    </Dialog>
  );
}
