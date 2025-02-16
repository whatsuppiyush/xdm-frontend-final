"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ImportLeads from "@/components/leads/import-leads";
import LeadListCard from "@/components/leads/lead-list-card";
import { useUser } from "@/contexts/user-context";

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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/leads/delete?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete lead');

      // Remove the deleted lead from state
      setLeadLists(prevLists => prevLists.filter(list => list.id !== id));
    } catch (error) {
      console.error('Error deleting lead:', error);
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
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No lead lists found. Click "Add new leads" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
