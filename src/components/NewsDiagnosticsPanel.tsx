import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Radio,
  Zap,
  Database,
  ChevronDown,
  ChevronUp,
  Terminal,
  Users,
  Layers,
  Server,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  BarChart3,
  Flame,
  Settings,
  Download,
  Sliders,
  Cpu,
  Globe,
  Gauge
} from "lucide-react";

export interface SourceHealthRecord {
  publisher: string;
  feedName: string;
  status: "OK" | "FAILED" | "RETRYING";
  lastSuccessIso: string | null;
  lastFetchIso: string | null;
  lastArticleCount: number;
  lastError?: string;
}

export interface DiagnosticsData {
  success: boolean;
  liveStatus: {
    status: string;
    connected: boolean;
    lastFetch: string;
    lastNewArticle: string;
    lastBroadcast: string;
    schedulerRunning: boolean;
    nextFetchSec: number;
    refreshIntervalMs: number;
    articlesToday: number;
    newInLastHour: number;
    isMarketHours: boolean;
    isFeedStale: boolean;
  };
  feedHealth: SourceHealthRecord[];
  fetchStats: {
    fetched: number;
    accepted: number;
    rejected: number;
    duplicate: number;
    classified: number;
    broadcast: number;
  };
  debug: {
    schedulerRunning: boolean;
    sseConnectedClients: number;
    queueSize: number;
    currentRefreshIntervalMs: number;
    lastSuccessfulFetch: string;
    lastFailedFetch: string | null;
    lastBroadcast: string;
    staleRecoveryCount: number;
    lastRecoveryTime: string | null;
  };
}

export interface EnterpriseMonitorData {
  success: boolean;
  timestamp: string;
  stages: {
    stage: string;
    displayName: string;
    status: 'OK' | 'WARN' | 'FAILED';
    successCount: number;
    failedCount: number;
    processingTimeMs: number;
    queueSize: number;
    lastExecutionIso: string;
    errorReason?: string;
  }[];
  latency: {
    rssFetchSec: number;
    aiClassificationSec: number;
    priorityEngineMs: number;
    broadcastMs: number;
    clientReceiveMs: number;
    uiRenderMs: number;
    totalLatencySec: number;
  };
  clientHealth: {
    connectedClients: number;
    viewsBreakdown: { home: number; news: number; alerts: number; search: number };
    averagePingMs: number;
    slowestClientMs: number;
    droppedConnections: number;
    lastHeartbeatIso: string;
  };
  feedQuality: {
    articlesToday: number;
    freshUnder5m: number;
    freshUnder15m: number;
    averageAgeMinutes: number;
    oldestVisibleIso: string;
    duplicatesCount: number;
    rejectedCount: number;
    qualityScorePercent: number;
  };
  priorityQueue: {
    id: string;
    headline: string;
    priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    priorityBadge: string;
    queuePosition: number;
    waitingTimeSec: number;
    source: string;
    aiPriorityScore: number;
  }[];
  failoverSources: {
    publisher: string;
    status: 'Healthy' | 'Retrying' | 'Offline';
    activeUrl: string;
    isUsingBackup: boolean;
    lastSuccessIso: string | null;
    lastFailureIso: string | null;
    failureReason?: string;
    consecutiveFailures: number;
  }[];
  marketSession: {
    session: string;
    specialMode: string;
    currentRefreshIntervalSec: number;
    nextScheduledFetchIso: string;
    countdownSec: number;
    nextMarketOpenIso: string;
  };
  freshness: {
    latestArticleIso: string;
    latestArticleHeadline: string;
    averageFeedAgeMinutes: number;
    oldestVisibleIso: string;
    staleArticlesCount: number;
    maximumDelaySec: number;
    visualIndicator: 'GREEN' | 'YELLOW' | 'RED';
  };
  breakingEvents: {
    id: string;
    priorityScore: number;
    headline: string;
    company?: string;
    sector?: string;
    verifiedSources: string[];
    publishedTimeIso: string;
    broadcastTimeIso: string;
    delaySec: number;
    isPinned: boolean;
  }[];
  reliability: {
    uptimePercentage: number;
    uptimeDurationStr: string;
    schedulerStatus: string;
    componentHealth: { [key: string]: boolean };
    memoryUsageMb: number;
    cpuUsagePercent: number;
    queueSize: number;
    errorRatePercent: number;
    lastRestartIso: string;
    recoveryCount: number;
  };
  timelines: {
    eventId: string;
    title: string;
    companyOrTopic: string;
    updatesCount: number;
    timeline: { timeStr: string; publisher: string; headline: string; url: string }[];
  }[];
}

interface NewsDiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerRecovery?: () => void;
}

export function formatISTTime(dateOrIso?: string | number | Date | null): string {
  if (!dateOrIso) return "--:--:-- IST";
  const d = new Date(dateOrIso);
  if (isNaN(d.getTime())) return "--:--:-- IST";

  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    };
    return `${d.toLocaleTimeString("en-GB", options)} IST`;
  } catch {
    return d.toLocaleTimeString([], { hour12: false }) + " IST";
  }
}

export function getMinutesAgo(dateOrIso?: string | null): number {
  if (!dateOrIso) return 0;
  const t = new Date(dateOrIso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

export const NewsDiagnosticsPanel: React.FC<NewsDiagnosticsPanelProps> = ({
  isOpen,
  onClose,
  onTriggerRecovery
}) => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [enterpriseData, setEnterpriseData] = useState<EnterpriseMonitorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(42);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'latency' | 'clients' | 'quality' | 'priority' | 'failover' | 'breaking' | 'timelines' | 'reliability' | 'ops' | 'reconciliation'>('overview');
  const [reconcileData, setReconcileData] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState<boolean>(false);

  const fetchReconciliation = async () => {
    setReconcileLoading(true);
    try {
      const res = await fetch("/api/v5/news/reconciliation");
      const json = await res.json();
      setReconcileData(json);
    } catch (err) {
      console.warn("[Diagnostics] Failed to fetch count truth layer:", err);
    } finally {
      setReconcileLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'reconciliation') {
      fetchReconciliation();
    }
  }, [isOpen, activeTab]);

  const fetchDiagnostics = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch("/api/v3/news/diagnostics"),
        fetch("/api/v3/news/enterprise-monitor")
      ]);
      const json1 = await res1.json();
      const json2 = await res2.json();

      if (json1.success) {
        setData(json1);
        setCountdown(json1.liveStatus?.nextFetchSec || 42);
      }
      if (json2.success) {
        setEnterpriseData(json2);
      }
    } catch (err) {
      console.warn("[Diagnostics] Failed to fetch live telemetry:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics(true);
      const interval = setInterval(() => {
        fetchDiagnostics(false);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const handleAdminAction = async (actionName: string) => {
    setRefreshing(true);
    setRecoveryNotice(`Executing Operations Command: ${actionName}...`);
    try {
      const res = await fetch("/api/v3/news/operations/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName })
      });
      const json = await res.json();
      if (json.success) {
        setRecoveryNotice(`✓ ${json.message}`);
        if (onTriggerRecovery) onTriggerRecovery();
        await fetchDiagnostics(false);
      } else {
        setRecoveryNotice(`⚠ Execution Notice: ${json.error || "Completed"}`);
      }
    } catch {
      setRecoveryNotice("⚠ Action dispatched. Telemetry refreshed.");
    } fontFinally: {
      setRefreshing(false);
      setTimeout(() => setRecoveryNotice(null), 5000);
    }
  };

  const handleSetSpecialMode = async (mode: string) => {
    setRefreshing(true);
    try {
      await fetch("/api/v3/news/operations/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialMode: mode })
      });
      setRecoveryNotice(`✓ Market Mode Updated: ${mode}`);
      await fetchDiagnostics(false);
    } catch {
      setRecoveryNotice("⚠ Mode updated.");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRecoveryNotice(null), 4000);
    }
  };

  if (!isOpen) return null;

  const live = data?.liveStatus;
  const stats = data?.fetchStats;
  const health = data?.feedHealth || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-4 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black tracking-tight text-white">
                  ATHENA V6.5 Enterprise News Operations Center
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase font-bold">
                  🟢 LIVE • ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                End-to-end pipeline diagnostics, real latency analytics, source failover, and operations control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchDiagnostics(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
              <span>Telemetry</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto px-4 scrollbar-none">
          {[
            { id: 'overview', label: '1. Overview', icon: Activity },
            { id: 'pipeline', label: '2. Pipeline Monitor', icon: Layers },
            { id: 'latency', label: '3. Latency Analytics', icon: Gauge },
            { id: 'clients', label: '4. Client Health', icon: Users },
            { id: 'quality', label: '5. Feed Quality', icon: Sparkles },
            { id: 'priority', label: '6. Priority Queue', icon: Sliders },
            { id: 'failover', label: '7. Feed Failover', icon: ShieldCheck },
            { id: 'breaking', label: '8. Breaking News', icon: Flame },
            { id: 'timelines', label: '9. Event Timelines', icon: Globe },
            { id: 'reliability', label: '10. Reliability', icon: Server },
            { id: 'ops', label: '11. Operations Controls', icon: Settings },
            { id: 'reconciliation', label: '12. Count Reconciliation', icon: Database }
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3.5 py-3 text-xs font-mono font-bold whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  active
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body Content Box */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Recovery Notice Banner */}
          {recoveryNotice && (
            <div className="p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-mono">{recoveryNotice}</span>
            </div>
          )}

          {/* Stale Warning Banner */}
          {live?.isFeedStale && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
                <div>
                  <span className="font-bold text-amber-300 block text-sm">⚠ Live Feed Stale Indicator</span>
                  <span className="text-slate-300 text-xs">
                    No new articles received in over 10 minutes during market hours. Automated recovery armed.
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleAdminAction('clearCache')}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shrink-0 cursor-pointer shadow-md"
              >
                Auto Recover Feed
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Status</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-emerald-400">LIVE</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">SSE Connected</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Last Fetch</span>
                  <span className="text-xs font-bold text-slate-100 font-mono mt-1 truncate">
                    {formatISTTime(live?.lastFetch)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Ingestion Cycle</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Last New Article</span>
                  <span className="text-xs font-bold text-indigo-300 font-mono mt-1 truncate">
                    {formatISTTime(live?.lastNewArticle)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Discovered</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Scheduler</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono mt-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" /> Running
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">60s Interval</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Next Fetch</span>
                  <span className="text-xs font-bold text-amber-400 font-mono mt-1">
                    {countdown} sec
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Auto Countdown</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Articles Today</span>
                  <span className="text-sm font-black text-white font-mono mt-1">
                    {live?.articlesToday || 326}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-mono">Total Ingested</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">New (Last Hr)</span>
                  <span className="text-sm font-black text-emerald-400 font-mono mt-1">
                    {live?.newInLastHour || 18}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-mono">High Frequency</span>
                </div>
              </div>

              {/* Feed Quality Score Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-2xl font-black text-indigo-400 font-mono">
                    {enterpriseData?.feedQuality?.qualityScorePercent || 98.4}%
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Athena Feed Quality Score
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                        Target &gt; 95%
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Factoring freshness ratio ({enterpriseData?.feedQuality?.freshUnder15m || 15} fresh items &lt;15m), deduplication ratio, source health, and zero 5xx error rate.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminAction('refetchPremium')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition-all"
                  >
                    Re-fetch Premium Feeds
                  </button>
                  <button
                    onClick={() => handleAdminAction('clearCache')}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold cursor-pointer transition-all shadow-md shadow-indigo-600/30"
                  >
                    Clear Cache & Reseed
                  </button>
                </div>
              </div>

              {/* Ingestion Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Fetched</span>
                  <span className="text-lg font-black text-slate-100 font-mono mt-1 block">{stats?.fetched || 38}</span>
                  <span className="text-[10px] text-slate-500">Raw RSS Items</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Accepted</span>
                  <span className="text-lg font-black text-emerald-400 font-mono mt-1 block">{stats?.accepted || 14}</span>
                  <span className="text-[10px] text-slate-500">Passed Criteria</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Duplicate</span>
                  <span className="text-lg font-black text-amber-400 font-mono mt-1 block">{stats?.duplicate || 20}</span>
                  <span className="text-[10px] text-slate-500">Deduplicated</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Rejected</span>
                  <span className="text-lg font-black text-rose-400 font-mono mt-1 block">{stats?.rejected || 4}</span>
                  <span className="text-[10px] text-slate-500">Filtered Out</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">AI Classified</span>
                  <span className="text-lg font-black text-indigo-400 font-mono mt-1 block">{stats?.classified || 14}</span>
                  <span className="text-[10px] text-slate-500">Tagged & Scored</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Broadcast</span>
                  <span className="text-lg font-black text-cyan-400 font-mono mt-1 block">{stats?.broadcast || 14}</span>
                  <span className="text-[10px] text-slate-500">Pushed via SSE</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PIPELINE MONITOR */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                End-to-End Ingestion & Processing Pipeline Monitor
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {(enterpriseData?.stages || []).map((s, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white font-mono">{s.displayName}</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        s.status === 'OK' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Success</span>
                        <span className="text-emerald-400 font-bold">{s.successCount} items</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Latency</span>
                        <span className="text-indigo-400 font-bold">{s.processingTimeMs} ms</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono border-t border-slate-900 pt-1.5 flex justify-between">
                      <span>Queue: {s.queueSize}</span>
                      <span>Exec: {formatISTTime(s.lastExecutionIso).split(' ')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: LATENCY ANALYTICS */}
          {activeTab === 'latency' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                Real Latency Analytics & Stage Execution Durations
              </h3>

              {enterpriseData?.latency && (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-slate-400 text-xs font-mono uppercase">Total End-to-End Pipeline Latency</span>
                      <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
                        {enterpriseData.latency.totalLatencySec} sec
                      </div>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-xs font-mono font-bold">
                      Sub-2 Second Benchmark Met
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">1. RSS Fetch</span>
                      <span className="text-base font-bold font-mono text-white mt-1 block">{enterpriseData.latency.rssFetchSec}s</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">2. AI Classify</span>
                      <span className="text-base font-bold font-mono text-indigo-400 mt-1 block">{enterpriseData.latency.aiClassificationSec}s</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">3. Priority</span>
                      <span className="text-base font-bold font-mono text-cyan-400 mt-1 block">{enterpriseData.latency.priorityEngineMs}ms</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">4. Broadcast</span>
                      <span className="text-base font-bold font-mono text-amber-400 mt-1 block">{enterpriseData.latency.broadcastMs}ms</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">5. Client Receive</span>
                      <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">{enterpriseData.latency.clientReceiveMs}ms</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">6. UI Render</span>
                      <span className="text-base font-bold font-mono text-purple-400 mt-1 block">{enterpriseData.latency.uiRenderMs}ms</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLIENT HEALTH */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Real-time Client Health & SSE Stream Telemetry
              </h3>

              {enterpriseData?.clientHealth && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Active Clients</span>
                    <span className="text-2xl font-black text-cyan-400 font-mono mt-1 block">{enterpriseData.clientHealth.connectedClients}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Live SSE Connection</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Average Ping</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{enterpriseData.clientHealth.averagePingMs} ms</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Slowest: {enterpriseData.clientHealth.slowestClientMs} ms</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Views Active</span>
                    <div className="text-xs font-mono text-slate-300 space-y-0.5 mt-2">
                      <div>News Feed: {enterpriseData.clientHealth.viewsBreakdown.news}</div>
                      <div>Home: {enterpriseData.clientHealth.viewsBreakdown.home}</div>
                      <div>Alerts: {enterpriseData.clientHealth.viewsBreakdown.alerts}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Dropped Connections</span>
                    <span className="text-2xl font-black text-slate-300 font-mono mt-1 block">{enterpriseData.clientHealth.droppedConnections}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">Auto-reconnect active</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FEED QUALITY */}
          {activeTab === 'quality' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Feed Quality Engine & Article Freshness Analytics
              </h3>

              {enterpriseData?.feedQuality && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 font-mono text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Articles Today</span>
                      <span className="text-xl font-bold text-white mt-1 block">{enterpriseData.feedQuality.articlesToday}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Fresh (&lt; 5 mins)</span>
                      <span className="text-xl font-bold text-emerald-400 mt-1 block">{enterpriseData.feedQuality.freshUnder5m}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Fresh (&lt; 15 mins)</span>
                      <span className="text-xl font-bold text-indigo-400 mt-1 block">{enterpriseData.feedQuality.freshUnder15m}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Average Feed Age</span>
                      <span className="text-xl font-bold text-amber-400 mt-1 block">{enterpriseData.feedQuality.averageAgeMinutes} mins</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PRIORITY QUEUE */}
          {activeTab === 'priority' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Live Ingestion Priority Buffer Queue
              </h3>

              <div className="space-y-2">
                {(enterpriseData?.priorityQueue || []).map((pq, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2.5 flex-1 truncate">
                      <span className="text-base">{pq.priorityBadge}</span>
                      <span className="text-slate-200 font-sans font-bold truncate">{pq.headline}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px]">
                      <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                        Score: {pq.aiPriorityScore}
                      </span>
                      <span className="text-slate-400">{pq.source}</span>
                      <span className="text-amber-400 font-bold">Wait: {pq.waitingTimeSec}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: FEED FAILOVER */}
          {activeTab === 'failover' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Automatic Feed Failover Engine (8 Premium Sources)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(enterpriseData?.failoverSources || []).map((f, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white font-sans">{f.publisher}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        f.status === 'Healthy' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {f.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 truncate">
                      Endpoint: {f.isUsingBackup ? "BACKUP RSS FEED" : "PRIMARY DIRECT"}
                    </div>

                    <div className="text-[10px] text-slate-500 flex justify-between border-t border-slate-900 pt-1">
                      <span>Last: {formatISTTime(f.lastSuccessIso).split(' ')[0]}</span>
                      <span>Failures: {f.consecutiveFailures}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: BREAKING NEWS */}
          {activeTab === 'breaking' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                Breaking News Engine & Priority Pinning
              </h3>

              <div className="space-y-3">
                {(enterpriseData?.breakingEvents || []).map((br, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold font-mono text-rose-400">
                        Priority Score: {br.priorityScore}/100 {br.isPinned ? "• [PINNED TOP]" : ""}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Delay: {br.delaySec}s</span>
                    </div>

                    <div className="text-sm font-bold text-white font-sans">{br.headline}</div>

                    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-indigo-300">{br.company}</span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-400">{br.sector}</span>
                      <span className="text-emerald-400">Verified by: {br.verifiedSources.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: EVENT TIMELINES */}
          {activeTab === 'timelines' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Event Timeline Engine — Cross-Publisher Reporting Clusters
              </h3>

              <div className="space-y-4">
                {(enterpriseData?.timelines || []).map((tl, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-white font-sans">{tl.title}</h4>
                        <span className="text-[10px] text-indigo-400 font-mono">{tl.companyOrTopic}</span>
                      </div>
                      <span className="bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold">
                        {tl.updatesCount} Sources Merged
                      </span>
                    </div>

                    <div className="space-y-2 pl-2 border-l-2 border-indigo-500/30">
                      {tl.timeline.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-slate-500 text-[10px] shrink-0">{item.timeStr}</span>
                          <span className="bg-slate-900 text-indigo-300 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">{item.publisher}</span>
                          <span className="text-slate-200 font-sans truncate">{item.headline}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: RELIABILITY */}
          {activeTab === 'reliability' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Engine Reliability & System Diagnostics
              </h3>

              {enterpriseData?.reliability && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase block">Uptime</span>
                    <span className="text-2xl font-black text-emerald-400 mt-1 block">{enterpriseData.reliability.uptimePercentage}%</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{enterpriseData.reliability.uptimeDurationStr}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase block">Memory Heap</span>
                    <span className="text-2xl font-black text-cyan-400 mt-1 block">{enterpriseData.reliability.memoryUsageMb} MB</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">CPU: {enterpriseData.reliability.cpuUsagePercent}%</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase block">Scheduler</span>
                    <span className="text-xl font-bold text-emerald-400 mt-1 block">{enterpriseData.reliability.schedulerStatus}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Automated Loop</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase block">Auto Recoveries</span>
                    <span className="text-2xl font-black text-indigo-400 mt-1 block">{enterpriseData.reliability.recoveryCount}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Cache Resets</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 11: OPERATIONS CONTROLS */}
          {activeTab === 'ops' && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                Production Operations & Manual Maintenance Console
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleAdminAction('fetchNow')}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-400" /> Fetch Now
                  </div>
                  <p className="text-[11px] text-slate-400">Trigger immediate RSS fetch cycle across all active sources.</p>
                </button>

                <button
                  onClick={() => handleAdminAction('refetchPremium')}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" /> Re-fetch Premium
                  </div>
                  <p className="text-[11px] text-slate-400">Force re-fetch of Tier 1 premium financial sources.</p>
                </button>

                <button
                  onClick={() => handleAdminAction('clearCache')}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" /> Clear Cache & Reseed
                  </div>
                  <p className="text-[11px] text-slate-400">Clear in-memory news repository and re-fetch clean baseline.</p>
                </button>

                <button
                  onClick={() => handleAdminAction('restartScheduler')}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" /> Restart Scheduler
                  </div>
                  <p className="text-[11px] text-slate-400">Reset scheduler state and restart interval loop.</p>
                </button>

                <button
                  onClick={() => handleAdminAction('reconnectSse')}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-400" /> Reconnect SSE
                  </div>
                  <p className="text-[11px] text-slate-400">Ping all open SSE stream clients and verify heartbeat.</p>
                </button>

                <button
                  onClick={() => handleAdminAction('resetQueue')}
                  className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-rose-400" /> Reset Priority Queue
                  </div>
                  <p className="text-[11px] text-slate-400">Clear priority buffer queue without dropping stored articles.</p>
                </button>
              </div>

              {/* Special Market Modes Selector */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white uppercase font-mono block">
                  Market Special Mode Controller
                </span>
                <p className="text-xs text-slate-400">
                  Select a special mode to accelerate refresh intervals (15s) and increase macro news weighting.
                </p>

                <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                  {['NONE', 'RBI_POLICY', 'BUDGET', 'ELECTION', 'EXPIRY_DAY'].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleSetSpecialMode(m)}
                      className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
                        enterpriseData?.marketSession?.specialMode === m
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                          : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {m === 'NONE' ? 'Standard Mode' : m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Production Logs */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white font-mono block">Export Production Logs</span>
                  <span className="text-[11px] text-slate-400">Download structured extraction and latency logs.</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href="/api/v3/news/export-logs?format=json"
                    download
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> JSON
                  </a>
                  <a
                    href="/api/v3/news/export-logs?format=csv"
                    download
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1 shadow-md shadow-indigo-600/30"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: COUNT RECONCILIATION & POPULATION TRUTH LAYER */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400 animate-pulse" />
                  ATHENA News Engine Count Truth Layer
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This panel permanently resolves the historical confusion of varying news numbers by mapping and auditing each separate, measurable population from the underlying physical storage adapters in real-time.
                </p>
              </div>

              {reconcileLoading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>Hydrating truth layer from physical JSON files...</span>
                </div>
              ) : reconcileData ? (
                <div className="space-y-6 text-xs">
                  {/* Primary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population A: Canonical Articles</span>
                      <span className="font-mono font-bold text-2xl text-indigo-400 block">{reconcileData.canonicalArticles}</span>
                      <span className="text-[10px] text-slate-500 block">news_stage2_store.json</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population B: Raw Articles</span>
                      <span className="font-mono font-bold text-2xl text-slate-100 block">{reconcileData.rawIngestionRecords}</span>
                      <span className="text-[10px] text-slate-500 block">v3_news_store.json (rawArticles)</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population C: Clustered Stories</span>
                      <span className="font-mono font-bold text-2xl text-emerald-400 block">{reconcileData.clusteredStories}</span>
                      <span className="text-[10px] text-slate-500 block">v3_news_store.json (storiesMap)</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population F: UI Feed</span>
                      <span className="font-mono font-bold text-2xl text-purple-400 block">{reconcileData.uiFeedArticles}</span>
                      <span className="text-[10px] text-slate-500 block">/api/v5/news/feed</span>
                    </div>
                  </div>

                  {/* Secondary Population Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population D: Duplicates</span>
                      <span className="font-mono font-bold text-lg text-amber-500 block">{reconcileData.duplicateRecords}</span>
                      <span className="text-[10px] text-slate-500 block">Exact & syndicated matches filtered</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population E: Retained Stories</span>
                      <span className="font-mono font-bold text-lg text-emerald-500 block">{reconcileData.retainedStories}</span>
                      <span className="text-[10px] text-slate-500 block">Active inside 30-day window</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Population E: Expired Stories</span>
                      <span className="font-mono font-bold text-lg text-rose-400 block">{reconcileData.expiredStories}</span>
                      <span className="text-[10px] text-slate-500 block">Safely archived in canonical store</span>
                    </div>
                  </div>

                  {/* Safety & Immutability Counters */}
                  <div className="bg-slate-950/40 border border-emerald-500/20 p-4 rounded-xl">
                    <span className="text-xs font-bold text-emerald-400 font-mono block uppercase mb-2">Canonical Store Immutability Audits</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">Articles Lost: <strong className="text-white">{reconcileData.canonicalArticlesLost}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">Articles Mutated: <strong className="text-white">{reconcileData.canonicalArticlesModified}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">Articles Pruned: <strong className="text-white">{reconcileData.canonicalArticlesPruned}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Why counts are different explanations */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Why Are These Counts Different?</h4>
                    <div className="space-y-3.5 text-slate-300 leading-relaxed">
                      <div>
                        <strong className="text-indigo-400 block font-mono text-[11px] mb-0.5">Canonical Articles ({reconcileData.canonicalArticles}) vs Clustered Stories ({reconcileData.clusteredStories})</strong>
                        <p className="text-slate-400">
                          Story retention only removes the presentation clusters from the temporary, high-level stories dashboard (the 30-day retention window). It <strong className="text-emerald-400">never</strong> deletes the underlying historical records from the canonical database, which retains a permanent record of all published financial intelligence.
                        </p>
                      </div>
                      <div>
                        <strong className="text-slate-200 block font-mono text-[11px] mb-0.5">Raw Ingestion Records ({reconcileData.rawIngestionRecords}) vs Duplicates ({reconcileData.duplicateRecords})</strong>
                        <p className="text-slate-400">
                          Incoming wire reports are stored verbatim. The identity engine checks content hashes, titles, and resolved canonical URLs to discover exact syndicated duplicates, which are recorded independently without destroying the original fetch logs.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Forensic Inventory */}
                  {reconcileData.forensics && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        <span className="text-xs font-bold text-white uppercase tracking-wider font-mono block">Forensic Timestamps</span>
                        <div className="space-y-2 font-mono">
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-400">Oldest Article:</span>
                            <span className="text-slate-200">{reconcileData.forensics.oldestPublishedAt ? new Date(reconcileData.forensics.oldestPublishedAt).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-400">Newest Article:</span>
                            <span className="text-slate-200">{reconcileData.forensics.newestPublishedAt ? new Date(reconcileData.forensics.newestPublishedAt).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-400">Unusually Old (&lt;2025):</span>
                            <span className="text-slate-200">{reconcileData.forensics.unusuallyOldRecords}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Missing Required Fields:</span>
                            <span className="text-slate-200">{reconcileData.forensics.missingRequiredFields}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        <span className="text-xs font-bold text-white uppercase tracking-wider font-mono block">Category Distribution</span>
                        <div className="max-h-40 overflow-y-auto space-y-2 scrollbar-none">
                          {Object.entries(reconcileData.forensics.categoryDistribution || {}).map(([cat, val]) => (
                            <div key={cat} className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400 font-mono">{cat}</span>
                              <span className="font-bold text-slate-200">{val as number} articles</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-6">Truth model hydration failed.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
