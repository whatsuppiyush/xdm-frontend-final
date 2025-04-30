"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Upload, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import LeadsList, { defaultLeads, Lead } from "@/components/leads/leads-list";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";

interface TwitterProfile {
  handle: string;
  followerCount: number;
}

interface FilterOption {
  title: string;
  description: string;
  key: string;
}

interface ImportLeadsProps {
  onBack: () => void;
  refreshLeads?: () => void;
}

export default function ImportLeads({ onBack, refreshLeads }: ImportLeadsProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [twitterProfiles, setTwitterProfiles] = useState<TwitterProfile[]>([{ handle: "", followerCount: 1000 }]);
  const [remainingCredits, setRemainingCredits] = useState(10000); // This should be fetched from your API
  const [followerRange, setFollowerRange] = useState([0, 100000]);
  const [followingRange, setFollowingRange] = useState([0, 100000]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<string | null>("followers");
  const [remainingLeads, setRemainingLeads] = useState("~1.9K");
  const [filteredCount, setFilteredCount] = useState(0);
  const [leads, setLeads] = useState<Lead[]>(defaultLeads);
  const [leadsName, setLeadsName] = useState("");
  const { userId } = useUser();
  const [cookies, setCookies] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapedFollowers, setScrapedFollowers] = useState<Lead[]>(
    [],
  );
  const [selectedFilter, setSelectedFilter] = useState<string>("followers");
  const [showNoCreditsAlert, setShowNoCreditsAlert] = useState(false);
  const [showNoCookiesAlert, setShowNoCookiesAlert] = useState(false);
  const [showExceededCreditsAlert, setShowExceededCreditsAlert] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [requestedLeads, setRequestedLeads] = useState(0);

  const steps = [
    {
      title: "Add sources",
      subtitle: "Import your lead sources",
    },
    {
      title: "Apply Filters & Save",
      subtitle: "Filter your leads and save them",
    },
  ];

  useEffect(() => {
    const fetchCookies = async () => {
      try {
        const response = await fetch(
          `/api/twitter/get-accounts?userId=${userId}`,
        );
        if (!response.ok) throw new Error("Failed to fetch cookies");
        const data = await response.json();
        if (data.accounts && data.accounts.length > 0) {
          setCookies(data.accounts[0].cookies);
        } else {
          // No Twitter accounts found, show alert or redirect
          setShowNoCookiesAlert(true);
        }
      } catch (error) {
        console.error("Error fetching cookies:", error);
        // Error fetching cookies, show alert or redirect
        setShowNoCookiesAlert(true);
      }
    };

    if (userId) {
      fetchCookies();
    }
  }, [userId]);

  const handleNext = async () => {
    if (!cookies) {
      // Redirect to Twitter settings if no cookies available
      router.push('/settings?tab=twitter');
      return;
    }

    try {
      setLoading(true);
      
      // Check user credits before proceeding
      const creditsResponse = await fetch("/api/user/credits");
      const creditsData = await creditsResponse.json();
      
      if (!creditsData.leadCredits || creditsData.leadCredits <= 0) {
        setShowNoCreditsAlert(true);
        return;
      }
      
      // Simply advance to the next step without scraping
      setStep(2);
    } catch (error) {
      console.error("Error in step navigation:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeads = async () => {
    try {
      setLoading(true);
      
      // Show initial notification
      toast({
        title: "Starting Lead Import",
        description: "It takes 2-10 minutes on average depending on the number of followers to scrape leads. We'll notify you via email once the process is complete.",
        duration: 10000,
      });
      
      // Check user credits before proceeding
      const creditsResponse = await fetch("/api/user/credits");
      const creditsData = await creditsResponse.json();
      
      if (!creditsData.leadCredits || creditsData.leadCredits <= 0) {
        setShowNoCreditsAlert(true);
        setLoading(false);
        return;
      }
      
      // Check if user is trying to scrape more followers than they have credits for
      const requestedCount = twitterProfiles[0].followerCount;
      if (requestedCount > creditsData.leadCredits) {
        // Show the custom alert dialog
        setAvailableCredits(creditsData.leadCredits);
        setRequestedLeads(requestedCount);
        setShowExceededCreditsAlert(true);
        setLoading(false);
        return;
      }
      
      // Call scrape-followers API with selected filter type
      const response = await fetch("/api/twitter/scrape-followers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileUrl: 'https://x.com/' + twitterProfiles[0].handle,
          count: twitterProfiles[0].followerCount,
          cookies: cookies,
          leadName: leadsName || `${twitterProfiles[0].handle}_${Date.now()}`,
          userId,
          friendshipType: getTwitterFriendshipType(selectedFilter)
        }),
      });
      
      // Wait for response to ensure API was called
      await response.json();
      
      // Refresh leads list before navigating back
      if (refreshLeads) {
        await refreshLeads();
      }
      
      // Force redirect back to manage leads page
      onBack();
    } catch (error) {
      console.error('Error saving leads:', error);
      setError(error instanceof Error ? error.message : "Failed to save leads");
      setLoading(false);
      
      // Show error notification
      toast({
        title: "Error",
        description: "Failed to start lead import. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filterOptions: FilterOption[] = [
    {
      title: "Followers",
      description: "Filter the followers of the selected profile.",
      key: "followers",
    },
    {
      title: "Following",
      description: "Filter the followings of the selected profile.",
      key: "following",
    },
    {
      title: "Verified Followers",
      description: "Filter the verified followers of the selected profile.",
      key: "verifiedFollowers",
    },
    {
      title: "Followers you know",
      description: "Filter the followers you know of the selected profile.",
      key: "followersYouKnow",
    }
  ];

  const addNewProfile = () => {
    setTwitterProfiles([...twitterProfiles, { handle: "", followerCount: 1000 }]);
  };

  const updateProfile = (index: number, field: keyof TwitterProfile, value: string | number) => {
    const newProfiles = [...twitterProfiles];
    
    if (field === 'followerCount') {
      let numValue = value === '' ? 0 : parseInt(value.toString());
      // Clamp value between 0 and 10000
      numValue = Math.max(0, Math.min(10000, numValue));
      newProfiles[index] = { 
        ...newProfiles[index], 
        followerCount: numValue 
      };
    } else {
      newProfiles[index] = { 
        ...newProfiles[index], 
        handle: value.toString() 
      };
    }
    
    setTwitterProfiles(newProfiles);
  };

  const removeProfile = (index: number) => {
    if (twitterProfiles.length > 1) {
      const newProfiles = twitterProfiles.filter((_, i) => i !== index);
      setTwitterProfiles(newProfiles);
    }
  };

  const validateTwitterHandle = (handle: string): string => {
    // Remove any URL parts and extract the username
    if (handle.includes("twitter.com/") || handle.includes("x.com/")) {
      const parts = handle.split("/");
      return parts[parts.length - 1].replace("@", "");
    }
    return handle.replace("@", "");
  };
  
  // Generate default leads name when profiles change or when reaching step 3
  useEffect(() => {
    if (step === 3 || twitterProfiles.some(p => p.handle)) {
      const validProfiles = twitterProfiles.filter(p => p.handle);
      const profileNames = validProfiles.map(p => p.handle).join("_");
      const datetime = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(/[/,: ]/g, '');
      setLeadsName(`${profileNames}_${datetime}`);
    }
  }, [step, twitterProfiles]);

  // Map filter keys to Twitter API friendshipTypes
  const getTwitterFriendshipType = (filterKey: string): string => {
    const mappings: {[key: string]: string} = {
      followers: "followers",
      following: "following",
      verifiedFollowers: "verifiedFollowers",
      followersYouKnow: "followersYouKnow",
      subscriptions: "subscribedTo"
    };
    
    return mappings[filterKey] || "followers";
  };

  // In the expandedFilter handler
  const handleFilterSelect = (filterKey: string) => {
    setExpandedFilter(filterKey);
    setSelectedFilter(filterKey);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c1221]">
      <AlertDialog open={showNoCreditsAlert} onOpenChange={setShowNoCreditsAlert}>
        <AlertDialogContent className="dark:bg-[#131c2e] dark:border-[#242f44]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">No Lead Credits</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              You have no lead credits remaining. Please upgrade your plan to get more credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => {
              window.location.href = "/settings?tab=subscription";
            }}>
              Upgrade Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNoCookiesAlert} onOpenChange={setShowNoCookiesAlert}>
        <AlertDialogContent className="dark:bg-[#131c2e] dark:border-[#242f44]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Connect Your X Account</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              You need to connect your X account before importing leads. Please go to the X settings tab to connect your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => {
              router.push('/settings?tab=twitter');
            }}>
              Connect X Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExceededCreditsAlert} onOpenChange={setShowExceededCreditsAlert}>
        <AlertDialogContent className="dark:bg-[#131c2e] dark:border-[#242f44]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Insufficient Lead Credits</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              You&apos;re attempting to scrape {requestedLeads} followers but only have {availableCredits} lead credits remaining. Please upgrade your plan to get more credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => {
              window.location.href = "/settings?tab=subscription";
            }}>
              Upgrade Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-7xl mx-auto p-3 md:p-6">
        <Button
          variant="ghost"
          className="mb-6 gap-2 hover:bg-gray-100 dark:hover:bg-[#1c2739] transition-colors text-gray-600 dark:text-gray-300"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>

        <Card className="border border-gray-200 dark:border-[#242f44] shadow-lg rounded-xl overflow-hidden">
          {/* Steps Navigation */}
          <div className="bg-white dark:bg-[#131c2e] border-b border-gray-200 dark:border-[#242f44]">
            <div className="grid grid-cols-2 divide-x divide-y-0 divide-gray-200 dark:divide-[#242f44]">
              {steps.map((stepItem, index) => {
                const stepNumber = index + 1;
                const isActive = step === stepNumber;
                const isPast = step > stepNumber;
                const isFuture = step < stepNumber;

                return (
                  <button
                    key={stepItem.title}
                    onClick={() => isPast && setStep(stepNumber)}
                    disabled={isFuture}
                    className={cn(
                      "relative group p-4 sm:p-6 transition-all duration-300",
                      "hover:bg-gray-50 dark:hover:bg-[#1c2739]",
                      isActive && "bg-gray-50 dark:bg-[#1c2739]",
                      isPast && "cursor-pointer",
                      isFuture && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="flex items-center space-x-2 sm:space-x-4">
                      <div
                        className={cn(
                          "flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                          isActive && "bg-black dark:bg-purple-600 text-white scale-110",
                          isPast && "bg-gray-200 dark:bg-[#30394d] text-gray-700 dark:text-gray-300",
                          isFuture && "bg-gray-100 dark:bg-[#1a2436] text-gray-400 dark:text-gray-500"
                        )}
                      >
                        {stepNumber}
                      </div>

                      <div className="flex-grow text-left">
                        <div
                          className={cn(
                            "text-xs sm:text-sm font-semibold mb-0 sm:mb-1 transition-colors",
                            isActive && "text-black dark:text-white",
                            isFuture && "text-gray-400 dark:text-gray-500"
                          )}
                        >
                          {stepItem.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block line-clamp-2">
                          {stepItem.subtitle}
                        </div>
                      </div>

                      <ChevronRight
                        className={cn(
                          "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-all",
                          isActive && "text-black dark:text-white",
                          "group-hover:translate-x-1",
                          isFuture && "text-gray-300 dark:text-[#3a465d]"
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-8 pb-20 sm:pb-8 dark:bg-[#131c2e]">
            {step === 1 && (
              <div className="max-w-3xl mx-auto space-y-8 md:space-y-12">
                <div className="text-center space-y-6">
                  <div className="inline-block">
                    <h2 className="text-4xl font-bold text-black dark:text-white animate-fade-in">
                      Import Your Leads
                    </h2>
                    <div className="h-1 w-24 bg-black dark:bg-purple-600 rounded-full mx-auto mt-2"></div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-600 dark:text-gray-300 text-xl max-w-lg mx-auto leading-relaxed font-medium">
                      Enter Twitter profiles to import leads
                    </p>
                    <span className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1c2739] px-4 py-1.5 rounded-full">
                      <span className="inline-block w-2 h-2 bg-black dark:bg-purple-600 rounded-full animate-pulse"></span>
                      Quick and easy import process
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-[#0f1725]/60 rounded-2xl p-4 md:p-8 space-y-6">
                  {twitterProfiles.map((profile, index) => (
                    <div key={index} className="space-y-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex-1">
                          <Input
                            className="border-2 dark:border-[#30394d] rounded-xl text-lg py-6 px-6 shadow-sm hover:border-gray-400 dark:hover:border-[#455166] focus:border-black dark:focus:border-purple-600 transition-colors dark:bg-[#131c2e] dark:text-gray-200"
                            placeholder="Enter Twitter profile URL or @username"
                            value={profile.handle}
                            onChange={(e) => updateProfile(index, "handle", validateTwitterHandle(e.target.value))}
                          />
                        </div>
                        <div className="w-full md:w-48">
                          <Label className="text-sm text-gray-500 dark:text-gray-300 mb-1 block">Followers to scrape</Label>
                          <Input
                            type="number"
                            className="border-2 dark:border-[#30394d] rounded-xl text-lg py-6 px-6 dark:bg-[#131c2e] dark:text-gray-200"
                            value={profile.followerCount || ''}
                            onChange={(e) => updateProfile(index, "followerCount", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value) {
                                let value = parseInt(e.target.value);
                                if (!isNaN(value)) {
                                  // Only clamp if value is outside allowed range
                                  if (value < 0) value = 0;
                                  if (value > 10000) value = 10000;
                                  updateProfile(index, "followerCount", value);
                                }
                              }
                            }}
                          />
                        </div>
                        {twitterProfiles.length > 1 && (
                          <Button
                            variant="ghost"
                            className="p-2 hover:bg-gray-200 dark:hover:bg-[#1c2739] rounded-full"
                            onClick={() => removeProfile(index)}
                          >
                            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pt-4">
                    <Button
                      variant="outline"
                      className="gap-2 border-2 border-gray-200 dark:border-[#30394d] hover:bg-gray-100 dark:hover:bg-[#1c2739] dark:text-gray-300 w-full sm:w-auto"
                      onClick={addNewProfile}
                    >
                      <Plus className="h-4 w-4" />
                      Add Another Profile
                    </Button>

                 
                  </div>
                </div>

                <div className="flex justify-end mb-10 sm:mb-0">
                  <Button
                    className="bg-black dark:bg-purple-600 hover:bg-gray-800 dark:hover:bg-purple-700 text-white px-8 py-6 text-lg rounded-xl"
                    onClick={() => handleNext()}
                    disabled={!twitterProfiles.some(p => p.handle) || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Scraping Followers...
                      </>
                    ) : (
                      'Continue to Filters'
                    )}
                  </Button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="w-full max-w-[95%] mx-auto space-y-6 md:space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                  <div>
                    <h2 className="text-3xl font-semibold text-gray-900 dark:text-white">
                      Filter Your Leads & Save
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                      Select criteria to refine your leads list
                    </p>
                  </div>
                 
                </div>
                
                {/* Move Leads Name Input to the top */}
                <div className="border-2 border-gray-200 dark:border-[#30394d] rounded-xl p-4 md:p-8 bg-white dark:bg-[#1a2436]/40 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-sm text-gray-500 dark:text-gray-300 mb-2 block">Leads Name</Label>
                      <Input
                        className="border-2 border-gray-200 dark:border-[#30394d] rounded-xl text-lg py-6 px-6 shadow-sm hover:border-gray-400 dark:hover:border-[#455166] focus:border-black dark:focus:border-purple-600 transition-colors dark:bg-[#131c2e] dark:text-gray-200"
                        placeholder="Enter a name for your leads"
                        value={leadsName}
                        onChange={(e) => setLeadsName(e.target.value)}
                      />
                    </div>
                    <div className="w-full md:w-48 self-start md:self-end mt-4 md:mt-0">
                      <Button
                        variant="outline"
                        className="w-full py-6 text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-[#30394d] dark:hover:bg-[#1c2739]"
                        onClick={() => {
                          const datetime = new Date().toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          }).replace(/[/,: ]/g, '');
                          const profileNames = twitterProfiles
                            .filter(p => p.handle)
                            .map(p => p.handle)
                            .join("_");
                          setLeadsName(`${profileNames}_${datetime}`);
                        }}
                      >
                        Reset to Default
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Filter options grid moved below */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {filterOptions.map((option) => (
                    <Card
                      key={option.key}
                      className={`border-2 p-4 md:p-6 cursor-pointer transition-all hover:shadow-lg ${
                        expandedFilter === option.key 
                          ? "ring-2 ring-purple-600 border-purple-600 bg-purple-50 dark:bg-[#1a1e3a] dark:ring-purple-600 dark:border-purple-600" 
                          : "hover:border-purple-300 dark:border-[#242f44] dark:hover:border-purple-600 dark:bg-[#131c2e]"
                      }`}
                      onClick={() => handleFilterSelect(option.key)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-semibold text-base md:text-xl mb-2 text-gray-900 dark:text-white">
                            {option.title}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
                            {option.description}
                          </p>
                          {option.key === "followers" && (
                            <div className="mt-2 text-sm text-red-600 dark:text-red-400 font-semibold">
                              Currently facing an outage with this feature.
                            </div>
                          )}
                        </div>
                        <div
                          className={`p-2 rounded-full flex-shrink-0 ${
                            expandedFilter === option.key 
                              ? "bg-purple-100 dark:bg-purple-900/50" 
                              : "bg-gray-100 dark:bg-[#1c2739]"
                          }`}
                        >
                          <Plus
                            className={`h-4 w-4 md:h-5 md:w-5 transition-transform ${
                              expandedFilter === option.key 
                                ? "rotate-45 text-purple-600 dark:text-purple-400" 
                                : "text-gray-600 dark:text-gray-400"
                            }`}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                
                {/* Bottom buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 mb-10 sm:mb-0">
                  <Button
                    variant="outline"
                    className="px-6 sm:px-12 py-4 sm:py-6 text-base sm:text-lg hover:bg-gray-50 dark:hover:bg-[#1c2739] dark:border-[#30394d] dark:text-gray-300 w-full sm:w-auto"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    className="bg-black dark:bg-purple-600 hover:bg-gray-800 dark:hover:bg-purple-700 text-white px-8 sm:px-16 py-4 sm:py-6 text-lg sm:text-xl rounded-xl shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                    onClick={handleSaveLeads}
                    disabled={!leadsName.trim() || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving Leads...
                      </>
                    ) : (
                      'Save Leads'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
