"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/ui/logout-button";
import { LayoutDashboard, Settings, Users, MessageSquare } from "lucide-react";

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

  return (
    <div
      className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white"
      data-oid="i3n2j2a"
    >
      <div className="px-3 py-2 flex-1" data-oid="wnsbdha">
        <Link
          href="/"
          className="flex items-center pl-3 mb-14"
          data-oid="bxr-_r8"
        >
          <h1 className="text-2xl font-bold" data-oid="6s0:r2s">
            XDM
          </h1>
        </Link>
        <div className="space-y-1" data-oid="z8d:oe.">
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
              data-oid="02n25tg"
            >
              <div className="flex items-center flex-1" data-oid="3ijbj4j">
                <route.icon
                  className={cn("h-5 w-5 mr-3", route.color)}
                  data-oid="2nr9-0v"
                />

                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="px-3 py-2" data-oid="h-qvsg7">
        <LogoutButton data-oid="as.srpx" />
      </div>
    </div>
  );
}
