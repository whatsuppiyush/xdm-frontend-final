"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  // Prevent theme flashing during hydration
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // By setting suppressHydrationWarning, we prevent React warnings
  // about attribute mismatches during server rendering vs client hydration
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={!mounted ? undefined : undefined}
      {...props}
      data-oid="8g7m:o2"
    >
      <span style={{ visibility: !mounted ? 'hidden' : 'visible' }}>
        {children}
      </span>
    </NextThemesProvider>
  );
}
