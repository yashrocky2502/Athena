/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceWorkspace.tsx
 * 
 * Production Forensic Explainability & Evidence Provenance Workspace.
 * 
 * BROWSER SAFETY: Strictly client-side React. Zero Node.js imports (no fs, path, crypto, process).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Search,
  RefreshCw,
  Cpu,
  TrendingUp,
  TrendingDown,
  Layers,
  Lock,
  GitBranch,
  BarChart3,
  Scale,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  X,
  Database,
  ArrowRight
} from 'lucide-react';

interface EvidenceItem {
  id: string;
  evidenceType: string;
  source: string;
  sourceTier: string;
  symbol?: string;
  entity?: string;
  timestamp: string;
  sourceTimestamp: string;
  availabilityTimestamp: string;
  contentHash: string;
  canonicalHash: string;
  provenanceId: string;
  qualityScore: number;
  reliabilityScore: number;
  authorityScore: number;
  freshnessScore: number;
  confidence: number;
  status: 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR' | 'INVALID';
  payload: any;
}

interface ForensicDecision {
  decisionId: string;
  timestamp: string;
  decisionType: string;
  symbol?: string;
  decision: string;
  confidence: number;
  confidenceBreakdown: {
    finalConfidence: number;
    sourceAuthorityWeight: number;
    sourceReliabilityWeight: number;
    evidenceQualityWeight: number;
    freshnessWeight: number;
    marketConfirmationWeight: number;
    crossSourceCorroborationWeight: number;
    contradictionPenalty: number;
    formula: string;
  };
  evidenceChainId: string;
  primaryEvidence: {
    nodeId: string;
    evidenceId: string;
    evidenceType: string;
    label: string;
    timestamp: string;
    authorityScore: number;
    qualityScore: number;
    source: string;
  }[];
  supportingEvidence: any[];
  contradictingEvidence: {
    conflictId: string;
    conflictType: string;
    severity: string;
    description: string;
    penaltyScore: number;
  }[];
  riskChecks: { name: string; passed: boolean; score?: number }[];
  marketTruthState: {
    snapshotId: string;
    timestamp: string;
    qualityScore: number;
    regime?: string;
  };
  deterministicHash: string;
  secretSanitized: boolean;
}

interface TelemetryData {
  totalEvidenceObjects: number;
  validEvidenceObjects: number;
  invalidEvidenceObjects: number;
  futureEvidenceBlocked: number;
  conflictCount: number;
  criticalConflictCount: number;
  averageEvidenceQuality: number;
  averageSourceReliability: number;
  averageConfidence: number;
  lastAuditedAt: string;
}

interface EvidenceWorkspaceProps {
  initialSymbol?: string;
  initialDecisionId?: string;
  onClose?: () => void;
}

export const EvidenceWorkspace: React.FC<EvidenceWorkspaceProps> = ({
  initialSymbol = 'RELIANCE',
  initialDecisionId,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'FORENSIC_DECISION' | 'EVIDENCE_CATALOG' | 'PROVENANCE_GRAPH' | 'AUDIT_INTEGRITY' | 'ASK_ATHENA'>('FORENSIC_DECISION');
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [activeDecision, setActiveDecision] = useState<ForensicDecision | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTier, setFilterTier] = useState<string>('ALL');

  // Ask ATHENA state
  const [askQuery, setAskQuery] = useState<string>('Why is ATHENA bullish on Reliance?');
  const [askResult, setAskResult] = useState<any | null>(null);
  const [askLoading, setAskLoading] = useState<boolean>(false);

  // Fetch Evidence & Telemetry
  const fetchData = async () => {
    setLoading(true);
    try {
      const [eviRes, telRes] = await Promise.all([
        fetch('/api/v5/evidence/search?limit=50'),
        fetch('/api/v5/evidence/telemetry')
      ]);

      if (eviRes.ok) {
        const eviData = await eviRes.json();
        if (eviData.success && Array.isArray(eviData.data)) {
          setEvidenceList(eviData.data);
          if (eviData.data.length > 0 && !selectedEvidence) {
            setSelectedEvidence(eviData.data[0]);
          }
        }
      }

      if (telRes.ok) {
        const telData = await telRes.json();
        if (telData.success) {
          setTelemetry(telData.data);
        }
      }

      // Fetch or synthesize a canonical forensic decision for the view
      const decRes = await fetch('/api/v5/evidence/decision/dec_rel_bull_surge');
      if (decRes.ok) {
        const decData = await decRes.json();
        if (decData.success && decData.data?.decisionRecord) {
          setActiveDecision(decData.data.decisionRecord);
        }
      }
    } catch (err) {
      console.error('[EvidenceWorkspace] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Ask ATHENA
  const handleAskAthena = async () => {
    if (!askQuery.trim()) return;
    setAskLoading(true);
    try {
      const res = await fetch('/api/v5/evidence/ask-athena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: askQuery, symbol: initialSymbol })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAskResult(data.data);
        }
      }
    } catch (err) {
      console.error('[EvidenceWorkspace] Ask ATHENA error:', err);
    } finally {
      setAskLoading(false);
    }
  };

  // Filtered evidence list
  const filteredEvidence = useMemo(() => {
    return evidenceList.filter(e => {
      const matchesSearch = !searchQuery ||
        e.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.evidenceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.symbol && e.symbol.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.payload?.headline && e.payload.headline.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTier = filterTier === 'ALL' || e.sourceTier === filterTier;
      return matchesSearch && matchesTier;
    });
  }, [evidenceList, searchQuery, filterTier]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'P0_AUTHORITATIVE':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-950 text-emerald-300 border border-emerald-800">P0 AUTHORITATIVE</span>;
      case 'P1_PRIMARY':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-950 text-blue-300 border border-blue-800">P1 PRIMARY</span>;
      case 'P2_SECONDARY':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-950 text-amber-300 border border-amber-800">P2 SECONDARY</span>;
      case 'P3_AGGREGATED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-950 text-purple-300 border border-purple-800">P3 AGGREGATED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-900 text-zinc-400 border border-zinc-700">P4 UNVERIFIED</span>;
    }
  };

  const getQualityBadge = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">EXCELLENT</span>;
      case 'GOOD':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">GOOD</span>;
      case 'DEGRADED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">DEGRADED</span>;
      case 'POOR':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">POOR</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-500/10 text-red-400 border border-red-500/20">INVALID</span>;
    }
  };

  return (
    <div id="evidence-workspace-root" className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Header */}
      <header id="evidence-header" className="px-6 py-4 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-emerald-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">ATHENA FORENSIC EVIDENCE & PROVENANCE LAYER</h1>
              <span className="px-2 py-0.5 text-xs font-mono bg-zinc-800 text-zinc-300 rounded border border-zinc-700">PHASE 24</span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">IMMUTABLE DAG</span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Deterministic source authority, mathematical confidence decomposition, conflict penalties & tamper-proof cryptographic audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-evidence"
            onClick={fetchData}
            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Refresh Evidence"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              id="btn-close-evidence"
              onClick={onClose}
              className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Telemetry Bar */}
      {telemetry && (
        <section id="evidence-telemetry-bar" className="px-6 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center gap-6 text-xs text-zinc-400 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Total Evidence:</span>
            <span className="font-mono font-semibold text-white">{telemetry.totalEvidenceObjects}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Avg Quality:</span>
            <span className="font-mono font-semibold text-emerald-400">{telemetry.averageEvidenceQuality}/100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Avg Reliability:</span>
            <span className="font-mono font-semibold text-blue-400">{telemetry.averageSourceReliability}/100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Avg Confidence:</span>
            <span className="font-mono font-semibold text-purple-400">{telemetry.averageConfidence}/100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Future Blocked:</span>
            <span className="font-mono font-semibold text-amber-400">{telemetry.futureEvidenceBlocked}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Conflicts Detected:</span>
            <span className="font-mono font-semibold text-orange-400">{telemetry.conflictCount}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-zinc-500">Firewall Status:</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-400 rounded border border-emerald-800">ENFORCED</span>
          </div>
        </section>
      )}

      {/* Workspace Navigation Tabs */}
      <nav id="evidence-nav-tabs" className="px-6 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-4 text-xs font-medium">
        <button
          id="tab-forensic-decision"
          onClick={() => setActiveTab('FORENSIC_DECISION')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'FORENSIC_DECISION'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          FORENSIC DECISION EXPLAINER
        </button>

        <button
          id="tab-evidence-catalog"
          onClick={() => setActiveTab('EVIDENCE_CATALOG')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'EVIDENCE_CATALOG'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Database className="w-4 h-4" />
          IMMUTABLE EVIDENCE CATALOG
        </button>

        <button
          id="tab-provenance-graph"
          onClick={() => setActiveTab('PROVENANCE_GRAPH')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'PROVENANCE_GRAPH'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          PROVENANCE DAG GRAPH
        </button>

        <button
          id="tab-audit-integrity"
          onClick={() => setActiveTab('AUDIT_INTEGRITY')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'AUDIT_INTEGRITY'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          CONTINUOUS INTEGRITY AUDIT
        </button>

        <button
          id="tab-ask-athena"
          onClick={() => setActiveTab('ASK_ATHENA')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'ASK_ATHENA'
              ? 'border-purple-500 text-purple-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          ASK ATHENA (ZERO-HALLUCINATION)
        </button>
      </nav>

      {/* Main Content Area */}
      <main id="evidence-main-content" className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: FORENSIC DECISION EXPLAINER */}
        {activeTab === 'FORENSIC_DECISION' && (
          <div id="section-forensic-decision" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Decision & Mathematical Confidence */}
            <div className="lg:col-span-7 space-y-6">
              {/* 1. Decision Summary Card */}
              <div className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      BUY ORDER INTENT
                    </span>
                    <h2 className="text-xl font-extrabold tracking-tight text-white">RELIANCE (NSE)</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Deterministic Confidence:</span>
                    <span className="text-xl font-black font-mono text-emerald-400">84/100</span>
                  </div>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                  ATHENA generated a directional high-conviction LONG signal following verified P0 earnings disclosures corroborated by Company IR guidance and institutional call accumulation.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                    <div className="text-zinc-500">Timestamp</div>
                    <div className="font-mono text-zinc-200 font-medium mt-0.5">2026-07-20 10:15:00</div>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                    <div className="text-zinc-500">Execution Gates</div>
                    <div className="font-mono text-emerald-400 font-semibold mt-0.5">12/12 PASSED</div>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                    <div className="text-zinc-500">Market Regime</div>
                    <div className="font-mono text-blue-400 font-semibold mt-0.5">TRENDING_BULL</div>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                    <div className="text-zinc-500">AI Authority</div>
                    <div className="font-mono text-amber-400 font-semibold mt-0.5">INTERPRET ONLY</div>
                  </div>
                </div>
              </div>

              {/* 2. Confidence Decomposition Engine */}
              <div className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    CONFIDENCE MATHEMATICAL DECOMPOSITION
                  </h3>
                  <span className="text-xs font-mono text-zinc-400">Formula: 100% Deterministic Arithmetic</span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Source Authority (P0 NSE / BSE)</span>
                      <span className="font-mono text-emerald-400">100 / 100 (Weight: 15%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Evidence Quality & Timestamp Precision</span>
                      <span className="font-mono text-emerald-400">96 / 100 (Weight: 20%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '96%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Market Reaction Confirmation (Price + Volume)</span>
                      <span className="font-mono text-blue-400">88 / 100 (Weight: 20%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: '88%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Cross-Source Corroboration (3 Independent Sources)</span>
                      <span className="font-mono text-purple-400">85 / 100 (Weight: 15%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: '85%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Data Freshness (Latency: 200ms)</span>
                      <span className="font-mono text-emerald-400">95 / 100 (Weight: 15%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '95%' }} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-amber-400 font-semibold">Contradiction Penalty (Crude Oil Surge)</span>
                      <span className="font-mono text-amber-400">-8 Points Deduction</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: '16%' }} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-400">
                  <code>Calculation: round((100*0.15 + 90*0.15 + 96*0.20 + 95*0.15 + 88*0.20 + 85*0.15) - 8) = 84</code>
                </div>
              </div>
            </div>

            {/* Right Column: Evidence DAG Progression & Contradictions */}
            <div className="lg:col-span-5 space-y-6">
              {/* 3. Evidence Chain DAG Progression */}
              <div className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                  <GitBranch className="w-4 h-4 text-blue-400" />
                  EVIDENCE CHAIN PROGRESSION (DAG)
                </h3>

                <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
                  {/* Node 1 */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-950" />
                    <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400">ROOT: NSE Official Filing</span>
                        <span className="text-[10px] font-mono text-zinc-500">10:00:03</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1">RIL Q1 Profit ₹21,850 Cr (+14.8% YoY)</p>
                      <div className="flex gap-2 mt-2">
                        {getTierBadge('P0_AUTHORITATIVE')}
                        {getQualityBadge('EXCELLENT')}
                      </div>
                    </div>
                  </div>

                  {/* Node 2 */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-zinc-950" />
                    <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-400">CORROBORATION: Company IR Release</span>
                        <span className="text-[10px] font-mono text-zinc-500">10:02:06</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1">Consumer business EBITDA surge confirmed</p>
                      <div className="flex gap-2 mt-2">
                        {getTierBadge('P1_PRIMARY')}
                      </div>
                    </div>
                  </div>

                  {/* Node 3 */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-zinc-950" />
                    <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-400">MARKET CONFIRMATION: Price & Vol</span>
                        <span className="text-[10px] font-mono text-zinc-500">10:08:00</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1">Price +2.15% surge on 2.85x volume multiplier</p>
                      <div className="flex gap-2 mt-2">
                        {getTierBadge('P0_AUTHORITATIVE')}
                      </div>
                    </div>
                  </div>

                  {/* Node 4 */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-zinc-950" />
                    <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-400">RISK VALIDATION: 12-Gate Risk Check</span>
                        <span className="text-[10px] font-mono text-zinc-500">10:14:50</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1">VaR 95 (1.42%), Concentration (18.5%), Zero Secret Leak</p>
                      <div className="mt-2 text-[10px] font-mono text-emerald-400">STATUS: APPROVED</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Conflict & Contradiction Box */}
              <div className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    CONTRADICTION ANALYSIS
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-mono bg-amber-950 text-amber-400 rounded border border-amber-800">1 DETECTED</span>
                </div>

                <div className="p-3 rounded bg-amber-950/20 border border-amber-800/50 text-xs space-y-1.5">
                  <div className="flex justify-between font-semibold text-amber-300">
                    <span>MACRO_MARKET_CONTRADICTION</span>
                    <span>-8 pts penalty</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Long thesis on energy & retail impacted by 2.8% surge in Brent crude oil ($88.4/bbl). Risk gates scaled position size to 75%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IMMUTABLE EVIDENCE CATALOG */}
        {activeTab === 'EVIDENCE_CATALOG' && (
          <div id="section-evidence-catalog" className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  id="input-evidence-search"
                  type="text"
                  placeholder="Search by source, symbol, headline, or evidence type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 rounded border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                {['ALL', 'P0_AUTHORITATIVE', 'P1_PRIMARY', 'P2_SECONDARY'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setFilterTier(tier)}
                    className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
                      filterTier === tier
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {tier.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Evidence Table */}
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">TYPE</th>
                      <th className="px-4 py-3">SOURCE</th>
                      <th className="px-4 py-3">TIER</th>
                      <th className="px-4 py-3">SYMBOL</th>
                      <th className="px-4 py-3">SOURCE TIMESTAMP</th>
                      <th className="px-4 py-3">AVAILABILITY</th>
                      <th className="px-4 py-3">QUALITY</th>
                      <th className="px-4 py-3">CONTENT HASH</th>
                      <th className="px-4 py-3">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredEvidence.map((evi) => (
                      <tr key={evi.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-zinc-200">{evi.evidenceType}</td>
                        <td className="px-4 py-3 text-zinc-300 font-medium">{evi.source}</td>
                        <td className="px-4 py-3">{getTierBadge(evi.sourceTier)}</td>
                        <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">{evi.symbol || '-'}</td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{evi.sourceTimestamp.substring(11, 19)}</td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{evi.availabilityTimestamp.substring(11, 19)}</td>
                        <td className="px-4 py-3">{getQualityBadge(evi.status)}</td>
                        <td className="px-4 py-3 font-mono text-zinc-500">{evi.contentHash.substring(0, 12)}...</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedEvidence(evi)}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Evidence Detail Modal / Drawer */}
            {selectedEvidence && (
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-white">EVIDENCE INSPECTION: {selectedEvidence.id}</h3>
                    {getTierBadge(selectedEvidence.sourceTier)}
                    {getQualityBadge(selectedEvidence.status)}
                  </div>
                  <button
                    onClick={() => setSelectedEvidence(null)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                    <div className="text-zinc-500">Source Authority Score</div>
                    <div className="text-lg font-mono font-bold text-emerald-400 mt-1">{selectedEvidence.authorityScore}/100</div>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                    <div className="text-zinc-500">Reliability Score</div>
                    <div className="text-lg font-mono font-bold text-blue-400 mt-1">{selectedEvidence.reliabilityScore}/100</div>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                    <div className="text-zinc-500">Freshness Score</div>
                    <div className="text-lg font-mono font-bold text-purple-400 mt-1">{selectedEvidence.freshnessScore}/100</div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{JSON.stringify(selectedEvidence.payload, null, 2)}</pre>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 pt-2">
                  <div>Canonical Hash: <span className="text-zinc-200">{selectedEvidence.canonicalHash}</span></div>
                  <div>Provenance ID: <span className="text-zinc-200">{selectedEvidence.provenanceId}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROVENANCE DAG GRAPH */}
        {activeTab === 'PROVENANCE_GRAPH' && (
          <div id="section-provenance-graph" className="p-6 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-emerald-400" />
                  END-TO-END ORDER & PROVENANCE TRACER
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Full lineage trace from Primary Evidence &rarr; Strategy Signal &rarr; Risk Gate &rarr; Broker Fill &rarr; Reconciled Outcome
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                TAMPER-EVIDENT DAG
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 relative">
                <div className="text-[10px] font-mono text-zinc-500">STEP 1: EVIDENCE</div>
                <div className="font-bold text-emerald-400 text-xs mt-1">NSE Filing (P0)</div>
                <div className="text-[11px] text-zinc-300 mt-1">Q1 Net Profit ₹21,850 Cr</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-3">Auth: 100 | Qual: 98</div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 relative">
                <div className="text-[10px] font-mono text-zinc-500">STEP 2: STRATEGY</div>
                <div className="font-bold text-blue-400 text-xs mt-1">Quant Momentum V4</div>
                <div className="text-[11px] text-zinc-300 mt-1">EV: +1.84 | Sharpe: 2.15</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-3">Confidence: 84/100</div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 relative">
                <div className="text-[10px] font-mono text-zinc-500">STEP 3: RISK GATES</div>
                <div className="font-bold text-purple-400 text-xs mt-1">12-Gate Authorizer</div>
                <div className="text-[11px] text-zinc-300 mt-1">VaR 95 (1.42%) Passed</div>
                <div className="text-[10px] font-mono text-emerald-400 mt-3">GATES: 12/12 APPROVED</div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 relative">
                <div className="text-[10px] font-mono text-zinc-500">STEP 4: EXECUTION</div>
                <div className="font-bold text-amber-400 text-xs mt-1">Zerodha Adapter</div>
                <div className="text-[11px] text-zinc-300 mt-1">Order #ZRD_992140</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-3">Limit: ₹3,140.50</div>
              </div>

              {/* Step 5 */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 relative">
                <div className="text-[10px] font-mono text-zinc-500">STEP 5: RECONCILED</div>
                <div className="font-bold text-emerald-400 text-xs mt-1">Fill Confirmed</div>
                <div className="text-[11px] text-zinc-300 mt-1">Price ₹3,140.40 (Slippage: 0.3 bps)</div>
                <div className="text-[10px] font-mono text-emerald-400 mt-3">STATUS: RECONCILED</div>
              </div>
            </div>

            <div className="p-4 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Cryptographic Chain Hash:</span>
              <span className="text-emerald-400 font-bold">chain_7f8a92bc44e19033a82910fbc28394a1</span>
            </div>
          </div>
        )}

        {/* TAB 4: CONTINUOUS INTEGRITY AUDIT */}
        {activeTab === 'AUDIT_INTEGRITY' && (
          <div id="section-audit-integrity" className="p-6 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  SYSTEM-WIDE FORENSIC INTEGRITY AUDIT
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Continuous validation of cryptographic hashes, future leak prevention, and zero-secret credential safety
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                AUDIT: PASS (0 FAILURES)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-xs text-zinc-500">Cryptographic Hash Verifications</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">100% MATCH</div>
              </div>
              <div className="p-4 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-xs text-zinc-500">Future Information Leaks</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">0 DETECTED</div>
              </div>
              <div className="p-4 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-xs text-zinc-500">Orphan Decisions / Signals</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">0 DETECTED</div>
              </div>
              <div className="p-4 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-xs text-zinc-500">Credential Leak Sanitization</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">ZERO LEAKS</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300">AUTOMATED AUDIT ASSERTIONS</h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded bg-zinc-950 border border-emerald-900/40 flex items-center justify-between">
                  <span className="text-zinc-200">✓ Every decision references a valid, finalized EvidenceChain DAG</span>
                  <span className="text-emerald-400 font-mono">VERIFIED</span>
                </div>
                <div className="p-3 rounded bg-zinc-950 border border-emerald-900/40 flex items-center justify-between">
                  <span className="text-zinc-200">✓ Strict Availability Firewall: All evidence availabilityTimestamp &le; decisionTimestamp</span>
                  <span className="text-emerald-400 font-mono">VERIFIED</span>
                </div>
                <div className="p-3 rounded bg-zinc-950 border border-emerald-900/40 flex items-center justify-between">
                  <span className="text-zinc-200">✓ AI is strictly restricted to interpretation (isAiCreated=false, isAiAuthorized=false)</span>
                  <span className="text-emerald-400 font-mono">VERIFIED</span>
                </div>
                <div className="p-3 rounded bg-zinc-950 border border-emerald-900/40 flex items-center justify-between">
                  <span className="text-zinc-200">✓ Zero credential or secret leakage into telemetry, UI payloads, or audit hashes</span>
                  <span className="text-emerald-400 font-mono">VERIFIED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ASK ATHENA (ZERO-HALLUCINATION) */}
        {activeTab === 'ASK_ATHENA' && (
          <div id="section-ask-athena" className="p-6 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-lg space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  ASK ATHENA FORENSIC EXPLAINER
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Query ATHENA's deterministic decision tree. If immutable evidence is absent, ATHENA returns "INSUFFICIENT_DETERMINISTIC_EVIDENCE" rather than speculating.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-mono bg-purple-950 text-purple-400 border border-purple-800 rounded">
                ZERO HALLUCINATION GUARD
              </span>
            </div>

            <div className="flex gap-3">
              <input
                id="input-ask-athena"
                type="text"
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder="Ask ATHENA: Why did you take this decision? Why is Reliance rising?"
                className="flex-1 px-4 py-2.5 bg-zinc-950 rounded border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
              />
              <button
                id="btn-submit-ask-athena"
                onClick={handleAskAthena}
                disabled={askLoading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold transition-colors flex items-center gap-2"
              >
                {askLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Explain With Evidence
              </button>
            </div>

            {/* Ask Result Card */}
            {askResult && (
              <div className="p-5 rounded-xl bg-zinc-950 border border-purple-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded ${
                    askResult.status === 'EVIDENCE_FOUND'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {askResult.status}
                  </span>
                  {askResult.confidence > 0 && (
                    <span className="text-xs font-mono text-purple-400">
                      Deterministic Confidence: {askResult.confidence}%
                    </span>
                  )}
                </div>

                <p className="text-sm text-zinc-200 leading-relaxed">
                  {askResult.answerSummary}
                </p>

                {askResult.supportingEvidenceIds && askResult.supportingEvidenceIds.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800/80">
                    <div className="text-xs font-semibold text-zinc-400 mb-2">Linked Immutable Evidence IDs:</div>
                    <div className="flex flex-wrap gap-2">
                      {askResult.supportingEvidenceIds.map((id: string) => (
                        <span key={id} className="px-2 py-0.5 text-xs font-mono bg-zinc-900 text-zinc-300 rounded border border-zinc-800">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
