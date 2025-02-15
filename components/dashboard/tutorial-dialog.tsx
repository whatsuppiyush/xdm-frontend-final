"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TutorialDialog({
  open,
  onOpenChange,
}: TutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-oid="c8v7x.3">
      <DialogContent className="sm:max-w-[800px]" data-oid="gil_lr9">
        <DialogHeader data-oid="iich.mi">
          <DialogTitle data-oid="w_fv.wo">
            How to Use Twitter DM Outreach
          </DialogTitle>
          <DialogDescription data-oid="exx2aco">
            Watch this quick tutorial to learn how to use the platform
            effectively
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video" data-oid="l_ht875">
          <iframe
            className="w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
            title="Twitter DM Outreach Tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            data-oid="ukvyo4:"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
