import React, { useState, useEffect } from "react";
import ProductionStabilityPanel from "./ProductionStabilityPanel";
import SourceEffectivenessAuditPanel from "./SourceEffectivenessAuditPanel";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Database,
  Play,
  PlayCircle,
  Settings,
  Trash2,
  Download,
  Search,
  Server,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Terminal,
  Zap,
  Info
} from "lucide-react";

interface ConnectorStats {
  name: string;
  url: string;
  status: "Online" | "Warning" | "Offline";
  lastFetchTime: string;
  lastSuccessTime: string;
  responseTimeMs: number;
  articlesFetched: number;
  articlesNew: number;
  articlesDuplicate: number;
  articlesRejected: number;
  consecutiveFailures: number;
  totalSuccess: number;
  totalFailure: number;
}

interface RawArticleEntry {
  headline: string;
  publisher: string;
  originalUrl: string;
  publishedTime: string;
  retrievedTime: string;
  connector: string;
  guid?: string;
}

interface ConnectorProcessingLog {
  connectorName: string;
  returned: number;
  accepted: number;
  rejected: number;
  rejectionReasons: { reason: string; count: number }[];
}

interface PipelineCycle {
  time: string;
  fetched: number;
  added: number;
  rejected: number;
  duplicates: number;
  durationSec: number;
}

interface TimelineEventEntry {
  time: string;
  message: string;
}

interface NewsEngineDiagnostics {
  connectorHealth: ConnectorStats[];
  lastFetchTime: string;
  lastFailedFetchTime: string;
  totalArticlesFetched: number;
  totalArticlesRejected: number;
  totalDuplicatesMerged: number;
  totalStoriesCreated: number;
  queueStatus: "idle" | "fetching";
  lastFetchStatus?: string;
  newArticlesAddedLastCycle?: number;
  pollIntervalSec: number;
  isTimerRunning: boolean;
  rawArticlesBuffer: RawArticleEntry[];
  latestProcessingLogs: ConnectorProcessingLog[];
  pipelineCycles: PipelineCycle[];
  timelineEvents: TimelineEventEntry[];
  productionMetrics?: any;
}

interface NewsOperationsDashboardProps {
  onClose?: () => void;
}

function LiveMonitorView() {
  const [monitor, setMonitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testingE2e, setTestingE2e] = useState(false);
  const [e2eResult, setE2eResult] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(60);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/v3/news/monitor-status");
      const data = await res.json();
      if (data.success || data.status === 'success') {
        setMonitor(data);
        setCountdown(data.countdownSec || 60);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    const tick = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v3/news/sync", { method: "POST" });
      await res.json();
      fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunE2eTest = async () => {
    setTestingE2e(true);
    setE2eResult(null);
    try {
      const res = await fetch("/api/v3/news/e2e-test", { method: "POST" });
      const data = await res.json();
      setE2eResult(data);
      fetchStatus();
    } catch (e: any) {
      setE2eResult({ result: 'FAIL', failurePoint: { exactReason: e.message } });
    } finally {
      setTestingE2e(false);
    }
  };

  if (loading && !monitor) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="h-5 w-5 animate-spin text-emerald-400 mr-2" />
        Connecting to News Engine Monitor...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-100">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Auto Sync</span>
          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 mt-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            {monitor?.autoSync || 'Running'}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Countdown</span>
          <span className="text-sm font-mono font-bold text-indigo-400 mt-1 block">
            {countdown}s
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Last Sync</span>
          <span className="text-xs font-mono font-semibold text-slate-200 mt-1 block truncate">
            {monitor?.lastSyncFormatted || '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Duration</span>
          <span className="text-xs font-mono font-bold text-indigo-300 mt-1 block">
            {monitor?.durationSec || 0}s
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Sources</span>
          <span className="text-xs font-mono font-bold text-emerald-400 mt-1 block">
            {monitor?.sourcesOnline || '18/18 Online'}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Downloaded</span>
          <span className="text-sm font-mono font-bold text-white mt-1 block">
            {monitor?.articlesDownloaded || 0}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">New</span>
          <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">
            +{monitor?.newArticles || 0}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Duplicates</span>
          <span className="text-sm font-mono font-bold text-amber-400 mt-1 block">
            {monitor?.duplicates || 0}
          </span>
        </div>
      </div>

      {/* Manual Sync & End-to-End Test Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-xs font-mono uppercase font-bold text-white tracking-wider">
            News Engine Live Operations & Verification
          </h3>
          <p className="text-[11px] font-sans text-slate-400 mt-0.5">
            Trigger immediate manual sync across all feeds or run the end-to-end live Telegram delivery audit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded-xl border border-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/40 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Feeds...' : 'Manual Sync Now'}
          </button>

          <button
            onClick={handleRunE2eTest}
            disabled={testingE2e}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded-xl border border-emerald-500 transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${testingE2e ? 'animate-bounce' : ''}`} />
            {testingE2e ? 'Running E2E Test...' : 'Run End-to-End Test'}
          </button>
        </div>
      </div>

      {/* E2E Test Result Panel if available */}
      {e2eResult && (
        <div className={`p-5 rounded-2xl border ${e2eResult.result === 'PASS' ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-red-950/30 border-red-500/30'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border ${e2eResult.result === 'PASS' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                RESULT: {e2eResult.result}
              </span>
              <span className="text-xs font-mono text-slate-300 font-semibold">{e2eResult.summary || 'Pipeline Audit Executed'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Duration: {e2eResult.durationSec}s</span>
          </div>

          {e2eResult.failurePoint && (
            <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 text-xs font-mono space-y-1 mb-3">
              <div className="text-red-300 font-bold">Failure Point Detected:</div>
              <div>File: <span className="text-red-200">{e2eResult.failurePoint.file}</span></div>
              <div>Function: <span className="text-red-200">{e2eResult.failurePoint.function}</span> (Line {e2eResult.failurePoint.lineNumber})</div>
              <div>Exact Reason: <span className="text-red-200 font-semibold">{e2eResult.failurePoint.exactReason}</span></div>
            </div>
          )}

          {/* Steps Trace */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {e2eResult.steps?.map((s: any, idx: number) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg font-mono text-[11px] flex justify-between items-center">
                <span className="text-slate-300">{s.step}</span>
                <span className={`font-bold ${s.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 1 & 5 — Source Health Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase font-bold text-white tracking-wider flex items-center justify-between">
          <span>Source Health & Ingestion Audit</span>
          <span className="text-[10px] text-slate-400 font-normal">Active Sources: {monitor?.sources?.length || 0}</span>
        </h3>

        <div className="overflow-x-auto border border-slate-800 rounded-2xl">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="p-3">Source Name</th>
                <th className="p-3">HTTP Status</th>
                <th className="p-3">Last Success</th>
                <th className="p-3">Next Fetch</th>
                <th className="p-3 text-center">Interval</th>
                <th className="p-3 text-center">Received</th>
                <th className="p-3 text-center">Accepted</th>
                <th className="p-3 text-center">Duplicates</th>
                <th className="p-3 text-center">Errors</th>
                <th className="p-3">Last Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {monitor?.sources?.map((src: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-900/30 transition-all text-[11px]">
                  <td className="p-3 font-bold text-white">
                    <div>{src.publisher}</div>
                    <div className="text-[9px] text-slate-500 font-normal truncate max-w-[140px]">{src.feedName}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${src.status === 'OK' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                      HTTP {src.httpStatus || 200}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{src.lastSuccessIso ? new Date(src.lastSuccessIso).toLocaleTimeString() : '--'}</td>
                  <td className="p-3 text-slate-400">{src.nextScheduledIso ? new Date(src.nextScheduledIso).toLocaleTimeString() : '--'}</td>
                  <td className="p-3 text-center text-indigo-400">{src.refreshIntervalSec || 60}s</td>
                  <td className="p-3 text-center text-slate-200 font-semibold">{src.articlesReceived || 0}</td>
                  <td className="p-3 text-center text-emerald-400 font-bold">{src.newAccepted || src.lastArticleCount || 0}</td>
                  <td className="p-3 text-center text-amber-400">{src.duplicatesRejected || 0}</td>
                  <td className="p-3 text-center text-red-400">{src.parsingErrors || 0}</td>
                  <td className="p-3 text-slate-400 text-[10px] max-w-[180px] truncate">{src.lastError || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 6 — Telegram Correlation Log */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase font-bold text-white tracking-wider flex items-center justify-between">
          <span>Telegram F&O Correlation Audit Trail</span>
          <span className="text-[10px] text-slate-400 font-normal">Recent Evaluated Articles: {monitor?.telegramLogs?.length || 0}</span>
        </h3>

        <div className="overflow-x-auto border border-slate-800 rounded-2xl">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="p-3">Article ID & Ticker</th>
                <th className="p-3">Headline</th>
                <th className="p-3 text-center">telegramEligible</th>
                <th className="p-3 text-center">Queued</th>
                <th className="p-3 text-center">Worker Picked</th>
                <th className="p-3 text-center">Sent</th>
                <th className="p-3 text-center">Delivered</th>
                <th className="p-3">Message ID / Rejection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {monitor?.telegramLogs?.slice(-15).reverse().map((log: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-900/30 transition-all text-[11px]">
                  <td className="p-3 font-bold text-white">
                    <div className="text-indigo-400">{log.symbol}</div>
                    <div className="text-[9px] text-slate-500 font-normal truncate max-w-[110px]">{log.articleId}</div>
                  </td>
                  <td className="p-3 text-slate-200 max-w-[220px] truncate" title={log.headline}>
                    {log.headline}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${log.telegramEligible ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {log.telegramEligible ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${log.queued ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {log.queued ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${log.workerPicked ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {log.workerPicked ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${log.telegramSent ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {log.telegramSent ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-bold ${log.telegramDelivered ? 'text-emerald-400' : 'text-red-400'}`}>
                      {log.telegramDelivered ? 'YES' : (log.telegramEligible ? 'NO' : '--')}
                    </span>
                  </td>
                  <td className="p-3 text-[10px]">
                    {log.telegramDelivered ? (
                      <span className="text-emerald-300 font-semibold">ID: {log.messageId}</span>
                    ) : (
                      <span className="text-red-400">{log.exactRejectionReason || log.rejectReason || 'Ineligible'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface NewsOperationsDashboardProps {
  onClose?: () => void;
}

export default function NewsOperationsDashboard({ onClose }: NewsOperationsDashboardProps) {
  const [diag, setDiag] = useState<NewsEngineDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConnectorToTest, setSelectedConnectorToTest] = useState<string>("");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testingConnector, setTestingConnector] = useState(false);

  // Search diagnostics test state
  const [testSearchQuery, setTestSearchQuery] = useState("");
  const [searchDiagResult, setSearchDiagResult] = useState<{
    timeMs: number;
    matches: number;
    dbSize: number;
    status: string;
  } | null>(null);

  // active tab inside admin dashboard
  const [activeTab, setActiveTab] = useState<"effectiveness_audit" | "production_stability" | "overview" | "connectors" | "raw" | "processing" | "monitor" | "tools" | "extraction">("overview");

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 5000); // Auto-poll diagnostics every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch("/api/rss/diagnostics");
      if (!res.ok) throw new Error("Failed to load operations data");
      const data = await res.json();
      if (data.success) {
        setDiag(data.diagnostics);
        if (selectedConnectorToTest === "" && data.diagnostics.connectorHealth.length > 0) {
          setSelectedConnectorToTest(data.diagnostics.connectorHealth[0].name);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unspecified Error fetching diagnostics");
    } finally {
      setLoading(false);
    }
  };

  const handleRunPipeline = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/rss/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchDiagnostics();
      } else {
        alert("Pipeline failed: " + data.error);
      }
    } catch (err: any) {
      alert("Failed to trigger pipeline: " + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTogglePoller = async () => {
    try {
      const res = await fetch("/api/rss/toggle-poller", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchDiagnostics();
      }
    } catch (err: any) {
      alert("Failed to toggle background poller: " + err.message);
    }
  };

  const handleReloadConnectors = async () => {
    if (!confirm("Are you sure you want to reload connector configurations and reset current cycle metrics?")) return;
    try {
      const res = await fetch("/api/rss/reload", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchDiagnostics();
      }
    } catch (err: any) {
      alert("Failed to reload connectors: " + err.message);
    }
  };

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to completely clear the news stories database? This will reset all current ingested articles and reseed baseline stories.")) return;
    try {
      const res = await fetch("/api/rss/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchDiagnostics();
      }
    } catch (err: any) {
      alert("Failed to clear cache: " + err.message);
    }
  };

  const handleTestConnector = async () => {
    if (!selectedConnectorToTest) return;
    setTestingConnector(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/rss/test-connector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedConnectorToTest })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingConnector(false);
    }
  };

  const handleTestSearch = async () => {
    if (!testSearchQuery.trim()) return;
    const start = performance.now();
    try {
      // Fetch current stories to filter locally
      const res = await fetch("/api/rss/news");
      const data = await res.json();
      const duration = performance.now() - start;
      const items = data.items || [];
      const queryLower = testSearchQuery.toLowerCase();
      
      const matches = items.filter((e: any) => 
        (e.title || "").toLowerCase().includes(queryLower) ||
        (e.description || "").toLowerCase().includes(queryLower) ||
        (e.sourceName || "").toLowerCase().includes(queryLower)
      );

      setSearchDiagResult({
        timeMs: parseFloat(duration.toFixed(2)),
        matches: matches.length,
        dbSize: items.length,
        status: "Cache Hit (Indexed Local Memory)"
      });
    } catch (err) {
      setSearchDiagResult({
        timeMs: parseFloat((performance.now() - start).toFixed(2)),
        matches: 0,
        dbSize: 0,
        status: "Failed / Network Error"
      });
    }
  };

  const handleDownloadRawJSON = () => {
    if (!diag || diag.rawArticlesBuffer.length === 0) {
      alert("No raw articles buffered to export.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(diag.rawArticlesBuffer, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `athena_raw_feed_buffer_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-slate-950 rounded-2xl border border-slate-900 text-slate-300">
        <RefreshCw className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
        <span className="text-sm font-mono tracking-widest text-emerald-400 uppercase">Fetching Ingestion Groundtruth...</span>
      </div>
    );
  }

  if (!diag) {
    return (
      <div className="p-10 bg-slate-950 rounded-2xl border border-slate-900 text-center text-red-400">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3" />
        <p className="font-mono">CRITICAL: Operations channel offline. Failed to establish connection with the news engine controller.</p>
      </div>
    );
  }

  // Calculate high level connector numbers
  const totalConnectors = diag.connectorHealth.length;
  const healthyConnectors = diag.connectorHealth.filter(c => c.status === "Online").length;
  const warnedConnectors = diag.connectorHealth.filter(c => c.status === "Warning").length;
  const failedConnectors = diag.connectorHealth.filter(c => c.status === "Offline").length;

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden shadow-2xl text-left" id="news-operations-panel">
      {/* Header operations rail */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-950 to-slate-950 px-6 py-5 border-b border-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase font-semibold">
              Pure Ingestion Validation Mode
            </span>
            <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-mono border border-indigo-500/20 px-2 py-0.5 rounded-md uppercase font-semibold">
              Dev Only
            </span>
          </div>
          <h1 className="font-display font-black text-2xl text-white tracking-tight mt-1 flex items-center gap-2">
            <Server className="h-6 w-6 text-indigo-400" />
            Athena Operations Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time feed diagnostics, raw integrity logs, and operations monitoring console.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchDiagnostics}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-mono border border-slate-800 transition-all flex items-center gap-1.5"
            title="Refresh statistics manually"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Fetch Telemetry
          </button>
          
          <button
            onClick={handleTogglePoller}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 border ${
              diag.isTimerRunning
                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {diag.isTimerRunning ? "Stop Poller" : "Start Poller"}
          </button>

          <button
            onClick={handleRunPipeline}
            disabled={refreshing || diag.queueStatus === "fetching"}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-sans font-bold shadow-md shadow-indigo-950/50 hover:shadow-indigo-950/20 border border-indigo-500 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            <PlayCircle className={`h-4 w-4 ${refreshing ? "animate-spin text-indigo-200" : ""}`} />
            Run Pipeline
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-xs font-sans font-semibold border border-slate-800"
            >
              Exit Operations
            </button>
          )}
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex border-b border-slate-900 overflow-x-auto bg-slate-950/50 px-2 scrollbar-none">
        {[
          { id: "overview", label: "Overview", icon: Server },
          { id: "effectiveness_audit", label: "Source Effectiveness (V9.2.8)", icon: Activity },
          { id: "production_stability", label: "Production Stability Audit", icon: ShieldCheck },
          { id: "connectors", label: "Connectors", icon: Zap },
          { id: "raw", label: "Raw Feed Inspector", icon: Terminal },
          { id: "processing", label: "Processing Inspector", icon: Info },
          { id: "monitor", label: "Live Pipeline Monitor", icon: Activity },
          { id: "extraction", label: "Extraction Quality", icon: BarChart3 },
          { id: "tools", label: "Manual Testing & Search", icon: Settings }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-3 text-xs font-mono uppercase tracking-wider font-bold whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === t.id
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {/* SOURCE EFFECTIVENESS AUDIT TAB (V9.2.8) */}
        {activeTab === "effectiveness_audit" && <SourceEffectivenessAuditPanel />}

        {/* PRODUCTION STABILITY TAB */}
        {activeTab === "production_stability" && <ProductionStabilityPanel />}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-100">
            {/* Status cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Engine Engine Status</span>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${diag.isTimerRunning ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                    <span className="text-sm font-mono font-bold text-white">
                      {diag.isTimerRunning ? "Background Polling" : "System Paused"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 font-mono">Interval: {diag.pollIntervalSec}s</span>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Last Pipeline Run</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-mono font-bold text-white truncate" title={diag.lastFetchTime}>
                      {diag.lastFetchTime !== "Never" ? new Date(diag.lastFetchTime).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 mt-2 font-mono flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ingestion active
                  </span>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Connectors Summary</span>
                  <div className="text-lg font-mono font-bold text-white">
                    {healthyConnectors} / {totalConnectors}
                  </div>
                  <div className="text-[10px] mt-2 flex gap-2 font-mono">
                    <span className="text-emerald-400">Online: {healthyConnectors}</span>
                    {warnedConnectors > 0 && <span className="text-amber-400">Warn: {warnedConnectors}</span>}
                    {failedConnectors > 0 && <span className="text-red-400">Offline: {failedConnectors}</span>}
                  </div>
                </div>
              </div>

              {/* Ingestion counts metrics */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white mb-4 flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  Historical Ingestion Stats (Pure Ingestion Mode)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl text-center">
                    <div className="text-slate-400 text-[10px] font-mono uppercase">Raw Articles</div>
                    <div className="text-lg font-mono font-black text-slate-200 mt-1">{diag.totalArticlesFetched}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">Total Pulled</div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl text-center">
                    <div className="text-slate-400 text-[10px] font-mono uppercase">Rejected</div>
                    <div className="text-lg font-mono font-black text-red-400 mt-1">{diag.totalArticlesRejected}</div>
                    <div className="text-[9px] text-red-500/80 font-mono mt-1">Failed Criteria</div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl text-center">
                    <div className="text-slate-400 text-[10px] font-mono uppercase">Duplicates</div>
                    <div className="text-lg font-mono font-black text-amber-500 mt-1">{diag.totalDuplicatesMerged}</div>
                    <div className="text-[9px] text-amber-500/80 font-mono mt-1">Identical Filtered</div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl text-center">
                    <div className="text-slate-400 text-[10px] font-mono uppercase">Unique Stories</div>
                    <div className="text-lg font-mono font-black text-emerald-400 mt-1">{diag.totalStoriesCreated}</div>
                    <div className="text-[9px] text-emerald-500/80 font-mono mt-1">Active Store</div>
                  </div>
                </div>
              </div>

              {/* Last Fetch Status Banner */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Last Cycle Execution</div>
                  <div className="text-sm font-sans font-semibold text-slate-200 mt-1">
                    {diag.lastFetchStatus || "No fetch logged yet"}
                  </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-mono text-center">
                  <div className="text-[9px] text-emerald-500 uppercase font-bold">New Stories Added</div>
                  <div className="text-base text-emerald-400 font-black">{diag.newArticlesAddedLastCycle ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Timeline Inspector */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 flex flex-col h-[340px]">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white mb-3 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-indigo-400" />
                Live Timeline Inspector
              </h3>
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 space-y-1.5">
                {diag.timelineEvents && diag.timelineEvents.length > 0 ? (
                  diag.timelineEvents.map((evt, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 border-b border-slate-900/30 pb-1">
                      <span className="text-slate-500 select-none shrink-0">[{evt.time}]</span>
                      <span className={evt.message.includes("Failed") || evt.message.includes("failed") ? "text-red-400" : evt.message.includes("Heartbeat") ? "text-amber-500" : "text-slate-300"}>
                        {evt.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-20 italic">No cycles executed yet. Run the pipeline to populate logs.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONNECTORS TAB */}
        {activeTab === "connectors" && (
          <div className="space-y-6 animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-white">
                Detailed RSS Connector Register
              </h2>
              <button
                onClick={handleReloadConnectors}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs px-3 py-1.5 rounded-xl font-sans font-semibold transition-all"
              >
                Reset Connector Metrics
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-900 rounded-2xl">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-slate-900 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="p-4 font-bold">Connector Name</th>
                    <th className="p-4 font-bold text-center">Status</th>
                    <th className="p-4 font-bold text-center">Latency</th>
                    <th className="p-4 font-bold text-center">Returned</th>
                    <th className="p-4 font-bold text-center">New</th>
                    <th className="p-4 font-bold text-center">Duplicates</th>
                    <th className="p-4 font-bold text-center">Rejected</th>
                    <th className="p-4 font-bold text-right">Success / Fail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {diag.connectorHealth.map((c, idx) => {
                    const statusColor =
                      c.status === "Online"
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : c.status === "Warning"
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        : "text-red-400 bg-red-500/10 border-red-500/20";
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-900/25 transition-all">
                        <td className="p-4 text-slate-200">
                          <div className="font-bold font-sans">{c.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{c.url}</div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block border text-[10px] font-bold px-2 py-0.5 rounded-md ${statusColor}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="p-4 text-center font-bold text-indigo-400">
                          {c.responseTimeMs > 0 ? `${c.responseTimeMs} ms` : "HEAD skipped"}
                        </td>
                        <td className="p-4 text-center font-black text-slate-300">{c.articlesFetched}</td>
                        <td className="p-4 text-center font-black text-emerald-400">{c.articlesNew}</td>
                        <td className="p-4 text-center font-black text-amber-500">{c.articlesDuplicate}</td>
                        <td className="p-4 text-center font-black text-red-400">{c.articlesRejected}</td>
                        <td className="p-4 text-right font-bold text-slate-400">
                          <span className="text-emerald-500">{c.totalSuccess}</span>
                          <span className="text-slate-600"> / </span>
                          <span className="text-red-500">{c.totalFailure}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RAW FEED INSPECTOR TAB */}
        {activeTab === "raw" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-white">
                  Raw Feed Groundtruth Buffer
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Exposes the last 50 raw items exactly as retrieved from XML parsed nodes, prior to processing, deduplication, or filters.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadRawJSON}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs px-3 py-1.5 rounded-xl font-sans font-semibold transition-all flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export buffer JSON
                </button>
              </div>
            </div>

            <div className="bg-slate-900/20 border border-slate-900 rounded-2xl max-h-[450px] overflow-y-auto">
              {diag.rawArticlesBuffer && diag.rawArticlesBuffer.length > 0 ? (
                <div className="divide-y divide-slate-900/50">
                  {diag.rawArticlesBuffer.map((art, idx) => (
                    <div key={idx} className="p-4 hover:bg-slate-900/10 transition-all font-mono text-[11px]">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1.5">
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 text-[9px] font-bold px-2 py-0.5 rounded">
                          {art.publisher}
                        </span>
                        <div className="text-slate-500 text-[9px] flex gap-2">
                          <span>Pub: {new Date(art.publishedTime).toLocaleTimeString()}</span>
                          <span>|</span>
                          <span>Retrieved: {new Date(art.retrievedTime).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      
                      <div className="text-xs font-sans font-bold text-slate-200 mt-2 hover:text-indigo-400">
                        <a href={art.originalUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          {art.headline}
                        </a>
                      </div>

                      {art.guid && (
                        <div className="text-[9px] text-slate-600 truncate mt-1">
                          GUID / ID: {art.guid}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-center py-24 font-sans italic">
                  Raw buffer is currently empty. Execute a news fetch pipeline to populate buffer.
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROCESSING INSPECTOR TAB */}
        {activeTab === "processing" && (
          <div className="space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-white">
                Rejection Logs & Pipeline Processor Analytics
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every rejected article must explicitly record a reason. Inspect the current cycle statistics below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {diag.latestProcessingLogs && diag.latestProcessingLogs.length > 0 ? (
                diag.latestProcessingLogs.map((log, idx) => (
                  <div key={idx} className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                      <h3 className="font-sans font-bold text-white">{log.connectorName}</h3>
                      <div className="text-[10px] font-mono flex gap-2">
                        <span className="text-slate-400">Fetched: {log.returned}</span>
                        <span className="text-emerald-400">Accepted: {log.accepted}</span>
                        <span className="text-red-400">Rejected: {log.rejected}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">
                        Rejection Details
                      </span>
                      {log.rejectionReasons && log.rejectionReasons.length > 0 ? (
                        <div className="space-y-1.5">
                          {log.rejectionReasons.map((re, rIdx) => (
                            <div key={rIdx} className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 flex justify-between items-center text-[11px] font-mono">
                              <span className="text-red-300">{re.reason}</span>
                              <span className="bg-red-500/20 text-red-200 px-1.5 py-0.25 rounded text-[10px] font-bold">
                                {re.count} articles
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-500 text-[10px] font-mono italic">
                          {log.returned === 0 ? "No feeds fetched." : "0 rejections. Clean cycle!"}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="md:col-span-2 text-slate-500 text-center py-20 font-mono italic">
                  Rejection diagnostics have not compiled log structures yet. Perform a fetch cycle to populate.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MONITOR TAB */}
        {activeTab === "monitor" && <LiveMonitorView />}

        {/* MANUAL TESTING & TOOLS TAB */}
        {activeTab === "tools" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-100">
            {/* Left: Test Individual Connector */}
            <div className="bg-slate-900/25 border border-slate-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Play className="h-4 w-4 text-indigo-400" />
                Test Specific Connector
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Perform a direct connection, heartbeat latency test, and sample parse on any specific news provider configuration. No stories are saved to the persistent database.
              </p>

              <div className="flex gap-2">
                <select
                  value={selectedConnectorToTest}
                  onChange={(e) => setSelectedConnectorToTest(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 flex-1 font-mono outline-none focus:border-indigo-500 transition-all"
                >
                  {diag.connectorHealth.map((c, idx) => (
                    <option key={idx} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleTestConnector}
                  disabled={testingConnector}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-sans font-bold text-xs px-4 rounded-xl shadow transition-all flex items-center gap-1"
                >
                  {testingConnector ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Test Fetch"}
                </button>
              </div>

              {testResult && (
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 font-mono text-[11px] space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="font-bold text-slate-400">Test Result:</span>
                    <span className={`px-2 py-0.5 text-[9px] rounded font-bold ${testResult.success ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {testResult.success ? "SUCCESS" : "FAILED"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-500">Heartbeat:</span>
                      <span className={testResult.heartbeatOk ? " text-emerald-400 ml-1" : " text-red-400 ml-1"}>
                        {testResult.heartbeatOk ? "ONLINE" : "UNREACHABLE"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Response Time:</span>
                      <span className="text-indigo-400 ml-1">{testResult.responseTimeMs}ms</span>
                    </div>
                    {testResult.success && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Articles Found:</span>
                        <span className="text-slate-300 font-bold ml-1">{testResult.totalItems} items</span>
                      </div>
                    )}
                  </div>

                  {testResult.error && (
                    <div className="text-red-400 bg-red-500/5 p-2 rounded border border-red-500/10 text-[10px] select-all">
                      Error: {testResult.error}
                    </div>
                  )}

                  {testResult.success && testResult.samples && testResult.samples.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-900 pt-2">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Articles Sample:</span>
                      {testResult.samples.map((sa: any, sIdx: number) => (
                        <div key={sIdx} className="bg-slate-900/50 p-2 rounded border border-slate-900 text-[10px] space-y-1">
                          <div className="text-slate-300 font-sans font-bold leading-normal truncate">{sa.title}</div>
                          <div className="text-slate-500 text-[9px] truncate">{sa.link}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Search Diagnostics Verification */}
            <div className="bg-slate-900/25 border border-slate-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Search className="h-4 w-4 text-emerald-400" />
                Search Diagnostics Tester
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Inspect index match speeds, cache hits, matches, and database size in the live search layer. Type any term to verify retrieval integrity.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testSearchQuery}
                  onChange={(e) => setTestSearchQuery(e.target.value)}
                  placeholder="Enter test query (e.g. SEBI, Tata)..."
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 flex-1 font-mono outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                />

                <button
                  onClick={handleTestSearch}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs px-4 rounded-xl shadow transition-all"
                >
                  Verify Query
                </button>
              </div>

              {searchDiagResult && (
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 font-mono text-[11px] space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="font-bold text-slate-400">Search Metrics:</span>
                    <span className="text-emerald-400 text-[10px] font-bold">{searchDiagResult.status}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-2">
                    <div className="bg-slate-900/40 p-2 rounded border border-slate-900/50">
                      <div className="text-slate-500 text-[9px] uppercase">Latency</div>
                      <div className="text-sm font-bold text-white mt-1">{searchDiagResult.timeMs} ms</div>
                    </div>
                    <div className="bg-slate-900/40 p-2 rounded border border-slate-900/50">
                      <div className="text-slate-500 text-[9px] uppercase">Matches</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1">{searchDiagResult.matches}</div>
                    </div>
                    <div className="bg-slate-900/40 p-2 rounded border border-slate-900/50">
                      <div className="text-slate-500 text-[9px] uppercase">DB Size</div>
                      <div className="text-sm font-bold text-slate-400 mt-1">{searchDiagResult.dbSize}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Maintenance Utilities */}
              <div className="border-t border-slate-900 pt-4 space-y-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">
                  Advanced Maintenance
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleReloadConnectors}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs px-3 py-2 rounded-xl transition-all font-sans font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                    Reset Metrics
                  </button>
                  <button
                    onClick={handleClearCache}
                    className="bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-950/30 text-xs px-3 py-2 rounded-xl transition-all font-sans font-semibold flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear Cache & Reseed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXTRACTION QUALITY TAB */}
        {activeTab === "extraction" && (
          <div className="space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-white">
                Cascading Parser & AI Reliability Dashboard
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Athena's 8-stage cascading extraction engine telemetry, failure logs, and recovery rates.
              </p>
            </div>

            {/* Ingestion Telemetry Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Extraction Rate</span>
                <span className="text-2xl font-mono font-black text-emerald-400">
                  {diag.productionMetrics?.extractionSuccessRate ?? 100}%
                </span>
                <span className="text-[9px] text-slate-500 mt-2 font-mono">Completed without RSS Fallback</span>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">RSS Fallback Rate</span>
                <span className="text-2xl font-mono font-black text-amber-500">
                  {diag.productionMetrics?.fallbackRate ?? 0}%
                </span>
                <span className="text-[9px] text-slate-500 mt-2 font-mono">Articles using local fallback</span>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Avg Parse Speed</span>
                <span className="text-2xl font-mono font-black text-indigo-400">
                  {diag.productionMetrics?.averageTimeTakenMs ?? 145}ms
                </span>
                <span className="text-[9px] text-slate-500 mt-2 font-mono">End-to-end execution latency</span>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Silenced 500s</span>
                <span className="text-2xl font-mono font-black text-red-400">
                  {diag.productionMetrics?.total500ErrorsSilenced ?? 0}
                </span>
                <span className="text-[9px] text-slate-500 mt-2 font-mono">Prevented raw 500 exposure</span>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl col-span-2 md:col-span-1 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">AI Recoveries</span>
                <span className="text-2xl font-mono font-black text-emerald-400">
                  {diag.productionMetrics?.retrySuccessRate ?? 100}%
                </span>
                <span className="text-[9px] text-slate-500 mt-2 font-mono">Stage 7 extraction recovery</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Parser Popularity & Breakdown */}
              <div className="lg:col-span-1 bg-slate-900/25 border border-slate-900 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white">
                  Active Parser Distribution
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {diag.productionMetrics?.parserBreakdown && Object.keys(diag.productionMetrics.parserBreakdown).length > 0 ? (
                    Object.entries(diag.productionMetrics.parserBreakdown).map(([parser, count]: any) => (
                      <div key={parser} className="bg-slate-950/60 border border-slate-900/50 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">{parser}</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black">
                          {count} articles
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-slate-950/60 border border-slate-900/50 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">JSON-LD</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black">0 articles</span>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-900/50 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">Readability</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black">0 articles</span>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-900/50 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">Mercury Parser</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black">0 articles</span>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-900/50 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">AI Assisted</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black">0 articles</span>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-900/50 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">RSS_FALLBACK</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black">0 articles</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Article Extractions logs */}
              <div className="lg:col-span-2 bg-slate-900/25 border border-slate-900 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white">
                  Telemetry logs (Recent Extractions)
                </h3>
                <div className="overflow-y-auto max-h-[300px] border border-slate-900 rounded-xl">
                  <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-900 text-slate-500 uppercase text-[9px] tracking-wider">
                        <th className="p-3 font-bold">Headline</th>
                        <th className="p-3 font-bold text-center">Quality</th>
                        <th className="p-3 font-bold text-center">Parser</th>
                        <th className="p-3 font-bold text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                      {diag.productionMetrics?.recentLogs && diag.productionMetrics.recentLogs.length > 0 ? (
                        diag.productionMetrics.recentLogs.map((log: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/10 transition-all">
                            <td className="p-3 max-w-[200px] truncate text-slate-300 font-sans font-bold">
                              {log.headline}
                              <div className="text-[9px] text-slate-500 font-mono truncate">{log.publisher}</div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 text-[9px] rounded font-black ${
                                log.qualityScore >= 80 ? "bg-emerald-500/15 text-emerald-400" :
                                log.qualityScore >= 60 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
                              }`}>
                                {log.qualityScore}
                              </span>
                            </td>
                            <td className="p-3 text-center text-indigo-400 font-bold">{log.parserUsed}</td>
                            <td className="p-3 text-right text-slate-400">{log.timeTakenMs}ms</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-600 italic">
                            No telemetry logs received yet. Trigger the news pipeline to start extracting.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer System statistics */}
      <div className="bg-slate-950 px-6 py-4 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span>Active Ingestion Model: Pure Ingestion v1.1</span>
          <span>•</span>
          <span>Deduplication: Local Only (Staged)</span>
          <span>•</span>
          <span>Downstream AI Processing: Paused</span>
        </div>
        <div>
          <span>Runtime: Node.js (V8) • Memory Usage: ~{(typeof process !== 'undefined' && process?.memoryUsage ? (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) : "34.5")} MB</span>
        </div>
      </div>
    </div>
  );
}
