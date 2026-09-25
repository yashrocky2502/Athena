/**
 * ATHENA — PHASE 10P-8: REAL-TIME POSITION ALERT RUNTIME WIRING
 * PositionAlertRuntime.ts
 * 
 * Central runtime coordinator wiring canonical News Core V2 events to the personal
 * position-alert intelligence pipeline.
 * 
 * Data Flow:
 * Canonical News Core V2 event
 *         ↓ (NewsCoreV2PositionAlertAdapter)
 * Current reconciled portfolio state (Phase 10P-6 NormalizedPortfolioState)
 *         ↓
 * PositionAlertIntelligenceEngine
 *         ↓
 * PositionAlertEngine & PositionAlertDeliveryStore
 *         ↓
 * Private Position Telegram Notifier
 * 
 * Invariants & Architectural Rules:
 * 1. Runtime Feature Flag: OFF by default (ATHENA_POSITION_ALERTS_ENABLED=false).
 * 2. News Core V2 Protection: Personal alert failure NEVER crashes or affects News Core V2.
 * 3. Authoritative Portfolio State: Consumes NormalizedPortfolioState (activePositions with quantity > 0 only).
 * 4. Closed Position Isolation: Closed positions never receive alerts and are never reactivated.
 * 5. Fail-Closed Health: INVALID_SOURCE, SOURCE_ERROR, UNAVAILABLE, VALID_EMPTY_PORTFOLIO yield zero alerts.
 * 6. Generic Market Event Suppression: Macro indices (NIFTY, SENSEX, CRUDE, etc.) suppressed unless held.
 * 7. Deduplication & Idempotency: Restarts, duplicate events, and repeated cycles produce 1 alert only.
 * 8. Destination Isolation: Zero writes to data/telegram_outbox.json.
 * 9. Strictly Read-Only: Zero order placement, buying, selling, or trade execution capabilities.
 */

import { NewsArticleV2 } from '../../../newsCoreV2/domain/NewsArticle.ts';
import {
  NormalizedPortfolioState,
  NormalizedPosition,
  PositionNewsEventInput,
  PositionAlertCandidate,
  PositionAlertNotifier
} from './types.ts';
import { PositionAlertRuntimeGuard } from './PositionAlertRuntimeGuard.ts';
import { NewsCoreV2PositionAlertAdapter } from './NewsCoreV2PositionAlertAdapter.ts';
import { PositionAlertIntelligenceEngine } from './PositionAlertIntelligenceEngine.ts';
import { PositionAlertEngine } from './PositionAlertEngine.ts';
import { PrivatePositionTelegramNotifier } from './PositionAlertNotifier.ts';
import { PositionAlertDeliveryStore } from './PositionAlertDeliveryStore.ts';
import {
  PortfolioReconciliationEngine,
  resolveDeterministicPositionId
} from '../broker/PortfolioReconciliationEngine.ts';
import { PortfolioHubManager } from '../broker/PortfolioHubManager.ts';

export class PositionAlertRuntime {
  private static instance: PositionAlertRuntime;

  private intelligenceEngine: PositionAlertIntelligenceEngine;
  private notifier: PositionAlertNotifier;
  private deliveryStore: PositionAlertDeliveryStore;
  private customPortfolioState: NormalizedPortfolioState | null = null;
  private customPortfolioStateProvider: (() => Promise<NormalizedPortfolioState>) | null = null;
  private processedEventsCount: number = 0;
  private generatedAlertsCount: number = 0;

  public constructor(options?: {
    intelligenceEngine?: PositionAlertIntelligenceEngine;
    notifier?: PositionAlertNotifier;
    deliveryStore?: PositionAlertDeliveryStore;
    portfolioState?: NormalizedPortfolioState;
  }) {
    this.notifier = options?.notifier || new PrivatePositionTelegramNotifier();
    this.deliveryStore = options?.deliveryStore || new PositionAlertDeliveryStore();
    this.intelligenceEngine = options?.intelligenceEngine || new PositionAlertIntelligenceEngine({
      notifier: this.notifier,
      deliveryStore: this.deliveryStore
    });
    this.customPortfolioState = options?.portfolioState || null;
  }

  public static getInstance(): PositionAlertRuntime {
    if (!PositionAlertRuntime.instance) {
      PositionAlertRuntime.instance = new PositionAlertRuntime();
    }
    return PositionAlertRuntime.instance;
  }

  // =========================================================================
  // DEPENDENCY INJECTION & TESTABILITY
  // =========================================================================

  public setPortfolioState(state: NormalizedPortfolioState | null): void {
    this.customPortfolioState = state;
  }

  public setPortfolioStateProvider(provider: (() => Promise<NormalizedPortfolioState>) | null): void {
    this.customPortfolioStateProvider = provider;
  }

  public setNotifier(notifier: PositionAlertNotifier): void {
    this.notifier = notifier;
    // Rebind intelligence engine with the updated notifier
    this.intelligenceEngine = new PositionAlertIntelligenceEngine({
      notifier: this.notifier,
      deliveryStore: this.deliveryStore,
      portfolioState: this.customPortfolioState || undefined
    });
  }

  public setIntelligenceEngine(engine: PositionAlertIntelligenceEngine): void {
    this.intelligenceEngine = engine;
  }

  public getIntelligenceEngine(): PositionAlertIntelligenceEngine {
    return this.intelligenceEngine;
  }

  public getNotifier(): PositionAlertNotifier {
    return this.notifier;
  }

  public getDeliveryStore(): PositionAlertDeliveryStore {
    return this.deliveryStore;
  }

  public getProcessedEventsCount(): number {
    return this.processedEventsCount;
  }

  public getGeneratedAlertsCount(): number {
    return this.generatedAlertsCount;
  }

  public reset(): void {
    this.customPortfolioState = null;
    this.customPortfolioStateProvider = null;
    this.processedEventsCount = 0;
    this.generatedAlertsCount = 0;
    PositionAlertRuntimeGuard.reset();
  }

  // =========================================================================
  // PORTFOLIO STATE RESOLUTION (Phase 10P-6 Authoritative Reconciled State)
  // =========================================================================

  /**
   * Retrieves the current authoritative reconciled portfolio state.
   * Leverages Phase 10P-6 PortfolioReconciliationEngine without duplicate file parsing.
   */
  public async getAuthoritativePortfolioState(): Promise<NormalizedPortfolioState> {
    if (this.customPortfolioStateProvider) {
      try {
        return await this.customPortfolioStateProvider();
      } catch (err: any) {
        console.warn('[PositionAlertRuntime] Custom portfolio state provider failure (isolated):', err?.message || err);
        return PortfolioReconciliationEngine.getInstance().createInitialState();
      }
    }

    if (this.customPortfolioState) {
      return this.customPortfolioState;
    }

    try {
      const hub = PortfolioHubManager.getInstance();
      const portfolio = hub.getActivePortfolio();
      if (!portfolio) {
        return PortfolioReconciliationEngine.getInstance().createInitialState();
      }

      // Convert canonical holdings and positions to NormalizedPosition[]
      const normalizedPositions: NormalizedPosition[] = [];

      if (Array.isArray(portfolio.holdings)) {
        for (const h of portfolio.holdings) {
          if (h.quantity > 0) {
            normalizedPositions.push({
              positionId: resolveDeterministicPositionId({
                symbol: h.symbol,
                isin: h.isin,
                exchange: h.exchange,
                assetClass: h.assetClass,
                source: h.source || 'PORTFOLIO_STORE'
              }),
              symbol: h.symbol.toUpperCase().trim(),
              exchange: h.exchange || 'NSE',
              isin: h.isin || null,
              assetClass: h.assetClass || 'EQUITY',
              quantity: h.quantity,
              averagePrice: h.averagePrice ?? null,
              currentPrice: h.currentPrice ?? null,
              sector: h.sector || null,
              source: h.source || 'PORTFOLIO_STORE',
              observedAt: h.normalizedAt || new Date().toISOString()
            });
          }
        }
      }

      if (Array.isArray(portfolio.positions)) {
        for (const p of portfolio.positions) {
          if (p.quantity > 0) {
            normalizedPositions.push({
              positionId: resolveDeterministicPositionId({
                symbol: p.symbol,
                exchange: p.exchange,
                assetClass: p.assetClass,
                source: 'PORTFOLIO_STORE',
                expiryDate: p.expiryDate,
                strikePrice: p.strikePrice,
                optionType: p.optionType
              }),
              symbol: p.symbol.toUpperCase().trim(),
              exchange: p.exchange || 'NSE',
              assetClass: p.assetClass || 'FUTURES',
              side: p.side || 'LONG',
              quantity: p.quantity,
              averagePrice: p.entryPrice ?? null,
              currentPrice: p.currentPrice ?? null,
              underlyingSymbol: p.underlyingSymbol || null,
              strikePrice: p.strikePrice ?? null,
              expiryDate: p.expiryDate || null,
              optionType: p.optionType || null,
              sector: p.sector || null,
              source: 'PORTFOLIO_STORE',
              observedAt: new Date().toISOString()
            });
          }
        }
      }

      const reconciliationEngine = PortfolioReconciliationEngine.getInstance();
      const initialState = reconciliationEngine.createInitialState({ portfolioId: portfolio.id });
      const reconciled = await reconciliationEngine.reconcilePortfolioState(initialState, normalizedPositions, {
        sourceId: `SRC_PORTFOLIO_${portfolio.id}`,
        sourceType: 'FILE'
      });

      return reconciled.newState;
    } catch (err: any) {
      console.warn('[PositionAlertRuntime] Error deriving portfolio state (fail-closed):', err?.message || err);
      return PortfolioReconciliationEngine.getInstance().createInitialState();
    }
  }

  // =========================================================================
  // CANONICAL EVENT INGESTION HOOK
  // =========================================================================

  /**
   * Main runtime entry point called when News Core V2 produces/accepts a new structured article.
   * Fully protected with error isolation: Errors NEVER propagate to News Core V2.
   */
  public async onCanonicalArticle(article: NewsArticleV2 | any): Promise<PositionAlertCandidate[]> {
    try {
      // 1. Runtime Feature Flag & Hard Kill Switch Gate: Fail-Closed
      if (!PositionAlertRuntimeGuard.isDeliveryPermitted()) {
        return [];
      }

      // 2. Map canonical article using deterministic adapter
      const eventInput = NewsCoreV2PositionAlertAdapter.adapt(article);
      if (!eventInput) {
        return [];
      }

      return await this.evaluateEvent(eventInput);
    } catch (err: any) {
      // Complete runtime error isolation: Never break News Core V2
      console.warn('[PositionAlertRuntime] Isolated alert evaluation error:', err?.message || err);
      return [];
    }
  }

  /**
   * Evaluates a structured news event against active positions.
   */
  public async evaluateEvent(eventInput: PositionNewsEventInput): Promise<PositionAlertCandidate[]> {
    try {
      // 1. Runtime Feature Flag & Hard Kill Switch Gate: Fail-Closed
      if (!PositionAlertRuntimeGuard.isDeliveryPermitted()) {
        return [];
      }

      this.processedEventsCount++;

      // 2. Obtain current reconciled portfolio state
      const state = await this.getAuthoritativePortfolioState();

      // 3. Source Status & Active Positions Gates (Fail-Closed)
      if (
        state.sourceStatus === 'INVALID_SOURCE' ||
        state.sourceStatus === 'SOURCE_ERROR' ||
        state.sourceStatus === 'UNAVAILABLE' ||
        state.sourceStatus === 'VALID_EMPTY_PORTFOLIO' ||
        state.presenceState === 'NO_POSITION' ||
        !state.activePositions ||
        state.activePositions.size === 0 ||
        state.totalActivePositions === 0
      ) {
        return [];
      }

      // 4. Delegate to PositionAlertIntelligenceEngine for:
      //    - Closed position isolation (active positions only, quantity > 0)
      //    - Strict entity matching (exact ISIN, symbol, exchange:symbol, underlying, entity identifier)
      //    - Generic market noise suppression (macro benchmarks suppressed unless explicitly held)
      //    - Persistent deduplication
      //    - Private Telegram notification
      const candidates = await this.intelligenceEngine.processEvent(eventInput, state);
      this.generatedAlertsCount += candidates.length;

      return candidates;
    } catch (err: any) {
      console.warn('[PositionAlertRuntime] Intelligence processing failure (isolated):', err?.message || err);
      return [];
    }
  }

  /**
   * Public test and runtime evaluation method accepting NewsArticleV2.
   */
  public async evaluateArticle(article: NewsArticleV2 | any): Promise<PositionAlertCandidate[]> {
    return this.onCanonicalArticle(article);
  }
}

export const positionAlertRuntime = PositionAlertRuntime.getInstance();
