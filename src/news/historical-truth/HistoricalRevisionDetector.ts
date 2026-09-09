/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalRevisionDetector.ts
 * 
 * Tracks changes between original source truth and retrospective revisions (e.g. corporate action adjustments, restatements).
 */

import { HistoricalRevisionRecord } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';

export class HistoricalRevisionDetector {
  private static instance: HistoricalRevisionDetector;
  private revisionRecords: HistoricalRevisionRecord[] = [];

  private constructor() {}

  public static getInstance(): HistoricalRevisionDetector {
    if (!HistoricalRevisionDetector.instance) {
      HistoricalRevisionDetector.instance = new HistoricalRevisionDetector();
    }
    return HistoricalRevisionDetector.instance;
  }

  /**
   * Evaluates if a current historical candle/tick has been revised compared to original recorded version
   */
  public evaluateRevision(
    symbol: string,
    timestamp: string,
    originalData: { lastPrice: number; volume: number; recordedAt: string },
    currentData: { lastPrice: number; volume: number; recordedAt: string },
    reason: HistoricalRevisionRecord['revisionReason'] = 'CORP_ACTION_ADJUSTMENT'
  ): { isRevised: boolean; record?: HistoricalRevisionRecord } {
    const isPriceDiff = Math.abs(originalData.lastPrice - currentData.lastPrice) > 0.001;
    const isVolDiff = originalData.volume !== currentData.volume;

    if (!isPriceDiff && !isVolDiff) {
      return { isRevised: false };
    }

    const record: HistoricalRevisionRecord = {
      id: `rev_${symbol}_${Date.now()}`,
      symbol,
      timestamp,
      originalVersion: {
        lastPrice: originalData.lastPrice,
        volume: originalData.volume,
        hash: HistoricalHashUtils.hashObject(originalData),
        recordedAt: originalData.recordedAt
      },
      currentVersion: {
        lastPrice: currentData.lastPrice,
        volume: currentData.volume,
        hash: HistoricalHashUtils.hashObject(currentData),
        recordedAt: currentData.recordedAt
      },
      revisionReason: reason,
      detectedAt: new Date().toISOString()
    };

    this.revisionRecords.push(record);
    return { isRevised: true, record };
  }

  public getRevisionRecords(): HistoricalRevisionRecord[] {
    return [...this.revisionRecords];
  }

  public clear(): void {
    this.revisionRecords = [];
  }
}

export const historicalRevisionDetector = HistoricalRevisionDetector.getInstance();
