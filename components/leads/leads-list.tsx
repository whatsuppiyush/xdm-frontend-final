'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const leads = [
  {
    id: 1,
    username: '@sarahsmith',
    name: 'Sarah Smith',
    followers: 12500,
    following: 1100,
    bio: 'Tech Founder | SaaS Expert | Building the future of...',
    status: 'Qualified',
  },
  {
    id: 2,
    username: '@mikejohnson',
    name: 'Mike Johnson',
    followers: 8900,
    following: 890,
    bio: 'Marketing Director @ TechCo | Growth Marketing | B2B',
    status: 'Pending',
  },
  {
    id: 3,
    username: '@amychen',
    name: 'Amy Chen',
    followers: 15600,
    following: 1200,
    bio: 'Startup Advisor | Angel Investor | Ex-Google',
    status: 'Contacted',
  },
];

export default function LeadsList() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead className="text-right">Followers</TableHead>
            <TableHead className="text-right">Following</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <Checkbox />
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {lead.username}
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-xs truncate">{lead.bio}</TableCell>
              <TableCell className="text-right">
                {lead.followers.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {lead.following.toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    lead.status === 'Qualified'
                      ? 'default'
                      : lead.status === 'Contacted'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {lead.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}