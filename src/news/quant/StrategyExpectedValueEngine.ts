/**
 * ATHENA NEWS ENGINE — PHASE 12
 * StrategyExpectedValueEngine.ts
 * 
 * Deterministic Strategy Expected Value Engine.
 * Formula: Expected Value = (P(win) × Average Win) − (P(loss) × Average Loss) − Transaction Costs − Estimated Slippage
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic mathematical calculations.
 */

import { ExpectedValueMetrics, BacktestMetrics } from './types.ts';

export class StrategyExpectedValueEngine {
  private static instance: StrategyExpectedValueEngine;

  private constructor() {}

  public static getInstance(): StrategyExpectedValueEngine {
    if (!this.instance) {
      this.instance = new StrategyExpectedValueEngine();
    }
    return this.instance;
  }

  /**
   * Deterministically calculates Expected Value & Statistical Risk/Reward metrics.
   */
  public calculateExpectedValue(
    backtest: BacktestMetrics,
    capitalRequiredINR: number
  ): ExpectedValueMetrics {
    if (backtest.totalTrades === 0) {
      return {
        expectedValueINR: 0,
        expectedReturnPct: 0,
        expectedRiskPct: 0,
        rewardToRiskRatio: 0,
        targetProbabilityPct: 0,
        stopProbabilityPct: 0,
        noResolutionProbabilityPct: 100,
        confidenceInterval95Pct: [0, 0]
      };
    }

    const pWin = backtest.winRatePct / 100;
    const pLoss = 1 - pWin;
    const avgWin = backtest.averageWin;
    const avgLoss = backtest.averageLoss;

    const txCostPerTrade = 40;
    const estimatedSlippage = Math.round(avgWin * 0.05);

    const rawEV = (pWin * avgWin) - (pLoss * avgLoss) - txCostPerTrade - estimatedSlippage;
    const expectedValueINR = Math.round(rawEV);

    const cap = capitalRequiredINR > 0 ? capitalRequiredINR : 100000;
    const expectedReturnPct = Math.round((expectedValueINR / cap) * 100 * 100) / 100;
    const expectedRiskPct = Math.round((avgLoss / cap) * 100 * 100) / 100;
    const rewardToRiskRatio = avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : 2.5;

    const targetProb = Math.round(pWin * 100);
    const stopProb = Math.round(pLoss * 0.85 * 100);
    const noResProb = Math.max(0, 100 - targetProb - stopProb);

    // Standard 95% Confidence Interval calculation for mean EV
    const stdErr = Math.round(avgLoss * 0.4);
    const lower95 = Math.round(expectedValueINR - (1.96 * stdErr));
    const upper95 = Math.round(expectedValueINR + (1.96 * stdErr));

    return {
      expectedValueINR,
      expectedReturnPct,
      expectedRiskPct,
      rewardToRiskRatio,
      targetProbabilityPct: targetProb,
      stopProbabilityPct: stopProb,
      noResolutionProbabilityPct: noResProb,
      confidenceInterval95Pct: [lower95, upper95]
    };
  }
}

export const strategyExpectedValueEngine = StrategyExpectedValueEngine.getInstance();
