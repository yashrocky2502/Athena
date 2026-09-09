/**
 * ATHENA NEWS ENGINE — PHASE 11
 * EventToSignalTransmissionEngine.ts
 * 
 * Continuous Event-to-Signal Transmission Layer.
 * Pipeline:
 * EVENT → ENTITY → SECTOR/INDEX/MACRO → PRICE REACTION → VOLUME REACTION → F&O REACTION → SIGNAL → LIFECYCLE → HISTORICAL OUTCOME
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic mathematical rules, zero LLM dependencies for critical pricing, signals, or lifecycle transitions.
 */

import { NewsArticle } from '../types/Article.ts';
import { entityImpactResolver, EntityImpactResolutionResult } from './EntityImpactResolver.ts';
import { deterministicMarketReactionEngine, ComprehensiveMarketReaction } from './DeterministicMarketReactionEngine.ts';
import { eventTransmissionGraph, TransmissionGraphDossier, TransmissionAlignment, TransmissionGraphNode, TransmissionGraphEdge } from './EventTransmissionGraph.ts';
import { CanonicalNewsSummaryEngine } from '../../newsCoreV2/summary/CanonicalNewsSummaryEngine.ts';
import { SummaryQualityGate } from '../../newsCoreV2/summary/SummaryQualityGate.ts';
import { historicalPerformanceAnalyticsEngine } from '../market-intelligence/HistoricalPerformanceAnalyticsEngine.ts';
import { signalLifecycleEngine } from './SignalLifecycleEngine.ts';
import { MarketPulseEngine } from './MarketPulseEngine.ts';
import { FnoPositioningEngine } from './FnoPositioningEngine.ts';
import { MarketVolumeConfirmationEngine } from './MarketVolumeConfirmationEngine.ts';

export type ActionabilityState = 'TRADEABLE' | 'WATCH' | 'NO_TRADE' | 'INSUFFICIENT_EVIDENCE';

export type TransmissionPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW' | 'WATCH_ONLY';

export interface TransmissionScoreBreakdown {
  eventMateriality: number;     // 15% max
  priceConfirmation: number;    // 15% max
  volumeConfirmation: number;   // 15% max
  sectorConfirmation: number;   // 10% max
  indexConfirmation: number;    // 10% max
  fnoConfirmation: number;      // 15% max
  historicalPrecedent: number;  // 10% max
  dataQualityFreshness: number; // 10% max
  regimeMultiplier: number;     // 0.8x to 1.2x modifier (non-fabricating)
  totalScore: number;           // 0 - 100
}

export interface TransmissionSignalResult {
  signalId: string;
  eventId: string;
  articleId: string;
  symbol: string;
  headline: string;
  canonicalSummary: string;
  whyItMatters: string;
  entityResolution: EntityImpactResolutionResult;
  marketReaction: ComprehensiveMarketReaction;
  fnoPositioning: any;
  historicalPrecedent: {
    sampleSize: number;
    sampleQuality: 'INSUFFICIENT_SAMPLE' | 'LIMITED_SAMPLE' | 'VALID_HISTORICAL_SAMPLE';
    historicalWinRatePct?: number;
    averageMfePct?: number;
    averageMaePct?: number;
  };
  marketRegime: string;
  transmissionScore: number;
  scoreBreakdown: TransmissionScoreBreakdown;
  priority: TransmissionPriority;
  alignment: TransmissionAlignment;
  lifecycleState: 'NEW' | 'ACTIVE' | 'CONFIRMED' | 'WEAKENING' | 'CONTRADICTED' | 'EXPIRED' | 'INVALIDATED';
  actionability: ActionabilityState;
  actionabilityRationale: string;
  contradictions: string[];
  warnings: string[];
  graphDossier: TransmissionGraphDossier;
  telegramMessage: string;
  timestamp: string;
  revision: number;
}

export interface TransmissionObservability {
  eventsProcessed: number;
  signalsGenerated: number;
  signalsUpdated: number;
  signalsConfirmed: number;
  signalsWeakening: number;
  signalsContradicted: number;
  signalsExpired: number;
  cacheHits: number;
  cacheMisses: number;
  providerConflicts: number;
  staleDataWarnings: number;
  averageTransmissionScore: number;
  eventToSignalLatencyMs: number[];
  reactionDetectionLatencyMs: number[];
  deterministicExecutionCount: number;
  aiInvocationCount: number;
}

export class EventToSignalTransmissionEngine {
  private static instance: EventToSignalTransmissionEngine;

  private signalCache: Map<string, TransmissionSignalResult> = new Map();
  private signalRevisions: Map<string, number> = new Map();

  private observability: TransmissionObservability = {
    eventsProcessed: 0,
    signalsGenerated: 0,
    signalsUpdated: 0,
    signalsConfirmed: 0,
    signalsWeakening: 0,
    signalsContradicted: 0,
    signalsExpired: 0,
    cacheHits: 0,
    cacheMisses: 0,
    providerConflicts: 0,
    staleDataWarnings: 0,
    averageTransmissionScore: 0,
    eventToSignalLatencyMs: [],
    reactionDetectionLatencyMs: [],
    deterministicExecutionCount: 0,
    aiInvocationCount: 0
  };

  private constructor() {}

  public static getInstance(): EventToSignalTransmissionEngine {
    if (!this.instance) {
      this.instance = new EventToSignalTransmissionEngine();
    }
    return this.instance;
  }

  /**
   * Main Pipeline Entry Point: Translates an Event/Article into a Transmission Signal.
   */
  public transmitEventToSignal(article: NewsArticle | any, forceFresh: boolean = false): TransmissionSignalResult {
    const startTime = Date.now();
    this.observability.eventsProcessed++;
    this.observability.deterministicExecutionCount++;

    const articleId = article.id || article.articleId || 'art-unknown';
    const currentRev = (this.signalRevisions.get(articleId) || 0) + 1;
    this.signalRevisions.set(articleId, currentRev);

    const cacheKey = `${articleId}::rev_${currentRev}`;
    if (!forceFresh && this.signalCache.has(cacheKey)) {
      this.observability.cacheHits++;
      return this.signalCache.get(cacheKey)!;
    }
    this.observability.cacheMisses++;

    const headline = article.headline || article.title || 'Market Event';
    const body = article.body || article.content || '';
    const eventTimestamp = article.publishedAt || new Date().toISOString();

    // 1. STEP 1: Grounded Canonical News Summary Synthesis
    let canonicalSummary = '';
    let whyItMatters = '';
    try {
      const summaryEngine = CanonicalNewsSummaryEngine.getInstance();
      const generated = summaryEngine.generateDeterministicSummary(article);
      canonicalSummary = generated.summary;
      whyItMatters = generated.whyItMatters;
    } catch (e) {
      canonicalSummary = headline;
    }

    // 2. STEP 2: Deterministic Entity Impact Resolution
    const entityResolution = entityImpactResolver.resolve(headline, body, article.entities);
    const symbol = entityResolution.primaryEntity?.symbol || article.symbol || 'NIFTY50';

    // 3. STEP 3: Fundamental Catalyst & Direction Extraction
    const lowerText = `${headline} ${body}`.toLowerCase();
    let fundamentalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = 'NEUTRAL';
    if (/order win|contract|profit jumps|profit surges|q\d results beat|gmp surges|demerger|upgrade|strong revenue/i.test(lowerText)) {
      fundamentalDirection = 'BULLISH';
    } else if (/loss|penalty|sebi ban|litigation|suit|lawsuit|downgrade|fraud|default|resigns|fires/i.test(lowerText)) {
      fundamentalDirection = 'BEARISH';
    }

    // 4. STEP 4: Real-Time Market Reaction Engine
    const reactionStartTime = Date.now();
    const marketReaction = deterministicMarketReactionEngine.evaluateReaction(
      symbol,
      eventTimestamp,
      fundamentalDirection,
      0.4, // estimated sector change
      0.2  // estimated index change
    );
    this.observability.reactionDetectionLatencyMs.push(Date.now() - reactionStartTime);

    // 5. STEP 5: F&O Positioning Context
    let fnoPositioning: any = null;
    try {
      fnoPositioning = FnoPositioningEngine.calculate(symbol, eventTimestamp, marketReaction.totalChangePct);
    } catch (e) {
      fnoPositioning = { classification: 'UNKNOWN', confidence: 0 };
    }

    // 6. STEP 6: Historical Precedent Analytics
    let historicalPrecedent: {
      sampleSize: number;
      sampleQuality: 'INSUFFICIENT_SAMPLE' | 'LIMITED_SAMPLE' | 'VALID_HISTORICAL_SAMPLE';
      historicalWinRatePct?: number;
      averageMfePct?: number;
      averageMaePct?: number;
    } = {
      sampleSize: 0,
      sampleQuality: 'INSUFFICIENT_SAMPLE',
      historicalWinRatePct: undefined,
      averageMfePct: undefined,
      averageMaePct: undefined
    };
    try {
      const perfSummary = historicalPerformanceAnalyticsEngine.getCorePerformanceSummary({ symbol });
      if (perfSummary && perfSummary.sampleSize !== undefined) {
        historicalPrecedent = {
          sampleSize: perfSummary.sampleSize,
          sampleQuality: perfSummary.sampleQuality,
          historicalWinRatePct: perfSummary.winRatePct,
          averageMfePct: perfSummary.averageMfePct,
          averageMaePct: perfSummary.averageMaePct
        };
      }
    } catch (e) {}

    // 7. STEP 7: Market Regime Integration
    const marketRegime = 'RISK_ON'; // e.g. BULL / RISK_ON / HIGH_VOLATILITY

    // 8. STEP 8: Deterministic Alignment Engine
    let alignment: TransmissionAlignment = 'NEUTRAL';
    const contradictions: string[] = [];
    const warnings: string[] = [];

    if (fundamentalDirection === 'BULLISH') {
      if (marketReaction.totalChangePct >= 1.5 && marketReaction.rvol >= 1.4) {
        alignment = 'STRONGLY_CONFIRMED';
      } else if (marketReaction.totalChangePct > 0.3) {
        alignment = 'CONFIRMED';
      } else if (marketReaction.totalChangePct >= -0.3 && marketReaction.totalChangePct <= 0.3) {
        alignment = 'PARTIALLY_CONFIRMED';
      } else if (marketReaction.totalChangePct < -0.8) {
        alignment = 'CONTRADICTED';
        contradictions.push(`Bullish fundamental catalyst contradicted by negative price movement (${marketReaction.totalChangePct}%)`);
      }
    } else if (fundamentalDirection === 'BEARISH') {
      if (marketReaction.totalChangePct <= -1.5 && marketReaction.rvol >= 1.4) {
        alignment = 'STRONGLY_CONFIRMED';
      } else if (marketReaction.totalChangePct < -0.3) {
        alignment = 'CONFIRMED';
      } else if (marketReaction.totalChangePct >= -0.3 && marketReaction.totalChangePct <= 0.3) {
        alignment = 'PARTIALLY_CONFIRMED';
      } else if (marketReaction.totalChangePct > 0.8) {
        alignment = 'CONTRADICTED';
        contradictions.push(`Bearish fundamental catalyst contradicted by positive price surge (+${marketReaction.totalChangePct}%)`);
      }
    }

    if (fnoPositioning && fnoPositioning.classification === 'CONTRADICTORY_FLOW') {
      alignment = 'CONTRADICTED';
      contradictions.push('F&O option flow contradicts spot movement');
    }

    if (alignment === 'CONTRADICTED') {
      this.observability.signalsContradicted++;
    } else if (alignment === 'CONFIRMED' || alignment === 'STRONGLY_CONFIRMED') {
      this.observability.signalsConfirmed++;
    }

    // 9. STEP 9: 0–100 Transmission Score Calculation
    const scoreBreakdown: TransmissionScoreBreakdown = {
      eventMateriality: /order win|q\d|penalty|merger|gmp|sebi/i.test(headline) ? 14 : 10,
      priceConfirmation: (alignment === 'STRONGLY_CONFIRMED') ? 15 : (alignment === 'CONFIRMED' ? 12 : (alignment === 'CONTRADICTED' ? 2 : 7)),
      volumeConfirmation: (marketReaction.rvol >= 2.0) ? 15 : (marketReaction.rvol >= 1.3 ? 12 : 6),
      sectorConfirmation: (marketReaction.sectorRelativePerformancePct > 0) ? 9 : 5,
      indexConfirmation: (marketReaction.indexRelativePerformancePct > 0) ? 9 : 5,
      fnoConfirmation: (fnoPositioning && fnoPositioning.confidence > 70) ? 14 : 8,
      historicalPrecedent: (historicalPrecedent.sampleQuality === 'VALID_HISTORICAL_SAMPLE') ? 10 : (historicalPrecedent.sampleQuality === 'LIMITED_SAMPLE' ? 6 : 2),
      dataQualityFreshness: marketReaction.freshness === 'REAL_TIME' ? 10 : 5,
      regimeMultiplier: marketRegime === 'RISK_ON' && fundamentalDirection === 'BULLISH' ? 1.05 : 1.0,
      totalScore: 0
    };

    const rawSum = scoreBreakdown.eventMateriality +
      scoreBreakdown.priceConfirmation +
      scoreBreakdown.volumeConfirmation +
      scoreBreakdown.sectorConfirmation +
      scoreBreakdown.indexConfirmation +
      scoreBreakdown.fnoConfirmation +
      scoreBreakdown.historicalPrecedent +
      scoreBreakdown.dataQualityFreshness;

    scoreBreakdown.totalScore = Math.min(100, Math.round(rawSum * scoreBreakdown.regimeMultiplier));
    const transmissionScore = scoreBreakdown.totalScore;

    // 10. STEP 10: Priority & Actionability Classification
    let priority: TransmissionPriority = 'P3_LOW';
    if (transmissionScore >= 85 && alignment === 'STRONGLY_CONFIRMED') priority = 'P0_CRITICAL';
    else if (transmissionScore >= 70 && (alignment === 'CONFIRMED' || alignment === 'STRONGLY_CONFIRMED')) priority = 'P1_HIGH';
    else if (transmissionScore >= 50) priority = 'P2_MEDIUM';
    else priority = 'WATCH_ONLY';

    let actionability: ActionabilityState = 'NO_TRADE';
    let actionabilityRationale = '';

    if (alignment === 'CONTRADICTED') {
      actionability = 'NO_TRADE';
      actionabilityRationale = 'Contradictory live price/derivatives reaction observed. Do not initiate directional positions.';
    } else if (historicalPrecedent.sampleQuality === 'INSUFFICIENT_SAMPLE') {
      actionability = 'WATCH';
      actionabilityRationale = 'Insufficient historical sample size (n < 5). Monitor without trade commitment.';
    } else if (priority === 'P0_CRITICAL' || priority === 'P1_HIGH') {
      actionability = 'TRADEABLE';
      actionabilityRationale = 'High transmission score with strong price, volume, and sector confirmation.';
    } else {
      actionability = 'WATCH';
      actionabilityRationale = 'Moderate confirmation. Wait for further volume/F&O clarity.';
    }

    // 11. STEP 11: Lifecycle State
    let lifecycleState: 'NEW' | 'ACTIVE' | 'CONFIRMED' | 'WEAKENING' | 'CONTRADICTED' | 'EXPIRED' | 'INVALIDATED' = 'ACTIVE';
    if (alignment === 'CONTRADICTED') lifecycleState = 'CONTRADICTED';
    else if (alignment === 'STRONGLY_CONFIRMED' || alignment === 'CONFIRMED') lifecycleState = 'CONFIRMED';
    else lifecycleState = 'ACTIVE';

    // 12. STEP 12: Event Transmission Graph Construction
    const signalId = `SIG-${symbol}-${articleId}-${currentRev}`;
    const graphNodes: TransmissionGraphNode[] = [
      { id: `NODE-EVENT-${articleId}`, type: 'EVENT', label: headline, metadata: { headline, publishedAt: eventTimestamp }, timestamp: eventTimestamp, status: 'RESOLVED' },
      { id: `NODE-ENTITY-${symbol}`, type: 'ENTITY', label: `${entityResolution.primaryEntity?.companyName || symbol} (${symbol})`, metadata: { entityResolution }, timestamp: eventTimestamp, status: 'RESOLVED' },
      { id: `NODE-SECTOR-${entityResolution.sector}`, type: 'SECTOR_INDEX', label: `${entityResolution.sector} / ${entityResolution.relevantIndices.join(', ')}`, metadata: { sector: entityResolution.sector, indices: entityResolution.relevantIndices }, timestamp: eventTimestamp, status: 'RESOLVED' },
      { id: `NODE-REACTION-${symbol}`, type: 'MARKET_REACTION', label: `Reaction: ${marketReaction.totalChangePct}% (RVOL ${marketReaction.rvol}x)`, metadata: { marketReaction }, timestamp: marketReaction.evaluatedAt, status: 'RESOLVED' },
      { id: `NODE-SIGNAL-${signalId}`, type: 'SIGNAL', label: `Signal: ${priority} (${transmissionScore}/100)`, metadata: { transmissionScore, priority, alignment }, timestamp: new Date().toISOString(), status: 'ACTIVE' },
      { id: `NODE-LIFECYCLE-${signalId}`, type: 'LIFECYCLE', label: `Lifecycle: ${lifecycleState}`, metadata: { lifecycleState }, timestamp: new Date().toISOString(), status: 'ACTIVE' },
      { id: `NODE-OUTCOME-${signalId}`, type: 'HISTORICAL_OUTCOME', label: `Precedent: ${historicalPrecedent.sampleQuality} (n=${historicalPrecedent.sampleSize})`, metadata: { historicalPrecedent }, timestamp: new Date().toISOString(), status: 'RESOLVED' }
    ];

    const graphEdges: TransmissionGraphEdge[] = [
      { id: `EDGE-1`, sourceId: `NODE-EVENT-${articleId}`, targetId: `NODE-ENTITY-${symbol}`, type: 'EVENT_TO_ENTITY', alignment: 'CONFIRMED', weight: 1.0, provenance: 'EntityImpactResolver', timestamp: new Date().toISOString() },
      { id: `EDGE-2`, sourceId: `NODE-ENTITY-${symbol}`, targetId: `NODE-SECTOR-${entityResolution.sector}`, type: 'ENTITY_TO_SECTOR', alignment: 'CONFIRMED', weight: 0.9, provenance: 'SectorIndexMapper', timestamp: new Date().toISOString() },
      { id: `EDGE-3`, sourceId: `NODE-ENTITY-${symbol}`, targetId: `NODE-REACTION-${symbol}`, type: 'ENTITY_TO_PRICE_REACTION', alignment, weight: 0.95, provenance: 'DeterministicMarketReactionEngine', timestamp: new Date().toISOString() },
      { id: `EDGE-4`, sourceId: `NODE-REACTION-${symbol}`, targetId: `NODE-SIGNAL-${signalId}`, type: 'EVIDENCE_TO_SIGNAL', alignment, weight: 0.85, provenance: 'EventToSignalTransmissionEngine', timestamp: new Date().toISOString() },
      { id: `EDGE-5`, sourceId: `NODE-SIGNAL-${signalId}`, targetId: `NODE-LIFECYCLE-${signalId}`, type: 'SIGNAL_TO_LIFECYCLE', alignment: 'CONFIRMED', weight: 1.0, provenance: 'SignalLifecycleEngine', timestamp: new Date().toISOString() },
      { id: `EDGE-6`, sourceId: `NODE-SIGNAL-${signalId}`, targetId: `NODE-OUTCOME-${signalId}`, type: 'SIGNAL_TO_HISTORICAL_OUTCOME', alignment: 'CONFIRMED', weight: 0.8, provenance: 'HistoricalPerformanceAnalyticsEngine', timestamp: new Date().toISOString() }
    ];

    const graphDossier: TransmissionGraphDossier = {
      graphId: `GRAPH-${signalId}`,
      eventId: articleId,
      signalId,
      symbol,
      nodes: graphNodes,
      edges: graphEdges,
      rootEventSummary: canonicalSummary,
      transmissionScore,
      alignment,
      evidenceChain: [
        { stage: '1. NEWS EVENT', node: graphNodes[0], summary: canonicalSummary },
        { stage: '2. ENTITY & SECTOR', node: graphNodes[1], summary: `${symbol} in ${entityResolution.sector}` },
        { stage: '3. MARKET REACTION', node: graphNodes[3], summary: `${marketReaction.totalChangePct > 0 ? '+' : ''}${marketReaction.totalChangePct}% change, RVOL: ${marketReaction.rvol}x` },
        { stage: '4. SIGNAL & ACTIONABILITY', node: graphNodes[4], summary: `${priority} | ${actionability}` },
        { stage: '5. HISTORICAL PRECEDENT', node: graphNodes[6], summary: `${historicalPrecedent.sampleQuality} (n=${historicalPrecedent.sampleSize})` }
      ],
      contradictions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    eventTransmissionGraph.recordTransmissionDossier(graphDossier);

    // 13. STEP 13: Grounded Telegram Message Generation
    const telegramMessage = this.formatTelegramAlert({
      headline,
      canonicalSummary,
      whyItMatters,
      symbol,
      priority,
      alignment,
      marketReaction,
      historicalPrecedent,
      contradictions,
      actionability
    });

    const signalResult: TransmissionSignalResult = {
      signalId,
      eventId: articleId,
      articleId,
      symbol,
      headline,
      canonicalSummary,
      whyItMatters,
      entityResolution,
      marketReaction,
      fnoPositioning,
      historicalPrecedent,
      marketRegime,
      transmissionScore,
      scoreBreakdown,
      priority,
      alignment,
      lifecycleState,
      actionability,
      actionabilityRationale,
      contradictions,
      warnings,
      graphDossier,
      telegramMessage,
      timestamp: new Date().toISOString(),
      revision: currentRev
    };

    this.signalCache.set(cacheKey, signalResult);
    this.observability.signalsGenerated++;
    this.observability.eventToSignalLatencyMs.push(Date.now() - startTime);

    return signalResult;
  }

  /**
   * Formats a production-grade Telegram Market Alert strictly honoring the required ordering.
   */
  private formatTelegramAlert(data: {
    headline: string;
    canonicalSummary: string;
    whyItMatters: string;
    symbol: string;
    priority: TransmissionPriority;
    alignment: TransmissionAlignment;
    marketReaction: ComprehensiveMarketReaction;
    historicalPrecedent: any;
    contradictions: string[];
    actionability: ActionabilityState;
  }): string {
    const rx = data.marketReaction;
    const sign = rx.totalChangePct > 0 ? '+' : '';
    
    let msg = `🚨 <b>ATHENA MARKET ALERT</b>\n\n`;
    msg += `<b>${data.symbol} — ${data.headline}</b>\n\n`;
    msg += `📰 <b>NEWS SUMMARY</b>\n${data.canonicalSummary}\n\n`;
    
    if (data.whyItMatters) {
      msg += `📊 <b>TRADER INTELLIGENCE</b>\n${data.whyItMatters}\n\n`;
    }

    msg += `🎯 <b>ATHENA SIGNAL</b>\n`;
    msg += `Priority: <b>${data.priority}</b> | Alignment: <b>${data.alignment}</b> | Action: <b>${data.actionability}</b>\n\n`;

    msg += `📈 <b>MARKET REACTION</b>\n`;
    msg += `Change: <b>${sign}${rx.totalChangePct}%</b> (Ref: ₹${rx.referencePrice} → Curr: ₹${rx.currentPrice})\n`;
    msg += `Volume: <b>${rx.rvol}× normal</b> | VWAP Gap: <b>${rx.vwapDisplacementPct}%</b>\n\n`;

    msg += `📚 <b>HISTORICAL PRECEDENT</b>\n`;
    msg += `Quality: <b>${data.historicalPrecedent.sampleQuality}</b> (n=${data.historicalPrecedent.sampleSize})`;
    if (data.historicalPrecedent.historicalWinRatePct !== undefined) {
      msg += ` | Win Rate: <b>${data.historicalPrecedent.historicalWinRatePct}%</b>`;
    }
    msg += `\n\n`;

    if (data.contradictions.length > 0) {
      msg += `⚠️ <b>RISKS & CONTRADICTIONS</b>\n`;
      for (const c of data.contradictions) {
        msg += `• ${c}\n`;
      }
      msg += `\n`;
    }

    msg += `🔗 <a href="https://athena.market">Open ATHENA Live Signal Flow</a>`;
    return msg;
  }

  public getObservability(): TransmissionObservability {
    return { ...this.observability };
  }

  public getAllSignals(): TransmissionSignalResult[] {
    return Array.from(this.signalCache.values());
  }

  public getSignal(signalId: string): TransmissionSignalResult | undefined {
    for (const sig of this.signalCache.values()) {
      if (sig.signalId === signalId) return sig;
    }
    return undefined;
  }
}

export const eventToSignalTransmissionEngine = EventToSignalTransmissionEngine.getInstance();
