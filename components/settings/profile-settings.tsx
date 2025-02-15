"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";

export default function ProfileSettings() {
  const [profile, setProfile] = useState({
    name: "John Doe",
    email: "john@example.com",
    company: "Acme Inc",
    role: "Marketing Director",
  });

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
                  src="https://github.com/shadcn.png"
                  data-oid="z0gdbg9"
                />

                <AvatarFallback data-oid="2sg8m-_">JD</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full"
                data-oid="._31-yq"
              >
                <Camera className="h-4 w-4" data-oid="ory0ksc" />
              </Button>
            </div>
            <div className="space-y-1" data-oid="i8042_g">
              <h3 className="font-medium" data-oid="c.6_93q">
                {profile.name}
              </h3>
              <p className="text-sm text-muted-foreground" data-oid="gel9x_5">
                {profile.email}
              </p>
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
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
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
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                data-oid="d.m5vx9"
              />
            </div>
            <div className="space-y-2" data-oid="u9oam:0">
              <Label htmlFor="company" data-oid="2.o06q:">
                Company
              </Label>
              <Input
                id="company"
                value={profile.company}
                onChange={(e) =>
                  setProfile({ ...profile, company: e.target.value })
                }
                data-oid="m93b52y"
              />
            </div>
            <div className="space-y-2" data-oid="_c8sypr">
              <Label htmlFor="role" data-oid="h6pgkx6">
                Role
              </Label>
              <Input
                id="role"
                value={profile.role}
                onChange={(e) =>
                  setProfile({ ...profile, role: e.target.value })
                }
                data-oid="4kjmhl7"
              />
            </div>
          </div>

          <Button data-oid="-l7un0b">Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
