/**
 * ATHENA — Phase 18 News-Market Mismatch Detection
 * NewsMarketMismatchEngine.ts
 */

import { AthenaContradictionEngine } from '../intelligence/AthenaContradictionEngine.ts';

export class NewsMarketMismatchEngine {
  private static instance: NewsMarketMismatchEngine;

  private constructor() {}

  public static getInstance(): NewsMarketMismatchEngine {
    if (!NewsMarketMismatchEngine.instance) {
      NewsMarketMismatchEngine.instance = new NewsMarketMismatchEngine();
    }
    return NewsMarketMismatchEngine.instance;
  }

  public evaluate(
    eventId: string,
    hasNews: boolean,
    newsSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    priceChangePct: number,
    rvol: number
  ): {
    marketConfirmation: 'NEWS_MARKET_CONFIRMATION' | 'NEWS_MARKET_CONTRADICTION' | 'NEWS_WITHOUT_REACTION' | 'PRICE_WITHOUT_NEWS';
    contradictions: string[];
  } {
    const contradictions: string[] = [];
    const isPriceSignificant = Math.abs(priceChangePct) > 1.5 || rvol > 3.0;

    // A. PRICE WITHOUT NEWS
    if (!hasNews && isPriceSignificant) {
      contradictions.push('Significant price/volume anomaly detected without any correlating news catalyst.');
      return {
        marketConfirmation: 'PRICE_WITHOUT_NEWS',
        contradictions,
      };
    }

    // B. NEWS WITHOUT REACTION
    if (hasNews && newsSentiment !== 'NEUTRAL' && !isPriceSignificant) {
      contradictions.push('Material news catalyst published but market reaction is statistically insignificant.');
      return {
        marketConfirmation: 'NEWS_WITHOUT_REACTION',
        contradictions,
      };
    }

    // C. NEWS MARKET CONTRADICTION & CONFIRMATION
    if (hasNews) {
      const priceDirection = priceChangePct > 0 ? 'BULLISH' : priceChangePct < 0 ? 'BEARISH' : 'NEUTRAL';
      
      if (newsSentiment === 'BULLISH' && priceDirection === 'BEARISH') {
        contradictions.push('NEWS is Bullish but market price action is Bearish.');
        // Feed existing AthenaContradictionEngine
        AthenaContradictionEngine.getInstance().evaluate(eventId, {
          newsSentiment: 'BULLISH',
          priceDirection: 'BEARISH',
          volumeDirection: 'POSITIVE',
        });
        return {
          marketConfirmation: 'NEWS_MARKET_CONTRADICTION',
          contradictions,
        };
      }

      if (newsSentiment === 'BEARISH' && priceDirection === 'BULLISH') {
        contradictions.push('NEWS is Bearish but market price action is Bullish.');
        // Feed existing AthenaContradictionEngine
        AthenaContradictionEngine.getInstance().evaluate(eventId, {
          newsSentiment: 'BEARISH',
          priceDirection: 'BULLISH',
          volumeDirection: 'POSITIVE',
        });
        return {
          marketConfirmation: 'NEWS_MARKET_CONTRADICTION',
          contradictions,
        };
      }

      if ((newsSentiment === 'BULLISH' && priceDirection === 'BULLISH') || 
          (newsSentiment === 'BEARISH' && priceDirection === 'BEARISH')) {
        return {
          marketConfirmation: 'NEWS_MARKET_CONFIRMATION',
          contradictions: [],
        };
      }
    }

    return {
      marketConfirmation: 'NEWS_MARKET_CONFIRMATION',
      contradictions: [],
    };
  }
}
export const newsMarketMismatchEngine = NewsMarketMismatchEngine.getInstance();
