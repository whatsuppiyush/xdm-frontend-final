"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessageSquare, Settings, Grid, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";

const routes = [
  {
    label: "Dashboard",
    icon: Grid,
    href: "/",
    color: "text-sky-500 dark:text-sky-400",
    activeColor: "bg-sky-50 dark:bg-sky-900/30",
    textColor: "text-sky-500 dark:text-sky-400"
  },
  {
    label: "Find Leads",
    icon: UserSearch,
    href: "/leads",
    color: "text-violet-500 dark:text-violet-400",
    activeColor: "bg-violet-50 dark:bg-violet-900/30",
    textColor: "text-violet-500 dark:text-violet-400"
  },
  {
    label: "Campaign",
    icon: MessageSquare,
    href: "/campaign",
    color: "text-green-500 dark:text-green-400",
    activeColor: "bg-green-50 dark:bg-green-900/30",
    textColor: "text-green-500 dark:text-green-400"
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
    color: "text-pink-700 dark:text-pink-400",
    activeColor: "bg-pink-50 dark:bg-pink-900/30",
    textColor: "text-pink-700 dark:text-pink-400"
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { theme } = useTheme();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t flex items-center justify-around h-16 z-50">
      <div className="max-w-2xl w-full mx-auto flex justify-around">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex flex-col items-center justify-center w-1/4 py-2",
              pathname === route.href && "md:border-t-2 md:border-t-current"
            )}
          >
            <div className={cn(
              "md:hidden", // Icon only on mobile
              "h-5 w-5 mb-1",
              pathname === route.href ? route.color : "text-muted-foreground"
            )}>
              <route.icon className="h-full w-full" />
            </div>
            
            {/* Desktop view - show icon and text side by side */}
            <div className={cn(
              "hidden md:flex md:items-center md:space-x-2",
              pathname === route.href 
                ? cn("px-4 py-2 rounded-md", route.activeColor, route.textColor)
                : "text-muted-foreground"
            )}>
              <route.icon className="h-5 w-5" />
              <span className="font-medium">{route.label}</span>
            </div>
            
            {/* Label text for mobile */}
            <span className={cn(
              "text-xs md:hidden",
              pathname === route.href
                ? route.color 
                : "text-muted-foreground"
            )}>
              {route.label}
            </span>
          </Link>
        ))}
      </div>
      
      {/* Theme toggle button - visible only on mobile */}
      {/* Removed mobile theme toggle since it's redundant with the navbar toggle */}
    </div>
  );
} 