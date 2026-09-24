/**
 * ATHENA — PHASE 10P-7: REAL POSITION-ALERT INTELLIGENCE INTEGRATION
 * PositionAlertIntelligenceEngine.ts
 * 
 * Thin, deterministic orchestration layer connecting:
 * Reconciled Portfolio State
 *        ↓
 * Structured News Core V2 Event
 *        ↓
 * PositionRelevanceEngine (Exact entity matching + fail-closed provenance + materiality)
 *        ↓
 * PositionAlertEngine (Deduplication + Lifecycle)
 *        ↓
 * PositionAlertDeliveryStore & PrivatePositionTelegramNotifier
 * 
 * Strict Guarantees:
 * 1. Authoritative Portfolio State: Uses NormalizedPortfolioState.activePositions only (quantity > 0).
 * 2. Closed Position Isolation: Historical/closed positions never receive alerts and are never reactivated.
 * 3. Fail-Closed Source Health: INVALID_SOURCE, SOURCE_ERROR, or UNAVAILABLE produce zero alerts.
 * 4. Fail-Closed Event Provenance: Synthetic, test, unverified, or publisher-less events produce zero alerts.
 * 5. Strict Entity Matching: Exact ISIN, structured symbol, exchange:symbol, canonical underlying, or entity token.
 * 6. Zero Generic Market Alerts: Macro benchmarks (NIFTY/SENSEX/etc.) rejected unless explicitly held.
 * 7. Multi-Position Support: One candidate per genuinely impacted active position.
 * 8. Persistent Deduplication: Restarts and polling cycles are strictly idempotent.
 * 9. Destination Isolation: Zero writes to data/telegram_outbox.json or News Core channels.
 * 10. Strictly READ-ONLY: No order placement or trading methods.
 */

import {
  NormalizedPosition,
  NormalizedPortfolioState,
  PositionNewsEventInput,
  PositionAlertCandidate,
  PositionRelevanceResult,
  PortfolioSourceStatus,
  PositionAlertNotifier
} from './types.ts';
import { PositionRelevanceEngine } from './PositionRelevanceEngine.ts';
import { PositionAlertEngine } from './PositionAlertEngine.ts';
import { PositionAlertDeliveryStore } from './PositionAlertDeliveryStore.ts';
import { PortfolioReconciliationEngine } from '../broker/PortfolioReconciliationEngine.ts';
import { PositionMonitor } from './PositionMonitor.ts';

export interface PositionAlertIntelligenceEngineOptions {
  portfolioState?: NormalizedPortfolioState;
  relevanceEngine?: PositionRelevanceEngine;
  alertEngine?: PositionAlertEngine;
  notifier?: PositionAlertNotifier;
  deliveryStore?: PositionAlertDeliveryStore;
  reconciliationEngine?: PortfolioReconciliationEngine;
}

export class PositionAlertIntelligenceEngine {
  private currentState: NormalizedPortfolioState;
  private relevanceEngine: PositionRelevanceEngine;
  private alertEngine?: PositionAlertEngine;
  private notifier?: PositionAlertNotifier;
  private deliveryStore?: PositionAlertDeliveryStore;
  private reconciliationEngine: PortfolioReconciliationEngine;
  private processedDedupeKeys: Set<string> = new Set();

  constructor(options: PositionAlertIntelligenceEngineOptions = {}) {
    this.reconciliationEngine = options.reconciliationEngine || PortfolioReconciliationEngine.getInstance();
    this.currentState = options.portfolioState || this.reconciliationEngine.createInitialState();
    this.relevanceEngine = options.relevanceEngine || new PositionRelevanceEngine();
    this.alertEngine = options.alertEngine;
    this.notifier = options.notifier || (this.alertEngine ? this.alertEngine.getNotifier() : undefined);
    this.deliveryStore = options.deliveryStore || (this.notifier && (this.notifier as any).getDeliveryStore ? (this.notifier as any).getDeliveryStore() : undefined);

    this.seedDedupeKeys();
  }

  private seedDedupeKeys(): void {
    if (this.deliveryStore && typeof this.deliveryStore.getAllRecords === 'function') {
      try {
        const records = this.deliveryStore.getAllRecords();
        for (const rec of records) {
          if (rec.status === 'SENT' || rec.status === 'SUPPRESSED_DUPLICATE') {
            this.processedDedupeKeys.add(rec.dedupeKey);
          }
        }
      } catch (e) {
        // Safe fallback
      }
    }
  }

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================

  /**
   * Sets the authoritative reconciled portfolio state.
   */
  public setPortfolioState(state: NormalizedPortfolioState): void {
    this.currentState = state;
  }

  /**
   * Returns the current authoritative reconciled portfolio state.
   */
  public getPortfolioState(): NormalizedPortfolioState {
    return this.currentState;
  }

  public getRelevanceEngine(): PositionRelevanceEngine {
    return this.relevanceEngine;
  }

  public getAlertEngine(): PositionAlertEngine | undefined {
    return this.alertEngine;
  }

  public getNotifier(): PositionAlertNotifier | undefined {
    return this.notifier;
  }

  public getDeliveryStore(): PositionAlertDeliveryStore | undefined {
    return this.deliveryStore;
  }

  // =========================================================================
  // CORE INTELLIGENCE PROCESSING
  // =========================================================================

  /**
   * Evaluates a single structured News Core V2 event against the authoritative active positions.
   * Delivers deduplicated alert candidates through the configured notifier.
   */
  public async processEvent(
    event: PositionNewsEventInput,
    overrideState?: NormalizedPortfolioState
  ): Promise<PositionAlertCandidate[]> {
    const state = overrideState || this.currentState;

    // 1. Source Status Gate: Fail-Closed on invalid source health
    if (
      state.sourceStatus === 'INVALID_SOURCE' ||
      state.sourceStatus === 'SOURCE_ERROR' ||
      state.sourceStatus === 'UNAVAILABLE'
    ) {
      return [];
    }

    // 2. Authoritative Active Positions Gate: Only ACTIVE positions with quantity > 0
    if (
      state.sourceStatus === 'VALID_EMPTY_PORTFOLIO' ||
      state.presenceState === 'NO_POSITION' ||
      !state.activePositions ||
      state.activePositions.size === 0 ||
      state.totalActivePositions === 0
    ) {
      return [];
    }

    // Extract active positions only (closed positions are strictly isolated)
    const activePositionsList = Array.from(state.activePositions.values()).filter(p => p.quantity > 0);
    if (activePositionsList.length === 0) {
      return [];
    }

    // 3. Evaluate event using PositionRelevanceEngine
    const relevanceResult = this.relevanceEngine.evaluateEvent(event, activePositionsList);
    if (relevanceResult.decision !== 'POSITION_IMPACT') {
      return [];
    }

    const candidates = relevanceResult.candidates && relevanceResult.candidates.length > 0
      ? relevanceResult.candidates
      : (relevanceResult.candidate ? [relevanceResult.candidate] : []);

    const deliveredCandidates: PositionAlertCandidate[] = [];

    for (const candidate of candidates) {
      // Invariant 1: Valid non-empty positionId referencing active position
      if (!candidate.positionId || candidate.positionId.trim() === '') {
        continue;
      }

      // Verify that candidate positionId exists in activePositions (never closed positions)
      if (!state.activePositions.has(candidate.positionId)) {
        continue;
      }

      // Invariant 2: Deduplication Check
      if (this.isDuplicate(candidate.dedupeKey)) {
        continue;
      }

      // Record dedupe
      this.processedDedupeKeys.add(candidate.dedupeKey);
      if (this.alertEngine && (this.alertEngine as any).dedupeRegistry) {
        (this.alertEngine as any).dedupeRegistry.add(candidate.dedupeKey);
      }

      // Deliver via notifier if available
      if (this.notifier) {
        try {
          await this.notifier.notify(candidate);
        } catch (err) {
          console.error('[PositionAlertIntelligenceEngine] Notifier error:', err);
        }
      }

      deliveredCandidates.push(candidate);
    }

    return deliveredCandidates;
  }

  /**
   * Evaluates a batch of structured News Core V2 events.
   */
  public async processEvents(
    events: PositionNewsEventInput[],
    overrideState?: NormalizedPortfolioState
  ): Promise<PositionAlertCandidate[]> {
    const allCandidates: PositionAlertCandidate[] = [];
    for (const ev of events) {
      const candidates = await this.processEvent(ev, overrideState);
      allCandidates.push(...candidates);
    }
    return allCandidates;
  }

  /**
   * Checks whether a candidate dedupeKey has already been delivered or processed.
   */
  public isDuplicate(dedupeKey: string): boolean {
    if (this.processedDedupeKeys.has(dedupeKey)) {
      return true;
    }
    if (this.alertEngine && this.alertEngine.isDuplicate(dedupeKey)) {
      return true;
    }
    if (this.deliveryStore && typeof this.deliveryStore.isDelivered === 'function') {
      if (this.deliveryStore.isDelivered(dedupeKey)) {
        return true;
      }
    }
    return false;
  }
}
