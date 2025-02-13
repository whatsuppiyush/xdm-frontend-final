'use client';

import { useState } from 'react';

import ImportDialog from '@/components/leads/import-dialog';

import { PlusCircle } from 'lucide-react';

export default function LeadsPage() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage your Leads</h1>
   
      </div>
      
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}