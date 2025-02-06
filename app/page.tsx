'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import DashboardMetrics from '@/components/dashboard/metrics';
import ActiveCampaigns from '@/components/dashboard/active-campaigns';
import QuotaUsage from '@/components/dashboard/quota-usage';
import TutorialDialog from '@/components/dashboard/tutorial-dialog';
import Login from '@/components/login/Login';
import Navbar from '@/components/layout/navbar';
import Sidebar from '@/components/layout/sidebar';

export default function Dashboard() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const loading = status === 'loading';

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="flex-1 flex flex-col min-h-0">
        <Navbar />
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
              {/* <QuotaUsage /> */}
            </div>

            <TutorialDialog 
              open={tutorialOpen}
              onOpenChange={setTutorialOpen}
            />
          </div>
        </main>
      </div>
    </div>
  );
}