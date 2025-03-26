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

  // Format date to "Oct 10, 2023" format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <Card 
        className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all cursor-pointer h-full hover:shadow-md"
        onClick={() => onViewDetails(id, name)}
      >
        <CardContent className="p-4 sm:p-6 h-full flex flex-col">
          {/* Name and creation date */}
          <div className="mb-3">
            <h3 className="text-base sm:text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100 break-words line-clamp-2">{name}</h3>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Created {formatDate(createdAt)}
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="mb-3">
            {isLoading ? (
              <div className="flex items-center text-purple-400">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-sm">Scraping in progress...</span>
              </div>
            ) : (
              <div className="bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-300 px-3 py-1 rounded-full text-xs sm:text-sm inline-flex">
                {leadCount.toLocaleString()} leads
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-auto pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 flex-1 min-w-[80px] h-9 text-gray-700 dark:text-gray-300"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                setIsConfirmOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button 
              className="bg-blue-500 hover:bg-blue-600 text-white flex-1 min-w-[80px] h-9 transition-colors duration-200" 
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
