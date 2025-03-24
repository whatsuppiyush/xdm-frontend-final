"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, ArrowLeft, Check, Loader2, Square, Pause, Play } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { cn } from "@/lib/utils";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/use-toast";

interface AutomatedLead {
  id: string;
  leadName: string;
  totalLeads: number;
  createdAt: string;
  followers: any[];
}

interface Campaign {
  id: number;
  name: string;
  progress: { sent: number; total: number };
  status: "Running" | "Paused";
}

interface TwitterAccount {
  id: string;
  twitterAccountName: string;
  createdAt: string;
  cookies: any[];
}

interface dmQueueList {
  id: string;
  messageSent: string;
  totalLeads: number;
  processedLeads: number;
  failedLeads: number;
  createdAt: string;
  campaignName: string;
  status: string;
}

interface CampaignProgress {
  id: string;
  messages: any[];
  status: string;
  processedCount: number;
  failedCount: number;
}

export default function CampaignPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedLeadList, setSelectedLeadList] = useState<AutomatedLead | null>(null);
  const [messageVariants, setMessageVariants] = useState([
    { id: 1, content: "", isEnabled: true },
  ]);
  const [selectedAccount, setSelectedAccount] = useState<TwitterAccount | null>(null);
  const [leadLists, setLeadLists] = useState<AutomatedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useUser();
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dmqueueList, setDmqueueList] = useState<dmQueueList[]>([]);
  const [sendingDM, setSendingDM] = useState(false);
  const [stoppingCampaigns, setStoppingCampaigns] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("In Progress");
  const [pausingCampaigns, setPausingCampaigns] = useState<Set<string>>(new Set());
  const [resumingCampaigns, setResumingCampaigns] = useState<Set<string>>(new Set());
  
  const steps = [
    { title: "Select Source", subtitle: "Choose your campaign data source" },
    { title: "Write Message", subtitle: "Craft your campaign message" },
    { title: "Configure Variants", subtitle: "Set up message variations" },
    { title: "Start Automation", subtitle: "Review and launch campaign" },
  ];

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const filteredCampaigns = dmqueueList.filter(campaign => {
    if (activeTab === "In Progress") {
      return campaign.status === "In Progress" || campaign.status === "Paused";
    }
    return campaign.status === activeTab;
  });

  const fetchMessages = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/messages?userId=${userId}`);
      const data = await response.json();

      if (response.ok) {
        const transformedData: dmQueueList[] = data.messages.map(
          (message: any) => {
            const totalLeads = message.messages.length;
            const processedLeads = message.messages.filter(
              (m: any) => m.status === true,
            ).length;
            const failedLeads = message.messages.filter(
              (m: any) => m.status === false,
            ).length;

            return {
              id: message.id,
              messageSent: message.messageSent,
              totalLeads,
              processedLeads,
              failedLeads,
              createdAt: message.createdAt,
              campaignName: message.campaignName,
              status: message.status || "In Progress"
            };
          },
        );

        setDmqueueList(transformedData);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchMessages();
  }, [userId]);

  useEffect(() => {
    const fetchLeadLists = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/leads?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch lead lists');
        
        const data = await response.json();
        setLeadLists(data.leads);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching lead lists:', error);
        setLoading(false);
      }
    };

    fetchLeadLists();
  }, [userId]);

  useEffect(() => {
    const fetchTwitterAccounts = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch Twitter accounts');
        
        const data = await response.json();
        setTwitterAccounts(data.accounts);
      } catch (error) {
        console.error('Error fetching Twitter accounts:', error);
      } finally {
        setAccountsLoading(false);
      }
    };

    fetchTwitterAccounts();
  }, [userId]);


  const handleDeleteCampaign = (campaignId: string) => {
    setCampaignToDelete(campaignId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!campaignToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/messages/delete?id=${campaignToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete campaign');

      setDmqueueList(prev => prev.filter(queue => queue.id !== campaignToDelete));
      toast({
        title: "Campaign deleted",
        description: "The campaign has been successfully deleted.",
      });
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast({
        title: "Error",
        description: "Failed to delete campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const handleStopCampaign = async (campaignId: string) => {
    try {
      setStoppingCampaigns(prev => new Set(prev).add(campaignId));
      
      // Update campaign status in database
      const updateResponse = await fetch(`/api/messages/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: campaignId,
          status: 'Stopped'
        }),
      });

      if (!updateResponse.ok) throw new Error('Failed to update campaign status');

      // Stop the campaign queue
      const response = await fetch('/api/send-DM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stop',
          campaignId
        }),
      });

      if (!response.ok) throw new Error('Failed to stop campaign');

      // Update the UI
      setDmqueueList(prevList => 
        prevList.map(queue => 
          queue.id === campaignId 
            ? { ...queue, status: 'Stopped' }
            : queue
        )
      );
    } catch (error) {
      console.error('Error stopping campaign:', error);
    } finally {
      setStoppingCampaigns(prev => {
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      });
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      setPausingCampaigns(prev => new Set(prev).add(campaignId));
      
      // Call send-DM API to pause the campaign
      // This will handle both database and Redis updates
      const response = await fetch("/api/send-DM", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause",
          campaignId: campaignId
        }),
      });
      
      if (!response.ok) throw new Error("Failed to pause campaign");
      
      // Update local state to reflect the change
      setDmqueueList(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status: "Paused" } 
            : campaign
        )
      );
      
      toast({
        title: "Campaign paused",
        description: "Your campaign has been paused successfully."
      });
      
      // Fetch latest messages to update UI
      fetchMessages();
    } catch (error) {
      console.error("Error pausing campaign:", error);
      toast({
        variant: "destructive",
        title: "Failed to pause campaign",
        description: "Please try again later."
      });
    } finally {
      setPausingCampaigns(prev => {
        const updated = new Set(prev);
        updated.delete(campaignId);
        return updated;
      });
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    try {
      setResumingCampaigns(prev => new Set(prev).add(campaignId));
      
      // Call send-DM API to resume the campaign
      // This will handle both database and Redis updates
      const response = await fetch("/api/send-DM", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resume",
          campaignId: campaignId
        }),
      });
      
      if (!response.ok) throw new Error("Failed to resume campaign");
      
      // Update local state to reflect the change
      setDmqueueList(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status: "In Progress" } 
            : campaign
        )
      );
      
      toast({
        title: "Campaign resumed",
        description: "Your campaign has been resumed successfully."
      });
      
      // Fetch latest messages to update UI
      fetchMessages();
    } catch (error) {
      console.error("Error resuming campaign:", error);
      toast({
        variant: "destructive",
        title: "Failed to resume campaign",
        description: "Please try again later."
      });
    } finally {
      setResumingCampaigns(prev => {
        const updated = new Set(prev);
        updated.delete(campaignId);
        return updated;
      });
    }
  };

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch('/api/messages/get-progress');
        const { campaigns } = await response.json();
        if (!campaigns.length) return;

        setDmqueueList(prevList => 
          prevList.map(queue => {
            const update = campaigns.find((c: CampaignProgress) => c.id === queue.id);
            if (update && queue.status === 'In Progress') {
              return {
                ...queue,
                processedLeads: update.processedCount,
                failedLeads: update.failedCount,
                status: update.status
              };
            }
            return queue;
          })
        );
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      }
    };

    fetchCampaigns();
  }, []);

  useEffect(() => {
    const hasActiveCampaigns = dmqueueList.some(queue => queue.status === 'In Progress');
    
    if (!hasActiveCampaigns) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/messages/get-progress');
        const { campaigns } = await response.json();
        if (!campaigns.length) return;

        setDmqueueList(prevList => 
          prevList.map(queue => {
            const update = campaigns.find((c: CampaignProgress) => c.id === queue.id);
            if (update && queue.status === 'In Progress') {
              return {
                ...queue,
                processedLeads: update.processedCount,
                failedLeads: update.failedCount,
                status: update.status
              };
            }
            return queue;
          })
        );
      } catch (error) {
        console.error('Error polling campaigns:', error);
      }
    }, 120000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [dmqueueList]);

  useEffect(() => {
    // Check for stored lead data
    const storedLeadData = localStorage.getItem('automationLead');
    
    if (storedLeadData) {
      try {
        const leadData = JSON.parse(storedLeadData);
        
        // Set isCreating to true to show the campaign creation UI
        setIsCreating(true);
        
        // Set the selected lead
        setSelectedLeadList({
          id: leadData.id,
          leadName: leadData.name,
          totalLeads: 0,
          createdAt: new Date().toISOString(),
          followers: []
        });
        
        // Skip to step 2
        setStep(2);
        
        // Clear the stored data
        localStorage.removeItem('automationLead');
      } catch (error) {
        console.error("Error parsing stored lead data:", error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {isCreating ? (
        <div className="max-w-[95vw] sm:max-w-[90vw] mx-auto p-3 sm:p-6">
          <Button
            variant="outline"
            onClick={() => {
              setIsCreating(false);
              setStep(1);
            }}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>

          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Create Campaign</h1>
              <p className="text-gray-500">Set up your automated Twitter DM campaign</p>
            </div>

            <div className="relative">
              <div className="flex justify-between items-center max-w-3xl mx-auto">
                {steps.map((stepItem, index) => {
                  const stepNumber = index + 1;
                  const isActive = step === stepNumber;
                  const isPast = step > stepNumber;
                  const isFuture = step < stepNumber;

                  return (
                    <button
                      key={stepItem.title}
                      onClick={() => isPast && setStep(stepNumber)}
                      disabled={isFuture}
                      className={cn(
                        "flex flex-col items-center p-2 flex-1 transition-all duration-300",
                        isActive ? "text-black" : "text-gray-400",
                        isPast && "text-gray-600",
                        isFuture && "opacity-50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all mb-1",
                          isActive && "bg-black text-white",
                          isPast && "bg-gray-200 text-gray-700",
                          isFuture && "bg-gray-100 text-gray-400"
                        )}
                      >
                        {stepNumber}
                      </div>
                      <div className="text-xs font-medium truncate max-w-[80px] text-center">
                        {stepItem.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step content goes here */}
            {/* ... */}
          </div>
        </div>
      ) : (
        <div className="max-w-[95vw] sm:max-w-[90vw] mx-auto p-3 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
            <Button
              variant="outline"
              onClick={() => setIsCreating(true)}
              className="ml-auto"
            >
              Create Campaign
            </Button>
          </div>

          <div className="mb-6 border-b border-gray-200">
            <div className="flex -mb-px">
              <button
                onClick={() => setActiveTab("In Progress")}
                className={cn(
                  "py-2 px-4 text-center border-b-2 font-medium text-sm focus:outline-none",
                  activeTab === "In Progress"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                In Progress
              </button>
              <button
                onClick={() => setActiveTab("Stopped")}
                className={cn(
                  "py-2 px-4 text-center border-b-2 font-medium text-sm focus:outline-none",
                  activeTab === "Stopped"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                Stopped
              </button>
              <button
                onClick={() => setActiveTab("Completed")}
                className={cn(
                  "py-2 px-4 text-center border-b-2 font-medium text-sm focus:outline-none",
                  activeTab === "Completed"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                Completed
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-gray-500 mt-2">Loading campaigns...</p>
            </div>
          ) : dmqueueList.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">No campaigns yet</h3>
                <p className="text-gray-500">Create your first campaign to start sending messages</p>
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(true)}
                  className="mt-2"
                >
                  Create Campaign
                </Button>
              </div>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">No {activeTab} campaigns</h3>
                <p className="text-gray-500">
                  {activeTab === "In Progress" 
                    ? "Create a new campaign to start sending messages" 
                    : `No ${activeTab.toLowerCase()} campaigns to display`}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredCampaigns.map((queue) => (
                <Card key={queue.id} className="p-6 border-2">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-xl font-medium">{queue.campaignName}</h3>
                        <p className="text-sm text-gray-500">
                          Progress - {queue.processedLeads}/{queue.totalLeads} sent 
                          {queue.failedLeads > 0 && ` (${queue.failedLeads} failed)`}
                        </p>
                      </div>
                      <div className="text-sm">
                        <span className={cn(
                          "px-2 py-1 rounded-full",
                          queue.status === "In Progress" && "bg-blue-100 text-blue-700",
                          queue.status === "Paused" && "bg-amber-100 text-amber-700",
                          queue.status === "Stopped" && "bg-yellow-100 text-yellow-700",
                          queue.status === "Completed" && "bg-emerald-100 text-emerald-700 font-medium"
                        )}>
                          {queue.status}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-[#0F172A] h-2.5 rounded-full"
                        style={{
                          width: `${(queue.processedLeads / queue.totalLeads) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      {queue.status !== "In Progress" && (
                        <Button 
                          variant="outline" 
                          className="border-2"
                          onClick={() => handleDeleteCampaign(queue.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                      {queue.status === "In Progress" && (
                        <>
                          <Button 
                            variant="outline" 
                            className="border-2"
                            onClick={() => handlePauseCampaign(queue.id)}
                            disabled={pausingCampaigns.has(queue.id)}
                          >
                            {pausingCampaigns.has(queue.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Pausing...
                              </>
                            ) : (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            className="border-2"
                            onClick={() => handleStopCampaign(queue.id)}
                            disabled={stoppingCampaigns.has(queue.id)}
                          >
                            {stoppingCampaigns.has(queue.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Stopping...
                              </>
                            ) : (
                              <>
                                <Square className="h-4 w-4 mr-2" />
                                Stop
                              </>
                            )}
                          </Button>
                        </>
                      )}
                      {queue.status === "Paused" && (
                        <Button
                          variant="outline"
                          className="border-2 bg-blue-50"
                          onClick={() => handleResumeCampaign(queue.id)}
                          disabled={resumingCampaigns.has(queue.id)}
                        >
                          {resumingCampaigns.has(queue.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Resuming...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setCampaignToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  );
}
