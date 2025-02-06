'use client';

import { useState } from 'react';
import LeadLists from '@/components/leads/lead-lists';
import ImportDialog from '@/components/leads/import-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function LeadsPage() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage your Leads</h1>
        <Button onClick={() => setImportDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Import Leads
        </Button>
      </div>
      <LeadLists />
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}