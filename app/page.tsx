"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import DashboardMetrics from "@/components/dashboard/metrics";
import ActiveCampaigns from "@/components/dashboard/active-campaigns";
import QuotaUsage from "@/components/dashboard/quota-usage";
import TutorialDialog from "@/components/dashboard/tutorial-dialog";
import Login from "@/components/login/Login";
import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";

export default function Dashboard() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const loading = status === "loading";

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        data-oid="e54rb:7"
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login data-oid="m7jiq3m" />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen" data-oid="oynyh9m">
      <div className="flex-1 flex flex-col min-h-0" data-oid="807gp_m">
        <Navbar data-oid="id3np-h" />
        <main className="flex-1 overflow-y-auto p-4 md:p-8" data-oid="d3n9b.x">
          <div className="max-w-7xl mx-auto space-y-8" data-oid="2_0gl06">
            <div
              className="flex justify-between items-center"
              data-oid="jbwit0z"
            >
              <h1 className="text-3xl font-bold" data-oid="p7:znfx">
                Dashboard
              </h1>
              <Button
                variant="outline"
                onClick={() => setTutorialOpen(true)}
                data-oid="lth3ed_"
              >
                <PlayCircle className="mr-2 h-4 w-4" data-oid="c.bjttq" />
                Watch Tutorial
              </Button>
            </div>

            <DashboardMetrics data-oid="q9oo_:b" />

            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
              data-oid="u5bosik"
            >
              <ActiveCampaigns data-oid="8t1t3lo" />
              {/* <QuotaUsage /> */}
            </div>

            <TutorialDialog
              open={tutorialOpen}
              onOpenChange={setTutorialOpen}
              data-oid="d16fx6y"
            />
          </div>
        </main>
      </div>
    </div>
  );
}