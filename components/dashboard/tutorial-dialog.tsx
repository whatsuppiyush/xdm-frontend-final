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
import { Play } from "lucide-react";

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
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/30 shadow-[0_0_25px_rgba(124,58,237,0.2)]">
        <DialogHeader className="p-6 pb-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-800/10 to-blue-800/10 backdrop-filter backdrop-blur-md z-0"></div>
          <div className="relative z-10">
            <DialogTitle className="text-xl font-semibold text-white">
              How to Use XAutoDM
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm">
              Watch this quick tutorial to learn how to use the platform effectively
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="relative w-full border-t border-slate-700/50" style={{ paddingBottom: '56.25%' }}>
          {!iframeLoaded && (
            <div className="absolute inset-0 bg-black flex items-center justify-center group cursor-pointer">
              <img 
                src="/thumbnail.png" 
                alt="Tutorial Thumbnail" 
                className="w-full h-full object-cover"
              />
              {/* Simplified gradient overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-60"></div>
              
              {/* Play button overlay with enhanced colors */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-70 animate-pulse"></div>
                  <div className="backdrop-blur-md bg-gradient-to-r from-purple-600 to-blue-600 p-5 rounded-full border border-white/30 hover:from-purple-500 hover:to-blue-500 transition-all duration-300 hover:scale-110 relative z-10 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                    <Play className="h-10 w-10 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Colorful "Watch Tutorial" label */}
              <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                <p className="text-white font-medium px-6 py-2 rounded-full backdrop-blur-sm bg-gradient-to-r from-purple-600/80 to-blue-600/80 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  Watch Tutorial
                </p>
              </div>
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
        
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 flex justify-end border-t border-slate-700/50">
          <Button 
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
