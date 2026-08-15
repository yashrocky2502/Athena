import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import NavigationDrawer from "./components/NavigationDrawer";
import NewsPage from "./components/NewsPage";
import SearchPage from "./components/SearchPage";
import AiSearch from "./components/AiSearch";
import MarketDashboard from "./components/MarketDashboard";
import MorningBrief from "./components/MorningBrief";
import OpportunityRisk from "./components/OpportunityRisk";
import CompanyIntelligence from "./components/CompanyIntelligence";
import MarketStory from "./components/MarketStory";
import AlertsManager from "./components/AlertsManager";
import ForYouDashboard from "./components/ForYouDashboard";
import PortfolioDashboard from "./components/PortfolioDashboard";
import WatchlistDashboard from "./components/WatchlistDashboard";
import WatchlistPage from "./components/WatchlistPage";
import Settings from "./components/Settings";
import ProfileSettings from "./components/ProfileSettings";
import EconomicCalendar from "./components/EconomicCalendar";
import { MarketDataResponse } from "./types";
import { 
  Home as HomeIcon, 
  Search as SearchIcon, 
  Sparkles, 
  Briefcase,
  TrendingUp,
  FileText,
  Settings as SettingsIcon,
  ChevronRight,
  Info,
  Clock,
  Database,
  User,
  Zap,
  Menu,
  Bell,
  BookOpen,
  Shield,
  Star,
  X,
  Calendar as CalendarIcon
} from "lucide-react";
import AlertAuditPanel from "./components/AlertAuditPanel";
import Nifty200MonitorDashboard from "./components/Nifty200MonitorDashboard";
import { AthenaDashboard } from "./components/AthenaDashboard";
import { MCPOrchestrator } from "./mcp/MCPOrchestrator";
import { LiveIntelligenceEngine } from "./services/LiveIntelligenceEngine";
import NewsOperationsDashboard from "./components/admin/NewsOperationsDashboard";
import { safeLocalStorage } from "./services/storage/safeStorage";

export default function App() {
  const [marketData, setMarketData] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Shared state to link clicks across sections to the AI Search panel
  const [externalSearchQuery, setExternalSearchQuery] = useState<string | undefined>(undefined);
  const [selectedCompanySymbol, setSelectedCompanySymbol] = useState<string | null>(null);
  const searchSectionRef = useRef<HTMLDivElement>(null);

  // Bottom Navigation state
  const [activeTab, setActiveTab] = useState<"home" | "foryou" | "news" | "markets" | "watchlist" | "search" | "calendar">((): "home" | "foryou" | "news" | "markets" | "watchlist" | "search" | "calendar" => {
    return (safeLocalStorage.getItem("athena-active-tab") as any) || "home";
  });
  
  const [highlightedMarketSymbol, setHighlightedMarketSymbol] = useState<string | undefined>(undefined);
  
  const [marketTab, setMarketTab] = useState<"India" | "Global" | "Crypto" | "Commodities" | "Currencies" | undefined>(undefined);
  const [marketSymbol, setMarketSymbol] = useState<string | undefined>(undefined);
 
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
 
  // Developer mode & Theme states
  const [developerMode, setDeveloperMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "true" || params.get("developer") === "true") {
      return true;
    }
    return safeLocalStorage.getItem("athena-dev-mode") === "true";
  });
 
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDeveloperMode(prev => {
          const next = !prev;
          safeLocalStorage.setItem("athena-dev-mode", String(next));
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    return (safeLocalStorage.getItem("athena-theme") as any) || "dark";
  });
  const [showStoryEngineAdmin, setShowStoryEngineAdmin] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSavedResearchModal, setShowSavedResearchModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAiProviderSettings, setShowAiProviderSettings] = useState(false);
  const [showNiftyMonitor, setShowNiftyMonitor] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [settingsDefaultView, setSettingsDefaultView] = useState<"menu" | "myintel" | "research" | "watchlist" | "theme" | "notifications" | "telegram" | "developer" | "about" | "privacy" | "account" | "aiprovider">("menu");

  const [isAdminNews, setIsAdminNews] = useState(() => {
    return window.location.pathname === "/admin/news";
  });

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminNews(window.location.pathname === "/admin/news");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Initialize MCP Orchestrator and Live Intelligence Engine to start live background schedulers immediately
  useEffect(() => {
    MCPOrchestrator.getInstance();
    LiveIntelligenceEngine.getInstance();
  }, []);

  // Home SSE Stream & Live Diagnostics State
  const [streamStatus, setStreamStatus] = useState<"CONNECTED" | "RECONNECTING" | "OFFLINE">("CONNECTED");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [articlesReceivedToday, setArticlesReceivedToday] = useState<number>(148);
  const [liveNewsNotification, setLiveNewsNotification] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const checkV2Status = async () => {
      if (!isSubscribed) return;
      try {
        const res = await fetch('/api/v4/news/status');
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setStreamStatus('CONNECTED');
            if (data.storageCount) {
              setArticlesReceivedToday(data.storageCount);
            }
            setLastUpdated(new Date());
          }
        }
      } catch (err) {
        if (isSubscribed) setStreamStatus('RECONNECTING');
      }
    };

    checkV2Status();
    const interval = setInterval(checkV2Status, 15000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch initial market data
  useEffect(() => {
    async function fetchMarketData() {
      try {
        const response = await fetch("/api/market-data");
        if (!response.ok) {
          throw new Error("Failed to load market intelligence data");
        }
        const rawText = await response.text();
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error("Received non-JSON response from server (possibly HTML)");
        }
        setMarketData(data);
      } catch (err) {
        console.error("Error loading market data:", err);
        setError("Live market data is currently unavailable. (Coming Soon)");
      } finally {
        setLoading(false);
      }
    }

    fetchMarketData();
  }, []);

  // Sync active tab
  useEffect(() => {
    safeLocalStorage.setItem("athena-active-tab", activeTab);
  }, [activeTab]);

  // Sync developer mode state
  useEffect(() => {
    safeLocalStorage.setItem("athena-dev-mode", developerMode ? "true" : "false");
  }, [developerMode]);

  // Sync and Apply Theme
  useEffect(() => {
    safeLocalStorage.setItem("athena-theme", theme);
    const applyTheme = (currentTheme: "dark" | "light" | "system") => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      
      if (currentTheme === "light") {
        root.classList.add("light");
      } else if (currentTheme === "dark") {
        root.classList.add("dark");
      } else {
        // System preference
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (systemPrefersDark) {
          root.classList.add("dark");
        } else {
          root.classList.add("light");
        }
      }
    };
    applyTheme(theme);
  }, [theme]);

  // Listen to prefers-color-scheme changes when on system theme
  useEffect(() => {
    if (theme !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.add("light");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Handler to coordinate cross-section triggers to the AI search tab
  const handleTriggerSearch = (query: string) => {
    // Reset selected company to focus on search query instead
    setSelectedCompanySymbol(null);
    setExternalSearchQuery(query);
    setActiveTab("search");
    
    // Smooth scroll if ref is present
    setTimeout(() => {
      searchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const handleSelectMarketAsset = (symbol: string) => {
    setHighlightedMarketSymbol(symbol);
    setActiveTab("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectTab = (tab: "home" | "foryou" | "news" | "markets" | "watchlist" | "search" | "calendar") => {
    setActiveTab(tab);
    // Auto-scroll back to top of page on tab switch for premium feel
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isAdminNews) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <NewsOperationsDashboard onClose={() => {
            setIsAdminNews(false);
            window.history.pushState({}, "", "/");
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 pb-28 sm:pb-24" id="athena-app-root">
      
      {/* Top Header */}
      <Header onOpenMenu={() => setShowMenu(true)} onOpenSearch={() => setShowSearch(true)} theme={theme} setTheme={setTheme} />
      
      {/* Navigation Drawer */}
      <NavigationDrawer 
        isOpen={showMenu} 
        onClose={() => setShowMenu(false)} 
        onOpenAlerts={() => setShowAlertsModal(true)} 
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenWatchlist={() => { setShowMenu(false); handleSelectTab("watchlist"); }}
        onOpenSavedResearch={() => { setSettingsDefaultView("research"); setShowSettingsModal(true); }}
        onOpenSettings={() => { setSettingsDefaultView("menu"); setShowSettingsModal(true); }}
        onToggleDeveloperMode={() => setDeveloperMode(!developerMode)}
        onOpenAuditPanel={() => setShowAuditPanel(true)}
        onOpenNiftyMonitor={() => setShowNiftyMonitor(true)}
        onOpenHelp={() => { setSettingsDefaultView("about"); setShowSettingsModal(true); }}
        onOpenAbout={() => { setSettingsDefaultView("about"); setShowSettingsModal(true); }}
        onOpenAiProviderSettings={() => { setSettingsDefaultView("aiprovider"); setShowSettingsModal(true); }}
        onOpenNewsOperations={() => {
          setShowMenu(false);
          setIsAdminNews(true);
          window.history.pushState({}, "", "/admin/news");
        }}
        developerMode={developerMode}
      />

      {/* Alerts Manager Overlay */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <div className="flex items-center gap-2">
              <Bell className="text-indigo-400" size={20} />
              <h2 className="font-display font-bold text-lg text-white">Alerts Center</h2>
            </div>
            <button 
              onClick={() => setShowAlertsModal(false)}
              className="p-2 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <AlertsManager developerMode={developerMode} />
          </div>
        </div>
      )}

      {/* Settings Overlay */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <div className="flex items-center gap-2">
              <SettingsIcon className="text-indigo-400" size={20} />
              <h2 className="font-display font-bold text-lg text-white">Settings</h2>
            </div>
            <button onClick={() => setShowSettingsModal(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
             <Settings 
               developerMode={developerMode} 
               setDeveloperMode={setDeveloperMode}
               theme={theme}
               setTheme={setTheme}
               defaultView={settingsDefaultView}
             />
          </div>
        </div>
      )}

      {/* Profile Overlay */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <div className="flex items-center gap-2">
              <User className="text-indigo-400" size={20} />
              <h2 className="font-display font-bold text-lg text-white">Profile</h2>
            </div>
            <button onClick={() => setShowProfileModal(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
             <ProfileSettings 
               email="yashrocky2502@gmail.com"
               developerMode={developerMode}
               setDeveloperMode={setDeveloperMode}
               theme={theme}
               setTheme={setTheme}
               onNavigateToStoryEngine={() => setShowStoryEngineAdmin(true)}
               showStoryEngineAdmin={showStoryEngineAdmin}
               setShowStoryEngineAdmin={setShowStoryEngineAdmin}
             />
          </div>
        </div>
      )}

      {/* Saved Research Overlay */}
      {showSavedResearchModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <div className="flex items-center gap-2">
              <FileText className="text-indigo-400" size={20} />
              <h2 className="font-display font-bold text-lg text-white">Saved Research</h2>
            </div>
            <button onClick={() => setShowSavedResearchModal(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
             <div className="flex flex-col items-center justify-center h-full text-center p-8">
               <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                  <FileText size={32} className="text-slate-700" />
               </div>
               <h3 className="text-lg font-bold text-white mb-2">No Saved Research</h3>
               <p className="text-sm text-slate-500 max-w-xs">You haven't saved any research briefs yet. Tap the bookmark icon on any analysis to save it here.</p>
             </div>
          </div>
        </div>
      )}

      {/* Alert Audit Panel Overlay */}
      {showAuditPanel && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <h2 className="font-display font-bold text-lg text-white">Alert Audit Panel</h2>
            <button onClick={() => setShowAuditPanel(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AlertAuditPanel />
          </div>
        </div>
      )}

      {/* Nifty Monitor Overlay */}
      {showNiftyMonitor && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <h2 className="font-display font-bold text-lg text-white">Nifty 200 Monitor</h2>
            <button onClick={() => setShowNiftyMonitor(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <Nifty200MonitorDashboard />
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 p-4 pt-16 animate-in fade-in duration-300">
           <button onClick={() => setShowSearch(false)} className="absolute top-4 right-4 text-white p-2">
             <X size={24} />
           </button>
           <div className="max-w-2xl mx-auto">
             <SearchPage onSelectCompany={(s) => { setSelectedCompanySymbol(s); setShowSearch(false); }} developerMode={developerMode} />
           </div>
        </div>
      )}



      {/* Main viewport Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        
        {/* Render Company Intelligence if a ticker is active */}
        {selectedCompanySymbol ? (
          <div className="animate-in fade-in duration-200">
            <CompanyIntelligence 
              companySymbol={selectedCompanySymbol} 
              onBack={() => setSelectedCompanySymbol(null)} 
              developerMode={developerMode}
            />
          </div>
        ) : (
          /* Render tab views dynamically */
          <>
            {activeTab === "home" && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-150 text-left">
                
                {/* Hero Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="font-display font-bold text-xl md:text-2xl text-white">Market Dashboard</h2>

                  {/* LIVE Stream Diagnostics Bar */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono font-semibold">
                        {streamStatus === "CONNECTED" ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-400 font-bold uppercase tracking-wider">LIVE</span>
                          </>
                        ) : streamStatus === "RECONNECTING" ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span className="text-amber-400 font-bold">Reconnecting...</span>
                          </>
                        ) : (
                          <span className="text-slate-500 font-bold">Offline</span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                        Updated <strong className="text-slate-200">{lastUpdated.toLocaleTimeString()}</strong>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                        Articles Today: <strong className="text-indigo-400">{articlesReceivedToday}</strong>
                      </span>
                    </div>

                    {liveNewsNotification && (
                      <div className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs px-2.5 py-1 rounded-xl animate-bounce truncate max-w-xs">
                        🔴 {liveNewsNotification}
                      </div>
                    )}
                  </div>
                </div>

                {/* Flagship Institutional Market Intelligence Dashboard */}
                <AthenaDashboard developerMode={developerMode} />

                {/* Loading skeleton state */}
                {loading ? (
                  <div className="flex flex-col gap-6 animate-pulse mt-2">
                    <div className="h-40 bg-slate-900/60 rounded-xl border border-slate-800"></div>
                    <div className="h-64 bg-slate-900/60 rounded-xl border border-slate-800"></div>
                  </div>
                ) : marketData ? (
                  <div className="flex flex-col gap-6">
                    
                    {/* 2. Market Mood (Indices & Trending Stocks) */}
                    <div>
                      <MarketDashboard 
                        onSelectStock={handleTriggerSearch}
                        onSelectCompany={setSelectedCompanySymbol}
                      />
                    </div>

                    {/* 3. Today's Story (Daily bulletin briefs) */}
                    <div>
                      <MorningBrief 
                        brief={marketData.morningBrief}
                        stories={marketData.marketStories}
                        onSelectStoryQuery={handleTriggerSearch}
                      />
                    </div>

                    {/* 4. Opportunities & Risks */}
                    <div>
                      <OpportunityRisk 
                        explorer={marketData.opportunityExplorer}
                        radar={marketData.riskRadar}
                        onSelectQuery={handleTriggerSearch}
                      />
                    </div>

                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl text-center">
                    <p className="text-red-400 font-medium text-sm">Failed to establish connection to the Athena financial intelligence engine.</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-3 bg-red-500/20 text-red-300 px-4 py-1.5 rounded text-xs hover:bg-red-500/35 transition-all font-sans font-semibold border border-red-500/30"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "search" && (
              <div className="flex flex-col gap-5 animate-in fade-in duration-150 text-left" ref={searchSectionRef}>
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <SearchIcon className="h-4.5 w-4.5 text-indigo-400" />
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      Interactive Grounding Engine
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">
                    Query SEC-grade analyses, F&O contract changes, SEBI corporate filings, and live business disclosures dynamically.
                  </p>
                </div>
                
                <AiSearch 
                  triggerQuery={externalSearchQuery} 
                  onClearTrigger={() => setExternalSearchQuery(undefined)} 
                  onSelectCompany={setSelectedCompanySymbol}
                  onSelectMarketAsset={handleSelectMarketAsset}
                  developerMode={developerMode}
                />
              </div>
            )}

            {activeTab === "foryou" && (
              <div className="animate-in fade-in duration-150">
                <div className="mb-6">
                  <h2 className="font-display font-bold text-2xl text-white">For You</h2>
                  <p className="text-sm text-slate-400">Personalized market intelligence based on your watchlist and interests.</p>
                </div>
                <ForYouDashboard onSelectStory={(q) => handleTriggerSearch(q)} developerMode={developerMode} />
              </div>
            )}

            {activeTab === "markets" && (
              <div className="animate-in fade-in duration-150">
                <MarketDashboard 
                    onSelectStock={handleTriggerSearch}
                    onSelectCompany={setSelectedCompanySymbol}
                    defaultTab={marketTab}
                    highlightedSymbol={marketSymbol}
                />
              </div>
            )}

            {activeTab === "news" && (
              <div className="animate-in fade-in duration-150">
                 <NewsPage developerMode={developerMode} />
              </div>
            )}

            {activeTab === "watchlist" && (
              <div className="animate-in fade-in duration-150">
                 <WatchlistPage onSelectCompany={setSelectedCompanySymbol} onSelectNewsQuery={handleTriggerSearch} />
              </div>
            )}

            {activeTab === "calendar" && (
              <div className="animate-in fade-in duration-150">
                <EconomicCalendar onSelectSymbol={handleTriggerSearch} onSelectNewsQuery={handleTriggerSearch} developerMode={developerMode} />
              </div>
            )}
          </>
        )}

      </main>

      {/* Fixed Bottom Navigation Dock (Optimized for One-Handed Touch Targets >= 44px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-lg border-t border-slate-900/80 shadow-2xl px-2 py-2" id="athena-bottom-nav">
        <div className="max-w-md mx-auto flex items-center justify-between gap-1">
          
          {/* Home Tab */}
          <button
            onClick={() => handleSelectTab("home")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all cursor-pointer select-none relative ${
              activeTab === "home" && !selectedCompanySymbol
                ? "text-emerald-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ minHeight: "44px" }}
          >
            <HomeIcon className={`h-5 w-5 transition-transform ${activeTab === "home" && !selectedCompanySymbol ? "scale-110" : ""}`} />
            <span className="text-[10px] tracking-wide">Home</span>
            {activeTab === "home" && !selectedCompanySymbol && (
              <span className="absolute bottom-1 h-1 w-4 rounded-full bg-emerald-500"></span>
            )}
          </button>

          {/* Search Tab */}
          <button
            onClick={() => handleSelectTab("search")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all cursor-pointer select-none relative ${
              activeTab === "search"
                ? "text-indigo-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ minHeight: "44px" }}
          >
            <SearchIcon className={`h-5 w-5 transition-transform ${activeTab === "search" ? "scale-110" : ""}`} />
            <span className="text-[10px] tracking-wide">Search</span>
            {activeTab === "search" && (
              <span className="absolute bottom-1 h-1 w-4 rounded-full bg-indigo-500"></span>
            )}
          </button>

          {/* News Tab */}
          <button
            onClick={() => handleSelectTab("news")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all cursor-pointer select-none relative ${
              activeTab === "news"
                ? "text-emerald-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ minHeight: "44px" }}
          >
            <FileText className={`h-5 w-5 transition-transform ${activeTab === "news" ? "scale-110" : ""}`} />
            <span className="text-[10px] tracking-wide">News</span>
            {activeTab === "news" && (
              <span className="absolute bottom-1 h-1 w-4 rounded-full bg-emerald-500"></span>
            )}
          </button>

          {/* Economic Calendar Tab */}
          <button
            onClick={() => handleSelectTab("calendar")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all cursor-pointer select-none relative ${
              activeTab === "calendar"
                ? "text-indigo-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ minHeight: "44px" }}
          >
            <CalendarIcon className={`h-5 w-5 transition-transform ${activeTab === "calendar" ? "scale-110" : ""}`} />
            <span className="text-[10px] tracking-wide">Calendar</span>
            {activeTab === "calendar" && (
              <span className="absolute bottom-1 h-1 w-4 rounded-full bg-indigo-500"></span>
            )}
          </button>

          {/* Alerts Tab */}
          <button
            onClick={() => setShowAlertsModal(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all cursor-pointer select-none relative text-slate-400 hover:text-slate-200"
            style={{ minHeight: "44px" }}
          >
            <Bell className="h-5 w-5" />
            <span className="text-[10px] tracking-wide">Alerts</span>
          </button>

        </div>
      </nav>

      {/* Global Footer (Visible on wider devices/desktops, hidden on absolute mobile inside margin) */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 mt-8 text-center text-xs text-slate-500 pb-12 sm:pb-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p>© 2026 Athena AI Financial Intelligence Inc. Indian Markets Sandbox.</p>
          <div className="flex justify-center gap-6 font-mono font-medium text-[10px] text-slate-600">
            <span>SEBI REG: SANDBOX ONLY</span>
            <span>GROUNDING: LIVE NSE/BSE DISCLOSURES</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
