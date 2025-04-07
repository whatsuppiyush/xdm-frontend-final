"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Filter, Users, Search, CheckCircle2, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadFiltersProps {
  selectedLeadList: any;
  onFiltersApplied: (filteredLeads: any[]) => void;
  onContinue: () => void;
}

export default function LeadFilters({ 
  selectedLeadList, 
  onFiltersApplied,
  onContinue 
}: LeadFiltersProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  // Filter states
  const [followerRange, setFollowerRange] = useState<[number, number]>([0, 5000]);
  const [bioKeyword, setBioKeyword] = useState("");
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  
  // Stats
  const [totalLeads, setTotalLeads] = useState(0);
  const [filteredLeadsCount, setFilteredLeadsCount] = useState(0);
  const [maxFollowers, setMaxFollowers] = useState(5000);
  
  // Add a state to track filtered leads
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  
  useEffect(() => {
    if (selectedLeadList?.followers) {
      setTotalLeads(selectedLeadList.followers.length);
      
      // Find the maximum follower count to set slider upper bound
      const max = Math.max(
        ...selectedLeadList.followers.map((lead: any) => lead.followers || 0),
        5000 // Minimum default
      );
      
      setMaxFollowers(max);
      setFollowerRange([0, max]);
      
      // Apply initial filter to get count
      applyFilters();
    }
  }, [selectedLeadList]);
  
  useEffect(() => {
    console.log("LeadFilters component mounted");
    console.log("Initial selectedLeadList:", selectedLeadList);
    console.log("onFiltersApplied and onContinue functions:", !!onFiltersApplied, !!onContinue);
  }, []);
  
  const applyFilters = () => {
    if (!selectedLeadList?.followers) return;
    
    setIsApplyingFilters(true);
    
    try {
      console.log("Applying filters with range:", followerRange, "and keyword:", bioKeyword);
      
      const filtered = selectedLeadList.followers.filter((lead: any) => {
        // Filter by follower count
        const followerCount = lead.followers || 0;
        const isInFollowerRange = followerCount >= followerRange[0] && followerCount <= followerRange[1];
        
        // Filter by bio keyword
        const hasBioKeyword = !bioKeyword || 
          (lead.bio && lead.bio.toLowerCase().includes(bioKeyword.toLowerCase()));
        
        return isInFollowerRange && hasBioKeyword;
      });
      
      console.log(`Filtered from ${selectedLeadList.followers.length} to ${filtered.length} leads`);
      setFilteredLeadsCount(filtered.length);
      setFilteredLeads(filtered); // Store the filtered leads
      onFiltersApplied(filtered);
    } catch (error) {
      console.error("Error applying filters:", error);
    } finally {
      setIsApplyingFilters(false);
    }
  };
  
  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [followerRange, bioKeyword]);
  
  const handleContinue = () => {
    console.log("Continue button clicked");
    console.log("Filtered leads count:", filteredLeadsCount);
    console.log("Filtered leads:", filteredLeads);
    
    // Call the parent functions
    onFiltersApplied(filteredLeads);
    console.log("onFiltersApplied called");
    
    onContinue();
    console.log("onContinue called");
  };
  
  
  return (
    <div className="space-y-8">
      {/* Header with animation */}
      <div className="text-center space-y-3 mb-8">
        <h2 className={cn(
          "text-3xl sm:text-4xl font-bold",
          isDark 
            ? "bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent" 
            : "bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent"
        )}>
          Refine Your Audience
        </h2>
        <p className={cn(
          "text-base sm:text-lg max-w-lg mx-auto",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          Target the right people by filtering your lead list
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Filters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Follower Range Filter */}
          <Card className={cn(
            "border overflow-hidden",
            isDark 
              ? "border-slate-700 bg-slate-800/50 hover:border-purple-800/50 transition-all" 
              : "bg-white hover:border-purple-300/70 transition-all"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-500" />
                Follower Count
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-slate-400 cursor-help ml-1" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-[200px] text-xs">
                        Filter leads based on their follower count. Higher follower counts often indicate more influential accounts.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Target accounts with specific follower ranges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className={cn(
                    "font-mono",
                    isDark ? "bg-slate-700" : "bg-slate-100"
                  )}>
                    {followerRange[0].toLocaleString()} - {followerRange[1].toLocaleString()}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {Math.round((followerRange[1] - followerRange[0]) / maxFollowers * 100)}% of range
                  </span>
                </div>
                
                <div className="py-4">
                  <div className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 mb-6">
                    <div 
                      className="absolute h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                      style={{ 
                        left: `${(followerRange[0] / maxFollowers) * 100}%`, 
                        width: `${((followerRange[1] - followerRange[0]) / maxFollowers) * 100}%` 
                      }}
                    />
                    <div 
                      className="absolute w-5 h-5 rounded-full border-2 border-purple-500 bg-white dark:bg-slate-800 -mt-1.5 cursor-pointer"
                      style={{ left: `calc(${(followerRange[0] / maxFollowers) * 100}% - 10px)` }}
                    />
                    <div 
                      className="absolute w-5 h-5 rounded-full border-2 border-purple-500 bg-white dark:bg-slate-800 -mt-1.5 cursor-pointer"
                      style={{ left: `calc(${(followerRange[1] / maxFollowers) * 100}% - 10px)` }}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="min-followers" className="text-xs text-slate-500">
                      Min Followers
                    </Label>
                    <Input
                      id="min-followers"
                      type="number"
                      value={followerRange[0]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setFollowerRange([value, followerRange[1]]);
                        }
                      }}
                      className={cn(
                        "font-mono",
                        isDark ? "bg-slate-700 border-slate-600" : ""
                      )}
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="max-followers" className="text-xs text-slate-500">
                      Max Followers
                    </Label>
                    <Input
                      id="max-followers"
                      type="number"
                      value={followerRange[1]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= followerRange[0]) {
                          setFollowerRange([followerRange[0], value]);
                        }
                      }}
                      className={cn(
                        "font-mono",
                        isDark ? "bg-slate-700 border-slate-600" : ""
                      )}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Bio Keyword Filter */}
          <Card className={cn(
            "border overflow-hidden",
            isDark 
              ? "border-slate-700 bg-slate-800/50 hover:border-purple-800/50 transition-all" 
              : "bg-white hover:border-purple-300/70 transition-all"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5 text-purple-500" />
                Bio Keyword
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-slate-400 cursor-help ml-1" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-[200px] text-xs">
                        Filter leads by keywords in their bio. This helps target people with specific interests or roles.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Find leads with specific keywords in their bio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  id="bio-keyword"
                  placeholder="E.g. marketing, founder, tech, crypto"
                  value={bioKeyword}
                  onChange={(e) => setBioKeyword(e.target.value)}
                  className={cn(
                    isDark ? "bg-slate-700 border-slate-600" : "",
                    "focus-visible:ring-purple-500"
                  )}
                />
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Only include leads whose bio contains this keyword (case insensitive). 
                    Leave empty to include all leads regardless of bio.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Following Filter (Disabled) */}
          <Card className={cn(
            "border overflow-hidden opacity-60",
            isDark 
              ? "border-slate-700 bg-slate-800/50" 
              : "bg-white"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-500" />
                Following Count
              </CardTitle>
              <CardDescription>
                Target accounts based on how many people they follow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center gap-4">
                <Input 
                  disabled 
                  placeholder="Min" 
                  className={isDark ? "bg-slate-700 border-slate-600" : ""}
                />
                <span>-</span>
                <Input 
                  disabled 
                  placeholder="Max" 
                  className={isDark ? "bg-slate-700 border-slate-600" : ""}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column - Results and tips */}
        <div className="space-y-6">
          {/* Results Summary */}
          <Card className={cn(
            "border overflow-hidden",
            isDark 
              ? "border-slate-700 bg-slate-800/50" 
              : "bg-white"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 text-purple-500" />
                Filter Results
              </CardTitle>
              <CardDescription>
                {filteredLeadsCount} of {totalLeads} leads match your filters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full" 
                  style={{ width: `${(filteredLeadsCount / totalLeads) * 100}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {Math.round((filteredLeadsCount / totalLeads) * 100)}% of total
                </span>
                <span className={cn(
                  "font-medium",
                  filteredLeadsCount > 0 
                    ? "text-green-500" 
                    : "text-red-500"
                )}>
                  {filteredLeadsCount > 0 
                    ? <span className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-1" /> Ready to proceed</span>
                    : <span className="flex items-center"><Info className="h-4 w-4 mr-1" /> No matching leads</span>
                  }
                </span>
              </div>
              
              <div
                onClick={handleContinue}
                className={cn(
                  "w-full mt-4 py-3 px-4 rounded-md text-center font-medium cursor-pointer transition-colors",
                  filteredLeadsCount === 0
                    ? "bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                )}
              >
                Continue with {filteredLeadsCount} Leads
              </div>
            </CardContent>
          </Card>
          
          {/* Tips Card */}
          <Card className={cn(
            "border overflow-hidden",
            isDark 
              ? "border-amber-800/30 bg-amber-900/20" 
              : "border-amber-200 bg-amber-50"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className={cn(
                  "h-5 w-5",
                  isDark ? "text-amber-400" : "text-amber-500"
                )} />
                Pro Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <CheckCircle2 className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )} />
                  <span>Target accounts with 1,000-5,000 followers for better engagement rates</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )} />
                  <span>Use bio keywords related to your niche for more relevant leads</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )} />
                  <span>Smaller, more targeted campaigns often have higher response rates</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 