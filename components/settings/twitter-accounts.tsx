"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Image from "next/image";

interface TwitterAccount {
  id: string;
  authToken: string;
  twitterAccountName: string;
  createdAt: string;
  status: string;
  cookies: any[]; // Array of cookie objects
  userId: string; // Add userId to interface
  isExpired?: boolean; // Track cookie expiration status
}

interface Step {
  title: string;
  description: string;
  image: string;
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

  const [currentStep, setCurrentStep] = useState(0);

  const steps: Step[] = [
    {
      title: "Install Cookie Editor Extension",
      description: "Install the Cookie Editor extension from the Chrome Web Store or Brave Browser.",
      image: "/step1.png"
    },
    {
      title: "Go to  your Twitter account and open the Cookie Editor extension",
      description: "Log in to twitter.com and click the Cookie Editor icon in your browser.",
      image: "/step2.png"
    },
    {
      title: "Export Cookies",
      description: "Click the \"Export\" button at the bottom right, then select \"JSON\" format.",
      image: "/step3.png"
    },
    {
      title: "Connect Your Account",
      description: "Click \"Connect Account\", enter your Twitter username, and paste the cookies.",
      image: "/step4.png"
    }
  ];

  const nextStep = () => {
    setCurrentStep((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev === 0 ? steps.length - 1 : prev - 1));
  };

  const [validatingCookies, setValidatingCookies] = useState(false);
  const [refreshingAccount, setRefreshingAccount] = useState<string | null>(null);
  const validationComplete = useRef(false);

  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
      const data = await response.json();
      setAccounts(data.accounts || []);
      // Reset validation state when fetching new accounts
      validationComplete.current = false;
    } catch (error) {
      console.error("Error fetching Twitter accounts:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const validateCookies = useCallback(async (accountsToValidate: TwitterAccount[]) => {
    if (!accountsToValidate.length || validationComplete.current) return;
    
    setValidatingCookies(true);
    try {
      // Send all accounts to be validated in a single API call
      const response = await fetch('/api/twitter/validate-cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accounts: accountsToValidate }),
      });
      
      const data = await response.json();
      
      if (data.results) {
        // Update accounts with validation results
        const updatedAccounts = accountsToValidate.map(account => ({
          ...account,
          isExpired: data.results[account.id] ? !data.results[account.id].valid : true
        }));
        
        setAccounts(updatedAccounts);
      }
    } catch (error) {
      console.error("Error validating Twitter cookies:", error);
      // Mark all as expired on error
      const failedAccounts = accountsToValidate.map(account => ({
        ...account,
        isExpired: true
      }));
      setAccounts(failedAccounts);
    } finally {
      setValidatingCookies(false);
      validationComplete.current = true;
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Only validate when accounts are loaded initially
  useEffect(() => {
    if (accounts.length && !loading && !validationComplete.current) {
      validateCookies(accounts);
    }
  }, [accounts.length, loading, validateCookies]);

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
    try {
      setConnecting(true);
      setError("");
      
      let parsedCookies;
      try {
        parsedCookies = JSON.parse(cookiesInput);
      } catch (e) {
        setError("Invalid JSON format");
        setConnecting(false);
        return;
      }
      
      // Check if we're refreshing an existing account or creating a new one
      const isRefreshing = refreshingAccount !== null;
      
      const endpoint = isRefreshing 
        ? `/api/twitter/update-account?id=${refreshingAccount}` 
        : '/api/twitter/store-cookies';
      
      const response = await fetch(endpoint, {
        method: isRefreshing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twitterAccountName,
          cookies: parsedCookies,
          userId
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to connect account");
      }
      
      setConnectDialogOpen(false);
      resetForm();
      fetchAccounts();
      
    } catch (error) {
      console.error("Error connecting account:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setConnecting(false);
      setRefreshingAccount(null);
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

      // Reset validation state before fetching accounts again
      validationComplete.current = false;
      fetchAccounts();
    } catch (err) {
      console.error("Error deleting account:", err);
    }
  };

  const handleRefreshCookies = async (accountId: string) => {
    setRefreshingAccount(accountId);
    setConnectDialogOpen(true);
    
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      setTwitterAccountName(account.twitterAccountName);
    }
    
    setRefreshingAccount(null);
  };

  const resetForm = () => {
    setCookiesInput("");
    setTwitterAccountName("");
    setError("");
    setIsValidJson(false);
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
            <div className="flex items-center gap-2">
              {validatingCookies && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating cookies...
                </div>
              )}
              <Button
                onClick={() => setConnectDialogOpen(true)}
                data-oid="ntyu4b9"
              >
                <PlusCircle className="mr-2 h-4 w-4" data-oid="gzg3qo." />
                Connect Account
              </Button>
            </div>
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
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg transition-colors",
                      account.isExpired && "border-red-300 bg-red-50"
                    )}
                    data-oid="448mdlf"
                  >
                    <div className="flex items-center gap-4" data-oid="h9wodn6">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          account.isExpired ? "bg-red-100" : "bg-primary/10"
                        )}
                        data-oid="h5_v6fk"
                      >
                        {account.isExpired ? (
                          <ShieldAlert className="h-5 w-5 text-red-600" />
                        ) : (
                          <Twitter
                            className="h-5 w-5 text-primary"
                            data-oid=".8tp6n-"
                          />
                        )}
                      </div>
                      <div data-oid="s0o6fsp">
                        <div
                          className="flex items-center gap-2"
                          data-oid="8j.fjhq"
                        >
                          <h3 className="font-medium" data-oid="m-5av4w">
                            Account @{account.twitterAccountName}
                          </h3>
                          {account.isExpired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <Badge variant="outline" data-oid="9jty2ym">
                              {account.status || "Active"}
                            </Badge>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-sm",
                            account.isExpired ? "text-red-600" : "text-muted-foreground"
                          )}
                          data-oid="tg42.fz"
                        >
                          {account.isExpired ? (
                            <>
                              <span className="font-medium">Authentication expired</span> - Please refresh cookies
                            </>
                          ) : (
                            <>Added on {new Date(account.createdAt).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isExpired && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleRefreshCookies(account.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Cookies
                        </Button>
                      )}
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Twitter className="h-5 w-5" />
              How to Connect Your Twitter Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              {/* Step indicator */}
              <div className="flex items-center justify-center mb-4 gap-2">
                {steps.map((_, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "w-3 h-3 rounded-full transition-colors",
                      currentStep === index ? "bg-primary" : "bg-muted"
                    )}
                    onClick={() => setCurrentStep(index)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </div>

              {/* Current step */}
              <div className="relative w-full max-w-3xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      {currentStep + 1}
                    </div>
                    <h3 className="text-xl font-medium">{steps[currentStep].title}</h3>
                  </div>
                  
                  {currentStep === 0 && (
                    <a 
                      href="https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      Get Extension <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="relative aspect-video w-full rounded-md overflow-hidden border mb-4">
                  <Image 
                    src={steps[currentStep].image} 
                    alt={steps[currentStep].title} 
                    fill 
                    style={{ objectFit: 'contain' }} 
                    priority
                  />
                  
                  {/* Navigation arrows */}
                  <button 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    onClick={prevStep}
                    aria-label="Previous step"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    onClick={nextStep}
                    aria-label="Next step"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </div>

                <p className="text-center text-muted-foreground mb-6">
                  {steps[currentStep].description}
                </p>
              </div>
            </div>
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
              {refreshingAccount ? "Refresh Twitter Cookies" : "Connect Twitter Account"}
            </DialogTitle>
            <DialogDescription data-oid="3mdpj74">
              Enter your Twitter account name and paste your cookies to connect
              your account. You can use the <a href="https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer" className="text-primary underline">Cookie Editor Extension</a> to extract your cookies.
              {refreshingAccount
                ? "Twitter authentication has expired. Please provide fresh cookies to continue using this account."
                : "Enter your Twitter account name and paste your cookies to connect your account."}
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
                  include all required cookies. Use the 
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
              {connecting ? "Connecting..." : refreshingAccount ? "Update Cookies" : "Connect Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
