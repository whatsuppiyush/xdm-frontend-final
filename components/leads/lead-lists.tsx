'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUser } from '@/contexts/user-context';

interface MessageList {
  id: string;
  messageSent: string;
  totalLeads: number;
  processedLeads: number;
  failedLeads: number;
  createdAt: string;
}

export default function LeadLists() {
  const [loading, setLoading] = useState(true);
  const [messageLists, setMessageLists] = useState<MessageList[]>([]);
  const { userId } = useUser();

  useEffect(() => {
    const fetchMessages = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/messages?userId=${userId}`);
        const data = await response.json();
        
        if (response.ok) {
          // Transform the data to calculate the required metrics
          const transformedData: MessageList[] = data.messages.map((message: any) => {
            const totalLeads = message.messages.length;
            const processedLeads = message.messages.filter((m: any) => m.status === true).length;
            const failedLeads = message.messages.filter((m: any) => m.status === false).length;

            return {
              id: message.id,
              messageSent: message.messageSent,
              totalLeads,
              processedLeads,
              failedLeads,
              createdAt: message.createdAt
            };
          });

          setMessageLists(transformedData);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!messageLists.length) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            No message lists found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="grid gap-4 py-5">
          {messageLists.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors w-full"
            >
              <div className="flex items-center gap-4 w-full">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded-md text-sm font-semibold">
                      Message Sent
                    </span>
                    <h3 className="font-medium">
                      {list.messageSent.length > 50 
                        ? `${list.messageSent.substring(0, 50)}...` 
                        : list.messageSent}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Created on {new Date(list.createdAt).toLocaleDateString()}
                  </p>
                  <div className="space-y-2">
                    <div 
                      className="relative w-full bg-secondary h-4 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                      title={`${Math.round((list.processedLeads / list.totalLeads) * 100)}% processed, ${Math.round((list.failedLeads / list.totalLeads) * 100)}% failed`}
                    >
                      <div 
                        className="absolute left-0 bg-primary h-4 rounded-l-full transition-all duration-300 ease-in-out"
                        style={{ width: `${(list.processedLeads / list.totalLeads) * 100}%` }}
                      />
                      <div
                        className="absolute bg-destructive h-4 transition-all duration-300 ease-in-out"
                        style={{ 
                          left: `${(list.processedLeads / list.totalLeads) * 100}%`,
                          width: `${(list.failedLeads / list.totalLeads) * 100}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <p className="text-muted-foreground">
                        {list.processedLeads.toLocaleString()} of {list.totalLeads.toLocaleString()} processed
                      </p>
                      <p className="text-destructive">
                        {list.failedLeads.toLocaleString()} failed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}