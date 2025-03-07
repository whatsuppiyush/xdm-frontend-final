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
      <div className="flex items-center justify-center h-48">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-oid="o0abbsy">
      <Card data-oid="qw0o6d3">
        <CardHeader data-oid="xw9j1ib">
          <CardTitle data-oid="529lcb8">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6" data-oid="n.-pygg">
          <div className="flex items-center gap-6" data-oid="co7.jeg">
            <div className="relative" data-oid="4f0-lby">
              <Avatar className="h-24 w-24" data-oid="_z.4j0x">
                <AvatarImage
                  src={profile.image || ""}
                  alt={profile.name}
                  data-oid="z0gdbg9"
                />
                <AvatarFallback data-oid="2sg8m-_">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full"
                data-oid="._31-yq"
                disabled={session?.user?.provider === "google"}
                title={session?.user?.provider === "google" ? "Profile image is managed by Google" : "Change profile image"}
              >
                <Camera className="h-4 w-4" data-oid="ory0ksc" />
              </Button>
            </div>
            <div className="space-y-1" data-oid="i8042_g">
              <h3 className="font-medium" data-oid="c.6_93q">
                {profile.name || "User"}
              </h3>
              <p className="text-sm text-muted-foreground" data-oid="gel9x_5">
                {profile.email}
              </p>
              {session?.user?.provider && (
                <p className="text-xs text-muted-foreground">
                  Signed in with {session.user.provider === "google" ? "Google" : "Email"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2" data-oid="w0m-84r">
            <div className="space-y-2" data-oid="dgb-9fz">
              <Label htmlFor="name" data-oid="t2l9_zj">
                Full Name
              </Label>
              <Input
                id="name"
                value={profile.name}
                disabled={true}
                title="Name cannot be changed"
                data-oid="z5g7lyf"
              />
            </div>
            <div className="space-y-2" data-oid="vcuup_:">
              <Label htmlFor="email" data-oid="m.yq0pt">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled={true}
                title="Email cannot be changed"
                data-oid="d.m5vx9"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
