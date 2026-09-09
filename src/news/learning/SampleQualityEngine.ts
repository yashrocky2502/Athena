/**
 * ATHENA NEWS ENGINE — PHASE 15
 * SampleQualityEngine.ts
 * 
 * Classifies sample evidence quality into VERY_LOW, LOW, MODERATE, GOOD, or STRONG
 * based on sample count, outcome variance, and confidence interval width.
 * Provides deterministic discount factors for adaptive scoring.
 */

export class SampleQualityEngine {
  /**
   * Classifies evidence quality based on sample count and CI width.
   */
  public static evaluateSampleQuality(
    sampleCount: number,
    ci95?: [number, number]
  ): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'GOOD' | 'STRONG' {
    const ciWidth = ci95 ? ci95[1] - ci95[0] : 0;

    if (sampleCount < 10 || ciWidth > 40) return 'VERY_LOW';
    if (sampleCount < 25 || ciWidth > 25) return 'LOW';
    if (sampleCount < 50 || ciWidth > 15) return 'MODERATE';
    if (sampleCount < 100 || ciWidth > 8) return 'GOOD';
    return 'STRONG';
  }

  /**
   * Returns score discount multiplier based on sample quality level.
   */
  public static getDiscountMultiplier(
    quality: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'GOOD' | 'STRONG'
  ): number {
    switch (quality) {
      case 'VERY_LOW': return 0.40;
      case 'LOW': return 0.65;
      case 'MODERATE': return 0.85;
      case 'GOOD': return 0.95;
      case 'STRONG': return 1.00;
    }
  }
}
