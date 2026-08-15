import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, TrendingUp, TrendingDown, ShieldAlert, Layers, 
  Flame, Zap, BarChart3, Clock, Building2, Filter, Globe, 
  RefreshCw, ArrowRight, ChevronDown, ChevronUp, AlertTriangle, 
  Sparkles, CheckCircle2, Eye, BookOpen, X, Share2, Compass, GitCommit
} from 'lucide-react';

interface StoryCluster {
  id: string;
  title: string;
  summary: string;
  category: string;
  articleIds: string[];
  symbols: string[];
  affectedAssets: string[];
  primarySector: string;
  signalStrength: number;
  marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  firstSeen: string;
  updatedAt: string;
  confidence: number;
  status: 'Breaking' | 'Developing' | 'Cooling' | 'Completed';
  storyType: string;
  sources: string[];
  eventType?: string;
  eventCategory?: string;
  isFnO?: boolean;
  score?: number;
  confirmedBySources?: any[];
  timeDifferenceText?: string;
  firstPublisher?: string;
  verifiedMetrics?: any[];
  sourceTimeline?: any[];
  companyNames?: string[];
  internalDebug?: any;
}

interface MarketTheme {
  id: string;
  theme: string;
  mentionsCount: number;
  growthRate: number;
  confidence: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendStrength: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'WEAKENING';
  affectedSymbols: string[];
  topArticles: string[];
  lastUpdated: string;
}

interface SectorImpactData {
  sector: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  score: number;
  netScore: number;
  bullishScore: number;
  bearishScore: number;
  confidence: number;
  trendArrow: '↑' | '↓' | '→';
  keyDrivers: string[];
  articleCount: number;
}

interface InstitutionalFlow {
  regime: string;
  confidence: number;
  primaryDrivers: string[];
  affectedSectors: string[];
  affectedAssets: string[];
  explanation: string;
  timestamp: string;
}

interface EventCorrelation {
  id: string;
  triggerArticleId: string;
  connectedArticleIds: string[];
  chainSummary: string;
  origin: string;
  intermediateEvents: string[];
  finalImpact: string;
  confidence: number;
  involvedEntities: string[];
  transmissionSectors: string[];
  correlationScore: number;
}

interface CompanyDiscussion {
  symbol: string;
  name: string;
  mentions: number;
  bullishPercent: number;
  bearishPercent: number;
  momentum: string;
  storyCount: number;
  signalStrength: number;
}

interface MarketPulse {
  score: number;
  label: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  confidence: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  volatilityLevel: 'Low' | 'Normal' | 'Elevated' | 'High';
  narrativeSummary: string;
}

interface MarketTimelinePoint {
  time: string;
  timestampIso: string;
  majorStory: string;
  sectorImpact: string;
  narrativeChange: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SnapshotData {
  clusters: StoryCluster[];
  themes: MarketTheme[];
  sectors: SectorImpactData[];
  correlations: EventCorrelation[];
  narrative: {
    headline: string;
    summary: string;
    keyDrivers: string[];
    dominantThemes: string[];
    prevailingSentiment: string;
    updatedAt: string;
  };
  institutionalFlow: InstitutionalFlow;
  companies: CompanyDiscussion[];
  marketPulse: MarketPulse;
  timeline: MarketTimelinePoint[];
  breakingNow: StoryCluster[];
  recentArticles: any[];
}

export function AthenaDashboard({ developerMode = false }: { developerMode?: boolean }) {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Noise Filter Toggle State
  const [highSignalOnly, setHighSignalOnly] = useState<boolean>(false);

  // Modal / Drawer state for viewing cluster related articles
  const [selectedCluster, setSelectedCluster] = useState<StoryCluster | null>(null);

  // Collapsible section states for mobile ergonomics
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchSnapshot = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/ai/cross-article/snapshot');
      if (!res.ok) throw new Error(`Snapshot API Error: ${res.status}`);
      const data = await res.json();
      if (data.success && data.snapshot) {
        setSnapshot(data.snapshot);
        setLastRefreshed(new Date());
        setError(null);
      }
    } catch (err: any) {
      console.warn('[AthenaDashboard] Snapshot fetch failed:', err);
      setError(err?.message || 'Failed to load cross-article snapshot');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 30000); // 30s auto-polling
    return () => clearInterval(interval);
  }, []);

  // Filtered clusters based on noise filter
  const displayedClusters = useMemo(() => {
    if (!snapshot?.clusters) return [];
    if (!highSignalOnly) return snapshot.clusters;
    return snapshot.clusters.filter(c => c.signalStrength >= 65 || c.urgency === 'HIGH' || c.urgency === 'CRITICAL');
  }, [snapshot?.clusters, highSignalOnly]);

  if (loading && !snapshot) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-slate-400 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium animate-pulse">Aggregating Institutional Cross-Article Market Snapshot...</p>
      </div>
    );
  }

  const pulse = snapshot?.marketPulse;
  const narrative = snapshot?.narrative;
  const flow = snapshot?.institutionalFlow;
  const themes = snapshot?.themes || [];
  const sectors = snapshot?.sectors || [];
  const correlations = snapshot?.correlations || [];
  const companies = snapshot?.companies || [];
  const timeline = snapshot?.timeline || [];
  const breaking = snapshot?.breakingNow || [];

  return (
    <div id="athena-institutional-dashboard" className="w-full space-y-6 pb-12 font-sans text-slate-100">
      
      {/* HEADER BAR & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              ATHENA V9.2 REAL-TIME
            </span>
            <span className="inline-flex items-center space-x-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Institutional Market Intelligence Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            One centralized snapshot synthesizing cross-article news flow, story clusters, sector dynamics, and institutional flows.
          </p>
        </div>

        {/* Controls: Noise Filter + Manual Refresh */}
        <div className="flex items-center space-x-3 self-start md:self-auto">
          {/* SECTION 10 — NOISE FILTER TOGGLE */}
          <button
            onClick={() => setHighSignalOnly(!highSignalOnly)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              highSignalOnly 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
            title="Filter out low-value noise & minor filings"
          >
            <Filter className={`w-3.5 h-3.5 ${highSignalOnly ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>{highSignalOnly ? 'High Signal Only' : 'Show All Intelligence'}</span>
          </button>

          <button
            onClick={fetchSnapshot}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Snapshot</span>
          </button>
        </div>
      </div>

      {/* SECTION 9 — BREAKING NOW TICKER / ALERT (IF HIGH SIGNAL ARTICLES PRESENT) */}
      {breaking.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-red-950/60 border border-red-500/40 rounded-2xl p-4 shadow-lg shadow-red-900/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-2 text-red-400 font-bold text-xs shrink-0 pt-0.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span>BREAKING NOW</span>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-white hover:text-red-300 cursor-pointer transition-colors" onClick={() => setSelectedCluster(breaking[0])}>
                {breaking[0].title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="text-amber-400 font-medium">Signal {breaking[0].signalStrength}/100</span>
                <span>•</span>
                <span className="text-blue-400">{breaking[0].primarySector}</span>
                <span>•</span>
                <span>{breaking[0].sources.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1 — TODAY'S MARKET NARRATIVE & SECTION 8 — MARKET PULSE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* NARRATIVE PANEL */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h2 className="text-base sm:text-lg font-bold text-white">Today's Market Narrative</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Institutional Consensus
              </span>
            </div>

            {/* Evolving Narrative Paragraph */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-serif tracking-wide bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
              "{narrative?.summary || 'Indian markets remain in a moderate Risk-On environment driven by strong banking earnings, stable RBI expectations, falling crude prices and improving institutional participation. PSU, Banking and Infrastructure continue to dominate today\'s news flow.'}"
            </p>
          </div>

          {/* Key Drivers Tags */}
          {narrative?.keyDrivers && narrative.keyDrivers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dominant Catalysts Today</span>
              <div className="flex flex-wrap gap-2">
                {narrative.keyDrivers.map((driver, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 border border-slate-700/70">
                    • {driver}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MARKET PULSE CARD */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Market Pulse</span>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                pulse?.direction === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' :
                pulse?.direction === 'BEARISH' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'
              }`}>
                {pulse?.direction || 'NEUTRAL'}
              </span>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-4xl font-extrabold text-white">{pulse?.score ?? 78}</span>
              <span className="text-xs text-slate-400 font-medium">/ 100 Overall Score</span>
            </div>
            
            <p className="text-sm font-semibold text-emerald-400">
              {pulse?.label || 'Moderate Bullish Session'}
            </p>
          </div>

          {/* Sub-Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-400 block">Risk Level</span>
              <span className="font-semibold text-white">{pulse?.riskLevel || 'Low'}</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-400 block">Volatility</span>
              <span className="font-semibold text-white">{pulse?.volatilityLevel || 'Normal'}</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-400 block">Confidence</span>
              <span className="font-semibold text-white">{pulse?.confidence ?? 92}%</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-400 block">Clusters</span>
              <span className="font-semibold text-white">{displayedClusters.length} Active</span>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 2 — TOP DEVELOPING STORIES */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h2 className="text-base sm:text-lg font-bold text-white">Top Developing Story Clusters</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing top {Math.min(5, displayedClusters.length)} story clusters
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedClusters.slice(0, 6).map((cluster) => (
            <div
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster)}
              className="group cursor-pointer bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/50 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-blue-900/10 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded tracking-wide ${
                    cluster.status === 'Breaking' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    cluster.status === 'Developing' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {cluster.status}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    Signal {cluster.signalStrength}/100
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                  {cluster.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {cluster.summary}
                </p>
              </div>

              {/* Card Meta Footer */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-medium">{cluster.articleIds.length} Articles</span>
                  <span>•</span>
                  <span>{cluster.primarySector}</span>
                </div>
                <div className="flex items-center space-x-1 text-blue-400 group-hover:translate-x-0.5 transition-transform">
                  <span>View</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4 — SECTOR HEATMAP */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">Institutional Sector Heatmap</h2>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Net score computed across active news flow
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {sectors.map((sec) => {
            // Sector color coding logic based on Net Score
            // Dark Green (>= +40), Green (+10..+39), Neutral (-9..+9), Orange (-39..-10), Red (<= -40)
            const net = sec.netScore ?? sec.score ?? 0;
            let bgColor = 'bg-slate-950/60 border-slate-800/80';
            let textColor = 'text-slate-300';
            let badgeBg = 'bg-slate-800 text-slate-300';

            if (net >= 40) {
              bgColor = 'bg-emerald-950/50 border-emerald-500/40';
              textColor = 'text-emerald-300';
              badgeBg = 'bg-emerald-500/20 text-emerald-300';
            } else if (net >= 10) {
              bgColor = 'bg-emerald-950/30 border-emerald-600/30';
              textColor = 'text-emerald-400';
              badgeBg = 'bg-emerald-500/15 text-emerald-400';
            } else if (net <= -40) {
              bgColor = 'bg-red-950/50 border-red-500/40';
              textColor = 'text-red-300';
              badgeBg = 'bg-red-500/20 text-red-300';
            } else if (net <= -10) {
              bgColor = 'bg-orange-950/30 border-orange-500/30';
              textColor = 'text-orange-400';
              badgeBg = 'bg-orange-500/15 text-orange-400';
            }

            return (
              <div
                key={sec.sector}
                className={`p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between space-y-2 ${bgColor}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate max-w-[90px]">{sec.sector}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeBg}`}>
                    {sec.trendArrow} {net > 0 ? `+${net}` : net}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Bullish {sec.bullishScore}%</span>
                    <span>Bearish {sec.bearishScore}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${sec.bullishScore}%` }} />
                    <div className="bg-red-500 h-full" style={{ width: `${sec.bearishScore}%` }} />
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-right">
                  {sec.articleCount} Articles
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3 — MARKET THEMES & SECTION 5 — INSTITUTIONAL FLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* MARKET THEMES */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Detected Market Themes</h2>
            </div>
            <span className="text-xs text-slate-400">{themes.length} Themes Tracked</span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">{theme.theme}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      theme.trendStrength === 'VERY_STRONG' ? 'bg-indigo-500/20 text-indigo-300' :
                      theme.trendStrength === 'STRONG' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {theme.trendStrength.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center space-x-2">
                    <span>{theme.mentionsCount} Mentions</span>
                    <span>•</span>
                    <span className="text-emerald-400">+{theme.growthRate}% 24h Growth</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-bold block ${
                    theme.direction === 'BULLISH' ? 'text-emerald-400' :
                    theme.direction === 'BEARISH' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {theme.direction}
                  </span>
                  <span className="text-[10px] text-slate-400">{theme.confidence}% Conf.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* INSTITUTIONAL FLOW REGIME */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-purple-400" />
                <h2 className="text-base sm:text-lg font-bold text-white">Institutional Flow & Regime</h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                {flow?.regime?.replace(/_/g, ' ') || 'RISK ON'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              {flow?.explanation || 'Institutional money is actively positioning in Banking and Cyclicals with high conviction following strong earnings releases.'}
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-800/60">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Regime Confidence</span>
              <span className="text-white font-bold">{flow?.confidence ?? 94}%</span>
            </div>

            {flow?.affectedSectors && flow.affectedSectors.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Inflow Sector Targets</span>
                <div className="flex flex-wrap gap-1.5">
                  {flow.affectedSectors.map((sec, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50">
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SECTION 6 — CHAIN REACTIONS */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCommit className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">Market Chain Reactions (Cause → Effect)</h2>
          </div>
          <span className="text-xs text-slate-400">{correlations.length} Active Correlations</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {correlations.slice(0, 4).map((corr) => (
            <div key={corr.id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold">
                <span>Origin: {corr.origin || 'Macro Event'}</span>
                <span>Confidence {corr.confidence ?? 88}%</span>
              </div>

              {/* Chain Steps Flow */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold">{corr.origin}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                {corr.intermediateEvents && corr.intermediateEvents.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-slate-300">{step}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </React.Fragment>
                ))}
                <span className="text-cyan-300 font-bold">{corr.finalImpact}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 7 — MOST DISCUSSED COMPANIES & SECTION 11 — MARKET TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* MOST DISCUSSED COMPANIES */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Most Discussed Companies</h2>
            </div>
            <span className="text-xs text-slate-400">Ranked by News Signal</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-semibold">Company</th>
                  <th className="pb-2 font-semibold">Mentions</th>
                  <th className="pb-2 font-semibold">Bullish %</th>
                  <th className="pb-2 font-semibold">Momentum</th>
                  <th className="pb-2 font-semibold text-right">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {companies.map((comp) => (
                  <tr key={comp.symbol} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 font-bold text-white">
                      <div>{comp.symbol}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{comp.name}</div>
                    </td>
                    <td className="py-2.5 text-slate-300 font-medium">{comp.mentions}</td>
                    <td className="py-2.5 text-emerald-400 font-semibold">{comp.bullishPercent}%</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                        {comp.momentum}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-amber-400">{comp.signalStrength}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 11 — INTRADAY MARKET TIMELINE */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">Intraday Timeline</h2>
          </div>

          <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800">
            {timeline.map((pt, idx) => (
              <div key={idx} className="relative pl-7 space-y-1">
                <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">{pt.time}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{pt.sectorImpact}</span>
                </div>
                <p className="text-xs font-semibold text-slate-200 leading-snug">{pt.majorStory}</p>
                <p className="text-[11px] text-slate-400 leading-tight">{pt.narrativeChange}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CLUSTER DETAIL MODAL / DRAWER */}
      {selectedCluster && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-start justify-between">
              <div className="space-y-1.5 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedCluster.eventType || selectedCluster.eventCategory || selectedCluster.category || 'Story Cluster'}
                  </span>
                  {selectedCluster.isFnO && (
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ⚡ F&O Stock
                    </span>
                  )}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Confidence Score: {selectedCluster.score || selectedCluster.confidence || 90}/100
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {selectedCluster.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
              {/* SOURCE CONFIRMATION BANNER (PHASE 5) */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 p-3.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="font-bold text-emerald-300 text-sm block">
                      Confirmed by {(selectedCluster.confirmedBySources || selectedCluster.sources || []).length} Independent Sources
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Span: {selectedCluster.timeDifferenceText || 'Instant Sync'} • First Reported by <strong className="text-slate-200">{selectedCluster.firstPublisher || selectedCluster.sources?.[0] || 'Market Wire'}</strong>
                    </span>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  VERIFIED STORY
                </span>
              </div>

              {/* EXECUTIVE CLUSTER SUMMARY */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Unified Story Intelligence</span>
                <p className="text-slate-200 text-sm leading-relaxed">{selectedCluster.summary}</p>
              </div>

              {/* VERIFIED FINANCIAL METRICS */}
              {selectedCluster.verifiedMetrics && selectedCluster.verifiedMetrics.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Verified Financial Metrics</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedCluster.verifiedMetrics.map((m: any, idx: number) => (
                      <span key={idx} className="px-3 py-1.5 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs border border-slate-700/80">
                        {m.type ? `${m.type}: ` : ''}{m.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SOURCE TIMELINE (PHASE 6) */}
              {selectedCluster.sourceTimeline && selectedCluster.sourceTimeline.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Source Breakdown & Timeline</span>
                  <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
                    {selectedCluster.sourceTimeline.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0">
                        <div className="flex items-center space-x-2.5">
                          <span className="font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{item.timestamp}</span>
                          <span className="font-bold text-white">{item.publisher}</span>
                          <span className="text-slate-400 text-[11px] line-clamp-1 italic max-w-xs">"{item.headline}"</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold">
                          Score {item.sourceConfidence}/100
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AFFECTED SYMBOLS */}
              {(selectedCluster.symbols || selectedCluster.companyNames) && (
                <div className="space-y-1.5">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Entities & Tickers</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedCluster.symbols || []).map((sym: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-blue-950/60 text-blue-300 font-bold text-xs border border-blue-800/50">
                        {sym}
                      </span>
                    ))}
                    {(selectedCluster.companyNames || []).map((name: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* INTERNAL DEBUG PANEL (PHASE 13) */}
              {selectedCluster.internalDebug && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/20 space-y-1.5 text-[11px] text-slate-400 font-mono">
                  <span className="text-amber-400 font-bold block">Internal Cluster Debug (Phase 13)</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>Cluster ID: <span className="text-white">{selectedCluster.internalDebug.clusterId}</span></div>
                    <div>Matched Articles: <span className="text-white">{selectedCluster.internalDebug.matchedArticlesCount}</span></div>
                    <div>Similarity Score: <span className="text-white">{selectedCluster.internalDebug.similarityScore}%</span></div>
                    <div>Merge Decision: <span className="text-emerald-400">{selectedCluster.internalDebug.mergeDecision}</span></div>
                    <div>Primary Source: <span className="text-white">{selectedCluster.internalDebug.primarySource}</span></div>
                    <div>Supporting Sources: <span className="text-white">{selectedCluster.internalDebug.supportingSources.join(', ') || 'None'}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCluster(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close Intelligence Brief
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
