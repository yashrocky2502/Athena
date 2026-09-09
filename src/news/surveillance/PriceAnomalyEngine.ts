/**
 * ATHENA — Phase 18 Price Anomaly Engine
 * PriceAnomalyEngine.ts
 */

import { PriceMetrics } from './types.ts';

export class PriceAnomalyEngine {
  private static instance: PriceAnomalyEngine;

  private constructor() {}

  public static getInstance(): PriceAnomalyEngine {
    if (!PriceAnomalyEngine.instance) {
      PriceAnomalyEngine.instance = new PriceAnomalyEngine();
    }
    return PriceAnomalyEngine.instance;
  }

  /**
   * Evaluates price anomaly based on history of prices.
   * To prevent look-ahead bias, it accepts historic dataset up to current index.
   */
  public analyze(
    prices: number[],
    openPrice: number,
    prevClose: number,
    atr: number = 1.2
  ): { metrics: PriceMetrics; score: number } {
    if (prices.length < 2) {
      return {
        metrics: {
          lastPrice: prices[0] || openPrice,
          openPrice,
          prevClose,
          percentageChange: 0,
          zScore: 0,
          atrNormalizedDisplacement: 0,
          vwapDisplacementPct: 0,
          isBreakout: false,
          isBreakdown: false,
          gapPct: 0,
        },
        score: 0,
      };
    }

    const lastPrice = prices[prices.length - 1];
    const percentageChange = ((lastPrice - prevClose) / prevClose) * 100;
    const gapPct = ((openPrice - prevClose) / prevClose) * 100;

    // Rolling stats
    const mean = prices.reduce((acc, p) => acc + p, 0) / prices.length;
    const variance = prices.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance) || 0.01;
    const zScore = (lastPrice - mean) / stdDev;

    // ATR normalized displacement
    const firstPriceInWindow = prices[0];
    const rawDisplacement = Math.abs(lastPrice - firstPriceInWindow);
    const atrNormalizedDisplacement = atr > 0 ? rawDisplacement / atr : 0;

    // VWAP displacement (Simplified: mock or proxy index-weighted price)
    const mockVwap = mean * 1.002; // Close proximity proxy
    const vwapDisplacementPct = ((lastPrice - mockVwap) / mockVwap) * 100;

    // Breakouts
    const windowMax = Math.max(...prices.slice(0, prices.length - 1));
    const windowMin = Math.min(...prices.slice(0, prices.length - 1));
    const isBreakout = lastPrice > windowMax && percentageChange > 1.5;
    const isBreakdown = lastPrice < windowMin && percentageChange < -1.5;

    // Deterministic Score Calculation (0-100)
    let score = 0;
    score += Math.min(Math.abs(zScore) * 15, 30); // Max 30 from Z-Score
    score += Math.min(Math.abs(percentageChange) * 10, 30); // Max 30 from magnitude
    score += Math.min(atrNormalizedDisplacement * 10, 20); // Max 20 from ATR normal
    score += isBreakout || isBreakdown ? 20 : 0; // Max 20 from Breakout/Breakdown trigger

    return {
      metrics: {
        lastPrice,
        openPrice,
        prevClose,
        percentageChange,
        zScore,
        atrNormalizedDisplacement,
        vwapDisplacementPct,
        isBreakout,
        isBreakdown,
        gapPct,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
    };
  }
}
export const priceAnomalyEngine = PriceAnomalyEngine.getInstance();
