/**
 * ATHENA — Phase 18 Volume & RVOL Engine
 * VolumeAnomalyEngine.ts
 */

import { VolumeMetrics } from './types.ts';

export class VolumeAnomalyEngine {
  private static instance: VolumeAnomalyEngine;

  private constructor() {}

  public static getInstance(): VolumeAnomalyEngine {
    if (!VolumeAnomalyEngine.instance) {
      VolumeAnomalyEngine.instance = new VolumeAnomalyEngine();
    }
    return VolumeAnomalyEngine.instance;
  }

  public analyze(
    volumes: number[],
    prices: number[]
  ): { metrics: VolumeMetrics; score: number; classification: 'NORMAL' | 'ELEVATED' | 'UNUSUAL' | 'EXTREME' } {
    if (volumes.length < 2) {
      return {
        metrics: {
          currentVolume: volumes[0] || 0,
          rollingAverageVolume: volumes[0] || 1,
          relativeVolume: 1.0,
          volumeZScore: 0,
          volumePercentile: 50,
          volumeAccelerationPct: 0,
          priceVolumeConfirmation: true,
        },
        score: 0,
        classification: 'NORMAL',
      };
    }

    const currentVolume = volumes[volumes.length - 1];
    const prevVolume = volumes[volumes.length - 2];

    const precedingVolumes = volumes.slice(0, volumes.length - 1);
    const mean = precedingVolumes.reduce((acc, v) => acc + v, 0) / precedingVolumes.length;
    const variance = precedingVolumes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / precedingVolumes.length;
    const stdDev = Math.sqrt(variance) || 1;

    const volumeZScore = (currentVolume - mean) / stdDev;
    const relativeVolume = currentVolume / (mean || 1); // RVOL compared to historical average

    // Volume percentile (Simplified ranking calculation based on historical records)
    const sorted = [...volumes].sort((a, b) => a - b);
    const index = sorted.indexOf(currentVolume);
    const volumePercentile = (index / volumes.length) * 100;

    const volumeAccelerationPct = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : 0;

    // Price-Volume Confirmation logic
    let priceVolumeConfirmation = true;
    if (prices.length >= 2) {
      const priceChange = prices[prices.length - 1] - prices[prices.length - 2];
      // Volume expansion with price movement confirms trend, volume with flat price is neutral/divergent
      priceVolumeConfirmation = (Math.abs(priceChange) > 0.05 && relativeVolume > 1.2);
    }

    // Classify
    let classification: 'NORMAL' | 'ELEVATED' | 'UNUSUAL' | 'EXTREME' = 'NORMAL';
    if (relativeVolume >= 4.0 || volumeZScore >= 3.0) {
      classification = 'EXTREME';
    } else if (relativeVolume >= 2.0 || volumeZScore >= 1.8) {
      classification = 'UNUSUAL';
    } else if (relativeVolume >= 1.3 || volumeZScore >= 1.0) {
      classification = 'ELEVATED';
    }

    // Score from 0 to 100
    let score = 0;
    score += Math.min(relativeVolume * 15, 45); // Max 45 from RVOL
    score += Math.min(Math.max(volumeZScore, 0) * 10, 25); // Max 25 from Z-score
    score += Math.min(volumePercentile * 0.2, 20); // Max 20 from Percentile ranking
    score += priceVolumeConfirmation ? 10 : 0; // Max 10 from confirmation status

    return {
      metrics: {
        currentVolume,
        rollingAverageVolume: mean,
        relativeVolume,
        volumeZScore,
        volumePercentile,
        volumeAccelerationPct,
        priceVolumeConfirmation,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
      classification,
    };
  }
}
export const volumeAnomalyEngine = VolumeAnomalyEngine.getInstance();
