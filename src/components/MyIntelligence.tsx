import React, { useState, useEffect } from "react";
import { 
  User, 
  Star, 
  Bell, 
  TrendingUp, 
  ShieldAlert, 
  Zap, 
  Calendar, 
  Bookmark, 
  ChevronRight, 
  Settings,
  Activity,
  Briefcase,
  History,
  LayoutDashboard,
  Search,
  Eye,
  Trash2,
  Pin,
  PinOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Watchlist, 
  PersonalAlert, 
  DailyBriefing, 
  SavedResearch,
  UserPreferences
} from "../types";
import { WatchlistService } from "../services/WatchlistService";
import { PersonalIntelligenceService } from "../services/PersonalIntelligenceService";
import { ResearchService } from "../services/ResearchService";
import { MarketStoryEngine } from "../services/MarketStoryEngine";
import { useLiveMarket } from "../hooks/useLiveMarket";

interface MyIntelligenceProps {
  onSelectCompany: (symbol: string) => void;
  onViewResearch: (research: SavedResearch) => void;
  developerMode?: boolean;
  initialTab?: "overview" | "watchlist" | "research" | "alerts";
}

export default function MyIntelligence({ onSelectCompany, onViewResearch, developerMode, initialTab }: MyIntelligenceProps) {
  const watchlistService = WatchlistService.getInstance();
  const personalService = PersonalIntelligenceService.getInstance();
  const researchService = ResearchService.getInstance();
  const storyEngine = MarketStoryEngine.getInstance();

  const [watchlists, setWatchlists] = useState<Watchlist[]>(watchlistService.getWatchlists());
  const [activeWatchlistId, setActiveWatchlistId] = useState(watchlists[0]?.id || "default");
  const [alerts, setAlerts] = useState<PersonalAlert[]>(personalService.getAlerts());
  const [briefing, setBriefing] = useState<DailyBriefing>({
    date: new Date().toDateString(),
    mood: "Loading...",
    topStoryId: "",
    watchlistUpdates: [],
    biggestOpportunity: "Analyzing...",
    biggestRisk: "Analyzing...",
    eventsToday: []
  });
  const [bookmarks, setBookmarks] = useState<SavedResearch[]>(researchService.getBookmarks());
  const [preferences, setPreferences] = useState<UserPreferences>(personalService.getPreferences());
  
  const [activeTab, setActiveTab] = useState<"overview" | "watchlist" | "research" | "alerts">(initialTab || "overview");

  useEffect(() => {
    const fetchBriefing = async () => {
      const data = await personalService.getDailyBriefing();
      setBriefing(data);
    };
    fetchBriefing();

    // Basic polling or subscription logic could go here
    const interval = setInterval(() => {
      setWatchlists(watchlistService.getWatchlists());
      setAlerts(personalService.getAlerts());
      setBookmarks(researchService.getBookmarks());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];
  const watchlistSymbols = activeWatchlist?.items.map(item => item.symbol) || [];
  const { stocks: liveWatchlistStocks } = useLiveMarket(watchlistSymbols, "watchlist");

  return (
    <div className="flex flex-col gap-6 p-6 pb-20">
      {/* Header with Greeting & Daily Briefing Summary */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              Good Morning, User
              <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
                {briefing.mood}
              </span>
            </h1>
            <p className="text-slate-400 text-sm">Your intelligence briefing for {briefing.date}</p>
          </div>
          <div className="flex items-center gap-2">
             {developerMode && (
               <div className="flex flex-col items-end mr-4">
                  <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">Dev: Pers. Score</span>
                  <span className="text-xs font-mono text-white">85.4%</span>
               </div>
             )}
             <button className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
               <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Daily Highlights Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <Zap className="w-4 h-4" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Top Opportunity</span>
            </div>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              {briefing.biggestOpportunity}
            </p>
          </div>
          <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Major Risk</span>
            </div>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              {briefing.biggestRisk}
            </p>
          </div>
          <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Calendar className="w-4 h-4" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Key Events Today</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {briefing.eventsToday.slice(0, 2).map((event, idx) => (
                <li key={idx} className="text-xs text-slate-400 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  {event}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900 w-fit">
        {[
          { id: "overview", label: "Overview", icon: LayoutDashboard },
          { id: "watchlist", label: "Watchlist", icon: Briefcase },
          { id: "research", label: "Saved Research", icon: Bookmark },
          { id: "alerts", label: "Alerts", icon: Bell }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? "bg-slate-900 text-white shadow-lg border border-slate-800" 
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Watchlist Preview */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-400" />
                  Primary Watchlist
                </h3>
                <button onClick={() => setActiveTab("watchlist")} className="text-xs text-indigo-400 hover:underline">View All</button>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase">Symbol</th>
                      <th className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase">Change</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeWatchlist?.items.slice(0, 4).map(item => {
                      const stockInfo = liveWatchlistStocks.find(s => s.symbol === item.symbol);
                      const isUp = stockInfo ? stockInfo.changePercent >= 0 : true;
                      return (
                        <tr key={item.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer" onClick={() => onSelectCompany(item.symbol)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">{item.symbol}</span>
                              {item.isPinned && <Pin className="w-3 h-3 text-indigo-400 fill-indigo-400" />}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {stockInfo ? `₹${stockInfo.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "Loading..."}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {stockInfo ? (
                              <span className={`text-[11px] font-mono font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                                {isUp ? "+" : ""}{stockInfo.changePercent.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Alerts Preview */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-400" />
                  Recent Alerts
                </h3>
                <button onClick={() => setActiveTab("alerts")} className="text-xs text-rose-400 hover:underline">Clear All</button>
              </div>
              <div className="flex flex-col gap-3">
                {alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className={`p-4 rounded-2xl border transition-all ${alert.isRead ? "bg-slate-900/50 border-slate-800" : "bg-indigo-500/5 border-indigo-500/20 shadow-lg shadow-indigo-500/5"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                            alert.severity === "High" ? "bg-rose-500/20 text-rose-400" : "bg-indigo-500/20 text-indigo-400"
                          }`}>
                            {alert.type}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm font-bold text-white">{alert.title}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{alert.message || alert.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "watchlist" && (
          <div className="flex flex-col gap-6">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                 {watchlists.map(w => (
                   <button 
                     key={w.id} 
                     onClick={() => setActiveWatchlistId(w.id)}
                     className={`text-sm font-medium transition-all px-4 py-1.5 rounded-full ${
                       activeWatchlistId === w.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-white bg-slate-900 border border-slate-800"
                     }`}
                   >
                     {w.name}
                   </button>
                 ))}
                 <button className="p-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-colors">
                   <Zap className="w-4 h-4" />
                 </button>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {activeWatchlist?.items.map(item => {
                  const stockInfo = liveWatchlistStocks.find(s => s.symbol === item.symbol);
                  const isUp = stockInfo ? stockInfo.changePercent >= 0 : true;
                  return (
                 <div key={item.symbol} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all group">
                   <div className="flex items-start justify-between mb-4">
                     <div className="flex flex-col">
                       <h4 className="text-lg font-mono font-bold text-white tracking-tighter">{item.symbol}</h4>
                       <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">{liveWatchlistStocks.find(s => s.symbol === item.symbol)?.name || "Market Entity"}</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <button 
                        onClick={() => watchlistService.togglePin(activeWatchlistId, item.symbol)}
                        className={`p-2 rounded-xl transition-colors ${item.isPinned ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-950 text-slate-600 hover:text-slate-400"}`}
                       >
                         {item.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                       </button>
                       <button 
                        onClick={() => watchlistService.removeFromWatchlist(activeWatchlistId, item.symbol)}
                        className="p-2 rounded-xl bg-slate-950 text-slate-600 hover:text-rose-400 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   </div>

                   <div className="flex flex-col gap-3">
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Confidence</span>
                        <span className="text-emerald-400 font-mono font-bold">89.2%</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: "89.2%" }} />
                     </div>
                     <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-400 font-mono">STABLE</span>
                        <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-400 font-mono">BULLISH</span>
                     </div>
                   </div>
                 </div>
                )})}
               
               <button className="border-2 border-dashed border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-indigo-400 hover:border-indigo-400/50 hover:bg-indigo-400/5 transition-all min-h-[160px]">
                 <Search className="w-6 h-6" />
                 <span className="text-xs font-bold uppercase tracking-wider">Add to Watchlist</span>
               </button>
             </div>
          </div>
        )}

        {activeTab === "research" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {bookmarks.map(bookmark => (
              <div key={bookmark.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:bg-slate-800/50 transition-all flex flex-col gap-4 group">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl ${
                    bookmark.type === "Search" ? "bg-indigo-500/10 text-indigo-400" : 
                    bookmark.type === "Report" ? "bg-emerald-500/10 text-emerald-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>
                    {bookmark.type === "Search" ? <Search className="w-4 h-4" /> : 
                     bookmark.type === "Report" ? <TrendingUp className="w-4 h-4" /> : 
                     <Activity className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(bookmark.savedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-bold text-white line-clamp-2">{bookmark.title}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">{bookmark.type}</p>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <button className="flex-1 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-all flex items-center justify-center gap-2">
                    <Eye className="w-3 h-3" />
                    OPEN
                  </button>
                  <button onClick={() => researchService.removeResearch(bookmark.id)} className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-600 hover:text-rose-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {bookmarks.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-600 border-2 border-dashed border-slate-900 rounded-3xl">
                <Bookmark className="w-12 h-12 opacity-20" />
                <p className="text-sm font-medium">No saved research found</p>
                <p className="text-xs max-w-xs text-center opacity-50">Bookmark search queries, company pages, and market stories to see them here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="flex flex-col gap-4 max-w-3xl mx-auto">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-5 rounded-3xl border transition-all ${alert.isRead ? "bg-slate-900/50 border-slate-800" : "bg-indigo-500/5 border-indigo-500/20 ring-1 ring-indigo-500/20"}`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-2xl ${
                    alert.severity === "High" ? "bg-rose-500/10 text-rose-400" : 
                    alert.severity === "Medium" ? "bg-amber-500/10 text-amber-400" : 
                    "bg-indigo-500/10 text-indigo-400"
                  }`}>
                    {alert.type === "Story Change" ? <Activity className="w-5 h-5" /> : 
                     alert.type === "Institutional" ? <TrendingUp className="w-5 h-5" /> : 
                     <ShieldAlert className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">{alert.type}</span>
                         {alert.symbol && <span className="text-[10px] font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-white">{alert.symbol}</span>}
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono">{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                    <h4 className="text-base font-bold text-white">{alert.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{alert.message || alert.description}</p>
                    <div className="flex items-center gap-3 mt-4">
                       <button 
                        onClick={() => personalService.markAsRead(alert.id)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                       >
                         MARK AS READ
                       </button>
                       <div className="w-1 h-1 rounded-full bg-slate-800" />
                       <button className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                         INVESTIGATE EVIDENCE
                         <ChevronRight className="w-3 h-3" />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
