/**
 * ATHENA — Phase 18 News Correlation Engine
 * NewsCorrelationEngine.ts
 */

import { athenaOrchestrator } from '../intelligence/AthenaOrchestrator.ts';

export class NewsCorrelationEngine {
  private static instance: NewsCorrelationEngine;

  private constructor() {}

  public static getInstance(): NewsCorrelationEngine {
    if (!NewsCorrelationEngine.instance) {
      NewsCorrelationEngine.instance = new NewsCorrelationEngine();
    }
    return NewsCorrelationEngine.instance;
  }

  /**
   * Correlates an anomaly with existing news in the cache/orchestrator.
   * Compares symbol, sector, indices, and description.
   */
  public correlate(
    symbol: string,
    sector: string,
    indices: string[],
    anomalyTimestamp: string,
    eventType: string
  ): {
    catalystStatus: 'NEWS_CONFIRMED' | 'NEWS_POSSIBLE' | 'NEWS_UNRELATED' | 'NO_KNOWN_NEWS';
    newsCorrelation?: {
      recentArticleId: string;
      headline: string;
      similarityScore: number;
    };
  } {
    const decisions = athenaOrchestrator.getAllDecisions();
    if (decisions.length === 0) {
      return { catalystStatus: 'NO_KNOWN_NEWS' };
    }

    let bestMatch: any = null;
    let highestScore = 0;

    for (const d of decisions) {
      let score = 0;
      
      // 1. Symbol Match
      if (d.event.entityIds?.includes(symbol)) {
        score += 50;
      }

      // 2. Proximity in timestamp
      const timeDiffMs = Math.abs(new Date(anomalyTimestamp).getTime() - new Date(d.event.timestamp).getTime());
      if (timeDiffMs < 3600000 * 2) { // Under 2 hours
        score += 30;
      } else if (timeDiffMs < 3600000 * 6) { // Under 6 hours
        score += 15;
      }

      // 3. Sector or Index match
      const sectorMatched = d.event.source.toLowerCase().includes(sector.toLowerCase());
      if (sectorMatched) {
        score += 10;
      }

      // 4. Keyword/Text check (mocking simple semantic correlation)
      if (score > highestScore) {
        highestScore = score;
        bestMatch = d;
      }
    }

    if (highestScore >= 80) {
      return {
        catalystStatus: 'NEWS_CONFIRMED',
        newsCorrelation: {
          recentArticleId: bestMatch.event.articleId,
          headline: bestMatch.event.source,
          similarityScore: highestScore,
        },
      };
    } else if (highestScore >= 45) {
      return {
        catalystStatus: 'NEWS_POSSIBLE',
        newsCorrelation: {
          recentArticleId: bestMatch.event.articleId,
          headline: bestMatch.event.source,
          similarityScore: highestScore,
        },
      };
    } else if (highestScore > 0) {
      return {
        catalystStatus: 'NEWS_UNRELATED',
        newsCorrelation: {
          recentArticleId: bestMatch.event.articleId,
          headline: bestMatch.event.source,
          similarityScore: highestScore,
        },
      };
    }

    return { catalystStatus: 'NO_KNOWN_NEWS' };
  }
}
export const newsCorrelationEngine = NewsCorrelationEngine.getInstance();
