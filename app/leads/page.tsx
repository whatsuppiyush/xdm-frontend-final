"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ImportLeads from "@/components/leads/import-leads";
import LeadListCard from "@/components/leads/lead-list-card";
import { useUser } from "@/contexts/user-context";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface LeadList {
  id: string;
  leadName: string;
  totalLeads: number;
  createdAt: string;
  status?: string;
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

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    
    const fetchLeads = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/leads?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch lead lists');
        
        const data = await response.json();
        
        const formattedLeads = data.leads.map((lead: any) => ({
          id: lead.id,
          leadName: lead.leadName,
          totalLeads: lead.totalLeads,
          createdAt: lead.createdAt,
          status: lead.status
        }));
        
        setLeadLists(formattedLeads);
        
        // Check if any leads are still in progress
        const hasInProgressLeads = formattedLeads.some(
          (lead: any) => lead.status === 'in_progress'
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
  }, [userId]);

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
      const response = await fetch(`/api/leads?userId=${userId}`);
      const data = await response.json();
      setLeadLists(data.leads.map((lead: any) => ({
        id: lead.id,
        leadName: lead.leadName,
        totalLeads: lead.totalLeads,
        createdAt: lead.createdAt,
        status: lead.status
      })));
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

  if (isImporting) {
    return <ImportLeads onBack={() => setIsImporting(false)} refreshLeads={refreshLeads} />;
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage your Leads</h1>
        <Button
          onClick={() => setIsImporting(true)}
          variant="outline"
          className="border-2"
        >
          Add new leads
        </Button>
      </div>

      <div className="border-2 rounded-lg p-6">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading lead lists...</div>
        ) : leadLists.length > 0 ? (
          <div className="grid grid-cols-3 gap-6">
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
    </div>
  );
}
