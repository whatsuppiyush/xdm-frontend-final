"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Twitter, HelpCircle, Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./sidebar";
import { LogoutButton } from "@/components/ui/logout-button";
import { useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const userName = session?.user?.name || userEmail?.split("@")[0] || "User";
  const userImage = session?.user?.image;

  return (
    <div
      className="h-16 border-b px-4 md:px-6 flex items-center justify-end"
      data-oid="2snud40"
    >
      <Sheet data-oid=":xi_cca">
        <SheetTrigger asChild data-oid="k5c6ybh">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            data-oid="f0cl_1u"
          >
            <Menu className="h-5 w-5" data-oid="-sscjh0" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0" data-oid="2yuemet">
          kkkk
          <Sidebar data-oid="po-pfo_" />
        </SheetContent>
      </Sheet>

      <div className="md:hidden font-semibold" data-oid="iip4_zj">
        Twitter Outreach
      </div>

      <DropdownMenu data-oid="egwheqm">
        <DropdownMenuTrigger asChild data-oid="u-ic48w">
          <Button
            variant="ghost"
            className="relative h-8 w-8 rounded-full"
            data-oid="nn5.n9z"
          >
            <Avatar className="h-8 w-8" data-oid="1ea2x33">
              <AvatarImage
                src={userImage || undefined}
                alt={userName}
                data-oid="bh9_bst"
              />

              <AvatarFallback data-oid="d_qc-7i">
                {userName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" data-oid="os9lzrx">
          <DropdownMenuLabel data-oid="jrz2x87">
            <div className="flex flex-col space-y-1" data-oid="dm1b1vx">
              <p className="text-sm font-medium" data-oid="0eco9.:">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground" data-oid="dmzh9ew">
                {userEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator data-oid="v_12.mr" />
          <DropdownMenuGroup data-oid="z32fqno">
            <DropdownMenuItem asChild data-oid="pm6df1w">
              <Link
                href="/settings?tab=twitter"
                className="cursor-pointer"
                data-oid="tj3e16w"
              >
                <Twitter className="mr-2 h-4 w-4" data-oid=":itc6m7" />
                Twitter Accounts
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-oid="rfhy8c9">
              <Link
                href="/settings?tab=subscription"
                className="cursor-pointer"
                data-oid="llcbuwf"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  data-oid=":x6p0w1"
                >
                  <path
                    d="M4 3h16a2 2 0 0 1 2 2v6a10 10 0 0 1-10 10A10 10 0 0 1 2 11V5a2 2 0 0 1 2-2z"
                    data-oid="32mqey5"
                  />

                  <polyline points="8 10 12 14 16 10" data-oid="eo2x:y_" />
                </svg>
                Subscription Plan
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-oid="5r9r-wl">
              <Link href="/help" className="cursor-pointer" data-oid="nlw0cb9">
                <HelpCircle className="mr-2 h-4 w-4" data-oid="ug3yf6z" />
                Help & Support
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator data-oid="nry4gsq" />
          <LogoutButton data-oid="wizq4-t" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
