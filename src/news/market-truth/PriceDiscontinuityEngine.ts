/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * PriceDiscontinuityEngine.ts
 * 
 * Deterministic price jump and discontinuity classifier.
 * Distinguishes genuine high-volatility market shocks from corrupted bad-tick spikes.
 * ZERO-AI: Statistical dispersion and threshold math.
 */

import { DiscontinuityClassification, CorporateActionStatus } from './types.ts';

export interface DiscontinuityAnalysis {
  classification: DiscontinuityClassification;
  priceDelta: number;
  priceDeltaPercent: number;
  atrMultiple: number;
  zScore: number;
  isConfirmedByVolume: boolean;
  confidence: number;
  reason: string;
}

export class PriceDiscontinuityEngine {
  private static instance: PriceDiscontinuityEngine;

  private constructor() {}

  public static getInstance(): PriceDiscontinuityEngine {
    if (!PriceDiscontinuityEngine.instance) {
      PriceDiscontinuityEngine.instance = new PriceDiscontinuityEngine();
    }
    return PriceDiscontinuityEngine.instance;
  }

  /**
   * Analyzes price jump between latest price and prior price / series.
   */
  public analyzeDiscontinuity(params: {
    currentPrice: number;
    previousPrice: number;
    historicalPrices?: number[];
    atr?: number;
    volume?: number;
    averageVolume?: number;
    corporateActionStatus?: CorporateActionStatus;
  }): DiscontinuityAnalysis {
    const { currentPrice, previousPrice, historicalPrices, atr, volume, averageVolume, corporateActionStatus } = params;

    if (previousPrice <= 0 || currentPrice <= 0) {
      return {
        classification: 'INVALID_MOVE',
        priceDelta: 0,
        priceDeltaPercent: 0,
        atrMultiple: 0,
        zScore: 0,
        isConfirmedByVolume: false,
        confidence: 100,
        reason: 'Invalid non-positive price observed'
      };
    }

    const priceDelta = currentPrice - previousPrice;
    const priceDeltaPercent = ((priceDelta) / previousPrice) * 100;
    const absPercent = Math.abs(priceDeltaPercent);

    // If corporate action is known/adjusted, suppress false discontinuity
    if (corporateActionStatus === 'ADJUSTED') {
      return {
        classification: 'NORMAL_MOVE',
        priceDelta,
        priceDeltaPercent,
        atrMultiple: 0,
        zScore: 0,
        isConfirmedByVolume: true,
        confidence: 95,
        reason: 'Price shift attributed to verified corporate action adjustment'
      };
    }

    // Calculate ATR multiple if ATR is available
    const effectiveAtr = atr && atr > 0 ? atr : (previousPrice * 0.015); // Fallback 1.5% ATR
    const atrMultiple = Math.abs(priceDelta) / effectiveAtr;

    // Calculate Z-Score if historical prices provided
    let zScore = 0;
    if (historicalPrices && historicalPrices.length >= 5) {
      const mean = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
      const variance = historicalPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / historicalPrices.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        zScore = (currentPrice - mean) / stdDev;
      }
    }

    const rvol = (volume && averageVolume && averageVolume > 0) ? volume / averageVolume : 1.0;
    const isConfirmedByVolume = rvol >= 1.5;

    let classification: DiscontinuityClassification = 'NORMAL_MOVE';
    let reason = 'Price movement within expected distribution';

    if (absPercent >= 30 && !isConfirmedByVolume && atrMultiple > 10) {
      // Absurd 30%+ single-tick jump with zero volume confirmation is almost certainly an invalid bad tick
      classification = 'INVALID_MOVE';
      reason = `Extreme impossible jump of ${priceDeltaPercent.toFixed(1)}% without volume confirmation`;
    } else if (absPercent >= 10 || atrMultiple >= 6 || Math.abs(zScore) >= 4) {
      if (isConfirmedByVolume) {
        classification = 'EXTREME_SHOCK';
        reason = `High-volume extreme market shock (${priceDeltaPercent.toFixed(1)}%, RVOL: ${rvol.toFixed(1)}x)`;
      } else {
        classification = 'ANOMALOUS_MOVE';
        reason = `Suspicious price displacement (${priceDeltaPercent.toFixed(1)}%) without volume confirmation`;
      }
    } else if (absPercent >= 4 || atrMultiple >= 3 || Math.abs(zScore) >= 2.5) {
      classification = 'LARGE_MOVE';
      reason = `Material price movement (${priceDeltaPercent.toFixed(1)}%, ATR mult: ${atrMultiple.toFixed(1)})`;
    }

    return {
      classification,
      priceDelta: Number(priceDelta.toFixed(2)),
      priceDeltaPercent: Number(priceDeltaPercent.toFixed(2)),
      atrMultiple: Number(atrMultiple.toFixed(2)),
      zScore: Number(zScore.toFixed(2)),
      isConfirmedByVolume,
      confidence: 90,
      reason
    };
  }
}

export const priceDiscontinuityEngine = PriceDiscontinuityEngine.getInstance();
