import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  AlertTriangle, 
  TrendingUp, 
  Volume2, 
  FileText, 
  Check, 
  PlusCircle, 
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  Zap,
  Terminal,
  Activity,
  ExternalLink,
  ChevronRight,
  Radio,
  Loader2
} from "lucide-react";
import { AlertDecisionEngine } from "../services/AlertDecisionEngine";
import { AthenaAlert, Priority } from "../types";
import AlertTestPanel from "./AlertTestPanel";
import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";
import { safeLocalStorage } from "../services/storage/safeStorage";

interface AlertItem {
  id: string;
  symbol: string;
  name: string;
  type: "price" | "volume" | "filing" | "f_o";
  condition: string;
  isActive: boolean;
  timestamp: string;
}

export default function AlertsManager({ developerMode }: { developerMode?: boolean }) {
  const alertEngine = AlertDecisionEngine.getInstance();
  const [activeTab, setActiveTab] = useState<"telegram" | "history" | "triggers" | "dev">("telegram");
  const [history, setHistory] = useState<AthenaAlert[]>(alertEngine.getAlertHistory());
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  // Telegram Terminal State
  const [telegramStatus, setTelegramStatus] = useState<{
    connected: boolean;
    status: string;
    botUsername: string | null;
    chatIdMasked: string;
    lastVerifiedAt: string | null;
    lastSuccessfulMessageId: number | null;
    lastSuccessfulMessageAt: string | null;
    auditModeOnly?: boolean;
    activatedAt?: string;
    liveNotifications?: number;
    suppressedCount?: number;
    digestPendingCount?: number;
    sentCount: number;
    failedCount: number;
    lastError: string | null;
    decisionsHistory?: any[];
  } | null>(null);

  const [telegramHistory, setTelegramHistory] = useState<any[]>([]);
  const [decisionsHistory, setDecisionsHistory] = useState<any[]>([]);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);
  const [isTogglingAuditMode, setIsTogglingAuditMode] = useState(false);
  const [isDispatchingDigest, setIsDispatchingDigest] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);

  const fetchTelegramTelemetry = async () => {
    try {
      const [statusRes, historyRes, decisionsRes] = await Promise.all([
        fetch("/api/telegram/status").then(r => r.json()).catch(() => null),
        fetch("/api/telegram/history").then(r => r.json()).catch(() => null),
        fetch("/api/telegram/decisions").then(r => r.json()).catch(() => null)
      ]);

      if (statusRes && statusRes.success) {
        setTelegramStatus(statusRes);
      }
      if (historyRes && historyRes.success && Array.isArray(historyRes.logs)) {
        setTelegramHistory(historyRes.logs);
      }
      if (decisionsRes && decisionsRes.success && Array.isArray(decisionsRes.decisions)) {
        setDecisionsHistory(decisionsRes.decisions);
      }
    } catch (e) {
      console.error("Failed to fetch Telegram telemetry:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "telegram") {
      fetchTelegramTelemetry();
      const interval = setInterval(fetchTelegramTelemetry, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    const saved = safeLocalStorage.getItem("athena-alerts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing alerts:", e);
      }
    }
    return [];
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState("RELIANCE");
  const [newType, setNewType] = useState<"price" | "volume" | "filing" | "f_o">("price");
  const [newCondition, setNewCondition] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    safeLocalStorage.setItem("athena-alerts", JSON.stringify(alerts));
  }, [alerts]);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const getCompanyDisplayName = (symbol: string) => {
    return CompanyIdentityResolver.getInstance().resolveName(symbol);
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCondition.trim()) return;

    const alert: AlertItem = {
      id: `alert-${Date.now()}`,
      symbol: newSymbol,
      name: getCompanyDisplayName(newSymbol),
      type: newType,
      condition: newCondition,
      isActive: true,
      timestamp: "Just now"
    };

    setAlerts(prev => [alert, ...prev]);
    setNewCondition("");
    setShowAddForm(false);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 2500);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.Critical: return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      case Priority.High: return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case Priority.Medium: return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
      case Priority.Low: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case Priority.Critical: return <Zap className="h-4 w-4" />;
      case Priority.High: return <AlertTriangle className="h-4 w-4" />;
      case Priority.Medium: return <Bell className="h-4 w-4" />;
      case Priority.Low: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className={`flex flex-col gap-6 text-left ${activeTab === 'telegram' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto pb-12`} id="athena-alerts-manager-root">
      
      {/* Upper navigation */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-1">
        <div className="flex gap-6 overflow-x-auto">
          <button 
            onClick={() => setActiveTab("telegram")}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-1.5 ${activeTab === "telegram" ? "text-rose-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Telegram Terminal V6.0</span>
            {activeTab === "telegram" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === "history" ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            Intelligence History
            {activeTab === "history" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("triggers")}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === "triggers" ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            Custom Triggers
            {activeTab === "triggers" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>
          {developerMode && (
            <button 
              onClick={() => setActiveTab("dev")}
              className={`pb-3 text-sm font-bold transition-all relative ${activeTab === "dev" ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Decision Telemetry
              {activeTab === "dev" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
            </button>
          )}
        </div>

        {activeTab === "triggers" && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] rounded-lg px-3 py-1.5 transition-all uppercase tracking-wider"
          >
            <Plus className="h-3 w-3" />
            <span>New Trigger</span>
          </button>
        )}
      </div>

      {activeTab === "telegram" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Header Card / Status Dashboard */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/80 pb-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${telegramStatus?.connected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  <Radio className={`h-6 w-6 ${telegramStatus?.connected ? "animate-pulse" : ""}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">Telegram Delivery Pipeline</h3>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${telegramStatus?.connected ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border-rose-500/30"}`}>
                      ● {telegramStatus?.connected ? "CONNECTED" : "DISCONNECTED"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live verification and real-time F&O intelligence dispatch channel.
                  </p>
                </div>
              </div>

              {/* Action Buttons & Audit Mode Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  disabled={isTogglingAuditMode}
                  onClick={async () => {
                    setIsTogglingAuditMode(true);
                    setTestResultMsg(null);
                    try {
                      const nextMode = !telegramStatus?.auditModeOnly;
                      const res = await fetch("/api/telegram/audit-mode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ enabled: nextMode })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setTestResultMsg(`Audit/Dry-Run Mode: ${data.auditModeOnly ? 'ENABLED (Dry-Run)' : 'DISABLED (Live Dispatches)'}`);
                      }
                      fetchTelegramTelemetry();
                    } catch (e: any) {
                      setTestResultMsg(`Audit Mode Toggle Failed: ${e?.message || e}`);
                    } finally {
                      setIsTogglingAuditMode(false);
                    }
                  }}
                  className={`font-bold text-xs rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2 border ${
                    telegramStatus?.auditModeOnly
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>{telegramStatus?.auditModeOnly ? "AUDIT MODE: DRY RUN" : "LIVE MODE: DISPATCH ACTIVE"}</span>
                </button>

                <button
                  disabled={isDispatchingDigest}
                  onClick={async () => {
                    setIsDispatchingDigest(true);
                    setTestResultMsg(null);
                    try {
                      const res = await fetch("/api/telegram/dispatch-digest", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                      });
                      const data = await res.json();
                      if (data.success) {
                        setTestResultMsg(`Digest Dispatched! Items aggregated: ${data.itemCount}`);
                      } else {
                        setTestResultMsg(`Digest Error: ${data.error}`);
                      }
                      fetchTelegramTelemetry();
                    } catch (e: any) {
                      setTestResultMsg(`Digest Failed: ${e?.message || e}`);
                    } finally {
                      setIsDispatchingDigest(false);
                    }
                  }}
                  className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  <span>DISPATCH DIGEST</span>
                </button>

                <button
                  disabled={isTestingConn}
                  onClick={async () => {
                    setIsTestingConn(true);
                    setTestResultMsg(null);
                    try {
                      const res = await fetch("/api/telegram/test-connection", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({})
                      });
                      const data = await res.json();
                      if (data.success) {
                        setTestResultMsg(`Connection Verified! Bot: ${data.bot?.username ? '@' + data.bot.username : 'Active'}`);
                      } else {
                        setTestResultMsg(`Connection Error: ${data.error}`);
                      }
                      fetchTelegramTelemetry();
                    } catch (e: any) {
                      setTestResultMsg(`Test Failed: ${e?.message || e}`);
                    } finally {
                      setIsTestingConn(false);
                    }
                  }}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isTestingConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  <span>TEST</span>
                </button>

                <button
                  disabled={isSendingTestMsg}
                  onClick={async () => {
                    setIsSendingTestMsg(true);
                    setTestResultMsg(null);
                    try {
                      const res = await fetch("/api/telegram/send-test", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({})
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setTestResultMsg(`Test Message Sent! Message ID: #${data.messageId}`);
                      } else {
                        setTestResultMsg(`Delivery Error: ${data.error || 'Failed to send'}`);
                      }
                      fetchTelegramTelemetry();
                    } catch (e: any) {
                      setTestResultMsg(`Send Failed: ${e?.message || e}`);
                    } finally {
                      setIsSendingTestMsg(false);
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSendingTestMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  <span>SEND TEST</span>
                </button>
              </div>
            </div>

            {testResultMsg && (
              <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 flex items-center justify-between">
                <span>{testResultMsg}</span>
                <button onClick={() => setTestResultMsg(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
              </div>
            )}

            {/* Connection Telemetry Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bot Identity</span>
                <span className="text-sm font-bold text-white font-mono mt-1 block">
                  {telegramStatus?.botUsername || 'Not Configured'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Activation Watermark</span>
                <span className="text-xs font-medium text-amber-300 font-mono mt-1 block truncate" title={telegramStatus?.activatedAt}>
                  {telegramStatus?.activatedAt ? new Date(telegramStatus.activatedAt).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Last Verification</span>
                <span className="text-xs font-medium text-slate-300 font-mono mt-1 block">
                  {telegramStatus?.lastVerifiedAt ? new Date(telegramStatus.lastVerifiedAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Last Message ID</span>
                <span className="text-sm font-bold text-emerald-400 font-mono mt-1 block">
                  {telegramStatus?.lastSuccessfulMessageId ? `#${telegramStatus.lastSuccessfulMessageId}` : 'None'}
                </span>
              </div>
            </div>

            {/* Quality Gate Telemetry Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-emerald-500/30 text-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Live Notifications</span>
                <span className="text-2xl font-black text-emerald-300 font-mono mt-1 block">
                  {telegramStatus?.liveNotifications ?? 0}
                </span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-rose-500/30 text-center">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Suppressed</span>
                <span className="text-2xl font-black text-rose-300 font-mono mt-1 block">
                  {telegramStatus?.suppressedCount ?? 0}
                </span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-indigo-500/30 text-center">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Digest Pending</span>
                <span className="text-2xl font-black text-indigo-300 font-mono mt-1 block">
                  {telegramStatus?.digestPendingCount ?? 0}
                </span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-sky-500/30 text-center">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">Total Dispatched</span>
                <span className="text-2xl font-black text-sky-300 font-mono mt-1 block">
                  {telegramStatus?.sentCount ?? 0}
                </span>
              </div>
            </div>

            {telegramStatus?.lastError && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-300">Last Delivery Exception</h4>
                  <p className="text-xs text-rose-200/80 font-mono mt-0.5">{telegramStatus.lastError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Delivery History Section */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-sky-400" />
                Telegram Delivery History & Telemetry
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                Showing last {telegramHistory.length} events
              </span>
            </div>

            {telegramHistory.length === 0 ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                <p className="text-xs text-slate-500">No Telegram dispatch events logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Stock / Subject</th>
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Attempts</th>
                      <th className="py-3 px-3">Telegram Message ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                    {telegramHistory.map((rec) => {
                      const isExpanded = expandedLogId === rec.notificationId;
                      return (
                        <React.Fragment key={rec.notificationId}>
                          <tr
                            onClick={() => setExpandedLogId(isExpanded ? null : rec.notificationId)}
                            className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                              {rec.createdAt ? new Date(rec.createdAt).toLocaleTimeString() : 'N/A'}
                            </td>
                            <td className="py-3 px-3 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-950 px-2 py-0.5 rounded text-indigo-400 border border-slate-800">
                                  {rec.stock || 'MARKET'}
                                </span>
                                <span className="text-slate-300 font-sans text-xs truncate max-w-[200px]">
                                  {rec.headline}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rec.priority === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : rec.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                {rec.priority}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${rec.status === 'SENT' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : rec.status === 'QUEUED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : rec.status === 'SENDING' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                                {rec.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400">
                              {rec.attemptCount ?? 1}/3
                            </td>
                            <td className="py-3 px-3 text-emerald-400 font-bold">
                              {rec.telegramMessageId ? `#${rec.telegramMessageId}` : (rec.errorDescription ? 'FAILED' : 'N/A')}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950/80">
                              <td colSpan={6} className="p-4 border-t border-slate-800">
                                <div className="flex flex-col gap-2 text-xs">
                                  <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                                    <span>Notification ID: {rec.notificationId}</span>
                                    <span>Article ID: {rec.articleId}</span>
                                    {rec.httpStatus && <span>HTTP Status: {rec.httpStatus}</span>}
                                  </div>
                                  {rec.errorDescription && (
                                    <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono">
                                      <b>Error Reason:</b> {rec.errorDescription}
                                    </div>
                                  )}
                                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-slate-200 whitespace-pre-wrap leading-relaxed text-[11px]">
                                    {rec.formattedMessage || rec.headline}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notification Decision Audit Log */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-rose-400" />
                Notification Quality Gate Decision Audit Log
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                Showing evaluated decisions
              </span>
            </div>

            {decisionsHistory.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-center mb-1">
                  <p className="text-xs text-slate-500">No live evaluation decisions logged in this session yet. Showing Quality Gate logic rules with examples:</p>
                </div>
                
                {/* Example 1: TATAMOTORS - IMMEDIATE */}
                <div className="bg-slate-950/60 rounded-xl border border-emerald-500/10 p-4 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">IMMEDIATE</span>
                      <span className="bg-slate-900 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">TATAMOTORS</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Example Scenario</div>
                  </div>
                  <h5 className="font-bold text-white mb-1 font-sans text-xs">Tata Motors Reports Excellent Sales Growth, Net Profit Up 24% YoY</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-2 font-sans">
                    <b>Reason:</b> Material company-specific F&O intelligence. High single-company materiality beats threshold with Profit/Sales metrics.
                  </p>
                  <div className="flex gap-4 text-[10px] text-slate-500">
                    <span>Quality Score: <b className="text-emerald-400">85/100</b></span>
                    <span>Materiality: <b className="text-indigo-400">90/100</b></span>
                  </div>
                </div>

                {/* Example 2: BSE / MARKET - NO_ACTION */}
                <div className="bg-slate-950/60 rounded-xl border border-rose-500/10 p-4 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-500/25 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">NO_ACTION</span>
                      <span className="bg-slate-900 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">MARKET</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Example Scenario</div>
                  </div>
                  <h5 className="font-bold text-slate-400 mb-1 font-sans text-xs">Earnings Today: 45 companies including Reliance, TCS, Wipro, and BSE to report Q1</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-2 font-sans">
                    <b>Reason:</b> Suppressed. Generic earnings calendar or multi-company list without individual stock materiality or metrics.
                  </p>
                  <div className="flex gap-4 text-[10px] text-slate-500">
                    <span>Quality Score: <b className="text-rose-400">10/100</b></span>
                    <span>Materiality: <b className="text-slate-400">10/100</b></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {decisionsHistory.map((dec, idx) => {
                  const isExpanded = expandedDecisionId === dec.articleId;
                  const isImmediate = dec.decision === 'IMMEDIATE';
                  const isDigest = dec.decision === 'DIGEST_PENDING';
                  const isSuppressed = dec.decision === 'SUPPRESSED';

                  const badgeClass = isImmediate ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isDigest ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : isSuppressed ? 'bg-rose-500/25 text-rose-300 border-rose-500/35'
                    : 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <div 
                      key={dec.articleId || idx}
                      className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-4 hover:border-slate-700 transition-colors cursor-pointer text-left"
                      onClick={() => setExpandedDecisionId(isExpanded ? null : dec.articleId)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2 mb-2 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badgeClass}`}>
                            {dec.decision}
                          </span>
                          <span className="bg-slate-900 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            {dec.symbol || 'MARKET'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {dec.timestamp ? new Date(dec.timestamp).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>
                      <h5 className="font-bold text-white mb-1 font-sans text-xs">
                        {dec.headline}
                      </h5>
                      <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
                        <b>Reason:</b> {dec.reason}
                      </p>
                      
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-900/80 text-[10px] text-slate-400 flex flex-col gap-1 font-mono">
                          <div><b>Article ID:</b> {dec.articleId}</div>
                          <div className="flex gap-4 mt-1.5">
                            <span>Quality Score: <b className="text-white">{dec.qualityScore}/100</b></span>
                            <span>Materiality Score: <b className="text-white">{dec.materialityScore}/100</b></span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          {history.length === 0 ? (
            <div className="bg-slate-900/10 border border-dashed border-slate-900 rounded-3xl p-12 text-center">
              <div className="h-12 w-12 bg-slate-900 rounded-full mx-auto flex items-center justify-center mb-4 text-slate-700">
                <Shield className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-400">No Intelligence Alerts Yet</h4>
              <p className="text-xs text-slate-600 mt-1">Athena will notify you here when verified market signals are detected.</p>
            </div>
          ) : (
            history.map((alert) => (
              <div 
                key={alert.id}
                className={`bg-slate-900/40 border rounded-2xl overflow-hidden transition-all ${alert.status === "Read" ? "border-slate-900 opacity-80" : "border-slate-800 ring-1 ring-white/5"}`}
              >
                <div 
                  className="p-5 cursor-pointer flex items-start justify-between gap-4"
                  onClick={() => {
                    setExpandedAlert(expandedAlert === alert.id ? null : alert.id);
                    if (alert.status !== "Read") alertEngine.markAsRead(alert.id);
                  }}
                >
                  <div className="flex gap-4 min-w-0">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${getPriorityColor(alert.priority)}`}>
                      {getPriorityIcon(alert.priority)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(alert.priority)}`}>
                          {alert.priority.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">{alert.headline || alert.title}</h3>
                      <p className="text-[10px] text-indigo-400 font-medium mt-0.5">{alert.categoryDesc || alert.type}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {alert.companies.map(c => (
                          <span key={c} className="text-[9px] bg-slate-950 text-indigo-400 border border-slate-800 px-1.5 py-0.5 rounded uppercase font-bold">{c}</span>
                        ))}
                        {alert.sectors.map(s => (
                          <span key={s} className="text-[9px] bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded italic">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="text-slate-600 hover:text-slate-400 transition-colors mt-1">
                    {expandedAlert === alert.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {expandedAlert === alert.id && (
                  <div className="px-5 pb-6 border-t border-slate-900 pt-5 flex flex-col gap-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-900">
                        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Activity className="h-3 w-3" />
                          What Happened
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{alert.whatHappened}</p>
                      </div>
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-900">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3" />
                          Why It Matters
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{alert.whyItMatters}</p>
                      </div>
                    </div>

                    {(alert.marketImpactDesc || (alert.keyPoints && alert.keyPoints.length > 0)) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {alert.marketImpactDesc && (
                          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-900">
                            <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Zap className="h-3 w-3" />
                              Market Impact
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed">{alert.marketImpactDesc}</p>
                          </div>
                        )}
                        {alert.keyPoints && alert.keyPoints.length > 0 && (
                          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-900">
                            <h4 className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Sparkles className="h-3 w-3" />
                              Key Points
                            </h4>
                            <ul className="text-xs text-slate-300 leading-relaxed list-disc list-inside">
                              {alert.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Shield className="h-3 w-3" />
                        Verification Details
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                          <span className="text-[9px] text-slate-500 block mb-1">Detection</span>
                          <span className="text-xs font-bold text-emerald-400">{alert.detectionConfidence || alert.confidence}%</span>
                        </div>
                        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                          <span className="text-[9px] text-slate-500 block mb-1">Impact Conf.</span>
                          <span className="text-xs font-bold text-indigo-400">{alert.impactConfidence || alert.confidence}%</span>
                        </div>
                        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                          <span className="text-[9px] text-slate-500 block mb-1">Evidence Count</span>
                          <span className="text-xs font-bold text-white">{alert.evidenceCount} Reports</span>
                        </div>
                        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                          <span className="text-[9px] text-slate-500 block mb-1">Athena Score</span>
                          <span className="text-xs font-bold text-white">{alert.score}/100</span>
                        </div>
                      </div>
                    </div>

                    {alert.investorTakeaway && (
                      <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/30">
                        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <ExternalLink className="h-3 w-3" />
                          Investor Takeaway
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium italic">"{alert.investorTakeaway}"</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Original Sources</h4>
                      <div className="flex flex-wrap gap-2">
                        {alert.originalSources.map((source: any, idx) => {
                          const url = typeof source === 'string' ? source : (source.uri || source.url || '#');
                          const title = typeof source === 'string' ? source : (source.title || source.uri || 'Source');
                          return (
                            <a 
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-slate-950 hover:bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] text-slate-400 flex items-center gap-2 transition-all group"
                            >
                              <ExternalLink className="h-3 w-3 group-hover:text-indigo-400" />
                              {title}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "dev" && developerMode && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <AlertTestPanel />
          <div className="bg-slate-900/40 border border-emerald-500/20 p-5 rounded-2xl">
            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Decision Logs (Last 50)
            </h4>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              {alertEngine.getDecisionLogs().map((log, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-900 font-mono text-[10px] flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <span className={`px-1.5 py-0.5 rounded ${log.decision === "Notify" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                      {log.decision}
                    </span>
                    <span className="text-slate-500">{log.alertId?.slice(0, 8) || "N/A"}...</span>
                    <span className="text-slate-300 font-bold">Score: {log.score}</span>
                    <span className="text-slate-500 italic line-clamp-1">{log.reason}</span>
                  </div>
                  <span className="text-slate-600">{log.latencyMs}ms</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "triggers" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Upper info card */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-400" />
                <h3 className="font-display font-bold text-base text-white">Custom Alert Triggers</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Establish hard-rules for price breakouts, technical indicators, and volume spikes.
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-center text-xs font-semibold animate-in fade-in slide-in-from-top-2">
              Alert trigger established and linked with SMS Agent.
            </div>
          )}

          {/* Expandable Creation Form */}
          {showAddForm && (
            <form onSubmit={handleCreateAlert} className="bg-slate-900/50 border border-indigo-500/25 rounded-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Create Stock Trigger</span>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 font-mono"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Symbol Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400 font-mono font-medium uppercase">Select Company Ticker</label>
                  <select
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 text-xs focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="RELIANCE">RELIANCE (Reliance Industries Ltd)</option>
                    <option value="TATAMOTORS">TATAMOTORS (Tata Motors Passenger Vehicles Ltd)</option>
                    <option value="TATAMTRDVR">TATAMTRDVR (Tata Motors Commercial Vehicles Ltd)</option>
                    <option value="HDFCBANK">HDFCBANK (HDFC Bank Ltd)</option>
                    <option value="INFY">INFY (Infosys Ltd)</option>
                    <option value="ETERNAL">ETERNAL (Eternal Ltd)</option>
                    <option value="ITC">ITC (ITC Ltd)</option>
                  </select>
                </div>

                {/* Alert Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400 font-mono font-medium uppercase">Trigger Metric Category</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 text-xs focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="price">Price Breakout / Support / Resistance</option>
                    <option value="volume">Intraday Abnormal Volume Spike</option>
                    <option value="filing">Corporate Filing & SEBI Disclosures</option>
                    <option value="f_o">Derivatives F&O Option Chain (PCR/OI)</option>
                  </select>
                </div>
              </div>

              {/* Condition Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-mono font-medium uppercase">Trigger Conditions (e.g. Price limits or PCR limits)</label>
                <input
                  type="text"
                  required
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder="e.g. Price crosses above ₹2,600 or Volume > 3M shares"
                  className="bg-slate-950 border border-slate-800 text-white placeholder-slate-600 rounded-lg p-2.5 text-xs focus:border-indigo-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg py-2.5 mt-2 transition-all cursor-pointer"
              >
                Deploy Live Alert Agent
              </button>
            </form>
          )}

          {/* Alerts List */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block text-left">
              Active Stock Alerts ({alerts.filter(a => a.isActive).length})
            </span>

            {alerts.length === 0 ? (
              <div className="bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
                No alerts configured. Tap "New Alert" above to create custom price or volume triggers.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 text-left ${
                      alert.isActive 
                        ? "bg-slate-900/40 border-slate-850 hover:border-slate-800" 
                        : "bg-slate-900/10 border-slate-950 text-slate-500"
                    }`}
                  >
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        alert.isActive ? "bg-slate-950 border border-slate-800" : "bg-slate-900/50 text-slate-600"
                      }`}>
                        {/* Custom Trigger Icons */}
                        {alert.type === "price" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
                        {alert.type === "volume" && <Volume2 className="h-4 w-4 text-indigo-400" />}
                        {alert.type === "filing" && <FileText className="h-4 w-4 text-amber-400" />}
                        {alert.type === "f_o" && <Sparkles className="h-4 w-4 text-fuchsia-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${alert.isActive ? "text-white" : "text-slate-500"}`}>
                            {alert.symbol}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                            {alert.name}
                          </span>
                        </div>
                        <p className={`text-xs mt-1 leading-normal font-sans ${alert.isActive ? "text-slate-300" : "text-slate-500"}`}>
                          {alert.condition}
                        </p>
                        <span className="text-[9px] text-slate-600 font-mono mt-0.5 block">
                          Added {alert.timestamp}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle Active state */}
                      <button
                        onClick={() => toggleAlert(alert.id)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={alert.isActive ? "Deactivate trigger" : "Activate trigger"}
                      >
                        {alert.isActive ? (
                          <ToggleRight className="h-7 w-7 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-slate-600" />
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-950/40 rounded transition-all cursor-pointer"
                        title="Delete trigger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compliance / Disclaimer */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 text-[10px] text-slate-500 leading-normal font-mono flex items-start gap-2.5">
            <Info className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5" />
            <p>
              Alert notifications are simulated in the practice sandbox. In production environments, Athena connects directly to SEBI-compliant SMS & WhatsApp gateways to push instant breakout signals.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
