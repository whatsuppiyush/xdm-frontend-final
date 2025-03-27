"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TutorialDialog({
  open,
  onOpenChange,
}: TutorialDialogProps) {
  // Add loading state to handle thumbnail display until iframe loads
  const [iframeLoaded, setIframeLoaded] = useState(false);

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
        
        <div className="relative w-full border-t border-slate-800" style={{ paddingBottom: '56.25%' }}>
          {!iframeLoaded && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <img 
                src="/thumbnail.png" 
                alt="Tutorial Thumbnail" 
                className="w-full object-contain"
              />
            </div>
          )}
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src="https://www.youtube.com/embed/OZUfUaEAHbA?autoplay=0&modestbranding=1&rel=0&fs=1&showinfo=0&color=white"
            title="XAutoDM Tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            onLoad={() => setIframeLoaded(true)}
            style={{ opacity: iframeLoaded ? 1 : 0 }}
          />
        </div>
        
        <div className="bg-slate-900 p-4 flex justify-end border-t border-slate-800">
         
        </div>
      </DialogContent>
    </Dialog>
  );
}
