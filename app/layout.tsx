"use client";

import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import dynamic from 'next/dynamic';
import './globals.css';
import { UserProvider } from '@/contexts/user-context';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { suppressDialogWarnings } from '@/lib/suppress-dialog-warnings';

const Sidebar = dynamic(() => import('@/components/layout/sidebar'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Suppress dialog warnings on client-side
  useEffect(() => {
    suppressDialogWarnings();
  }, []);
  return (
    <html lang="en" data-oid="xib.ut5">
      <body className={inter.className} data-oid="o--xwzf">
        <SessionProvider data-oid="b8q5t3-">
          <UserProvider data-oid="aoxyyc2">
            <div className="h-screen" data-oid="r2kscva">
              {/* Desktop Sidebar */}
              <div
                className="hidden md:flex h-full w-72 flex-col fixed inset-y-0 z-50"
                data-oid="ad3mi:h"
              >
                <Sidebar data-oid="053oqqx" />
              </div>
              
              {/* Mobile Sidebar Sheet */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="p-0 w-[85%] max-w-[300px]" closeButton={false}>
                  <Sidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
              
              {/* Mobile Header with Menu Button */}
              <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b flex items-center px-3 z-50 md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="font-semibold flex-1 text-center">XAutoDM</div>
              </div>
              
              {/* Add padding to main content on mobile to account for the header */}
              <div className="h-14 md:hidden"></div>
              
              <main className="md:pl-72 h-full" data-oid="81dj3i8">
                {children}
              </main>
            </div>
            <Toaster data-oid="s7si95d" />
          </UserProvider>
        </SessionProvider>
      </body>
    </html>
  );
}