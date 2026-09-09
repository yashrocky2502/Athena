/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalSignalReplayEngine.ts
 * 
 * Deterministic reconstruction of Phase 9–11 event-to-signal pipeline.
 */

import { HistoricalSignalState, HistoricalNewsEvent } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export class HistoricalSignalReplayEngine {
  private static instance: HistoricalSignalReplayEngine;

  private constructor() {}

  public static getInstance(): HistoricalSignalReplayEngine {
    if (!HistoricalSignalReplayEngine.instance) {
      HistoricalSignalReplayEngine.instance = new HistoricalSignalReplayEngine();
    }
    return HistoricalSignalReplayEngine.instance;
  }

  /**
   * Generates deterministic historical signal based on available market and news data
   */
  public generateSignal(
    symbol: string,
    replayTimestamp: string,
    priceChangePct: number,
    recentNews: HistoricalNewsEvent[],
    isCircuitBreakerTripped: boolean = false
  ): HistoricalSignalState {
    historicalFutureFirewall.inspectRecord('SIGNAL', replayTimestamp, 'SIGNAL_ENGINE', 'generate', priceChangePct);

    // Calculate reaction from available news
    let reactionScore = 50;
    let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    const catalystIds: string[] = [];

    for (const n of recentNews) {
      catalystIds.push(n.id);
      if (n.sentiment === 'BULLISH') {
        reactionScore += 25;
        direction = 'LONG';
      } else if (n.sentiment === 'BEARISH') {
        reactionScore -= 25;
        direction = 'SHORT';
      }
    }

    reactionScore = Math.max(0, Math.min(100, reactionScore));

    // Directional alignment with price
    const directionalAlignment = (direction === 'LONG' && priceChangePct > 0) || (direction === 'SHORT' && priceChangePct < 0) ? 90 : 35;

    // Check contradiction
    let confirmationState: 'CONFIRMED' | 'UNCONFIRMED' | 'CONTRADICTED' = 'CONFIRMED';
    let contradictionState = 'NONE';
    let lifecycleState: HistoricalSignalState['lifecycleState'] = 'TRADEABLE';

    if ((direction === 'LONG' && priceChangePct < -1.0) || (direction === 'SHORT' && priceChangePct > 1.0)) {
      confirmationState = 'CONTRADICTED';
      contradictionState = 'PRICE_NARRATIVE_CONTRADICTION';
      lifecycleState = 'CONTRADICTED';
    }

    if (isCircuitBreakerTripped) {
      lifecycleState = 'BLOCKED';
      contradictionState = 'CIRCUIT_BREAKER_ACTIVE';
    }

    const transmissionScore = confirmationState === 'CONFIRMED' ? Math.round((reactionScore + directionalAlignment) / 2) : 20;

    const signalId = `sig_${symbol}_${HistoricalHashUtils.hashObject({ symbol, replayTimestamp, direction }).slice(2, 10)}`;

    const signal: HistoricalSignalState = {
      signalId,
      timestamp: replayTimestamp,
      symbol,
      direction,
      reactionScore,
      directionalAlignment,
      confirmationState,
      contradictionState,
      transmissionScore,
      lifecycleState,
      catalystIds,
      deterministicHash: '',
      provenanceId: ''
    };

    signal.deterministicHash = HistoricalHashUtils.hashObject(signal);
    signal.provenanceId = HistoricalHashUtils.generateProvenanceId('SIGNAL_ENGINE', replayTimestamp);

    return signal;
  }
}

export const historicalSignalReplayEngine = HistoricalSignalReplayEngine.getInstance();
