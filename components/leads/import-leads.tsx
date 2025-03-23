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
        }
      } catch (error) {
        console.error("Error fetching cookies:", error);
      }
    };

    if (userId) {
      fetchCookies();
    }
  }, [userId]);

  const handleNext = async () => {
    if (!cookies) {
      console.error("No cookies available");
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
    } finally {
      // Don't set loading to false here - we're navigating away
    }
  };

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
    <div className="min-h-screen bg-white">
      <AlertDialog open={showNoCreditsAlert} onOpenChange={setShowNoCreditsAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Lead Credits</AlertDialogTitle>
            <AlertDialogDescription>
              You have no lead credits remaining. Please upgrade your plan to get more credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
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
          className="mb-6 gap-2 hover:bg-gray-100 transition-colors"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>

        <Card className="border border-gray-200 shadow-lg rounded-xl overflow-hidden">
          {/* Steps Navigation */}
          <div className="bg-white border-b border-gray-200 hidden sm:block">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-x-0 sm:divide-x divide-y sm:divide-y-0 divide-gray-200">
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
                      "relative group p-6 transition-all duration-300",
                      "hover:bg-gray-50",
                      isActive && "bg-gray-50",
                      isPast && "cursor-pointer",
                      isFuture && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={cn(
                          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                          isActive && "bg-black text-white scale-110",
                          isPast && "bg-gray-200 text-gray-700",
                          isFuture && "bg-gray-100 text-gray-400"
                        )}
                      >
                        {stepNumber}
                      </div>

                      <div className="flex-grow text-left">
                        <div
                          className={cn(
                            "text-sm font-semibold mb-1 transition-colors",
                            isActive && "text-black",
                            isFuture && "text-gray-400"
                          )}
                        >
                          {stepItem.title}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-2">
                          {stepItem.subtitle}
                        </div>
                      </div>

                      <ChevronRight
                        className={cn(
                          "w-5 h-5 flex-shrink-0 transition-all",
                          isActive && "text-black",
                          "group-hover:translate-x-1",
                          isFuture && "text-gray-300"
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-8 pb-20 sm:pb-8">
            {step === 1 && (
              <div className="max-w-3xl mx-auto space-y-8 md:space-y-12">
                <div className="text-center space-y-6">
                  <div className="inline-block">
                    <h2 className="text-4xl font-bold text-black animate-fade-in">
                      Import Your Leads
                    </h2>
                    <div className="h-1 w-24 bg-black rounded-full mx-auto mt-2"></div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-600 text-xl max-w-lg mx-auto leading-relaxed font-medium">
                      Enter Twitter profiles to import leads
                    </p>
                    <span className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full">
                      <span className="inline-block w-2 h-2 bg-black rounded-full animate-pulse"></span>
                      Quick and easy import process
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 md:p-8 space-y-6">
                  {twitterProfiles.map((profile, index) => (
                    <div key={index} className="space-y-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex-1">
                          <Input
                            className="border-2 rounded-xl text-lg py-6 px-6 shadow-sm hover:border-gray-400 focus:border-black transition-colors"
                            placeholder="Enter Twitter profile URL or @username"
                            value={profile.handle}
                            onChange={(e) => updateProfile(index, "handle", validateTwitterHandle(e.target.value))}
                          />
                        </div>
                        <div className="w-full md:w-48">
                          <Label className="text-sm text-gray-500 mb-1 block">Followers to scrape</Label>
                          <Input
                            type="number"
                            className="border-2 rounded-xl text-lg py-6 px-6"
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
                            className="p-2 hover:bg-gray-200 rounded-full"
                            onClick={() => removeProfile(index)}
                          >
                            <X className="h-5 w-5 text-gray-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pt-4">
                    <Button
                      variant="outline"
                      className="gap-2 border-2 border-gray-200 hover:bg-gray-100 w-full sm:w-auto"
                      onClick={addNewProfile}
                    >
                      <Plus className="h-4 w-4" />
                      Add Another Profile
                    </Button>

                 
                  </div>
                </div>

                <div className="flex justify-end mb-10 sm:mb-0">
                  <Button
                    className="bg-black hover:bg-gray-800 text-white px-8 py-6 text-lg rounded-xl"
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
                    <h2 className="text-3xl font-semibold text-gray-900">
                      Filter Your Leads & Save
                    </h2>
                    <p className="text-gray-500 mt-2">
                      Select criteria to refine your leads list
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-gray-700 hover:bg-purple-50 text-sm md:text-base w-full md:w-auto mt-2 md:mt-0"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Watch Tutorial
                  </Button>
                </div>
                
                {/* Move Leads Name Input to the top */}
                <div className="border-2 rounded-xl p-4 md:p-8 bg-white shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-sm text-gray-500 mb-2 block">Leads Name</Label>
                      <Input
                        className="border-2 rounded-xl text-lg py-6 px-6 shadow-sm hover:border-gray-400 focus:border-black transition-colors"
                        placeholder="Enter a name for your leads"
                        value={leadsName}
                        onChange={(e) => setLeadsName(e.target.value)}
                      />
                    </div>
                    <div className="w-full md:w-48 self-start md:self-end mt-4 md:mt-0">
                      <Button
                        variant="outline"
                        className="w-full py-6 text-gray-600 border-2"
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
                      className={`border-2 p-4 md:p-6 cursor-pointer transition-all hover:shadow-lg ${expandedFilter === option.key ? "ring-2 ring-purple-600 border-purple-600 bg-purple-50" : "hover:border-purple-300"}`}
                      onClick={() => handleFilterSelect(option.key)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-semibold text-base md:text-xl mb-2 text-gray-900">
                            {option.title}
                          </h3>
                          <p className="text-gray-600 text-sm md:text-base">
                            {option.description}
                          </p>
                        </div>
                        <div
                          className={`p-2 rounded-full flex-shrink-0 ${expandedFilter === option.key ? "bg-purple-100" : "bg-gray-100"}`}
                        >
                          <Plus
                            className={`h-4 w-4 md:h-5 md:w-5 transition-transform ${expandedFilter === option.key ? "rotate-45 text-purple-600" : "text-gray-600"}`}
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
                    className="px-6 sm:px-12 py-4 sm:py-6 text-base sm:text-lg hover:bg-gray-50 w-full sm:w-auto"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    className="bg-black hover:bg-gray-800 text-white px-8 sm:px-16 py-4 sm:py-6 text-lg sm:text-xl rounded-xl shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
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

      {/* Mobile Steps Navigation - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:hidden z-10">
        <div className="flex justify-between items-center">
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
                  "flex flex-col items-center p-2 flex-1 transition-all duration-300",
                  isActive ? "text-black" : "text-gray-400",
                  isPast && "text-gray-600",
                  isFuture && "opacity-50"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all mb-1",
                    isActive && "bg-black text-white",
                    isPast && "bg-gray-200 text-gray-700",
                    isFuture && "bg-gray-100 text-gray-400"
                  )}
                >
                  {stepNumber}
                </div>
                <div className="text-xs font-medium truncate max-w-[80px] text-center">
                  {stepItem.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
