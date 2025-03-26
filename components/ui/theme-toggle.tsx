"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only show the toggle after component has mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // When not mounted yet, return a placeholder with consistent state
  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-9 h-9 rounded-full bg-slate-100 text-slate-700" 
        aria-label="Loading theme toggle" 
        disabled
      >
        <Moon className="h-5 w-5" />
      </Button>
    );
  }

  // Use resolvedTheme instead of theme to get the actual applied theme
  const currentTheme = resolvedTheme || theme;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className={`rounded-full ${
        currentTheme === "dark" 
          ? "bg-slate-800 text-yellow-400 hover:bg-slate-700 hover:text-yellow-300"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {currentTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
} 