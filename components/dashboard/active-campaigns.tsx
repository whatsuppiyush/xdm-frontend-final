"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomProgress } from "@/components/ui/custom-progress";
import { Loader2, AlertCircle } from "lucide-react";
import { useUser } from "@/contexts/user-context";

interface Campaign {
  id: string;
  name?: string;
  status?: string;
  progress?: any;
  [key: string]: any;
}

interface MessageData {
  id: string;
  campaignName?: string;
  messages?: any[];
  [key: string]: any;
}

export default function ActiveCampaigns() {
  const { userId } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveCampaigns = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        
        // Fetch active campaigns that are in progress
        const response = await fetch('/api/messages/get-progress');
        const data = await response.json();
        
        // Fetch all messages to get campaign names and total counts
        const messagesResponse = await fetch(`/api/messages?userId=${userId}`);
        const messagesData = await messagesResponse.json();
        
        if (data.campaigns && messagesData.messages) {
          // Map the campaign progress data with campaign details
          const activeCampaigns = data.campaigns.map((campaign: Campaign) => {
            // Find the corresponding message in messagesData
            const messageDetails = messagesData.messages.find(
              (msg: MessageData) => msg.id === campaign.id
            );
            
            if (messageDetails) {
              const totalMessages = messageDetails.messages?.length || 0;
              const processedMessages = campaign.processedCount || 0;
              const progress = totalMessages > 0 
                ? Math.round((processedMessages / totalMessages) * 100) 
                : 0;
                
              return {
                id: campaign.id,
                name: messageDetails.campaignName || "Unnamed Campaign",
                progress: progress,
                sent: processedMessages,
                total: totalMessages,
                status: "Active"
              };
            }
            return null;
          }).filter(Boolean);
          
          // Set the active campaigns
          setCampaigns(activeCampaigns);
        }
      } catch (error) {
        console.error("Error fetching active campaigns:", error);
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveCampaigns();
    
    // Set up polling to refresh data every 30 seconds
    const intervalId = setInterval(fetchActiveCampaigns, 30000);
    
    return () => clearInterval(intervalId);
  }, [userId]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 dark:bg-slate-900/50">
        <CardTitle className="text-base sm:text-lg">Active Campaigns</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm sm:text-base">
                        {campaign.name}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {campaign.sent} / {campaign.total} messages sent
                      </p>
                    </div>
                    <span className={`text-xs sm:text-sm px-2 py-1 rounded-full ${
                      campaign.status === "Active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <CustomProgress value={campaign.progress} />
                </div>
              ))
            ) : (
              <div className="text-center py-10 sm:py-12 px-4 flex flex-col items-center gap-3 text-gray-500">
                <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
                <p className="text-base sm:text-lg font-medium">Your campaigns have not started yet</p>
                <p className="text-xs sm:text-sm">Active campaigns will appear here once they start sending messages</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
