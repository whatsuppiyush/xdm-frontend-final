"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, User, Users } from "lucide-react";

export interface Lead {
  id: string;
  username: string;
  name: string;
  followers: number;
  following: number;
  bio: string;
  status: "Qualified" | "Pending" | "Contacted" | "Active";
}

interface LeadsGridProps {
  leads: Lead[];
}

export default function LeadsGrid({ leads }: LeadsGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 12;
  
  // Calculate pagination
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = leads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(leads.length / leadsPerPage);

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        {currentLeads.map((lead) => (
          <Card 
            key={lead.id}
            className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all h-full hover:shadow-md overflow-hidden"
          >
            <CardContent className="p-2.5 sm:p-4 flex flex-col h-full">
              <div className="mb-2">
                <div className="font-medium text-gray-900 dark:text-gray-100 text-base break-words">{lead.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 break-words">{lead.username}</div>
              </div>
              
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2 break-words">
                {lead.bio || "No bio available"}
              </div>
              
              <div className="flex flex-wrap gap-1 sm:gap-2 mt-auto">
                <div className="flex items-center text-gray-700 dark:text-gray-300 text-xs">
                  <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span>{lead.followers.toLocaleString()}</span>
                </div>
                <div className="flex items-center text-gray-700 dark:text-gray-300 text-xs">
                  <User className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span>{lead.following.toLocaleString()}</span>
                </div>
                <div className="ml-auto">
                  <Badge
                    variant={
                      lead.status === "Active"
                        ? "default"
                        : lead.status === "Contacted"
                          ? "secondary"
                          : "outline"
                    }
                    className={
                      lead.status === "Active"
                        ? "bg-[#0F172A] hover:bg-[#1E293B] dark:bg-slate-700 dark:hover:bg-slate-600 text-xs"
                        : "text-xs dark:border-slate-600"
                    }
                  >
                    {lead.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-2 sm:gap-0">
        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left w-full sm:w-auto">
          Showing {indexOfFirstLead + 1} to {Math.min(indexOfLastLead, leads.length)} of {leads.length}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 dark:border-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-xs sm:text-sm min-w-[80px] text-center dark:text-gray-300">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0 dark:border-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 