"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ImportLeads from "@/components/leads/import-leads";
import LeadListCard from "@/components/leads/lead-list-card";

export default function LeadsPage() {
  const [isImporting, setIsImporting] = useState(false);

  const leadLists = [
    {
      id: 1,
      name: "Ph Launch",
      leadCount: 1051,
    },
    {
      id: 2,
      name: "new leads",
      leadCount: 1051,
    },
    {
      id: 3,
      name: "new leads 2",
      leadCount: 1051,
    },
  ];

  if (isImporting) {
    return (
      <ImportLeads onBack={() => setIsImporting(false)} data-oid="ksb6fbp" />
    );
  }

  return (
    <div className="p-8 space-y-8" data-oid="w48.oeq">
      <div className="flex justify-between items-center" data-oid="f1zr.-5">
        <h1 className="text-3xl font-bold" data-oid="kixsdnz">
          Manage your Leads
        </h1>
        <Button
          onClick={() => setIsImporting(true)}
          variant="outline"
          className="border-2"
          data-oid="0xo.vy5"
        >
          Add new leads
        </Button>
      </div>

      <div className="border-2 rounded-lg p-6" data-oid="8v3ff3-">
        <div className="grid grid-cols-3 gap-6" data-oid="5flm2d3">
          {leadLists.map((list) => (
            <LeadListCard
              key={list.id}
              name={list.name}
              leadCount={list.leadCount}
              onCreateAutomation={() => {}}
              onDelete={() => {}}
              data-oid="d81cabo"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
