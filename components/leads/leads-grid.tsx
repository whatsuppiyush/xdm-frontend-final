"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, User, Users, ExternalLink, AlertCircle } from "lucide-react";

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
  const [isLoaded, setIsLoaded] = useState(false);
  const leadsPerPage = 12;
  
  useEffect(() => {
    setIsLoaded(true);
  }, []);
  
  // Calculate pagination
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = leads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(leads.length / leadsPerPage);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      case "Contacted":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      case "Qualified":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700";
    }
  };

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      <style jsx global>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .card-animate {
          animation: fadeInScale 0.3s ease-out forwards;
          animation-delay: calc(var(--index) * 0.05s);
          opacity: 0;
        }
        
        .card-hover {
          transition: all 0.2s ease-in-out;
        }
        
        .card-hover:hover {
          transform: translateY(-2px);
        }
      `}</style>
      
      {leads.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center justify-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-3">
            <AlertCircle className="h-6 w-6 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No leads found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">There are no leads available in this list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {currentLeads.map((lead, index) => (
            <Card 
              key={lead.id}
              className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all duration-200 h-full hover:shadow-md overflow-hidden group card-hover"
              style={{ animationFillMode: 'both', animationDelay: `${index * 50}ms` }}
            >
              <CardContent className={`p-3 sm:p-4 flex flex-col h-full ${isLoaded ? 'card-animate' : ''}`} style={{ '--index': index } as any}>
                <div className="mb-2.5">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-base mb-0.5 break-words group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1">
                    {lead.name}
                    <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 break-words">@{lead.username}</div>
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 break-words">
                  {lead.bio || "No bio available"}
                </div>
                
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-auto">
                  <div className="flex items-center text-gray-700 dark:text-gray-300 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                    <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span>{lead.followers.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center text-gray-700 dark:text-gray-300 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                    <User className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span>{lead.following.toLocaleString()}</span>
                  </div>
                  <div className="ml-auto">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusStyles(lead.status)}`}
                    >
                      {lead.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {leads.length > leadsPerPage && (
        <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-2 sm:gap-0 pt-2">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left w-full sm:w-auto">
            Showing <span className="font-medium">{indexOfFirstLead + 1}</span> to <span className="font-medium">{Math.min(indexOfLastLead, leads.length)}</span> of <span className="font-medium">{leads.length}</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 dark:border-slate-700 rounded-full transition-all duration-200 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs sm:text-sm min-w-[80px] text-center dark:text-gray-300">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 dark:border-slate-700 rounded-full transition-all duration-200 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 