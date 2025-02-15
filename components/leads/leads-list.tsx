"use client";

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

export interface Lead {
  id: number;
  username: string;
  name: string;
  followers: number;
  following: number;
  bio: string;
  status: "Qualified" | "Pending" | "Contacted";
}

export const defaultLeads: Lead[] = [
  {
    id: 1,
    username: "@sarahsmith",
    name: "Sarah Smith",
    followers: 12500,
    following: 1100,
    bio: "Tech Founder | SaaS Expert | Building the...",
    status: "Qualified",
  },
  {
    id: 2,
    username: "@mikejohnson",
    name: "Mike Johnson",
    followers: 8900,
    following: 890,
    bio: "Marketing Director @ TechCo | Growth M...",
    status: "Pending",
  },
  {
    id: 3,
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
  return (
    <div className="rounded-lg border" data-oid="mxtz0xw">
      <Table data-oid="9ius503">
        <TableHeader data-oid="mv:-o38">
          <TableRow className="bg-gray-50" data-oid="pww.-ml">
            <TableHead className="w-[30px]" data-oid="0xje4x8">
              <Checkbox data-oid="28hl456" />
            </TableHead>
            <TableHead data-oid="5m0xx7n">Name</TableHead>
            <TableHead data-oid="9rn28.g">Bio</TableHead>
            <TableHead className="text-right" data-oid="14cxx3g">
              Followers
            </TableHead>
            <TableHead className="text-right" data-oid="h81rd3d">
              Following
            </TableHead>
            <TableHead data-oid="x3b6v.p">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody data-oid="cz.yzhw">
          {leads.map((lead) => (
            <TableRow key={lead.id} data-oid="sdty3ft">
              <TableCell data-oid="0ap32l7">
                <Checkbox data-oid="2_u-nk_" />
              </TableCell>
              <TableCell data-oid="276.l:b">
                <div data-oid="tl.abi_">
                  <div className="font-medium" data-oid="z0on_ep">
                    {lead.name}
                  </div>
                  <div
                    className="text-sm text-muted-foreground"
                    data-oid="c0to5jv"
                  >
                    {lead.username}
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[300px] truncate" data-oid="da392j0">
                {lead.bio}
              </TableCell>
              <TableCell className="text-right" data-oid="12:6jzx">
                {lead.followers.toLocaleString()}
              </TableCell>
              <TableCell className="text-right" data-oid="podaiuw">
                {lead.following.toLocaleString()}
              </TableCell>
              <TableCell data-oid="v2fc.le">
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
                  data-oid="wmg3b-_"
                >
                  {lead.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
