import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Activity, Search, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface StockMoverRecord {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  changeRs: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  indexUniverse: "Nifty 50" | "Nifty 200" | "Nifty 500";
  updatedAt: number;
}

interface MarketMoversProps {
  onSelectCompany?: (symbol: string) => void;
  onSelectStock?: (query: string) => void;
  onSelectNews?: (symbol: string) => void;
}

type TabType = "gainers" | "losers";
type UniverseType = "Nifty 50" | "Nifty 200" | "Nifty 500";
type LimitType = 10 | 25 | 50 | "All";

export default function MarketMovers({
  onSelectCompany,
  onSelectStock,
  onSelectNews
}: MarketMoversProps) {
  const [universe, setUniverse] = useState<UniverseType>("Nifty 50");
  const [tab, setTab] = useState<TabType>("gainers");
  const [limit, setLimit] = useState<LimitType>(25);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const [stocks, setStocks] = useState<StockMoverRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch live market movers from server Yahoo Finance engine
  const fetchMovers = useCallback(async (isManual: boolean = false) => {
    if (isManual) setIsRefreshing(true);
    else if (stocks.length === 0) setLoading(true);

    try {
      const res = await fetch(`/api/market/movers?universe=${encodeURIComponent(universe)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      
      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("Server returned non-JSON response (possibly HTML)");
      }

      if (data && data.success && Array.isArray(data.stocks)) {
        setStocks(data.stocks);
        setIsMarketOpen(Boolean(data.isMarketOpen));
        setLastUpdated(new Date());
        setErrorMsg(null);
      } else {
        throw new Error(data?.error || "Invalid response format from market movers server");
      }
    } catch (err: any) {
      console.warn("[MarketMovers] Temporary feed connection issue, retrying:", err?.message || err);
      if (stocks.length === 0) {
        setErrorMsg("Connecting to market data feed...");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [universe, stocks.length]);

  // Initial fetch and auto-refresh timer (30s during market hours, 300s outside)
  useEffect(() => {
    fetchMovers();

    const intervalMs = isMarketOpen ? 30000 : 300000;
    const timer = setInterval(() => {
      fetchMovers();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [fetchMovers, isMarketOpen]);

  // Tab & Search filtered + sorted constituents for selected Universe
  const displayedStocks = useMemo(() => {
    let list = [...stocks];

    // Filter by search query if typed
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }

    // Tab Sort
    if (tab === "gainers") {
      list.sort((a, b) => b.changePct - a.changePct);
    } else {
      list.sort((a, b) => a.changePct - b.changePct);
    }

    // Limit cut & unique key safety
    const uniqueList: StockMoverRecord[] = [];
    const seenSymbols = new Set<string>();
    for (const item of list) {
      if (!seenSymbols.has(item.symbol)) {
        seenSymbols.add(item.symbol);
        uniqueList.push(item);
      }
    }

    if (limit !== "All" && typeof limit === "number") {
      return uniqueList.slice(0, limit);
    }

    return uniqueList;
  }, [stocks, tab, searchQuery, limit]);

  const handleStockClick = (symbol: string) => {
    if (onSelectCompany) {
      onSelectCompany(symbol);
    } else if (onSelectStock) {
      onSelectStock(symbol);
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 shadow-xl flex flex-col gap-4 text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <Activity className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-slate-100">Market Movers</h2>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isMarketOpen 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                {isMarketOpen ? "LIVE NSE" : "OFF-MARKET"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Official index universe ranked by live % gain and loss
            </p>
          </div>
        </div>

        {/* RIGHT CONTROLS: UNIVERSE PILLS & REFRESH */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Universe Selector Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(["Nifty 50", "Nifty 200", "Nifty 500"] as UniverseType[]).map((u) => (
              <button
                key={u}
                onClick={() => setUniverse(u)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  universe === u
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchMovers(true)}
            disabled={isRefreshing}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/60 disabled:opacity-50"
            title="Refresh Live Market Data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* FILTER & TAB BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
        {/* GAINERS / LOSERS TABS */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab("gainers")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === "gainers"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Top Gainers
          </button>

          <button
            onClick={() => setTab("losers")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === "losers"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Top Losers
          </button>
        </div>

        {/* SEARCH & ROW LIMIT CONTROLS */}
        <div className="flex items-center gap-2">
          {/* Search Field */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Row Count Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {([10, 25, 50, "All"] as LimitType[]).map((l) => (
              <button
                key={String(l)}
                onClick={() => setLimit(l)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                  limit === l
                    ? "bg-slate-800 text-indigo-400"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ERROR / WARNING ALERT */}
      {errorMsg && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => fetchMovers(true)} className="underline hover:text-amber-200 font-semibold">
            Retry Now
          </button>
        </div>
      )}

      {/* MARKET TABLE */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3">Stock</th>
              <th className="py-2.5 px-3 text-right">LTP (₹)</th>
              <th className="py-2.5 px-3 text-right">% Change</th>
              <th className="py-2.5 px-3 text-right">₹ Change</th>
              <th className="py-2.5 px-3 text-right">Day High</th>
              <th className="py-2.5 px-3 text-right">Day Low</th>
              <th className="py-2.5 px-3 text-right">52W High</th>
              <th className="py-2.5 px-3 text-right">52W Low</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                    <span>Fetching live Yahoo Finance constituents for {universe}...</span>
                  </div>
                </td>
              </tr>
            ) : displayedStocks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                  No stocks match the query for {universe}.
                </td>
              </tr>
            ) : (
              displayedStocks.map((stock, idx) => {
                const isPositive = stock.changePct >= 0;
                return (
                  <tr
                    key={`${stock.symbol}-${idx}`}
                    onClick={() => handleStockClick(stock.symbol)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* COMPANY & SYMBOL */}
                    <td className="py-2.5 px-3 font-sans">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[180px]" title={stock.name}>
                          {stock.name}
                        </span>
                      </div>
                    </td>

                    {/* LTP */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-100">
                      ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* % CHANGE */}
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        isPositive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {isPositive ? "+" : ""}{stock.changePct.toFixed(2)}%
                      </span>
                    </td>

                    {/* ₹ CHANGE */}
                    <td className={`py-2.5 px-3 text-right font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                      {isPositive ? "+₹" : "-₹"}{Math.abs(stock.changeRs).toFixed(2)}
                    </td>

                    {/* DAY HIGH */}
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      ₹{stock.dayHigh.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* DAY LOW */}
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      ₹{stock.dayLow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* 52W HIGH */}
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      ₹{stock.fiftyTwoWeekHigh.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* 52W LOW */}
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      ₹{stock.fiftyTwoWeekLow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER METADATA */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 gap-2">
        <span>
          Universe: <strong className="text-slate-300">{universe}</strong> ({displayedStocks.length} stocks shown)
        </span>
        {lastUpdated && (
          <span>
            Last updated: <strong className="text-slate-400">{lastUpdated.toLocaleTimeString()}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
