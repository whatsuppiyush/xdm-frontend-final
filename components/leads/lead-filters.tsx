'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useState } from 'react';

export default function LeadFilters() {
  const [followerRange, setFollowerRange] = useState([0, 100000]);
  const [followingRange, setFollowingRange] = useState([0, 100000]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Leads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Bio Keywords</Label>
          <Input placeholder="Enter keywords..." />
        </div>

        <div className="space-y-4">
          <Label>Follower Count Range</Label>
          <Slider
            defaultValue={followerRange}
            max={100000}
            step={1000}
            onValueChange={setFollowerRange}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{followerRange[0].toLocaleString()}</span>
            <span>{followerRange[1].toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4">
          <Label>Following Count Range</Label>
          <Slider
            defaultValue={followingRange}
            max={100000}
            step={1000}
            onValueChange={setFollowingRange}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{followingRange[0].toLocaleString()}</span>
            <span>{followingRange[1].toLocaleString()}</span>
          </div>
        </div>

        <Button className="w-full">Apply Filters</Button>
      </CardContent>
    </Card>
  );
}