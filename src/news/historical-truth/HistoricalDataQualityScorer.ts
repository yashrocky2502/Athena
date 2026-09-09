/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalDataQualityScorer.ts
 * 
 * Scores historical dataset quality (0–100) and assigns an actionable reliability rating.
 */

import { HistoricalDataQualityScore, HistoricalDataQualityRating } from './types.ts';

export class HistoricalDataQualityScorer {
  private static instance: HistoricalDataQualityScorer;

  private constructor() {}

  public static getInstance(): HistoricalDataQualityScorer {
    if (!HistoricalDataQualityScorer.instance) {
      HistoricalDataQualityScorer.instance = new HistoricalDataQualityScorer();
    }
    return HistoricalDataQualityScorer.instance;
  }

  /**
   * Computes comprehensive historical data quality score
   */
  public evaluateDataset(params: {
    totalExpectedIntervals: number;
    presentIntervals: number;
    timestampsValid: boolean;
    hasAuthoritativeSource: boolean;
    duplicateCount: number;
    revisionCount: number;
    hasCrossedBooks: boolean;
  }): HistoricalDataQualityScore {
    const {
      totalExpectedIntervals,
      presentIntervals,
      timestampsValid,
      hasAuthoritativeSource,
      duplicateCount,
      revisionCount,
      hasCrossedBooks
    } = params;

    // 1. Completeness (0-25)
    const completenessRatio = totalExpectedIntervals > 0 ? Math.min(1, presentIntervals / totalExpectedIntervals) : 1;
    const completeness = Math.round(completenessRatio * 25);

    // 2. Timestamp Integrity (0-25)
    const timestampIntegrity = timestampsValid ? 25 : 0;

    // 3. Source Authority (0-20)
    const sourceAuthority = hasAuthoritativeSource ? 20 : 10;

    // 4. Interval Continuity (0-15)
    const intervalPenalties = Math.min(15, (duplicateCount * 3));
    const intervalContinuity = Math.max(0, 15 - intervalPenalties);

    // 5. Feed Consistency (0-15)
    const consistencyPenalties = (hasCrossedBooks ? 10 : 0) + (revisionCount > 5 ? 5 : 0);
    const feedConsistency = Math.max(0, 15 - consistencyPenalties);

    const totalScore = Math.max(0, Math.min(100, completeness + timestampIntegrity + sourceAuthority + intervalContinuity + feedConsistency));

    let rating: HistoricalDataQualityRating = 'EXCELLENT';
    if (totalScore < 30 || !timestampsValid) {
      rating = 'INVALID';
    } else if (totalScore < 50) {
      rating = 'POOR';
    } else if (totalScore < 75) {
      rating = 'DEGRADED';
    } else if (totalScore < 90) {
      rating = 'GOOD';
    }

    return {
      score: totalScore,
      rating,
      breakdown: {
        completeness,
        timestampIntegrity,
        sourceAuthority,
        intervalContinuity,
        feedConsistency
      },
      missingIntervalsCount: Math.max(0, totalExpectedIntervals - presentIntervals),
      duplicateEventsCount: duplicateCount,
      revisionsDetectedCount: revisionCount,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const historicalDataQualityScorer = HistoricalDataQualityScorer.getInstance();
