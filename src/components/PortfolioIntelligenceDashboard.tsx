/**
 * ATHENA — PHASE 13
 * PortfolioIntelligenceDashboard.tsx
 * 
 * Command Center UI for Portfolio Intelligence & Position Decision Engine.
 * Visualizes Portfolio Overview, Exposure Matrix, Options Risk (Greeks),
 * Risk Matrix, Strategy Impact (BEFORE vs AFTER), and Final Athena Decisions.
 */

import React, { useState, useMemo } from 'react';
import {
  PieChart, ShieldAlert, Zap, TrendingUp, TrendingDown, Layers,
  Activity, AlertTriangle, CheckCircle2, ArrowUpRight, Scale,
  Gauge, Anchor, BarChart3, Copy, Check, Info, FileSpreadsheet
} from 'lucide-react';
import { RawPortfolioPosition, PortfolioSnapshot, PortfolioDecision } from '../news/portfolio/types.ts';
import { portfolioDecisionEngine } from '../news/portfolio/PortfolioDecisionEngine.ts';
import { portfolioPositionNormalizer } from '../news/portfolio/PortfolioPositionNormalizer.ts';
import { portfolioExposureEngine } from '../news/portfolio/PortfolioExposureEngine.ts';
import { portfolioGreeksEngine } from '../news/portfolio/PortfolioGreeksEngine.ts';
import { portfolioStressEngine } from '../news/portfolio/PortfolioStressEngine.ts';
import { portfolioConcentrationEngine } from '../news/portfolio/PortfolioConcentrationEngine.ts';
import { portfolioDrawdownEngine } from '../news/portfolio/PortfolioDrawdownEngine.ts';
import { portfolioTelegramSnapshot } from '../news/portfolio/PortfolioTelegramSnapshot.ts';
import { strategyCandidateEngine } from '../news/quant/StrategyCandidateEngine.ts';
import { TransmissionSignalResult } from '../news/intelligence/EventToSignalTransmissionEngine.ts';

interface PortfolioIntelligenceDashboardProps {
  symbol?: string;
  totalCapitalINR?: number;
}

const DEFAULT_POSITIONS: RawPortfolioPosition[] = [
  {
    id: 'pos-1',
    symbol: 'INFY',
    underlyingSymbol: 'INFY',
    assetClass: 'EQUITY',
    side: 'LONG',
    quantity: 150,
    entryPrice: 1820,
    currentPrice: 1860,
    unrealizedPnLINR: 6000,
    realizedPnLINR: 0,
    sector: 'IT',
    indexSymbol: 'NIFTY_IT',
    beta: 1.1
  },
  {
    id: 'pos-2',
    symbol: 'RELIANCE',
    underlyingSymbol: 'RELIANCE',
    assetClass: 'EQUITY',
    side: 'LONG',
    quantity: 100,
    entryPrice: 2950,
    currentPrice: 3010,
    unrealizedPnLINR: 6000,
    realizedPnLINR: 0,
    sector: 'ENERGY',
    indexSymbol: 'NIFTY',
    beta: 1.25
  },
  {
    id: 'pos-3',
    symbol: 'NIFTY_25000_CE',
    underlyingSymbol: 'NIFTY',
    assetClass: 'OPTIONS',
    side: 'SHORT',
    quantity: 2,
    entryPrice: 180,
    currentPrice: 140,
    unrealizedPnLINR: 4000,
    realizedPnLINR: 0,
    sector: 'INDEX',
    indexSymbol: 'NIFTY',
    optionType: 'CALL',
    strikePrice: 25000,
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    delta: -0.42,
    gamma: -0.0015,
    theta: 18.5,
    vega: -12.0
  }
];

export const PortfolioIntelligenceDashboard: React.FC<PortfolioIntelligenceDashboardProps> = ({
  symbol = 'INFY',
  totalCapitalINR = 500000
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);

  // 1. Prepare Base Portfolio Data
  const normalizedPositions = useMemo(() => {
    return portfolioPositionNormalizer.normalizePositions(DEFAULT_POSITIONS);
  }, []);

  const snapshot: PortfolioSnapshot = useMemo(() => {
    const usedMargin = normalizedPositions.reduce((sum, p) => sum + p.currentMarketValueINR, 0);
    const totalUnrealized = normalizedPositions.reduce((sum, p) => sum + p.unrealizedPnLINR, 0);
    return {
      schemaVersion: 'v13_portfolio_intelligence',
      timestamp: new Date().toISOString(),
      totalCapitalINR,
      availableCapitalINR: Math.max(0, totalCapitalINR - usedMargin),
      usedMarginINR: usedMargin,
      freeMarginINR: Math.max(0, totalCapitalINR - usedMargin),
      cashINR: Math.max(0, totalCapitalINR - usedMargin),
      totalUnrealizedPnLINR: totalUnrealized,
      totalRealizedPnLINR: 0,
      positions: normalizedPositions
    };
  }, [normalizedPositions, totalCapitalINR]);

  const exposure = useMemo(() => portfolioExposureEngine.calculateExposure(normalizedPositions, totalCapitalINR), [normalizedPositions, totalCapitalINR]);
  const greeks = useMemo(() => portfolioGreeksEngine.aggregateGreeks(normalizedPositions), [normalizedPositions]);
  const concentration = useMemo(() => portfolioConcentrationEngine.evaluateConcentration(normalizedPositions, totalCapitalINR), [normalizedPositions, totalCapitalINR]);
  const drawdown = useMemo(() => portfolioDrawdownEngine.evaluateDrawdown(snapshot), [snapshot]);
  const stress = useMemo(() => portfolioStressEngine.runStressTests(normalizedPositions, totalCapitalINR), [normalizedPositions, totalCapitalINR]);

  // 2. Generate Candidate Strategies for current symbol
  const candidates = useMemo(() => {
    const mockSignal: any = {
      signalId: `sig-${symbol}`,
      eventCategory: 'EARNINGS_BEAT',
      symbol,
      direction: 'BULLISH',
      transmissionScore: 84,
      marketReaction: { totalChangePct: 3.2, currentPrice: 1860, rvol: 2.4 },
      lifecycleState: 'CONFIRMED',
      actionability: 'TRADEABLE',
      headline: `${symbol} Strategic Growth & Margin Expansion`,
      canonicalSummary: `Positive operational momentum and earnings beat for ${symbol}.`
    };
    return strategyCandidateEngine.generateCandidatesForSignal(mockSignal);
  }, [symbol]);

  const currentCandidate = candidates[selectedCandidateIdx] || candidates[0];

  // 3. Evaluate Portfolio Decision
  const portfolioDecision: PortfolioDecision = useMemo(() => {
    if (!currentCandidate) {
      return {
        schemaVersion: 'v13_portfolio_intelligence',
        decisionId: 'dec-null',
        candidateStrategyId: 'null',
        candidateStrategyName: 'None',
        symbol,
        decision: 'NO_TRADE',
        positionSizing: { maxAllowedQuantity: 0, recommendedQuantity: 0, conservativeQuantity: 0, limitingFactor: 'None', estimatedCapitalRequiredINR: 0, estimatedMarginRequiredINR: 0 },
        portfolioImpact: 'NEUTRAL_RISK',
        capitalImpactINR: 0,
        marginImpactINR: 0,
        deltaImpact: 0,
        concentrationImpactScore: 0,
        stressImpactLossINR: 0,
        riskGateStatus: 'NO_TRADE',
        rationales: ['No strategy candidate selected.'],
        evidenceReferences: [],
        generatedAt: new Date().toISOString(),
        engineVersion: 'ATHENA_PORTFOLIO_INTELLIGENCE_V13.0'
      };
    }
    return portfolioDecisionEngine.evaluateCandidateForPortfolio(currentCandidate, snapshot, 'BULLISH_TREND');
  }, [currentCandidate, snapshot, symbol]);

  const telegramText = useMemo(() => {
    return portfolioTelegramSnapshot.generateTelegramSnapshot(portfolioDecision);
  }, [portfolioDecision]);

  const handleCopyTelegram = () => {
    navigator.clipboard.writeText(telegramText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDecisionBadge = (type: string) => {
    switch (type) {
      case 'ADD': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'HEDGE': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'CONDITIONAL': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'REBALANCE': return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'NO_TRADE':
      case 'EXIT': return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default: return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-2xl space-y-6 my-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              ATHENA PHASE 13 — PORTFOLIO INTELLIGENCE & POSITION DECISION ENGINE
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic portfolio risk aggregation, Greeks exposure, stress scenarios & position decision gates.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono text-emerald-400">
            SCHEMA: v13_portfolio_intelligence
          </span>
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono text-slate-300">
            ZERO-AI QUANT CORE
          </span>
        </div>
      </div>

      {/* SECTION 1: PORTFOLIO OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Capital</span>
          <div className="text-lg font-bold text-white mt-1">₹{(totalCapitalINR).toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-500 font-mono">Portfolio Base</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Available Capital</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">₹{(snapshot.availableCapitalINR).toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-emerald-500/80 font-mono">{((snapshot.availableCapitalINR / totalCapitalINR) * 100).toFixed(1)}% Free</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Unrealized P&L</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">+₹{(snapshot.totalUnrealizedPnLINR).toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-emerald-500/80 font-mono">+3.2% Open Return</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Margin Utilization</span>
          <div className="text-lg font-bold text-amber-400 mt-1">{((snapshot.usedMarginINR / totalCapitalINR) * 100).toFixed(1)}%</div>
          <span className="text-[10px] text-amber-500/80 font-mono">₹{(snapshot.usedMarginINR).toLocaleString('en-IN')} Used</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Effective Leverage</span>
          <div className="text-lg font-bold text-indigo-400 mt-1">{exposure.grossNotionalToCapitalRatio}x</div>
          <span className="text-[10px] text-slate-500 font-mono">Gross Notional</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Equity Drawdown</span>
          <div className="text-lg font-bold text-slate-200 mt-1">{drawdown.currentDrawdownPct}%</div>
          <span className="text-[10px] text-emerald-400 font-mono">{drawdown.drawdownState}</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Stress Score</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">{stress.overallStressScore}/100</div>
          <span className="text-[10px] text-slate-400 font-mono">Worst: {stress.worstCaseLossPct}%</span>
        </div>
      </div>

      {/* SECTION 2: EXPOSURE & GREEKS MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* EXPOSURE MATRIX */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-cyan-400" /> EXPOSURE MATRIX
            </span>
            <span className="text-xs text-slate-400 font-mono">Beta Exp: {exposure.directionalBetaExposure}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/70">
              <span className="text-slate-400">Long Exposure</span>
              <div className="text-sm font-bold text-emerald-400">₹{(exposure.longExposureINR).toLocaleString('en-IN')}</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/70">
              <span className="text-slate-400">Short Exposure</span>
              <div className="text-sm font-bold text-rose-400">₹{(exposure.shortExposureINR).toLocaleString('en-IN')}</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/70">
              <span className="text-slate-400">Net Exposure</span>
              <div className="text-sm font-bold text-indigo-300">₹{(exposure.netExposureINR).toLocaleString('en-IN')}</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/70">
              <span className="text-slate-400">Gross Exposure</span>
              <div className="text-sm font-bold text-white">₹{(exposure.grossExposureINR).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="pt-1">
            <span className="text-xs text-slate-400 block mb-1">Top Sector Breakdowns:</span>
            <div className="space-y-1">
              {Object.entries(exposure.sectorExposurePctMap).map(([sec, pct]) => (
                <div key={sec} className="flex justify-between items-center text-xs bg-slate-900 px-2 py-1 rounded">
                  <span className="text-slate-300">{sec}</span>
                  <span className="font-mono font-semibold text-cyan-400">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* OPTIONS GREEKS MATRIX */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" /> OPTIONS RISK (GREEKS AGGREGATION)
            </span>
            <span className="text-xs text-slate-400 font-mono">Delta Exp: ₹{greeks.deltaExposureINR}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-900/80 p-2 rounded text-center border border-slate-800/70">
              <span className="text-slate-400 block">Delta</span>
              <span className="text-sm font-bold text-cyan-400 font-mono">{greeks.netDelta}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded text-center border border-slate-800/70">
              <span className="text-slate-400 block">Gamma</span>
              <span className="text-sm font-bold text-purple-400 font-mono">{greeks.netGamma}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded text-center border border-slate-800/70">
              <span className="text-slate-400 block">Theta</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">+{greeks.netTheta}/d</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded text-center border border-slate-800/70">
              <span className="text-slate-400 block">Vega</span>
              <span className="text-sm font-bold text-amber-400 font-mono">{greeks.netVega}</span>
            </div>
          </div>

          <div className="pt-1">
            <span className="text-xs text-slate-400 block mb-1">Concentration Risk Scores:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900 p-2 rounded flex justify-between">
                <span className="text-slate-400">Sector Concentration:</span>
                <span className="font-mono text-amber-400 font-semibold">{concentration.sectorConcentration}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded flex justify-between">
                <span className="text-slate-400">Single Stock Max:</span>
                <span className="font-mono text-emerald-400 font-semibold">{concentration.maxSingleSecurityPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CANDIDATE STRATEGY INJECTION & BEFORE vs AFTER IMPACT */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3">
          <div>
            <span className="text-xs text-emerald-400 font-mono uppercase tracking-wider block">Candidate Strategy Selector</span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Portfolio Impact Evaluation (BEFORE vs AFTER)
            </h3>
          </div>
          <div className="flex space-x-2">
            {candidates.map((cand, idx) => (
              <button
                key={cand.strategyId}
                onClick={() => setSelectedCandidateIdx(idx)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition border ${
                  selectedCandidateIdx === idx
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {cand.strategyType.replace('OPTION_', '').replace('EQUITY_', '')}
              </button>
            ))}
          </div>
        </div>

        {/* COMPARISON TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3">Metric</th>
                <th className="py-2 px-3">Before Candidate</th>
                <th className="py-2 px-3">Candidate Inject</th>
                <th className="py-2 px-3">After Portfolio</th>
                <th className="py-2 px-3">Delta Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr>
                <td className="py-2 px-3 font-sans text-slate-300 font-semibold">Net Exposure</td>
                <td className="py-2 px-3 text-slate-300">₹{(exposure.netExposureINR).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-amber-400">+{currentCandidate.strategyName}</td>
                <td className="py-2 px-3 text-white">₹{(exposure.netExposureINR + (portfolioDecision.deltaImpact * 1000)).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-emerald-400">+₹{(portfolioDecision.deltaImpact * 1000).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-300 font-semibold">Margin Utilization</td>
                <td className="py-2 px-3 text-slate-300">{((snapshot.usedMarginINR / totalCapitalINR) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-amber-400">+₹{(portfolioDecision.marginImpactINR || 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-white">{(((snapshot.usedMarginINR + (portfolioDecision.marginImpactINR || 0)) / totalCapitalINR) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-amber-400">+{(portfolioDecision.positionSizing?.estimatedMarginRequiredINR / totalCapitalINR * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-300 font-semibold">Net Portfolio Delta</td>
                <td className="py-2 px-3 text-slate-300">{greeks.netDelta}</td>
                <td className="py-2 px-3 text-amber-400">{currentCandidate.direction}</td>
                <td className="py-2 px-3 text-white">{(greeks.netDelta + portfolioDecision.deltaImpact).toFixed(2)}</td>
                <td className="py-2 px-3 text-emerald-400">{portfolioDecision.deltaImpact > 0 ? '+' : ''}{portfolioDecision.deltaImpact.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-300 font-semibold">Worst-Case Stress Loss</td>
                <td className="py-2 px-3 text-rose-400">₹{(stress.worstCaseLossINR).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-slate-400">{stress.worstCaseScenarioName}</td>
                <td className="py-2 px-3 text-rose-300">₹{(portfolioDecision.stressImpactLossINR || 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-emerald-400">Controlled</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: ATHENA PORTFOLIO DECISION & TELEGRAM SNAPSHOT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DECISION CARD */}
        <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Deterministic Gate Outcome</span>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ATHENA DECISION: 
                <span className={`px-3 py-0.5 rounded border text-sm font-mono font-bold ${getDecisionBadge(portfolioDecision.decision)}`}>
                  {portfolioDecision.decision}
                </span>
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Risk Gate:</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{portfolioDecision.riskGateStatus}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block">Recommended Qty</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{portfolioDecision.positionSizing.recommendedQuantity} Lots / Qty</span>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block">Max Allowed Qty</span>
              <span className="text-base font-bold text-white font-mono">{portfolioDecision.positionSizing.maxAllowedQuantity} Lots / Qty</span>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block">Limiting Risk Factor</span>
              <span className="text-xs font-semibold text-amber-300">{portfolioDecision.positionSizing.limitingFactor}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold">Decision Rationales:</span>
            <ul className="space-y-1 text-xs text-slate-300">
              {portfolioDecision.rationales.map((r, i) => (
                <li key={i} className="flex items-start gap-2 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* TELEGRAM SNAPSHOT PREVIEW */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" /> Telegram Snapshot
            </span>
            <button
              onClick={handleCopyTelegram}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition"
              title="Copy Telegram Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <pre className="bg-slate-900 p-3 rounded text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800 overflow-y-auto max-h-60">
            {telegramText}
          </pre>
        </div>
      </div>
    </div>
  );
};
