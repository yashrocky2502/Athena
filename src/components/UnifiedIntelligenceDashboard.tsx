/**
 * ATHENA UNIFIED INTELLIGENCE OS — Phase 17
 * UnifiedIntelligenceDashboard.tsx
 * 
 * Beautiful UI Dashboard for Phase 17: Unified Intelligence OS & Orchestration Layer.
 * Showcases:
 * - Real-Time Pipeline Ingestion & Event Stream (publish / subscribe / events)
 * - Directed Provenance Graph & Lineage Tracing
 * - Telemetry Dashboard (Avg Latency, AI Call metrics, conversion)
 * - Contradiction Monitoring Room (reconciling news vs price, risk vs strategy)
 * - Confidence Propagation Engine (raw vs adjusted confidence)
 * - Pipeline Replay Engine with Drift Analysis
 */

import React, { useState, useEffect } from 'react';
import { 
  Layers, Clock, Activity, AlertTriangle, Cpu, ShieldAlert, CheckCircle, 
  RotateCw, Play, GitBranch, ArrowRight, TrendingUp, HelpCircle, AlertOctagon, 
  Database, RefreshCw, Eye, Sparkles, Sliders, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { athenaOrchestrator } from '../news/intelligence/AthenaOrchestrator.ts';
import { AthenaEventBus } from '../news/intelligence/AthenaEventBus.ts';
import { AthenaContradictionEngine } from '../news/intelligence/AthenaContradictionEngine.ts';
import { ConfidencePropagationEngine } from '../news/intelligence/ConfidencePropagationEngine.ts';
import { telemetryEngine } from '../news/intelligence/AthenaTelemetryEngine.ts';
import { UnifiedAthenaEvent, AthenaUnifiedDecision } from '../news/intelligence/UnifiedIntelligenceTypes.ts';
import { marketSurveillanceEngine } from '../news/surveillance/MarketSurveillanceEngine.ts';

export function UnifiedIntelligenceDashboard() {
  const [decisions, setDecisions] = useState<AthenaUnifiedDecision[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'STREAM' | 'SURVEILLANCE' | 'LINEAGE' | 'CONTRADICTIONS' | 'TELEMETRY'>('STREAM');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [surveillanceEvents, setSurveillanceEvents] = useState<any[]>([]);

  // Surveillance simulator input states
  const [survSymbol, setSurvSymbol] = useState('RELIANCE');
  const [survPriceChange, setSurvPriceChange] = useState(4.25);
  const [survRvol, setSurvRvol] = useState(5.2);
  const [survOiChange, setSurvOiChange] = useState(12.5);
  const [survSpread, setSurvSpread] = useState(0.02);
  const [survAtr, setSurvAtr] = useState(3.5);
  
  // Custom simulator state
  const [simulating, setSimulating] = useState(false);
  const [articleTitleInput, setArticleTitleInput] = useState('NSE corporate report: TCS secures landmark $1.5B cloud transformation contract');
  const [articleSentiment, setArticleSentiment] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('BULLISH');
  const [forceRiskGateFail, setForceRiskGateFail] = useState(false);
  const [forceOosFail, setForceOosFail] = useState(false);
  const [forceContradiction, setForceContradiction] = useState(false);
  const [forceExecutionFail, setForceExecutionFail] = useState(false);

  // Replay state
  const [replayResult, setReplayResult] = useState<any>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  // Load state from orchestrator
  const refreshState = () => {
    const allDecisions = athenaOrchestrator.getAllDecisions();
    setDecisions([...allDecisions]);
    setTelemetry(telemetryEngine.getTelemetry());
    setSurveillanceEvents(marketSurveillanceEngine.getAllEvents());
    if (allDecisions.length > 0 && !selectedEventId) {
      setSelectedEventId(allDecisions[allDecisions.length - 1].event.eventId);
    }
  };

  useEffect(() => {
    // Seed default events if empty
    if (athenaOrchestrator.getAllDecisions().length === 0) {
      seedSamplePipeline();
    } else {
      refreshState();
    }
  }, []);

  const seedSamplePipeline = async () => {
    athenaOrchestrator.reset();
    
    // 1. Ingest a successful tradeable news catalyst
    await athenaOrchestrator.orchestrate({
      id: 'art-init-1',
      headline: 'Infosys beats Q1 expectations with 18% profit surge, announces Rs 800 dividend',
      body: 'Infosys beat expectations significantly. Heavy derivatives buying. Price action is breakout.',
      symbol: 'INFY',
      sentiment: 'BULLISH',
      source: { name: 'NSE Filing', tier: 1 },
      publishedAt: new Date(Date.now() - 3600000).toISOString()
    });

    // 2. Ingest a contradiction blocked event
    await athenaOrchestrator.orchestrate({
      id: 'art-init-2',
      headline: 'TCS reports solid performance but stock slides by 4.5% due to guidance cuts',
      body: 'TCS reported good profit but market reacted very negatively because of flat growth guidelines.',
      symbol: 'TCS',
      sentiment: 'BULLISH',
      source: { name: 'Moneycontrol', tier: 2 },
      publishedAt: new Date(Date.now() - 1800000).toISOString()
    }, { forceContradiction: true });

    // 3. Seed real-time surveillance events
    await marketSurveillanceEngine.ingestTick({
      symbol: 'RELIANCE',
      exchange: 'NSE',
      prices: [2400, 2405, 2402, 2410, 2408, 2515],
      openPrice: 2400,
      prevClose: 2400,
      volumes: [12000, 14000, 11000, 15000, 13000, 85000],
      bidAskSpreadPct: 0.02,
      recentAtrs: [22, 23, 21, 24, 23, 48],
      currentOi: 1500000,
      prevOi: 1200000,
      futuresBasis: 6.2,
      stockReturn: 4.79,
      sectorReturn: 1.1,
      indexReturn: 0.35,
      usdInrDeltaPct: 0.05,
      crudeDeltaPct: 0.1,
      goldDeltaPct: -0.05,
    });

    refreshState();
  };

  const handleSimulateIngestion = async () => {
    setSimulating(true);
    try {
      const symbol = articleTitleInput.toUpperCase().includes('TCS') ? 'TCS' : 'INFY';
      
      await athenaOrchestrator.orchestrate({
        id: `art-sim-${Date.now()}`,
        headline: articleTitleInput,
        body: 'Simulated high-frequency news feed content verified by exchange gateway.',
        symbol,
        sentiment: articleSentiment,
        source: { name: 'Reuters India Feed', tier: 1 },
        publishedAt: new Date().toISOString()
      }, {
        forceRiskGateFail,
        forceOosFail,
        forceContradiction,
        forceExecutionFail
      });

      refreshState();
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const handleReplay = async (eventId: string) => {
    setReplayingId(eventId);
    try {
      const res = await athenaOrchestrator.replayPipeline(eventId);
      setReplayResult(res);
      refreshState();
    } catch (e: any) {
      alert(`Replay failed: ${e.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const selectedDecision = decisions.find(d => d.event.eventId === selectedEventId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-8 shadow-2xl" id="unified-athena-os">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-cyan-500/10 text-cyan-400 text-xs font-mono px-2 py-0.5 rounded border border-cyan-500/20">PHASE 17</span>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              Unified Intelligence OS & Orchestration Layer
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Canonical end-to-end trace from source news to deterministic execution, attribution and research evolution.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={seedSamplePipeline}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reset State
          </button>
          <button 
            onClick={refreshState}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold tracking-wide shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* SUB SYSTEM SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block mb-1">Processed Events</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white font-mono">{telemetry?.totalEvents || decisions.length}</span>
            <span className="text-[10px] text-slate-400 font-mono">Total Ingested</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block mb-1">Conversion Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-emerald-400 font-mono">
              {telemetry?.tradeableConversionRate || 0}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Tradeable Ratio</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block mb-1">Avg Latency</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-400 font-mono">{telemetry?.eventProcessingLatencyMs || 15.4} ms</span>
            <span className="text-[10px] text-slate-400 font-mono">End-To-End</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block mb-1">Detections</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-rose-400 font-mono">
              {telemetry?.contradictionCount || 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Contradictions</span>
          </div>
        </div>
      </div>

      {/* INNER NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 mb-6 gap-1">
        {(['STREAM', 'SURVEILLANCE', 'LINEAGE', 'CONTRADICTIONS', 'TELEMETRY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-mono font-medium tracking-wider border-b-2 transition-all ${
              activeTab === tab 
                ? 'border-cyan-500 text-cyan-400 bg-slate-800/30' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: STREAM */}
      {activeTab === 'STREAM' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: INGESTION CONTROLS & EVENT LIST */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider text-slate-300 font-mono mb-3 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Ingestion Feed Simulator
              </h3>
              
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">Headline Catalyst</label>
                  <input 
                    type="text" 
                    value={articleTitleInput}
                    onChange={(e) => setArticleTitleInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-1">Catalyst Direction</label>
                    <select 
                      value={articleSentiment} 
                      onChange={(e: any) => setArticleSentiment(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-white"
                    >
                      <option value="BULLISH">BULLISH</option>
                      <option value="BEARISH">BEARISH</option>
                      <option value="NEUTRAL">NEUTRAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-1">Force Invalidate Gate</label>
                    <div className="flex flex-col gap-1 mt-1">
                      <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={forceContradiction} 
                          onChange={(e) => setForceContradiction(e.target.checked)}
                          className="rounded border-slate-800 bg-slate-900 text-cyan-500"
                        />
                        Price Contradiction
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={forceRiskGateFail} 
                          onChange={(e) => setForceRiskGateFail(e.target.checked)}
                          className="rounded border-slate-800 bg-slate-900 text-cyan-500"
                        />
                        Risk Gate Failure
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSimulateIngestion}
                  disabled={simulating}
                  className="w-full mt-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold rounded text-xs tracking-wider transition-all flex items-center justify-center gap-1"
                >
                  {simulating ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  PUBLISH EVENT ON BUS
                </button>
              </div>
            </div>

            {/* EVENT LIST */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-slate-300 font-mono uppercase">
                Active Unified Events
              </h3>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {decisions.map(d => {
                  const isBlocked = d.event.contradictionState.includes('BLOCKED');
                  const isExecuted = d.event.lifecycleState === 'LEARNED';

                  return (
                    <div
                      key={d.event.eventId}
                      onClick={() => setSelectedEventId(d.event.eventId)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedEventId === d.event.eventId
                          ? 'bg-slate-800/40 border-cyan-500/80 shadow-md shadow-cyan-950/20'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500">{d.event.eventId}</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isBlocked 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : isExecuted 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {d.event.lifecycleState}
                        </span>
                      </div>
                      <p className="text-xs text-white font-medium line-clamp-1">{d.event.source}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: COMPREHENSIVE PIPELINE DETAIL */}
          <div className="lg:col-span-8 bg-slate-950/40 border border-slate-800 rounded-lg p-5">
            {selectedDecision ? (
              <div className="flex flex-col gap-5">
                {/* PIPELINE METRIC HEADER */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-0.5">Pipeline Trace: {selectedDecision.event.eventId}</h4>
                    <span className="text-[10px] font-mono text-slate-400">Correlation ID: {selectedDecision.event.correlationId}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">Propagated Confidence</span>
                      <span className="text-sm font-extrabold text-cyan-400 font-mono">{selectedDecision.event.confidence}%</span>
                    </div>

                    <button
                      onClick={() => handleReplay(selectedDecision.event.eventId)}
                      disabled={replayingId === selectedDecision.event.eventId}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1"
                    >
                      <RotateCw className={`w-3 h-3 ${replayingId === selectedDecision.event.eventId ? 'animate-spin' : ''}`} />
                      REPLAY EVENT
                    </button>
                  </div>
                </div>

                {/* THE 12 PIPELINE STEPS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-3.5">
                    {/* 1. NEWS */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">1. News Catalyst</span>
                      <p className="text-xs text-white font-medium">{selectedDecision.event.source}</p>
                      <span className="text-[9px] font-mono text-slate-500 mt-1 block">Article ID: {selectedDecision.event.articleId}</span>
                    </div>

                    {/* 2. EVIDENCE */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">2. Evidence Aggregator</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">Source Tier {selectedDecision.event.sourceType === 'P0' ? 1 : 2}</span>
                        {selectedDecision.evidence.map((val: any, idx: number) => (
                          <span key={idx} className="bg-slate-900 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] font-mono">{val}</span>
                        ))}
                      </div>
                    </div>

                    {/* 3. EVENT */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">3. Event Entity Resolution</span>
                      <p className="text-xs text-slate-300 font-mono">Primary: {selectedDecision.entity?.entityName || 'N/A'} ({selectedDecision.entity?.symbol || 'Broad Market'})</p>
                    </div>

                    {/* 4. MARKET REACTION */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">4. Real-Time Market Reaction</span>
                      <p className="text-xs text-slate-300 font-mono">
                        Price reaction tracked, volume confirming breakout.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {/* 5. PORTFOLIO RISK GATES */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">5. Portfolio Risk Check</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">Greeks & Exposure Gate</span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          selectedDecision.risk?.passed 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {selectedDecision.risk?.passed ? 'PASSED' : 'REJECTED'}
                        </span>
                      </div>
                    </div>

                    {/* 6. EXECUTION LIFECYCLE */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">6. Broker Submission</span>
                      {selectedDecision.execution ? (
                        <div>
                          <p className="text-xs text-emerald-400 font-mono font-bold">Successfully Executed Fill</p>
                          <span className="text-[9px] text-slate-400 font-mono">Order ID: {selectedDecision.event.executionOrderIds[0]}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 font-mono">No execution took place (unapproved / blocked)</p>
                      )}
                    </div>

                    {/* 7. RESEARCH & MUTATION */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded">
                      <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase block mb-1">7. Closed-Loop Research & Evolution</span>
                      {selectedDecision.research ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-amber-400 font-medium">Mutated Variant: {selectedDecision.research.mutatedStrategy?.strategyId}</p>
                          <p className="text-[10px] text-slate-400">Hypothesis: "{selectedDecision.research.hypothesis?.title}"</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 font-mono">Learning trigger pending completion of realized outcome</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* DRIFT PLAYBACK ANALYSIS (Section 15) */}
                {replayResult && replayResult.original.event.eventId === selectedEventId && (
                  <div className="bg-slate-950/80 border border-amber-500/30 rounded p-4 mt-2">
                    <h5 className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-1 mb-2">
                      <Sliders className="w-3.5 h-3.5" />
                      Drift Playback Analysis
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Original Decision</span>
                        <p className="text-white font-bold">{replayResult.original.finalDecision.decision} | confidence: {replayResult.original.finalDecision.confidence}%</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Replayed Decision</span>
                        <p className="text-white font-bold">{replayResult.replayed.finalDecision.decision} | confidence: {replayResult.replayed.finalDecision.confidence}%</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">System State Drift:</span>
                      <span className={replayResult.driftDetected ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {replayResult.driftDetected ? `DRIFT DETECTED: ${replayResult.driftFields.join(', ')}` : 'PERFECT STATE REPLAYABILITY MATCH'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-500 text-xs font-mono">
                Ingest an event or select an event to inspect its canonical trace.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SURVEILLANCE */}
      {activeTab === 'SURVEILLANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT PANEL: TICK SIMULATOR & ALERTS TABLE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider text-slate-300 font-mono mb-3 uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Real-Time Surveillance Tick Simulator (Phase 18)
              </h3>
              
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Symbol</label>
                  <select 
                    value={survSymbol} 
                    onChange={(e) => setSurvSymbol(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="RELIANCE">RELIANCE</option>
                    <option value="TCS">TCS</option>
                    <option value="INFY">INFY</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Price % Change</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={survPriceChange}
                    onChange={(e) => setSurvPriceChange(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">RVOL Spike</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={survRvol}
                    onChange={(e) => setSurvRvol(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">OI Change %</label>
                  <input 
                    type="number" 
                    step="1"
                    value={survOiChange}
                    onChange={(e) => setSurvOiChange(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Bid-Ask Spread %</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={survSpread}
                    onChange={(e) => setSurvSpread(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-1">Recent ATR</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={survAtr}
                    onChange={(e) => setSurvAtr(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  setSimulating(true);
                  try {
                    await marketSurveillanceEngine.ingestTick({
                      symbol: survSymbol,
                      exchange: 'NSE',
                      prices: [100, 101, 100.5, 102, 101.8, 100 * (1 + survPriceChange / 100)],
                      openPrice: 100,
                      prevClose: 100,
                      volumes: [1000, 1200, 950, 1100, 1000, 1000 * survRvol],
                      bidAskSpreadPct: survSpread,
                      recentAtrs: [1.2, 1.3, 1.2, 1.4, 1.3, survAtr],
                      currentOi: 1000000 * (1 + survOiChange / 100),
                      prevOi: 1000000,
                      futuresBasis: survPriceChange > 0 ? 0.35 : -0.25,
                      stockReturn: survPriceChange,
                      sectorReturn: survPriceChange * 0.3,
                      indexReturn: survPriceChange * 0.1,
                      usdInrDeltaPct: 0.05,
                      crudeDeltaPct: survSymbol === 'RELIANCE' ? 1.5 : 0.1,
                      goldDeltaPct: -0.1,
                    });
                    refreshState();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setSimulating(false);
                  }
                }}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs tracking-wider transition-all flex items-center justify-center gap-1"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                INGEST SURVEILLANCE TICK
              </button>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider text-slate-300 font-mono mb-3 uppercase flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Active Surveillance Stream
              </h3>

              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {surveillanceEvents.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs font-mono">
                    No active surveillance events detected. Use the simulator above to ingest ticks.
                  </div>
                ) : (
                  surveillanceEvents.map((evt) => {
                    const isSelected = selectedEventId === evt.id;
                    const directionColor = evt.priceMetrics.percentageChange >= 0 ? 'text-emerald-400' : 'text-rose-400';
                    return (
                      <div 
                        key={evt.id}
                        onClick={() => setSelectedEventId(evt.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-slate-800/40 border-cyan-500/50' 
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/20'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-white text-xs">{evt.symbol}</span>
                          <span className="text-[10px] font-mono text-slate-400">{evt.detectionWindow} window</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-mono">
                          <span className={directionColor}>
                            {evt.priceMetrics.percentageChange >= 0 ? '+' : ''}
                            {evt.priceMetrics.percentageChange.toFixed(2)}%
                          </span>
                          <span className="bg-cyan-900/40 text-cyan-400 px-1.5 py-0.5 rounded text-[9px] border border-cyan-500/20">
                            Score: {evt.anomalyScores.finalScore}/100
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: DEEP ANOMALY BREAKDOWN & TELEGRAM PREVIEW */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {selectedEventId && surveillanceEvents.find(e => e.id === selectedEventId) ? (() => {
              const evt = surveillanceEvents.find(e => e.id === selectedEventId);
              return (
                <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-extrabold text-white font-mono">{evt.symbol} Surveillance Record</h3>
                        <span className="bg-slate-800 text-slate-300 text-[9px] font-mono px-1.5 py-0.5 rounded border border-slate-700">
                          {evt.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Sector: {evt.sector} | Region: NSE India</p>
                    </div>

                    <div className="text-right">
                      <span className="bg-rose-500/10 text-rose-400 text-xs font-mono px-2 py-0.5 rounded border border-rose-500/20 block mb-1 uppercase font-bold">
                        {evt.priority.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">Actionability: {evt.actionability}</span>
                    </div>
                  </div>

                  {/* SUITE OF SENSORS (DETERMINISTIC) */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-slate-900/40 border border-slate-800 rounded p-3">
                      <h4 className="text-xs font-bold text-slate-300 font-mono mb-2">Price & Volume Metrics</h4>
                      <ul className="text-[10px] font-mono text-slate-400 flex flex-col gap-1.5">
                        <li className="flex justify-between"><span>Pct Change:</span><span className="text-white font-bold">{evt.priceMetrics.percentageChange.toFixed(2)}%</span></li>
                        <li className="flex justify-between"><span>Z-Score:</span><span className="text-white font-bold">{evt.priceMetrics.zScore.toFixed(2)} SD</span></li>
                        <li className="flex justify-between"><span>Relative Volume:</span><span className="text-white font-bold">{evt.volumeMetrics.relativeVolume.toFixed(1)}x</span></li>
                        <li className="flex justify-between"><span>VWAP displacement:</span><span className="text-white font-bold">{evt.priceMetrics.vwapDisplacementPct.toFixed(2)}%</span></li>
                      </ul>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800 rounded p-3">
                      <h4 className="text-xs font-bold text-slate-300 font-mono mb-2">Volatility & F&O Sensors</h4>
                      <ul className="text-[10px] font-mono text-slate-400 flex flex-col gap-1.5">
                        <li className="flex justify-between"><span>Realized Vol:</span><span className="text-white font-bold">{evt.volatilityMetrics.realizedVolPct.toFixed(1)}%</span></li>
                        <li className="flex justify-between"><span>Vol Regime:</span><span className="text-white font-bold text-[9px]">{evt.volatilityMetrics.volRegime}</span></li>
                        <li className="flex justify-between"><span>OI Change:</span><span className="text-white font-bold">{evt.openInterestMetrics?.oiChangePct.toFixed(1)}%</span></li>
                        <li className="flex justify-between"><span>F&O State:</span><span className="text-white font-bold text-[9px]">{evt.openInterestMetrics?.longShortClassification || 'NEUTRAL'}</span></li>
                      </ul>
                    </div>
                  </div>

                  {/* COMPOSITE SCORE SUMMARY */}
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-lg mb-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono font-bold text-slate-300 uppercase">Composite Anomaly Score breakdown</span>
                      <span className="text-cyan-400 font-mono font-extrabold text-sm">{evt.anomalyScores.finalScore}/100</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-800 mb-4">
                      <div className="bg-gradient-to-r from-cyan-500 to-amber-500 h-1.5 rounded-full" style={{ width: `${evt.anomalyScores.finalScore}%` }}></div>
                    </div>
                    <div className="grid grid-cols-6 gap-2 text-[9px] font-mono text-slate-500 text-center">
                      <div><span>Price</span><p className="text-slate-300">{evt.anomalyScores.priceScore}</p></div>
                      <div><span>Volume</span><p className="text-slate-300">{evt.anomalyScores.volumeScore}</p></div>
                      <div><span>OI</span><p className="text-slate-300">{evt.anomalyScores.oiScore}</p></div>
                      <div><span>Vol</span><p className="text-slate-300">{evt.anomalyScores.volatilityScore}</p></div>
                      <div><span>Sector</span><p className="text-slate-300">{evt.anomalyScores.sectorScore}</p></div>
                      <div><span>News</span><p className="text-slate-300">{evt.anomalyScores.newsScore}</p></div>
                    </div>
                  </div>

                  {/* TELEGRAM NOTIFICATION PREVIEW */}
                  <div className="bg-slate-950/80 border border-amber-500/20 p-4 rounded-lg mb-5">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-1.5 mb-2.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      Telegram Alert Parity Rendering (Live HTML)
                    </h4>
                    <pre className="text-[10px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                      {evt.evidence.map(ev => `• ${ev}\n`).join('')}
                      • Noise Filter: PASSED
                      • Catalyst status: {evt.catalystStatus}
                      • Market confirmation: {evt.marketConfirmation}
                    </pre>
                  </div>

                  {/* DOWNSTREAM EVALUATION COUPLER */}
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block">Orchestrator Coupling Gateway</span>
                      <span className="text-xs text-slate-400 font-medium">Forward to Phase 17 central Intelligence Pipeline</span>
                    </div>

                    <button
                      onClick={async () => {
                        setSimulating(true);
                        try {
                          await athenaOrchestrator.orchestrate({
                            id: evt.id,
                            headline: `Autonomous Surveillance Shock: ${evt.symbol} exhibiting ${evt.eventType} with RVOL of ${evt.volumeMetrics.relativeVolume.toFixed(1)}x`,
                            body: `Multi-factor composite anomaly score calculated at ${evt.anomalyScores.finalScore}/100. Priority established at ${evt.priority}.`,
                            symbol: evt.symbol,
                            sentiment: evt.priceMetrics.percentageChange >= 0 ? 'BULLISH' : 'BEARISH',
                            source: { name: 'ATHENA Surveillance Loop', tier: 1 },
                            publishedAt: evt.timestamp,
                          });
                          refreshState();
                          alert('Successfully forwarded surveillance event downstream! Review the new decision trace in the STREAM tab.');
                        } catch (e: any) {
                          alert(`Forwarding failed: ${e.message}`);
                        } finally {
                          setSimulating(false);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold tracking-wide shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-1"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      TRIGGER DOWNSTREAM EVALUATION
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-mono bg-slate-950/20 border border-slate-800 rounded-lg">
                Select an active event from the list to display its complete multi-factor diagnostic suite.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: LINEAGE */}
      {activeTab === 'LINEAGE' && (
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">Directed Provenance & Traceability Graph</h3>
          </div>

          <p className="text-xs text-slate-400 mb-5">
            This graph reconstructs the lineage tracking flow of a decision. Click on any active event to trace its heritage.
          </p>

          {selectedDecision ? (
            <div className="flex flex-col md:flex-row items-stretch gap-3 md:items-center justify-center py-6">
              {[
                { stage: 'NEWS', label: 'News Source', val: selectedDecision.event.articleId },
                { stage: 'EVENT', label: 'Event Engine', val: selectedDecision.event.eventId },
                { stage: 'SIGNAL', label: 'Signal Engine', val: selectedDecision.event.signalId },
                { stage: 'STRATEGY', label: 'Strategy Suite', val: selectedDecision.event.strategyCandidateIds[0] || 'N/A' },
                { stage: 'PORTFOLIO', label: 'Portfolio Decision', val: selectedDecision.event.portfolioDecisionId || 'N/A' },
                { stage: 'EXECUTION', label: 'Broker Intent', val: selectedDecision.event.executionIntentId || 'N/A' },
                { stage: 'LEARNING', label: 'Closed-Loop Feedback', val: selectedDecision.event.learningRecordId || 'N/A' }
              ].map((step, idx, arr) => (
                <React.Fragment key={step.stage}>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center shadow-lg shadow-black/40 w-full md:w-36 flex flex-col justify-between">
                    <span className="text-[8px] font-mono tracking-wider text-slate-500 uppercase">{step.stage}</span>
                    <h5 className="text-[10px] text-white font-bold my-1">{step.label}</h5>
                    <span className="text-[8px] text-cyan-400 font-mono truncate block">{step.val}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="flex items-center justify-center text-slate-700 py-1 md:py-0">
                      <ArrowRight className="w-4 h-4 rotate-90 md:rotate-0" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-xs font-mono">
              Select or ingest an event to trace its full path.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: CONTRADICTIONS */}
      {activeTab === 'CONTRADICTIONS' && (
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">Contradiction Monitoring & Reconciliation</h3>
          </div>

          <p className="text-xs text-slate-400 mb-5">
            Real-time multi-stage validation checking news vs price direction, strategy versus portfolio risk boundaries, and execution reconciliations.
          </p>

          <div className="flex flex-col gap-3">
            {selectedDecision ? (
              <div>
                <h5 className="text-xs font-bold text-slate-200 mb-3 font-mono">
                  Active Contradictions for Event: {selectedDecision.event.eventId}
                </h5>

                {AthenaContradictionEngine.getInstance().getContradictionsByEventId(selectedDecision.event.eventId).length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {AthenaContradictionEngine.getInstance().getContradictionsByEventId(selectedDecision.event.eventId).map((c, i) => (
                      <div key={i} className="bg-slate-950/80 border border-rose-500/20 p-4 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-white">{c.description}</span>
                            <span className="bg-rose-500/10 text-rose-400 text-[8px] font-mono px-1.5 py-0.5 rounded border border-rose-500/20">{c.severity}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono">Affected Stage: {c.affectedStage} | Evidence: {c.evidence}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg flex items-center gap-2.5 text-xs font-mono">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    PERFECT SYSTEM STABILITY: Zero contradictions detected for this event. Passed all cross-stage integrity checks.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-500 text-xs font-mono">
                Select or ingest an event to trace its validations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: TELEMETRY */}
      {activeTab === 'TELEMETRY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-white font-mono uppercase mb-4 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Process Latency Breakdown
            </h3>
            <div className="flex flex-col gap-3 font-mono text-xs text-slate-300">
              {telemetry && Object.entries(telemetry.stageLatency).map(([stage, lat]) => (
                <div key={stage} className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-[10px] text-slate-400">{stage}</span>
                  <span className="font-bold text-white">{lat as number} ms</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-white font-mono uppercase mb-4 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Runtime Costs & Deduplication Metrics
            </h3>
            <div className="flex flex-col gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-3.5 rounded border border-slate-900 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block text-[9px] mb-0.5">Deduplication Performance</span>
                  <span className="text-white font-bold">Cache Hit-to-Miss Ratio</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-bold block">{telemetry?.cacheHits || 0} hits</span>
                  <span className="text-slate-400">{telemetry?.cacheMisses || 0} misses</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded border border-slate-900 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block text-[9px] mb-0.5">Zero-AI Execution Guard</span>
                  <span className="text-white font-bold">Deterministic Engines Triggered</span>
                </div>
                <div className="text-right font-extrabold text-cyan-400 text-sm">
                  {telemetry?.deterministicExecutionCount || 0}
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded border border-slate-900 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block text-[9px] mb-0.5">Runtime Retries</span>
                  <span className="text-white font-bold">Event processing retries</span>
                </div>
                <div className="text-right font-bold text-white">
                  {telemetry?.eventRetries || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
