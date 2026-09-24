/**
 * ATHENA — PHASE 10P-2: PERSONAL POSITION ALERT FOUNDATION
 * PositionAlertEngine.ts
 * 
 * Generates, verifies, and deduplicates position-scoped alert candidates.
 * 
 * Strict Safety Invariants:
 * 1. Position Identity Mandatory: An alert candidate WITHOUT a valid positionId is REJECTED and NEVER emitted.
 * 2. Unrelated Market Event Isolation: Generic market events cannot create position alerts.
 * 3. Deterministic Deduplication: Idempotent across monitoring cycles with identical position state.
 * 4. Read-Only Safety: Zero order placement methods.
 */

import {
  PositionAlertCandidate,
  PositionAlertNotifier,
  PositionLifecycleEvent,
  PositionSnapshot,
  NormalizedPosition,
  PositionNewsEventInput,
  PositionRelevanceResult
} from './types.ts';
import { PositionMonitor } from './PositionMonitor.ts';
import { PositionRelevanceEngine } from './PositionRelevanceEngine.ts';

export interface PositionAlertEngineOptions {
  monitor: PositionMonitor;
  notifier?: PositionAlertNotifier;
  relevanceEngine?: PositionRelevanceEngine;
  maxDedupeHistory?: number;
}

export class PositionAlertEngine {
  private monitor: PositionMonitor;
  private notifier?: PositionAlertNotifier;
  private relevanceEngine: PositionRelevanceEngine;
  private dedupeRegistry: Set<string> = new Set();
  private generatedAlerts: PositionAlertCandidate[] = [];
  private maxDedupeHistory: number;

  constructor(options: PositionAlertEngineOptions) {
    this.monitor = options.monitor;
    this.notifier = options.notifier;
    this.relevanceEngine = options.relevanceEngine || new PositionRelevanceEngine();
    this.maxDedupeHistory = options.maxDedupeHistory || 1000;
    this.seedDedupeFromNotifier();
  }

  private seedDedupeFromNotifier(): void {
    if (this.notifier && (this.notifier as any).getDeliveryStore) {
      try {
        const store = (this.notifier as any).getDeliveryStore();
        if (store && typeof store.getAllRecords === 'function') {
          for (const rec of store.getAllRecords()) {
            if (rec.status === 'SENT' || rec.status === 'SUPPRESSED_DUPLICATE') {
              this.dedupeRegistry.add(rec.dedupeKey);
            }
          }
        }
      } catch (err) {
        // Safe fallback
      }
    }
  }

  public setNotifier(notifier: PositionAlertNotifier): void {
    this.notifier = notifier;
    this.seedDedupeFromNotifier();
  }

  public getNotifier(): PositionAlertNotifier | undefined {
    return this.notifier;
  }

  public getRelevanceEngine(): PositionRelevanceEngine {
    return this.relevanceEngine;
  }

  public setRelevanceEngine(relevanceEngine: PositionRelevanceEngine): void {
    this.relevanceEngine = relevanceEngine;
  }

  public isDuplicate(dedupeKey: string): boolean {
    if (this.dedupeRegistry.has(dedupeKey)) {
      return true;
    }
    if (this.notifier && (this.notifier as any).getDeliveryStore) {
      const store = (this.notifier as any).getDeliveryStore();
      if (store && typeof store.isDelivered === 'function' && store.isDelivered(dedupeKey)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates a deterministic deduplication key for a position alert.
   */
  public static generateDedupeKey(
    positionId: string,
    alertType: string,
    stateDescriptor: string
  ): string {
    return `dedupe::pos::${positionId}::${alertType}::${stateDescriptor}`;
  }

  /**
   * Evaluates current position state and emits deduplicated alert candidates.
   */
  public async evaluate(): Promise<PositionAlertCandidate[]> {
    const { snapshot, events } = await this.monitor.evaluatePositions();
    const newAlerts: PositionAlertCandidate[] = [];

    for (const event of events) {
      const candidate = this.convertEventToCandidate(event, snapshot);
      if (!candidate) continue;

      // Invariant 1: candidate MUST have a valid non-empty positionId
      if (!candidate.positionId || candidate.positionId.trim() === '') {
        console.warn('[PositionAlertEngine] Rejected candidate without valid positionId:', candidate);
        continue;
      }

      // Invariant 2: Deterministic Deduplication
      if (this.isDuplicate(candidate.dedupeKey)) {
        // Skip duplicate
        continue;
      }

      this.dedupeRegistry.add(candidate.dedupeKey);
      this.maintainDedupeSize();

      this.generatedAlerts.push(candidate);
      newAlerts.push(candidate);

      // Forward to notifier if configured
      if (this.notifier) {
        try {
          await this.notifier.notify(candidate);
        } catch (err) {
          console.error('[PositionAlertEngine] Notifier error:', err);
        }
      }
    }

    return newAlerts;
  }

  /**
   * Evaluates a potential market signal against the active position snapshot.
   * REJECTS any market event that does not match an active user position.
   */
  public async evaluateMarketSignal(signal: {
    symbol: string;
    signalType: string;
    message: string;
    marketPrice?: number;
  }): Promise<PositionAlertCandidate | null> {
    const snapshot = this.monitor.getLatestSnapshot();
    if (!snapshot || snapshot.presenceState === 'NO_POSITION') {
      // Invariant: Unrelated market events cannot create position alerts when no position exists
      return null;
    }

    // Locate active position with matching symbol
    let matchingPosition: NormalizedPosition | null = null;
    for (const pos of snapshot.positions.values()) {
      if (pos.symbol.toUpperCase() === signal.symbol.toUpperCase()) {
        matchingPosition = pos;
        break;
      }
    }

    if (!matchingPosition) {
      // User does not own this symbol -> REJECT
      return null;
    }

    const dedupeKey = PositionAlertEngine.generateDedupeKey(
      matchingPosition.positionId,
      `MARKET_${signal.signalType}`,
      `${signal.marketPrice || 'NA'}`
    );

    if (this.isDuplicate(dedupeKey)) {
      return null;
    }

    const candidate: PositionAlertCandidate = {
      alertId: `ALT_MKT_${matchingPosition.positionId}_${Date.now()}`,
      positionId: matchingPosition.positionId,
      symbol: matchingPosition.symbol,
      alertType: 'CUSTOM',
      severity: 'WARNING',
      reason: `Position Alert [${matchingPosition.symbol}]: ${signal.message}`,
      timestamp: new Date().toISOString(),
      marketData: {
        currentPrice: signal.marketPrice ?? matchingPosition.currentPrice ?? null,
        previousPrice: matchingPosition.averagePrice ?? null
      },
      provenance: {
        source: matchingPosition.source,
        observedAt: matchingPosition.observedAt
      },
      dedupeKey
    };

    this.dedupeRegistry.add(dedupeKey);
    this.maintainDedupeSize();
    this.generatedAlerts.push(candidate);

    if (this.notifier) {
      await this.notifier.notify(candidate);
    }

    return candidate;
  }

  /**
   * Evaluates a News Core V2 intelligence event using PositionRelevanceEngine.
   * Performs deduplication and delivers candidate to notifier if configured.
   */
  public async evaluateNewsEvent(
    event: PositionNewsEventInput
  ): Promise<PositionAlertCandidate | null> {
    const snapshot = this.monitor.getLatestSnapshot();
    if (!snapshot || snapshot.presenceState === 'NO_POSITION') {
      return null;
    }

    const relevanceResult = this.relevanceEngine.evaluateEvent(event, snapshot);
    if (relevanceResult.decision !== 'POSITION_IMPACT' || !relevanceResult.candidate) {
      return null;
    }

    const candidate = relevanceResult.candidate;

    // Invariant: candidate MUST have a valid non-empty positionId
    if (!candidate.positionId || candidate.positionId.trim() === '') {
      return null;
    }

    // Invariant: Deduplication
    if (this.isDuplicate(candidate.dedupeKey)) {
      return null;
    }

    this.dedupeRegistry.add(candidate.dedupeKey);
    this.maintainDedupeSize();
    this.generatedAlerts.push(candidate);

    if (this.notifier) {
      try {
        await this.notifier.notify(candidate);
      } catch (err) {
        console.error('[PositionAlertEngine] Notifier error on news event:', err);
      }
    }

    return candidate;
  }

  /**
   * Evaluates a batch of News Core V2 intelligence events.
   */
  public async evaluateNewsEvents(
    events: PositionNewsEventInput[]
  ): Promise<PositionAlertCandidate[]> {
    const emitted: PositionAlertCandidate[] = [];
    for (const event of events) {
      const candidate = await this.evaluateNewsEvent(event);
      if (candidate) {
        emitted.push(candidate);
      }
    }
    return emitted;
  }

  /**
   * Transforms a lifecycle event into an alert candidate with a guaranteed positionId.
   */
  private convertEventToCandidate(
    event: PositionLifecycleEvent,
    snapshot: PositionSnapshot
  ): PositionAlertCandidate | null {
    if (!event.positionId) return null;

    let alertType: PositionAlertCandidate['alertType'] = 'LIFECYCLE';
    let severity: PositionAlertCandidate['severity'] = 'INFO';
    let stateDesc = '';

    const current = event.currentPosition;
    const previous = event.previousPosition;

    switch (event.type) {
      case 'POSITION_APPEARED':
        alertType = 'LIFECYCLE';
        severity = 'INFO';
        stateDesc = `qty:${current?.quantity || 0}_avg:${current?.averagePrice ?? 'null'}`;
        break;

      case 'POSITION_QUANTITY_CHANGED':
        alertType = 'QUANTITY_CHANGE';
        severity = 'WARNING';
        stateDesc = `qty:${current?.quantity || 0}_delta:${event.quantityDelta || 0}`;
        break;

      case 'POSITION_PRICE_CHANGED':
        alertType = 'PRICE_CHANGE';
        severity = 'INFO';
        stateDesc = `price:${current?.averagePrice ?? 'null'}_delta:${event.priceDelta || 0}`;
        break;

      case 'POSITION_SIDE_CHANGED':
        alertType = 'LIFECYCLE';
        severity = 'CRITICAL';
        stateDesc = `side:${current?.side || 'NA'}`;
        break;

      case 'POSITION_CLOSED':
        alertType = 'POSITION_CLOSED';
        severity = 'WARNING';
        stateDesc = `closed_prevQty:${previous?.quantity || 0}`;
        break;

      default:
        stateDesc = 'generic';
    }

    const dedupeKey = PositionAlertEngine.generateDedupeKey(
      event.positionId,
      event.type,
      stateDesc
    );

    const activePos = current || previous;

    return {
      alertId: `ALT_${event.type}_${event.positionId}_${Date.now()}`,
      positionId: event.positionId,
      symbol: event.symbol,
      alertType,
      severity,
      reason: event.details,
      timestamp: event.timestamp,
      marketData: {
        currentPrice: activePos?.currentPrice ?? null,
        previousPrice: activePos?.averagePrice ?? null
      },
      provenance: {
        source: activePos?.source || 'UNKNOWN',
        observedAt: activePos?.observedAt || event.timestamp
      },
      dedupeKey
    };
  }

  private maintainDedupeSize(): void {
    if (this.dedupeRegistry.size > this.maxDedupeHistory) {
      const entries = Array.from(this.dedupeRegistry);
      const toRemove = entries.slice(0, Math.floor(this.maxDedupeHistory / 2));
      for (const key of toRemove) {
        this.dedupeRegistry.delete(key);
      }
    }
  }

  public getGeneratedAlerts(): PositionAlertCandidate[] {
    return [...this.generatedAlerts];
  }

  public clearDedupeRegistry(): void {
    this.dedupeRegistry.clear();
    this.generatedAlerts = [];
  }
}
