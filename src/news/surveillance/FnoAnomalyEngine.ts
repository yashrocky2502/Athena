/**
 * ATHENA — Phase 18 Open Interest / F&O Surveillance
 * FnoAnomalyEngine.ts
 */

import { FnoMetrics } from './types.ts';

export class FnoAnomalyEngine {
  private static instance: FnoAnomalyEngine;

  private constructor() {}

  public static getInstance(): FnoAnomalyEngine {
    if (!FnoAnomalyEngine.instance) {
      FnoAnomalyEngine.instance = new FnoAnomalyEngine();
    }
    return FnoAnomalyEngine.instance;
  }

  /**
   * Evaluates Open Interest and Futures/Options pricing.
   * Standard definitions of F&O Buildup:
   * - Long Buildup: Price UP, OI UP
   * - Short Buildup: Price DOWN, OI UP
   * - Long Unwinding: Price DOWN, OI DOWN
   * - Short Covering: Price UP, OI DOWN
   */
  public analyze(
    priceChangePct: number,
    currentOi: number,
    prevOi: number,
    futuresBasis: number, // Premium or discount relative to Spot
    futuresVolumeRatio: number = 1.0
  ): { metrics: FnoMetrics; score: number } {
    const oiChangePct = prevOi > 0 ? ((currentOi - prevOi) / prevOi) * 100 : 0;
    const oiChangeVelocity = oiChangePct; // Rate of change in unit window

    let longShortClassification: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_COVERING' | 'NEUTRAL' | 'CONFLICTED' = 'NEUTRAL';

    const materialOiChange = Math.abs(oiChangePct) > 1.5;
    const materialPriceChange = Math.abs(priceChangePct) > 0.4;

    if (materialOiChange && materialPriceChange) {
      if (priceChangePct > 0 && oiChangePct > 0) {
        longShortClassification = 'LONG_BUILDUP';
      } else if (priceChangePct < 0 && oiChangePct > 0) {
        longShortClassification = 'SHORT_BUILDUP';
      } else if (priceChangePct < 0 && oiChangePct < 0) {
        longShortClassification = 'LONG_UNWINDING';
      } else if (priceChangePct > 0 && oiChangePct < 0) {
        longShortClassification = 'SHORT_COVERING';
      }
    } else if (materialOiChange && !materialPriceChange) {
      longShortClassification = 'CONFLICTED';
    }

    // Scoring (0-100) based on OI buildup and futures premium strength
    let score = 0;
    score += Math.min(Math.abs(oiChangePct) * 12, 50); // Max 50 from OI change velocity
    score += Math.min(Math.abs(futuresBasis) * 10, 20); // Max 20 from premium/discount magnitude
    if (longShortClassification === 'LONG_BUILDUP' || longShortClassification === 'SHORT_BUILDUP') {
      score += 30; // Max 30 from clear buildup states
    } else if (longShortClassification === 'SHORT_COVERING' || longShortClassification === 'LONG_UNWINDING') {
      score += 15;
    }

    return {
      metrics: {
        openInterest: currentOi,
        oiChangePct,
        oiChangeVelocity,
        futuresBasis,
        longShortClassification,
        futuresVolumeRatio,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
    };
  }
}
export const fnoAnomalyEngine = FnoAnomalyEngine.getInstance();
