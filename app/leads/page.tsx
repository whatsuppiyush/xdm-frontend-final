"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ImportLeads from "@/components/leads/import-leads";
import LeadListCard from "@/components/leads/lead-list-card";
import { useUser } from "@/contexts/user-context";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { CookieRefreshDialog } from "@/components/ui/cookie-refresh-dialog";
import LeadDetailsDialog from "@/components/leads/lead-details-dialog";

interface LeadList {
  id: string;
  leadName: string;
  totalLeads: number;
  createdAt: string;
  status?: string;
  errorType?: string;
}

// Add these type declarations at the top of the file, outside your component
declare global {
  interface Window {
    leadPollingInterval: NodeJS.Timeout;
    leadPollingActive: boolean;
  }
}

export default function LeadsPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useUser();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const [cookieErrorDialogOpen, setCookieErrorDialogOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedLead, setSelectedLead] = useState<{ id: string; name: string } | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    
    const fetchLeads = async () => {
      console.log('Fetching leads', refreshCounter);
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/leads?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch lead lists');
        
        const data = await response.json();
        console.log('API response data:', data);
        
        const formattedLeads = data.leads.map((lead: any) => ({
          id: lead.id,
          leadName: lead.leadName,
          totalLeads: lead.totalLeads,
          createdAt: lead.createdAt,
          status: lead.status,
          errorType: lead.errorType
        }));
        
        console.log('Formatted leads with error types:', formattedLeads);
        
        // Check for auth errors in any lead
        const authErrorLead = formattedLeads.find((lead: LeadList) => 
          lead.errorType === 'auth_error'
        );
        
        console.log('Auth error lead found:', authErrorLead);
        
        if (authErrorLead) {
          console.log('Auth error detected, showing dialog');
          setCookieErrorDialogOpen(true);
        }
        
        setLeadLists(formattedLeads);
        
        // Check if any leads are still in progress
        const hasInProgressLeads = formattedLeads.some(
          (lead: LeadList) => lead.status === 'in_progress'
        );
        
        // Actually stop polling when complete
        if (!hasInProgressLeads && intervalId) {
          console.log('All leads complete, stopping polling');
          clearInterval(intervalId);
          intervalId = undefined;
        } else if (hasInProgressLeads) {
          console.log('In progress leads found, continuing to poll...');
        }
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Initial fetch
    fetchLeads();
    
    // Set up polling every 10 seconds
    intervalId = setInterval(fetchLeads, 10000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [userId, refreshCounter]);

  const handleDeleteLead = async (leadId: string) => {
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/leads/delete?id=${leadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete lead list');

      // Update the state to remove the deleted lead
      setLeadLists(prev => prev.filter(lead => lead.id !== leadId));
      
      toast({
        title: "Lead list deleted",
        description: "The lead list has been successfully deleted.",
      });
    } catch (error) {
      console.error('Failed to delete lead list:', error);
      toast({
        title: "Error",
        description: "Failed to delete lead list. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const refreshLeads = async () => {
    try {
      setRefreshCounter(prev => prev + 1);
      console.log('Refresh counter incremented, polling should start');
    } catch (error) {
      console.error('Error refreshing leads:', error);
    }
  };

  const handleCreateAutomation = (leadId: string, leadName: string) => {
    try {
      // Store the lead information in localStorage before navigation
      localStorage.setItem('automationLead', JSON.stringify({
        id: leadId,
        name: leadName,
        autoStart: true
      }));
      
      // Navigate to campaign page
      window.location.href = '/campaign';
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  const handleRefreshCookies = async () => {
    console.log('Refreshing cookies dialog');
    
    try {
      // Find the lead with auth error
      const authErrorLead = leadLists.find(lead => lead.errorType === 'auth_error');
      
      if (authErrorLead) {
        // Clear the error status in Redis
        await fetch('/api/leads/clear-error', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ leadId: authErrorLead.id }),
        });
        
        console.log(`Cleared error status for lead ${authErrorLead.id}`);
      }
      
      // Navigate to Twitter settings
      window.location.href = '/settings?tab=twitter';
    } catch (error) {
      console.error('Error clearing lead error:', error);
    } finally {
      setCookieErrorDialogOpen(false);
    }
  };

  const handleViewDetails = (id: string, name: string) => {
    setSelectedLead({ id, name });
    setDetailsDialogOpen(true);
  };

  if (isImporting) {
    return <ImportLeads onBack={() => setIsImporting(false)} refreshLeads={refreshLeads} />;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h1 className="text-3xl font-bold">Manage your Leads</h1>
        <Button
          onClick={() => setIsImporting(true)}
          variant="outline"
          className="border-2"
        >
          Add new leads
        </Button>
      </div>

      <div className="border-2 rounded-lg p-4 md:p-6" key={`leads-container-${Date.now()}`}>
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading lead lists...</div>
        ) : leadLists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {leadLists.map((list) => (
              <LeadListCard
                key={list.id}
                id={list.id}
                name={list.leadName}
                leadCount={list.totalLeads}
                createdAt={list.createdAt}
                status={list.status}
                onCreateAutomation={() => handleCreateAutomation(list.id, list.leadName)}
                onDelete={handleDeleteLead}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No lead lists found. Click Add new leads to create one.
          </div>
        )}
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setLeadToDelete(null);
        }}
        onConfirm={() => {
          if (leadToDelete) {
            handleDeleteLead(leadToDelete);
          }
          setDeleteDialogOpen(false);
        }}
        title="Delete Lead List"
        description="Are you sure you want to delete this lead list? This action cannot be undone."
        isDeleting={isDeleting}
      />

      <CookieRefreshDialog
        isOpen={cookieErrorDialogOpen}
        onClose={() => setCookieErrorDialogOpen(false)}
        onRefresh={handleRefreshCookies}
      />

      {selectedLead && (
        <LeadDetailsDialog
          isOpen={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
          leadId={selectedLead.id}
          leadName={selectedLead.name}
        />
      )}
    </div>
  );
}
