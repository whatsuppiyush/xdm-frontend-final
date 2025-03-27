"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlusCircle, Twitter, Trash2, Upload, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BlockedAccount {
  id: string;
  username: string;
  name: string;
  dateAdded: string;
  reason: string;
}

interface DoNotContactProps {
  showComingSoon?: boolean;
  setShowComingSoon?: (show: boolean) => void;
}

export default function DoNotContact({ showComingSoon = false, setShowComingSoon = () => {} }: DoNotContactProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccount[]>([]);
  const [newAccount, setNewAccount] = useState({
    url: "",
    reason: "",
  });

  const handleAddAccount = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
    setAddDialogOpen(false);
    setNewAccount({ url: "", reason: "" });
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setLoading(true);
      // Simulate CSV processing
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setLoading(false);
      setImportDialogOpen(false);
    }
  };

  return (
    <>
      <div className="w-full">
        <Card className="w-full border rounded-lg shadow-sm dark:border-[#1a2436] dark:bg-[#0c1221]">
          <CardHeader className="p-4 sm:p-6 border-b dark:border-[#1a2436]">
            <CardTitle className="text-xl flex justify-between items-center dark:text-white">
              <span>Do Not Contact List</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs sm:text-sm dark:border-[#242f44] dark:text-gray-300 dark:bg-[#0c1221] dark:hover:bg-[#131c2e]"
                  onClick={() => setImportDialogOpen(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
                <Button 
                  size="sm"
                  className="h-9 text-xs sm:text-sm dark:bg-purple-700 dark:hover:bg-purple-800 text-white"
                  onClick={() => setAddDialogOpen(true)} 
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              {blockedAccounts.length > 0 ? (
                blockedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 dark:border-[#1a2436] dark:bg-[#131c2e]/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-destructive/10 rounded-lg shrink-0 dark:bg-red-950/30">
                        <Twitter className="h-5 w-5 text-destructive dark:text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-sm dark:text-white">
                            {account.name}
                          </h3>
                          <Badge variant="outline" className="text-xs dark:border-[#242f44] dark:bg-[#131c2e] dark:text-gray-300">
                            {account.reason}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate dark:text-gray-400">
                          {account.username} • Added on {account.dateAdded}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 w-8 p-0 self-end sm:self-center ml-auto dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground dark:text-gray-400">
                  <p>No accounts in your Do Not Contact list</p>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="mt-4 h-9 dark:border-[#242f44] dark:text-gray-300 dark:bg-[#0c1221] dark:hover:bg-[#131c2e]"
                    onClick={() => setAddDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Dialog */}
      <Dialog
        open={showComingSoon}
        onOpenChange={setShowComingSoon}
      >
        <DialogContent className="sm:max-w-md p-6 dark:bg-[#0c1221] dark:border-[#1a2436]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 dark:text-white">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Coming Soon
            </DialogTitle>
            <DialogDescription className="text-base dark:text-gray-300">
              The Do Not Contact List feature is coming soon! We&apos;re working hard to bring you this functionality.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground dark:text-gray-400 mb-3">
              This feature will allow you to maintain a list of Twitter accounts that you do not wish to interact with.
            </p>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                Stay tuned for the next update which will include this feature!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full dark:bg-purple-700 dark:hover:bg-purple-800 text-white"
              onClick={() => setShowComingSoon(false)}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-md p-4 sm:p-6 dark:bg-[#0c1221] dark:border-[#1a2436]">
          <DialogHeader>
            <DialogTitle className="text-lg dark:text-white">
              Add to Do Not Contact List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-sm dark:text-gray-300">Twitter Profile URL</Label>
              <Input
                placeholder="https://twitter.com/username"
                value={newAccount.url}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, url: e.target.value })
                }
                className="text-sm h-10 dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm dark:text-gray-300">Reason (Optional)</Label>
              <Input
                placeholder="e.g., Competitor, Spam, etc."
                value={newAccount.reason}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, reason: e.target.value })
                }
                className="text-sm h-10 dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-200"
              />
            </div>
            <Button
              className="w-full text-sm h-10 dark:bg-purple-700 dark:hover:bg-purple-800"
              onClick={handleAddAccount}
              disabled={!newAccount.url || loading}
            >
              {loading && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                />
              )}
              {loading ? "Adding Account..." : "Add Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-md p-4 sm:p-6 dark:bg-[#0c1221] dark:border-[#1a2436]">
          <DialogHeader>
            <DialogTitle className="text-lg dark:text-white">
              Import Do Not Contact List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-sm dark:text-gray-300">Upload CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleImportCsv}
                disabled={loading}
                className="text-sm h-10 dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-200"
              />

              <p className="text-xs text-muted-foreground dark:text-gray-400">
                CSV should contain columns: twitter_url, reason (optional)
              </p>
            </div>
            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin dark:text-gray-300" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
