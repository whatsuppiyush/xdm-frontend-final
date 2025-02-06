'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle, Twitter, Trash2, Upload, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const blockedAccounts = [
  {
    id: 1,
    username: '@competitor1',
    name: 'Competitor One',
    dateAdded: '2024-03-20',
    reason: 'Competitor',
  },
  {
    id: 2,
    username: '@spamaccount',
    name: 'Spam Account',
    dateAdded: '2024-03-19',
    reason: 'Spam',
  },
];

export default function DoNotContact() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newAccount, setNewAccount] = useState({
    url: '',
    reason: '',
  });

  const handleAddAccount = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setAddDialogOpen(false);
    setNewAccount({ url: '', reason: '' });
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setLoading(true);
      // Simulate CSV processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      setLoading(false);
      setImportDialogOpen(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Do Not Contact List</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {blockedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-destructive/10 rounded-lg">
                      <Twitter className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{account.name}</h3>
                        <Badge variant="outline">{account.reason}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.username} • Added on {account.dateAdded}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Do Not Contact List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Twitter Profile URL</Label>
              <Input
                placeholder="https://twitter.com/username"
                value={newAccount.url}
                onChange={(e) => setNewAccount({ ...newAccount, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input
                placeholder="e.g., Competitor, Spam, etc."
                value={newAccount.reason}
                onChange={(e) => setNewAccount({ ...newAccount, reason: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddAccount}
              disabled={!newAccount.url || loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Adding Account...' : 'Add Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Do Not Contact List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleImportCsv}
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                CSV should contain columns: twitter_url, reason (optional)
              </p>
            </div>
            {loading && (
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}