"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import LeadsList, { defaultLeads, Lead } from "@/components/leads/leads-list";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

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
}

export default function ImportLeads({ onBack }: ImportLeadsProps) {
  const [step, setStep] = useState(1);
  const [twitterProfiles, setTwitterProfiles] = useState<TwitterProfile[]>([{ handle: "", followerCount: 1000 }]);
  const [remainingCredits, setRemainingCredits] = useState(10000); // This should be fetched from your API
  const [followerRange, setFollowerRange] = useState([0, 100000]);
  const [followingRange, setFollowingRange] = useState([0, 100000]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [remainingLeads, setRemainingLeads] = useState("~1.9K");
  const [filteredCount, setFilteredCount] = useState(0);
  const [leads, setLeads] = useState<Lead[]>(defaultLeads);
  const [leadsName, setLeadsName] = useState("");

  const steps = [
    {
      title: "Add sources",
      subtitle: "Import your lead sources",
    },
    {
      title: "Apply Filters",
      subtitle: "Filter your leads",
    },
    {
      title: "Preview and Save",
      subtitle: "Review and save leads",
    },
  ];

  const filterOptions: FilterOption[] = [
    {
      title: "Number of Followers",
      description: "Filter Leads by the number of followers they have",
      key: "followers",
    },
    {
      title: "Number of Following",
      description: "Filter Leads by the number of accounts they follow",
      key: "following",
    },
    {
      title: "Number of Tweets",
      description: "Filter Leads by the number of tweets they have",
      key: "tweets",
    },
    {
      title: "Bio contents",
      description: "Filter Leads by the contents of their bio",
      key: "bio",
    },
    {
      title: "Exclude bio contents",
      description: "Exclude Leads by the contents of their bio",
      key: "excludeBio",
    },
    {
      title: "Saved Filter",
      description: "Reuse a saved filter",
      key: "saved",
    },
  ];

  const addNewProfile = () => {
    setTwitterProfiles([...twitterProfiles, { handle: "", followerCount: 1000 }]);
  };

  const updateProfile = (index: number, field: keyof TwitterProfile, value: string | number) => {
    const newProfiles = [...twitterProfiles];
    newProfiles[index] = { ...newProfiles[index], [field]: value };
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

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6">
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
          <div className="bg-white border-b border-gray-200">
            <div className="grid grid-cols-3 divide-x divide-gray-200">
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
          <div className="p-8">
            {step === 1 && (
              <div className="max-w-3xl mx-auto space-y-12">
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

                <div className="bg-gray-50 rounded-2xl p-8 space-y-6">
                  {twitterProfiles.map((profile, index) => (
                    <div key={index} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Input
                            className="border-2 rounded-xl text-lg py-6 px-6 shadow-sm hover:border-gray-400 focus:border-black transition-colors"
                            placeholder="Enter Twitter profile URL or @username"
                            value={profile.handle}
                            onChange={(e) => updateProfile(index, "handle", validateTwitterHandle(e.target.value))}
                          />
                        </div>
                        <div className="w-48">
                          <Label className="text-sm text-gray-500 mb-1 block">Followers to scrape</Label>
                          <Input
                            type="number"
                            min={1}
                            max={100000}
                            className="border-2 rounded-xl text-lg py-6 px-6"
                            value={profile.followerCount}
                            onChange={(e) => updateProfile(index, "followerCount", parseInt(e.target.value) || 1000)}
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

                  <div className="flex justify-between items-center pt-4">
                    <Button
                      variant="outline"
                      className="gap-2 border-2 border-gray-200 hover:bg-gray-100"
                      onClick={addNewProfile}
                    >
                      <Plus className="h-4 w-4" />
                      Add Another Profile
                    </Button>

                    <div className="text-sm text-gray-500">
                      Remaining Credits: {remainingCredits.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="bg-black hover:bg-gray-800 text-white px-8 py-6 text-lg rounded-xl"
                    onClick={() => setStep(2)}
                    disabled={!twitterProfiles.some(p => p.handle)}
                  >
                    Continue to Filters
                  </Button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div
                className="max-w-[95%] mx-auto space-y-10"
                data-oid="lc3q.za"
              >
                <div
                  className="flex justify-between items-center"
                  data-oid="aismq8m"
                >
                  <div data-oid="wgy219r">
                    <h2
                      className="text-3xl font-semibold text-gray-900"
                      data-oid="txbtsst"
                    >
                      Filter Your Leads
                    </h2>
                    <p className="text-gray-500 mt-2" data-oid="vmf8zwh">
                      Select criteria to refine your leads list
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-gray-700 hover:bg-purple-50"
                    data-oid="a82rmjd"
                  >
                    <Plus className="h-4 w-4 mr-2" data-oid="i377.7b" /> Watch
                    Tutorial
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-6" data-oid="xn5eqlt">
                  {filterOptions.map((option) => (
                    <Card
                      key={option.key}
                      className={`border-2 p-8 cursor-pointer transition-all hover:shadow-lg ${expandedFilter === option.key ? "ring-2 ring-purple-600 border-purple-600 bg-purple-50" : "hover:border-purple-300"}`}
                      onClick={() => setExpandedFilter(option.key)}
                      data-oid="b3pb74p"
                    >
                      <div
                        className="flex justify-between items-start"
                        data-oid="u9r3ehf"
                      >
                        <div data-oid="1_d46ix">
                          <h3
                            className="font-semibold text-xl mb-2 text-gray-900"
                            data-oid="ehxjy69"
                          >
                            {option.title}
                          </h3>
                          <p className="text-gray-600" data-oid="_mbpaly">
                            {option.description}
                          </p>
                        </div>
                        <div
                          className={`p-2 rounded-full ${expandedFilter === option.key ? "bg-purple-100" : "bg-gray-100"}`}
                          data-oid="5z3o0ga"
                        >
                          <Plus
                            className={`h-5 w-5 transition-transform ${expandedFilter === option.key ? "rotate-45 text-purple-600" : "text-gray-600"}`}
                            data-oid="lp015wu"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end pt-8" data-oid="sfe3jd5">
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white px-16 py-6 text-xl rounded-xl shadow-lg hover:shadow-xl transition-all"
                    onClick={() => setStep(3)}
                    data-oid="q_qt09:"
                  >
                    Preview Results
                  </Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="max-w-[95%] mx-auto space-y-8" data-oid=":a0bxe3">
                <div className="text-center space-y-4" data-oid="xprb__1">
                  <h2
                    className="text-3xl font-semibold text-gray-900"
                    data-oid="afgqy77"
                  >
                    Preview and Save Leads
                  </h2>
                  <p className="text-gray-500" data-oid="_vvhd:h">
                    Review your filtered leads before saving
                  </p>
                </div>

                {/* Add Leads Name Input */}
                <div className="border-2 rounded-xl p-8 bg-white shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-sm text-gray-500 mb-2 block">
                        Leads Name
                      </Label>
                      <Input
                        className="border-2 rounded-xl text-lg py-6 px-6 shadow-sm hover:border-gray-400 focus:border-black transition-colors"
                        placeholder="Enter a name for your leads"
                        value={leadsName}
                        onChange={(e) => setLeadsName(e.target.value)}
                      />
                    </div>
                    <div className="w-48 self-end">
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

                <div className="border-2 rounded-xl p-8 bg-white shadow-sm">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        Preview Leads
                      </h3>
                      <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-medium">
                        {leads.length} Leads Found
                      </div>
                    </div>
                    <LeadsList leads={leads} />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    variant="outline"
                    className="px-12 py-6 text-lg hover:bg-gray-50"
                    onClick={() => setStep(2)}
                  >
                    Back to Filters
                  </Button>
                  <Button
                    className="bg-black hover:bg-gray-800 text-white px-16 py-6 text-xl rounded-xl shadow-lg hover:shadow-xl transition-all"
                    onClick={onBack}
                    disabled={!leadsName.trim()}
                  >
                    Save Leads
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Credits Display */}
      <div className="fixed bottom-4 left-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">
        {remainingCredits.toLocaleString()} credits remaining
      </div>
    </div>
  );
}
