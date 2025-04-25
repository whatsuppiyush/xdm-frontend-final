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
import { useState, useEffect, memo } from "react";
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

function LeadDetailsDialog({
  isOpen,
  onClose,
  leadId,
  leadName,
  onCreateAutomation,
}: LeadDetailsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Handle animation timing
    if (isOpen) {
      setShowContent(false);
      setTimeout(() => {
        setShowContent(true);
      }, 100);
    }
  }, [isOpen]);

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
    const headers = ["ID", "Name", "Username", "Bio", "Followers", "Following", "Status"];
    const csvData = leads.map((lead: any) => [
      lead.id,
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
      <DialogContent 
        className="sm:max-w-[900px] max-h-[90vh] overflow-hidden p-0 w-[calc(100%-24px)] mx-auto bg-background dark:border-slate-700 flex flex-col rounded-xl shadow-2xl" 
        hideCloseButton
      >
        <style jsx global>{`
          .smooth-scroll {
            scroll-behavior: smooth;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
          }
          
          .smooth-scroll::-webkit-scrollbar {
            width: 6px;
          }
          
          .smooth-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .smooth-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(155, 155, 155, 0.5);
            border-radius: 20px;
            border: transparent;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes subtle-pulse {
            0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.3); }
            70% { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
            100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
          }
          
          .fade-in {
            animation: fadeIn 0.3s ease-out forwards;
          }
          
          .modern-button {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            font-weight: 500;
            letter-spacing: 0.01em;
            will-change: transform;
            transform: translateZ(0);
          }
          
          .modern-button span {
            position: relative;
            z-index: 1;
            display: inline-flex;
            align-items: center;
            transition: transform 0.2s ease;
          }
          
          .modern-button:hover span {
            transform: translateX(3px);
          }
          
          .modern-button:after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            pointer-events: none;
            background-image: radial-gradient(circle, rgba(255, 255, 255, 0.4) 10%, transparent 10.01%);
            background-repeat: no-repeat;
            background-position: 50%;
            transform: scale(10, 10);
            opacity: 0;
            transition: transform 0.4s, opacity 0.5s;
          }
          
          .modern-button:active:after {
            transform: scale(0, 0);
            opacity: 0.3;
            transition: 0s;
          }
          
          .btn-gradient {
            background: linear-gradient(135deg, #9f7aea 0%, #7c3aed 100%);
            border: none;
            color: white;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2), 0 2px 4px -1px rgba(124, 58, 237, 0.1);
            border-radius: 10px;
          }
          
          .btn-gradient:focus {
            animation: subtle-pulse 1.5s infinite;
          }
          
          .btn-gradient:hover {
            background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
            box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3), 0 4px 6px -2px rgba(124, 58, 237, 0.2);
            transform: translateY(-2px) scale(1.01);
          }
          
          .btn-gradient:active {
            transform: translateY(0);
            box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2), 0 2px 4px -1px rgba(124, 58, 237, 0.1);
          }
          
          .btn-outline-modern {
            background: transparent;
            border: 1px solid rgba(124, 58, 237, 0.3);
            color: #7c3aed;
            transition: all 0.3s ease;
            border-radius: 10px;
            backdrop-filter: blur(4px);
            position: relative;
            overflow: hidden;
          }
          
          .btn-outline-modern::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(159, 122, 234, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          
          .btn-outline-modern:focus {
            border-color: rgba(124, 58, 237, 0.8);
            box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
          }
          
          .btn-outline-modern:hover {
            background: rgba(124, 58, 237, 0.08);
            border-color: rgba(124, 58, 237, 0.6);
            box-shadow: 0 4px 10px -2px rgba(124, 58, 237, 0.15);
            transform: translateY(-2px);
          }
          
          .btn-outline-modern:hover::before {
            opacity: 1;
          }
          
          .btn-outline-modern:active {
            transform: translateY(0);
            background: rgba(124, 58, 237, 0.12);
          }
          
          .floating-header {
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }
        `}</style>

        <div className="sticky top-0 bg-background/95 z-50 border-b dark:border-slate-700 shadow-sm floating-header pt-4">
          {/* Desktop header */}
          <div className="hidden md:flex justify-between items-center px-6 pb-5">
            <div className="flex items-center">
              <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-3">
                <UsersIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  {leadName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Showing {leads.length} leads from this list
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!loading && leads.length > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2 btn-outline-modern h-10 px-4 modern-button"
                    onClick={handleDownloadCSV}
                  >
                    <Download className="h-4 w-4 text-purple-500" />
                    <span>Export as CSV</span>
                  </Button>
                  <Button
                    size="sm"
                    className="btn-gradient h-10 px-5 modern-button"
                    onClick={onCreateAutomation}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    <span>Automate</span>
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full h-9 w-9 hover:bg-gray-200 hover:scale-105 dark:hover:bg-gray-800/60 transition-all duration-200 flex items-center justify-center shadow-sm"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Mobile header */}
          <div className="flex md:hidden justify-between items-center px-4 pb-4">
            <div className="flex items-center">
              <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-2">
                <UsersIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{leadName}</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-gray-200 hover:scale-105 dark:hover:bg-gray-800/60 transition-all duration-200"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
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
                className="flex items-center gap-1 text-xs h-8 px-3 btn-outline-modern"
                onClick={handleDownloadCSV}
              >
                <Download className="h-3 w-3 text-purple-500" />
                <span>Export CSV</span>
              </Button>
            )}
          </div>
        </div>

        <div className={`overflow-auto flex-1 smooth-scroll ${showContent ? 'fade-in' : 'opacity-0'}`}>
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-300 dark:text-purple-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading leads...</p>
              </div>
            ) : (
              <LeadsGrid leads={leads} />
            )}
          </div>
        </div>
        
        {/* Mobile-only footer with automate button */}
        <div className="md:hidden p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-gray-800 flex justify-end sticky bottom-0 shadow-md">
          {!loading && leads.length > 0 && (
            <Button
              className="btn-gradient w-full h-11 modern-button"
              onClick={onCreateAutomation}
            >
              <Play className="h-4 w-4 mr-2" />
              <span>Automate</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(LeadDetailsDialog); 