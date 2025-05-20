"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, ChevronRight } from "lucide-react";
import DashboardMetrics from "@/components/dashboard/metrics";
import OnboardingChecklist from "@/components/dashboard/onboarding-checklist";
import { useUser } from "@/contexts/user-context";
import { motion } from "framer-motion";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import UpgradePopup from '@/components/ui/UpgradePopup';

// Tutorial type definition
interface Tutorial {
  id: number;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  videoId: string;
}

// Tutorial videos data
const tutorialVideos: Tutorial[] = [
  { 
    id: 1, 
    title: "Why Twitter/X", 
    description: "Introduction to Twitter/X for outreach",
    duration: "1 minute", 
    thumbnail: "/thumbnails/why-twitter-x.png",
    videoId: "OZUfUaEAHbA" 
  },
  { 
    id: 2, 
    title: "Offer Creation Mastery", 
    description: "Learn how to create compelling offers",
    duration: "8 minutes", 
    thumbnail: "/thumbnails/offer-creation.png",
    videoId: "XYZ123abcd" 
  },
  { 
    id: 3, 
    title: "Turning your offer into a killer DM script", 
    description: "Create high-converting DM scripts",
    duration: "18 minutes", 
    thumbnail: "/thumbnails/dm-script.png",
    videoId: "ABC456efgh" 
  },
  { 
    id: 4, 
    title: "How to optimize your profile", 
    description: "Optimize your profile for maximum conversions",
    duration: "8 min", 
    thumbnail: "/thumbnails/profile-opt.png",
    videoId: "DEF789ijkl" 
  },
  { 
    id: 5, 
    title: "How to send 1,500 messages per day", 
    description: "Efficiently scale your outreach",
    duration: "24 min", 
    thumbnail: "/thumbnails/send-messages.png",
    videoId: "GHI012mnop" 
  },
  { 
    id: 6, 
    title: "Tracking & Followups", 
    description: "Effective tracking and follow-up strategies",
    duration: "2 min", 
    thumbnail: "/thumbnails/tracking.png",
    videoId: "JKL345qrst" 
  },
  { 
    id: 7, 
    title: "How to carry a conversation", 
    description: "Maintain engaging conversations that convert",
    duration: "15 min", 
    thumbnail: "/thumbnails/conversation.png",
    videoId: "MNO678uvwx" 
  },
  { 
    id: 8, 
    title: "Closing Framework", 
    description: "Framework for closing deals effectively",
    duration: "15 min", 
    thumbnail: "/thumbnails/closing.png",
    videoId: "PQR901yzab" 
  },
  { 
    id: 9, 
    title: "Closing Thoughts", 
    description: "Final tips and strategies",
    duration: "2 min", 
    thumbnail: "/thumbnails/closing-thoughts.png",
    videoId: "STU234cdef" 
  }
];

export default function Dashboard() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState(tutorialVideos[0]);
  const [showTutorialSection, setShowTutorialSection] = useState(false);
  const { userId } = useUser();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);

  const handleVideoClick = () => {
    setIsVideoPlaying(true);
  };

  const selectTutorial = (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    setIsVideoPlaying(false);
  };

  const toggleTutorialSection = () => {
    setShowTutorialSection(!showTutorialSection);
    setIsVideoPlaying(false);
  };

  useEffect(() => {
    console.log("[Debug] Popup Effect - Status:", status);
    console.log("[Debug] Popup Effect - Session Data:", session);

    if (status === 'authenticated') {
      console.log("[Debug] Popup Effect - User Plan Type:", session?.user?.planType);
      if (session?.user?.planType === 'free') {
        const popupShown = sessionStorage.getItem('upgradePopupShownThisSession');
        console.log("[Debug] Popup Effect - Popup Shown This Session (from sessionStorage)?:", popupShown);
        if (!popupShown) {
          console.log("[Debug] Popup Effect - Conditions met, attempting to show popup.");
          setShowUpgradePopup(true);
          sessionStorage.setItem('upgradePopupShownThisSession', 'true');
        } else {
          console.log("[Debug] Popup Effect - Popup already shown this session.");
        }
      } else {
        console.log("[Debug] Popup Effect - User is not on a free plan or planType is undefined.");
      }
    } else if (status === 'unauthenticated') {
      // router.push('/login'); // Commenting out redirect for easier debugging if needed
      console.log("[Debug] Popup Effect - User is unauthenticated.");
    } else {
      console.log("[Debug] Popup Effect - Status is loading or other.");
    }
  }, [status, session, router]);

  useEffect(() => {
    console.log("[Debug] showUpgradePopup state changed to:", showUpgradePopup);
  }, [showUpgradePopup]);

  const handleCloseUpgradePopup = () => {
    setShowUpgradePopup(false);
  };

  const handleUpgrade = () => {
    setShowUpgradePopup(false);
    router.push('/settings?tab=subscription');
  };

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
        {/* Header section with animation */}
        <motion.div 
          className="mb-2" 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.h1 
            className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Welcome to XAutoDM
          </motion.h1>
          <motion.p 
            className="text-md md:text-lg text-slate-500 dark:text-slate-400 mt-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Automate your{" "}
            <span className="relative inline-block group">
              <span className="relative z-10 font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500 dark:from-purple-400 dark:to-blue-400 px-1">
                X direct messages
              </span>
              {/* Gradient underline with subtle animation */}
              <span className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-blue-500 dark:from-purple-400 dark:to-blue-400 rounded-full opacity-70 animate-shimmer"></span>
              {/* Subtle highlight effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 dark:from-purple-500/20 dark:to-blue-500/20 rounded-md -z-10 group-hover:animate-pulse duration-1000"></span>
            </span>
            {" "}to grow your audience
          </motion.p>
        </motion.div>
        
        {/* Onboarding Checklist */}
        <OnboardingChecklist />
        
        {/* Status Cards with animated title */}
        <section>
          <motion.h2 
            className="text-xl md:text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-200"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Account Status
          </motion.h2>
          <DashboardMetrics />
        </section>
        
        {/* Tutorial Videos Learning Center */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <motion.h2 
              className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              Tutorial Videos
            </motion.h2>
            {/* Button temporarily disabled 
            <Button 
              variant="outline" 
              className="text-purple-600 border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 dark:border-purple-500 dark:text-purple-400"
              onClick={toggleTutorialSection}
            >
              {showTutorialSection ? "Close Learning Center" : "Open Learning Center"}
            </Button>
            */}
          </div>

          {/* Learning Center with Video Player and Sidebar */}
          {showTutorialSection && (
            <motion.div 
              className="bg-slate-100 dark:bg-slate-800/50 rounded-xl overflow-hidden shadow-lg mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex flex-col md:flex-row">
                {/* Sidebar with course modules */}
                <div className="md:w-1/3 lg:w-1/4 bg-slate-200 dark:bg-slate-900/70 p-4 overflow-y-auto max-h-[600px] md:max-h-[unset]">
                  <div className="sticky top-0">
                    <h3 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2 px-2">
                      Learning center <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded px-2 py-0.5 ml-1">{Math.round((selectedTutorial.id / tutorialVideos.length) * 100)}% completed</span>
                    </h3>
                    <div className="space-y-1">
                      {tutorialVideos.map((tutorial) => (
                        <div 
                          key={tutorial.id}
                          onClick={() => selectTutorial(tutorial)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 ${tutorial.id === selectedTutorial.id ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 font-medium' : 'hover:bg-slate-300/50 dark:hover:bg-slate-800/50'}`}
                        >
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${tutorial.id === selectedTutorial.id ? 'bg-purple-500 text-white' : tutorial.id < selectedTutorial.id ? 'bg-purple-200 dark:bg-purple-800/70 text-purple-700 dark:text-purple-300' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                              {tutorial.id}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{tutorial.title}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{tutorial.duration}</div>
                            </div>
                          </div>
                          {tutorial.id === selectedTutorial.id && (
                            <ChevronRight className="h-4 w-4 text-purple-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Main video content area */}
                <div className="md:w-2/3 lg:w-3/4 p-4 md:p-6">
                  <div className="mb-3">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
                      {`Module ${selectedTutorial.id}/${tutorialVideos.length} · ${selectedTutorial.title}`}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      {selectedTutorial.description}
                    </p>
                  </div>
                  
                  {/* Video player container */}
                  <div 
                    className="relative rounded-xl overflow-hidden shadow-lg cursor-pointer w-full group transition-all duration-300 hover:shadow-xl"
                    style={{ paddingBottom: '56.25%' }} /* 16:9 aspect ratio */
                    onClick={handleVideoClick}
                  >
                    {isVideoPlaying ? (
                      // Embedded video player (shown when play is clicked)
                      <iframe
                        className="absolute top-0 left-0 w-full h-full z-10"
                        src={`https://www.youtube.com/embed/${selectedTutorial.videoId}?autoplay=1&modestbranding=1&rel=0&fs=1&showinfo=0&color=white`}
                        title={`${selectedTutorial.title} Tutorial`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        frameBorder="0"
                      />
                    ) : (
                      <>
                        {/* Video Thumbnail with Gradient Overlay */}
                        <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
                          <img 
                            src={selectedTutorial.thumbnail || "/thumbnail.png"} 
                            alt={`${selectedTutorial.title} Tutorial Thumbnail`} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          {/* Simplified gradient overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-60 group-hover:opacity-40 transition-opacity duration-300"></div>
                        </div>
                        
                        {/* Overlay Elements with Glass Effect */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                          {/* Colorful play button with glow effect */}
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-70 animate-pulse"></div>
                            <div className="backdrop-blur-md bg-gradient-to-r from-purple-600 to-blue-600 p-5 rounded-full border border-white/30 hover:from-purple-500 hover:to-blue-500 transition-all duration-300 group-hover:scale-110 relative z-10 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                              <Play className="h-10 w-10 text-white" />
                            </div>
                          </div>
                          <p className="text-white font-medium mt-6 px-6 py-2 rounded-full backdrop-blur-sm bg-gradient-to-r from-purple-600/80 to-blue-600/80 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                            Watch {selectedTutorial.title}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Resources section below video */}
                  <div className="mt-6 flex justify-between items-center">
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-white">Resources</h4>
                    {/* Resource buttons temporarily disabled
                    {selectedTutorial.id === 2 && (
                      <Button 
                        variant="outline" 
                        className="text-purple-600 border-purple-500"
                        onClick={() => window.open('/docs/offer-framework.pdf', '_blank')}
                      >
                        Offer Framework Doc
                      </Button>
                    )}
                    {selectedTutorial.id === 7 && (
                      <Button 
                        variant="outline" 
                        className="text-purple-600 border-purple-500"
                        onClick={() => window.open('/docs/conversation-flow.pdf', '_blank')}
                      >
                        Conversation Flow Doc
                      </Button>
                    )}
                    */}
                  </div>
                  
                  {/* "Want alex to manage your twitter outbound?" CTA */}
                  <div className="mt-8 pt-4 border-t border-slate-300 dark:border-slate-700/50">
                    <p className="text-lg font-medium text-slate-800 dark:text-white">
                      Want alex to manage your twitter outbound?
                    </p>
                    {/* Link button temporarily disabled
                    <Button 
                      variant="link" 
                      className="text-purple-600 dark:text-purple-400 pl-0 mt-1 hover:no-underline"
                      onClick={() => window.open('https://xautodm.com/blogs', '_blank')}
                    >
                      Learn more about xAutoDM <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                    */}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Main Tutorial Video - Show when learning center is closed */}
          {!showTutorialSection && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.2 }}
              className="relative rounded-xl overflow-hidden shadow-lg cursor-pointer w-full group transition-all duration-300 hover:shadow-xl"
              style={{ paddingBottom: '56.25%' }} /* 16:9 aspect ratio */
              onClick={handleVideoClick}
            >
              {isVideoPlaying ? (
                // Embedded video player (shown when play is clicked on desktop)
                <iframe
                  className="absolute top-0 left-0 w-full h-full z-10"
                  src="https://www.youtube.com/embed/OZUfUaEAHbA?autoplay=1&modestbranding=1&rel=0&fs=1&showinfo=0&color=white"
                  title="XAutoDM Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                />
              ) : (
                <>
                  {/* Video Thumbnail with Gradient Overlay */}
                  <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
                    <img 
                      src="/thumbnail.png" 
                      alt="XAutoDM Tutorial Video Thumbnail" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Simplified gradient overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-60 group-hover:opacity-40 transition-opacity duration-300"></div>
                  </div>
                  
                  {/* Overlay Elements with Glass Effect */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    {/* Colorful play button with glow effect */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-70 animate-pulse"></div>
                      <div className="backdrop-blur-md bg-gradient-to-r from-purple-600 to-blue-600 p-5 rounded-full border border-white/30 hover:from-purple-500 hover:to-blue-500 transition-all duration-300 group-hover:scale-110 relative z-10 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                        <Play className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    <p className="text-white font-medium mt-6 px-6 py-2 rounded-full backdrop-blur-sm bg-gradient-to-r from-purple-600/80 to-blue-600/80 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                      How to use xAutoDM
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </section>
      </main>
      {showUpgradePopup && (
        <UpgradePopup
          isOpen={showUpgradePopup}
          onClose={handleCloseUpgradePopup}
          onUpgrade={handleUpgrade}
        />
      )}
    </div>
  );
}