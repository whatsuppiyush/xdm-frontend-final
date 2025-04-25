import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Play, Loader2, Calendar } from "lucide-react";
import { useState, memo } from "react";
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

function LeadListCard({
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
      <div 
        className="relative overflow-hidden rounded-xl border border-white/20 dark:border-white/10 backdrop-blur-sm bg-white/40 dark:bg-slate-900/40 shadow-[0_4px_15px_rgb(0,0,0,0.04)] dark:shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.3)] transition-all cursor-pointer h-full"
        onClick={() => onViewDetails(id, name)}
      >
        {/* Decorative elements */}
        <div className="absolute -right-12 -top-12 w-24 h-24 bg-purple-400/5 dark:bg-purple-400/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute -left-12 -bottom-12 w-24 h-24 bg-blue-400/5 dark:bg-blue-400/10 rounded-full blur-xl pointer-events-none"></div>
        
        <div className="p-4 sm:p-6 h-full flex flex-col relative z-10">
          {/* Name and creation date */}
          <div className="mb-4">
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-white break-words line-clamp-2">{name}</h3>
            <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
              {formatDate(createdAt)}
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="mb-5">
            {isLoading ? (
              <div className="flex items-center text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-xs sm:text-sm">Scraping in progress...</span>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-purple-600 dark:text-purple-300 px-3 py-1.5 rounded-full text-xs sm:text-sm inline-flex items-center">
                <span className="font-medium mr-1">{leadCount.toLocaleString()}</span> leads
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-auto pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 flex-1 min-w-[80px] h-9 transition-all duration-200 shadow-sm hover:shadow"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                setIsConfirmOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
              Delete
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white flex-1 min-w-[80px] h-9 transition-all duration-200 shadow-sm hover:shadow-md" 
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
        </div>
      </div>

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

export default memo(LeadListCard);
