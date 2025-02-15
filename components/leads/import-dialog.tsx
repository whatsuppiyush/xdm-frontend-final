"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Twitter, X, AlertCircle } from "lucide-react";
import { CustomProgress } from "@/components/ui/custom-progress";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/contexts/user-context";
import { Stepper } from "@/components/ui/stepper";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScrapedFollower {
  id: string;
  name: string;
  username: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
}

interface SortConfig {
  key: keyof ScrapedFollower;
  direction: "asc" | "desc";
}

const steps = [
  {
    title: "Import Source",
    description: "Choose how to import your leads",
  },
  {
    title: "Filter Leads",
    description: "Set filtering criteria",
  },
  {
    title: "Preview & Save",
    description: "Review and save your leads",
  },
];

export default function ImportDialog({
  open,
  onOpenChange,
}: ImportDialogProps) {
  const [step, setStep] = useState(1);
  const [twitterUrl, setTwitterUrl] = useState("");
  const [followerCount, setFollowerCount] = useState(0);
  const [scrapedFollowers, setScrapedFollowers] = useState<ScrapedFollower[]>(
    [],
  );
  const [importType, setImportType] = useState<
    "followers" | "following" | "both"
  >("followers");
  const [filters, setFilters] = useState({
    keywords: "",
    minFollowers: 1000,
    maxFollowers: 100000,
    minTweets: 100,
    maxTweets: 10000,
    listName: "",
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "username",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [cookies, setCookies] = useState<any>(null);
  const itemsPerPage = 20;
  const [error, setError] = useState<string | null>(null);
  const [screenshotInfo, setScreenshotInfo] = useState<{
    timestamp: string;
    error: string;
  } | null>(null);
  const { userId } = useUser();

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
    if (step < 3) {
      setStep(step + 1);
    } else {
      setLoading(true);
      await importLeads();
      setLoading(false);
      onOpenChange(false);
    }
  };

  const downloadErrorScreenshot = async () => {
    try {
      const response = await fetch("/api/get-screenshot");
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Screenshot error:", errorData);
        return;
      }

      // Create a blob from the response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `error-screenshot-${new Date().toISOString()}.png`;

      // Trigger download
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading screenshot:", error);
      setError("Failed to download error screenshot");
    }
  };

  const checkForScreenshot = async () => {
    try {
      const response = await fetch("/api/get-screenshot", {
        method: "HEAD",
      });

      if (response.ok) {
        setScreenshotInfo({
          timestamp: response.headers.get("x-screenshot-timestamp") || "",
          error: response.headers.get("x-screenshot-error") || "",
        });
      } else {
        setScreenshotInfo(null);
      }
    } catch (error) {
      console.error("Error checking for screenshot:", error);
      setScreenshotInfo(null);
    }
  };

  // Check for screenshot when an error occurs
  useEffect(() => {
    if (error) {
      checkForScreenshot();
    }
  }, [error]);

  const sendDM = async () => {
    if (!cookies) {
      console.error("No cookies available");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const recipientIds = scrapedFollowers.map((follower) => follower.id);
      const message = "Hello! This a test message. Thanks!!";

      // First, create a message record in the database
      const messageResponse = await fetch("/api/messages/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageSent: message,
          recipients: recipientIds,
        }),
      });

      if (!messageResponse.ok) {
        throw new Error("Failed to create message record");
      }

      // Then start the DM sending process
      const response = await fetch("/api/send-DM", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
          recipients: recipientIds,
          message,
          cookies,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start DM process");
      }

      const data = await response.json();
      console.log("DM process started:", data);
    } catch (error) {
      console.error("Failed to send DMs:", error);
      setError(error instanceof Error ? error.message : "Failed to send DMs");
      // Check for screenshot
      await checkForScreenshot();
    } finally {
      setLoading(false);
    }
  };

  // Sorting function
  const sortData = (data: ScrapedFollower[]) => {
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      return sortConfig.direction === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  };

  // Handle sort click
  const handleSort = (key: keyof ScrapedFollower) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Get current page data
  const sortedData = sortData(scrapedFollowers);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Pagination controls
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  async function importLeads() {
    if (!cookies) {
      console.error("No cookies available");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/twitter/scrape-followers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileUrl: twitterUrl,
          count: followerCount,
          cookies: cookies,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to scrape followers");
      }

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error("Invalid response format from scraper");
      }

      // Transform the scraped data to match our ScrapedFollower interface
      const transformedFollowers: ScrapedFollower[] = data.items.map(
        (item: any) => ({
          id: item.userId || item.id,
          name: item.name || "",
          username: item.username || item.screen_name || "",
          bio: item.description || item.bio || "",
          followersCount: item.followers_count || item.followersCount,
          followingCount: item.following_count || item.followingCount,
        }),
      );

      setScrapedFollowers(transformedFollowers);
    } catch (error) {
      console.error("Error importing leads:", error);
      setError(
        error instanceof Error ? error.message : "Failed to import leads",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-oid="10t3xj:">
      <DialogContent className="sm:max-w-[600px]" data-oid="xwm71b9">
        <div className="space-y-8" data-oid="tc4p81o">
          <Stepper steps={steps} currentStep={step} data-oid=".clxc7u" />

          {step === 1 && (
            <div className="space-y-6" data-oid="v:gzv0:">
              <Card data-oid="8kckvrd">
                <CardContent className="pt-6" data-oid="u3jmo._">
                  <div className="space-y-4" data-oid="2h7rq36">
                    <div className="flex items-center gap-2" data-oid="ph-wnx_">
                      <Twitter className="h-5 w-5" data-oid="7m8bgjr" />
                      <h3 className="font-medium" data-oid="1pycn2a">
                        Import from Twitter
                      </h3>
                    </div>
                    <div className="space-y-2" data-oid="2vkq-qj">
                      <Label data-oid="e_pr47i">Twitter Profile URL</Label>
                      <Input
                        placeholder="https://twitter.com/username"
                        value={twitterUrl}
                        onChange={(e) => setTwitterUrl(e.target.value)}
                        data-oid="tfsayvv"
                      />
                    </div>
                    <div className="space-y-2" data-oid="n3irtm2">
                      <Label data-oid="9-2gl7c">Count to Scrape</Label>
                      <Input
                        type="number"
                        placeholder="Enter number of leads to scrape"
                        value={followerCount || ""}
                        onChange={(e) =>
                          setFollowerCount(parseInt(e.target.value))
                        }
                        data-oid="kn9apeu"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div
                className="text-center text-sm text-muted-foreground"
                data-oid="4gc5wwq"
              >
                or
              </div>

              <Card data-oid="yu9ah06">
                <CardContent className="pt-6" data-oid="swwz8fr">
                  <div className="space-y-4" data-oid="wia3exe">
                    <div className="flex items-center gap-2" data-oid="zph-kww">
                      <Upload className="h-5 w-5" data-oid="ia69ofc" />
                      <h3 className="font-medium" data-oid="gthyv0-">
                        Upload CSV File
                      </h3>
                    </div>
                    <Input type="file" accept=".csv" data-oid="wjg770i" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && (
            <Card data-oid="prhzfe0">
              <CardContent className="pt-6 space-y-4" data-oid="rqgfz:q">
                <div className="space-y-2" data-oid="i_4dqn3">
                  <Label data-oid="o:kiv_s">
                    Bio Keywords (comma separated)
                  </Label>
                  <Input
                    placeholder="founder, ceo, marketing"
                    value={filters.keywords}
                    onChange={(e) =>
                      setFilters({ ...filters, keywords: e.target.value })
                    }
                    data-oid="b.wz7g1"
                  />
                </div>

                <div className="space-y-2" data-oid="-9gkjdz">
                  <Label data-oid=".2adsam">List Name</Label>
                  <Input
                    placeholder="e.g., Tech Founders Q1 2024"
                    value={filters.listName}
                    onChange={(e) =>
                      setFilters({ ...filters, listName: e.target.value })
                    }
                    data-oid="7q-fsfd"
                  />
                </div>

                {loading && (
                  <div className="space-y-2" data-oid="eavubk5">
                    <CustomProgress value={progress} data-oid="e.kk71c" />
                    <p
                      className="text-sm text-center text-muted-foreground"
                      data-oid="65opw:-"
                    >
                      Processing leads... {progress}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card data-oid="brh-1r2">
              <CardContent className="pt-6" data-oid="lok1gkp">
                <div className="space-y-4" data-oid="4mwc4_u">
                  <h3 className="font-medium" data-oid="mh:2.f:">
                    Preview Leads
                  </h3>
                  {/* Add preview table/grid here */}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2" data-oid="jewn6_p">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                data-oid="ei7-4us"
              >
                Back
              </Button>
            )}
            <Button onClick={handleNext} disabled={loading} data-oid="2yxgo0x">
              {loading && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  data-oid="rapgsav"
                />
              )}
              {step === 3 ? "Save Leads" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
