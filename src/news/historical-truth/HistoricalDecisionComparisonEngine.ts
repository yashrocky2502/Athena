/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalDecisionComparisonEngine.ts
 * 
 * Forensic comparison tool comparing Live Original System decisions vs Replayed decisions.
 */

import { DecisionComparisonRecord } from './types.ts';

export class HistoricalDecisionComparisonEngine {
  private static instance: HistoricalDecisionComparisonEngine;

  private constructor() {}

  public static getInstance(): HistoricalDecisionComparisonEngine {
    if (!HistoricalDecisionComparisonEngine.instance) {
      HistoricalDecisionComparisonEngine.instance = new HistoricalDecisionComparisonEngine();
    }
    return HistoricalDecisionComparisonEngine.instance;
  }

  /**
   * Compares an original system decision record against a newly replayed execution decision
   */
  public compareDecisions(
    original: { timestamp: string; decision: string; dataAvailable: string[]; engine: string },
    replayed: { timestamp: string; decision: string; dataAvailable: string[]; engine: string },
    eventDescription: string
  ): DecisionComparisonRecord {
    const isMatch = original.decision === replayed.decision;
    const differenceType = isMatch ? 'MATCH' : 'DIVERGENCE';

    return {
      timestamp: original.timestamp,
      eventDescription,
      originalDecision: original.decision,
      replayedDecision: replayed.decision,
      differenceType,
      dataAvailableOriginal: original.dataAvailable,
      dataAvailableReplay: replayed.dataAvailable,
      affectedEngine: original.engine,
      explanation: isMatch
        ? 'Replayed decision matches original live decision with identical data boundaries.'
        : `Replayed decision diverges from original: original was ${original.decision}, replay generated ${replayed.decision}.`
    };
  }
}

export const historicalDecisionComparisonEngine = HistoricalDecisionComparisonEngine.getInstance();
