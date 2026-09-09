/**
 * ATHENA NEWS ENGINE — PHASE 15
 * EdgeDecayEngine.ts
 * 
 * Detects edge degradation by comparing rolling window performance against
 * historical expanding baseline.
 * 
 * Classifies decay states:
 * - HEALTHY: Rolling performance aligns with or exceeds historical baseline
 * - WATCH: Minor drop (<10% win rate or PF drop)
 * - DECAYING: Significant drop (10-25% drop in win rate / PF)
 * - SEVERE_DECAY: Sharp drop (>25% drop or negative expectancy)
 * - INSUFFICIENT_DATA: < 10 trades
 */

import { EdgeDecayReport, DecayStatus, TradeOutcome } from './types.ts';

export class EdgeDecayEngine {
  /**
   * Evaluates rolling vs expanding performance for an entity (strategy / signal).
   */
  public evaluateEdgeDecay(
    entityKey: string,
    allTrades: TradeOutcome[],
    rollingWindowSize = 30
  ): EdgeDecayReport {
    const totalTrades = allTrades.length;

    if (totalTrades < 10) {
      return {
        entityKey,
        decayStatus: 'INSUFFICIENT_DATA',
        rolling30WinRatePct: 0,
        expandingWinRatePct: 0,
        winRateDeltaPct: 0,
        rolling30ProfitFactor: 0,
        expandingProfitFactor: 0,
        mfeToMaeRatio: 1.0,
        reason: 'Fewer than 10 trades available for decay analysis',
        evaluatedAt: new Date().toISOString()
      };
    }

    // Expanding baseline
    const expandingWins = allTrades.filter(t => t.isWin).length;
    const expandingWinRatePct = Number(((expandingWins / totalTrades) * 100).toFixed(2));

    const grossGainsExpanding = allTrades.filter(t => t.netPnLINR > 0).reduce((s, t) => s + t.netPnLINR, 0);
    const grossLossesExpanding = Math.abs(allTrades.filter(t => t.netPnLINR < 0).reduce((s, t) => s + t.netPnLINR, 0));
    const expandingProfitFactor = grossLossesExpanding > 0 ? Number((grossGainsExpanding / grossLossesExpanding).toFixed(2)) : 99.0;

    // Rolling window
    const rollingTrades = allTrades.slice(-rollingWindowSize);
    const rollingCount = rollingTrades.length;
    const rollingWins = rollingTrades.filter(t => t.isWin).length;
    const rolling30WinRatePct = Number(((rollingWins / rollingCount) * 100).toFixed(2));

    const grossGainsRolling = rollingTrades.filter(t => t.netPnLINR > 0).reduce((s, t) => s + t.netPnLINR, 0);
    const grossLossesRolling = Math.abs(rollingTrades.filter(t => t.netPnLINR < 0).reduce((s, t) => s + t.netPnLINR, 0));
    const rolling30ProfitFactor = grossLossesRolling > 0 ? Number((grossGainsRolling / grossLossesRolling).toFixed(2)) : 99.0;

    const winRateDeltaPct = Number((rolling30WinRatePct - expandingWinRatePct).toFixed(2));

    const avgMFE = rollingTrades.reduce((s, t) => s + t.maxFavorableExcursionPct, 0) / rollingCount;
    const avgMAE = Math.abs(rollingTrades.reduce((s, t) => s + t.maxAdverseExcursionPct, 0) / rollingCount) || 0.1;
    const mfeToMaeRatio = Number((avgMFE / avgMAE).toFixed(2));

    let decayStatus: DecayStatus = 'HEALTHY';
    let reason = 'Rolling window performance matches expanding historical baseline';

    if (winRateDeltaPct < -20 || rolling30ProfitFactor < 0.9) {
      decayStatus = 'SEVERE_DECAY';
      reason = `Rolling win rate declined by ${Math.abs(winRateDeltaPct)}% with PF at ${rolling30ProfitFactor}`;
    } else if (winRateDeltaPct < -10 || rolling30ProfitFactor < 1.2) {
      decayStatus = 'DECAYING';
      reason = `Rolling win rate declined by ${Math.abs(winRateDeltaPct)}% compared to baseline`;
    } else if (winRateDeltaPct < -5) {
      decayStatus = 'WATCH';
      reason = 'Minor negative deviation in rolling win rate';
    }

    return {
      entityKey,
      decayStatus,
      rolling30WinRatePct,
      expandingWinRatePct,
      winRateDeltaPct,
      rolling30ProfitFactor,
      expandingProfitFactor,
      mfeToMaeRatio,
      reason,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const edgeDecayEngine = new EdgeDecayEngine();
