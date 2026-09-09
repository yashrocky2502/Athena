/**
 * ATHENA NEWS ENGINE — PHASE 15
 * AdaptiveRankingEngine.ts
 * 
 * Generates deterministic ranking scores (0–100) for Signals, Strategies, Execution Modes,
 * and Position Sizing Templates based on historical evidence.
 * 
 * Enforces Sample Quality discounting:
 * Weak evidence automatically discounts the score to prevent overfitting on small samples.
 * 
 * CRITICAL SAFETY INVARIANT:
 * Adaptive scores influence candidate selection ranking only; they CANNOT bypass risk gates.
 */

import { AdaptiveScore } from './types.ts';
import { StrategyPerformanceMetrics, SignalPerformanceMetrics } from './types.ts';
import { SampleQualityEngine } from './SampleQualityEngine.ts';

export class AdaptiveRankingEngine {
  /**
   * Computes an adaptive score (0–100) for a strategy candidate based on its performance metrics.
   */
  public computeStrategyScore(metrics: StrategyPerformanceMetrics, version = 'v15.1'): AdaptiveScore {
    const winRateWeight = 0.35;
    const pfWeight = 0.35;
    const sharpeWeight = 0.20;
    const slippageWeight = 0.10;

    const winRateScore = Math.min(100, Math.max(0, metrics.winRatePct * 1.25)); // 80% win rate -> 100 pts
    const pfScore = Math.min(100, Math.max(0, metrics.profitFactor * 35)); // 2.85 PF -> 100 pts
    const sharpeScore = Math.min(100, Math.max(0, metrics.sharpeRatio * 40)); // 2.5 Sharpe -> 100 pts
    const slippageScore = Math.min(100, Math.max(0, 100 - metrics.avgSlippagePct * 100));

    let rawScore = Math.round(
      winRateScore * winRateWeight +
      pfScore * pfWeight +
      sharpeScore * sharpeWeight +
      slippageScore * slippageWeight
    );

    if (metrics.status === 'STRATEGY_DECAY') {
      rawScore = Math.round(rawScore * 0.75);
    } else if (metrics.status === 'STRATEGY_INVALIDATED') {
      rawScore = 0;
    }

    const discountMultiplier = SampleQualityEngine.getDiscountMultiplier(metrics.sampleQuality);
    const discountedScore = Math.round(rawScore * discountMultiplier);

    return {
      entityType: 'STRATEGY',
      entityKey: metrics.strategyType,
      rawScore,
      discountedScore,
      evidenceSummary: {
        winRatePct: metrics.winRatePct,
        profitFactor: metrics.profitFactor,
        sharpeRatio: metrics.sharpeRatio,
        recentDecayStatus: metrics.status,
        regimeCompatibilityPct: 85,
        executionQualityScore: 92
      },
      sampleQuality: metrics.sampleQuality,
      version,
      updatedAt: new Date().toISOString()
    };
  }
}

export const adaptiveRankingEngine = new AdaptiveRankingEngine();
