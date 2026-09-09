/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioRiskGate.ts
 * 
 * Portfolio Risk Gate.
 * Final deterministic risk gatekeeper evaluating portfolio-wide safety rules before candidate strategy approval.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic evaluation.
 */

import {
  PortfolioSnapshot,
  PortfolioImpactReport,
  PortfolioRiskGateResult,
  PortfolioRiskGateStatus,
  PortfolioCapitalReport,
  PortfolioConcentrationReport,
  PortfolioStressReport,
  PortfolioDrawdownReport,
  MarketRegimeExposureReport
} from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';

export class PortfolioRiskGate {
  private static instance: PortfolioRiskGate;

  private constructor() {}

  public static getInstance(): PortfolioRiskGate {
    if (!this.instance) {
      this.instance = new PortfolioRiskGate();
    }
    return this.instance;
  }

  /**
   * Evaluates candidate strategy against portfolio risk limits
   */
  public evaluateRiskGate(
    candidate: CanonicalStrategyCandidate,
    capitalReport: PortfolioCapitalReport,
    concentrationReport: PortfolioConcentrationReport,
    stressReport: PortfolioStressReport,
    drawdownReport: PortfolioDrawdownReport,
    regimeReport: MarketRegimeExposureReport,
    impactReport: PortfolioImpactReport
  ): PortfolioRiskGateResult {
    const rejectionRulesTriggered: string[] = [];
    const warnings: string[] = [];
    const rationales: string[] = [];

    // 1. Contradiction & Invalidation Rule (Hard Safety Gate)
    if (candidate.actionability === 'NO_TRADE' || candidate.compatibilityRating === 'INCOMPATIBLE') {
      rejectionRulesTriggered.push('CANDIDATE_SIGNAL_CONTRADICTED_OR_INVALIDATED');
      rationales.push(`Candidate strategy ${candidate.strategyName} is marked NO_TRADE or INCOMPATIBLE.`);
    }

    // 2. Capital Preservation & Margin Utilization Rule
    if (capitalReport.capitalPreservationBreached || capitalReport.postTradeMarginUtilizationPct > 85.0) {
      rejectionRulesTriggered.push('MARGIN_UTILIZATION_LIMIT_EXCEEDED');
      rationales.push(`Post-trade margin utilization (${capitalReport.postTradeMarginUtilizationPct}%) breaches 85% risk threshold.`);
    }

    // 3. Catastrophic Stress Loss Rule
    if (stressReport.worstCaseLossPct < -20.0) {
      rejectionRulesTriggered.push('EXCESSIVE_STRESS_TEST_LOSS');
      rationales.push(`Worst-case stress loss (${stressReport.worstCaseLossPct}% under ${stressReport.worstCaseScenarioName}) exceeds 20% capital tolerance.`);
    }

    // 4. Critical Drawdown Rule
    if (drawdownReport.drawdownState === 'DRAWDOWN_CRITICAL') {
      warnings.push(`Portfolio in CRITICAL drawdown state (${drawdownReport.currentDrawdownPct}%).`);
      rationales.push(`Critical drawdown mandates position size reduction or pause.`);
    }

    // 5. Extreme Sector Concentration Rule
    if (concentrationReport.sectorConcentration === 'EXTREME' || impactReport.after.overallConcentrationScore > 80) {
      warnings.push(`High post-trade portfolio concentration score (${impactReport.after.overallConcentrationScore}/100).`);
      rationales.push(`Excessive sector concentration requires hedging or position reduction.`);
    }

    // 6. Regime Contradiction Rule
    if (regimeReport.regimeStatus === 'REGIME_CONTRADICTED') {
      warnings.push(`Candidate contradicts current market regime (${regimeReport.currentRegime}).`);
    }

    // Determine Final Gate Status
    let status: PortfolioRiskGateStatus = 'APPROVED';
    let passed = true;

    if (rejectionRulesTriggered.length > 0) {
      status = 'NO_TRADE';
      passed = false;
    } else if (drawdownReport.drawdownState === 'DRAWDOWN_CRITICAL' || capitalReport.postTradeMarginUtilizationPct > 70.0) {
      status = 'APPROVED_REDUCED_SIZE';
      rationales.push('Approved with reduced position sizing due to elevated portfolio margin or drawdown.');
    } else if (concentrationReport.sectorConcentration === 'HIGH' || concentrationReport.sectorConcentration === 'EXTREME') {
      status = 'HEDGE_REQUIRED';
      rationales.push('Hedge required to mitigate high sector exposure before full execution.');
    } else if (candidate.compatibilityRating === 'CONDITIONAL' || regimeReport.regimeStatus === 'REGIME_VULNERABLE') {
      status = 'CONDITIONAL';
      rationales.push('Conditional approval pending confirmation of market regime alignment.');
    } else {
      status = 'APPROVED';
      rationales.push('Strategy fully improves or maintains optimal portfolio risk-reward characteristics.');
    }

    return {
      status,
      rejectionRulesTriggered,
      warnings,
      rationales,
      passed
    };
  }
}

export const portfolioRiskGate = PortfolioRiskGate.getInstance();
