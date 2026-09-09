import React, { useState } from 'react';
import {
  CanonicalOpportunity,
  ConfirmationDimension
} from '../../news/opportunity/types';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  Activity,
  History,
  Scale,
  Send,
  Link,
  ChevronRight,
  Info,
  Check
} from 'lucide-react';
import { TelegramOpportunityAlertEngine } from '../../news/opportunity/TelegramOpportunityAlertEngine';

interface OpportunityForensicPanelProps {
  opportunity: CanonicalOpportunity;
  onClose?: () => void;
  onSelectSymbol?: (symbol: string) => void;
}

export const OpportunityForensicPanel: React.FC<OpportunityForensicPanelProps> = ({
  opportunity: opp,
  onClose,
  onSelectSymbol
}) => {
  const [activeTab, setActiveTab] = useState<'FORENSIC' | 'CONFIRMATION' | 'MATHEMATICS' | 'CAUSAL_CHAIN' | 'GATES' | 'INVALIDATION'>('FORENSIC');
  const [copiedTelegram, setCopiedTelegram] = useState(false);

  const isLong = opp.direction === 'LONG';
  const isShort = opp.direction === 'SHORT';

  const handleCopyTelegram = () => {
    const alert = TelegramOpportunityAlertEngine.getInstance().generateAlertPayload(opp);
    navigator.clipboard.writeText(alert.messageText);
    setCopiedTelegram(true);
    setTimeout(() => setCopiedTelegram(false), 2500);
  };

  return (
    <div id="opportunity-forensic-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-start gap-4">
          <div className={`p-3.5 rounded-xl border flex items-center justify-center ${
            isLong ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            isShort ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
            'bg-slate-800 border-slate-700 text-slate-300'
          }`}>
            {isLong ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold font-mono tracking-tight text-white">{opp.instrument}</h2>
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded-md border uppercase ${
                isLong ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                isShort ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {opp.direction} • {opp.opportunityType}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-indigo-400 border border-slate-700">
                {opp.priorityTier}
              </span>
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${
                opp.actionRecommendation === 'TRADE' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50' :
                opp.actionRecommendation === 'WATCH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                ACTION: {opp.actionRecommendation}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">{opp.thesis}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-center">
          <button
            id="btn-copy-telegram-alert"
            onClick={handleCopyTelegram}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            {copiedTelegram ? <Check className="h-4 w-4 text-emerald-400" /> : <Send className="h-4 w-4 text-sky-400" />}
            <span>{copiedTelegram ? 'Telegram Payload Copied' : 'Telegram Alert'}</span>
          </button>
          {onSelectSymbol && (
            <button
              onClick={() => onSelectSymbol(opp.instrument)}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 transition-colors cursor-pointer"
            >
              Analyze Symbol
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Metric Quick Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Confidence Score</span>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-0.5">{opp.confidenceScore}<span className="text-xs text-slate-500">/100</span></div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Expected Value</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">+{opp.expectedValue}%</div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Risk / Reward</span>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">1 : {opp.riskReward}</div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Evidence Quality</span>
          <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">{opp.evidenceQualityScore}<span className="text-xs text-slate-500">/100</span></div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Multi-Confirm</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{opp.confirmationScore}<span className="text-xs text-slate-500">/100</span></div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">12-Gate Execution</span>
          <div className={`text-sm font-bold font-mono mt-1 ${opp.executionEligibility.isEligible ? 'text-emerald-400' : 'text-amber-400'}`}>
            {opp.executionEligibility.status} ({opp.executionEligibility.passedGatesCount}/12)
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'FORENSIC', label: 'Executive Forensic', icon: Activity },
          { id: 'CONFIRMATION', label: '10D Confirmation', icon: Layers },
          { id: 'MATHEMATICS', label: 'Math Formula', icon: Scale },
          { id: 'CAUSAL_CHAIN', label: '12-Stage Causal Chain', icon: Link },
          { id: 'GATES', label: '12 Pre-Trade Gates', icon: Shield },
          { id: 'INVALIDATION', label: 'Invalidation Rules', icon: AlertTriangle }
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'FORENSIC' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Catalyst & Historical Analogue */}
          <div className="space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Info className="h-4 w-4" /> Catalyst & Market Grounding
              </h3>
              <p className="text-sm text-slate-200">{opp.catalyst}</p>
              <div className="pt-2 text-xs text-slate-400 flex flex-wrap gap-4 border-t border-slate-800/60">
                <span>Provenance Root: <code className="text-slate-300">{opp.provenanceRootId}</code></span>
                <span>Evidence Count: <b className="text-slate-200">{opp.evidenceIds.length} verified docs</b></span>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <History className="h-4 w-4" /> Phase 23 Historical Analogues
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Matched Events</div>
                  <div className="text-base font-bold font-mono text-slate-100">{opp.historicalAnalogueBreakdown.analogueCount} occurrences</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Historical Win Rate</div>
                  <div className="text-base font-bold font-mono text-emerald-400">{(opp.historicalAnalogueBreakdown.historicalWinRate * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Avg Return</div>
                  <div className="text-base font-bold font-mono text-slate-100">+{opp.historicalAnalogueBreakdown.historicalAvgReturnPct}%</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Max Adverse (MAE)</div>
                  <div className="text-base font-bold font-mono text-rose-400">{opp.historicalAnalogueBreakdown.maxAdverseExcursionPct}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Regime & Quantitative Expectancy */}
          <div className="space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Regime Compatibility & Probability
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Market Regime:</span>
                  <span className="font-mono font-bold text-slate-200">{opp.regimeCompatibilityBreakdown.currentRegime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Strategy Compatibility:</span>
                  <span className="font-mono font-bold text-emerald-400">{opp.regimeCompatibilityBreakdown.compatibilityScore}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Success Probability (P_win):</span>
                  <span className="font-mono font-bold text-indigo-400">{(opp.expectedValueBreakdown.probabilityOfSuccess * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Friction & Slippage Est:</span>
                  <span className="font-mono font-bold text-slate-300">{opp.expectedValueBreakdown.estimatedSlippageBps} bps slippage + {opp.expectedValueBreakdown.transactionCostsBps} bps STT</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60">
                {opp.regimeCompatibilityBreakdown.regimeNotes}
              </p>
            </div>

            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Shield className="h-4 w-4" /> Portfolio Compatibility Review
              </h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Portfolio Status:</span>
                <span className={`font-mono font-bold ${opp.portfolioReview?.status === 'PORTFOLIO_COMPATIBLE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {opp.portfolioReview?.status || 'PORTFOLIO_COMPATIBLE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Symbol Concentration Post-Trade:</span>
                <span className="font-mono text-slate-200">{opp.portfolioReview?.symbolConcentrationPct}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 10D Confirmation */}
      {activeTab === 'CONFIRMATION' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase">Overall Confirmation Status</span>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{opp.confirmationBreakdown.overallStatus}</div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400 uppercase">Confirming vs Contradicting</span>
              <div className="text-sm font-mono mt-0.5">
                <span className="text-emerald-400 font-bold">{opp.confirmationBreakdown.confirmingDimensionCount} Confirming</span> •{' '}
                <span className="text-rose-400 font-bold">{opp.confirmationBreakdown.contradictingDimensionCount} Contradicting</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Object.keys(opp.confirmationBreakdown.dimensionResults) as ConfirmationDimension[]).map(dim => {
              const res = opp.confirmationBreakdown.dimensionResults[dim];
              const isConfirmed = res.status === 'CONFIRMED' || res.status === 'STRONGLY_CONFIRMED';
              const isContradicted = res.status === 'CONTRADICTED' || res.status === 'CRITICALLY_CONTRADICTED';
              return (
                <div key={dim} className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-200">{dim}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded ${
                      isConfirmed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      isContradicted ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {res.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    <div>{res.metricLabel}: <b className="text-slate-200">{String(res.metricValue)}</b></div>
                    <div className="text-[11px] text-slate-500">Threshold: {String(res.threshold)} • Source: {res.sourceId}</div>
                  </div>
                  {res.details && (
                    <p className="text-[11px] text-rose-400/90 pt-1 border-t border-slate-800/80">{res.details}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Mathematics Formula */}
      {activeTab === 'MATHEMATICS' && (
        <div className="space-y-4">
          <div className="bg-slate-950/80 border border-indigo-500/30 p-4 rounded-xl space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">Deterministic Mathematical Formula</h3>
            <pre className="text-xs font-mono bg-slate-900 p-3 rounded-lg text-indigo-300 overflow-x-auto whitespace-pre-wrap border border-slate-800">
              {opp.mathematicalDecomposition.equationFormula}
            </pre>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Evidence Component</span>
              <div className="text-base font-bold font-mono text-slate-100">+{opp.mathematicalDecomposition.evidenceScoreComponent} pts</div>
              <span className="text-[11px] text-slate-500">Weight: {opp.mathematicalDecomposition.weights.evidenceWeight * 100}%</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Confirmation Component</span>
              <div className="text-base font-bold font-mono text-slate-100">+{opp.mathematicalDecomposition.confirmationScoreComponent} pts</div>
              <span className="text-[11px] text-slate-500">Weight: {opp.mathematicalDecomposition.weights.confirmationWeight * 100}%</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Historical Analogue Support</span>
              <div className="text-base font-bold font-mono text-slate-100">+{opp.mathematicalDecomposition.historicalSupportComponent} pts</div>
              <span className="text-[11px] text-slate-500">Weight: {opp.mathematicalDecomposition.weights.historicalWeight * 100}%</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Regime Compatibility</span>
              <div className="text-base font-bold font-mono text-slate-100">+{opp.mathematicalDecomposition.regimeCompatibilityComponent} pts</div>
              <span className="text-[11px] text-slate-500">Weight: {opp.mathematicalDecomposition.weights.regimeWeight * 100}%</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Expected Value Factor</span>
              <div className="text-base font-bold font-mono text-slate-100">+{opp.mathematicalDecomposition.expectedValueComponent} pts</div>
              <span className="text-[11px] text-slate-500">Weight: {opp.mathematicalDecomposition.weights.expectedValueWeight * 100}%</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Contradiction & Risk Penalties</span>
              <div className="text-base font-bold font-mono text-rose-400">-{opp.mathematicalDecomposition.contradictionPenalty + opp.mathematicalDecomposition.riskPenalty} pts</div>
              <span className="text-[11px] text-slate-500">Contradiction: {opp.mathematicalDecomposition.contradictionPenalty} | Risk: {opp.mathematicalDecomposition.riskPenalty}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 12-Stage Causal Chain */}
      {activeTab === 'CAUSAL_CHAIN' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 mb-2">
            12-Stage End-to-End Causal Provenance Trace from Institutional Ingestion to Reconciled Outcome:
          </div>
          <div className="space-y-2">
            {opp.causalChain.map((node, index) => (
              <div key={node.nodeId} className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-indigo-400 rounded">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-slate-200">{node.stage}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      node.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {node.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{node.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: 12 Pre-Trade Gates */}
      {activeTab === 'GATES' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase">Phase 20 Control Plane Authorizer</span>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{opp.executionEligibility.status}</div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400 uppercase">Pre-Trade Gate Consensus</span>
              <div className="text-sm font-mono text-emerald-400 font-bold mt-0.5">
                {opp.executionEligibility.passedGatesCount} / {opp.executionEligibility.totalGatesCount} Gates Passed
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {[
              { name: 'Gate 1: Market Truth Circuit Breaker', passed: !opp.executionEligibility.circuitBreakerBlocked },
              { name: 'Gate 2: Execution Kill Switch Disarmed', passed: !opp.executionEligibility.killSwitchBlocked },
              { name: 'Gate 3: Evidence Quality >= 60', passed: opp.evidenceQualityScore >= 60 },
              { name: 'Gate 4: Evidence Freshness SLA >= 40', passed: opp.evidenceFreshnessScore >= 40 },
              { name: 'Gate 5: Contradiction Firewall Clear', passed: opp.contradictionScore <= 50 },
              { name: 'Gate 6: Multi-Source Confirmation (>= 2 Dims)', passed: opp.confirmationBreakdown.confirmingDimensionCount >= 2 },
              { name: 'Gate 7: Deterministic EV > 0', passed: opp.expectedValue > 0 },
              { name: 'Gate 8: Invalidation Triggers Untripped', passed: !opp.invalidationConditions.some(c => c.isTriggered) },
              { name: 'Gate 9: Portfolio Concentration & Margin Passed', passed: opp.portfolioReview?.status !== 'PORTFOLIO_BLOCKED' },
              { name: 'Gate 10: Confidence Threshold >= 65', passed: opp.confidenceScore >= 65 },
              { name: 'Gate 11: Regime Compatibility >= 50', passed: opp.regimeCompatibilityScore >= 50 },
              { name: 'Gate 12: Liquidity Score >= 50', passed: opp.liquidityScore >= 50 }
            ].map((gate, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${
                gate.passed ? 'bg-slate-950/60 border-slate-800/80 text-slate-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <span>{gate.name}</span>
                {gate.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Invalidation Rules */}
      {activeTab === 'INVALIDATION' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 mb-2">
            Deterministic conditions that immediately invalidate the opportunity and trigger WATCH/AVOID state:
          </div>
          <div className="space-y-2">
            {opp.invalidationConditions.map(inv => (
              <div key={inv.id} className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                inv.isTriggered ? 'bg-rose-500/15 border-rose-500/40 text-rose-200' : 'bg-slate-950/60 border-slate-800 text-slate-300'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-amber-400 rounded">
                      {inv.conditionType}
                    </span>
                    <span className="text-xs font-semibold">{inv.description}</span>
                  </div>
                  {inv.thresholdValue !== undefined && (
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Threshold: ₹{inv.thresholdValue.toFixed(2)} • Current: ₹{inv.currentValue?.toFixed(2) || 'N/A'}
                    </div>
                  )}
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                  inv.isTriggered ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {inv.isTriggered ? 'TRIGGERED' : 'UNTRIPPED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
