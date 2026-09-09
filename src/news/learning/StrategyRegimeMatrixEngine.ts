/**
 * ATHENA NEWS ENGINE — PHASE 16
 * StrategyRegimeMatrixEngine.ts
 * 
 * Strategy-Regime Performance Matrix Engine.
 * Evaluates strategy metrics segmented by market regime, calculating performance,
 * risk metrics, and statistical confidence intervals, enforcing sample-size checks.
 */

import { StrategyType } from '../quant/types.ts';
import { DiscoveryRegimeType } from './MarketRegimeDiscoveryEngine.ts';
import { BootstrappedConfidenceEngine } from './BootstrappedConfidenceEngine.ts';

export interface RegimePerformanceStats {
  strategy: StrategyType;
  regime: DiscoveryRegimeType;
  winRatePct: number;
  expectancy: number;            // Net return multiplier or expectation
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgMfePct: number;
  avgMaePct: number;
  maxDrawdownPct: number;
  sampleSize: number;
  confidenceInterval95: [number, number];
  isStatisticallyReliable: boolean;
}

export class StrategyRegimeMatrixEngine {
  private static matrixStore: Map<string, { wins: boolean[]; returns: number[]; mfes: number[]; maes: number[] }> = new Map();

  /**
   * Records a historical or simulated trade outcome for a strategy under a specific regime
   */
  public static recordTradeOutcome(
    strategy: StrategyType,
    regime: DiscoveryRegimeType,
    isWin: boolean,
    netReturnPct: number,
    mfePct: number,
    maePct: number
  ): void {
    const key = `${strategy}::${regime}`;
    if (!this.matrixStore.has(key)) {
      this.matrixStore.set(key, { wins: [], returns: [], mfes: [], maes: [] });
    }
    const store = this.matrixStore.get(key)!;
    store.wins.push(isWin);
    store.returns.push(netReturnPct);
    store.mfes.push(mfePct);
    store.maes.push(maePct);
  }

  /**
   * Evaluate stats for a strategy × regime combination
   */
  public static evaluateStats(strategy: StrategyType, regime: DiscoveryRegimeType): RegimePerformanceStats {
    const key = `${strategy}::${regime}`;
    const store = this.matrixStore.get(key) || { wins: [], returns: [], mfes: [], maes: [] };
    const sampleSize = store.wins.length;

    if (sampleSize === 0) {
      return {
        strategy,
        regime,
        winRatePct: 0,
        expectancy: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        avgMfePct: 0,
        avgMaePct: 0,
        maxDrawdownPct: 0,
        sampleSize: 0,
        confidenceInterval95: [0, 0],
        isStatisticallyReliable: false,
      };
    }

    const winsCount = store.wins.filter(w => w).length;
    const winRatePct = Number(((winsCount / sampleSize) * 100).toFixed(2));

    // Expectancy
    const sumReturn = store.returns.reduce((acc, r) => acc + r, 0);
    const expectancy = Number((sumReturn / sampleSize).toFixed(3));

    // Profit Factor
    const gains = store.returns.filter(r => r > 0).reduce((acc, r) => acc + r, 0);
    const losses = Math.abs(store.returns.filter(r => r < 0).reduce((acc, r) => acc + r, 0));
    const profitFactor = losses === 0 ? (gains > 0 ? 99.0 : 1.0) : Number((gains / losses).toFixed(2));

    // Sharpe and Sortino (simple statistical standard dev approximations)
    const avgReturn = sumReturn / sampleSize;
    const variance = store.returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / sampleSize;
    const stdDev = Math.sqrt(variance) || 0.01;
    const sharpeRatio = Number((avgReturn / stdDev).toFixed(2));

    const downReturns = store.returns.filter(r => r < 0);
    const downVariance = downReturns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / (downReturns.length || 1);
    const downsideStdDev = Math.sqrt(downVariance) || 0.01;
    const sortinoRatio = Number((avgReturn / downsideStdDev).toFixed(2));

    const avgMfePct = Number((store.mfes.reduce((acc, m) => acc + m, 0) / sampleSize).toFixed(2));
    const avgMaePct = Number((store.maes.reduce((acc, m) => acc + m, 0) / sampleSize).toFixed(2));

    // Drawdown
    let peak = 0;
    let maxDd = 0;
    let balance = 100;
    for (const ret of store.returns) {
      balance = balance * (1 + ret / 100);
      if (balance > peak) peak = balance;
      const dd = peak === 0 ? 0 : ((peak - balance) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }

    // Bootstrap confidence interval for Win Rate
    const confidenceInterval95 = BootstrappedConfidenceEngine.computeWinRateCI95(store.wins, 500);

    // Minimum sample size is 10 for statistical reliability
    const isStatisticallyReliable = sampleSize >= 10;

    return {
      strategy,
      regime,
      winRatePct,
      expectancy,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      avgMfePct,
      avgMaePct,
      maxDrawdownPct: Number(maxDd.toFixed(2)),
      sampleSize,
      confidenceInterval95,
      isStatisticallyReliable,
    };
  }

  public static clear(): void {
    this.matrixStore.clear();
  }

  /**
   * Pre-seed mock data for standard combinations to look high fidelity instantly
   */
  public static seedMockData(): void {
    // Seed standard strategies across regimes
    const regimes: DiscoveryRegimeType[] = ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGE_BOUND', 'HIGH_VOLATILITY'];
    const strategies: StrategyType[] = ['EQUITY_MOMENTUM_CONTINUATION', 'OPTION_BULL_CALL_SPREAD', 'FUTURES_BREAKOUT'];

    for (const strat of strategies) {
      for (const reg of regimes) {
        // High success for Breakouts in trending bull, but low in range bound
        let winChance = 0.5;
        let avgReturn = 0.2;
        if (strat === 'FUTURES_BREAKOUT' && reg === 'TRENDING_BULL') { winChance = 0.72; avgReturn = 2.5; }
        else if (strat === 'FUTURES_BREAKOUT' && reg === 'RANGE_BOUND') { winChance = 0.38; avgReturn = -1.2; }
        else if (strat === 'OPTION_BULL_CALL_SPREAD' && reg === 'TRENDING_BULL') { winChance = 0.68; avgReturn = 3.1; }
        else if (strat === 'EQUITY_MOMENTUM_CONTINUATION' && reg === 'TRENDING_BEAR') { winChance = 0.35; avgReturn = -1.5; }

        for (let i = 0; i < 15; i++) {
          const isWin = Math.random() < winChance;
          const ret = isWin ? (Math.random() * 4 + avgReturn) : (-Math.random() * 3 + avgReturn - 1);
          this.recordTradeOutcome(
            strat,
            reg,
            isWin,
            ret,
            isWin ? ret + 0.5 : 0.1,
            isWin ? -0.2 : ret - 0.2
          );
        }
      }
    }
  }
}
