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
      <div className="w-full">
        <Card className="w-full border rounded-lg shadow-sm dark:border-[#1a2436] dark:bg-[#0c1221]">
          <CardHeader className="p-4 sm:p-6 border-b dark:border-[#1a2436]">
            <CardTitle className="text-xl flex justify-between items-center dark:text-white">
              <span>Connected Accounts</span>
              <Button
                size="sm"
                className="h-9 text-xs sm:text-sm dark:bg-purple-700 dark:hover:bg-purple-800 text-white"
                onClick={() => {
                  setTwitterAccountName("");
                  setCookiesInput("");
                  setError("");
                  setCurrentStep(0);
                  setConnectDialogOpen(true);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Connect Account
              </Button>
            </CardTitle>
            {validatingCookies && (
              <div className="flex items-center text-sm text-muted-foreground dark:text-gray-400 mt-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin dark:text-gray-300" />
                Validating cookies...
              </div>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin dark:text-gray-400" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground dark:text-gray-400">
                No accounts connected. Click Connect Account to add one.
              </div>
            ) : (
              <div className="space-y-3">
                {(accounts || []).map((account) => (
                  <div
                    key={account.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 transition-colors dark:border-[#1a2436]",
                      account.isExpired 
                        ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900/40" 
                        : "hover:border-gray-300 dark:hover:border-[#242f44] dark:bg-[#131c2e]/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          account.isExpired 
                            ? "bg-red-100 dark:bg-red-950/40" 
                            : "bg-primary/10 dark:bg-blue-950/30"
                        )}
                      >
                        {account.isExpired ? (
                          <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <Twitter className="h-5 w-5 text-primary dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm dark:text-white">
                            @{account.twitterAccountName}
                          </h3>
                          {account.isExpired ? (
                            <Badge variant="destructive" className="text-xs dark:bg-red-900/40 dark:text-red-300">Expired</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs dark:border-[#242f44] dark:bg-[#131c2e] dark:text-gray-300">
                              {account.status || "Active"}
                            </Badge>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-xs",
                            account.isExpired 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-muted-foreground dark:text-gray-400"
                          )}
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
                    <div className="flex items-center gap-2 self-end sm:self-center ml-auto">
                      {account.isExpired && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs text-red-600 border-red-300 hover:bg-red-50 h-8 dark:text-red-400 dark:border-red-900/60 dark:bg-[#131c2e]/40 dark:hover:bg-red-950/30"
                          onClick={() => handleRefreshCookies(account.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8 w-8 p-0 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full border rounded-lg shadow-sm mt-6 dark:border-[#1a2436] dark:bg-[#0c1221]">
          <CardHeader className="p-4 sm:p-6 border-b dark:border-[#1a2436]">
            <CardTitle className="text-xl flex items-center gap-2 dark:text-white">
              <Twitter className="h-5 w-5 dark:text-blue-400" />
              How to Connect Your Account
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center">
              {/* Step indicator */}
              <div className="flex items-center justify-center mb-4 gap-2">
                {steps.map((_, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-colors",
                      currentStep === index 
                        ? "bg-primary dark:bg-purple-600" 
                        : "bg-muted dark:bg-[#131c2e]"
                    )}
                    onClick={() => setCurrentStep(index)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </div>

              {/* Current step */}
              <div className="w-full max-w-2xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary dark:bg-purple-700 text-primary-foreground font-bold text-sm">
                      {currentStep + 1}
                    </div>
                    <h3 className="text-base sm:text-lg font-medium dark:text-white">{steps[currentStep].title}</h3>
                  </div>
                  
                  {currentStep === 0 && (
                    <a 
                      href="https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary dark:text-purple-400 hover:underline text-sm"
                    >
                      Get Extension <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="relative aspect-video w-full rounded-md overflow-hidden border mb-3 dark:border-[#1a2436] dark:bg-[#0c1221]">
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
                    <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    onClick={nextStep}
                    aria-label="Next step"
                  >
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>

                <p className="text-center text-sm text-muted-foreground dark:text-gray-400 mb-4">
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
      >
        <DialogContent className="sm:max-w-[600px] p-4 sm:p-6 dark:bg-[#0c1221] dark:border-[#1a2436]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              {refreshingAccount ? "Refresh Twitter Cookies" : "Connect Twitter Account"}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Enter your Twitter account name and paste your cookies to connect
              your account. You can use the <a href="https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-purple-400 underline">Cookie Editor Extension</a> to extract your cookies.
              {refreshingAccount
                ? "Twitter authentication has expired. Please provide fresh cookies to continue using this account."
                : "Enter your Twitter account name and paste your cookies to connect your account."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="dark:text-gray-300">Twitter Account Name</Label>
              <Input
                placeholder="@username"
                value={twitterAccountName}
                onChange={(e) => setTwitterAccountName(e.target.value)}
                required
                className="dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-gray-300">Cookies (JSON format)</Label>
              <div className="relative">
                <Textarea
                  placeholder="[{&#34;name&#34;: &#34;auth_token&#34;, &#34;value&#34;: &#34;...&#34;}, ...]"
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  className={cn(
                    "min-h-[200px] font-mono text-sm dark:border-[#242f44] dark:bg-[#0c1221] dark:text-gray-200",
                    error && "border-red-500 focus-visible:ring-red-500 dark:border-red-800 dark:focus-visible:ring-red-800",
                  )}
                />

                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 dark:border-[#242f44] dark:text-gray-300 dark:bg-[#131c2e] dark:hover:bg-[#1a2436]"
                  onClick={handlePaste}
                >
                  Paste
                </Button>
              </div>
              {error ? (
                <p
                  className="text-sm text-red-500 dark:text-red-400 flex items-center gap-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground dark:text-gray-400">
                  Enter your Twitter cookies in JSON array format. Make sure to
                  include all required cookies. Use the 
                </p>
              )}
            </div>
            <Button
              className="w-full dark:bg-purple-700 dark:hover:bg-purple-800"
              onClick={handleConnect}
              disabled={
                !isValidJson || !twitterAccountName.trim() || connecting
              }
            >
              {connecting && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
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
