"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ImportLeads from "@/components/leads/import-leads";
import LeadListCard from "@/components/leads/lead-list-card";
import { useUser } from "@/contexts/user-context";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/use-toast";

interface LeadList {
  id: string;
  leadName: string;
  totalLeads: number;
  createdAt: string;
}

export default function LeadsPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useUser();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchLeadLists = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/leads?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch lead lists');
        
        const data = await response.json();
        setLeadLists(data.leads.map((lead: any) => ({
          id: lead.id,
          leadName: lead.leadName,
          totalLeads: lead.totalLeads,
          createdAt: lead.createdAt
        })));
      } catch (error) {
        console.error('Error fetching lead lists:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeadLists();
  }, [userId]);

  const handleDeleteLead = (leadId: string) => {
    setLeadToDelete(leadId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/leads/delete?id=${leadToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete lead list');

      setLeadLists(prev => prev.filter(lead => lead.id !== leadToDelete));
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
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    }
  };

  if (isImporting) {
    return <ImportLeads onBack={() => setIsImporting(false)} />;
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
                onCreateAutomation={() => {}}
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
        onConfirm={handleConfirmDelete}
        title="Delete Lead List"
        description="Are you sure you want to delete this lead list? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  );
}
