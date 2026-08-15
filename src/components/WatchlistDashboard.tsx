import React, { useState, useEffect, useMemo } from "react";
import { Star, TrendingUp, TrendingDown, Activity, ChevronRight, Trash2, Search, Plus, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserPreferenceService } from "../services/UserPreferenceService";
import { CompanyKnowledgeService } from "../services/CompanyKnowledgeService";
import { useLiveMarket } from "../hooks/useLiveMarket";
import { UserCompanyPreference } from "../types";
import { getHumanMarketName, MASTER_MARKET_ITEMS, searchMarketDefinitions } from "../lib/marketUtils";

import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";
import { CompanyDeduplicationEngine } from "../lib/CompanyDeduplicationEngine";

interface WatchlistDashboardProps {
  onSelectCompany: (symbol: string) => void;
  onSelectNewsQuery?: (query: string) => void;
}

export default function WatchlistDashboard({ onSelectCompany, onSelectNewsQuery }: WatchlistDashboardProps) {
  const prefService = UserPreferenceService.getInstance();
  const identityResolver = CompanyIdentityResolver.getInstance();
  const deduplicationEngine = CompanyDeduplicationEngine.getInstance();
  const [watchlist, setWatchlist] = useState<UserCompanyPreference[]>([]);
  
  const watchlistSymbols = useMemo(() => watchlist.map(p => p.symbol), [watchlist]);
  const { stocks: liveStocks, indices: liveIndices } = useLiveMarket(watchlistSymbols, "watchlist");
  
  const [watchlistIntelligence, setWatchlistIntelligence] = useState<any[]>([]);
  const [symbolToRemove, setSymbolToRemove] = useState<string | null>(null);
  
  // Search state to add assets to Watchlist
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    prefService.getWatchlist().then(setWatchlist);
  }, []);

  useEffect(() => {
    // Generate intelligence for each followed company / symbol
    const intel = watchlistSymbols.map(symbol => {
      return CompanyKnowledgeService.getInstance().getCompanyKnowledge(symbol);
    }).filter(Boolean);
    setWatchlistIntelligence(intel);
  }, [watchlistSymbols.join(",")]);

  const handleRemove = async (companyId: string) => {
    await prefService.removeFromWatchlist(companyId);
    setWatchlist(await prefService.getWatchlist());
    setSymbolToRemove(null);
  };

  const handleAddSymbol = async (symbol: string, companyId?: string) => {
    const id = companyId || symbol;
    await prefService.addToWatchlist(id, symbol);
    setWatchlist(await prefService.getWatchlist());
    setShowAddModal(false);
    setSearchQuery("");
  };

  // SVG Sparkline
  const renderSparkline = (isUp: boolean, price: number, high: number, low: number) => {
    const p = price || 100;
    const h = high || p * 1.01;
    const l = low || p * 0.99;
    const range = h - l || 1;
    const normPrice = ((p - l) / range) * 20;

    const points = isUp 
      ? `0,24 8,18 16,21 24,12 32,15 40,8 48,14 56,${28 - normPrice}`
      : `0,6 8,12 16,9 24,18 32,15 40,22 48,19 56,${28 - normPrice}`;

    return (
      <svg className="w-16 h-7 overflow-visible" viewBox="0 0 56 28">
        <path
          d={`M ${points}`}
          fill="none"
          stroke={isUp ? "#10b981" : "#f43f5e"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Search results for adding to watchlist
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const marketMatches = searchMarketDefinitions(searchQuery);
    
    // Use CompanyDeduplicationEngine to get active canonical equity results
    const canonicalStocks = deduplicationEngine.filterSearchResults(searchQuery).map(c => ({
      symbol: c.canonicalSymbol,
      name: c.officialName,
      category: "Stocks",
      type: "stock"
    }));

    // Combine and deduplicate
    const combined = [...marketMatches, ...canonicalStocks];
    return deduplicationEngine.deduplicateList(combined, item => item.symbol);
  }, [searchQuery]);

  return (
    <div className="flex flex-col gap-6 pb-10 animate-in fade-in duration-200 text-left">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
        <div className="flex flex-col gap-1">
          <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400" />
            Watchlist
          </h2>
          <p className="text-xs text-slate-400">Track saved stocks, indices, crypto, forex and commodities in real-time.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Asset</span>
        </button>
      </div>

      {/* Confirmation Modal for Removal */}
      <AnimatePresence>
        {symbolToRemove && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4"
          >
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h3 className="text-lg font-bold text-white">Remove {getHumanMarketName(symbolToRemove)}?</h3>
                <p className="text-xs text-slate-400">You will no longer receive price tracking and alerts for this asset.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSymbolToRemove(null)} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors text-xs">
                  Cancel
                </button>
                <button onClick={() => handleRemove(symbolToRemove)} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors text-xs">
                  Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              Add to Watchlist
            </h2>
            <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 max-w-xl mx-auto w-full flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Gold, Nifty 50, Bitcoin, Reliance, USDINR, KOSPI..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto custom-scrollbar border border-slate-800 rounded-2xl p-2 bg-slate-900/40">
              {!searchQuery.trim() ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Type an asset name (e.g. Gold, Bitcoin, Nifty, Infosys, Copper) to add to your watchlist.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No matching assets found.
                </div>
              ) : (
                searchResults.map(item => {
                  const isAlreadyAdded = watchlist.some(w => w.symbol === item.symbol || w.companyId === item.symbol);
                  const displayName = getHumanMarketName(item.symbol, item.name);

                  return (
                    <div key={item.symbol} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800/80">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{displayName}</span>
                        <span className="text-[10px] text-slate-500">{item.category} • {item.symbol}</span>
                      </div>

                      <button
                        onClick={() => handleAddSymbol(item.symbol, item.symbol)}
                        disabled={isAlreadyAdded}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isAlreadyAdded
                            ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-500"
                        }`}
                      >
                        {isAlreadyAdded ? "Saved ✓" : "+ Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Watchlist Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {watchlist.length === 0 ? (
          <div className="col-span-full border-2 border-dashed border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-center bg-slate-900/20">
            <Search className="w-10 h-10 text-slate-600" />
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-white text-base">Your watchlist is empty</h3>
              <p className="text-xs text-slate-400 max-w-xs">Search for stocks, indices, crypto, forex, or commodities to track them in real-time.</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors"
            >
              + Add Assets Now
            </button>
          </div>
        ) : (
          watchlist.map(pref => {
            const stockInfo = liveStocks.find(s => s.symbol === pref.symbol);
            const indexInfo = liveIndices.find(i => i.symbol === pref.symbol || i.name === pref.symbol);
            const intel = watchlistIntelligence.find(i => i.symbol === pref.symbol);

            const liveData = stockInfo || indexInfo;
            const price = liveData?.price || 0;
            const changePct = liveData?.changePercent || 0;
            const high = (liveData as any)?.high || price * 1.008;
            const low = (liveData as any)?.low || price * 0.992;
            const isUp = changePct >= 0;

            const displayName = getHumanMarketName(pref.symbol, intel?.name || (liveData as any)?.name);
            const newsCount = intel?.relatedArticles?.length || 3;

            return (
              <div 
                key={pref.companyId} 
                className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between gap-4 hover:border-slate-700 transition-all shadow-md group"
              >
                {/* Header: Name, Symbol, Remove Button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg font-bold text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                      {pref.symbol}
                    </span>
                  </div>

                  <button
                    onClick={() => setSymbolToRemove(pref.companyId)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Remove from Watchlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Middle: Price, Change %, Sparkline */}
                <div className="flex items-center justify-between border-y border-slate-800/60 py-3">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-white font-display">
                      {price > 0 ? price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "--"}
                    </span>
                    <span className={`text-xs font-bold font-mono flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {isUp ? "+" : ""}{changePct.toFixed(2)}%
                    </span>
                  </div>

                  {/* Sparkline chart */}
                  <div className="flex-shrink-0">
                    {renderSparkline(isUp, price, high, low)}
                  </div>
                </div>

                {/* High/Low & News Count Footer */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span>H: <strong className="text-slate-300">{high > 0 ? high.toFixed(2) : "--"}</strong></span>
                    <span>L: <strong className="text-slate-300">{low > 0 ? low.toFixed(2) : "--"}</strong></span>
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectNewsQuery) {
                        onSelectNewsQuery(`Latest news and developments for ${displayName}`);
                      } else {
                        onSelectCompany(pref.symbol);
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{newsCount} news articles</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
