import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Play, Loader2 } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

interface LeadListCardProps {
  id: string;
  name: string;
  leadCount: number;
  createdAt: string;
  status?: string;
  onCreateAutomation: () => void;
  onDelete: (id: string) => void;
  onViewDetails: (id: string, name: string) => void;
}

export default function LeadListCard({
  id,
  name,
  leadCount,
  createdAt,
  status,
  onCreateAutomation,
  onDelete,
  onViewDetails,
}: LeadListCardProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isLoading = status === 'in_progress';

  return (
    <>
      <Card 
        className="border border-gray-200 hover:border-gray-300 transition-all cursor-pointer h-full"
        onClick={() => onViewDetails(id, name)}
      >
        <CardContent className="p-4 sm:p-6 h-full flex flex-col">
          {/* Name and creation date */}
          <div className="mb-3">
            <h3 className="text-base sm:text-lg font-semibold mb-1 text-gray-900 break-words line-clamp-2">{name}</h3>
            <div className="text-xs sm:text-sm text-gray-500">
              Created {new Date(createdAt).toLocaleDateString()}
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="mb-3">
            {isLoading ? (
              <div className="flex items-center text-orange-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-sm">Scraping in progress...</span>
              </div>
            ) : (
              <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs sm:text-sm inline-flex">
                {leadCount.toLocaleString()} leads
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-auto pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border flex-1 min-w-[80px] h-9"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                setIsConfirmOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button 
              className="border flex-1 min-w-[80px] h-9" 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                onCreateAutomation();
              }}
            >
              <Play className="h-4 w-4 mr-2" />
              Automate
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          onDelete(id);
          setIsConfirmOpen(false);
        }}
        title="Delete Lead List"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
      />
    </>
  );
}
