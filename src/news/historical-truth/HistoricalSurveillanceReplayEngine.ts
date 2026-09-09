/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalSurveillanceReplayEngine.ts
 * 
 * Deterministic replay of Phase 18 surveillance rules against historical feeds.
 */

import { HistoricalSurveillanceEvent } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export class HistoricalSurveillanceReplayEngine {
  private static instance: HistoricalSurveillanceReplayEngine;

  private constructor() {}

  public static getInstance(): HistoricalSurveillanceReplayEngine {
    if (!HistoricalSurveillanceReplayEngine.instance) {
      HistoricalSurveillanceReplayEngine.instance = new HistoricalSurveillanceReplayEngine();
    }
    return HistoricalSurveillanceReplayEngine.instance;
  }

  /**
   * Replays surveillance evaluations for a symbol given its historical market ticks and news up to replayTimestamp
   */
  public evaluateSurveillance(
    symbol: string,
    replayTimestamp: string,
    currentPrice: number,
    previousPrice: number,
    volume: number,
    avgVolume: number,
    hasContradictoryNews: boolean = false
  ): HistoricalSurveillanceEvent[] {
    // Firewall check
    historicalFutureFirewall.inspectRecord('ORCHESTRATION', replayTimestamp, 'SURVEILLANCE', 'evaluate', currentPrice);

    const events: HistoricalSurveillanceEvent[] = [];
    const priceChangePct = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
    const volRatio = avgVolume > 0 ? volume / avgVolume : 1.0;

    // 1. Price Jump Anomaly
    if (Math.abs(priceChangePct) >= 1.5) {
      const eventId = `surv_pj_${symbol}_${HistoricalHashUtils.hashObject({ symbol, replayTimestamp, type: 'PRICE_JUMP' }).slice(2, 10)}`;
      const event: HistoricalSurveillanceEvent = {
        id: eventId,
        timestamp: replayTimestamp,
        symbol,
        anomalyType: 'PRICE_JUMP',
        severity: Math.abs(priceChangePct) >= 3.0 ? 'CRITICAL' : 'HIGH',
        detectionLatencyMs: 140,
        confirmationLatencyMs: 250,
        isConfirmed: volRatio >= 1.5,
        isFalsePositiveCandidate: volRatio < 0.5,
        score: Math.min(100, Math.round(Math.abs(priceChangePct) * 20)),
        description: `Sudden price shift of ${priceChangePct.toFixed(2)}% detected in ${symbol}`,
        deterministicHash: '',
        provenanceId: ''
      };
      event.deterministicHash = HistoricalHashUtils.hashObject(event);
      event.provenanceId = HistoricalHashUtils.generateProvenanceId('SURVEILLANCE_PRICE', replayTimestamp);
      events.push(event);
    }

    // 2. Volume Surge Anomaly
    if (volRatio >= 2.5) {
      const eventId = `surv_vs_${symbol}_${HistoricalHashUtils.hashObject({ symbol, replayTimestamp, type: 'VOLUME_SPIKE' }).slice(2, 10)}`;
      const event: HistoricalSurveillanceEvent = {
        id: eventId,
        timestamp: replayTimestamp,
        symbol,
        anomalyType: 'VOLUME_SPIKE',
        severity: volRatio >= 4.0 ? 'HIGH' : 'MEDIUM',
        detectionLatencyMs: 85,
        confirmationLatencyMs: 180,
        isConfirmed: true,
        isFalsePositiveCandidate: false,
        score: Math.min(100, Math.round(volRatio * 20)),
        description: `Abnormal volume spike (${volRatio.toFixed(1)}x avg volume) observed in ${symbol}`,
        deterministicHash: '',
        provenanceId: ''
      };
      event.deterministicHash = HistoricalHashUtils.hashObject(event);
      event.provenanceId = HistoricalHashUtils.generateProvenanceId('SURVEILLANCE_VOL', replayTimestamp);
      events.push(event);
    }

    // 3. News-Price Contradiction Anomaly
    if (hasContradictoryNews) {
      const eventId = `surv_cont_${symbol}_${HistoricalHashUtils.hashObject({ symbol, replayTimestamp, type: 'CONTRADICTION' }).slice(2, 10)}`;
      const event: HistoricalSurveillanceEvent = {
        id: eventId,
        timestamp: replayTimestamp,
        symbol,
        anomalyType: 'CONTRADICTION',
        severity: 'CRITICAL',
        detectionLatencyMs: 110,
        confirmationLatencyMs: 220,
        isConfirmed: true,
        isFalsePositiveCandidate: false,
        score: 95,
        description: `Severe narrative-price divergence: Bullish catalyst published but aggressive price degradation recorded`,
        deterministicHash: '',
        provenanceId: ''
      };
      event.deterministicHash = HistoricalHashUtils.hashObject(event);
      event.provenanceId = HistoricalHashUtils.generateProvenanceId('SURVEILLANCE_CONTRADICTION', replayTimestamp);
      events.push(event);
    }

    return events;
  }
}

export const historicalSurveillanceReplayEngine = HistoricalSurveillanceReplayEngine.getInstance();
