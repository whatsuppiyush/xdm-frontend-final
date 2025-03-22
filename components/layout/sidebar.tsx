"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
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

  const handleNavigation = (href: string) => {
    if (onNavigate) {
      onNavigate();
    }
    router.push(href);
  };

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white overflow-y-auto">
      <div className="px-3 py-2 flex-1">
        <Link href="/" onClick={() => onNavigate?.()} className="flex items-center pl-3 mb-8 md:mb-14">
          <div className="h-8 w-auto">
            <Image 
              src="https://xautodm.com/logo.svg" 
              alt="XDM Logo" 
              width={120}
              height={32}
              className="h-full w-auto"
            />
          </div>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <div
              key={route.href}
              onClick={() => handleNavigation(route.href)}
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
            </div>
          ))}
        </div>
      </div>
      
      {/* Only show credits for paid users */}
      {session?.user && credits.planType && !credits.loading && (
        <div className="px-3 py-2 border-t border-gray-700">
          <div className="space-y-3 px-3 py-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Lead Credits:</span>
              <span className={cn(
                "font-medium",
                credits.leadCredits <= 0 && "text-red-500"
              )}>
                {credits.leadCredits.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Plan:</span>
              <span className="font-medium text-blue-400">
                {credits.planType}
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
