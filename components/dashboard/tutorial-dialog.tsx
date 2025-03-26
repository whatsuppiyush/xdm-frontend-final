"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
        <DialogClose className="absolute right-3 top-3 rounded-full p-1.5 text-slate-300 bg-slate-800/50 hover:bg-slate-700 transition-colors z-10">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        
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
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="text-white border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            Close Tutorial
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
