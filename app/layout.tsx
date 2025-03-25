"use client";

import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { UserProvider } from '@/contexts/user-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { useEffect } from 'react';
import { suppressDialogWarnings } from '@/lib/suppress-dialog-warnings';
import Navbar from '@/components/layout/navbar';
import BottomNav from '@/components/layout/bottom-nav';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Suppress dialog warnings on client-side
  useEffect(() => {
    suppressDialogWarnings();
  }, []);
  
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  
  return (
    <html lang="en" data-oid="xib.ut5">
      <body className={inter.className} data-oid="o--xwzf">
        <SessionProvider data-oid="b8q5t3-">
          <UserProvider data-oid="aoxyyc2">
            <ThemeProvider>
              <div className="min-h-screen flex flex-col">
                {!isLoginPage && <Navbar />}
                <main className={`flex-1 flex flex-col ${!isLoginPage ? 'pb-16' : ''}`}>
                  {children}
                </main>
                {!isLoginPage && <BottomNav />}
              </div>
              <Toaster data-oid="s7si95d" />
            </ThemeProvider>
          </UserProvider>
        </SessionProvider>
      </body>
    </html>
  );
}