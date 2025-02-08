'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle, Twitter, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface TwitterAccount {
  id: string;
  authToken: string;
  twitterAccountName: string;
  createdAt: string;
  status: string;
  cookies: any[]; // Array of cookie objects
  userId: string; // Add userId to interface
}

export default function TwitterAccounts({ userId }: { userId: string }) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [cookiesInput, setCookiesInput] = useState('');
  const [twitterAccountName, setTwitterAccountName] = useState('');
  const [error, setError] = useState('');
  const [isValidJson, setIsValidJson] = useState(false);
  const [accounts, setAccounts] = useState<TwitterAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      console.log('data is',data);
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Validate JSON whenever cookiesInput changes
  useEffect(() => {
    if (!cookiesInput.trim()) {
      setIsValidJson(false);
      setError('');
      return;
    }

    try {
      const parsed = JSON.parse(cookiesInput);
      if (!Array.isArray(parsed)) {
        setError('Input must be a JSON array');
        setIsValidJson(false);
        return;
      }
      setError('');
      setIsValidJson(true);
    } catch (err) {
      setError('Not a valid JSON');
      setIsValidJson(false);
    }
  }, [cookiesInput]);

  const handleConnect = async () => {
    if (!isValidJson || !twitterAccountName.trim()) return;
    
    try {
      const cookies = JSON.parse(cookiesInput);
      setConnecting(true);
      
      const response = await fetch('/api/twitter/store-cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cookies,
          twitterAccountName: twitterAccountName.trim(),
          userId // Pass the userId to the API
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to store cookies');
      }

      setConnecting(false);
      setConnectDialogOpen(false);
      setCookiesInput('');
      setTwitterAccountName('');
      // Refresh the accounts list
      fetchAccounts();
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process cookies');
      setConnecting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCookiesInput(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      const response = await fetch(`/api/twitter/delete-account?id=${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Refresh the accounts list
      fetchAccounts();
    } catch (err) {
      console.error('Error deleting account:', err);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Connected Accounts</CardTitle>
            <Button onClick={() => setConnectDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Connect Account
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center p-4 text-muted-foreground">
                No accounts connected. Click Connect Account to add one.
              </div>
            ) : (
              <div className="space-y-4">
                { (accounts || []).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Twitter className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                      <div className="flex items-center gap-2">
                          <h3 className="font-medium">Account @{account.twitterAccountName}</h3>
                          <Badge variant="outline">{account.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Added on {new Date(account.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive"
                      onClick={() => handleDelete(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Connect Twitter Account</DialogTitle>
            <DialogDescription>
              Enter your Twitter account name and paste your cookies to connect your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Twitter Account Name</Label>
              <Input
                placeholder="@username"
                value={twitterAccountName}
                onChange={(e) => setTwitterAccountName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cookies (JSON format)</Label>
              <div className="relative">
                <Textarea
                  placeholder="[{&#34;name&#34;: &#34;auth_token&#34;, &#34;value&#34;: &#34;...&#34;}, ...]"
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  className={cn(
                    "min-h-[200px] font-mono text-sm",
                    error && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handlePaste}
                >
                  Paste
                </Button>
              </div>
              {error ? (
                <p className="text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter your Twitter cookies in JSON array format. Make sure to include all required cookies.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={!isValidJson || !twitterAccountName.trim() || connecting}
            >
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connecting ? 'Connecting...' : 'Connect Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
