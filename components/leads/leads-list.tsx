"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Lead {
  id: string;
  username: string;
  name: string;
  followers: number;
  following: number;
  bio: string;
  status: "Qualified" | "Pending" | "Contacted" | "Active";
}

export const defaultLeads: Lead[] = [
  {
    id: "1",
    username: "@sarahsmith",
    name: "Sarah Smith",
    followers: 12500,
    following: 1100,
    bio: "Tech Founder | SaaS Expert | Building the...",
    status: "Qualified",
  },
  {
    id: "2",
    username: "@mikejohnson",
    name: "Mike Johnson",
    followers: 8900,
    following: 890,
    bio: "Marketing Director @ TechCo | Growth M...",
    status: "Pending",
  },
  {
    id: "3",
    username: "@amychen",
    name: "Amy Chen",
    followers: 15600,
    following: 1200,
    bio: "Startup Advisor | Angel Investor | Ex-Goo...",
    status: "Contacted",
  },
];

interface LeadsListProps {
  leads?: Lead[];
}

export default function LeadsList({ leads = defaultLeads }: LeadsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 15;
  
  // Calculate pagination
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = leads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(leads.length / leadsPerPage);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[30px]">
                <Checkbox />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead className="text-right">Followers</TableHead>
              <TableHead className="text-right">Following</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox />
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {lead.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lead.username}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {lead.bio}
                </TableCell>
                <TableCell className="text-right">
                  {lead.followers.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {lead.following.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lead.status === "Qualified"
                        ? "default"
                        : lead.status === "Contacted"
                          ? "secondary"
                          : "outline"
                    }
                    className={
                      lead.status === "Qualified"
                        ? "bg-[#0F172A] hover:bg-[#1E293B]"
                        : ""
                    }
                  >
                    {lead.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-gray-500">
          Showing {indexOfFirstLead + 1} to {Math.min(indexOfLastLead, leads.length)} of {leads.length} leads
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
