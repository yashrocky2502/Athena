import React, { useState, useEffect } from 'react';
import { 
  Zap, Compass, ShieldAlert, GitBranch, Terminal, Layers, 
  RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Play, 
  Plus, Search, ArrowRight, Share2, Activity, Send, FileText, 
  TrendingUp, BarChart3, HelpCircle, Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// INTERFACES
// ==========================================
export interface RegimeDiscoveryResult {
  regime: string;
  confidencePct: number;
  evidence: Array<{ metric: string; val: number; threshold: string; isTriggered: boolean }>;
}

export interface TransitionHistoryItem {
  timestamp: string;
  fromRegime: string;
  toRegime: string;
  actionability: string;
  reason: string;
}

export interface DecayReport {
  strategyName: string;
  score: number;
  state: 'HEALTHY' | 'DEGRADED' | 'RETIRED';
  metrics: {
    rollingWinRate: number;
    profitFactor: number;
    consecutiveLosses: number;
    slippageOverhead: number;
    drawdown: number;
    volatilityDecay: number;
  };
}

export interface MutatedStrategy {
  strategyId: string;
  parentStrategyId: string | null;
  strategyName: string;
  version: string;
  parameters: Record<string, any>;
  mutationRationale: string | null;
  lineage: string[];
  backtestScore?: number;
  oosScore?: number;
  walkForwardScore?: number;
}

export interface ResearchItem {
  itemId: string;
  type: 'HYPOTHESIS' | 'BACKTEST' | 'REGIME_ALIGNMENT' | 'OPTIMIZATION';
  title: string;
  description: string;
  expectedInformationGain: number;
  marketRelevanceScore: number;
  statisticalPotential: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED';
}

export interface Hypothesis {
  hypothesisId: string;
  title: string;
  description: string;
  expectedInformationGain: number;
  marketRelevanceScore: number;
  statisticalPotential: number;
}

export interface AnalogueMatch {
  date: string;
  symbol: string;
  eventType: string;
  sector: string;
  regime: string;
  postEventReturnPct: number;
  maxFavorableExcursionPct: number;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'STRATEGY' | 'VARIANT' | 'HYPOTHESIS';
  status?: string;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  label: string;
}

export const ResearchEvolutionDashboard: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'REGIME' | 'HEALTH' | 'EVOLUTION' | 'QUEUE' | 'MEMORY' | 'GRAPH'>('REGIME');

  // Loader & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [evaluatingRegime, setEvaluatingRegime] = useState<boolean>(false);
  const [generatingHypothesis, setGeneratingHypothesis] = useState<boolean>(false);
  const [evolvingStrategy, setEvolvingStrategy] = useState<boolean>(false);
  const [evaluatingGate, setEvaluatingGate] = useState<boolean>(false);
  const [queryingMemory, setQueryingMemory] = useState<boolean>(false);

  // Success Feedback
  const [alertDispatched, setAlertDispatched] = useState<string | null>(null);

  // 1. Regime Discovery States
  const [regimeMetrics, setRegimeMetrics] = useState({
    adx: 25,
    trendStrength: 30,
    vwapDisplacementPct: 0.8,
    marketBreadthPct: 55,
    volumeZScore: 1.5
  });
  const [regimeResult, setRegimeResult] = useState<RegimeDiscoveryResult | null>(null);
  const [transitionState, setTransitionState] = useState<{
    activeRegime: string;
    history: TransitionHistoryItem[];
    isNoisyTickFiltered: boolean;
  }>({
    activeRegime: 'RANGE_BOUND',
    history: [],
    isNoisyTickFiltered: false
  });

  // 2. Strategy Health & Decay States
  const [selectedStrategy, setSelectedStrategy] = useState<string>('FUTURES_BREAKOUT');
  const [decayReport, setDecayReport] = useState<DecayReport | null>(null);
  const [allDecayReports, setAllDecayReports] = useState<Record<string, DecayReport>>({});

  // 3. Evolution & Promotion Gate States
  const [evolvedStrategies, setEvolvedStrategies] = useState<MutatedStrategy[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [mutationField, setMutationField] = useState<string>('rvolThreshold');
  const [mutationValue, setMutationValue] = useState<string>('1.8');
  const [mutationRationale, setMutationRationale] = useState<string>('Improve signal signal-to-noise ratio in high volatility regimes');
  
  // Promotion Gate params for the selected mutated strategy
  const [selectedMutatedIdForGate, setSelectedMutatedIdForGate] = useState<string>('');
  const [gateMetrics, setGateMetrics] = useState({
    oosScore: 78,
    walkForwardScore: 72,
    monteCarloPassRate: 94,
    hasLookAheadBias: false,
    maxLeverageLimit: 3
  });
  const [promotionResult, setPromotionResult] = useState<any>(null);

  // 4. Research Queue & Hypotheses States
  const [queue, setQueue] = useState<ResearchItem[]>([]);
  const [seedTopic, setSeedTopic] = useState<string>('earnings gap-up momentum drift');
  const [generatedHypothesis, setGeneratedHypothesis] = useState<Hypothesis | null>(null);

  // 5. Analogue Memory States
  const [memoryFilter, setMemoryFilter] = useState({
    eventType: 'EARNINGS',
    sector: 'IT',
    regime: 'TRENDING_BULL'
  });
  const [memoryMatches, setMemoryMatches] = useState<AnalogueMatch[]>([]);
  const [memoryAnalysis, setMemoryAnalysis] = useState<any>(null);

  // 6. Knowledge Graph States
  const [graphData, setGraphData] = useState<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }>({ nodes: [], edges: [] });

  // Load Initial Data
  useEffect(() => {
    fetchInitialResearchData();
  }, []);

  const fetchInitialResearchData = async () => {
    try {
      setLoading(true);
      const [transRes, decayRes, evolRes, queueRes, graphRes] = await Promise.all([
        fetch('/api/v5/research/regime-transition').then(r => r.json()).catch(() => null),
        fetch(`/api/v5/research/strategy-decay?strategy=${selectedStrategy}`).then(r => r.json()).catch(() => null),
        fetch('/api/v5/research/strategy-evolution').then(r => r.json()).catch(() => null),
        fetch('/api/v5/research/experiments').then(r => r.json()).catch(() => null),
        fetch('/api/v5/research/knowledge-graph').then(r => r.json()).catch(() => null),
      ]);

      if (transRes?.status === 'success') {
        setTransitionState({
          activeRegime: transRes.activeRegime,
          history: transRes.history || [],
          isNoisyTickFiltered: false
        });
      }

      if (decayRes?.status === 'success') {
        setDecayReport(decayRes.report);
        setAllDecayReports(decayRes.allDecayReports || {});
      }

      if (evolRes?.status === 'success') {
        setEvolvedStrategies(evolRes.strategies || []);
        if (evolRes.strategies?.length > 0) {
          setSelectedParentId(evolRes.strategies[0].strategyId);
          setSelectedMutatedIdForGate(evolRes.strategies[0].strategyId);
        }
      }

      if (queueRes?.status === 'success') {
        setQueue(queueRes.queue || []);
      }

      if (graphRes?.status === 'success') {
        setGraphData({
          nodes: graphRes.nodes || [],
          edges: graphRes.edges || []
        });
      }
    } catch (err) {
      console.error('Error fetching initial research data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Evaluate Regime Trigger
  const handleEvaluateRegime = async () => {
    try {
      setEvaluatingRegime(true);
      const res = await fetch('/api/v5/research/regime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: regimeMetrics })
      }).then(r => r.json());

      if (res.status === 'success') {
        setRegimeResult(res.result);
        setTransitionState({
          activeRegime: res.activeRegime,
          history: transitionState.history,
          isNoisyTickFiltered: res.isNoisyTickFiltered
        });

        // Trigger transition status reload
        const transReload = await fetch('/api/v5/research/regime-transition').then(r => r.json()).catch(() => null);
        if (transReload?.status === 'success') {
          setTransitionState(prev => ({
            ...prev,
            activeRegime: transReload.activeRegime,
            history: transReload.history || []
          }));
        }
      }
    } catch (err) {
      console.error('Error evaluating regime:', err);
    } finally {
      setEvaluatingRegime(false);
    }
  };

  // 2. Fetch specific strategy decay report
  const handleFetchDecay = async (strat: string) => {
    setSelectedStrategy(strat);
    try {
      const res = await fetch(`/api/v5/research/strategy-decay?strategy=${strat}`).then(r => r.json());
      if (res.status === 'success') {
        setDecayReport(res.report);
      }
    } catch (err) {
      console.error('Error fetching strategy decay:', err);
    }
  };

  // 3. Evolve Mutated Strategy
  const handleEvolveStrategy = async () => {
    try {
      setEvolvingStrategy(true);
      const valParsed = isNaN(Number(mutationValue)) ? mutationValue : Number(mutationValue);
      const res = await fetch('/api/v5/research/strategy-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentStrategyId: selectedParentId,
          fieldToMutate: mutationField,
          newValue: valParsed,
          rationale: mutationRationale
        })
      }).then(r => r.json());

      if (res.status === 'success') {
        // Refresh strategies and graph
        const [evolRes, graphRes] = await Promise.all([
          fetch('/api/v5/research/strategy-evolution').then(r => r.json()).catch(() => null),
          fetch('/api/v5/research/knowledge-graph').then(r => r.json()).catch(() => null)
        ]);

        if (evolRes?.status === 'success') {
          setEvolvedStrategies(evolRes.strategies || []);
          setSelectedMutatedIdForGate(res.evolved.strategyId);
        }

        if (graphRes?.status === 'success') {
          setGraphData({ nodes: graphRes.nodes || [], edges: graphRes.edges || [] });
        }

        setMutationValue('');
        setMutationRationale('');
      }
    } catch (err) {
      console.error('Error evolving strategy:', err);
    } finally {
      setEvolvingStrategy(false);
    }
  };

  // 3.5 Evaluate Promotion Gate
  const handleEvaluatePromotionGate = async () => {
    try {
      setEvaluatingGate(true);
      const res = await fetch('/api/v5/research/promotion-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedMutatedIdForGate,
          additionalMetrics: {
            oosScore: Number(gateMetrics.oosScore),
            walkForwardScore: Number(gateMetrics.walkForwardScore),
            monteCarloPassRate: Number(gateMetrics.monteCarloPassRate),
            hasLookAheadBias: gateMetrics.hasLookAheadBias,
            maxLeverageLimit: Number(gateMetrics.maxLeverageLimit)
          }
        })
      }).then(r => r.json());

      if (res.status === 'success') {
        setPromotionResult(res.result);
      }
    } catch (err) {
      console.error('Error evaluating promotion gate:', err);
    } finally {
      setEvaluatingGate(false);
    }
  };

  // 4. Generate AI Hypothesis
  const handleGenerateHypothesis = async () => {
    try {
      setGeneratingHypothesis(true);
      const res = await fetch('/api/v5/research/hypotheses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedTopic })
      }).then(r => r.json());

      if (res.status === 'success') {
        setGeneratedHypothesis(res.generated);
        
        // Reload research queue and graph
        const [queueRes, graphRes] = await Promise.all([
          fetch('/api/v5/research/experiments').then(r => r.json()).catch(() => null),
          fetch('/api/v5/research/knowledge-graph').then(r => r.json()).catch(() => null)
        ]);

        if (queueRes?.status === 'success') {
          setQueue(queueRes.queue || []);
        }
        if (graphRes?.status === 'success') {
          setGraphData({ nodes: graphRes.nodes || [], edges: graphRes.edges || [] });
        }
      }
    } catch (err) {
      console.error('Error generating hypothesis:', err);
    } finally {
      setGeneratingHypothesis(false);
    }
  };

  // 5. Query Analogue Memory
  const handleQueryMemory = async () => {
    try {
      setQueryingMemory(true);
      const queryParams = new URLSearchParams(memoryFilter).toString();
      const res = await fetch(`/api/v5/research/market-memory?${queryParams}`).then(r => r.json());
      if (res.status === 'success') {
        setMemoryMatches(res.matches || []);
        setMemoryAnalysis(res.analysis || null);
      }
    } catch (err) {
      console.error('Error querying memory:', err);
    } finally {
      setQueryingMemory(false);
    }
  };

  // Dispatch alert mock trigger (For UI presentation)
  const handleDispatchTelegramAlert = (type: string) => {
    setAlertDispatched(type);
    setTimeout(() => {
      setAlertDispatched(null);
    }, 4000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-5 font-sans space-y-6 text-slate-100" id="athena-research-evolution-dashboard">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5.5 h-5.5 text-indigo-400 animate-pulse" />
          <div>
            <h2 className="text-base font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
              Phase 16 — Autonomous Research, Regime Discovery & Strategy Evolution
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Multi-regime Calibration • Alpha Decay Detection • Mutation Versioning Lineage • Anti-Overfitting Gates • AI Hypotheses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInitialResearchData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-200 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync Lab Data</span>
          </button>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex flex-wrap border-b border-slate-850 gap-1 font-mono text-xs">
        {[
          { key: 'REGIME', label: 'Regime Discovery', icon: Compass },
          { key: 'HEALTH', label: 'Strategy Health & Decay', icon: Activity },
          { key: 'EVOLUTION', label: 'Evolution Lab & Gate', icon: GitBranch },
          { key: 'QUEUE', label: 'Research Queue', icon: Terminal },
          { key: 'MEMORY', label: 'Historical Memory', icon: Search },
          { key: 'GRAPH', label: 'Knowledge Graph', icon: Network },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 pb-2 px-3.5 border-b-2 font-semibold transition ${
                isActive
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN VIEWPORT PANELS */}
      <div className="min-h-[400px]">
        
        {/* TAB 1: REGIME DISCOVERY */}
        {activeTab === 'REGIME' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT: METRICS CALIBRATION (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4">
                <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span>Interactive Calibration Engine</span>
                </span>

                <div className="space-y-3.5 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">ADX (Trend Strength Indicator): <span className="text-indigo-400 font-bold">{regimeMetrics.adx}</span></label>
                    <input 
                      type="range" min="5" max="60" step="1"
                      value={regimeMetrics.adx} 
                      onChange={(e) => setRegimeMetrics({...regimeMetrics, adx: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Directional Strength (Trend Power): <span className="text-indigo-400 font-bold">{regimeMetrics.trendStrength}</span></label>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={regimeMetrics.trendStrength} 
                      onChange={(e) => setRegimeMetrics({...regimeMetrics, trendStrength: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">VWAP Displacement (%): <span className="text-indigo-400 font-bold">{regimeMetrics.vwapDisplacementPct}%</span></label>
                    <input 
                      type="range" min="-3" max="3" step="0.1"
                      value={regimeMetrics.vwapDisplacementPct} 
                      onChange={(e) => setRegimeMetrics({...regimeMetrics, vwapDisplacementPct: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Market Breadth (% Advances): <span className="text-indigo-400 font-bold">{regimeMetrics.marketBreadthPct}%</span></label>
                    <input 
                      type="range" min="10" max="90" step="2"
                      value={regimeMetrics.marketBreadthPct} 
                      onChange={(e) => setRegimeMetrics({...regimeMetrics, marketBreadthPct: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Volume Z-Score: <span className="text-indigo-400 font-bold">{regimeMetrics.volumeZScore}</span></label>
                    <input 
                      type="range" min="-1" max="4" step="0.1"
                      value={regimeMetrics.volumeZScore} 
                      onChange={(e) => setRegimeMetrics({...regimeMetrics, volumeZScore: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>
                </div>

                <button
                  onClick={handleEvaluateRegime}
                  disabled={evaluatingRegime}
                  className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${evaluatingRegime ? 'animate-spin' : ''}`} />
                  <span>Discover Current Regime</span>
                </button>
              </div>

              {/* RIGHT: REGIME DISCOVERY REPORT & TRANSITIONS (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* ACTIVE REGIME STATE */}
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                    <span className="text-xs font-mono uppercase font-bold text-slate-400">Deterministic Regime Classification</span>
                    <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400">3 Ticks Confirmation Window</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">Active Regime State</span>
                      <span className="text-lg font-bold font-mono tracking-tight text-indigo-400">
                        {transitionState.activeRegime}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">Noisy-Regime Filter</span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        transitionState.isNoisyTickFiltered 
                          ? 'bg-rose-950/30 text-rose-400 border-rose-900/30 animate-pulse' 
                          : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30'
                      }`}>
                        {transitionState.isNoisyTickFiltered ? 'NOISY TICK DETECTED & FILTERED' : 'STABLE STATE RUNNING'}
                      </span>
                    </div>
                  </div>

                  {/* Classification rationale / evidence */}
                  {regimeResult && (
                    <div className="mt-4 p-3 bg-slate-900/60 rounded border border-slate-850 text-xs font-mono space-y-2">
                      <div className="font-bold text-slate-300 flex justify-between">
                        <span>Classification Confidence:</span>
                        <span className="text-indigo-400">{regimeResult.confidencePct}%</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                        {regimeResult.evidence.map((ev, idx) => (
                          <div key={idx} className="p-1.5 bg-slate-950/50 rounded flex items-center justify-between border border-slate-900">
                            <span className="text-slate-400 text-[11px]">{ev.metric}: {ev.val}</span>
                            <span className={`px-1 rounded text-[9px] font-bold ${ev.isTriggered ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                              {ev.isTriggered ? '✔ COND' : '✖ REF'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* TRANSITION LOG */}
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850">
                  <span className="text-xs font-mono uppercase font-bold text-slate-400 block mb-2 border-b border-slate-850 pb-1.5">
                    Regime Change Alerts & Transition History
                  </span>
                  
                  {transitionState.history.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-mono">
                      No regime transition events recorded yet for this session.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                      {transitionState.history.slice().reverse().map((hist, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-900/50 rounded border border-slate-850 flex flex-col md:flex-row md:items-center justify-between text-xs font-mono gap-2">
                          <div>
                            <span className="text-slate-400">{new Date(hist.timestamp).toLocaleTimeString()}</span>
                            <span className="text-slate-500 mx-2">|</span>
                            <span className="text-rose-400">{hist.fromRegime}</span>
                            <span className="text-slate-400 mx-1.5">➔</span>
                            <span className="text-emerald-400 font-bold">{hist.toRegime}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-indigo-950/60 text-indigo-300 rounded text-[9px] font-bold border border-indigo-900/30">
                              ACTION: {hist.actionability}
                            </span>
                            <button
                              onClick={() => handleDispatchTelegramAlert(hist.toRegime)}
                              className="p-1 hover:text-teal-400 text-slate-500 transition"
                              title="Send alerting signal to Telegram parity channel"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Simulated Telegram Success Dialog */}
                  {alertDispatched && (
                    <div className="mt-3 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded text-xs font-mono text-emerald-300 animate-in slide-in-from-bottom duration-200">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>TELEGRAM ALERT CHANNEL PARITY DISPATCHED SECURELY</span>
                      </div>
                      <pre className="mt-1 text-[10px] text-slate-300 bg-slate-950/90 p-2 rounded whitespace-pre-wrap leading-relaxed border border-emerald-950">
                        🚨 ATHENA RESEARCH REGIME TRANSITION ALERT: {alertDispatched} State Engaged!
                      </pre>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STRATEGY HEALTH & DECAY DETECTION */}
        {activeTab === 'HEALTH' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-950/50 p-3 rounded border border-slate-850">
              <span className="text-xs font-mono uppercase text-slate-400 font-bold">Monitor Strategy Alpha Decay Logs</span>
              <div className="flex gap-2 font-mono text-xs">
                {['FUTURES_BREAKOUT', 'EQUITY_MOMENTUM_CONTINUATION'].map((strat) => (
                  <button
                    key={strat}
                    onClick={() => handleFetchDecay(strat)}
                    className={`px-3 py-1 rounded border transition ${
                      selectedStrategy === strat
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {strat}
                  </button>
                ))}
              </div>
            </div>

            {decayReport ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. HEALTH METER CARD */}
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">Decay Calibration State</span>
                    <span className="text-lg font-bold font-mono text-white block mt-0.5">{decayReport.strategyName}</span>
                    
                    <div className="mt-4 p-4 rounded-lg border text-center font-mono space-y-1.5 bg-slate-900/60 border-slate-800">
                      <span className="text-[10px] text-slate-500 block">DETERMINISTIC EVALUATION STATE</span>
                      <span className={`text-xl font-bold tracking-tight block ${
                        decayReport.state === 'HEALTHY' ? 'text-emerald-400' :
                        decayReport.state === 'DEGRADED' ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {decayReport.state}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-850 pt-3">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-500">Decay Health Score</span>
                      <span className={`font-bold ${decayReport.score >= 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {decayReport.score}/100
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded mt-1.5 overflow-hidden">
                      <div 
                        className={`h-full ${decayReport.score >= 70 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${decayReport.score}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. STATISTICAL DECAY METRICS (2 cols span) */}
                <div className="md:col-span-2 bg-slate-950/70 p-4 rounded-lg border border-slate-850">
                  <span className="text-xs font-mono uppercase font-bold text-slate-400 block mb-3 border-b border-slate-850 pb-1.5">
                    Continuous Drift, Slippage, and Alpha Degradation Statistics
                  </span>

                  <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-850">
                      <span className="text-slate-500 block text-[10px] uppercase">Rolling Win Rate</span>
                      <span className="text-white font-bold text-sm block mt-0.5">{decayReport.metrics.rollingWinRate}%</span>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-850">
                      <span className="text-slate-500 block text-[10px] uppercase">Profit Factor (Expected EV)</span>
                      <span className="text-white font-bold text-sm block mt-0.5">{decayReport.metrics.profitFactor}x</span>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-850">
                      <span className="text-slate-500 block text-[10px] uppercase">Consecutive Failures</span>
                      <span className="text-white font-bold text-sm block mt-0.5">{decayReport.metrics.consecutiveLosses}</span>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-850">
                      <span className="text-slate-500 block text-[10px] uppercase">Slippage & Transaction Drag</span>
                      <span className="text-rose-400 font-bold text-sm block mt-0.5">{decayReport.metrics.slippageOverhead}%</span>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-850">
                      <span className="text-slate-500 block text-[10px] uppercase">Max Peak Drawdown</span>
                      <span className="text-rose-400 font-bold text-sm block mt-0.5">{decayReport.metrics.drawdown}%</span>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-850">
                      <span className="text-slate-500 block text-[10px] uppercase">Parameter Volatility Decay</span>
                      <span className="text-slate-300 font-bold text-sm block mt-0.5">{decayReport.metrics.volatilityDecay}%</span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-950/50 rounded border border-slate-850">
                Failed to load decay reports.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EVOLUTION LAB & GATE */}
        {activeTab === 'EVOLUTION' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT: MUTATION CONSOLE (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4">
                <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  <span>Parameter Mutation Lab</span>
                </span>

                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Select Parent Algorithm</label>
                    <select
                      value={selectedParentId}
                      onChange={(e) => setSelectedParentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white"
                    >
                      {evolvedStrategies
                        .filter(s => s.parentStrategyId === null)
                        .map(s => (
                          <option key={s.strategyId} value={s.strategyId}>{s.strategyName} (v{s.version})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Target Parameter</label>
                    <select
                      value={mutationField}
                      onChange={(e) => setMutationField(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white"
                    >
                      <option value="rvolThreshold">rvolThreshold</option>
                      <option value="stopLossPct">stopLossPct</option>
                      <option value="takeProfitPct">takeProfitPct</option>
                      <option value="holdingPeriodMinutes">holdingPeriodMinutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">New Value</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 1.8 or 45"
                      value={mutationValue}
                      onChange={(e) => setMutationValue(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Mutation Rationale (Lineage Track)</label>
                    <textarea 
                      placeholder="Input clinical/quantitative rationale for parameter adjustments..."
                      value={mutationRationale}
                      onChange={(e) => setMutationRationale(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white h-16 resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleEvolveStrategy}
                  disabled={evolvingStrategy || !mutationValue || !mutationRationale}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-mono text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Mutate & Track Lineage</span>
                </button>
              </div>

              {/* RIGHT: PROMOTION GATE EVALUATOR (7 cols) */}
              <div className="lg:col-span-7 bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4">
                <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Anti-Overfitting Promotion Gate</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Target Evolved Variant</label>
                    <select
                      value={selectedMutatedIdForGate}
                      onChange={(e) => setSelectedMutatedIdForGate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white"
                    >
                      {evolvedStrategies
                        .map(s => (
                          <option key={s.strategyId} value={s.strategyId}>{s.strategyName} (v{s.version})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Out-of-Sample Score (OOS): <span className="text-indigo-400">{gateMetrics.oosScore}</span></label>
                    <input 
                      type="range" min="30" max="99" step="1"
                      value={gateMetrics.oosScore} 
                      onChange={(e) => setGateMetrics({...gateMetrics, oosScore: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Walk-Forward Score: <span className="text-indigo-400">{gateMetrics.walkForwardScore}</span></label>
                    <input 
                      type="range" min="30" max="99" step="1"
                      value={gateMetrics.walkForwardScore} 
                      onChange={(e) => setGateMetrics({...gateMetrics, walkForwardScore: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Monte Carlo Pass Rate: <span className="text-indigo-400">{gateMetrics.monteCarloPassRate}%</span></label>
                    <input 
                      type="range" min="50" max="100" step="1"
                      value={gateMetrics.monteCarloPassRate} 
                      onChange={(e) => setGateMetrics({...gateMetrics, monteCarloPassRate: Number(e.target.value)})}
                      className="w-full accent-indigo-500 bg-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-850 rounded col-span-2">
                    <span className="text-slate-400">Flag Look-Ahead / Data Leakage Bias?</span>
                    <input 
                      type="checkbox"
                      checked={gateMetrics.hasLookAheadBias}
                      onChange={(e) => setGateMetrics({...gateMetrics, hasLookAheadBias: e.target.checked})}
                      className="w-4 h-4 accent-rose-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleEvaluatePromotionGate}
                  disabled={evaluatingGate || !selectedMutatedIdForGate}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute Verification Suite & Evaluate Promotion</span>
                </button>

                {/* PROMOTION GATE RESULTS DISPLAY */}
                {promotionResult && (
                  <div className={`p-4 rounded border text-xs font-mono space-y-2.5 animate-in slide-in-from-top duration-200 ${
                    promotionResult.promoted 
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300' 
                      : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                  }`}>
                    <div className="flex items-center justify-between border-b border-slate-800/40 pb-1.5">
                      <span className="font-bold flex items-center gap-1.5">
                        {promotionResult.promoted ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                        <span>{promotionResult.promoted ? 'GATE PASSED — STRATEGY PROMOTED' : 'GATE REJECTED — FAILED REQUIREMENTS'}</span>
                      </span>
                      <span className="font-bold">{promotionResult.score.toFixed(0)}/100</span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {promotionResult.reason}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                      {promotionResult.gatingLogs?.map((log: string, lIdx: number) => (
                        <div key={lIdx} className="p-1.5 bg-slate-950/50 rounded text-slate-400 border border-slate-900">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* EVOLVED ALGORITHMS LINEAGE CATALOG */}
            <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850">
              <span className="text-xs font-mono uppercase font-bold text-slate-400 block mb-3 border-b border-slate-850 pb-1.5">
                Lineage Registry & Parameter Tracking Ledger
              </span>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 font-mono text-xs">
                {evolvedStrategies.map((strat) => (
                  <div key={strat.strategyId} className="p-3 bg-slate-900/40 rounded border border-slate-850 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{strat.strategyName}</span>
                        <span className="px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-900/40 rounded text-[9px] font-bold">
                          v{strat.version}
                        </span>
                      </div>
                      
                      <div className="text-[10px] text-slate-500">
                        Lineage Track: <span className="text-indigo-400">{strat.lineage.join(' ➔ ')}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      {Object.keys(strat.parameters).map((paramName) => (
                        <div key={paramName} className="p-1.5 bg-slate-950/60 rounded border border-slate-900 text-slate-400 flex justify-between">
                          <span>{paramName}:</span>
                          <span className="text-white font-bold">{String(strat.parameters[paramName])}</span>
                        </div>
                      ))}
                    </div>

                    {strat.mutationRationale && (
                      <p className="text-[11px] text-slate-400 leading-relaxed pl-2 border-l-2 border-indigo-500/40 mt-1">
                        <strong className="text-slate-300">Rationale:</strong> {strat.mutationRationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RESEARCH QUEUE & HYPOTHESES */}
        {activeTab === 'QUEUE' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT: HYPOTHESIS GENERATION (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4">
                <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>AI-Assisted Hypothesis Generator</span>
                </span>

                <div className="space-y-3.5 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Seed Topic / Catalyst Pattern</label>
                    <input 
                      type="text"
                      placeholder="e.g., F&O short buildup relative strength"
                      value={seedTopic}
                      onChange={(e) => setSeedTopic(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-normal">
                    Fires a secure server-side call to Gemini to derive market hypotheses, expected information gain, relevance and statistical potential. Automatically enqueues the item.
                  </p>
                </div>

                <button
                  onClick={handleGenerateHypothesis}
                  disabled={generatingHypothesis || !seedTopic}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingHypothesis ? 'animate-spin' : ''}`} />
                  <span>Generate AI Hypothesis</span>
                </button>

                {generatedHypothesis && (
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs font-mono space-y-2 animate-in slide-in-from-bottom duration-200">
                    <span className="font-bold text-emerald-400 block uppercase text-[10px]">💡 NEW GENERATED HYPOTHESIS</span>
                    <span className="font-bold text-white block">{generatedHypothesis.title}</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {generatedHypothesis.description}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-[9px] text-slate-500 border-t border-slate-850 pt-2">
                      <div>Gain: <strong className="text-white">{generatedHypothesis.expectedInformationGain}</strong></div>
                      <div>Relevance: <strong className="text-white">{generatedHypothesis.marketRelevanceScore}</strong></div>
                      <div>Stat Pot: <strong className="text-white">{generatedHypothesis.statisticalPotential}</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: EXPERIMENTAL QUEUE (7 cols) */}
              <div className="lg:col-span-7 bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4">
                <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span>Autonomous Research Queue</span>
                </span>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {queue.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500 font-mono">
                      Research queue is currently empty.
                    </div>
                  ) : (
                    queue.map((item) => (
                      <div key={item.itemId} className="p-3 bg-slate-900/50 rounded border border-slate-850 text-xs font-mono space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{item.title}</span>
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[9px] uppercase font-bold">
                              {item.type}
                            </span>
                          </div>
                          
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                            item.status === 'RUNNING' ? 'bg-amber-950 text-amber-400 animate-pulse' :
                            'bg-slate-950 text-slate-400'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          {item.description}
                        </p>

                        <div className="grid grid-cols-3 gap-3 text-[10px] text-slate-500 pt-1">
                          <div>Expected Info Gain: <span className="text-indigo-300 font-bold">{item.expectedInformationGain}</span></div>
                          <div>Market Relevance: <span className="text-indigo-300 font-bold">{item.marketRelevanceScore}</span></div>
                          <div>Statistical Potential: <span className="text-indigo-300 font-bold">{item.statisticalPotential}</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: HISTORICAL ANALOGUE MEMORY */}
        {activeTab === 'MEMORY' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* LEFT: SELECTORS & SEARCH CONTROL */}
              <div className="lg:col-span-4 bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4 font-mono text-xs">
                <span className="text-xs uppercase font-bold text-slate-400 block border-b border-slate-850 pb-2">
                  Market Memory Retrieval Controls
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Event Type</label>
                    <select
                      value={memoryFilter.eventType}
                      onChange={(e) => setMemoryFilter({...memoryFilter, eventType: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white"
                    >
                      <option value="EARNINGS">EARNINGS</option>
                      <option value="ORDER_WIN">ORDER_WIN</option>
                      <option value="REGULATORY">REGULATORY</option>
                      <option value="BOARD_MEETING">BOARD_MEETING</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Sector</label>
                    <select
                      value={memoryFilter.sector}
                      onChange={(e) => setMemoryFilter({...memoryFilter, sector: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white"
                    >
                      <option value="IT">IT</option>
                      <option value="BANKING">BANKING</option>
                      <option value="AUTO">AUTO</option>
                      <option value="ENERGY">ENERGY</option>
                      <option value="PHARMA">PHARMA</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Market Regime</label>
                    <select
                      value={memoryFilter.regime}
                      onChange={(e) => setMemoryFilter({...memoryFilter, regime: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white"
                    >
                      <option value="TRENDING_BULL">TRENDING_BULL</option>
                      <option value="TRENDING_BEAR">TRENDING_BEAR</option>
                      <option value="RANGE_BOUND">RANGE_BOUND</option>
                      <option value="HIGH_VOLATILITY">HIGH_VOLATILITY</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleQueryMemory}
                  disabled={queryingMemory}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Harvest Historical Memory</span>
                </button>
              </div>

              {/* RIGHT: RESULTS & STATISTICAL PROBABILITY BANDS */}
              <div className="lg:col-span-8 space-y-4">
                
                {/* PROBABILITY BANDS */}
                {memoryAnalysis && (
                  <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850 font-mono text-xs space-y-3">
                    <span className="text-xs uppercase font-bold text-slate-400 block border-b border-slate-850 pb-1.5">
                      Empirical Outcomes & Mathematical Confidence Bands
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="p-3 bg-slate-900/50 rounded border border-slate-850 text-center">
                        <span className="text-slate-500 block text-[9px] uppercase">Empirical Win Rate</span>
                        <span className="text-emerald-400 font-bold text-base block mt-0.5">{(memoryAnalysis.empiricalWinRate * 100).toFixed(1)}%</span>
                      </div>

                      <div className="p-3 bg-slate-900/50 rounded border border-slate-850 text-center">
                        <span className="text-slate-500 block text-[9px] uppercase">Average Post-Event Return</span>
                        <span className={`font-bold text-base block mt-0.5 ${memoryAnalysis.averagePostEventReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {memoryAnalysis.averagePostEventReturnPct.toFixed(2)}%
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900/50 rounded border border-slate-850 text-center col-span-2 sm:col-span-1">
                        <span className="text-slate-500 block text-[9px] uppercase">Confidence Bounds (95% CI)</span>
                        <span className="text-indigo-300 font-bold text-sm block mt-0.5">
                          [{memoryAnalysis.confidenceBounds.lower.toFixed(1)}%, {memoryAnalysis.confidenceBounds.upper.toFixed(1)}%]
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* MATCHED ANALOGUES LIST */}
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850 font-mono text-xs space-y-3">
                  <span className="text-xs uppercase font-bold text-slate-400 block border-b border-slate-850 pb-1.5">
                    Verified Analogues Matches ({memoryMatches.length})
                  </span>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {memoryMatches.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        Adjust retrieval filters and search analogues.
                      </div>
                    ) : (
                      memoryMatches.map((match, mIdx) => (
                        <div key={mIdx} className="p-2.5 bg-slate-900/50 border border-slate-850 rounded flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                          <div>
                            <span className="text-white font-bold">{match.symbol}</span>
                            <span className="text-slate-500 mx-2">|</span>
                            <span className="text-slate-400">{match.date}</span>
                            <span className="text-slate-500 mx-2">|</span>
                            <span className="text-indigo-300">{match.eventType}</span>
                            <span className="text-slate-500 mx-2">|</span>
                            <span className="text-slate-400">{match.regime}</span>
                          </div>

                          <div className="text-right flex items-baseline gap-2 justify-end">
                            <span className="text-slate-500 text-[10px]">RETURN:</span>
                            <span className={`font-bold ${match.postEventReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {match.postEventReturnPct >= 0 ? '+' : ''}{match.postEventReturnPct.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 6: KNOWLEDGE GRAPH */}
        {activeTab === 'GRAPH' && (
          <div className="space-y-4">
            <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-850 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-indigo-400" />
                  <span>Interactive Algorithm Lineage & Provenance Graph</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {graphData.nodes.length} Nodes • {graphData.edges.length} Lineage Links
                </span>
              </div>

              {/* GRAPH VISUAL REPRESENTATION GRID */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[300px]">
                
                {/* NODE VIEW (4 cols) */}
                <div className="md:col-span-4 bg-slate-900/40 p-3 rounded border border-slate-850 space-y-3 font-mono text-xs">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold border-b border-slate-850 pb-1">
                    Strategy Family Nodes
                  </span>
                  
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {graphData.nodes.map((node) => (
                      <div key={node.id} className="p-2 bg-slate-950/60 rounded border border-slate-850 flex items-center justify-between">
                        <div>
                          <span className="text-white font-bold block">{node.label}</span>
                          <span className="text-[9px] text-slate-500 block uppercase mt-0.5">{node.type}</span>
                        </div>
                        {node.status && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            node.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' :
                            node.status === 'DEGRADED' ? 'bg-amber-950 text-amber-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {node.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* GRAPH FLOW / TREE VISUALIZER (8 cols) */}
                <div className="md:col-span-8 bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between">
                  <div className="text-[11px] font-mono text-slate-400 leading-normal mb-4 bg-slate-900/50 p-2.5 rounded border border-slate-850">
                    <strong className="text-slate-300">Deterministic Ancestry Tracking:</strong> The graph monitors parameter evolution across strategies, enqueuing hypotheses, and generating lineage trails to prevent overfitting on look-ahead configurations.
                  </div>

                  {/* Flow links rendering */}
                  <div className="space-y-3 font-mono text-xs max-h-[220px] overflow-y-auto pr-1">
                    {graphData.edges.map((edge, idx) => {
                      const fromNode = graphData.nodes.find(n => n.id === edge.from);
                      const toNode = graphData.nodes.find(n => n.id === edge.to);
                      return (
                        <div key={idx} className="p-2 bg-slate-900/40 rounded border border-slate-850 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-400 font-bold">{fromNode?.label || edge.from}</span>
                            <span className="text-slate-500">➔</span>
                            <span className="text-emerald-400 font-bold">{toNode?.label || edge.to}</span>
                          </div>

                          <span className="text-[9px] bg-slate-950 text-slate-500 border border-slate-850 rounded px-1.5 py-0.5 uppercase">
                            {edge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
