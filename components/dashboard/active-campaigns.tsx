"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomProgress } from "@/components/ui/custom-progress";
import { Loader2, AlertCircle } from "lucide-react";
import { useUser } from "@/contexts/user-context";

interface Campaign {
  id: string;
  name: string;
  progress: number;
  sent: number;
  total: number;
  status: string;
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
          const activeCampaigns = data.campaigns.map(campaign => {
            // Find the corresponding message in messagesData
            const messageDetails = messagesData.messages.find(
              (msg) => msg.id === campaign.id
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
    <Card data-oid="oj463uj">
      <CardHeader data-oid="mycwl:m">
        <CardTitle data-oid="pkwpczm">Active Campaigns</CardTitle>
      </CardHeader>
      <CardContent data-oid="b6iqhya">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6" data-oid="df07xyn">
            {campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="space-y-2" data-oid="2qv4p_-">
                  <div
                    className="flex items-center justify-between"
                    data-oid="qkrhx3x"
                  >
                    <div data-oid="r-r5k43">
                      <p className="font-medium" data-oid="40d.q.q">
                        {campaign.name}
                      </p>
                      <p
                        className="text-sm text-muted-foreground"
                        data-oid="ao293y7"
                      >
                        {campaign.sent} / {campaign.total} messages sent
                      </p>
                    </div>
                    <span
                      className={`text-sm ${
                        campaign.status === "Active"
                          ? "text-green-500"
                          : "text-yellow-500"
                      }`}
                      data-oid="8yr9x40"
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <CustomProgress value={campaign.progress} data-oid="w7esbu6" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 flex flex-col items-center gap-3 text-gray-500">
                <AlertCircle className="h-10 w-10 text-gray-400" />
                <p className="text-lg font-medium">Your campaigns have not started yet</p>
                <p className="text-sm">Active campaigns will appear here once they start sending messages</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
