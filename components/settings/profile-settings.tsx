"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/use-toast";

export default function ProfileSettings() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    image: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setProfile({
        name: session.user.name || "",
        email: session.user.email || "",
        image: session.user.image || "",
      });
      setIsLoading(false);
    } else if (status === "unauthenticated") {
      setIsLoading(false);
    }
  }, [session, status]);

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="dark:text-gray-300">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card className="w-full border rounded-lg shadow-sm dark:border-[#1a2436] dark:bg-[#0c1221]">
        <CardHeader className="p-4 sm:p-6 border-b dark:border-[#1a2436]">
          <CardTitle className="text-xl dark:text-white">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border dark:border-[#242f44]">
                <AvatarImage
                  src={profile.image || ""}
                  alt={profile.name}
                />
                <AvatarFallback className="dark:bg-[#131c2e] dark:text-gray-200">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full h-6 w-6 dark:bg-[#242f44] dark:hover:bg-[#30394d]"
                disabled={session?.user?.provider === "google"}
                title={session?.user?.provider === "google" ? "Profile image is managed by Google" : "Change profile image"}
              >
                <Camera className="h-3 w-3 dark:text-gray-300" />
              </Button>
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-base sm:text-lg dark:text-white">
                {profile.name || "User"}
              </h3>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                {profile.email}
              </p>
              {session?.user?.provider && (
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  Signed in with {session.user.provider === "google" ? "Google" : "Email"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium dark:text-gray-300">
                Full Name
              </Label>
              <Input
                id="name"
                value={profile.name}
                disabled={true}
                className="h-10 dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-400"
                title="Name cannot be changed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium dark:text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled={true}
                className="h-10 dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-400"
                title="Email cannot be changed"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
