/**
 * ATHENA NEWS ENGINE — PHASE 16
 * StrategyDecayEngine.ts
 * 
 * Strategy Decay Engine.
 * Compares long-term historical performance of strategy candidates against recent rolling
 * performance to identify alpha decay, increased slippage, or structural regime mismatch.
 * 
 * Outputs states: HEALTHY, WATCH, DEGRADING, DEGRADED, RETIRED.
 */

import { StrategyType } from '../quant/types.ts';
import { TradeOutcome } from './types.ts';

export type DecayState = 'HEALTHY' | 'WATCH' | 'DEGRADING' | 'DEGRADED' | 'RETIRED';

export interface StrategyDecayReport {
  strategy: StrategyType;
  state: DecayState;
  score: number;                   // 0 to 100 (100 = completely healthy, < 40 = degraded/retired)
  metrics: {
    historicalWinRatePct: number;
    rollingWinRatePct: number;
    historicalExpectancy: number;
    rollingExpectancy: number;
    historicalProfitFactor: number;
    rollingProfitFactor: number;
    historicalMfe: number;
    rollingMfe: number;
    historicalMae: number;
    rollingMae: number;
    avgSlippagePct: number;
    regimeMismatchCount: number;
  };
  reason: string;
  evaluatedAt: string;
}

export class StrategyDecayEngine {
  private static strategyReports: Map<StrategyType, StrategyDecayReport> = new Map();

  /**
   * Evaluates rolling vs historical baseline trades for a given strategy
   */
  public static evaluateDecay(
    strategy: StrategyType,
    allTrades: TradeOutcome[],
    rollingSize = 15
  ): StrategyDecayReport {
    const totalCount = allTrades.length;

    if (totalCount < 10) {
      const defaultReport: StrategyDecayReport = {
        strategy,
        state: 'HEALTHY',
        score: 100,
        metrics: {
          historicalWinRatePct: 0,
          rollingWinRatePct: 0,
          historicalExpectancy: 0,
          rollingExpectancy: 0,
          historicalProfitFactor: 0,
          rollingProfitFactor: 0,
          historicalMfe: 0,
          rollingMfe: 0,
          historicalMae: 0,
          rollingMae: 0,
          avgSlippagePct: 0,
          regimeMismatchCount: 0,
        },
        reason: 'Insufficient trades to evaluate decay (minimum 10 required)',
        evaluatedAt: new Date().toISOString(),
      };
      this.strategyReports.set(strategy, defaultReport);
      return defaultReport;
    }

    // Historical Baseline
    const histWins = allTrades.filter(t => t.isWin).length;
    const historicalWinRatePct = (histWins / totalCount) * 100;
    const historicalExpectancy = allTrades.reduce((acc, t) => acc + t.realizedReturnPct, 0) / totalCount;
    const histGains = allTrades.filter(t => t.realizedReturnPct > 0).reduce((acc, t) => acc + t.realizedReturnPct, 0);
    const histLosses = Math.abs(allTrades.filter(t => t.realizedReturnPct < 0).reduce((acc, t) => acc + t.realizedReturnPct, 0));
    const historicalProfitFactor = histLosses === 0 ? 99 : histGains / histLosses;
    const historicalMfe = allTrades.reduce((acc, t) => acc + t.maxFavorableExcursionPct, 0) / totalCount;
    const historicalMae = allTrades.reduce((acc, t) => acc + Math.abs(t.maxAdverseExcursionPct), 0) / totalCount;

    // Recent Rolling Window
    const rollingTrades = allTrades.slice(-rollingSize);
    const rollingCount = rollingTrades.length;
    const rollingWins = rollingTrades.filter(t => t.isWin).length;
    const rollingWinRatePct = (rollingWins / rollingCount) * 100;
    const rollingExpectancy = rollingTrades.reduce((acc, t) => acc + t.realizedReturnPct, 0) / rollingCount;
    const rollGains = rollingTrades.filter(t => t.realizedReturnPct > 0).reduce((acc, t) => acc + t.realizedReturnPct, 0);
    const rollLosses = Math.abs(rollingTrades.filter(t => t.realizedReturnPct < 0).reduce((acc, t) => acc + t.realizedReturnPct, 0));
    const rollingProfitFactor = rollLosses === 0 ? 99 : rollGains / rollLosses;
    const rollingMfe = rollingTrades.reduce((acc, t) => acc + t.maxFavorableExcursionPct, 0) / rollingCount;
    const rollingMae = rollingTrades.reduce((acc, t) => acc + Math.abs(t.maxAdverseExcursionPct), 0) / rollingCount;

    // Slippage tracking
    const avgSlippagePct = rollingTrades.reduce((acc, t) => acc + (t.slippageCostINR / (t.quantity * t.entryPrice || 1)) * 100, 0) / rollingCount;

    // Calculate score (0-100) starting at 100
    let score = 100;

    // 1. Win rate deterioration
    const winRateDelta = rollingWinRatePct - historicalWinRatePct;
    if (winRateDelta < -20) score -= 35;
    else if (winRateDelta < -10) score -= 20;
    else if (winRateDelta < -5) score -= 10;

    // 2. Expectancy deterioration
    if (rollingExpectancy < 0) score -= 30;
    else if (rollingExpectancy < historicalExpectancy * 0.5) score -= 15;

    // 3. Profit factor decline
    if (rollingProfitFactor < 1.0) score -= 25;
    else if (rollingProfitFactor < historicalProfitFactor * 0.7) score -= 10;

    // 4. MFE contraction / MAE expansion
    if (rollingMfe < historicalMfe * 0.6) score -= 10;
    if (rollingMae > historicalMae * 1.4) score -= 10;

    // Cap score
    score = Math.max(0, score);

    // Map score to State
    let state: DecayState = 'HEALTHY';
    let reason = 'Strategy is performing within normal historical variance';

    if (score < 30) {
      state = 'RETIRED';
      reason = 'Critical decay score. Strategy expectancy is severely negative or non-viable';
    } else if (score < 50) {
      state = 'DEGRADED';
      reason = 'Severe performance degradation detected. Recommend suspending or paper-only trading';
    } else if (score < 70) {
      state = 'DEGRADING';
      reason = 'Significant performance drop. Expectancy and profit factors are shrinking';
    } else if (score < 85) {
      state = 'WATCH';
      reason = 'Minor performance drag. Broad market conditions might be shifting';
    }

    const report: StrategyDecayReport = {
      strategy,
      state,
      score,
      metrics: {
        historicalWinRatePct: Number(historicalWinRatePct.toFixed(2)),
        rollingWinRatePct: Number(rollingWinRatePct.toFixed(2)),
        historicalExpectancy: Number(historicalExpectancy.toFixed(3)),
        rollingExpectancy: Number(rollingExpectancy.toFixed(3)),
        historicalProfitFactor: Number(historicalProfitFactor.toFixed(2)),
        rollingProfitFactor: Number(rollingProfitFactor.toFixed(2)),
        historicalMfe: Number(historicalMfe.toFixed(2)),
        rollingMfe: Number(rollingMfe.toFixed(2)),
        historicalMae: Number(historicalMae.toFixed(2)),
        rollingMae: Number(rollingMae.toFixed(2)),
        avgSlippagePct: Number(avgSlippagePct.toFixed(3)),
        regimeMismatchCount: rollingTrades.filter(t => t.exitReason === 'KILL_SWITCH').length,
      },
      reason,
      evaluatedAt: new Date().toISOString(),
    };

    this.strategyReports.set(strategy, report);
    return report;
  }

  public static getReport(strategy: StrategyType): StrategyDecayReport | undefined {
    return this.strategyReports.get(strategy);
  }

  public static getAllReports(): StrategyDecayReport[] {
    return Array.from(this.strategyReports.values());
  }

  public static clear(): void {
    this.strategyReports.clear();
  }
}
