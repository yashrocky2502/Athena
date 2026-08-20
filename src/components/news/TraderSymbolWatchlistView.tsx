import React, { useState, useEffect } from 'react';
import {
  Search, TrendingUp, TrendingDown, Activity,
  Clock, ShieldAlert, Sparkles, Building2,
  PieChart, ChevronRight, Gauge, AlertCircle
} from 'lucide-react';
import { SymbolIntelligenceSummary, FNOBias, RiskLevel, ImpactDirection } from '../../news/types/TraderIntelligence';
import { TraderImpactEngine } from '../../news/intelligence/TraderImpactEngine';

interface TraderSymbolWatchlistViewProps {
  onSelectArticle: (article: any) => void;
}

const POPULAR_SYMBOLS = ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'NIFTY'];

export function TraderSymbolWatchlistView({ onSelectArticle }: TraderSymbolWatchlistViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [searchInput, setSearchInput] = useState<string>('');
  const [summary, setSummary] = useState<SymbolIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSymbolIntelligence() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v5/news/intelligence/symbol/${selectedSymbol}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.summary) {
            setSummary(data.summary);
            setLoading(false);
            return;
          }
        }
      } catch (err: any) {
        // Fallback to client-side deterministic evaluation
      }

      if (isMounted) {
        try {
          const feedRes = await fetch(`/api/v5/news/category/All?limit=100`);
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            const sum = TraderImpactEngine.generateSymbolSummary(selectedSymbol, feedData.articles || []);
            setSummary(sum);
          }
        } catch (e: any) {
          setError('Failed to compute symbol summary');
        }
        setLoading(false);
      }
    }

    loadSymbolIntelligence();
    return () => {
      isMounted = false;
    };
  }, [selectedSymbol]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSelectedSymbol(searchInput.trim().toUpperCase());
      setSearchInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Symbol Search & Popular Tickers */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              Symbol Intelligence & Watchlist
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated financial sentiment, F&O derivatives bias, and corporate event tracking.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ticker (e.g. TCS)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono uppercase"
            />
          </form>
        </div>

        {/* Quick Ticker Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-semibold text-slate-400 mr-1">Quick Select:</span>
          {POPULAR_SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedSymbol === sym
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol Summary Dashboard */}
      {loading ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono">Aggregating {selectedSymbol} Intelligence...</p>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-xs text-slate-400 block mb-1">Coverage Volume</span>
              <div className="text-2xl font-bold font-mono text-slate-100">{summary.totalArticles} Articles</div>
              <span className="text-[11px] text-slate-500">Across 16 Fixed News Sections</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-xs text-slate-400 block mb-1">Sentiment Breakdown</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                  +{summary.sentimentBreakdown.bullish}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/30 text-rose-400 font-bold text-xs">
                  -{summary.sentimentBreakdown.bearish}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">
                  {summary.sentimentBreakdown.neutral} Neutral
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-xs text-slate-400 block mb-1">Dominant F&O Bias</span>
              <div className="text-base font-bold text-indigo-300">{summary.dominantBias.replace('_', ' ')}</div>
              <span className="text-[11px] text-slate-400">Confidence: {summary.avgConfidence}%</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-xs text-slate-400 block mb-1">IV Volatility Risk</span>
              <div className="text-base font-bold text-amber-400">{summary.dominantIVRisk.replace('_', ' ')}</div>
              <span className="text-[11px] text-slate-400">{summary.isFnoEligible ? 'NSE F&O Listed' : 'Non-F&O'}</span>
            </div>
          </div>

          {/* Recent Articles Stream for Symbol */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Latest Actionable News for {selectedSymbol}
            </h4>

            {summary.recentArticles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No recent articles directly indexed for {selectedSymbol}.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {summary.recentArticles.map((art) => (
                  <div
                    key={art.articleId}
                    onClick={() => onSelectArticle(art)}
                    className="py-3.5 hover:bg-slate-800/40 px-2 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                          {art.eventType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            art.impactDirection === ImpactDirection.BULLISH
                              ? 'bg-emerald-950 text-emerald-400'
                              : art.impactDirection === ImpactDirection.BEARISH
                              ? 'bg-rose-950 text-rose-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {art.impactDirection}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {art.freshnessMinutes}m ago
                        </span>
                      </div>
                      <h5 className="text-sm font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {art.headline}
                      </h5>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <span className="text-xs font-mono text-slate-400">
                        {art.cePeBias.replace('_', ' ')}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
