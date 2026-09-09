/**
 * ATHENA NEWS ENGINE — PHASE 15
 * ExpectedVsRealizedEngine.ts
 * 
 * Compares Phase 12 (Strategy Expectations), Phase 13 (Portfolio Expectations),
 * and Phase 14 (Execution Expectations) against actual realized Trade Outcomes.
 * 
 * Generates Prediction Errors for return, probability, R:R, MFE, MAE, holding period,
 * and execution slippage.
 */

import { TradeOutcome, PredictionError } from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { PortfolioDecision } from '../portfolio/types.ts';
import { ExecutionIntent } from '../execution/types.ts';

export class ExpectedVsRealizedEngine {
  /**
   * Compares expected metrics against actual outcomes and computes prediction errors.
   */
  public evaluateExpectedVsRealized(
    tradeOutcome: TradeOutcome,
    candidate?: CanonicalStrategyCandidate,
    decision?: PortfolioDecision,
    intent?: ExecutionIntent
  ): PredictionError {
    const entryPrice = tradeOutcome.entryPrice || 1000;
    const targetPrice = candidate?.targetPrice || entryPrice * 1.05;
    const stopLoss = candidate?.stopLossPrice || entryPrice * 0.97;

    const expectedReturnPct = candidate?.expectedValue.expectedReturnPct || ((targetPrice - entryPrice) / entryPrice) * 100;
    const targetProbPct = candidate?.expectedValue.targetProbabilityPct || 65;
    const rewardToRisk = candidate?.expectedValue.rewardToRiskRatio || 2.0;
    const expectedMFEPct = candidate?.backtestMetrics.mfeMedianPct || 3.5;
    const expectedMAEPct = candidate?.backtestMetrics.maeMedianPct || -1.2;
    const expectedHoldingPeriodMinutes = candidate?.holdingPeriodMinutes || 1440;
    const expectedSlippagePct = candidate?.riskProfile.slippageEstimatePct || 0.10;
    const expectedExecutionQuality = 'EXCELLENT';
    const expectedStressLossINR = decision?.stressImpactLossINR || -25000;

    // Realized Metrics
    const realizedReturnPct = tradeOutcome.realizedReturnPct;
    const isWin = tradeOutcome.isWin;
    const realizedRMultiple = tradeOutcome.realizedRMultiple;
    const realizedMFEPct = tradeOutcome.maxFavorableExcursionPct;
    const realizedMAEPct = tradeOutcome.maxAdverseExcursionPct;
    const realizedHoldingPeriodMinutes = tradeOutcome.holdingPeriodMinutes;
    const realizedSlippagePct = tradeOutcome.slippageCostINR > 0
      ? (tradeOutcome.slippageCostINR / (tradeOutcome.quantity * entryPrice)) * 100
      : 0.05;
    const realizedExecutionQuality = realizedSlippagePct <= 0.15 ? 'EXCELLENT' : realizedSlippagePct <= 0.35 ? 'ACCEPTABLE' : 'POOR';
    const realizedStressLossINR = isWin ? 0 : tradeOutcome.netPnLINR;

    // Deltas & Errors
    const returnErrorPct = Number((realizedReturnPct - expectedReturnPct).toFixed(2));
    const mfeErrorPct = Number((realizedMFEPct - expectedMFEPct).toFixed(2));
    const maeErrorPct = Number((realizedMAEPct - expectedMAEPct).toFixed(2));
    const holdingPeriodErrorMinutes = realizedHoldingPeriodMinutes - expectedHoldingPeriodMinutes;
    const slippageErrorPct = Number((realizedSlippagePct - expectedSlippagePct).toFixed(2));

    // Brier / Calibration score calculation:
    // Expected prob (0..1) vs actual binary outcome (1 if win, 0 if loss)
    const expectedProbDecimal = targetProbPct / 100;
    const actualOutcomeDecimal = isWin ? 1 : 0;
    const calibrationError = Number(Math.pow(expectedProbDecimal - actualOutcomeDecimal, 2).toFixed(4));

    return {
      errorId: `err-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      lineage: tradeOutcome.lineage,
      symbol: tradeOutcome.symbol,
      expected: {
        expectedReturnPct,
        targetProbabilityPct: targetProbPct,
        rewardToRiskRatio: rewardToRisk,
        expectedMFEPct,
        expectedMAEPct,
        expectedHoldingPeriodMinutes,
        expectedSlippagePct,
        expectedExecutionQuality,
        expectedStressLossINR
      },
      realized: {
        realizedReturnPct,
        isWin,
        realizedRMultiple,
        realizedMFEPct,
        realizedMAEPct,
        realizedHoldingPeriodMinutes,
        realizedSlippagePct,
        realizedExecutionQuality,
        realizedStressLossINR
      },
      deltas: {
        returnErrorPct,
        mfeErrorPct,
        maeErrorPct,
        holdingPeriodErrorMinutes,
        slippageErrorPct,
        calibrationError
      },
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const expectedVsRealizedEngine = new ExpectedVsRealizedEngine();
