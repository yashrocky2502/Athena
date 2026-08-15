import React, { useState, useEffect } from "react";
import { LiveIntelligenceEngine } from "../services/LiveIntelligenceEngine";
import { Play, Square, Activity, Clock, Cpu, RefreshCw, AlertTriangle } from "lucide-react";

export function LiveIntelligenceMonitor() {
  const [status, setStatus] = useState(() => LiveIntelligenceEngine.getInstance().getStatus());
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    // Poll the status of the live intelligence engine every 1 second to keep UI fresh
    const interval = setInterval(() => {
      setStatus(LiveIntelligenceEngine.getInstance().getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleEngine = () => {
    setToggleLoading(true);
    const engine = LiveIntelligenceEngine.getInstance();
    if (status.isRunning) {
      engine.stop();
    } else {
      engine.start();
    }
    setStatus(engine.getStatus());
    setTimeout(() => setToggleLoading(false), 300);
  };

  const handleToggleMarketForce = () => {
    const engine = LiveIntelligenceEngine.getInstance();
    engine.setForceMarketOpen(!status.forceMarketOpen);
    setStatus(engine.getStatus());
  };

  return (
    <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 text-left flex flex-col gap-6" id="athena-live-intel-monitor">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-850 pb-5">
        <div>
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
            Live Intelligence Engine
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Autonomous market monitoring, price delta evaluation, and systemic fact classification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Toggle Button */}
          <button
            onClick={handleToggleEngine}
            disabled={toggleLoading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              status.isRunning
                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {status.isRunning ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                STOP MONITORING
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                START MONITORING
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid of Key Telemetry */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Engine Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full ${status.isRunning ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
            <span className="text-sm font-mono font-bold text-white">
              {status.isRunning ? "RUNNING" : "STOPPED"}
            </span>
          </div>
        </div>

        {/* Polling Latency */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Last Sync Latency</span>
          <span className="text-sm font-mono font-bold text-indigo-400 mt-1">
            {status.pollingLatency > 0 ? `${status.pollingLatency}ms` : "0ms"}
          </span>
        </div>

        {/* Last Poll */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Last Check Time</span>
          <span className="text-sm font-mono font-semibold text-slate-300 mt-1">
            {status.lastPollTime}
          </span>
        </div>

        {/* Next Poll Countdown */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Next Price Tick</span>
          <span className="text-sm font-mono font-semibold text-emerald-400 mt-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {status.isRunning ? status.nextPollTime : "Suspended"}
          </span>
        </div>
      </div>

      {/* Live Pipeline Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 text-center">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Traces Analyzed Today</span>
          <p className="text-lg font-mono font-extrabold text-white mt-1">{status.eventsDetectedToday}</p>
        </div>

        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 text-center">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Evidence Generated</span>
          <p className="text-lg font-mono font-extrabold text-indigo-400 mt-1">{status.evidenceCreated}</p>
        </div>

        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 text-center">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Alert Decisions</span>
          <p className="text-lg font-mono font-extrabold text-amber-500 mt-1">{status.alertsGenerated}</p>
        </div>

        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 text-center">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Notifications Sent</span>
          <p className="text-lg font-mono font-extrabold text-emerald-400 mt-1">{status.notificationsSent}</p>
        </div>

        <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 text-center col-span-2 md:col-span-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Outgoing Queue</span>
          <p className="text-lg font-mono font-extrabold text-rose-400 mt-1">{status.queueLength}</p>
        </div>
      </div>

      {/* Override / Simulation Panel */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
            Market Integration Controls
          </span>
          <h4 className="font-display font-bold text-sm text-white mt-2">Force Active Indian Market hours</h4>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
            Bypass standard NSE/BSE weekdays 9:15 AM - 3:30 PM schedule. Force the engine to execute high-frequency price and forex polling cycles.
          </p>
        </div>

        <button
          onClick={handleToggleMarketForce}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
            status.forceMarketOpen
              ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white"
          }`}
        >
          {status.forceMarketOpen ? "FORCE OPEN: ACTIVE" : "DEFAULT SCHEDULE"}
        </button>
      </div>

      {/* Active Providers Status */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Configured Providers & Sync Schedules</span>
          <span className="text-[10px] text-slate-500 font-mono">{status.providersActive.length} Active</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Prices */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">Market Prices</span>
            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/10">
              Every 10s
            </span>
          </div>

          {/* Crypto */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">Crypto Price Monitor</span>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/10">
              Every 30s
            </span>
          </div>

          {/* Forex */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">Forex Rates Monitor</span>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/10">
              Every 1m
            </span>
          </div>

          {/* News */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">News RSS Feed</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Every 2m
            </span>
          </div>

          {/* Corporate Actions */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">Corporate Actions</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Every 10m
            </span>
          </div>

          {/* NSE Circulars */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">NSE Circulars</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Every 10m
            </span>
          </div>

          {/* SEBI Orders */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">SEBI Orders</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Every 15m
            </span>
          </div>

          {/* RBI Updates */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
            <span className="text-xs text-slate-300 font-medium">RBI Updates</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Every 30m
            </span>
          </div>

          {/* Macro Data */}
          <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 flex justify-between items-center sm:col-span-2">
            <span className="text-xs text-slate-300 font-medium">Macro Economic Data</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Every 30m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
