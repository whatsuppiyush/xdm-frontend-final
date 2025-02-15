"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@/contexts/user-context";

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
          const transformedData: MessageList[] = data.messages.map(
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
              };
            },
          );

          setMessageLists(transformedData);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [userId]);

  if (loading) {
    return (
      <Card data-oid="vcwl-ml">
        <CardContent
          className="flex items-center justify-center py-6"
          data-oid="w7s309y"
        >
          <Loader2 className="h-6 w-6 animate-spin" data-oid="zcjj4.4" />
        </CardContent>
      </Card>
    );
  }

  if (!messageLists.length) {
    return (
      <Card data-oid="j1ks321">
        <CardContent className="py-6" data-oid="ylj-4ok">
          <div className="text-center text-muted-foreground" data-oid="odhj:ld">
            No message lists found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-oid="33gae.h">
      <CardContent data-oid="y:1yazv">
        <div className="grid gap-4 py-5" data-oid="4mj43t.">
          {messageLists.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors w-full"
              data-oid="hz7y0mz"
            >
              <div
                className="flex items-center gap-4 w-full"
                data-oid="arhsnn2"
              >
                <div
                  className="p-2 bg-primary/10 rounded-lg"
                  data-oid="_x9vdhz"
                >
                  <Users className="h-5 w-5 text-primary" data-oid="xid56gq" />
                </div>
                <div className="w-full" data-oid="8fxd4m.">
                  <div
                    className="flex items-center gap-2 mb-1"
                    data-oid="om84:jr"
                  >
                    <span
                      className="px-2 py-1 bg-primary/20 text-primary rounded-md text-sm font-semibold"
                      data-oid="si7zr:a"
                    >
                      Message Sent
                    </span>
                    <h3 className="font-medium" data-oid=":n9iduy">
                      {list.messageSent.length > 50
                        ? `${list.messageSent.substring(0, 50)}...`
                        : list.messageSent}
                    </h3>
                  </div>
                  <p
                    className="text-sm text-muted-foreground mb-2"
                    data-oid="i.fbj_v"
                  >
                    Created on {new Date(list.createdAt).toLocaleDateString()}
                  </p>
                  <div className="space-y-2" data-oid="_6tp7wk">
                    <div
                      className="relative w-full bg-secondary h-4 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                      title={`${Math.round((list.processedLeads / list.totalLeads) * 100)}% processed, ${Math.round((list.failedLeads / list.totalLeads) * 100)}% failed`}
                      data-oid="auvqusf"
                    >
                      <div
                        className="absolute left-0 bg-primary h-4 rounded-l-full transition-all duration-300 ease-in-out"
                        style={{
                          width: `${(list.processedLeads / list.totalLeads) * 100}%`,
                        }}
                        data-oid="2:8z::9"
                      />

                      <div
                        className="absolute bg-destructive h-4 transition-all duration-300 ease-in-out"
                        style={{
                          left: `${(list.processedLeads / list.totalLeads) * 100}%`,
                          width: `${(list.failedLeads / list.totalLeads) * 100}%`,
                        }}
                        data-oid="fizihxo"
                      />
                    </div>
                    <div
                      className="flex justify-between text-sm"
                      data-oid="h4z58rd"
                    >
                      <p className="text-muted-foreground" data-oid="wehwfrt">
                        {list.processedLeads.toLocaleString()} of{" "}
                        {list.totalLeads.toLocaleString()} processed
                      </p>
                      <p className="text-destructive" data-oid="5zjl_3u">
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
