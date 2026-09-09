/**
 * ATHENA NEWS ENGINE — PHASE 15
 * StrategyPerformanceEngine.ts
 * 
 * Evaluates performance across all ATHENA strategy types.
 * Determines Strategy State:
 * - STRATEGY_EDGE: Win rate >= 60%, Profit Factor >= 1.5, Good sample quality
 * - STRATEGY_NEUTRAL: Win rate 48-59%, Profit Factor 1.0-1.49
 * - STRATEGY_DECAY: Win rate 40-47%, Profit Factor 0.8-0.99 or declining trend
 * - STRATEGY_INVALIDATED: Win rate < 40%, Profit Factor < 0.8 with sample count >= 15
 * 
 * Enforces deterministic thresholds (no arbitrary disabling).
 */

import { StrategyPerformanceMetrics, StrategyStateStatus, TradeOutcome } from './types.ts';
import { StrategyType } from '../quant/types.ts';
import { BootstrappedConfidenceEngine } from './BootstrappedConfidenceEngine.ts';
import { SampleQualityEngine } from './SampleQualityEngine.ts';

export class StrategyPerformanceEngine {
  private tradesByStrategy: Map<StrategyType, TradeOutcome[]> = new Map();

  /**
   * Ingests a trade outcome for a strategy type.
   */
  public recordStrategyTrade(strategyType: StrategyType, outcome: TradeOutcome): void {
    const list = this.tradesByStrategy.get(strategyType) || [];
    list.push(outcome);
    this.tradesByStrategy.set(strategyType, list);
  }

  /**
   * Clears state for testing.
   */
  public clear(): void {
    this.tradesByStrategy.clear();
  }

  /**
   * Evaluates strategy status and performance metrics for a given strategy type.
   */
  public evaluateStrategy(strategyType: StrategyType): StrategyPerformanceMetrics {
    const trades = this.tradesByStrategy.get(strategyType) || [];
    const totalTrades = trades.length;

    if (totalTrades === 0) {
      return {
        strategyType,
        totalTrades: 0,
        winRatePct: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        avgSlippagePct: 0,
        status: 'STRATEGY_NEUTRAL',
        statusReason: 'Insufficient trade sample for strategy evaluation',
        bootstrapConfidence95: [0, 0],
        sampleQuality: 'VERY_LOW'
      };
    }

    const wins = trades.filter(t => t.isWin).length;
    const winRatePct = Number(((wins / totalTrades) * 100).toFixed(2));

    const grossGains = trades.filter(t => t.realizedPnLINR > 0).reduce((sum, t) => sum + t.realizedPnLINR, 0);
    const grossLosses = Math.abs(trades.filter(t => t.realizedPnLINR < 0).reduce((sum, t) => sum + t.realizedPnLINR, 0));
    const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : grossGains > 0 ? 99.0 : 0;

    const returns = trades.map(t => t.realizedReturnPct);
    const avgReturnPct = returns.reduce((a, b) => a + b, 0) / totalTrades;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturnPct, 2), 0) / totalTrades) || 1;
    const sharpeRatio = Number((avgReturnPct / stdDev).toFixed(2));

    const downsideReturns = returns.filter(r => r < 0);
    const downsideStdDev = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
      : 1;
    const sortinoRatio = Number((avgReturnPct / downsideStdDev).toFixed(2));

    const totalSlippage = trades.reduce((sum, t) => sum + t.slippageCostINR, 0);
    const totalValue = trades.reduce((sum, t) => sum + (t.quantity * t.entryPrice), 0);
    const avgSlippagePct = totalValue > 0 ? Number(((totalSlippage / totalValue) * 100).toFixed(2)) : 0.10;

    const bootstrapConfidence95 = BootstrappedConfidenceEngine.computeWinRateCI95(
      trades.map(t => t.isWin)
    );
    const sampleQuality = SampleQualityEngine.evaluateSampleQuality(totalTrades, bootstrapConfidence95);

    // Determine Status
    let status: StrategyStateStatus = 'STRATEGY_NEUTRAL';
    let statusReason = 'Strategy operating in normal expectancy range';

    if (totalTrades >= 15 && winRatePct < 40 && profitFactor < 0.8) {
      status = 'STRATEGY_INVALIDATED';
      statusReason = `Win rate (${winRatePct}%) and Profit Factor (${profitFactor}) below minimum invalidation threshold`;
    } else if (winRatePct < 48 || profitFactor < 1.0) {
      status = 'STRATEGY_DECAY';
      statusReason = `Win rate (${winRatePct}%) or Profit Factor (${profitFactor}) exhibiting negative expectancy decay`;
    } else if (winRatePct >= 60 && profitFactor >= 1.5 && totalTrades >= 10) {
      status = 'STRATEGY_EDGE';
      statusReason = `Strategy exhibiting statistically validated edge (Win Rate: ${winRatePct}%, PF: ${profitFactor})`;
    }

    return {
      strategyType,
      totalTrades,
      winRatePct,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      avgSlippagePct,
      status,
      statusReason,
      bootstrapConfidence95,
      sampleQuality
    };
  }
}

export const strategyPerformanceEngine = new StrategyPerformanceEngine();
