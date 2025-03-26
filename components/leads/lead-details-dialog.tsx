import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import LeadsGrid from "@/components/leads/leads-grid";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Play, X, DatabaseIcon, XIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarIcon,
  MailIcon,
  MessageCircleIcon,
  User2Icon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Lead } from "./leads-grid";
import { format } from "date-fns";

interface LeadDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  leadName: string;
  onCreateAutomation: () => void;
}

export default function LeadDetailsDialog({
  isOpen,
  onClose,
  leadId,
  leadName,
  onCreateAutomation,
}: LeadDetailsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    if (isOpen && leadId) {
      const fetchLeadDetails = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/leads/details?id=${leadId}`);
          const data = await response.json();
          if (data.followers) {
            setLeads(data.followers);
          }
        } catch (error) {
          console.error("Error fetching lead details:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchLeadDetails();
    }
  }, [isOpen, leadId]);

  const handleDownloadCSV = () => {
    // Convert leads data to CSV format
    const headers = ["Name", "Username", "Bio", "Followers", "Following", "Status"];
    const csvData = leads.map((lead: any) => [
      lead.name,
      lead.username,
      `"${(lead.bio || "").replace(/"/g, '""')}"`, // Escape quotes in bio
      lead.followers,
      lead.following,
      lead.status
    ]);
    
    // Add headers to the beginning
    csvData.unshift(headers);
    
    // Convert to CSV string
    const csvString = csvData.map(row => row.join(",")).join("\n");
    
    // Create blob and download
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${leadName}_leads.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-auto p-0 w-[calc(100%-24px)] mx-auto bg-background dark:border-slate-700" hideCloseButton>
        <div className="sticky top-0 bg-background z-10 border-b dark:border-slate-700">
          {/* Mobile header */}
          <div className="flex md:hidden justify-between items-center p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{leadName}</h2>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
          
          {/* Desktop header */}
          <div className="hidden md:flex justify-between items-center p-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{leadName}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Showing {leads.length} leads from this list
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!loading && leads.length > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2"
                    onClick={handleDownloadCSV}
                  >
                    <Download className="h-4 w-4" />
                    Export as CSV
                  </Button>
                  <Button
                    size="sm"
                    className="bg-purple-500 hover:bg-purple-600 text-white transition-colors duration-200"
                    onClick={onCreateAutomation}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Automate
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="ml-2"
              >
                Close
              </Button>
            </div>
          </div>
          
          {/* Mobile info line and download button */}
          <div className="flex md:hidden items-center justify-between px-4 pb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {leads.length} leads
            </p>
            {!loading && leads.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-1 text-xs h-8 px-2"
                onClick={handleDownloadCSV}
              >
                <Download className="h-3 w-3" />
                Export CSV
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-300 dark:text-purple-400" />
            </div>
          ) : (
            <LeadsGrid leads={leads} />
          )}
        </div>
        
        {/* Mobile-only footer with automate button */}
        <div className="md:hidden p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-gray-800 flex justify-end">
          {!loading && leads.length > 0 && (
            <Button
              className="bg-purple-500 hover:bg-purple-600 text-white w-full transition-colors duration-200"
              onClick={onCreateAutomation}
            >
              <Play className="h-4 w-4 mr-2" />
              Automate
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 