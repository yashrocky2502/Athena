/**
 * ATHENA — Phase 18 Scoring Engine
 * SurveillanceScoringEngine.ts
 */

import { ComponentAnomalyScores } from './types.ts';

export class SurveillanceScoringEngine {
  private static instance: SurveillanceScoringEngine;

  private constructor() {}

  public static getInstance(): SurveillanceScoringEngine {
    if (!SurveillanceScoringEngine.instance) {
      SurveillanceScoringEngine.instance = new SurveillanceScoringEngine();
    }
    return SurveillanceScoringEngine.instance;
  }

  /**
   * Translates score to categories:
   * 0–20 NORMAL
   * 21–40 ELEVATED
   * 41–60 UNUSUAL
   * 61–80 HIGH
   * 81–100 EXTREME
   */
  public getClassification(score: number): 'NORMAL' | 'ELEVATED' | 'UNUSUAL' | 'HIGH' | 'EXTREME' {
    if (score >= 81) return 'EXTREME';
    if (score >= 61) return 'HIGH';
    if (score >= 41) return 'UNUSUAL';
    if (score >= 21) return 'ELEVATED';
    return 'NORMAL';
  }

  /**
   * Combines individual components into a composite scoring dictionary.
   */
  public computeComposite(
    priceScore: number,
    volumeScore: number,
    oiScore: number,
    volatilityScore: number,
    sectorScore: number,
    newsScore: number
  ): ComponentAnomalyScores {
    // Formula weight: 30% Price, 20% Volume, 15% OI, 15% Volatility, 10% Sector, 10% News
    const finalScore = Math.min(
      Math.max(
        Math.round(
          priceScore * 0.3 +
          volumeScore * 0.2 +
          oiScore * 0.15 +
          volatilityScore * 0.15 +
          sectorScore * 0.1 +
          newsScore * 0.1
        ),
        0
      ),
      100
    );

    return {
      priceScore,
      volumeScore,
      oiScore,
      volatilityScore,
      sectorScore,
      newsScore,
      finalScore,
    };
  }
}
export const surveillanceScoringEngine = SurveillanceScoringEngine.getInstance();
