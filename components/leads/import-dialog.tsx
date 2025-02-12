'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Twitter, X, AlertCircle } from 'lucide-react';
import { CustomProgress } from '@/components/ui/custom-progress';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/contexts/user-context';
import { Stepper } from '@/components/ui/stepper';

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
  direction: 'asc' | 'desc';
}

const steps = [
  {
    title: 'Import Source',
    description: 'Choose how to import your leads'
  },
  {
    title: 'Filter Leads',
    description: 'Set filtering criteria'
  },
  {
    title: 'Send DM',
    description: 'Review and send messages'
  }
];

export default function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [step, setStep] = useState(1);
  const [twitterUrl, setTwitterUrl] = useState('');
  const [followerCount,setFollowerCount] = useState(0);
  const [scrapedFollowers,setScrapedFollowers] = useState<ScrapedFollower[]>([]);
  const [importType, setImportType] = useState<'followers' | 'following' | 'both'>('followers');
  const [filters, setFilters] = useState({
    keywords: '',
    minFollowers: 1000,
    maxFollowers: 100000,
    minTweets: 100,
    maxTweets: 10000,
    listName: '',
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'username', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [cookies, setCookies] = useState<any>(null);
  const itemsPerPage = 20;
  const [error, setError] = useState<string | null>(null);
  const [screenshotInfo, setScreenshotInfo] = useState<{ timestamp: string; error: string } | null>(null);
  const { userId } = useUser();

  useEffect(() => {
    const fetchCookies = async () => {
      try {
        const response = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch cookies');
        const data = await response.json();
        if (data.accounts && data.accounts.length > 0) {
          setCookies(data.accounts[0].cookies);
        }
      } catch (error) {
        console.error('Error fetching cookies:', error);
      }
    };

    if (userId) {
      fetchCookies();
    }
  }, [userId]);

  const handleNext = async () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      setLoading(true);
      await importLeads();
      setLoading(false);
      setStep(step + 1);
    }
  };

  const downloadErrorScreenshot = async () => {
    try {
      const response = await fetch('/api/get-screenshot');
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Screenshot error:', errorData);
        return;
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-screenshot-${new Date().toISOString()}.png`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading screenshot:', error);
      setError('Failed to download error screenshot');
    }
  };

  const checkForScreenshot = async () => {
    try {
      const response = await fetch('/api/get-screenshot', {
        method: 'HEAD'
      });
      
      if (response.ok) {
        setScreenshotInfo({
          timestamp: response.headers.get('x-screenshot-timestamp') || '',
          error: response.headers.get('x-screenshot-error') || ''
        });
      } else {
        setScreenshotInfo(null);
      }
    } catch (error) {
      console.error('Error checking for screenshot:', error);
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
      console.error('No cookies available');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const recipientIds = scrapedFollowers.map(follower => follower.id);
      const message = "Hello! This a test message. Thanks!!";

      // First, create a message record in the database
      const messageResponse = await fetch('/api/messages/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageSent: message,
          recipients: recipientIds,
        }),
      });

      if (!messageResponse.ok) {
        throw new Error('Failed to create message record');
      }

      // Then start the DM sending process
      const response = await fetch('/api/send-DM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          recipients: recipientIds,
          message,
          cookies
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start DM process');
      }

      const data = await response.json();
      console.log('DM process started:', data);
    } catch (error) {
      console.error('Failed to send DMs:', error);
      setError(error instanceof Error ? error.message : 'Failed to send DMs');
      // Check for screenshot
      await checkForScreenshot();
    } finally {
      setLoading(false);
    }
  };

  // Sorting function
  const sortData = (data: ScrapedFollower[]) => {
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return sortConfig.direction === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  };

  // Handle sort click
  const handleSort = (key: keyof ScrapedFollower) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Get current page data
  const sortedData = sortData(scrapedFollowers);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Pagination controls
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  async function importLeads() {
    if (!cookies) {
      console.error('No cookies available');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/twitter/scrape-followers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileUrl: twitterUrl,
          count: followerCount,
          cookies: cookies
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape followers');
      }
      
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid response format from scraper');
      }

      // Transform the scraped data to match our ScrapedFollower interface
      const transformedFollowers: ScrapedFollower[] = data.items.map((item: any) => ({
        id: item.userId || item.id,
        name: item.name || '',
        username: item.username || item.screen_name || '',
        bio: item.description || item.bio || '',
        followersCount: item.followers_count || item.followersCount,
        followingCount: item.following_count || item.followingCount
      }));

      setScrapedFollowers(transformedFollowers);
    } catch (error) {
      console.error('Error importing leads:', error);
      setError(error instanceof Error ? error.message : 'Failed to import leads');
    } finally {
      setLoading(false);
    }
  }

  // Add this function to reset all states
  const resetStates = () => {
    setStep(1);
    setTwitterUrl('');
    setFollowerCount(0);
    setScrapedFollowers([]);
    setImportType('followers');
    setFilters({
      keywords: '',
      minFollowers: 1000,
      maxFollowers: 100000,
      minTweets: 100,
      maxTweets: 10000,
      listName: '',
    });
    setLoading(false);
    setProgress(0);
    setShowDetails(false);
    setShowDetailsDialog(false);
    setError(null);
    setScreenshotInfo(null);
  };

  // Create a custom onOpenChange handler
  const handleOpenChange = (open: boolean) => {
    if (!open && step > 1) {
      resetStates();
    }
    onOpenChange(open);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Stepper */}
      <Stepper steps={steps} currentStep={step} className="mb-8" />

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Step 1 - Import Source */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Twitter className="h-5 w-5" />
                    <h3 className="font-medium">Import from Twitter</h3>
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter Profile URL</Label>
                    <Input 
                      placeholder="https://twitter.com/username"
                      value={twitterUrl}
                      onChange={(e) => setTwitterUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Count to Scrape</Label>
                    <Input 
                      placeholder="Enter a number"
                      type="number"
                      value={followerCount || ''}
                      onChange={(e) => setFollowerCount(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">or</div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    <h3 className="font-medium">Upload CSV File</h3>
                  </div>
                  <Input type="file" accept=".csv" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2 - Filter Leads */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bio Keywords (comma separated)</Label>
                    <Input 
                      placeholder="founder, ceo, marketing"
                      value={filters.keywords}
                      onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>List Name</Label>
                    <Input 
                      placeholder="e.g., Tech Founders Q1 2024"
                      value={filters.listName}
                      onChange={(e) => setFilters({ ...filters, listName: e.target.value })}
                    />
                  </div>

                  {loading && (
                    <div className="space-y-2">
                      <CustomProgress value={progress} />
                      <p className="text-sm text-center text-muted-foreground">
                        Importing leads... {progress}%
                      </p>
                    </div>
                  )}
                  {!loading && scrapedFollowers.length > 0 && (
                    <div className="grid grid-cols-6 gap-2 overflow-y-auto overflow-x-hidden h-64 no-scrollbar scroll-smooth">
                      {scrapedFollowers.map((follower) => (
                        <span key={follower.id} className="bg-blue-400 text-white text-center p-1 rounded truncate">
                          @{follower.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3 - Review & Send */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Leads Processed ({scrapedFollowers.length})</Label>
                    <div className="flex gap-2 items-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowDetails(!showDetails)}
                      >
                        {showDetails ? 'Show Grid View' : 'Show Table View'}
                      </Button>
                    </div>
                  </div>
                  {!loading && scrapedFollowers.length > 0 && (
                    <div className="space-y-4">
                      {/* Grid View - Show when not in detailed view */}
                      {!showDetails && (
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 overflow-y-auto max-h-[200px] p-2">
                          {scrapedFollowers.map((follower) => (
                            <div
                              key={follower.id}
                              className="bg-primary/10 hover:bg-primary/20 text-primary rounded-lg p-2 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <a
                                  href={`https://twitter.com/${follower.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:underline truncate"
                                >
                                  @{follower.username}
                                </a>
                                <span className="h-2 w-2 rounded-full bg-yellow-400" title="Pending" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Table View - Show when in detailed view */}
                      {showDetails && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th 
                                  className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-muted/80"
                                  onClick={() => handleSort('username')}
                                >
                                  <div className="flex items-center gap-2">
                                    Username
                                    {sortConfig.key === 'username' && (
                                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </div>
                                </th>
                                <th 
                                  className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-muted/80"
                                  onClick={() => handleSort('name')}
                                >
                                  <div className="flex items-center gap-2">
                                    Name
                                    {sortConfig.key === 'name' && (
                                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </div>
                                </th>
                                <th 
                                  className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-muted/80"
                                  onClick={() => handleSort('followersCount')}
                                >
                                  <div className="flex items-center gap-2">
                                    Followers
                                    {sortConfig.key === 'followersCount' && (
                                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </div>
                                </th>
                                <th 
                                  className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-muted/80"
                                  onClick={() => handleSort('followingCount')}
                                >
                                  <div className="flex items-center gap-2">
                                    Following
                                    {sortConfig.key === 'followingCount' && (
                                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </div>
                                </th>
                                <th className="px-4 py-3 text-left font-medium min-w-[300px]">Bio</th>
                                <th className="px-4 py-3 text-center font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {currentData.map((follower) => (
                                <tr key={follower.id} className="hover:bg-muted/50">
                                  <td className="px-4 py-2">
                                    <a 
                                      href={`https://twitter.com/${follower.username}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      @{follower.username}
                                    </a>
                                  </td>
                                  <td className="px-4 py-2">{follower.name}</td>
                                  <td className="px-4 py-2">{follower.followersCount?.toLocaleString()}</td>
                                  <td className="px-4 py-2">{follower.followingCount?.toLocaleString()}</td>
                                  <td className="px-4 py-2">
                                    <div 
                                      className="line-clamp-2 text-sm" 
                                      title={follower.bio}
                                      style={{ 
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {follower.bio}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      Pending
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Pagination */}
                          <div className="flex items-center justify-between border-t pt-4 mt-4">
                            <div className="text-sm text-muted-foreground">
                              Showing {Math.min(currentData.length, itemsPerPage)} of {scrapedFollowers.length} results
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                              >
                                Previous
                              </Button>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                  <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handlePageChange(page)}
                                    className="w-8"
                                  >
                                    {page}
                                  </Button>
                                ))}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-end gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={handleNext} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === 2 ? 'Import Leads' : 'Next'}
            </Button>
          ) : (
            <Button onClick={sendDM} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Sending DMs...' : 'Send DM'}
            </Button>
          )}
        </div>

        {/* Error Messages */}
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
            {screenshotInfo && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadErrorScreenshot}
                  className="w-full"
                >
                  Download Error Screenshot
                </Button>
                <p className="text-xs text-muted-foreground">
                  Screenshot taken at: {new Date(screenshotInfo.timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}