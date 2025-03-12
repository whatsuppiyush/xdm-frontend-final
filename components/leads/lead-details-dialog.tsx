import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import LeadsList from "@/components/leads/leads-list";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { useState, useEffect } from "react";

interface LeadDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  leadName: string;
}

export default function LeadDetailsDialog({
  isOpen,
  onClose,
  leadId,
  leadName,
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
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-auto">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl">{leadName} Details</DialogTitle>
            {!loading && leads.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2 mr-8"
                onClick={handleDownloadCSV}
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            )}
          </div>
          <DialogDescription>
            Showing {leads.length} leads from this list
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="mt-4">
            <LeadsList leads={leads} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 