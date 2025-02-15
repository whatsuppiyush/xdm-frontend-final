"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  PlusCircle,
  Twitter,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
  const [cookiesInput, setCookiesInput] = useState("");
  const [twitterAccountName, setTwitterAccountName] = useState("");
  const [error, setError] = useState("");
  const [isValidJson, setIsValidJson] = useState(false);
  const [accounts, setAccounts] = useState<TwitterAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(
        `/api/twitter/get-accounts?userId=${userId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await response.json();
      console.log("data is", data);
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
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
      setError("");
      return;
    }

    try {
      const parsed = JSON.parse(cookiesInput);
      if (!Array.isArray(parsed)) {
        setError("Input must be a JSON array");
        setIsValidJson(false);
        return;
      }
      setError("");
      setIsValidJson(true);
    } catch (err) {
      setError("Not a valid JSON");
      setIsValidJson(false);
    }
  }, [cookiesInput]);

  const handleConnect = async () => {
    if (!isValidJson || !twitterAccountName.trim()) return;

    try {
      const cookies = JSON.parse(cookiesInput);
      setConnecting(true);

      const response = await fetch("/api/twitter/store-cookies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies,
          twitterAccountName: twitterAccountName.trim(),
          userId, // Pass the userId to the API
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.details || "Failed to store cookies",
        );
      }

      setConnecting(false);
      setConnectDialogOpen(false);
      setCookiesInput("");
      setTwitterAccountName("");
      // Refresh the accounts list
      fetchAccounts();
    } catch (err) {
      console.error("Error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to process cookies",
      );
      setConnecting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCookiesInput(text);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      const response = await fetch(
        `/api/twitter/delete-account?id=${accountId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      // Refresh the accounts list
      fetchAccounts();
    } catch (err) {
      console.error("Error deleting account:", err);
    }
  };

  return (
    <>
      <div className="space-y-6" data-oid="_02-ux-">
        <Card data-oid="24fbyad">
          <CardHeader
            className="flex flex-row items-center justify-between"
            data-oid="4a57k.p"
          >
            <CardTitle data-oid="8:8ogs0">Connected Accounts</CardTitle>
            <Button
              onClick={() => setConnectDialogOpen(true)}
              data-oid="ntyu4b9"
            >
              <PlusCircle className="mr-2 h-4 w-4" data-oid="gzg3qo." />
              Connect Account
            </Button>
          </CardHeader>
          <CardContent data-oid="obx:x5m">
            {loading ? (
              <div
                className="flex items-center justify-center p-4"
                data-oid="fhdnqpy"
              >
                <Loader2 className="h-6 w-6 animate-spin" data-oid=":gey5du" />
              </div>
            ) : accounts.length === 0 ? (
              <div
                className="text-center p-4 text-muted-foreground"
                data-oid="n6s.lox"
              >
                No accounts connected. Click Connect Account to add one.
              </div>
            ) : (
              <div className="space-y-4" data-oid="p2w0bwp">
                {(accounts || []).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-oid="448mdlf"
                  >
                    <div className="flex items-center gap-4" data-oid="h9wodn6">
                      <div
                        className="p-2 bg-primary/10 rounded-lg"
                        data-oid="h5_v6fk"
                      >
                        <Twitter
                          className="h-5 w-5 text-primary"
                          data-oid=".8tp6n-"
                        />
                      </div>
                      <div data-oid="s0o6fsp">
                        <div
                          className="flex items-center gap-2"
                          data-oid="8j.fjhq"
                        >
                          <h3 className="font-medium" data-oid="m-5av4w">
                            Account @{account.twitterAccountName}
                          </h3>
                          <Badge variant="outline" data-oid="9jty2ym">
                            {account.status}
                          </Badge>
                        </div>
                        <p
                          className="text-sm text-muted-foreground"
                          data-oid="tg42.fz"
                        >
                          Added on{" "}
                          {new Date(account.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(account.id)}
                      data-oid="tnrxk2j"
                    >
                      <Trash2 className="h-4 w-4" data-oid="pocwvyf" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        data-oid="hhwvbtm"
      >
        <DialogContent className="sm:max-w-[600px]" data-oid="teqqsrm">
          <DialogHeader data-oid="0q2g35_">
            <DialogTitle data-oid="6:jddqx">
              Connect Twitter Account
            </DialogTitle>
            <DialogDescription data-oid="3mdpj74">
              Enter your Twitter account name and paste your cookies to connect
              your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4" data-oid="lfm_f4_">
            <div className="space-y-2" data-oid="a5:1wyk">
              <Label data-oid="7lerj3j">Twitter Account Name</Label>
              <Input
                placeholder="@username"
                value={twitterAccountName}
                onChange={(e) => setTwitterAccountName(e.target.value)}
                required
                data-oid="_h.u7y7"
              />
            </div>
            <div className="space-y-2" data-oid="g95x6li">
              <Label data-oid=".mlxcw_">Cookies (JSON format)</Label>
              <div className="relative" data-oid="lwmo0pf">
                <Textarea
                  placeholder="[{&#34;name&#34;: &#34;auth_token&#34;, &#34;value&#34;: &#34;...&#34;}, ...]"
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  className={cn(
                    "min-h-[200px] font-mono text-sm",
                    error && "border-red-500 focus-visible:ring-red-500",
                  )}
                  data-oid="jmkv.:."
                />

                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handlePaste}
                  data-oid="g2lb8rs"
                >
                  Paste
                </Button>
              </div>
              {error ? (
                <p
                  className="text-sm text-red-500 flex items-center gap-2"
                  data-oid="x8jfq8f"
                >
                  <AlertCircle className="h-4 w-4" data-oid="b29ifl:" />
                  {error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground" data-oid="1ny3fsn">
                  Enter your Twitter cookies in JSON array format. Make sure to
                  include all required cookies.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={
                !isValidJson || !twitterAccountName.trim() || connecting
              }
              data-oid="y2:fdwf"
            >
              {connecting && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  data-oid="odrjrcp"
                />
              )}
              {connecting ? "Connecting..." : "Connect Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
