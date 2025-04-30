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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, PlusCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [loadingPage, setLoadingPage] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { userId } = useUser();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const [cookieErrorDialogOpen, setCookieErrorDialogOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedLead, setSelectedLead] = useState<{ id: string; name: string } | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [leadCredits, setLeadCredits] = useState({
    credits: 0,
    planType: null as string | null,
    loading: true,
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    
    const fetchLeads = async (pageOverride?: number) => {
      console.log('Fetching leads', refreshCounter);
      if (!userId) return;
      if (pageOverride) setPage(pageOverride);
      setLoadingPage(true);
      
      try {
        const response = await fetch(`/api/leads?userId=${userId}&page=${pageOverride || page}&limit=5`);
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
        setTotalPages(data.totalPages || 1);
        
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
        setLoadingPage(false);
      }
    };
    
    // Initial fetch
    fetchLeads();
    
    // Set up polling every 10 seconds
    intervalId = setInterval(() => fetchLeads(), 10000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [userId, page, refreshCounter]);

  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!userId) return;
      
      try {
        const creditsResponse = await fetch("/api/user/credits");
        const creditsData = await creditsResponse.json();
        
        setLeadCredits({
          credits: creditsData.leadCredits || 0,
          planType: creditsData.planType,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching lead credits:", error);
        setLeadCredits(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserCredits();
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

  // Filter leads based on search query
  const filteredLeads = searchQuery
    ? leadLists.filter(lead => lead.leadName.toLowerCase().includes(searchQuery.toLowerCase()))
    : leadLists;

  if (isImporting) {
    return <ImportLeads onBack={() => setIsImporting(false)} refreshLeads={refreshLeads} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage your Leads</h1>
        <Button
          onClick={() => setIsImporting(true)}
          className="dark:bg-purple-600 dark:hover:bg-purple-700 text-white w-full sm:w-auto"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add new leads
        </Button>
      </div>

      <Card className="border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800">
          <div>
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Remaining Lead Credits</CardTitle>
          </div>
          <Database className="h-5 w-5 text-purple-300" />
        </CardHeader>
        <CardContent className="px-4 py-3">
          <div className="flex flex-col">
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-purple-400">{leadCredits.loading ? '—' : leadCredits.credits.toLocaleString()}</span>
              {leadCredits.planType && <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">{leadCredits.planType} Plan</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Input */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search leads by name..."
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 focus-visible:ring-purple-400 focus-visible:border-purple-400 dark:bg-slate-800"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {(loading || loadingPage) ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="border border-gray-100 dark:border-gray-700 h-[150px] animate-pulse bg-gray-50 dark:bg-gray-800">
              <CardContent className="p-6 flex flex-col">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-5"></div>
                <div className="mt-auto flex gap-2">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredLeads.length === 0 && searchQuery ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-center">
            <Search className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No matching leads found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Try a different search term or clear your search
            </p>
            <Button 
              onClick={() => setSearchQuery("")}
              variant="outline"
              className="dark:border-gray-600"
            >
              Clear search
            </Button>
          </div>
        ) : leadLists.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-center">
            <Database className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No lead lists yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Import your first list of leads to get started with your campaign
            </p>
            <Button 
              onClick={() => setIsImporting(true)}
              className="dark:bg-purple-600 dark:hover:bg-purple-700 text-white w-full sm:w-auto"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add new leads
            </Button>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadListCard
              key={lead.id}
              id={lead.id}
              name={lead.leadName}
              leadCount={lead.totalLeads}
              createdAt={lead.createdAt}
              status={lead.status}
              onDelete={(id) => {
                setLeadToDelete(id);
                setDeleteDialogOpen(true);
              }}
              onCreateAutomation={() => handleCreateAutomation(lead.id, lead.leadName)}
              onViewDetails={(id, name) => handleViewDetails(id, name)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && !searchQuery && (
        <div className="flex justify-center mt-6 gap-2">
          {page > 1 && (
            <Button
              onClick={() => {
                if (!loadingPage) {
                  setLoadingPage(true);
                  setPage(page - 1);
                }
              }}
              disabled={loadingPage}
            >
              Previous
            </Button>
          )}
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Button
              onClick={() => {
                if (!loadingPage) {
                  setLoadingPage(true);
                  setPage(page + 1);
                }
              }}
              disabled={loadingPage}
            >
              Next
            </Button>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <DeleteConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={() => {
            if (leadToDelete) {
              handleDeleteLead(leadToDelete);
              setDeleteDialogOpen(false);
              setLeadToDelete(null);
            }
          }}
          title="Delete Lead List"
          description="Are you sure you want to delete this lead list? This action cannot be undone."
          isDeleting={isDeleting}
        />
      )}

      {/* Cookie Error Dialog */}
      <CookieRefreshDialog 
        isOpen={cookieErrorDialogOpen}
        onClose={() => setCookieErrorDialogOpen(false)}
        onRefresh={handleRefreshCookies}
      />

      {/* Lead Details Dialog */}
      {selectedLead && (
        <LeadDetailsDialog
          isOpen={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          onCreateAutomation={() => {
            handleCreateAutomation(selectedLead.id, selectedLead.name);
            setDetailsDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
