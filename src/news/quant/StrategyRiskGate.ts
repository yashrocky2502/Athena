/**
 * ATHENA NEWS ENGINE — PHASE 12
 * StrategyRiskGate.ts
 * 
 * Deterministic Risk Gate & Actionability Evaluator.
 * Gatekeeper enforcing strict risk limits, contradiction handling, and lifecycle constraints.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic rules.
 */

import { StrategyRiskProfile, StrategyActionability, ValidationStatus, ExpectedValueMetrics, BacktestMetrics } from './types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

export interface RiskGateResult {
  actionability: StrategyActionability;
  riskProfile: StrategyRiskProfile;
  rationale: string;
}

export class StrategyRiskGate {
  private static instance: StrategyRiskGate;

  private constructor() {}

  public static getInstance(): StrategyRiskGate {
    if (!this.instance) {
      this.instance = new StrategyRiskGate();
    }
    return this.instance;
  }

  /**
   * Evaluates Risk Limits & Determines Strategy Actionability State
   */
  public evaluateRiskGate(
    signal: TransmissionSignalResult,
    backtest: BacktestMetrics,
    expectedValue: ExpectedValueMetrics,
    validationStatus: ValidationStatus,
    capitalRequiredINR: number
  ): RiskGateResult {
    const isContradicted = signal.alignment === 'CONTRADICTED' || 
                           signal.lifecycleState === 'CONTRADICTED' || 
                           signal.lifecycleState === 'INVALIDATED';

    const rvol = signal.marketReaction?.rvol || 1.0;
    const maxLoss = backtest.averageLoss > 0 ? backtest.averageLoss : Math.round(capitalRequiredINR * 0.05);

    // Build Risk Profile
    const riskProfile: StrategyRiskProfile = {
      maxLossINR: maxLoss,
      maxDrawdownPct: backtest.maxDrawdownPct,
      liquidityScore: Math.min(100, Math.round(rvol * 50)),
      slippageEstimatePct: 0.05,
      eventRisk: signal.priority === 'P0_CRITICAL' ? 'HIGH' : 'MODERATE',
      gapRisk: signal.marketReaction?.gapPct && Math.abs(signal.marketReaction.gapPct) > 1.5 ? 'HIGH' : 'LOW',
      leverageRatio: capitalRequiredINR < 15000 ? 5.0 : 1.0,
      sampleSizeQuality: backtest.totalTrades < 5 ? 'INSUFFICIENT' : backtest.totalTrades < 15 ? 'LIMITED' : 'ROBUST',
      contradictionRisk: isContradicted,
      overallRiskScore: isContradicted ? 10 : Math.min(100, Math.round(100 - (backtest.maxDrawdownPct * 2)))
    };

    // HARD RULE 1: Contradicted, Invalidated, or Expired Signals MUST NEVER be TRADEABLE
    if (isContradicted || signal.lifecycleState === 'EXPIRED') {
      return {
        actionability: 'NO_TRADE',
        riskProfile,
        rationale: `Signal is ${signal.lifecycleState || 'CONTRADICTED'}. Capital preservation enforced.`
      };
    }

    // HARD RULE 2: Insufficient Sample or Overfit Risk
    if (validationStatus === 'INSUFFICIENT_SAMPLE') {
      return {
        actionability: 'WATCH',
        riskProfile,
        rationale: 'Historical sample size is insufficient (<5 events). Strategy is placed on WATCH.'
      };
    }

    if (validationStatus === 'OVERFIT_RISK') {
      return {
        actionability: 'NO_TRADE',
        riskProfile,
        rationale: 'High overfitting risk detected. Strategy fails risk gate.'
      };
    }

    // HARD RULE 3: Negative Expected Value or High Drawdown
    if (expectedValue.expectedValueINR <= 0) {
      return {
        actionability: 'NO_TRADE',
        riskProfile,
        rationale: `Negative or zero expected value (₹${expectedValue.expectedValueINR}).`
      };
    }

    if (backtest.maxDrawdownPct > 20) {
      return {
        actionability: 'CONDITIONAL',
        riskProfile,
        rationale: `Maximum drawdown (${backtest.maxDrawdownPct}%) exceeds 20% limit.`
      };
    }

    // HARD RULE 4: Full Validation vs Conditional Validation
    if (validationStatus === 'VALIDATED' && signal.transmissionScore >= 70 && backtest.winRatePct >= 60) {
      return {
        actionability: 'TRADEABLE',
        riskProfile,
        rationale: `Strategy passed all risk gate checks. Robust win rate (${backtest.winRatePct}%) & EV (+₹${expectedValue.expectedValueINR}).`
      };
    }

    if (validationStatus === 'CONDITIONAL' || signal.transmissionScore >= 55) {
      return {
        actionability: 'WATCH',
        riskProfile,
        rationale: 'Strategy is conditionally valid. Keep on active watchlist for entry confirmation.'
      };
    }

    return {
      actionability: 'CONDITIONAL',
      riskProfile,
      rationale: 'Strategy requires further market confirmation before execution.'
    };
  }
}

export const strategyRiskGate = StrategyRiskGate.getInstance();
