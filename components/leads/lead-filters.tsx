"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

export default function LeadFilters() {
  const [followerRange, setFollowerRange] = useState([0, 100000]);
  const [followingRange, setFollowingRange] = useState([0, 100000]);

  return (
    <Card className="border-0 shadow-none" data-oid="ub.pe48">
      <CardHeader className="px-0" data-oid="xmnhs5p">
        <CardTitle data-oid="18le96w">Filter Leads</CardTitle>
      </CardHeader>
      <CardContent className="px-0 space-y-6" data-oid="2d0gy68">
        <div className="space-y-2" data-oid=":7yfa8s">
          <Label data-oid="vmjl74u">Bio Keywords</Label>
          <Input
            placeholder="Enter keywords..."
            className="border-gray-200"
            data-oid="lja-1b1"
          />
        </div>

        <div className="space-y-4" data-oid="eoj.c24">
          <Label data-oid="m5shr_z">Follower Count Range</Label>
          <Slider
            defaultValue={followerRange}
            max={100000}
            step={1000}
            onValueChange={setFollowerRange}
            className="py-4"
            data-oid="n3ay-6:"
          />

          <div
            className="flex justify-between text-sm text-muted-foreground"
            data-oid="2ich9ds"
          >
            <span data-oid="-_ijkyp">{followerRange[0].toLocaleString()}</span>
            <span data-oid="_k___mj">{followerRange[1].toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4" data-oid="epk-voa">
          <Label data-oid="9iya11o">Following Count Range</Label>
          <Slider
            defaultValue={followingRange}
            max={100000}
            step={1000}
            onValueChange={setFollowingRange}
            className="py-4"
            data-oid="qksd1e4"
          />

          <div
            className="flex justify-between text-sm text-muted-foreground"
            data-oid="r:w9fdc"
          >
            <span data-oid="gzisjge">{followingRange[0].toLocaleString()}</span>
            <span data-oid="2slrakq">{followingRange[1].toLocaleString()}</span>
          </div>
        </div>

        <Button
          className="w-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
          data-oid="g1g6bab"
        >
          Apply Filters
        </Button>
      </CardContent>
    </Card>
  );
}
