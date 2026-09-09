/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * ReplayDriftDetectionEngine.ts
 * 
 * Verifies replay determinism by comparing multiple replay runs of identical historical ranges.
 */

import { ReplayDriftReport, ReplayDriftType, HistoricalReplayCheckpoint } from './types.ts';

export class ReplayDriftDetectionEngine {
  private static instance: ReplayDriftDetectionEngine;

  private constructor() {}

  public static getInstance(): ReplayDriftDetectionEngine {
    if (!ReplayDriftDetectionEngine.instance) {
      ReplayDriftDetectionEngine.instance = new ReplayDriftDetectionEngine();
    }
    return ReplayDriftDetectionEngine.instance;
  }

  /**
   * Compares two sequences of replay checkpoints
   */
  public compareReplayRuns(
    sessionId: string,
    checkpointsA: HistoricalReplayCheckpoint[],
    checkpointsB: HistoricalReplayCheckpoint[]
  ): ReplayDriftReport {
    const driftDetails: string[] = [];
    let driftType: ReplayDriftType = 'NO_DRIFT';

    if (checkpointsA.length !== checkpointsB.length) {
      driftType = 'DATA_DRIFT';
      driftDetails.push(`Checkpoint count mismatch: Run A (${checkpointsA.length}) vs Run B (${checkpointsB.length})`);
    }

    const maxLen = Math.min(checkpointsA.length, checkpointsB.length);
    for (let i = 0; i < maxLen; i++) {
      const a = checkpointsA[i];
      const b = checkpointsB[i];

      if (a.aggregateStateHash !== b.aggregateStateHash) {
        if (a.canonicalMarketSnapshotHash !== b.canonicalMarketSnapshotHash) {
          driftType = 'DATA_DRIFT';
          driftDetails.push(`Market state drift at seq ${i} (${a.timestamp}): ${a.canonicalMarketSnapshotHash} !== ${b.canonicalMarketSnapshotHash}`);
        } else if (a.signalStateHash !== b.signalStateHash || a.strategyStateHash !== b.strategyStateHash) {
          driftType = 'LOGIC_DRIFT';
          driftDetails.push(`Logic / Strategy drift at seq ${i} (${a.timestamp}): Signal or strategy hashes differ`);
        } else {
          driftType = 'NON_DETERMINISTIC_DRIFT';
          driftDetails.push(`State hash divergence at seq ${i} (${a.timestamp})`);
        }
      }
    }

    const lastA = checkpointsA[checkpointsA.length - 1];
    const lastB = checkpointsB[checkpointsB.length - 1];

    return {
      sessionId,
      runA_Hash: lastA ? lastA.aggregateStateHash : 'h_empty',
      runB_Hash: lastB ? lastB.aggregateStateHash : 'h_empty',
      driftType,
      driftDetails,
      isDeterministic: driftType === 'NO_DRIFT',
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const replayDriftDetectionEngine = ReplayDriftDetectionEngine.getInstance();
