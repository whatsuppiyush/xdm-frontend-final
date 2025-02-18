"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import DashboardMetrics from "@/components/dashboard/metrics";
import ActiveCampaigns from "@/components/dashboard/active-campaigns";
import TutorialDialog from "@/components/dashboard/tutorial-dialog";

export default function Dashboard() {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <Button variant="outline" onClick={() => setTutorialOpen(true)}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Watch Tutorial
            </Button>
          </div>

          <DashboardMetrics />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ActiveCampaigns />
          </div>

          <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
        </div>
      </main>
    </div>
  );
}