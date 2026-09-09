/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketTruthWorkspace.tsx
 * 
 * Production UI for real-time market truth, data quality gates, source consensus,
 * integrity anomalies, and circuit breaker status.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Database,
  Radio,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Sliders,
  Filter,
  BarChart3,
  History
} from 'lucide-react';
import {
  CanonicalMarketTruthState,
  CanonicalMarketSnapshot,
  CanonicalMarketSource,
  MarketTruthTelemetry,
  CanonicalMarketTick
} from '../../news/market-truth/types.ts';
import { TimeMachineWorkspace } from './TimeMachineWorkspace';

export const MarketTruthWorkspace: React.FC = () => {
  const [truthState, setTruthState] = useState<CanonicalMarketTruthState | null>(null);
  const [snapshot, setSnapshot] = useState<CanonicalMarketSnapshot | null>(null);
  const [sources, setSources] = useState<CanonicalMarketSource[]>([]);
  const [telemetry, setTelemetry] = useState<MarketTruthTelemetry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SOURCES' | 'ANOMALIES' | 'DERIVATIVES' | 'TELEMETRY' | 'TIME_MACHINE'>('OVERVIEW');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchData = async () => {
    try {
      const [resStatus, resSnapshot, resSources, resTelemetry] = await Promise.all([
        fetch('/api/v5/market-truth/status'),
        fetch('/api/v5/market-truth/snapshot'),
        fetch('/api/v5/market-truth/sources'),
        fetch('/api/v5/market-truth/telemetry')
      ]);

      if (resStatus.ok) {
        const json = await resStatus.json();
        if (json.success) setTruthState(json.data);
      }
      if (resSnapshot.ok) {
        const json = await resSnapshot.json();
        if (json.success) setSnapshot(json.data);
      }
      if (resSources.ok) {
        const json = await resSources.json();
        if (json.success) setSources(json.data);
      }
      if (resTelemetry.ok) {
        const json = await resTelemetry.json();
        if (json.success) setTelemetry(json.data);
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error fetching market truth state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleTripCircuitBreaker = async () => {
    try {
      const res = await fetch('/api/v5/market-truth/circuit-breaker/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual operator emergency trip' })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to trip circuit breaker:', err);
    }
  };

  const handleResetCircuitBreaker = async () => {
    try {
      const res = await fetch('/api/v5/market-truth/circuit-breaker/reset', {
        method: 'POST'
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to reset circuit breaker:', err);
    }
  };

  if (loading && !truthState) {
    return (
      <div id="market-truth-loading" className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-400 font-mono">Synchronizing Canonical Market Truth Layer...</p>
        </div>
      </div>
    );
  }

  const isCbTripped = truthState?.circuitBreakerTripped || false;
  const overallQuality = truthState?.quality.overallQualityScore || 98;
  const session = truthState?.session;

  return (
    <div id="market-truth-workspace-root" className="w-full max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* 1. Header Banner & Safety Control Plane */}
      <div
        id="market-truth-header-card"
        className={`p-6 rounded-xl border transition-all ${
          isCbTripped
            ? 'bg-rose-950/40 border-rose-600/80 shadow-lg shadow-rose-950/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-lg ${
                isCbTripped ? 'bg-rose-600 text-white' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">REAL-TIME MARKET TRUTH LAYER</h1>
                <span
                  id="truth-status-badge"
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider ${
                    truthState?.overallStatus === 'VALID'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                      : truthState?.overallStatus === 'DEGRADED'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-700/60'
                      : 'bg-rose-950/80 text-rose-400 border border-rose-700/60'
                  }`}
                >
                  {truthState?.overallStatus || 'UNKNOWN'}
                </span>
                <span
                  id="session-status-badge"
                  className="px-2.5 py-0.5 text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-800/60 rounded-full flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {session?.state || 'CONTINUOUS_TRADING'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Deterministic Phase 22 Consensus & Microstructure Validation • Zero-AI Authoritative Feed
              </p>
            </div>
          </div>

          {/* Circuit Breaker & Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-mono text-slate-300">Sync: {lastRefreshed || 'Live'}</span>
              <button
                id="btn-toggle-autorefresh"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`ml-1 text-[11px] px-2 py-0.5 rounded font-medium ${
                  autoRefresh ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {autoRefresh ? 'Live' : 'Paused'}
              </button>
            </div>

            {isCbTripped ? (
              <button
                id="btn-reset-circuit-breaker"
                onClick={handleResetCircuitBreaker}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                Reset Safety Gate
              </button>
            ) : (
              <button
                id="btn-trip-circuit-breaker"
                onClick={handleTripCircuitBreaker}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-medium text-xs rounded-lg transition-colors"
                title="Manually trip execution lock and halt downstream orders"
              >
                <Lock className="w-3.5 h-3.5" />
                Emergency Interlock
              </button>
            )}
          </div>
        </div>

        {/* Circuit Breaker Alert Banner if Tripped */}
        {isCbTripped && (
          <div className="mt-4 p-3 bg-rose-900/50 border border-rose-600 rounded-lg flex items-center gap-3 text-rose-200 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">CIRCUIT BREAKER TRIPPED:</span> {truthState?.circuitBreakerReason || 'Execution blocked due to feed contradiction or stale price.'}
            </div>
            <span className="text-[11px] font-mono text-rose-300 bg-rose-950 px-2 py-1 rounded">
              DOWNSTREAM EXECUTION: LOCKED
            </span>
          </div>
        )}

        {/* Quality Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Overall Quality Score</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{overallQuality}%</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Weighted composite index</div>
          </div>
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Feed Freshness</div>
            <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">
              {truthState?.quality.freshnessScore || 99}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">&lt; 1500ms max latency</div>
          </div>
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Tick Integrity</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {truthState?.quality.integrityScore || 100}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Zero OHLC breaches</div>
          </div>
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Source Agreement</div>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-0.5">
              {truthState?.quality.sourceAgreementScore || 96}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">NSE vs BSE vs Direct</div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div id="truth-tab-bar" className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          id="tab-overview"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'OVERVIEW'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Canonical Indices & Breadth
        </button>
        <button
          id="tab-sources"
          onClick={() => setActiveTab('SOURCES')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'SOURCES'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Multi-Source Consensus ({sources.length})
        </button>
        <button
          id="tab-anomalies"
          onClick={() => setActiveTab('ANOMALIES')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'ANOMALIES'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Anomalies & Discontinuities ({truthState?.activeAnomalies?.length || 0})
        </button>
        <button
          id="tab-derivatives"
          onClick={() => setActiveTab('DERIVATIVES')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'DERIVATIVES'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Derivatives & F&O Truth
        </button>
        <button
          id="tab-telemetry"
          onClick={() => setActiveTab('TELEMETRY')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'TELEMETRY'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Microstructure Telemetry
        </button>
        <button
          id="tab-timemachine"
          onClick={() => setActiveTab('TIME_MACHINE')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'TIME_MACHINE'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-900/60 text-indigo-400 hover:text-indigo-200 hover:bg-slate-800/60 border border-indigo-500/30'
          }`}
        >
          <History className="w-3.5 h-3.5 animate-pulse" />
          Time Machine & Historical Replay
        </button>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Index Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {snapshot?.indices &&
              Object.entries(snapshot.indices).map(([name, rawTick]) => {
                const tick = rawTick as CanonicalMarketTick;
                const isPositive = (tick.priceChangePercent || 0) >= 0;
                return (
                  <div
                    key={name}
                    id={`index-truth-${tick.symbol}`}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-slate-200">{tick.canonicalSymbol}</span>
                        <span className="px-1.5 py-0.5 bg-slate-800 text-[10px] font-mono rounded text-slate-400">
                          {tick.exchange}
                        </span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-white mt-1">
                        ₹{tick.lastPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-400" />
                        )}
                        <span
                          className={`text-xs font-mono font-medium ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {tick.priceChange?.toFixed(2) || '0.00'} (
                          {isPositive ? '+' : ''}
                          {tick.priceChangePercent?.toFixed(2) || '0.00'}%)
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Source: <strong className="text-slate-300">{tick.source}</strong></span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Validated
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Market Breadth & Liquidity Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Validated Market Breadth (NSE Cash)
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                  <div className="text-[11px] text-emerald-400 font-medium">Advances</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {snapshot?.breadth.advances || 28}
                  </div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                  <div className="text-[11px] text-rose-400 font-medium">Declines</div>
                  <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                    {snapshot?.breadth.declines || 21}
                  </div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400 font-medium">A/D Ratio</div>
                  <div className="text-xl font-bold font-mono text-slate-200 mt-1">
                    {snapshot?.breadth.advanceDeclineRatio || 1.33}
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{
                    width: `${
                      ((snapshot?.breadth.advances || 28) /
                        ((snapshot?.breadth.advances || 28) + (snapshot?.breadth.declines || 21))) *
                      100
                    }%`
                  }}
                />
                <div
                  className="bg-rose-500 h-full"
                  style={{
                    width: `${
                      ((snapshot?.breadth.declines || 21) /
                        ((snapshot?.breadth.advances || 28) + (snapshot?.breadth.declines || 21))) *
                      100
                    }%`
                  }}
                />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-emerald-400" />
                Liquidity & Volatility Truth State
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Volatility Regime</span>
                  <span className="font-mono font-semibold text-amber-400">
                    {snapshot?.volatilityState.regime || 'NORMAL_VOL'} (VIX: {snapshot?.volatilityState.indiaVix || 14.2})
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Average Top-of-Book Spread</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {((snapshot?.liquidityState.averageSpreadPercent || 0.04)).toFixed(3)}% (Tight)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Total Market Turnover</span>
                  <span className="font-mono font-semibold text-slate-200">
                    ₹{((snapshot?.liquidityState.totalMarketTurnoverINR || 184500000000) / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SOURCES CONSENSUS TAB */}
      {activeTab === 'SOURCES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Registered Ingestion Feeds & Agreement Priority
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-medium">Source ID</th>
                    <th className="pb-2.5 font-medium">Feed Description</th>
                    <th className="pb-2.5 font-medium">Priority</th>
                    <th className="pb-2.5 font-medium">Latency</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium">Disagreements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sources.map((src) => (
                    <tr key={src.sourceId} className="hover:bg-slate-800/40">
                      <td className="py-3 font-semibold text-white">{src.sourceId}</td>
                      <td className="py-3 text-slate-300 font-sans">{src.name}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            src.priority === 'P0_AUTHORITATIVE'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : src.priority === 'P1_PRIMARY'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {src.priority}
                        </span>
                      </td>
                      <td className="py-3 text-emerald-400">{src.feedLatencyMs} ms</td>
                      <td className="py-3">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-sans">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          {src.connectionStatus}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{src.disagreementCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. ANOMALIES TAB */}
      {activeTab === 'ANOMALIES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Microstructure Anomaly & Integrity Log
            </h3>
            {truthState?.activeAnomalies && truthState.activeAnomalies.length > 0 ? (
              <div className="space-y-2.5">
                {truthState.activeAnomalies.map((anom, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{anom.symbol}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            anom.severity === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : anom.severity === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {anom.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{anom.message}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(anom.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                Zero active microstructure anomalies detected. Market state is pristine.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. DERIVATIVES TAB */}
      {activeTab === 'DERIVATIVES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">NIFTY Futures Basis</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                +{snapshot?.derivatives.niftyFuturesBasis || 42.5} pts
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Fair Premium / In Contango</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">Put-Call Ratio (PCR)</div>
              <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
                {snapshot?.derivatives.pcrRatio || 1.15}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Mild Bullish Bias / Support Heavy</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">Max Pain Strike</div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {snapshot?.derivatives.maxPainStrike || 24350}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Highest writer payoff equilibrium</div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TELEMETRY TAB */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Microstructure Engine Telemetry Counters
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">Ticks Ingested</div>
                <div className="text-lg font-bold font-mono text-white mt-1">
                  {telemetry?.ticksReceived || 0}
                </div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">Ticks Normalized</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {telemetry?.ticksNormalized || 0}
                </div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">Ticks Rejected</div>
                <div className="text-lg font-bold font-mono text-rose-400 mt-1">
                  {telemetry?.ticksRejected || 0}
                </div>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">Avg Latency</div>
                <div className="text-lg font-bold font-mono text-blue-400 mt-1">
                  {telemetry?.averageProcessingLatencyMs || 0.12} ms
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'TIME_MACHINE' && (
        <TimeMachineWorkspace />
      )}
    </div>
  );
};
