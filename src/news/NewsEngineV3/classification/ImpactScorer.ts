/**
 * ATHENA NEWS ENGINE V3 — IMPACT SCORER
 * 
 * Computes deterministic market impact levels (VERY_HIGH, HIGH, MEDIUM, LOW, VERY_LOW)
 * based on event categories, market cap scale, and financial magnitude.
 */

import { ClassificationCategory, MarketImpactScore, MarketCapBucket } from './types/ClassificationTypes';

export class ImpactScorer {
  /**
   * Computes market impact score.
   */
  public static calculateImpact(
    categories: ClassificationCategory[],
    marketCapBucket?: MarketCapBucket
  ): MarketImpactScore {
    // 1. High impact categories
    const isVeryHighCategory = categories.some(c =>
      ['RBI_POLICY', 'SEBI_ACTION', 'GDP', 'CPI', 'BLOCK_DEAL', 'MERGER'].includes(c)
    );

    const isHighCategory = categories.some(c =>
      ['QUARTERLY_RESULTS', 'DIVIDEND', 'BUYBACK', 'IPO', 'ORDER_WIN', 'CEO_CHANGE', 'RESULT_REACTION'].includes(c)
    );

    const isMediumCategory = categories.some(c =>
      ['BROKER_REPORT', 'BOARD_MEETING', 'MANAGEMENT_CHANGE', 'CAPEX', 'RESULT_PREVIEW', 'BONUS', 'SPLIT'].includes(c)
    );

    if (isVeryHighCategory) {
      return marketCapBucket === 'LARGE_CAP' || !marketCapBucket ? 'VERY_HIGH' : 'HIGH';
    }

    if (isHighCategory) {
      if (marketCapBucket === 'LARGE_CAP') return 'HIGH';
      if (marketCapBucket === 'MID_CAP') return 'HIGH';
      return 'MEDIUM';
    }

    if (isMediumCategory) {
      return 'MEDIUM';
    }

    if (categories.includes('GENERAL_MARKET') || categories.includes('UNKNOWN')) {
      return 'VERY_LOW';
    }

    return 'LOW';
  }
}
