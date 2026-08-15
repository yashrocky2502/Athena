import React, { useState, useEffect } from "react";
import { 
  Database, 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Play, 
  Trash2, 
  ArrowRight,
  Sparkles,
  Layers,
  Check
} from "lucide-react";
import { MCPOrchestrator, OrchestratorStatus } from "../mcp/MCPOrchestrator";
import { IntelligenceCoordinator } from "../mcp/IntelligenceCoordinator";
import { CoordinatorStatus } from "../types";

export default function McpMonitorPanel() {
  const orchestrator = MCPOrchestrator.getInstance();
  const coordinator = IntelligenceCoordinator.getInstance();
  
  const [status, setStatus] = useState<OrchestratorStatus>(orchestrator.getStatus());
  const [coordStatus, setCoordStatus] = useState<CoordinatorStatus>(coordinator.getStatus());
  const [changedQueue, setChangedQueue] = useState<any[]>(orchestrator.getChangedQueue());
  
  const [syncingAll, setSyncingAll] = useState(false);
  const [justInjected, setJustInjected] = useState(false);

  // Sync state with orchestrator changes
  useEffect(() => {
    const unsubscribe = orchestrator.subscribe(() => {
      setStatus(orchestrator.getStatus());
      setChangedQueue(orchestrator.getChangedQueue());
      setCoordStatus(coordinator.getStatus());
    });
    
    const coordInterval = setInterval(() => {
      setCoordStatus(coordinator.getStatus());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(coordInterval);
    };
  }, []);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    await orchestrator.syncAll();
    setSyncingAll(false);
  };

  const handleSimulateEvent = () => {
    orchestrator.simulateRandomMarketEvent();
    setJustInjected(true);
    setTimeout(() => setJustInjected(false), 2000);
  };

  const handleClearTelemetry = () => {
    orchestrator.clearQueue();
  };

  const getStatusIcon = (statusStr: string) => {
    switch (statusStr) {
      case "online":
        return (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Online</span>
          </div>
        );
      case "syncing":
        return (
          <div className="flex items-center gap-1.5 text-indigo-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Syncing</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 text-rose-400">
            <XCircle className="h-3 w-3" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Offline</span>
          </div>
        );
    }
  };

  const formatInterval = (ms: number): string => {
    const mins = ms / 60000;
    if (mins < 1) {
      return `${ms / 1000}s`;
    }
    return `${mins} min`;
  };

  return (
    <div className="flex flex-col gap-5 text-left" id="athena-mcp-monitor-panel">
      
      {/* Upper Global Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-900">
        
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">MCP Scheduler</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`h-2 w-2 rounded-full ${status.isRunning ? "bg-emerald-500" : "bg-rose-500"}`}></span>
            <span className="text-xs font-bold text-white uppercase">{status.isRunning ? "Active" : "Stopped"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Total Scanned</span>
          <span className="text-lg font-bold text-white font-mono">{status.globalMetrics.totalProcessed}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Changes Detected</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">{status.globalMetrics.totalChanged}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">Dispatched</span>
          <span className="text-xs font-bold text-slate-300 font-mono mt-1">
            {status.globalMetrics.lastDispatchTime === "None" ? "No Events" : status.globalMetrics.lastDispatchTime}
          </span>
        </div>

      </div>

      {/* Orchestrator Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/30 p-3 rounded-xl border border-slate-900">
        <span className="text-xs font-bold text-slate-300 font-mono">Telemetry Action Deck:</span>
        <div className="flex items-center gap-2">
          {/* Sync All */}
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-50 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${syncingAll ? "animate-spin" : ""}`} />
            <span>{syncingAll ? "Syncing..." : "Sync All"}</span>
          </button>

          {/* Inject Event */}
          <button
            onClick={handleSimulateEvent}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              justInjected 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            {justInjected ? (
              <>
                <Check className="h-3 w-3 animate-bounce" />
                <span>Event Injected!</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                <span>Simulate Event</span>
              </>
            )}
          </button>

          {/* Reset Stats */}
          <button
            onClick={handleClearTelemetry}
            className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-950/40 rounded-lg hover:bg-slate-950 border border-slate-900 transition-all cursor-pointer"
            title="Clear all statistics and event queue"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Coordinator Health & Quota Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">
            Intelligence Coordinator Status
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono font-bold uppercase ${coordStatus.status === "Online" ? "text-emerald-400" : "text-amber-400"}`}>
              {coordStatus.status}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-900">
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-mono uppercase">API Budget</span>
            <span className={`text-sm font-bold font-mono ${coordStatus.apiBudgetRemaining < 20 ? "text-rose-400" : "text-emerald-400"}`}>
              {coordStatus.apiBudgetRemaining}%
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-mono uppercase">Calls Saved</span>
            <span className="text-sm font-bold text-white font-mono">{coordStatus.callsSavedCount}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-mono uppercase">Cache Hit %</span>
            <span className="text-sm font-bold text-indigo-400 font-mono">{coordStatus.cacheHitRatio}%</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-mono uppercase">Queue</span>
            <span className="text-sm font-bold text-white font-mono">{coordStatus.queueLength}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-mono uppercase">Latency</span>
            <span className="text-sm font-bold text-slate-300 font-mono">{coordStatus.averageLatency}ms</span>
          </div>
        </div>
      </div>

      {/* Connectors Table/Grid */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">
          Registered Connectors ({status.connectors.length})
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {status.connectors.map((c) => (
            <div 
              key={c.name}
              className="p-4 rounded-xl border border-slate-900 bg-slate-900/40 flex flex-col justify-between gap-3 text-left"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-950 pb-2">
                <div>
                  <span className="text-xs font-bold text-white block font-sans">{c.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">
                    Interval: {formatInterval(c.refreshInterval)} • Priority: {c.priority}
                  </span>
                </div>
                {getStatusIcon(c.status)}
              </div>

              {/* Stats Metrics Grid */}
              <div className="grid grid-cols-5 gap-2 text-center bg-slate-950 p-2 rounded-lg border border-slate-900">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-mono uppercase">Scanned</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5">{c.metrics.recordsProcessed}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-mono uppercase">Changes</span>
                  <span className={`text-xs font-bold font-mono mt-0.5 ${c.metrics.changedRecords > 0 ? "text-emerald-400" : "text-white"}`}>
                    {c.metrics.changedRecords}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-mono uppercase">Avg Resp</span>
                  <span className="text-xs font-bold text-slate-300 font-mono mt-0.5">{c.metrics.averageResponseTime || c.metrics.averageLatency || 0}ms</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-mono uppercase">Success</span>
                  <span className={`text-xs font-bold font-mono mt-0.5 ${c.metrics.successRate < 100 ? "text-amber-400" : "text-emerald-400"}`}>{c.metrics.successRate ?? 100}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-mono uppercase">Errors</span>
                  <span className={`text-xs font-bold font-mono mt-0.5 ${c.metrics.errorCount > 0 ? "text-rose-400" : "text-slate-300"}`}>{c.metrics.errorCount ?? 0}</span>
                </div>
              </div>

              {/* Last successful execution */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Last Sync: {c.lastSync}</span>
                {c.metrics.lastError ? (
                  <span className="text-rose-400 flex items-center gap-1" title={c.metrics.lastError}>
                    <AlertTriangle className="h-3 w-3" /> Error
                  </span>
                ) : (
                  <span className="text-emerald-500">Verified Health</span>
                )}
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Live Dispatched Event Queue */}
      <div className="flex flex-col gap-2.5 mt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">
            Live Dispatched Ingestion Queue ({changedQueue.length})
          </span>
          <span className="text-[9px] text-slate-600 font-mono">Showing last 50 events</span>
        </div>

        {changedQueue.length === 0 ? (
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-8 text-center text-xs text-slate-500">
            Ingestion queue empty. No new changes detected yet. 
            <p className="mt-1.5 text-[10px] text-slate-600">
              Tip: Tap "Simulate Event" above to instantly push and observe high-impact corporate filings through change detection.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-900">
            {changedQueue.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-900 text-xs flex flex-col gap-1.5 text-left animate-in fade-in duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20 font-mono uppercase font-bold">
                      {item.source}
                    </span>
                    {item.companies && item.companies.length > 0 && (
                      <span className="text-[9px] bg-indigo-500/15 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">
                        {item.companies.join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString("en-IN", { hour12: true })}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-white text-xs leading-snug">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-normal mt-1">{item.description}</p>
                </div>

                <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono border-t border-slate-950 pt-1.5 mt-0.5">
                  <span className="text-emerald-400">● Forwarded to EvidenceEngine</span>
                  <span>•</span>
                  <span className="text-indigo-400">● Forwarded to EventProcessingEngine</span>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
