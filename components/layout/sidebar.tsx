"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/ui/logout-button";
import { LayoutDashboard, Settings, Users, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@/contexts/user-context";
import { useSession } from "next-auth/react";

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    color: "text-sky-500",
  },
  {
    label: "Find Leads",
    icon: Users,
    href: "/leads",
    color: "text-violet-500",
  },
  {
    label: "Campaign",
    icon: MessageSquare,
    href: "/campaign",
    color: "text-green-500",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
    color: "text-pink-700",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { userId } = useUser();
  const { data: session } = useSession();
  const [credits, setCredits] = useState({
    leadCredits: 0,
    planType: null as string | null,
    loading: true,
  });

  useEffect(() => {
    const fetchUserCredits = async () => {
      if (!userId) return;
      
      try {
        const creditsResponse = await fetch("/api/user/credits");
        const creditsData = await creditsResponse.json();
        
        setCredits({
          leadCredits: creditsData.leadCredits || 0,
          planType: creditsData.planType,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching credits:", error);
        setCredits(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserCredits();
  }, [userId]);

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
      <div className="px-3 py-2 flex-1">
        <Link href="/" className="flex items-center pl-3 mb-14">
          <h1 className="text-2xl font-bold">XDM</h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                pathname === route.href
                  ? "text-white bg-white/10"
                  : "text-zinc-400",
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Only show credits for paid users */}
      {session?.user && credits.planType && !credits.loading && (
        <div className="px-3 py-2 border-t border-gray-700">
          <div className="space-y-3 px-3 py-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Lead Credits Remaining:</span>
              <span className={cn(
                "font-medium",
                credits.leadCredits <= 0 && "text-red-500"
              )}>
                {credits.leadCredits.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div className="px-3 py-2">
        <LogoutButton />
      </div>
    </div>
  );
}
