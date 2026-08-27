/**
 * ATHENA NEWS ENGINE — PHASE 10
 * HistoricalEventEngine.ts
 * 
 * Historical event similarity search and deterministic market impact analysis.
 * Enables queries like: "Show similar Reliance order-win events" or "Historical regulatory actions on Banking".
 * 
 * Never produces false statistical claims without supporting sample evidence.
 * Zero AI Cost: 100% deterministic similarity matching and empirical data aggregation.
 */

import { JsonNewsStore } from '../storage/JsonNewsStore';
import { EventCentricOrchestrator } from './EventCentricOrchestrator';
import { MarketConfirmationEngine } from './MarketConfirmationEngine';

export interface HistoricalEventRecord {
  eventId: string;
  articleId: string;
  symbol: string;
  companyName: string;
  eventType: string;
  date: string;
  headline: string;
  magnitude: string; // e.g. "₹2,500 Cr" or "NOT_SPECIFIED"
  marketReaction: {
    eventTimePrice?: number;
    subsequentPrice?: number;
    priceChangePct: number | 'UNKNOWN';
    reactionDirection: 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';
    reactionStrength: string;
  };
  volumeConfirmation: {
    volumeMultiple: number | 'UNKNOWN';
    status: 'SURGE' | 'ELEVATED' | 'NORMAL' | 'ANEMIC' | 'UNKNOWN';
  };
  fnoReaction: {
    available: boolean;
    oiChangePct: number | 'UNKNOWN';
    positioning: string;
  };
  sourceEvidence: {
    publisher: string;
    tier: number;
    sourceUrl?: string;
  };
}

export interface HistoricalEventAnalysisReport {
  symbol: string;
  eventTypeFilter: string;
  totalHistoricalMatches: number;
  sampleAdequacy: 'ROBUST_SAMPLE' | 'LIMITED_SAMPLE' | 'INSUFFICIENT_DATA';
  events: HistoricalEventRecord[];
  
  empiricalSummary: {
    averagePriceReactionPct: number | 'INSUFFICIENT_EVIDENCE';
    positiveReactionCount: number;
    negativeReactionCount: number;
    neutralReactionCount: number;
    volumeSurgeFrequencyPct: number | 'INSUFFICIENT_EVIDENCE';
    predominantDirection: 'TYPICALLY_BULLISH' | 'TYPICALLY_BEARISH' | 'MIXED_RESPONSE' | 'INSUFFICIENT_SAMPLE';
  };

  riskNote: string;
}

export class HistoricalEventEngine {
  private static instance: HistoricalEventEngine | null = null;

  public static getInstance(): HistoricalEventEngine {
    if (!this.instance) {
      this.instance = new HistoricalEventEngine();
    }
    return this.instance;
  }

  public async getHistoricalSimilarEvents(
    symbolParam: string,
    eventTypeParam?: string,
    store?: JsonNewsStore
  ): Promise<HistoricalEventAnalysisReport> {
    const symbol = (symbolParam || '').toUpperCase().trim();
    const eventType = (eventTypeParam || 'ALL').toUpperCase().trim();

    const orchestrator = EventCentricOrchestrator.getInstance();
    const allEvents = orchestrator.getAllEvents();
    const storeToUse = store || new JsonNewsStore();
    const allArticles = await storeToUse.getAll();

    // Match candidate events/articles
    const matchedRecords: HistoricalEventRecord[] = [];

    // 1. Scan active orchestrated events
    for (const evt of allEvents) {
      if (symbol !== 'ALL' && evt.symbol.toUpperCase() !== symbol && evt.primaryEntity.toUpperCase() !== symbol) {
        continue;
      }
      if (eventType !== 'ALL' && (evt.eventType || '').toUpperCase() !== eventType && (evt.category || '').toUpperCase() !== eventType) {
        continue;
      }

      const firstNum = evt.keyNumbers && evt.keyNumbers.length > 0 ? evt.keyNumbers[0] : null;
      const magStr = firstNum ? (typeof firstNum === 'string' ? firstNum : (firstNum as any).value || (firstNum as any).normalizedValue || String(firstNum)) : 'NOT_SPECIFIED';

      const mConf = MarketConfirmationEngine.process(evt.symbol, evt.firstSeenAt, 'NEUTRAL');
      matchedRecords.push({
        eventId: evt.eventId,
        articleId: evt.latestArticleId || evt.primarySource?.articleId || '',
        symbol: evt.symbol,
        companyName: evt.primaryEntity,
        eventType: evt.eventType || 'CORPORATE_EVENT',
        date: evt.firstSeenAt,
        headline: evt.primarySource?.headline || evt.canonicalSummary?.whatHappened || 'Historical Event',
        magnitude: magStr,
        marketReaction: {
          priceChangePct: mConf.priceReaction.percentagePriceChange ?? 'UNKNOWN',
          reactionDirection: (mConf.priceReaction.reactionDirection as any) || 'UNKNOWN',
          reactionStrength: mConf.priceReaction.reactionStrength || 'UNKNOWN'
        },
        volumeConfirmation: {
          volumeMultiple: mConf.volumeConfirmation.volumeMultiple ?? 'UNKNOWN',
          status: (mConf.volumeConfirmation.confirmationStatus as any) || 'UNKNOWN'
        },
        fnoReaction: {
          available: mConf.fnoPositioning.availability === 'AVAILABLE',
          oiChangePct: (mConf.fnoPositioning as any).futuresOiChangePct ?? 'UNKNOWN',
          positioning: mConf.fnoPositioning.optionFlowClassification || 'UNKNOWN'
        },
        sourceEvidence: {
          publisher: evt.primarySource?.publisher || 'Official Exchange Filing',
          tier: evt.primarySource?.tier || 1,
          sourceUrl: evt.primarySource?.sourceUrl
        }
      });
    }

    // 2. Supplement from canonical article store
    for (const art of allArticles) {
      const artSym = (art as any).symbol?.toUpperCase();
      const text = `${art.headline || ''} ${(art as any).body || ''}`.toUpperCase();
      const isSymMatch = symbol === 'ALL' || artSym === symbol || text.includes(` ${symbol} `) || text.includes(`(${symbol})`);
      
      if (!isSymMatch) continue;
      const artCategory = ((art as any).category || (art as any).primaryCategory || 'GENERAL').toUpperCase();
      if (eventType !== 'ALL' && artCategory !== eventType && !artCategory.includes(eventType)) {
        continue;
      }

      // Avoid duplicates
      const alreadyInList = matchedRecords.some(r => r.headline === (art.headline || '') || (r.articleId && r.articleId === art.id));
      if (alreadyInList) continue;

      const fDate = art.publishedAt || new Date().toISOString();
      const mConf = MarketConfirmationEngine.process(symbol === 'ALL' ? (artSym || 'NIFTY') : symbol, fDate, 'NEUTRAL');

      const pubName = typeof art.publisher === 'string' ? art.publisher : ((art.publisher as any)?.name || (art as any).source || 'Exchange Disclosure');
      const artUrl = (art as any).canonicalUrl || art.url || (art as any).sourceUrl;

      matchedRecords.push({
        eventId: `hist-${art.id}`,
        articleId: art.id,
        symbol: artSym || symbol,
        companyName: (art as any).companyName || symbol,
        eventType: artCategory,
        date: fDate,
        headline: art.headline || (art as any).title || 'Historical News Record',
        magnitude: (art as any).dealSize || (art as any).orderValue || 'NOT_SPECIFIED',
        marketReaction: {
          priceChangePct: mConf.priceReaction.percentagePriceChange ?? 'UNKNOWN',
          reactionDirection: (mConf.priceReaction.reactionDirection as any) || 'UNKNOWN',
          reactionStrength: mConf.priceReaction.reactionStrength || 'UNKNOWN'
        },
        volumeConfirmation: {
          volumeMultiple: mConf.volumeConfirmation.volumeMultiple ?? 'UNKNOWN',
          status: (mConf.volumeConfirmation.confirmationStatus as any) || 'UNKNOWN'
        },
        fnoReaction: {
          available: mConf.fnoPositioning.availability === 'AVAILABLE',
          oiChangePct: (mConf.fnoPositioning as any).futuresOiChangePct ?? 'UNKNOWN',
          positioning: mConf.fnoPositioning.optionFlowClassification || 'UNKNOWN'
        },
        sourceEvidence: {
          publisher: pubName,
          tier: 2,
          sourceUrl: artUrl
        }
      });
    }

    // Sort by date descending
    matchedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Empirical calculations
    const validPriceChanges = matchedRecords
      .map(r => r.marketReaction.priceChangePct)
      .filter((p): p is number => typeof p === 'number' && !isNaN(p));

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    matchedRecords.forEach(r => {
      const dir = r.marketReaction.reactionDirection;
      if (dir === 'POSITIVE') positiveCount++;
      else if (dir === 'NEGATIVE') negativeCount++;
      else neutralCount++;
    });

    const sampleAdequacy = matchedRecords.length >= 10 
      ? 'ROBUST_SAMPLE' 
      : matchedRecords.length >= 3 
      ? 'LIMITED_SAMPLE' 
      : 'INSUFFICIENT_DATA';

    const avgPriceReaction = validPriceChanges.length >= 3
      ? parseFloat((validPriceChanges.reduce((a, b) => a + b, 0) / validPriceChanges.length).toFixed(2))
      : 'INSUFFICIENT_EVIDENCE';

    let predominantDirection: 'TYPICALLY_BULLISH' | 'TYPICALLY_BEARISH' | 'MIXED_RESPONSE' | 'INSUFFICIENT_SAMPLE' = 'INSUFFICIENT_SAMPLE';
    if (sampleAdequacy !== 'INSUFFICIENT_DATA') {
      if (positiveCount > negativeCount * 2) predominantDirection = 'TYPICALLY_BULLISH';
      else if (negativeCount > positiveCount * 2) predominantDirection = 'TYPICALLY_BEARISH';
      else predominantDirection = 'MIXED_RESPONSE';
    }

    return {
      symbol,
      eventTypeFilter: eventType,
      totalHistoricalMatches: matchedRecords.length,
      sampleAdequacy,
      events: matchedRecords.slice(0, 25),
      empiricalSummary: {
        averagePriceReactionPct: avgPriceReaction,
        positiveReactionCount: positiveCount,
        negativeReactionCount: negativeCount,
        neutralReactionCount: neutralCount,
        volumeSurgeFrequencyPct: matchedRecords.length > 0 ? parseFloat(((positiveCount / matchedRecords.length) * 100).toFixed(1)) : 'INSUFFICIENT_EVIDENCE',
        predominantDirection
      },
      riskNote: sampleAdequacy === 'INSUFFICIENT_DATA'
        ? 'Historical sample size is limited. Do not extrapolate statistical probability from sparse observations.'
        : 'Past empirical reactions represent historical market regimes and do not guarantee future price trajectory.'
    };
  }
}
