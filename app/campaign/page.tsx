"use client";
import { useState, useEffect, useRef } from "react";
import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepsNavigation } from "@/components/ui/steps-navigation";
import { Trash2, ArrowLeft, Check, Loader2, Square, Pause, Play, Moon, Sun } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/use-toast";
import { DAILY_MESSAGE_LIMIT } from "@/lib/constants";

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
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
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
  const [dailyLimit, setDailyLimit] = useState({ 
    used: 0, 
    total: DAILY_MESSAGE_LIMIT,
    remaining: DAILY_MESSAGE_LIMIT 
  });
  
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

  const fetchDailyUsage = async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/messages/daily-limit?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setDailyLimit({ 
          used: data.used, 
          total: data.total,
          remaining: data.remaining 
        });
      }
    } catch (error) {
      console.error("Error fetching daily limit:", error);
    }
  };

  useEffect(() => {
    fetchDailyUsage();
    const interval = setInterval(fetchDailyUsage, 90000);
    return () => clearInterval(interval);
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

  const handleResumeRateLimited = async (campaignId: string) => {
    try {
      // First, manually reset the rate limit for testing
      if (process.env.NODE_ENV === 'development') {
        await fetch('/api/send-DM', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_rate_limit',
            userId
          })
        });
      }
      
      // Then resume the campaign
      const response = await fetch('/api/send-DM', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          campaignId
        })
      });
      
      if (!response.ok) throw new Error('Failed to resume campaign');
      
      // Update the UI
      setDmqueueList(prevList => 
        prevList.map(queue => 
          queue.id === campaignId 
            ? { ...queue, status: 'In Progress' }
            : queue
        )
      );
      
      toast({
        title: "Campaign resumed",
        description: "The rate-limited campaign has been resumed."
      });
      
      // Refresh daily limit
      fetchDailyUsage();
      
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast({
        title: "Error",
        description: "Failed to resume campaign. Please try again.",
        variant: "destructive"
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

  const sendDM = async () => {
    if (!selectedAccount?.cookies) {
      console.error("No cookies available");
      return;
    }
    
    try {
      setSendingDM(true);
      setError(null);
      const recipientIds = selectedLeadList?.followers.map((follower) => follower.id);
      
      // Check if remaining daily limit is sufficient
      if (dailyLimit.remaining <= 0) {
        toast({
          variant: "destructive",
          title: "Daily limit reached",
          description: "All messages sent for the day. Please wait for your daily limit to renew."
        });
        setSendingDM(false);
        return;
      }
      
      // Check if campaign size exceeds remaining limit
      // if (recipientIds && dailyLimit.remaining < recipientIds.length) {
      //   toast({
      //     variant: "destructive",
      //     title: "Daily limit exceeded",
      //     description: `You have ${dailyLimit.remaining} messages left today, but this campaign requires ${recipientIds.length}. Please try a smaller campaign or wait until tomorrow.`
      //   });
      //   setSendingDM(false);
      //   return;
      // }

      const messageResponse = await fetch("/api/messages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageSent: messageTemplate,
          recipients: recipientIds,
          campaignName: campaignName,
          userId: userId
        }),
      });

      if (!messageResponse.ok) throw new Error("Failed to create message record");

      const messageData = await messageResponse.json();
      const campaignId = messageData.message.id;

      // Send campaign notification email
      console.log('userId',userId);
      const response = await fetch("/api/send-DM", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          campaignId,
          recipients: selectedLeadList?.followers,
          message: messageTemplate,
          cookies: selectedAccount?.cookies,
          userId: userId
        }),
      });

      if (!response.ok) throw new Error('Failed to start campaign');

      try {
        await fetch("/api/send-campaign-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignName,
            recipientCount: recipientIds?.length || 0,
            userId
          }),
        });
      } catch (emailError) {
        console.error('Error sending campaign notification email:', emailError);
      }

      // Add this new campaign to the list
      const newCampaign = {
        id: campaignId,
        messageSent: messageTemplate,
        totalLeads: recipientIds?.length || 0,
        processedLeads: 0,
        failedLeads: 0,
        createdAt: new Date().toISOString(),
        campaignName: campaignName,
        status: "In Progress"
      };

      setDmqueueList(prev => [newCampaign, ...prev]);
      setIsCreating(false);
      setStep(1);
    } catch (error) {
      console.error("Error sending DM:", error);
      setError("An error occurred while sending DM. Please try again later.");
    } finally {
      setSendingDM(false);     
    }
  };

  const addMessageVariant = () => {
    setMessageVariants([
      ...messageVariants,
      { id: messageVariants.length + 1, content: "", isEnabled: true },
    ]);
  };

  return (
    <div className={cn(
      "container space-y-4 py-6 pb-28 sm:pb-6",
      isDark ? "text-gray-100" : ""
    )}>
      {/* Campaign header */}
      <div className="flex items-center justify-between">
        <h1 className={cn("text-2xl font-bold", isDark ? "text-white" : "")}>Campaigns</h1>
        {!isCreating && (
          <Button 
            onClick={() => setIsCreating(true)}
            className={cn(
              "sm:flex",
              isDark ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
            )}
          >
            Create Campaign
          </Button>
        )}
      </div>

      {/* Daily Message Limit Indicator */}
      {!isCreating && (
        <div className={cn(
          "mb-6 mt-4 p-4 rounded-lg shadow-sm border",
          isDark ? "bg-gray-800 border-gray-700" : "bg-white"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className={cn(
              "text-sm font-medium", 
              isDark ? "text-gray-300" : "text-gray-600"
            )}>
              Daily Message Limit:
            </div>
            <div className="flex items-center flex-1 max-w-md">
              <div className={cn(
                "w-full rounded-full h-2.5 mr-2",
                isDark ? "bg-gray-700" : "bg-gray-200"
              )}>
                <div
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-500", 
                    dailyLimit.remaining <= 0 ? 
                      (isDark ? "bg-red-600" : "bg-red-500") : 
                    dailyLimit.remaining < 50 ? 
                      (isDark ? "bg-amber-600" : "bg-amber-500") : 
                      (isDark ? "bg-purple-600" : "bg-blue-600")
                  )}
                  style={{ width: `${Math.min(100, (dailyLimit.used / dailyLimit.total) * 100)}%` }}
                />
              </div>
              <div className="flex w-24 justify-between text-sm font-medium">
                <span className={isDark ? "text-purple-400" : "text-blue-700"}>{dailyLimit.remaining}</span>
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>/ {dailyLimit.total}</span>
              </div>
            </div>
            <div className={cn(
              "text-xs hidden sm:block",
              isDark ? "text-gray-400" : "text-gray-500"
            )}>
              Messages reset at midnight UTC
            </div>
          </div>
          
          {dailyLimit.remaining <= 0 && (
            <div className={cn(
              "mt-2 p-2 rounded text-sm font-medium text-center",
              isDark ? "bg-red-900/50 text-red-300" : "bg-red-50 text-red-600"
            )}>
              All messages sent for the day. Please wait for your daily limit to renew.
            </div>
          )}
        </div>
      )}

      {/* Campaign content */}
      {isCreating ? (
        <div className="w-full max-w-[100vw] sm:max-w-[100vw] mx-auto p-0 sm:p-2">
          <Button
            variant="outline"
            onClick={() => {
              setIsCreating(false);
              setStep(1);
            }}
            className={cn("mb-6", isDark && "border-gray-700 text-gray-200 hover:bg-gray-800")}
          >
            <ArrowLeft className="h-5 w-5 mr-2" /> Back
          </Button>
          
          {/* Mobile Steps Navigation - Moved to the top */}
          <div className={cn(
            "mb-4 rounded-lg border p-1 sm:hidden",
            isDark 
              ? "bg-gray-900/90 border-gray-700 shadow-lg" 
              : "bg-white border-gray-200"
          )}>
            <div className="flex justify-between items-center">
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
                      "flex flex-col items-center p-2 flex-1 transition-all duration-300 rounded-md",
                      isActive && (isDark ? "bg-gray-800" : "bg-gray-50"),
                      isActive 
                        ? (isDark ? "text-purple-400" : "text-black")
                        : (isDark ? "text-gray-500" : "text-gray-400"),
                      isPast && (isDark 
                        ? "text-gray-300" 
                        : "text-gray-600"),
                      isFuture && "opacity-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-all mb-1",
                        isActive && (isDark 
                          ? "bg-purple-600 text-white shadow-md shadow-purple-900/50" 
                          : "bg-black text-white"),
                        isPast && (isDark 
                          ? "bg-purple-800/70 text-purple-200" 
                          : "bg-gray-200 text-gray-700"),
                        isFuture && (isDark 
                          ? "bg-gray-800 text-gray-400 border border-gray-700" 
                          : "bg-gray-100 text-gray-400")
                      )}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5" /> : stepNumber}
                    </div>
                    <div className="text-xs font-medium truncate max-w-[60px] text-center">
                      {stepItem.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <Card className={cn(
            "border-none shadow-lg overflow-hidden w-full rounded-none sm:rounded-lg",
            isDark ? "bg-gray-800" : ""
          )}>
            <div className="overflow-x-auto">
              <StepsNavigation
                steps={steps}
                currentStep={step}
                onStepClick={(newStep) => {
                  if (newStep <= step) {
                    setStep(newStep);
                  }
                }}
                className={cn("hidden sm:block", isDark && "text-gray-300")}
              />
            </div>
            <div className="p-4 sm:p-6 md:p-8 pb-16 sm:pb-8">
              {/* Step 1: Select Source */}
              {step === 1 && (
                <div className="space-y-8 w-full">
                  <h3 className={cn("text-xl font-semibold", isDark && "text-gray-100")}>Select Lead Source</h3>
                  
                  {/* Lead cards displayed outside the container box with more spacing */}
                  <div className="w-full">
                    {/* Hide scrollbar for Chrome, Safari and Opera */}
                    <style jsx>{`
                      div::-webkit-scrollbar {
                        display: none;
                      }
                    `}</style>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 w-full px-1 py-2 -mx-2 sm:-mx-4">
                      {leadLists.map((list) => (
                        <div
                          key={list.id}
                          className={cn(
                            "border-2 p-6 sm:p-7 cursor-pointer transition-all hover:shadow-xl w-full h-full flex flex-col justify-between rounded-xl shadow-md transform hover:-translate-y-1",
                            selectedLeadList?.id === list.id
                              ? isDark 
                                ? "ring-2 ring-purple-500 border-purple-600 bg-gray-800" 
                                : "ring-2 ring-black border-black bg-white"
                              : isDark
                                ? "hover:border-gray-600 bg-gray-800 border-gray-700" 
                                : "hover:border-gray-300 bg-white"
                          )}
                          onClick={() => setSelectedLeadList(list)}
                        >
                          <h3 className={cn("font-medium text-lg sm:text-xl mb-4", isDark && "text-white")}>{list.leadName}</h3>
                          <div className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium inline-block w-fit",
                            isDark ? "bg-gray-700 text-purple-300" : "bg-gray-100 text-purple-700"
                          )}>
                            {list.totalLeads.toLocaleString()} leads
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Navigation buttons */}
                  <div className={cn(
                    "flex justify-between sm:justify-end gap-4 sm:gap-4 mt-4 mb-2 sm:mb-0 fixed bottom-0 left-0 right-0 p-5 sm:p-0 sm:static bg-gray-900 sm:bg-transparent z-[100] border-t border-gray-800 sm:border-0 shadow-lg sm:shadow-none"
                  )}>
                    <Button
                      variant="outline"
                      className={cn(
                        "px-5 sm:px-6 py-4 text-base sm:text-base flex-1 sm:flex-initial text-lg font-medium shadow-md",
                        isDark && "border-gray-700 text-gray-200 hover:bg-gray-700"
                      )}
                      onClick={() => {
                        if (step > 1) {
                          setStep(step - 1);
                        }
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className={cn(
                        "px-5 sm:px-8 py-4 rounded-xl text-base sm:text-base flex-1 sm:flex-initial text-white text-lg font-medium shadow-md",
                        isDark
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-black hover:bg-gray-800"
                      )}
                      onClick={() => {
                        if (selectedLeadList) {
                          setStep(step + 1);
                        }
                      }}
                      disabled={!selectedLeadList}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 2: Write Message */}
              {step === 2 && (
                <div className="w-full mx-auto space-y-4 sm:space-y-6">
                  {/* Header Section */}
                  <div className="text-center space-y-2 sm:space-y-3">
                    <h2 className={cn(
                      "text-3xl sm:text-4xl font-bold",
                      isDark 
                        ? "bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent" 
                        : "bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent"
                    )}>
                      Write Your Message
                    </h2>
                    <p className={cn(
                      "text-base sm:text-lg max-w-lg mx-auto",
                      isDark ? "text-gray-300" : "text-gray-600"
                    )}>
                      Craft a personalized message that resonates with your audience
                    </p>
                  </div>
                  <div className="w-full mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-6 w-full">
                      {/* Left Column - Context and Variables */}
                      <div className="col-span-1 md:col-span-2 space-y-3 md:space-y-4">
                        {/* Context Section */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className={cn(
                              "text-lg font-semibold",
                              isDark ? "text-gray-200" : "text-gray-900"
                            )}>
                              Lead Context
                            </Label>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-sm font-medium",
                              isDark ? "bg-purple-900/60 text-purple-300" : "bg-purple-100 text-purple-600"
                            )}>
                              Sample Lead
                            </span>
                          </div>
                          <Card className={cn(
                            "border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-300 w-full",
                            isDark 
                              ? "bg-gray-800 border-gray-700 hover:border-purple-800" 
                              : "bg-white hover:border-purple-300"
                          )}>
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center",
                                  isDark ? "bg-gradient-to-br from-gray-700 to-gray-900" : "bg-gradient-to-br from-purple-100 to-pink-100"
                                )}>
                                  <span className="text-2xl">👩🏻‍💻</span>
                                </div>
                                <div>
                                  <div className={cn(
                                    "font-semibold text-lg",
                                    isDark ? "text-gray-100" : "text-gray-900"
                                  )}>
                                    Sarah Smith
                                  </div>
                                  <div className={cn(
                                    "font-medium",
                                    isDark ? "text-purple-400" : "text-purple-600"
                                  )}>
                                    @sarahsmith
                                  </div>
                                </div>
                              </div>
                              <div className={cn(
                                "leading-relaxed",
                                isDark ? "text-gray-300" : "text-gray-700"
                              )}>
                                Tech Founder | SaaS Expert | Building the future of work | Previously @bigtech
                              </div>
                              <div className={cn(
                                "flex items-center gap-6",
                                isDark ? "text-gray-400" : "text-gray-600"
                              )}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                  <span>12.5k followers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                  <span>1.1k following</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                        {/* Variables Section */}
                        <div className="space-y-4">
                          <Label className={cn(
                            "text-lg font-semibold",
                            isDark ? "text-gray-200" : "text-gray-900"
                          )}>
                            Available Variables
                          </Label>
                          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 w-full">
                            {[
                              { name: "{name}", desc: "Full Name" },
                              { name: "{username}", desc: "Twitter Handle" },
                              { name: "{followers}", desc: "Follower Count" },
                              { name: "{bio}", desc: "Bio Excerpt" },
                            ].map((variable) => (
                              <div
                                key={variable.name}
                                className={cn(
                                  "p-3 rounded-lg border cursor-pointer transition-all",
                                  isDark 
                                    ? "bg-gray-800 border-gray-700 hover:border-purple-700" 
                                    : "bg-gray-50 border-gray-200 hover:border-purple-300"
                                )}
                                onClick={() => {
                                  const textarea = document.querySelector("textarea");
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const newValue =
                                      messageTemplate.substring(0, start) +
                                      variable.name +
                                      messageTemplate.substring(end);
                                    setMessageTemplate(newValue);
                                  }
                                }}
                              >
                                <div className={cn(
                                  "font-mono",
                                  isDark ? "text-purple-400" : "text-purple-600"
                                )}>
                                  {variable.name}
                                </div>
                                <div className={cn(
                                  "text-sm",
                                  isDark ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {variable.desc}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Right Column - Message Editor and Preview */}
                      <div className="col-span-1 md:col-span-3 space-y-3 md:space-y-4 mt-3 md:mt-0">
                        {/* Message Template Section */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className={cn(
                              "text-lg font-semibold",
                              isDark ? "text-gray-200" : "text-gray-900"
                            )}>
                              Message Template
                            </Label>
                            <div className="flex items-center gap-2">
                              <button className={cn(
                                "p-2 rounded-lg transition-colors",
                                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                              )}>
                                <span className="text-xl">✨</span>
                              </button>
                              <button className={cn(
                                "p-2 rounded-lg transition-colors",
                                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                              )}>
                                <span className="text-xl">🎯</span>
                              </button>
                            </div>
                          </div>
                          <div className="relative">
                            <Textarea
                              placeholder="Hi {name}, I noticed you're..."
                              value={messageTemplate}
                              onChange={(e) => setMessageTemplate(e.target.value)}
                              className={cn(
                                "min-h-[200px] text-base border-2 rounded-xl resize-none p-4 shadow-sm w-full",
                                isDark 
                                  ? "bg-gray-800 border-gray-700 text-gray-100 focus:border-purple-600 focus:ring-purple-800" 
                                  : "focus:border-purple-400 focus:ring-purple-200"
                              )}
                            />
                            <div className={cn(
                              "absolute bottom-4 right-4 text-sm",
                              isDark ? "text-gray-500" : "text-gray-400"
                            )}>
                              {messageTemplate.length} characters
                            </div>
                          </div>
                        </div>
                        {/* Preview Section */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className={cn(
                              "text-lg font-semibold",
                              isDark ? "text-gray-200" : "text-gray-900"
                            )}>
                              Live Preview
                            </Label>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-sm font-medium",
                              isDark ? "bg-green-900/60 text-green-300" : "bg-green-100 text-green-600"
                            )}>
                              Looking Good! 👍
                            </span>
                          </div>
                          <Card className={cn(
                            "border-2 rounded-xl p-6 shadow-sm w-full",
                            isDark 
                              ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700" 
                              : "bg-gradient-to-br from-gray-50 to-white"
                          )}>
                            <div className={cn(
                              "leading-relaxed",
                              isDark ? "text-gray-300" : "text-gray-700"
                            )}>
                              {messageTemplate
                                .replace("{name}", "Sarah")
                                .replace("{username}", "@sarahsmith")
                                .replace("{followers}", "12.5k")
                                .replace("{bio}", "Tech Founder | SaaS Expert",)}
                            </div>
                          </Card>
                        </div>
                      </div>
                    </div>
                    {/* Navigation Buttons */}
                    <div className={cn(
                      "w-full p-5 sm:p-4 flex justify-between gap-4 sm:gap-4 mb-2 sm:mb-0 fixed bottom-0 left-0 right-0 sm:static z-[100] shadow-lg sm:shadow-none",
                      isDark ? "bg-gray-900 border-t border-gray-800" : "bg-white border-t"
                    )}>
                      <Button
                        variant="outline"
                        className={cn(
                          "px-5 sm:px-6 py-4 text-base sm:text-base flex-1 sm:flex-initial text-lg font-medium shadow-md",
                          isDark && "border-gray-700 text-gray-200 hover:bg-gray-700"
                        )}
                        onClick={() => {
                          if (step > 1) {
                            setStep(step - 1);
                          }
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        className={cn(
                          "px-5 sm:px-8 py-4 rounded-xl text-base sm:text-base flex-1 sm:flex-initial text-white text-lg font-medium shadow-md",
                          isDark
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "bg-black hover:bg-gray-800"
                        )}
                        onClick={() => {
                          if (selectedLeadList) {
                            setStep(step + 1);
                          }
                        }}
                        disabled={!selectedLeadList}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 3: Configure Variants */}
              {step === 3 && (
                <div className="w-full mx-auto space-y-3 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
                    {/* Left Column - Generate Ideas */}
                    <div className="space-y-4">
                      <div className={cn(
                        "rounded-lg p-4 sm:p-6",
                        isDark ? "bg-gray-900" : "bg-[#111827]"
                      )}>
                        <div className="flex justify-between items-center mb-3 sm:mb-6">
                          <h3 className="text-xl text-gray-300">
                            Generate Ideas
                          </h3>
                          <Button className={cn(
                            "text-white gap-2",
                            isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-[#1F2937] hover:bg-[#374151]"
                          )}>
                            <span className="text-lg">⚡</span> Generate
                          </Button>
                        </div>
                        <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center space-y-2">
                          <div className={cn(
                            "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                            isDark ? "bg-gray-800" : "bg-[#1F2937]"
                          )}>
                            🧪
                          </div>
                          <h4 className="text-lg font-medium text-gray-300">
                            Generate Variant Ideas
                          </h4>
                          <p className="text-gray-400 text-sm">
                            Click the generate button <br /> create some variant
                            ideas <br /> with AI
                          </p>
                          <div className="mt-2 px-3 py-1 rounded-full bg-yellow-900/30 text-yellow-400 font-medium text-sm">
                            Coming Soon
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Right Column - Selected Message Variants */}
                    <div className="space-y-4">
                      <div className={cn(
                        "rounded-lg p-4 sm:p-6",
                        isDark ? "bg-gray-900" : "bg-[#111827]"
                      )}>
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-xl text-gray-300 mb-1">
                                Selected Message Variants
                              </h3>
                              <p className="text-sm text-gray-400">
                                We recommend adding 5 or more variants.
                              </p>
                              <p className="text-sm text-gray-400 mt-1">
                                Pro tip: Add spintax to your variants for even
                                more randomization.
                              </p>
                            </div>
                          </div>
                          {/* Primary Variant */}
                          <div className="space-y-4 mt-6">
                            <div className="space-y-2">
                              <Label className="text-gray-300">
                                Primary Variant
                              </Label>
                              <Textarea
                                value={messageTemplate}
                                onChange={(e) => setMessageTemplate(e.target.value)}
                                className={cn(
                                  "min-h-[100px] sm:min-h-[120px] resize-none text-gray-300 border-0 w-full",
                                  isDark ? "bg-gray-800" : "bg-[#1F2937]"
                                )}
                                placeholder="Hey [First Name]!"
                              />
                            </div>
                            {/* Variant Messages */}
                            {messageVariants.map((variant, index) => (
                              <div key={variant.id} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <Label className="text-gray-300">
                                    Variant Idea {index + 1}
                                  </Label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-400 hover:text-gray-300"
                                    onClick={() => {
                                      const newVariants = messageVariants.filter(
                                        (v) => v.id !== variant.id,
                                      );
                                      setMessageVariants(newVariants);
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                                <Textarea
                                  value={variant.content}
                                  onChange={(e) => {
                                    const newVariants = [...messageVariants];
                                    newVariants[index].content = e.target.value;
                                    setMessageVariants(newVariants);
                                  }}
                                  className={cn(
                                    "min-h-[100px] sm:min-h-[120px] resize-none text-gray-300 border-0 w-full",
                                    isDark ? "bg-gray-800" : "bg-[#1F2937]"
                                  )}
                                  placeholder="Write your variant here..."
                                />
                              </div>
                            ))}
                            {/* Add Variant Button */}
                            <Button
                              variant="outline"
                              className="w-full py-4 text-gray-300 border-gray-600 hover:bg-gray-800"
                              onClick={addMessageVariant}
                            >
                              + Add Variant
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Navigation Buttons */}
                      <div className="flex justify-between sm:justify-end gap-4 sm:gap-4 mt-4 mb-2 sm:mb-0 fixed bottom-0 left-0 right-0 p-5 sm:p-0 sm:static bg-gray-900 sm:bg-transparent z-[100] border-t border-gray-800 sm:border-0 shadow-lg sm:shadow-none">
                        <Button
                          variant="outline"
                          className="text-gray-300 border-gray-600 hover:bg-gray-800 flex-1 sm:flex-initial px-5 sm:px-6 py-3 text-sm sm:text-base text-lg font-medium"
                          onClick={() => setStep(2)}
                        >
                          Back
                        </Button>
                        <Button
                          className={cn(
                            "text-white px-5 sm:px-8 py-3 text-sm sm:text-base flex-1 sm:flex-initial rounded-xl text-lg font-medium",
                            isDark ? "bg-purple-600 hover:bg-purple-700" : "bg-[#7C3AED] hover:bg-[#6D28D9]"
                          )}
                          onClick={() => setStep(4)}
                          disabled={
                            !messageTemplate &&
                            messageVariants.every((v) => !v.content)
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 4: Start Automation */}
              {step === 4 && (
                <div className="w-full mx-auto space-y-4 sm:space-y-6">
                  <h2 className={cn(
                    "text-2xl sm:text-3xl font-medium text-center mb-4 sm:mb-6",
                    isDark && "text-gray-100"
                  )}>
                    Configure Automation
                  </h2>
                  <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
                    <Card className={cn(
                      "border-2 p-4 sm:p-6 w-full",
                      isDark && "bg-gray-800 border-gray-700"
                    )}>
                      <div className="space-y-4 sm:space-y-6">
                        <div className="space-y-4">
                          <Label className={cn(
                            "text-lg",
                            isDark && "text-gray-200"
                          )}>Campaign Name</Label>
                          <Input
                            placeholder="Enter campaign name"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            style={isDark ? {
                              backgroundColor: '#2D3748', // Slate 800
                              color: '#F7FAFC', // White
                              fontWeight: 'bold',
                              fontSize: '16px'
                            } : {
                              backgroundColor: '#F7FAFC', // White
                              color: '#1A202C', // Dark slate
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}
                            className={cn(
                              "border-2",
                              isDark 
                                ? "border-purple-500 text-white placeholder-gray-400" 
                                : "border-gray-300 text-black placeholder-gray-500"
                            )}
                          />
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                          <Label className={cn(
                            "text-base sm:text-lg",
                            isDark && "text-gray-200"
                          )}>Select Twitter Account</Label>
                          <div className="grid gap-4">
                            {accountsLoading ? (
                              <div className={cn(
                                "text-center py-4",
                                isDark ? "text-gray-400" : "text-gray-500"
                              )}>Loading accounts...</div>
                            ) : twitterAccounts.length === 0 ? (
                              <div className={cn(
                                "text-center py-4",
                                isDark ? "text-gray-400" : "text-gray-500"
                              )}>
                                No Twitter accounts connected. 
                                <Button 
                                  variant="link" 
                                  className={cn(
                                    "underline hover:text-gray-700",
                                    isDark ? "text-purple-400 hover:text-purple-300" : "text-black"
                                  )}
                                  onClick={() => window.location.href = '/settings'}
                                >
                                  Connect an account →
                                </Button>
                              </div>
                            ) : (
                              twitterAccounts.map((account) => (
                                <div
                                  key={account.id}
                                  className={cn(
                                    "flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all",
                                    selectedAccount?.id === account.id 
                                      ? isDark 
                                        ? 'border-purple-600 bg-gray-800' 
                                        : 'border-black bg-gray-50'
                                      : isDark
                                        ? 'border-gray-700 hover:border-gray-600'
                                        : 'border-gray-200 hover:border-gray-400'
                                  )}
                                  onClick={() => setSelectedAccount(account)}
                                >
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className={cn(
                                      "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl",
                                      isDark ? "bg-gray-700" : "bg-gray-100"
                                    )}>
                                      👤
                                    </div>
                                    <div>
                                      <div className={cn(
                                        "font-medium text-sm sm:text-base",
                                        isDark && "text-gray-200"
                                      )}>@{account.twitterAccountName}</div>
                                      <div className={cn(
                                        "text-sm",
                                        isDark ? "text-gray-400" : "text-gray-500"
                                      )}>Connected</div>
                                    </div>
                                  </div>
                                  {selectedAccount?.id === account.id && (
                                    <div className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center",
                                      isDark ? "bg-purple-600" : "bg-black"
                                    )}>
                                      <Check className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                    <div className="flex justify-between sm:justify-end gap-4 sm:gap-4 mt-4 mb-2 sm:mb-0 fixed bottom-0 left-0 right-0 p-5 sm:p-0 sm:static bg-gray-900 sm:bg-transparent z-[100] border-t border-gray-800 sm:border-0 shadow-lg sm:shadow-none">
                      <Button
                        variant="outline"
                        className={cn(
                          "px-5 sm:px-8 py-3 sm:py-3 text-sm sm:text-base flex-1 sm:flex-initial text-lg font-medium",
                          isDark && "border-gray-700 text-gray-200 hover:bg-gray-800"
                        )}
                        onClick={() => setStep(3)}
                      >
                        Back
                      </Button>
                      <Button
                        className={cn(
                          "text-white px-5 sm:px-8 py-3 text-sm sm:text-base rounded-xl flex-1 sm:flex-initial text-lg font-medium",
                          isDark 
                            ? "bg-purple-600 hover:bg-purple-700" 
                            : "bg-black hover:bg-gray-800"
                        )}
                        onClick={async () => {
                          setSendingDM(true);
                          try {
                            await sendDM();
                          } finally {
                            setSendingDM(false);
                          }
                        }}
                        disabled={!campaignName || !selectedAccount || !selectedLeadList || sendingDM}
                      >
                        {sendingDM ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Starting Campaign...
                          </>
                        ) : (
                          'Start Campaign'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tab navigation */}
          <div className={cn(
            "border-b flex",
            isDark && "border-gray-800"
          )}>
            {["In Progress", "Completed", "Stopped", "Rate Limited"].map((tab) => (
              <button
                key={tab}
                className={cn(
                  "px-4 py-2 font-medium text-sm transition-colors",
                  activeTab === tab
                    ? isDark 
                      ? "border-b-2 border-purple-500 text-purple-400" 
                      : "border-b-2 border-black text-black"
                    : isDark
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-500 hover:text-gray-900"
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className={cn(
                "h-8 w-8 animate-spin mx-auto",
                isDark && "text-gray-400"
              )} />
              <p className={cn(
                "mt-2",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>Loading campaigns...</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className={cn(
              "text-center py-12 rounded-lg border-2 border-dashed",
              isDark 
                ? "bg-gray-900 border-gray-700" 
                : "bg-gray-50"
            )}>
              <div className="space-y-3">
                <h3 className={cn(
                  "text-lg font-medium",
                  isDark ? "text-gray-200" : "text-gray-900"
                )}>No {activeTab.toLowerCase()} campaigns</h3>
                <p className={cn(
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>
                  {activeTab === "In Progress" 
                    ? "Create a new campaign to start sending messages" 
                    : `You don't have any ${activeTab.toLowerCase()} campaigns`}
                </p>
                {activeTab === "In Progress" && (
                  <Button
                    variant="outline"
                    onClick={() => setIsCreating(true)}
                    className={cn(
                      "mt-2",
                      isDark && "border-gray-700 text-gray-200 hover:bg-gray-800"
                    )}
                  >
                    Create Campaign
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredCampaigns.map((queue) => (
                <Card key={queue.id} className={cn(
                  "p-6 border-2",
                  isDark && "bg-gray-800 border-gray-700"
                )}>
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className={cn(
                          "text-xl font-medium",
                          isDark && "text-gray-100"
                        )}>{queue.campaignName}</h3>
                        <p className={cn(
                          "text-sm",
                          isDark ? "text-gray-400" : "text-gray-500"
                        )}>
                          Progress - {queue.processedLeads}/{queue.totalLeads} sent 
                          {queue.failedLeads > 0 && ` (${queue.failedLeads} failed)`}
                        </p>
                      </div>
                      <div className="text-sm">
                        <span className={cn(
                          "px-2 py-1 rounded-full",
                          queue.status === "In Progress" && (isDark ? "bg-blue-900/60 text-blue-300" : "bg-blue-100 text-blue-700"),
                          queue.status === "Paused" && (isDark ? "bg-amber-900/60 text-amber-300" : "bg-amber-100 text-amber-700"),
                          queue.status === "Stopped" && (isDark ? "bg-yellow-900/60 text-yellow-300" : "bg-yellow-100 text-yellow-700"),
                          queue.status === "Rate Limited" && (isDark ? "bg-red-900/60 text-red-300" : "bg-red-100 text-red-700"),
                          queue.status === "Completed" && (isDark ? "bg-emerald-900/60 text-emerald-300 font-medium" : "bg-emerald-100 text-emerald-700 font-medium")
                        )}>
                          {queue.status}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "w-full rounded-full h-2.5",
                      isDark ? "bg-gray-700" : "bg-gray-100"
                    )}>
                      <div
                        className={cn(
                          "h-2.5 rounded-full",
                          isDark ? "bg-purple-600" : "bg-[#0F172A]"
                        )}
                        style={{
                          width: `${(queue.processedLeads / queue.totalLeads) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      {queue.status !== "In Progress" && (
                        <Button 
                          variant="outline" 
                          className={cn(
                            "border-2",
                            isDark && "border-gray-700 text-gray-200 hover:bg-gray-700"
                          )}
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
                            className={cn(
                              "border-2",
                              isDark && "border-gray-700 text-gray-200 hover:bg-gray-700"
                            )}
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
                            className={cn(
                              "border-2",
                              isDark && "border-gray-700 text-gray-200 hover:bg-gray-700"
                            )}
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
                          className={cn(
                            "border-2",
                            isDark 
                              ? "bg-blue-900/30 border-blue-800 text-blue-300 hover:bg-blue-900/50" 
                              : "bg-blue-50"
                          )}
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
                      {queue.status === "Rate Limited" && (
                        <Button 
                          variant="outline" 
                          className={cn(
                            "border-2",
                            isDark 
                              ? "bg-blue-900/30 border-blue-800 text-blue-300 hover:bg-blue-900/50" 
                              : "bg-blue-50"
                          )}
                          onClick={() => handleResumeRateLimited(queue.id)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      )}
                    </div>
                    {queue.status === "Rate Limited" && (
                      <div className={cn(
                        "mt-2 text-xs p-2 rounded",
                        isDark ? "bg-red-900/30 text-red-300" : "bg-red-50 text-red-600"
                      )}>
                        Daily limit reached. Campaign will resume automatically tomorrow.
                      </div>
                    )}
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