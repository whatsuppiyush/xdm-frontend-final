'use client';

import { Card, CardContent } from '@/components/ui/card';
import {  Users } from 'lucide-react';


const queueProcessingList = [
  {
    id: 1,
    name: 'Queue 1',
    totalLeads: 200,
    processedLeads: 100,
    failedLeads: 20,
  },
  {
    id: 2,
    name: 'Queue 2',
    totalLeads: 100,
    processedLeads: 25,
    failedLeads: 5,
  }
];

export default function LeadLists() {
  return (
    <Card>
      {/* <CardHeader>
        <CardTitle>Lead Lists</CardTitle>
      </CardHeader> */}
      <CardContent>
        <div className="grid gap-4 py-5">
          {queueProcessingList.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors w-full"
            >
              <div className="flex items-center gap-4 w-full">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="w-full">
                  <h3 className="font-medium">{list.name}</h3>
                  <div className="space-y-2">
                    <div 
                      className="relative w-full bg-secondary h-4 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
                      title={`${Math.round((list.processedLeads / list.totalLeads) * 100)}% processed, ${Math.round((list.failedLeads / list.totalLeads) * 100)}% failed`}
                    >
                      <div 
                        className="absolute left-0 bg-primary h-4 rounded-l-full transition-all duration-300 ease-in-out"
                        style={{ width: `${(list.processedLeads / list.totalLeads) * 100}%` }}
                      />
                      <div
                        className="absolute bg-destructive h-4 transition-all duration-300 ease-in-out"
                        style={{ 
                          left: `${(list.processedLeads / list.totalLeads) * 100}%`,
                          width: `${(list.failedLeads / list.totalLeads) * 100}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <p className="text-muted-foreground">
                        {list.processedLeads.toLocaleString()} of {list.totalLeads.toLocaleString()} processed
                      </p>
                      <p className="text-destructive">
                        {list.failedLeads.toLocaleString()} failed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}