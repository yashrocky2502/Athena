import React, { useState, useEffect } from "react";
import { AlertDecisionEngine } from "../services/AlertDecisionEngine";
import { AlertDecision, Priority } from "../types";
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  BarChart3,
  Terminal,
  Activity,
  History,
  Send,
  RefreshCw,
  Layers,
  Cpu
} from "lucide-react";

export default function AlertAuditPanel() {
  const [activeTab, setActiveTab] = useState<"telegram" | "suppression">("telegram");
  
  // Suppression tab state
  const [suppressionLogs, setSuppressionLogs] = useState<AlertDecision[]>([]);
  const [suppressionFilter, setSuppressionFilter] = useState<string>("");
  const [suppressionDecisionFilter, setSuppressionDecisionFilter] = useState<"All" | "Notify" | "Suppress">("All");

  // Telegram tab state
  const [telegramLogs, setTelegramLogs] = useState<any[]>([]);
  const [telegramFilter, setTelegramFilter] = useState<string>("");
  const [telegramEligibleFilter, setTelegramEligibleFilter] = useState<"All" | "Eligible" | "Ineligible">("All");
  const [loadingTelegram, setLoadingTelegram] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  // Load suppression logs
  useEffect(() => {
    const engine = AlertDecisionEngine.getInstance();
    setSuppressionLogs(engine.getDecisionLogs());

    const interval = setInterval(() => {
      setSuppressionLogs(engine.getDecisionLogs());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch Telegram logs
  const fetchTelegramLogs = async (silent = false) => {
    if (!silent) setLoadingTelegram(true);
    try {
      const res = await fetch("/api/v3/news/telegram-audit");
      const data = await res.json();
      if (data.success && data.logs) {
        setTelegramLogs(data.logs);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to fetch Telegram logs", err);
    } finally {
      if (!silent) setLoadingTelegram(false);
    }
  };

  useEffect(() => {
    if (activeTab === "telegram") {
      fetchTelegramLogs();
      const interval = setInterval(() => {
        fetchTelegramLogs(true);
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Filters for Suppression
  const filteredSuppressionLogs = suppressionLogs.filter(log => {
    const matchesSearch = 
      (log.title || "").toLowerCase().includes((suppressionFilter || "").toLowerCase()) || 
      (log.company || "").toLowerCase().includes((suppressionFilter || "").toLowerCase()) ||
      (log.category || "").toLowerCase().includes((suppressionFilter || "").toLowerCase());
    
    const matchesDecision = suppressionDecisionFilter === "All" || log.decision === suppressionDecisionFilter;
    
    return matchesSearch && matchesDecision;
  });

  const suppressionStats = {
    total: suppressionLogs.length,
    delivered: suppressionLogs.filter(l => l.decision === "Notify").length,
    suppressed: suppressionLogs.filter(l => l.decision === "Suppress").length,
    avgLatency: suppressionLogs.length > 0 ? Math.round(suppressionLogs.reduce((acc, curr) => acc + curr.latencyMs, 0) / suppressionLogs.length) : 0
  };

  // Filters for Telegram
  const filteredTelegramLogs = telegramLogs.filter(log => {
    const matchesSearch = 
      (log.headline || "").toLowerCase().includes((telegramFilter || "").toLowerCase()) || 
      (log.company || "").toLowerCase().includes((telegramFilter || "").toLowerCase()) ||
      (log.symbol || "").toLowerCase().includes((telegramFilter || "").toLowerCase()) ||
      (log.reason || "").toLowerCase().includes((telegramFilter || "").toLowerCase());
    
    const matchesEligible = 
      telegramEligibleFilter === "All" || 
      (telegramEligibleFilter === "Eligible" && log.alertEligible) || 
      (telegramEligibleFilter === "Ineligible" && !log.alertEligible);

    return matchesSearch && matchesEligible;
  });

  const telegramStats = {
    total: telegramLogs.length,
    eligible: telegramLogs.filter(l => l.alertEligible).length,
    sent: telegramLogs.filter(l => l.queued || l.telegramSent).length,
    delivered: telegramLogs.filter(l => l.delivered).length
  };

  return (
    <div className="flex flex-col gap-6 bg-slate-950 min-h-screen p-4 sm:p-6 pb-20 text-slate-100">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-2">
        <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl w-max">
          <button
            onClick={() => setActiveTab("telegram")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "telegram"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Send size={14} />
            Telegram Delivery Audit (ATHENA V6.8.1)
          </button>
          <button
            onClick={() => setActiveTab("suppression")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "suppression"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert size={14} />
            Notification Suppression
          </button>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          <Activity size={12} className="text-emerald-500 animate-pulse" />
          ACTIVE ENGINE STATUS: ACTIVE
        </div>
      </div>

      {/* RENDER TELEGRAM AUDIT TAB */}
      {activeTab === "telegram" && (
        <div className="flex flex-col gap-6">
          {/* Header & Stats */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Telegram Dispatch & Queue Audit</h1>
                <p className="text-xs text-slate-500">Live monitoring of the 9-stage Indian F&O integrity check and delivery pipeline</p>
              </div>
              <button 
                onClick={() => fetchTelegramLogs()}
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <RefreshCw size={13} className={loadingTelegram ? "animate-spin" : ""} />
                {lastRefreshed ? `Refreshed ${lastRefreshed}` : "Refresh"}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Ingested & Resolved" value={telegramStats.total} icon={History} color="indigo" />
              <StatCard label="Eligible (F&O Passed)" value={telegramStats.eligible} icon={Cpu} color="indigo" />
              <StatCard label="Queued & Sent" value={telegramStats.sent} icon={Send} color="indigo" />
              <StatCard label="Delivered" value={telegramStats.delivered} icon={CheckCircle2} color="emerald" />
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Search ticker, company or rejection code..."
                value={telegramFilter}
                onChange={(e) => setTelegramFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-100"
              />
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <Filter size={16} className="text-slate-500" />
              <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                {(["All", "Eligible", "Ineligible"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setTelegramEligibleFilter(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      telegramEligibleFilter === d 
                        ? "bg-indigo-500 text-white shadow-lg" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audit List */}
          <div className="flex flex-col gap-3">
            {filteredTelegramLogs.length > 0 ? (
              filteredTelegramLogs.map((log, idx) => (
                <TelegramAuditItem key={`${log.articleId}-${idx}`} log={log} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                <Terminal size={48} className="text-slate-800 mb-4" />
                <p className="text-slate-500 font-medium">No Telegram delivery logs found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER ORIGINAL SUPPRESSION TAB */}
      {activeTab === "suppression" && (
        <div className="flex flex-col gap-6">
          {/* Header & Stats */}
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Alert Suppression & Cooldown Audit</h1>
              <p className="text-xs text-slate-500">Monitoring real-time suppressions, rate-limiting, and alert thresholds</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Processed" value={suppressionStats.total} icon={History} color="indigo" />
              <StatCard label="Suppressed" value={suppressionStats.suppressed} icon={XCircle} color="rose" />
              <StatCard label="Delivered" value={suppressionStats.delivered} icon={CheckCircle2} color="emerald" />
              <StatCard label="Avg Latency" value={`${suppressionStats.avgLatency}ms`} icon={Clock} color="amber" />
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Search events, companies..."
                value={suppressionFilter}
                onChange={(e) => setSuppressionFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-100"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-500" />
              <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                {(["All", "Notify", "Suppress"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSuppressionDecisionFilter(d)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      suppressionDecisionFilter === d 
                        ? "bg-indigo-500 text-white shadow-lg" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audit List */}
          <div className="flex flex-col gap-3">
            {filteredSuppressionLogs.length > 0 ? (
              filteredSuppressionLogs.map((log, idx) => (
                <SuppressionAuditItem key={`${log.alertId}-${idx}`} log={log} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                <Terminal size={48} className="text-slate-800 mb-4" />
                <p className="text-slate-500 font-medium">No suppression audit events found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20"
  };

  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} flex flex-col gap-2 bg-slate-900/30`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
        <Icon size={16} />
      </div>
      <span className="text-2xl font-mono font-bold">{value}</span>
    </div>
  );
}

// Renders Telegram Log Items
function TelegramAuditItem({ log }: { log: any; key?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-slate-900 border ${log.delivered ? 'border-emerald-500/20' : (log.alertEligible ? 'border-indigo-500/20' : 'border-slate-800')} rounded-2xl overflow-hidden transition-all duration-300 ${expanded ? 'ring-1 ring-indigo-500/30' : ''}`}>
      <div 
        className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Status icon */}
          <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${log.delivered ? 'bg-emerald-500/10 text-emerald-400' : (log.alertEligible ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-850 text-slate-500')}`}>
            {log.delivered ? <CheckCircle2 size={18} /> : (log.alertEligible ? <Send size={18} className="animate-pulse" /> : <XCircle size={18} />)}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono">
              <span className={log.delivered ? 'text-emerald-400 font-bold' : (log.alertEligible ? 'text-indigo-400 font-bold' : 'text-slate-500')}>
                {log.deliveryStatus || (log.delivered ? 'DELIVERED' : (log.queued ? 'QUEUED' : 'REJECTED'))}
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-slate-400 font-bold tracking-wider">{log.symbol || 'UNRESOLVED'}</span>
              <span className="text-slate-700">•</span>
              <span className="text-slate-500">{new Date(log.processedAtIso).toLocaleTimeString()}</span>
              <span className="text-slate-700">•</span>
              <span className="text-indigo-400 font-medium">{log.source || log.publisher}</span>
            </div>

            <h3 className="text-sm font-bold text-white leading-snug">{log.headline}</h3>

            <div className="flex flex-wrap gap-2 mt-1.5">
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-slate-400">
                F&O stock: {log.isFO ? '✅ YES' : '❌ NO'}
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-slate-400">
                Priority: {log.priorityLevel} ({log.aiPriority})
              </span>
              {log.chatId && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-indigo-300">
                  Channel: {log.chatId}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="flex flex-col items-end gap-1 font-mono text-right">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border leading-none ${
              log.delivered ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              log.alertEligible ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
              'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              {log.delivered ? 'SENT' : (log.alertEligible ? 'QUEUED' : 'REJECTED')}
            </span>
            <span className="text-[9px] text-slate-600">
              {log.latencyMs}ms latency
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-5 pt-3 border-t border-slate-800/60 bg-slate-950/45 space-y-4 text-xs animate-in slide-in-from-top-1 duration-150">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider font-mono">Audit Specifications</h4>
              <div className="space-y-1.5 font-mono text-[11px] bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Company Resolved:</span>
                  <span className="text-white font-bold">{log.company || 'Unknown'} ({log.symbol || 'N/A'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Indian F&O Stock:</span>
                  <span className={log.isFO ? "text-emerald-400 font-bold" : "text-slate-500"}>{log.isFO ? "TRUE" : "FALSE"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telegram Eligible:</span>
                  <span className={log.alertEligible ? "text-emerald-400 font-bold" : "text-slate-500"}>{log.alertEligible ? "TRUE" : "FALSE"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Worker Picked:</span>
                  <span className={log.queued ? "text-indigo-400 font-bold" : "text-slate-500"}>{log.queued ? "TRUE (QUEUED)" : "FALSE"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">API Success/Failure:</span>
                  <span className={log.telegramSent ? "text-emerald-400 font-bold" : "text-rose-400"}>{log.telegramSent ? "SUCCESS" : "FAILED / N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery Status:</span>
                  <span className={log.delivered ? "text-emerald-400 font-bold" : "text-slate-500"}>{log.delivered ? "DELIVERED" : "SKIPPED / PENDING"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Message ID:</span>
                  <span className="text-slate-100 select-all">{log.messageId || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider font-mono">Audit Outcome & Rejection Details</h4>
              <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 h-[135px] flex flex-col justify-center overflow-y-auto">
                <span className="text-[10px] text-slate-500 uppercase font-bold font-mono">Decision Reason / Rejection Code:</span>
                <p className="text-slate-200 mt-1 font-mono font-bold text-xs">{log.reason}</p>
                
                {log.exactRejectionReason && (
                  <div className="mt-2.5 border-t border-slate-900/60 pt-2 flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Exact Audit Context / Reason:</span>
                    <p className="text-slate-300 mt-0.5 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">{log.exactRejectionReason}</p>
                  </div>
                )}
                {log.failureReason && (
                  <div className="mt-2.5 border-t border-slate-900/60 pt-2 flex flex-col">
                    <span className="text-[10px] text-rose-400 uppercase font-mono">API Failure Message:</span>
                    <p className="text-rose-300 mt-0.5 text-xs font-mono">{log.failureReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline visual steps */}
          {log.steps && log.steps.length > 0 && (
            <div className="space-y-2 pt-1">
              <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider font-mono">Pipeline Stage Execution Detail</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-9 gap-2">
                {log.steps.map((step: any, sIdx: number) => {
                  const statusColors: any = {
                    PASSED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                    SKIPPED: "bg-slate-800 text-slate-500 border-slate-700/60"
                  };
                  return (
                    <div key={sIdx} className={`p-2 rounded-xl border ${statusColors[step.status] || statusColors.SKIPPED} flex flex-col justify-between h-16 min-w-0 font-mono text-[9px]`}>
                      <span className="text-slate-500 font-bold block truncate">#{step.stepNumber} {step.stepName}</span>
                      <div className="flex items-center justify-between mt-1 leading-none">
                        <span className="font-bold tracking-tight">{step.status}</span>
                        <span className="text-[8px] opacity-60">{step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Renders Suppression Log Items
function SuppressionAuditItem({ log }: { log: AlertDecision; key?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-slate-900 border ${log.decision === 'Notify' ? 'border-emerald-500/20' : 'border-slate-800'} rounded-2xl overflow-hidden transition-all duration-300 ${expanded ? 'ring-1 ring-slate-700' : ''}`}>
      <div 
        className="p-4 flex items-start gap-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`mt-1 p-2 rounded-lg ${log.decision === 'Notify' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {log.decision === 'Notify' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        </div>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold mb-1">
            <span className={log.decision === 'Notify' ? 'text-emerald-400' : 'text-rose-400'}>
              {log.decision === 'Notify' ? 'DELIVERED' : 'SUPPRESSED'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-400">{log.category}</span>
          </div>
          
          <h3 className="text-sm font-bold text-white truncate">{log.title}</h3>
          
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Company:</span>
              <span className="text-xs font-semibold text-slate-300">{log.company}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Impact:</span>
              <span className={`text-xs font-bold ${log.impactScore > 70 ? 'text-amber-400' : 'text-slate-400'}`}>
                {log.impactScore}/100
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Conf:</span>
              <span className={`text-xs font-bold ${log.detectionConfidence > 80 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {log.detectionConfidence}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
             log.priority === Priority.Critical ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
             log.priority === Priority.High ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
             'bg-slate-800 text-slate-400 border-slate-700'
           }`}>
             {log.priority}
           </span>
           <span className="text-[10px] font-mono text-slate-600">{log.latencyMs}ms</span>
        </div>
      </div>

      {expanded && (
        <div className="px-14 pb-4 pt-2 border-t border-slate-800/50 bg-slate-950/50 flex flex-col gap-4 animate-in slide-in-from-top-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason for {log.decision}</span>
            <p className={`text-xs font-medium leading-relaxed ${log.decision === 'Notify' ? 'text-emerald-200' : 'text-rose-200'}`}>
              {log.reason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detection Logic</span>
              <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Detection Confidence:</span>
                  <span className="font-mono text-white">{log.detectionConfidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Impact Magnitude:</span>
                  <span className="font-mono text-white">{log.impactScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Priority Assigned:</span>
                  <span className="font-mono text-white">{log.priority}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sources & Context</span>
              <div className="flex flex-wrap gap-1">
                {log.evidenceUsed.map((s, i) => (
                  <span key={i} className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {log.traceId && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/30">
               <Terminal size={10} className="text-slate-600" />
               <span className="text-[9px] font-mono text-slate-600">TRACE ID: {log.traceId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
