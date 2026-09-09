/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketTruthCircuitBreaker.ts
 * 
 * Deterministic safety gate and execution interlock.
 * Tripping prevents any downstream trade authorization or unverified signal propagation.
 * ZERO-AI: Deterministic condition triggers.
 */

import { MarketTruthStatus } from './types.ts';
import { AthenaEventBus } from '../intelligence/AthenaEventBus.ts';

export type CircuitBreakerState = 'CLOSED' | 'TRIPPED' | 'DEGRADED_PASS_THROUGH' | 'RESETTING';

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  isExecutionAllowed: boolean;
  isSurveillanceAllowed: boolean;
  tripReason?: string;
  trippedAt?: string;
  consecutiveFailuresCount: number;
  lastResetAt?: string;
}

export class MarketTruthCircuitBreaker {
  private static instance: MarketTruthCircuitBreaker;

  private state: CircuitBreakerState = 'CLOSED';
  private tripReason?: string;
  private trippedAt?: string;
  private consecutiveFailuresCount: number = 0;
  private lastResetAt?: string;
  private failureThreshold: number = 3;

  private constructor() {}

  public static getInstance(): MarketTruthCircuitBreaker {
    if (!MarketTruthCircuitBreaker.instance) {
      MarketTruthCircuitBreaker.instance = new MarketTruthCircuitBreaker();
    }
    return MarketTruthCircuitBreaker.instance;
  }

  public getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      isExecutionAllowed: this.state === 'CLOSED',
      isSurveillanceAllowed: this.state !== 'TRIPPED',
      tripReason: this.tripReason,
      trippedAt: this.trippedAt,
      consecutiveFailuresCount: this.consecutiveFailuresCount,
      lastResetAt: this.lastResetAt
    };
  }

  /**
   * Deterministically evaluates market truth quality and trips if unsafe.
   */
  public evaluateQuality(qualityStatus: MarketTruthStatus, reason: string): void {
    if (qualityStatus === 'CONTRADICTED' || qualityStatus === 'INVALID' || qualityStatus === 'DISCONNECTED') {
      this.consecutiveFailuresCount++;
      if (this.consecutiveFailuresCount >= this.failureThreshold && this.state !== 'TRIPPED') {
        this.trip(`Quality degraded to ${qualityStatus}: ${reason}`);
      }
    } else if (qualityStatus === 'DEGRADED') {
      if (this.state === 'CLOSED') {
        this.state = 'DEGRADED_PASS_THROUGH';
      }
    } else if (qualityStatus === 'VALID') {
      this.consecutiveFailuresCount = 0;
      if (this.state === 'DEGRADED_PASS_THROUGH' || this.state === 'RESETTING') {
        this.state = 'CLOSED';
      }
    }
  }

  /**
   * Trips the circuit breaker immediately.
   */
  public trip(reason: string): void {
    this.state = 'TRIPPED';
    this.tripReason = reason;
    this.trippedAt = new Date().toISOString();

    console.warn(`[MarketTruthCircuitBreaker] TRIPPED! Reason: ${reason}`);

    // Publish deterministic event on AthenaEventBus
    try {
      const bus = AthenaEventBus.getInstance();
      bus.publish({
        schemaVersion: 'v17_unified_event',
        eventId: `evt_cb_trip_${Date.now()}`,
        correlationId: `corr_cb_${Date.now()}`,
        parentEventId: null,
        timestamp: this.trippedAt,
        source: 'MARKET_TRUTH_CIRCUIT_BREAKER',
        sourceType: 'P0',
        eventType: 'MARKET_DATA_CONTRADICTION',
        articleId: '',
        evidenceIds: [],
        entityIds: [],
        sectorIds: [],
        indexIds: ['NIFTY 50'],
        macroAssetIds: [],
        marketReactionId: null,
        regimeSnapshotId: null,
        signalId: null,
        strategyCandidateIds: [],
        portfolioDecisionId: null,
        executionIntentId: null,
        executionOrderIds: [],
        fillIds: [],
        outcomeId: null,
        attributionId: null,
        learningRecordId: null,
        researchHypothesisIds: [],
        strategyVariantIds: [],
        confidence: 100,
        lifecycleState: 'NO_TRADE',
        actionability: 'LOCKED',
        contradictionState: 'CIRCUIT_BREAKER_TRIPPED',
        provenance: 'MarketTruthCircuitBreaker',
        deterministicOrAI: 'DETERMINISTIC'
      });
    } catch {}
  }

  /**
   * Records an anomaly and trips if threshold is reached
   */
  public recordAnomaly(anomaly: { symbol: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; message: string; timestamp: number }): void {
    if (anomaly.severity === 'CRITICAL' || anomaly.severity === 'HIGH') {
      this.consecutiveFailuresCount++;
      if (this.consecutiveFailuresCount >= this.failureThreshold) {
        this.trip(`Anomaly threshold exceeded: ${anomaly.type} - ${anomaly.message}`);
      }
    }
  }

  /**
   * Returns true if circuit breaker is tripped
   */
  public isTripped(): boolean {
    return this.state === 'TRIPPED';
  }

  /**
   * Resets the circuit breaker.
   */
  public reset(): void {
    this.state = 'CLOSED';
    this.tripReason = undefined;
    this.trippedAt = undefined;
    this.consecutiveFailuresCount = 0;
    this.lastResetAt = new Date().toISOString();
  }

  /**
   * Authoritative gate check before order authorization.
   */
  public canAuthorizeExecution(): boolean {
    return this.state === 'CLOSED';
  }
}

export const marketTruthCircuitBreaker = MarketTruthCircuitBreaker.getInstance();
