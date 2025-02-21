import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Play } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

interface LeadListCardProps {
  id: string;
  name: string;
  leadCount: number;
  onCreateAutomation: () => void;
  onDelete: (id: string) => void;
}

export default function LeadListCard({
  id,
  name,
  leadCount,
  onCreateAutomation,
  onDelete,
}: LeadListCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-medium">{name}</h3>
          <p className="text-sm text-gray-500">{leadCount} leads</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="border-2"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button className="border-2" variant="outline" onClick={onCreateAutomation}>
            <Play className="h-4 w-4 mr-2" />
            Create Automation
          </Button>
        </div>
      </Card>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => {
          onDelete(id);
          setDeleteDialogOpen(false);
        }}
        title="Delete Lead List"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
      />
    </>
  );
}
