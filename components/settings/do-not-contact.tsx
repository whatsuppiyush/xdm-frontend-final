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
} from "@/components/ui/dialog";
import { PlusCircle, Twitter, Trash2, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const blockedAccounts = [
  {
    id: 1,
    username: "@competitor1",
    name: "Competitor One",
    dateAdded: "2024-03-20",
    reason: "Competitor",
  },
  {
    id: 2,
    username: "@spamaccount",
    name: "Spam Account",
    dateAdded: "2024-03-19",
    reason: "Spam",
  },
];

export default function DoNotContact() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
      <div className="space-y-6" data-oid="5rvjul8">
        <Card data-oid="lmc1h26">
          <CardHeader
            className="flex flex-row items-center justify-between"
            data-oid="a22x.7k"
          >
            <CardTitle data-oid="5s2ovuy">Do Not Contact List</CardTitle>
            <div className="flex gap-2" data-oid="5im56b4">
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                data-oid="62lcurq"
              >
                <Upload className="mr-2 h-4 w-4" data-oid="5o_go9g" />
                Import CSV
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} data-oid="qgt5p3f">
                <PlusCircle className="mr-2 h-4 w-4" data-oid="kus4wzk" />
                Add Account
              </Button>
            </div>
          </CardHeader>
          <CardContent data-oid="jpys1wm">
            <div className="space-y-4" data-oid="w3mqjib">
              {blockedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-oid="7q-y7dn"
                >
                  <div className="flex items-center gap-4" data-oid="p-gmqjl">
                    <div
                      className="p-2 bg-destructive/10 rounded-lg"
                      data-oid="sbfwbxf"
                    >
                      <Twitter
                        className="h-5 w-5 text-destructive"
                        data-oid="b:0n0ip"
                      />
                    </div>
                    <div data-oid="oa-3k1o">
                      <div
                        className="flex items-center gap-2"
                        data-oid="a6fjh75"
                      >
                        <h3 className="font-medium" data-oid="4hdzgtr">
                          {account.name}
                        </h3>
                        <Badge variant="outline" data-oid=".dx98.6">
                          {account.reason}
                        </Badge>
                      </div>
                      <p
                        className="text-sm text-muted-foreground"
                        data-oid="tsjhoaw"
                      >
                        {account.username} • Added on {account.dateAdded}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    data-oid="x5nvmuz"
                  >
                    <Trash2 className="h-4 w-4" data-oid="2.6o5td" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        data-oid="m7k.8b_"
      >
        <DialogContent data-oid="hq7j036">
          <DialogHeader data-oid="rjs6rry">
            <DialogTitle data-oid="7.cyd46">
              Add to Do Not Contact List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4" data-oid="riqvo38">
            <div className="space-y-2" data-oid="z--91pg">
              <Label data-oid="jre42r0">Twitter Profile URL</Label>
              <Input
                placeholder="https://twitter.com/username"
                value={newAccount.url}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, url: e.target.value })
                }
                data-oid="fufjq.9"
              />
            </div>
            <div className="space-y-2" data-oid="zui1_tk">
              <Label data-oid="zvtk_5e">Reason (Optional)</Label>
              <Input
                placeholder="e.g., Competitor, Spam, etc."
                value={newAccount.reason}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, reason: e.target.value })
                }
                data-oid="p67buqc"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddAccount}
              disabled={!newAccount.url || loading}
              data-oid="zo5-_qz"
            >
              {loading && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  data-oid="ycm6_r6"
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
        data-oid="fc82ipq"
      >
        <DialogContent data-oid="6u.esg3">
          <DialogHeader data-oid="ys56umj">
            <DialogTitle data-oid="cfz9d8m">
              Import Do Not Contact List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4" data-oid="78pi_ks">
            <div className="space-y-2" data-oid="rn4.khy">
              <Label data-oid="vpto36t">Upload CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleImportCsv}
                disabled={loading}
                data-oid="gliouhd"
              />

              <p className="text-sm text-muted-foreground" data-oid="g3tljr.">
                CSV should contain columns: twitter_url, reason (optional)
              </p>
            </div>
            {loading && (
              <div
                className="flex items-center justify-center"
                data-oid="f.wjb9u"
              >
                <Loader2 className="h-6 w-6 animate-spin" data-oid="hv8tg-s" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
