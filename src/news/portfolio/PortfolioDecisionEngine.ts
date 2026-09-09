/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioDecisionEngine.ts
 * 
 * Portfolio Decision Engine.
 * Core orchestrator combining Phase 12 Strategy Candidates with current Portfolio state
 * to produce machine-readable Portfolio Decisions (ADD, REDUCE, HOLD, HEDGE, REBALANCE, CONDITIONAL, WATCH, NO_TRADE, EXIT).
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic, zero LLM dependency for decision calculations.
 */

import {
  RawPortfolioPosition,
  PortfolioSnapshot,
  PortfolioDecision,
  PortfolioDecisionType,
  PortfolioImpactReport,
  PositionSizingResult,
  HedgeCandidate,
  NormalizedPosition
} from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { portfolioPositionNormalizer } from './PortfolioPositionNormalizer.ts';
import { portfolioExposureEngine } from './PortfolioExposureEngine.ts';
import { portfolioGreeksEngine } from './PortfolioGreeksEngine.ts';
import { portfolioCorrelationEngine } from './PortfolioCorrelationEngine.ts';
import { portfolioConcentrationEngine } from './PortfolioConcentrationEngine.ts';
import { portfolioCapitalEngine } from './PortfolioCapitalEngine.ts';
import { portfolioDrawdownEngine } from './PortfolioDrawdownEngine.ts';
import { portfolioRegimeEngine } from './PortfolioRegimeEngine.ts';
import { portfolioStressEngine } from './PortfolioStressEngine.ts';
import { portfolioHedgeEngine } from './PortfolioHedgeEngine.ts';
import { portfolioPositionSizingEngine } from './PortfolioPositionSizingEngine.ts';
import { portfolioRiskGate } from './PortfolioRiskGate.ts';

export class PortfolioDecisionEngine {
  private static instance: PortfolioDecisionEngine;

  private constructor() {}

  public static getInstance(): PortfolioDecisionEngine {
    if (!this.instance) {
      this.instance = new PortfolioDecisionEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates a Phase 12 Candidate Strategy against a Portfolio Snapshot to produce a PortfolioDecision
   */
  public evaluateCandidateForPortfolio(
    candidate: CanonicalStrategyCandidate,
    snapshotInput: PortfolioSnapshot | { totalCapitalINR: number; rawPositions: RawPortfolioPosition[] },
    marketRegime: string = 'BALANCED'
  ): PortfolioDecision {
    // 1. Build & Normalize Portfolio Snapshot
    let snapshot: PortfolioSnapshot;
    if ('schemaVersion' in snapshotInput) {
      snapshot = snapshotInput as PortfolioSnapshot;
    } else {
      const normalizedPositions = portfolioPositionNormalizer.normalizePositions(snapshotInput.rawPositions);
      const capital = snapshotInput.totalCapitalINR || 100000;
      let usedMargin = 0;
      let totalUnrealized = 0;

      for (const p of normalizedPositions) {
        usedMargin += p.currentMarketValueINR;
        totalUnrealized += p.unrealizedPnLINR;
      }

      snapshot = {
        schemaVersion: 'v13_portfolio_intelligence',
        timestamp: new Date().toISOString(),
        totalCapitalINR: capital,
        availableCapitalINR: Math.max(0, capital - usedMargin),
        usedMarginINR: usedMargin,
        freeMarginINR: Math.max(0, capital - usedMargin),
        cashINR: Math.max(0, capital - usedMargin),
        totalUnrealizedPnLINR: totalUnrealized,
        totalRealizedPnLINR: 0,
        positions: normalizedPositions
      };
    }

    // 2. Compute Individual Portfolio Modules
    const currentPositions = snapshot.positions || [];
    const capital = snapshot.totalCapitalINR > 0 ? snapshot.totalCapitalINR : 100000;

    const beforeExposure = portfolioExposureEngine.calculateExposure(currentPositions, capital);
    const greeksImpact = portfolioGreeksEngine.calculateGreeksImpact(currentPositions, candidate);
    const correlation = portfolioCorrelationEngine.evaluateCorrelationAndOverlap(currentPositions);
    const concentration = portfolioConcentrationEngine.evaluateConcentration(currentPositions, capital);
    const capitalReport = portfolioCapitalEngine.evaluateCapital(snapshot, candidate);
    const drawdownReport = portfolioDrawdownEngine.evaluateDrawdown(snapshot);
    const regimeReport = portfolioRegimeEngine.evaluateRegimeExposure(currentPositions, marketRegime);
    const stressReport = portfolioStressEngine.runStressTests(currentPositions, capital);

    // 3. Compute Portfolio Impact Report (Before vs After)
    const afterPositions: NormalizedPosition[] = [...currentPositions];
    // Add candidate as normalized position for after snapshot estimation
    const candSpot = candidate.entryPrice || 1000;
    const candQty = candidate.positionSizeContractsOrQty || 1;
    const isCandLong = candidate.direction === 'LONG';
    afterPositions.push({
      id: `cand-${candidate.strategyId}`,
      symbol: candidate.symbol,
      underlyingSymbol: candidate.symbol,
      assetClass: candidate.category,
      side: isCandLong ? 'LONG' : 'SHORT',
      netQuantity: isCandLong ? candQty : -candQty,
      grossQuantity: candQty,
      entryPrice: candSpot,
      currentPrice: candSpot,
      currentMarketValueINR: candQty * candSpot,
      notionalExposureINR: candQty * candSpot,
      directionalExposureINR: (isCandLong ? 1 : -1) * candQty * candSpot,
      leveragedExposureINR: candQty * candSpot,
      unrealizedPnLINR: 0,
      realizedPnLINR: 0,
      sector: candidate.sector || 'GENERAL',
      indexSymbol: 'NIFTY',
      beta: 1.0,
      leverage: 1.0,
      stopLossPrice: candidate.stopLossPrice,
      targetPrice: candidate.targetPrice,
      greeks: {
        delta: greeksImpact.deltaChange.netDelta,
        gamma: greeksImpact.deltaChange.netGamma,
        theta: greeksImpact.deltaChange.netTheta,
        vega: greeksImpact.deltaChange.netVega
      }
    });

    const afterExposure = portfolioExposureEngine.calculateExposure(afterPositions, capital);
    const afterConcentration = portfolioConcentrationEngine.evaluateConcentration(afterPositions, capital);
    const afterStressReport = portfolioStressEngine.runStressTests(afterPositions, capital);

    const impactReport: PortfolioImpactReport = {
      candidateStrategyId: candidate.strategyId,
      candidateStrategyName: candidate.strategyName,
      before: {
        grossExposureINR: beforeExposure.grossExposureINR,
        netExposureINR: beforeExposure.netExposureINR,
        marginUtilizationPct: capitalReport.marginUtilizationPct,
        netDelta: greeksImpact.before.netDelta,
        netVega: greeksImpact.before.netVega,
        overallConcentrationScore: concentration.overallConcentrationScore,
        worstCaseStressLossINR: stressReport.worstCaseLossINR
      },
      after: {
        grossExposureINR: afterExposure.grossExposureINR,
        netExposureINR: afterExposure.netExposureINR,
        marginUtilizationPct: capitalReport.postTradeMarginUtilizationPct,
        netDelta: greeksImpact.after.netDelta,
        netVega: greeksImpact.after.netVega,
        overallConcentrationScore: afterConcentration.overallConcentrationScore,
        worstCaseStressLossINR: afterStressReport.worstCaseLossINR
      },
      delta: {
        grossExposureDeltaINR: afterExposure.grossExposureINR - beforeExposure.grossExposureINR,
        netExposureDeltaINR: afterExposure.netExposureINR - beforeExposure.netExposureINR,
        marginUtilizationDeltaPct: Number((capitalReport.postTradeMarginUtilizationPct - capitalReport.marginUtilizationPct).toFixed(2)),
        netDeltaChange: greeksImpact.deltaChange.netDelta,
        netVegaChange: greeksImpact.deltaChange.netVega,
        concentrationChangeScore: afterConcentration.overallConcentrationScore - concentration.overallConcentrationScore,
        stressLossChangeINR: afterStressReport.worstCaseLossINR - stressReport.worstCaseLossINR
      },
      riskChangeClassification: (afterStressReport.worstCaseLossINR < stressReport.worstCaseLossINR) ? 'RISK_INCREMENTAL' : 'RISK_REDUCING',
      capitalChangeINR: capitalReport.incrementalMarginRequiredINR
    };

    // 4. Position Sizing
    const positionSizing = portfolioPositionSizingEngine.calculatePositionSizing(
      candidate,
      capital,
      snapshot.availableCapitalINR,
      snapshot.freeMarginINR,
      drawdownReport.drawdownState,
      correlation.overlapScore
    );

    // 5. Risk Gatekeeper
    const riskGateResult = portfolioRiskGate.evaluateRiskGate(
      candidate,
      capitalReport,
      concentration,
      afterStressReport,
      drawdownReport,
      regimeReport,
      impactReport
    );

    // 6. Hedge Recommendations
    const hedgeRecommendations = portfolioHedgeEngine.evaluateHedgeCandidates(
      currentPositions,
      greeksImpact.before,
      concentration,
      capital
    );

    // 7. Map Risk Gate & Strategy properties to Final Decision Type
    let finalDecision: PortfolioDecisionType = 'NO_TRADE';
    if (riskGateResult.status === 'APPROVED') {
      finalDecision = 'ADD';
    } else if (riskGateResult.status === 'APPROVED_REDUCED_SIZE') {
      finalDecision = 'ADD';
    } else if (riskGateResult.status === 'HEDGE_REQUIRED') {
      finalDecision = 'HEDGE';
    } else if (riskGateResult.status === 'CONDITIONAL') {
      finalDecision = 'CONDITIONAL';
    } else if (riskGateResult.status === 'REBALANCE_REQUIRED') {
      finalDecision = 'REBALANCE';
    } else if (candidate.actionability === 'WATCH') {
      finalDecision = 'WATCH';
    } else {
      finalDecision = 'NO_TRADE';
    }

    const decisionId = `dec-${candidate.strategyId}-${Date.now()}`;
    const evidenceReferences = [
      { stage: 'EXPOSURE_RESOLUTION', summary: `Net Exposure delta: ₹${impactReport.delta.netExposureDeltaINR}` },
      { stage: 'GREEKS_AGGREGATION', summary: `Net Delta shift: ${impactReport.delta.netDeltaChange}` },
      { stage: 'STRESS_TESTING', summary: `Worst-case loss: ₹${afterStressReport.worstCaseLossINR} (${afterStressReport.worstCaseLossPct}%) under ${afterStressReport.worstCaseScenarioName}` },
      { stage: 'PORTFOLIO_RISK_GATE', summary: `Status: ${riskGateResult.status}` }
    ];

    return {
      schemaVersion: 'v13_portfolio_intelligence',
      decisionId,
      candidateStrategyId: candidate.strategyId,
      candidateStrategyName: candidate.strategyName,
      symbol: candidate.symbol,
      decision: finalDecision,
      positionSizing,
      portfolioImpact: impactReport.riskChangeClassification,
      capitalImpactINR: capitalReport.incrementalMarginRequiredINR,
      marginImpactINR: capitalReport.incrementalMarginRequiredINR,
      deltaImpact: greeksImpact.deltaChange.netDelta,
      concentrationImpactScore: afterConcentration.overallConcentrationScore,
      stressImpactLossINR: afterStressReport.worstCaseLossINR,
      riskGateStatus: riskGateResult.status,
      rationales: [...riskGateResult.rationales, ...riskGateResult.warnings],
      hedgeRecommendations: hedgeRecommendations.length > 0 ? hedgeRecommendations : undefined,
      evidenceReferences,
      generatedAt: new Date().toISOString(),
      engineVersion: 'ATHENA_PORTFOLIO_INTELLIGENCE_V13.0'
    };
  }
}

export const portfolioDecisionEngine = PortfolioDecisionEngine.getInstance();
