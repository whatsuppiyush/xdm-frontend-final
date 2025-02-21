"use client";

import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import dynamic from 'next/dynamic';
import './globals.css';
import { UserProvider } from '@/contexts/user-context';

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
  return (
    <html lang="en" data-oid="xib.ut5">
      <body className={inter.className} data-oid="o--xwzf">
        <SessionProvider data-oid="b8q5t3-">
          <UserProvider data-oid="aoxyyc2">
            <div className="h-screen" data-oid="r2kscva">
              <div
                className="hidden md:flex h-full w-72 flex-col fixed inset-y-0 z-50"
                data-oid="ad3mi:h"
              >
                <Sidebar data-oid="053oqqx" />
              </div>
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