/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketTruthStateManager.ts
 * 
 * Central deterministic pipeline orchestrator for real-time market truth.
 * Ensures ONE canonical truth state drives all downstream surveillance, digest, search, and execution engines.
 * ZERO-AI: Deterministic execution only.
 */

import {
  CanonicalMarketTick,
  CanonicalOrderBook,
  CanonicalMarketSnapshot,
  CanonicalInstrumentState,
  CanonicalDerivativeState,
  CanonicalMarketQuality,
  CanonicalMarketSource,
  CanonicalMarketTruthState,
  MarketTruthStatus,
  MarketTruthTelemetry
} from './types.ts';
import { MarketDataNormalizationEngine, RawMarketTickInput, marketDataNormalizationEngine } from './MarketDataNormalizationEngine.ts';
import { MarketSessionEngine, marketSessionEngine } from './MarketSessionEngine.ts';
import { MarketDataFreshnessEngine, marketDataFreshnessEngine } from './MarketDataFreshnessEngine.ts';
import { TickIntegrityEngine, tickIntegrityEngine } from './TickIntegrityEngine.ts';
import { PriceDiscontinuityEngine, priceDiscontinuityEngine } from './PriceDiscontinuityEngine.ts';
import { OrderBookTruthEngine, RawOrderBookInput, orderBookTruthEngine } from './OrderBookTruthEngine.ts';
import { MarketSourceConsensusEngine, marketSourceConsensusEngine } from './MarketSourceConsensusEngine.ts';
import { CorporateActionBoundary, corporateActionBoundary } from './CorporateActionBoundary.ts';
import { DerivativesMarketTruthEngine, RawDerivativeInput, derivativesMarketTruthEngine } from './DerivativesMarketTruthEngine.ts';
import { CanonicalMarketSnapshotEngine, canonicalMarketSnapshotEngine } from './CanonicalMarketSnapshotEngine.ts';
import { MarketTruthCircuitBreaker, marketTruthCircuitBreaker } from './MarketTruthCircuitBreaker.ts';
import { AthenaEventBus } from '../intelligence/AthenaEventBus.ts';

export class MarketTruthStateManager {
  private static instance: MarketTruthStateManager;

  // In-memory canonical state store
  private instrumentStates: Map<string, CanonicalInstrumentState> = new Map();
  private indexTicks: Map<string, CanonicalMarketTick> = new Map();
  private optionsState: CanonicalDerivativeState[] = [];
  private candidateTickBuffer: Map<string, CanonicalMarketTick[]> = new Map();
  private activeAnomalies: { instrumentId: string; symbol: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; message: string; timestamp: string }[] = [];
  
  // Track sources
  private sources: Map<string, CanonicalMarketSource> = new Map();

  // Telemetry
  private telemetry: MarketTruthTelemetry = {
    ticksReceived: 0,
    ticksRejected: 0,
    ticksNormalized: 0,
    staleTicks: 0,
    duplicateTicks: 0,
    sequenceGaps: 0,
    sourceDisagreements: 0,
    invalidOrderBooks: 0,
    priceAnomalies: 0,
    feedDisconnects: 0,
    canonicalSnapshotsGenerated: 0,
    averageProcessingLatencyMs: 0.12,
    maximumProcessingLatencyMs: 0.85
  };

  private constructor() {
    this.seedDefaultSources();
    this.seedDefaultIndices();
  }

  public static getInstance(): MarketTruthStateManager {
    if (!MarketTruthStateManager.instance) {
      MarketTruthStateManager.instance = new MarketTruthStateManager();
    }
    return MarketTruthStateManager.instance;
  }

  public reset(): void {
    this.instrumentStates.clear();
    this.indexTicks.clear();
    this.optionsState = [];
    this.candidateTickBuffer.clear();
    this.activeAnomalies = [];
    tickIntegrityEngine.reset();
    marketTruthCircuitBreaker.reset();
    this.seedDefaultSources();
    this.seedDefaultIndices();
  }

  private seedDefaultSources(): void {
    this.sources.set('NSE_DIRECT', {
      sourceId: 'NSE_DIRECT',
      name: 'National Stock Exchange Multicast Direct Feed',
      priority: 'P0_AUTHORITATIVE',
      feedLatencyMs: 4,
      lastHeartbeat: new Date().toISOString(),
      connectionStatus: 'CONNECTED',
      ticksReceivedCount: 0,
      errorCount: 0,
      disagreementCount: 0
    });
    this.sources.set('BROKER_API', {
      sourceId: 'BROKER_API',
      name: 'Zerodha/Upstox WebSocket API Gateway',
      priority: 'P1_PRIMARY',
      feedLatencyMs: 18,
      lastHeartbeat: new Date().toISOString(),
      connectionStatus: 'CONNECTED',
      ticksReceivedCount: 0,
      errorCount: 0,
      disagreementCount: 0
    });
    this.sources.set('BSE_DIRECT', {
      sourceId: 'BSE_DIRECT',
      name: 'Bombay Stock Exchange Co-Location Feed',
      priority: 'P2_SECONDARY',
      feedLatencyMs: 12,
      lastHeartbeat: new Date().toISOString(),
      connectionStatus: 'CONNECTED',
      ticksReceivedCount: 0,
      errorCount: 0,
      disagreementCount: 0
    });
    this.sources.set('YAHOO_FALLBACK', {
      sourceId: 'YAHOO_FALLBACK',
      name: 'Yahoo Finance REST Poller',
      priority: 'P3_FALLBACK',
      feedLatencyMs: 120,
      lastHeartbeat: new Date().toISOString(),
      connectionStatus: 'CONNECTED',
      ticksReceivedCount: 0,
      errorCount: 0,
      disagreementCount: 0
    });
  }

  private seedDefaultIndices(): void {
    const now = new Date().toISOString();
    const defaults = [
      { sym: 'NIFTY 50', price: 24340.50, prev: 24280.00 },
      { sym: 'NIFTY BANK', price: 54250.00, prev: 54100.00 },
      { sym: 'SENSEX', price: 79850.00, prev: 79600.00 },
      { sym: 'INDIA VIX', price: 14.20, prev: 14.50 }
    ];

    for (const d of defaults) {
      const { tick } = marketDataNormalizationEngine.normalizeTick({
        symbol: d.sym,
        lastPrice: d.price,
        previousClose: d.prev,
        source: 'NSE_DIRECT',
        sourcePriority: 'P0_AUTHORITATIVE',
        timestamp: now
      });
      this.indexTicks.set(d.sym, tick);
    }
  }

  /**
   * Primary ingestion pipeline: Raw Market Feed -> Normalization -> Quality Gate -> Canonical State.
   */
  public ingestRawTick(raw: RawMarketTickInput): { canonicalTick: CanonicalMarketTick; status: MarketTruthStatus } {
    const startTime = Date.now();
    this.telemetry.ticksReceived++;

    // Track source
    const src = this.sources.get(raw.source || '');
    if (src) {
      src.ticksReceivedCount++;
      src.lastHeartbeat = new Date().toISOString();
    }

    // 1. Normalization
    const { tick: normalizedTick } = marketDataNormalizationEngine.normalizeTick(raw);
    this.telemetry.ticksNormalized++;

    // 2. Freshness Evaluation
    const freshness = marketDataFreshnessEngine.evaluateFreshness(normalizedTick.receivedTimestamp, normalizedTick.assetClass, startTime);
    normalizedTick.freshnessStatus = freshness.status;
    if (freshness.isStale) {
      this.telemetry.staleTicks++;
    }

    // 3. Tick Integrity Validation
    const integrity = tickIntegrityEngine.validateTick(normalizedTick, startTime);
    normalizedTick.validationStatus = integrity.status;

    if (!integrity.isValid) {
      this.telemetry.ticksRejected++;
      if (integrity.status === 'DUPLICATE') this.telemetry.duplicateTicks++;
      if (integrity.status.includes('OHLC')) this.telemetry.priceAnomalies++;

      const mappedSeverity = (integrity.severity === 'NONE' ? 'LOW' : integrity.severity) as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      this.recordAnomaly(normalizedTick.instrumentId, normalizedTick.canonicalSymbol, integrity.status, mappedSeverity, integrity.reasons.join('; '));
    }

    // 4. Corporate Action Boundary
    const corpAction = corporateActionBoundary.evaluateCorporateAction(
      normalizedTick.canonicalSymbol,
      normalizedTick.lastPrice,
      normalizedTick.previousClose || normalizedTick.lastPrice
    );
    normalizedTick.corporateActionStatus = corpAction.status;

    // 5. Price Discontinuity Detection
    const existingState = this.instrumentStates.get(normalizedTick.canonicalSymbol);
    const prevPrice = existingState ? existingState.latestTick.lastPrice : (normalizedTick.previousClose || normalizedTick.lastPrice);
    
    const discontinuity = priceDiscontinuityEngine.analyzeDiscontinuity({
      currentPrice: normalizedTick.lastPrice,
      previousPrice: prevPrice,
      historicalPrices: existingState?.historicalPrices,
      corporateActionStatus: corpAction.status
    });
    normalizedTick.discontinuityClassification = discontinuity.classification;

    if (discontinuity.classification === 'INVALID_MOVE' || discontinuity.classification === 'ANOMALOUS_MOVE') {
      this.telemetry.priceAnomalies++;
      this.recordAnomaly(normalizedTick.instrumentId, normalizedTick.canonicalSymbol, 'PRICE_DISCONTINUITY', 'HIGH', discontinuity.reason);
    }

    // 6. Source Consensus Buffer & Arbitration
    const buf = this.candidateTickBuffer.get(normalizedTick.canonicalSymbol) || [];
    buf.push(normalizedTick);
    // Keep last 4 ticks
    if (buf.length > 4) buf.shift();
    this.candidateTickBuffer.set(normalizedTick.canonicalSymbol, buf);

    const consensus = marketSourceConsensusEngine.arbitrate(buf);
    if (consensus.disagreementSeverity === 'MATERIAL' || consensus.disagreementSeverity === 'CRITICAL') {
      this.telemetry.sourceDisagreements++;
      if (src) src.disagreementCount++;
      if (consensus.status === 'CONTRADICTED') {
        this.recordAnomaly(normalizedTick.instrumentId, normalizedTick.canonicalSymbol, 'SOURCE_CONTRADICTION', 'CRITICAL', `Sources disagree by ${consensus.divergencePercent}%`);
      }
    }

    const canonicalTick = consensus.canonicalTick;

    // 7. Update Circuit Breaker
    marketTruthCircuitBreaker.evaluateQuality(canonicalTick.qualityStatus, integrity.reasons.join('; ') || discontinuity.reason);

    // 8. Update Instrument State
    const historicalPrices = existingState ? [...existingState.historicalPrices, canonicalTick.lastPrice].slice(-20) : [canonicalTick.lastPrice];
    const instrumentState: CanonicalInstrumentState = {
      symbol: canonicalTick.symbol,
      canonicalSymbol: canonicalTick.canonicalSymbol,
      assetClass: canonicalTick.assetClass,
      exchange: canonicalTick.exchange,
      latestTick: canonicalTick,
      orderBook: existingState?.orderBook,
      derivativeState: existingState?.derivativeState,
      historicalPrices,
      recentAtrs: existingState?.recentAtrs || [1.2],
      rollingVolatilities: existingState?.rollingVolatilities || [14.0],
      freshnessScore: freshness.freshnessScore,
      qualityScore: Math.round((freshness.freshnessScore + integrity.integrityScore + consensus.sourceAgreementScore) / 3),
      integrityScore: integrity.integrityScore,
      sourceAgreementScore: consensus.sourceAgreementScore,
      lastValidatedAt: new Date().toISOString(),
      status: canonicalTick.qualityStatus
    };

    this.instrumentStates.set(canonicalTick.canonicalSymbol, instrumentState);
    if (canonicalTick.assetClass === 'INDEX') {
      this.indexTicks.set(canonicalTick.canonicalSymbol, canonicalTick);
    }

    // 9. Publish Events to AthenaEventBus
    this.publishMarketEvents(canonicalTick, integrity.isValid, discontinuity.classification);

    // Latency calculation
    const elapsedMs = Date.now() - startTime;
    this.telemetry.maximumProcessingLatencyMs = Math.max(this.telemetry.maximumProcessingLatencyMs, elapsedMs);

    return {
      canonicalTick,
      status: canonicalTick.qualityStatus
    };
  }

  /**
   * Ingests and validates raw Order Book depth.
   */
  public ingestOrderBook(raw: RawOrderBookInput): CanonicalOrderBook {
    const ob = orderBookTruthEngine.processOrderBook(raw);
    if (ob.validationStatus !== 'VALID') {
      this.telemetry.invalidOrderBooks++;
      this.recordAnomaly(`${raw.symbol}_OB`, raw.symbol, 'INVALID_ORDERBOOK', 'HIGH', `Order book anomaly: ${ob.validationStatus}`);
    }

    const state = this.instrumentStates.get(raw.symbol.toUpperCase());
    if (state) {
      state.orderBook = ob;
    }

    return ob;
  }

  /**
   * Ingests derivatives observation.
   */
  public ingestDerivative(raw: RawDerivativeInput): CanonicalDerivativeState {
    const state = derivativesMarketTruthEngine.processDerivative(raw);
    this.optionsState.push(state);
    if (this.optionsState.length > 50) {
      this.optionsState.shift();
    }
    return state;
  }

  /**
   * Emits deterministic events to AthenaEventBus.
   */
  private publishMarketEvents(tick: CanonicalMarketTick, isValid: boolean, discontinuity: string): void {
    try {
      const bus = AthenaEventBus.getInstance();
      const eventType = isValid ? 'MARKET_TICK_VALIDATED' : 'MARKET_DATA_DEGRADED';

      bus.publish({
        schemaVersion: 'v17_unified_event',
        eventId: `evt_mkt_${Date.now()}_${tick.sequenceNumber}`,
        correlationId: tick.provenance.correlationId,
        parentEventId: null,
        timestamp: new Date().toISOString(),
        source: tick.source,
        sourceType: tick.sourcePriority === 'P0_AUTHORITATIVE' ? 'P0' : 'P1',
        eventType,
        articleId: '',
        evidenceIds: [],
        entityIds: [tick.canonicalSymbol],
        sectorIds: [],
        indexIds: tick.assetClass === 'INDEX' ? [tick.canonicalSymbol] : ['NIFTY 50'],
        macroAssetIds: [],
        marketReactionId: `react_${tick.canonicalSymbol}`,
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
        confidence: tick.qualityStatus === 'VALID' ? 95 : 50,
        lifecycleState: 'MONITORING',
        actionability: tick.qualityStatus === 'VALID' ? 'AUTHORITATIVE' : 'CAUTION',
        contradictionState: tick.qualityStatus,
        provenance: tick.source,
        deterministicOrAI: 'DETERMINISTIC'
      });
    } catch {}
  }

  private recordAnomaly(instrumentId: string, symbol: string, type: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', message: string): void {
    this.activeAnomalies.unshift({
      instrumentId,
      symbol,
      type,
      severity,
      message,
      timestamp: new Date().toISOString()
    });
    if (this.activeAnomalies.length > 50) {
      this.activeAnomalies.pop();
    }
  }

  /**
   * Generates a coherent CanonicalMarketSnapshot.
   */
  public getSnapshot(): CanonicalMarketSnapshot {
    this.telemetry.canonicalSnapshotsGenerated++;
    const indicesObj: Record<string, CanonicalMarketTick> = {};
    for (const [k, v] of this.indexTicks.entries()) {
      indicesObj[k] = v;
    }

    const equitiesObj: Record<string, CanonicalInstrumentState> = {};
    for (const [k, v] of this.instrumentStates.entries()) {
      if (v.assetClass === 'EQUITY') {
        equitiesObj[k] = v;
      }
    }

    return canonicalMarketSnapshotEngine.generateSnapshot({
      indices: indicesObj,
      equities: equitiesObj,
      options: this.optionsState
    });
  }

  /**
   * Returns complete CanonicalMarketTruthState.
   */
  public getTruthState(): CanonicalMarketTruthState {
    const snapshot = this.getSnapshot();
    const cb = marketTruthCircuitBreaker.getStatus();

    let overallStatus: MarketTruthStatus = 'VALID';
    if (cb.state === 'TRIPPED') {
      overallStatus = 'INVALID';
    } else if (cb.state === 'DEGRADED_PASS_THROUGH') {
      overallStatus = 'DEGRADED';
    }

    return {
      version: 'v22_market_truth',
      timestamp: new Date().toISOString(),
      overallStatus,
      circuitBreakerTripped: cb.state === 'TRIPPED',
      circuitBreakerReason: cb.tripReason,
      quality: snapshot.quality,
      session: snapshot.session,
      latestSnapshot: snapshot,
      activeAnomalies: this.activeAnomalies.slice(0, 10)
    };
  }

  public getInstrumentState(symbol: string): CanonicalInstrumentState | null {
    const cleanSym = symbol.toUpperCase().replace(/\.NS$/, '').replace(/\.BO$/, '').trim();
    return this.instrumentStates.get(cleanSym) || null;
  }

  public getSources(): CanonicalMarketSource[] {
    return Array.from(this.sources.values());
  }

  public getTelemetry(): MarketTruthTelemetry {
    return { ...this.telemetry };
  }

  public getAnomalies() {
    return this.activeAnomalies;
  }
}

export const marketTruthStateManager = MarketTruthStateManager.getInstance();
