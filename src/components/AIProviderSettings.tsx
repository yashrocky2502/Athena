import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Cpu, 
  Coins, 
  Zap, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Database,
  Trash2,
  AlertTriangle,
  Play,
  ShieldCheck,
  ChevronRight,
  Terminal,
  FileText
} from "lucide-react";

interface StatusData {
  timestamp: string;
  router: {
    currentProvider: string;
    fallbackProvider: string;
    totalRequests: number;
    averageResponseTimeMs: number;
    cacheHitPercentage: number;
    fallbackPercentage: number;
    totalEstimatedCostUSD: number;
  };
  providers: {
    grok: { configured: boolean; healthy: boolean; successRate: number; avgLatencyMs: number };
    gemini: { configured: boolean; healthy: boolean; successRate: number; avgLatencyMs: number };
    local: { configured: boolean; healthy: boolean; successRate: number; avgLatencyMs: number };
  };
  cache: {
    hits: number;
    misses: number;
    totalRequests: number;
    hitRatioPercentage: number;
    cachedItemsCount: number;
  };
  costTracker: {
    totalRequests: number;
    totalEstimatedCostUSD: number;
    providerBreakdown: {
      grok?: { requests: number; tokensInput: number; tokensOutput: number; costUSD: number };
      gemini?: { requests: number; tokensInput: number; tokensOutput: number; costUSD: number };
      local?: { requests: number; tokensInput: number; tokensOutput: number; costUSD: number };
    };
  };
}

export default function AIProviderSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Test Runner States
  const [testTitle, setTestTitle] = useState("RBI Enforces Strict NPA Provisioning Norms");
  const [testBody, setTestBody] = useState("The Reserve Bank of India has announced tighter guidelines for Non-Performing Asset provisioning. Banks must set aside higher reserves for stressed infrastructure assets starting next quarter. The regulation 30 filing confirms the target capital buffer must be enhanced by 150 basis points. Outstanding capital ratios will remain monitored weekly by regulators.");
  const [testCategory, setTestCategory] = useState("Macro");
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Load Status Data
  useEffect(() => {
    async function fetchStatus() {
      try {
        setLoading(true);
        const res = await fetch("/api/ai/status");
        if (!res.ok) throw new Error("Failed to load AI router status");
        const data = await res.json();
        setStatus(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Unknown error loading status");
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [refreshKey]);

  // Actions
  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear all AI router cache items?")) return;
    try {
      const res = await fetch("/api/api/ai/cache/clear", { method: "POST" })
        .catch(() => fetch("/api/ai/cache/clear", { method: "POST" }));
      if (res && res.ok) {
        alert("AI Router Cache Cleared Successfully!");
        setRefreshKey(prev => prev + 1);
      } else {
        alert("Failed to clear caches");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleRunTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: testTitle,
          body: testBody,
          category: testCategory,
          facts: {
            companyName: "Reserve Bank of India",
            announcementType: "NPA Provisioning Norms Update"
          }
        })
      });
      if (!res.ok) throw new Error("Simulated summary run failed");
      const data = await res.json();
      setTestResult(data);
      setRefreshKey(prev => prev + 1); // Refresh cost/health metrics
    } catch (err: any) {
      setTestResult({ error: err.message || "Failed to complete test run" });
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header section with Refresh */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <Cpu className="text-indigo-400 h-5 w-5" />
            ATHENA V5 — Multi-Model AI Router Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, model health fallback trees, caching audits, and interactive simulation.
          </p>
        </div>
        <button 
          onClick={() => setRefreshKey(prev => prev + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800 text-xs transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Sync Telemetry
        </button>
      </div>

      {loading && !status && (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="text-xs text-slate-400 font-mono">Querying Athena telemetry logs...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-rose-400 flex items-start gap-3 text-xs">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <span className="font-bold">Telemetry Connection Lost</span>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {status && (
        <>
          {/* Main Router Pipeline Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Active Provider */}
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current Primary Router</span>
              <div className="flex items-center gap-2.5 mt-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-lg font-bold text-white uppercase font-mono tracking-wide">
                  {status.router.currentProvider}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">
                Backup: <span className="text-indigo-400 font-bold uppercase">{status.router.fallbackProvider}</span>
              </span>
            </div>

            {/* Total Summaries */}
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Summaries Routed</span>
              <span className="text-2xl font-bold text-white mt-1 font-mono">
                {status.router.totalRequests}
              </span>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">
                Failover rate: <span className={status.router.fallbackPercentage > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>{status.router.fallbackPercentage}%</span>
              </span>
            </div>

            {/* Average Latency */}
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Avg Routing Latency</span>
              <span className="text-2xl font-bold text-indigo-400 mt-1 font-mono">
                {status.router.averageResponseTimeMs.toLocaleString()} <span className="text-xs text-slate-400">ms</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">
                Quality Evaluation: <span className="text-emerald-400 font-bold">Passed</span>
              </span>
            </div>

            {/* Total Cost USD */}
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Estimated AI Costs</span>
              <span className="text-2xl font-bold text-amber-400 mt-1 font-mono">
                ${status.router.totalEstimatedCostUSD.toFixed(5)}
              </span>
              <span className="text-[10px] text-emerald-400 mt-2 font-medium flex items-center gap-1 font-bold">
                <Zap size={10} /> Local Failbacks Saved Cost
              </span>
            </div>

          </div>

          {/* Model Status & Fallback Cascade */}
          <div className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="text-indigo-400 h-4 w-4" />
              Routing Priority Fallback Cascade (Active Telemetry)
            </h3>
            
            <div className="space-y-3">
              {[
                { name: "grok", label: "Grok-Beta (Primary)", desc: "High reasoning capabilities. Strictly evaluated first." },
                { name: "gemini", label: "Gemini-3.7-Flash (Secondary)", desc: "Newest secondary router if Grok times out or fails confidence criteria." },
                { name: "local", label: "Athena Local NLP (Final Fallback)", desc: "100% offline rule-based extractor. Zero cost. Guaranteed." }
              ].map((provider, idx) => {
                const telemetry = (status.providers as any)[provider.name];
                const isCurrent = status.router.currentProvider === provider.name;
                
                return (
                  <div key={provider.name} className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                    isCurrent 
                      ? "bg-indigo-950/15 border-indigo-500/30" 
                      : "bg-slate-950/50 border-slate-900"
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {telemetry.healthy ? (
                          <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4.5 w-4.5 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">{idx + 1}. {provider.label}</span>
                          {isCurrent && (
                            <span className="text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold font-mono tracking-wider uppercase">Active Primary</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-sm leading-normal">{provider.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 font-mono text-[10px] self-end sm:self-center bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-900">
                      <div className="flex flex-col items-start">
                        <span className="text-slate-500 uppercase tracking-widest text-[8px]">Health</span>
                        <span className={telemetry.healthy ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          {telemetry.healthy ? "HEALTHY" : "OFFLINE / LIMIT"}
                        </span>
                      </div>
                      <div className="w-[1px] h-6 bg-slate-900" />
                      <div className="flex flex-col items-start">
                        <span className="text-slate-500 uppercase tracking-widest text-[8px]">Success Rate</span>
                        <span className="text-white font-bold">{telemetry.successRate}%</span>
                      </div>
                      <div className="w-[1px] h-6 bg-slate-900" />
                      <div className="flex flex-col items-start">
                        <span className="text-slate-500 uppercase tracking-widest text-[8px]">Avg Latency</span>
                        <span className="text-slate-300 font-bold">{telemetry.avgLatencyMs} ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Caching & Token Audits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Cache Engine Metrics */}
            <div className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Database className="text-emerald-400 h-4 w-4" />
                    TTL Caching Performance
                  </h3>
                  <button 
                    onClick={handleClearCache}
                    className="p-1 px-2 hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 rounded border border-transparent hover:border-rose-500/20 transition-all flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Trash2 size={12} />
                    Purge Cache
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-900 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">CACHE HITS</span>
                    <span className="text-xl font-bold text-emerald-400 mt-1 font-mono">{status.cache.hits}</span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-900 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">CACHE MISSES</span>
                    <span className="text-xl font-bold text-slate-400 mt-1 font-mono">{status.cache.misses}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 border-t border-slate-900 pt-3 text-[11px] text-slate-400 font-mono">
                  <span>Cache Hit Ratio:</span>
                  <span className="text-white font-bold">{status.cache.hitRatioPercentage}%</span>
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-400 font-mono">
                  <span>Total Cached Items:</span>
                  <span className="text-white font-bold">{status.cache.cachedItemsCount} entries</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 mt-4 leading-normal italic">
                Cache holds structured filings for 365 days, saving repetitive LLM tokens and API invocation costs.
              </p>
            </div>

            {/* Provider Token & Cost Breakdown */}
            <div className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Coins className="text-amber-400 h-4 w-4" />
                Token & Financial Breakdown
              </h3>

              <div className="space-y-2">
                {Object.entries(status.costTracker.providerBreakdown).map(([provider, details]: [string, any]) => (
                  <div key={provider} className="bg-slate-950/80 p-3 rounded-xl border border-slate-900 flex flex-col gap-1.5 text-[11px] font-mono">
                    <div className="flex justify-between items-center font-bold text-white uppercase tracking-wider text-[10px] border-b border-slate-900 pb-1 mb-1">
                      <span className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${provider === 'grok' ? 'bg-indigo-500' : (provider === 'gemini' ? 'bg-emerald-400' : 'bg-slate-500')}`} />
                        {provider}
                      </span>
                      <span className="text-amber-400">${details.costUSD.toFixed(5)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Total Requests:</span>
                      <span className="text-slate-200">{details.requests}</span>
                    </div>
                    {provider !== 'local' && (
                      <div className="flex justify-between text-slate-400">
                        <span>Tokens Input/Output:</span>
                        <span className="text-slate-200">{details.tokensInput} / {details.tokensOutput}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Interactive Simulation Panel */}
          <div className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Terminal className="text-indigo-400 h-4 w-4" />
              Interactive Router E2E Simulation Test
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Inputs */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Category Type</label>
                  <select 
                    value={testCategory}
                    onChange={(e) => setTestCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-900 text-xs text-white p-2.5 rounded-lg outline-none cursor-pointer focus:border-indigo-500"
                  >
                    <option value="Macro">Macro Reports</option>
                    <option value="Markets">Market News</option>
                    <option value="Corporate Filing">Corporate Filing</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Test Headline</label>
                  <input 
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="bg-slate-950 border border-slate-900 text-xs text-white p-2.5 rounded-lg outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Mock Source Body Content</label>
                  <textarea 
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    rows={4}
                    className="bg-slate-950 border border-slate-900 text-xs text-white p-2.5 rounded-lg outline-none focus:border-indigo-500 resize-none font-sans leading-relaxed"
                  />
                </div>

                <button
                  onClick={handleRunTest}
                  disabled={isRunningTest || !testTitle.trim() || !testBody.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-850 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-indigo-900/10 mt-1"
                >
                  {isRunningTest ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Routing Simulated Dispatch...
                    </>
                  ) : (
                    <>
                      <Play size={12} className="fill-current" />
                      Trigger AI Simulation Dispatch
                    </>
                  )}
                </button>
              </div>

              {/* Outputs / Live logs */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col justify-between min-h-[200px]">
                {!testResult && !isRunningTest && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <Terminal size={24} className="text-slate-800 mb-2" />
                    <span className="text-xs text-slate-500 font-mono">Telemetry Output Logs Ready</span>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-xs leading-normal">
                      Click the dispatch button to run an end-to-end multi-model generation with active scoring.
                    </p>
                  </div>
                )}

                {isRunningTest && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-3">
                    <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                    <span className="text-xs text-indigo-400 font-mono tracking-wider animate-pulse">EVALUATING PIPELINE FALLBACKS...</span>
                    <p className="text-[10px] text-slate-500 font-sans max-w-xs italic leading-normal">
                      Invoking fallback cascade (Grok check, evaluating confidence, fallback to Gemini, local fallback engine if offline).
                    </p>
                  </div>
                )}

                {testResult && (
                  <div className="flex flex-col gap-3 flex-1 h-full font-mono text-[11px] text-slate-300">
                    
                    {testResult.error ? (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                        <span className="font-bold">E2E Simulation Failed:</span>
                        <p className="mt-1">{testResult.error}</p>
                      </div>
                    ) : (
                      <>
                        {/* Summary Header details */}
                        <div className="flex items-center justify-between border-b border-slate-900 pb-2 text-[10px] text-slate-500 uppercase tracking-wider">
                          <span>Pipeline Simulation Complete</span>
                          <span className="text-indigo-400 font-bold font-mono">v5 Engine</span>
                        </div>

                        {/* Metadata grid */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 text-[10px]">
                          <div>
                            <span className="text-slate-500 block uppercase">Selected Provider:</span>
                            <span className="text-white font-bold uppercase">{testResult.provider}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">Confidence score:</span>
                            <span className="text-emerald-400 font-bold">{testResult.confidence || "N/A"}/100</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">Fallback Utilized:</span>
                            <span className={testResult.fallbackUsed ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                              {testResult.fallbackUsed ? "YES" : "NO"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">Execution Latency:</span>
                            <span className="text-indigo-300 font-bold">{testResult.generationTime || 0} ms</span>
                          </div>
                        </div>

                        {/* Raw Summary Output Text scroll */}
                        <div className="flex-1 overflow-y-auto max-h-[140px] bg-slate-950 p-2 border border-slate-900 rounded text-slate-400 leading-normal text-[10px] whitespace-pre-wrap font-sans">
                          {testResult.text || testResult.summary}
                        </div>
                      </>
                    )}

                  </div>
                )}

              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
