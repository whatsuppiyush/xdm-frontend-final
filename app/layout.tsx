"use client";

import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { UserProvider } from '@/contexts/user-context';
import { ThemeProvider } from '@/components/theme-provider';
import { useEffect } from 'react';
import { suppressDialogWarnings } from '@/lib/suppress-dialog-warnings';
import Navbar from '@/components/layout/navbar';
import BottomNav from '@/components/layout/bottom-nav';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

// Prevent theme flash - more compatible implementation that avoids hydration mismatches
const themeScript = `
  const themeLocalStorageKey = "theme";
  
  function getThemePreference() {
    let theme;
    try {
      theme = localStorage.getItem(themeLocalStorageKey);
    } catch (e) {
      console.error("Failed to read theme from localStorage", e);
    }
    
    return theme || "system";
  }

  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function setTheme(newTheme) {
    try {
      // Store the explicit theme preference
      if (newTheme) {
        localStorage.setItem(themeLocalStorageKey, newTheme);
      }
  
      // Apply theme to document
      if (newTheme === "system") {
        const prefersDark = getSystemTheme() === "dark";
        document.documentElement.classList.toggle("dark", prefersDark);
      } else {
        document.documentElement.classList.toggle("dark", newTheme === "dark");
      }
    } catch (e) {
      console.error("Failed to set theme", e);
    }
  }

  // Add system theme change listener
  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentTheme = getThemePreference();
      if (currentTheme === "system") {
        setTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
  } catch (e) {
    console.error("Failed to add theme change listener", e);
  }

  // Initialize theme
  const theme = getThemePreference();
  setTheme(theme);
`;

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
    <html lang="en" suppressHydrationWarning data-oid="xib.ut5">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: `window.lemonSqueezyAffiliateConfig = { store: "xautodm" };` }}></script>
        <script src="https://lmsqueezy.com/affiliate.js" defer></script>
      </head>
      <body className={`${inter.className} antialiased bg-white dark:bg-slate-950`} data-oid="o--xwzf">
        <SessionProvider data-oid="b8q5t3-">
          <UserProvider data-oid="aoxyyc2">
            <ThemeProvider attribute="class" enableSystem defaultTheme="system" disableTransitionOnChange>
              <div className="min-h-screen flex flex-col dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900">
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