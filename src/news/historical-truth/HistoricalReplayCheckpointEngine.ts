/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalReplayCheckpointEngine.ts
 * 
 * Deterministic checkpoint generation for state comparison, rewind, and regression prevention.
 */

import { HistoricalReplayCheckpoint } from './types.ts';
import { ReconstructedSystemState } from './HistoricalEventReconstructionEngine.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';

export class HistoricalReplayCheckpointEngine {
  private static instance: HistoricalReplayCheckpointEngine;
  private checkpoints: Map<string, HistoricalReplayCheckpoint[]> = new Map(); // sessionId -> checkpoints

  private constructor() {}

  public static getInstance(): HistoricalReplayCheckpointEngine {
    if (!HistoricalReplayCheckpointEngine.instance) {
      HistoricalReplayCheckpointEngine.instance = new HistoricalReplayCheckpointEngine();
    }
    return HistoricalReplayCheckpointEngine.instance;
  }

  /**
   * Creates an immutable checkpoint from a reconstructed state
   */
  public createCheckpoint(
    sessionId: string,
    sequence: number,
    state: ReconstructedSystemState,
    eventsProcessedCount: number
  ): HistoricalReplayCheckpoint {
    const marketHash = state.marketSnapshot ? HistoricalHashUtils.hashObject(state.marketSnapshot) : 'h_null_market';
    const newsHash = HistoricalHashUtils.hashObject(state.newsEvents.map(n => n.deterministicHash));
    const surveillanceHash = HistoricalHashUtils.hashObject(state.surveillanceEvents.map(s => s.deterministicHash));
    const signalHash = state.signalState.deterministicHash;
    const strategyHash = state.strategyState.deterministicHash;
    const portfolioHash = state.portfolioState.deterministicHash;
    const executionHash = state.executionState ? state.executionState.deterministicHash : 'h_null_exec';

    const aggregateStateHash = HistoricalHashUtils.hashObject({
      marketHash,
      newsHash,
      surveillanceHash,
      signalHash,
      strategyHash,
      portfolioHash,
      executionHash
    });

    const checkpoint: HistoricalReplayCheckpoint = {
      checkpointId: `chk_${sessionId}_${sequence}`,
      sequence,
      timestamp: state.replayTimestamp,
      canonicalMarketSnapshotHash: marketHash,
      newsStateHash: newsHash,
      surveillanceStateHash: surveillanceHash,
      signalStateHash: signalHash,
      strategyStateHash: strategyHash,
      portfolioStateHash: portfolioHash,
      executionStateHash: executionHash,
      aggregateStateHash,
      eventsProcessedCount
    };

    const list = this.checkpoints.get(sessionId) || [];
    list.push(checkpoint);
    this.checkpoints.set(sessionId, list);

    return checkpoint;
  }

  public getCheckpoints(sessionId: string): HistoricalReplayCheckpoint[] {
    return this.checkpoints.get(sessionId) || [];
  }

  public clear(sessionId?: string): void {
    if (sessionId) {
      this.checkpoints.delete(sessionId);
    } else {
      this.checkpoints.clear();
    }
  }
}

export const historicalReplayCheckpointEngine = HistoricalReplayCheckpointEngine.getInstance();
