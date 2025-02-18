"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      await signOut({
        redirect: false,
        callbackUrl: '/'
      });

      // Clear any stored data
      localStorage.clear();
      sessionStorage.clear();

      // Force reload to clear all states
      window.location.href = '/';
      
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      });
    } finally {
      setOpen(false);
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen} data-oid="bz-944z">
      <AlertDialogTrigger asChild data-oid="0vjweaj">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          data-oid="uffwe5g"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" data-oid="3mv1e-:" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" data-oid="izgd4vf" />
          )}
          {isLoading ? "Logging out..." : "Logout"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-oid="_yolqwa">
        <AlertDialogHeader data-oid="iwhq6u4">
          <AlertDialogTitle data-oid="f48.g9l">
            Are you sure you want to logout?
          </AlertDialogTitle>
          <AlertDialogDescription data-oid="buf4i-k">
            You will need to sign in again to access your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter data-oid="2:ba:9p">
          <AlertDialogCancel disabled={isLoading} data-oid="j:kfu8g">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLogout}
            disabled={isLoading}
            className={isLoading ? "opacity-50 cursor-not-allowed" : ""}
            data-oid="vskih.5"
          >
            {isLoading ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  data-oid="xdedtto"
                />
                Logging out...
              </>
            ) : (
              "Logout"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
