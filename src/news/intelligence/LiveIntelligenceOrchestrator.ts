/**
 * ATHENA NEWS ENGINE — PHASE 10.1
 * LiveIntelligenceOrchestrator.ts
 * 
 * Continuous Live Intelligence Orchestrator.
 * Connects Article Ingestion -> Event Cluster -> Live Market Data -> Volume -> F&O -> Confirmation -> Trader Decision -> Telegram & UI
 * 
 * Enforces:
 * - Immediate incremental processing (zero batch-waiting)
 * - Zero AI cost for deterministic steps
 * - Exact-once telegram dispatch with revision-aware idempotency
 * - Non-fabrication of unavailable market/F&O data
 */

import { NewsArticle } from '../types/Article';
import { NewsEvent } from '../types/NewsEvent';
import { EventCentricOrchestrator, EventOrchestrationResult } from './EventCentricOrchestrator';
import { SourceArticleExtractionGate } from './SourceArticleExtractionGate';
import { SummaryQualityGate } from './SummaryQualityGate';
import { marketDataProviderManager } from '../market-data/MarketDataProvider';
import { LiveMarketReactionEngine, MarketReactionSnapshot } from './LiveMarketReactionEngine';
import { MarketVolumeConfirmationEngine, VolumeConfirmationSnapshot } from './MarketVolumeConfirmationEngine';
import { FnoPositioningEngine, FnoPositioningSnapshot } from './FnoPositioningEngine';
import { MarketConfirmationEngine, MarketConfirmationDossier } from './MarketConfirmationEngine';
import { TraderDecisionSupportEngine, ProductionDossier } from './TraderDecisionSupportEngine';
import { MarketPulseEngine } from './MarketPulseEngine';
import { SectorIntelligenceEngine } from './SectorIntelligenceEngine';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';
import { TraderIntelligenceCache } from '../cache/TraderIntelligenceCache';
import { INewsStore } from '../storage/NewsStore';
import { JsonNewsStore } from '../storage/JsonNewsStore';
import { marketIntelligenceFusionEngine, MarketSignal } from './MarketIntelligenceFusionEngine.ts';

export interface LiveIntelligenceTelemetry {
  articleToEventLatencyMs: number;
  eventToMarketDataLatencyMs: number;
  marketDataToConfirmationLatencyMs: number;
  eventToTelegramLatencyMs: number;
  articleToTelegramDispatchLatencyMs: number;
  totalLatencyMs: number;
  timestamp: string;
}

export interface LiveIntelligenceResult {
  articleId: string;
  eventId: string;
  isNewEvent: boolean;
  eventRevision: number;
  extractionPassed: boolean;
  summaryPassed: boolean;
  symbol: string;
  marketDataStatus: 'AVAILABLE' | 'MARKET_DATA_UNAVAILABLE' | 'QUARANTINED';
  marketReaction?: MarketReactionSnapshot;
  volumeConfirmation?: VolumeConfirmationSnapshot;
  fnoPositioning?: FnoPositioningSnapshot;
  marketConfirmation?: MarketConfirmationDossier;
  traderDossier?: ProductionDossier;
  signal?: MarketSignal;
  telegramDispatched: boolean;
  telegramAction?: string;
  telemetry: LiveIntelligenceTelemetry;
}

export class LiveIntelligenceOrchestrator {
  private static instance: LiveIntelligenceOrchestrator;
  private cache: Map<string, LiveIntelligenceResult> = new Map();
  private telemetryHistory: LiveIntelligenceTelemetry[] = [];

  private constructor() {}

  public static getInstance(): LiveIntelligenceOrchestrator {
    if (!LiveIntelligenceOrchestrator.instance) {
      LiveIntelligenceOrchestrator.instance = new LiveIntelligenceOrchestrator();
    }
    return LiveIntelligenceOrchestrator.instance;
  }

  public static resetInstance(): LiveIntelligenceOrchestrator {
    LiveIntelligenceOrchestrator.instance = new LiveIntelligenceOrchestrator();
    return LiveIntelligenceOrchestrator.instance;
  }

  /**
   * Main incremental processing pipeline for newly arrived / updated articles.
   */
  public async processArticle(
    article: Partial<NewsArticle>,
    store?: INewsStore
  ): Promise<LiveIntelligenceResult> {
    const startTime = Date.now();
    const articleId = article.id || `art_${startTime}_${Math.random().toString(36).slice(2, 7)}`;
    const effectiveStore = store || new JsonNewsStore();

    // Timestamps for latency tracking
    let eventResolvedAt = startTime;
    let marketDataResolvedAt = startTime;
    let confirmationResolvedAt = startTime;
    let telegramDispatchedAt = startTime;

    // 1. Source Article Extraction Gate
    const extractionGateResult = SourceArticleExtractionGate.evaluate(article);
    const extractionPassed = extractionGateResult.diagnostic?.extractionStatus === 'SUCCESS';

    // 2. Summary Quality Gate
    const summaryGateResult = SummaryQualityGate.evaluate(article);
    const summaryPassed = summaryGateResult.passed;

    // 3. Resolve event fingerprint & create/update event cluster
    const eventOrchestrator = EventCentricOrchestrator.getInstance();
    const orchResult: EventOrchestrationResult = eventOrchestrator.processArticle(article);
    const event: NewsEvent = orchResult.event;
    eventResolvedAt = Date.now();

    const symbol = (event.symbol && event.symbol !== 'MARKET' ? event.symbol : (article as any).symbol || 'NIFTY').toUpperCase();

    // 4. Register required market-data observation & check provider status
    let marketDataStatus: 'AVAILABLE' | 'MARKET_DATA_UNAVAILABLE' | 'QUARANTINED' = 'AVAILABLE';
    let marketReaction: MarketReactionSnapshot | undefined;
    let volumeConfirmation: VolumeConfirmationSnapshot | undefined;
    let fnoPositioning: FnoPositioningSnapshot | undefined;
    let marketConfirmation: MarketConfirmationDossier | undefined;

    try {
      const mode = marketDataProviderManager.getMode();
      // Perform observation check
      const equityObs = await marketDataProviderManager.getEquityObservation(symbol);
      marketDataResolvedAt = Date.now();

      if (!equityObs || (equityObs.provenance?.providerType === 'TEST_PROVIDER' && mode === 'PRODUCTION')) {
        marketDataStatus = 'MARKET_DATA_UNAVAILABLE';
      }

      // 5. Calculate Live Market Reaction, Volume, F&O, & Market Confirmation
      if (marketDataStatus === 'AVAILABLE') {
        marketReaction = LiveMarketReactionEngine.calculate(symbol, event.firstSeenAt);
        volumeConfirmation = MarketVolumeConfirmationEngine.evaluate(
          symbol,
          event.firstSeenAt,
          marketReaction.percentagePriceChange
        );
        fnoPositioning = FnoPositioningEngine.calculate(
          symbol,
          event.firstSeenAt,
          marketReaction.percentagePriceChange
        );

        // Fundamental Direction from article/event
        const headlineText = `${article.headline || article.title || ''} ${event.canonicalSummary?.whatHappened || ''}`.toLowerCase();
        let fundamentalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = 'NEUTRAL';
        if (/win|bags|profit|growth|surge|bull|upgrade|record|dividend/i.test(headlineText)) {
          fundamentalDirection = 'BULLISH';
        } else if (/loss|drop|fall|penalty|down|probe|raid|fraud|slash/i.test(headlineText)) {
          fundamentalDirection = 'BEARISH';
        }

        marketConfirmation = MarketConfirmationEngine.process(
          symbol,
          event.firstSeenAt,
          fundamentalDirection
        );
        confirmationResolvedAt = Date.now();
      }
    } catch (err) {
      console.warn(`[LiveIntelligenceOrchestrator] Market data evaluation fallback for ${symbol}:`, err);
      marketDataStatus = 'MARKET_DATA_UNAVAILABLE';
    }

    // 6. Generate Trader Decision Support Dossier
    let traderDossier: ProductionDossier | undefined;
    try {
      traderDossier = TraderDecisionSupportEngine.generate({
        ...article,
        id: articleId,
        headline: article.headline || article.title || 'Market Event',
        publishedAt: article.publishedAt || event.firstSeenAt
      });
      // Attach market confirmation details to dossier if available
      if (marketConfirmation && traderDossier) {
        traderDossier.marketReaction = {
          status: marketConfirmation.priceReaction.availability === 'AVAILABLE' ? 'VERIFIED' : 'UNKNOWN',
          direction: (marketConfirmation.priceReaction.reactionDirection as any) || 'UNKNOWN',
          evidenceText: marketConfirmation.marketInterpretation
        };
      }
    } catch (dossierErr) {
      console.warn(`[LiveIntelligenceOrchestrator] Decision support dossier error for ${articleId}:`, dossierErr);
    }

    // 7. Update Market Pulse incrementally
    try {
      MarketPulseEngine.getInstance().updateIncremental(event, marketConfirmation, effectiveStore);
    } catch (pulseErr) {
      console.warn(`[LiveIntelligenceOrchestrator] MarketPulse incremental update error:`, pulseErr);
    }

    // 8. Update Sector Intelligence incrementally
    try {
      SectorIntelligenceEngine.getInstance().updateSectorIncremental(symbol, event, effectiveStore);
    } catch (sectorErr) {
      console.warn(`[LiveIntelligenceOrchestrator] SectorIntelligence incremental update error:`, sectorErr);
    }

    // 9. Update Symbol/Event Intelligence Caches
    if (traderDossier) {
      TraderIntelligenceCache.getInstance().set(articleId, traderDossier as any, 'v10_1');
    }

    // 9.5 Construct Fused Signal using MarketIntelligenceFusionEngine
    const signal = marketIntelligenceFusionEngine.fuse(
      event,
      article,
      marketConfirmation,
      traderDossier
    );

    // 10. Telegram Immediate Dispatch for eligible/material events
    let telegramDispatched = false;
    let telegramAction = orchResult.telegramAction;

    const isDispatchEligible = 
      (signal.priority === 'P0_CRITICAL' || signal.priority === 'P1_HIGH') &&
      !signal.warnings.includes('PROVIDER_CONFLICT') &&
      !signal.warnings.includes('MARKET_DATA_STALE') &&
      !signal.warnings.includes('MARKET_DATA_EXPIRED') &&
      !signal.warnings.includes('EXTRACTION_FAILED') &&
      signal.alignment !== 'INSUFFICIENT_EVIDENCE' &&
      signal.lifecycleState !== 'EXPIRED' &&
      extractionPassed &&
      summaryPassed;

    if (isDispatchEligible) {
      try {
        const dispatchRes = await TelegramNotificationPipeline.getInstance().dispatchImmediately(
          {
            ...article,
            id: articleId,
            headline: article.headline || article.title || event.canonicalSummary?.whatHappened || 'ATHENA Alert'
          },
          {
            isLive: true,
            forceDispatch: orchResult.isMaterialUpdate || orchResult.isEscalation,
            priority: signal.priority === 'P0_CRITICAL' ? 1 : 2
          }
        );
        telegramDispatched = dispatchRes.dispatched;
        telegramDispatchedAt = Date.now();
      } catch (teleErr) {
        console.warn(`[LiveIntelligenceOrchestrator] Immediate Telegram dispatch failed for ${articleId}:`, teleErr);
      }
    }

    // Calculate Telemetry
    const endTime = Date.now();
    const telemetry: LiveIntelligenceTelemetry = {
      articleToEventLatencyMs: Math.max(0, eventResolvedAt - startTime),
      eventToMarketDataLatencyMs: Math.max(0, marketDataResolvedAt - eventResolvedAt),
      marketDataToConfirmationLatencyMs: Math.max(0, confirmationResolvedAt - marketDataResolvedAt),
      eventToTelegramLatencyMs: Math.max(0, telegramDispatchedAt - eventResolvedAt),
      articleToTelegramDispatchLatencyMs: Math.max(0, telegramDispatchedAt - startTime),
      totalLatencyMs: Math.max(0, endTime - startTime),
      timestamp: new Date().toISOString()
    };

    this.telemetryHistory.push(telemetry);
    if (this.telemetryHistory.length > 500) {
      this.telemetryHistory.shift();
    }

    const result: LiveIntelligenceResult = {
      articleId,
      eventId: event.eventId,
      isNewEvent: orchResult.isNewEvent,
      eventRevision: event.sourceCount || 1,
      extractionPassed,
      summaryPassed,
      symbol,
      marketDataStatus,
      marketReaction,
      volumeConfirmation,
      fnoPositioning,
      marketConfirmation,
      traderDossier,
      signal,
      telegramDispatched,
      telegramAction,
      telemetry
    };

    this.cache.set(articleId, result);
    return result;
  }

  public getResultByArticleId(articleId: string): LiveIntelligenceResult | undefined {
    return this.cache.get(articleId);
  }

  public getTelemetryHistory(): LiveIntelligenceTelemetry[] {
    return [...this.telemetryHistory];
  }

  public getAverageDispatchLatencyMs(): number {
    const sent = this.telemetryHistory.filter(t => t.articleToTelegramDispatchLatencyMs > 0);
    if (sent.length === 0) return 0;
    const sum = sent.reduce((acc, t) => acc + t.articleToTelegramDispatchLatencyMs, 0);
    return Math.round(sum / sent.length);
  }

  public reset(): void {
    this.cache.clear();
    this.telemetryHistory = [];
  }
}

export const liveIntelligenceOrchestrator = LiveIntelligenceOrchestrator.getInstance();
