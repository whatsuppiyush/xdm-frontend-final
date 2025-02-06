'use client';

import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/layout/sidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <div className="h-screen">
            <div className="hidden md:flex h-full w-72 flex-col fixed inset-y-0 z-50">
              <Sidebar />
            </div>
            <main className="md:pl-72 h-full">
              {children}
            </main>
          </div>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}