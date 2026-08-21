/**
 * ATHENA NEWS ENGINE — STAGE 8.3 FRESHNESS & QUALITY EVALUATOR
 * Deterministic article freshness, update detection, stale article suppression, and quarantine quality gate.
 */

import { NewsArticle } from '../types/Article';

export type FreshnessState = 'BREAKING' | 'VERY_FRESH' | 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
export type TimestampConfidence = 'HIGH' | 'UNKNOWN' | 'LOW';
export type ArticleUpdateClass = 'NEW_ARTICLE' | 'UPDATED_ARTICLE' | 'UNCHANGED_ARTICLE';

export interface FreshnessEvaluation {
  publishedAt: string;
  discoveredAt: string;
  normalizedAt: string;
  freshnessSeconds: number;
  freshnessState: FreshnessState;
  timestampConfidence: TimestampConfidence;
  isStale: boolean;
  suppressReason?: string;
}

export interface ArticleUpdateResult {
  updateClass: ArticleUpdateClass;
  hasMaterialUpdate: boolean;
  reason?: string;
}

export interface QualityCheckResult {
  accepted: boolean;
  rejectionReason?: string;
  qualityScore: number;
}

export interface QuarantinedArticleRecord {
  articleId: string;
  headline: string;
  sourceUrl: string;
  publisher: string;
  rejectionReason: string;
  quarantinedAt: string;
}

export class ArticleFreshnessEvaluator {
  private static quarantineLog: QuarantinedArticleRecord[] = [];

  /**
   * Evaluates timestamp freshness and confidence deterministically.
   */
  public static evaluateFreshness(
    article: Partial<NewsArticle>,
    discoveredAtTime?: string,
    normalizedAtTime?: string
  ): FreshnessEvaluation {
    const now = Date.now();
    const discoveredAt = discoveredAtTime || (article as any).discoveredAt || article.fetchedAt || new Date().toISOString();
    const normalizedAt = normalizedAtTime || (article as any).normalizedAt || new Date().toISOString();

    let publishedAt = article.publishedAt;
    let confidence: TimestampConfidence = 'HIGH';

    if (!publishedAt || isNaN(new Date(publishedAt).getTime())) {
      publishedAt = discoveredAt;
      confidence = 'UNKNOWN';
    }

    const pubTimeMs = new Date(publishedAt).getTime();
    // If published timestamp is in far future (> 5 mins ahead), fall back to discovery
    if (pubTimeMs > now + 300000) {
      publishedAt = discoveredAt;
      confidence = 'LOW';
    }

    const freshnessSeconds = Math.max(0, Math.floor((now - new Date(publishedAt).getTime()) / 1000));

    let freshnessState: FreshnessState = 'UNKNOWN';
    let isStale = false;
    let suppressReason: string | undefined;

    if (freshnessSeconds < 300) {
      freshnessState = 'BREAKING';
    } else if (freshnessSeconds < 1800) {
      freshnessState = 'VERY_FRESH';
    } else if (freshnessSeconds < 7200) {
      freshnessState = 'FRESH';
    } else if (freshnessSeconds <= 86400) {
      freshnessState = 'AGING';
    } else {
      freshnessState = 'STALE';
      isStale = true;
      suppressReason = `Published ${Math.round(freshnessSeconds / 3600)} hours ago (stale threshold: 24h)`;
    }

    return {
      publishedAt,
      discoveredAt,
      normalizedAt,
      freshnessSeconds,
      freshnessState,
      timestampConfidence: confidence,
      isStale,
      suppressReason
    };
  }

  /**
   * Detects whether an incoming article is new, updated, or unchanged compared to an existing article.
   */
  public static detectUpdate(incoming: Partial<NewsArticle>, existing: Partial<NewsArticle>): ArticleUpdateResult {
    const incHeadline = (incoming.headline || '').trim().toLowerCase();
    const extHeadline = (existing.headline || '').trim().toLowerCase();
    const incBody = (incoming.body || (incoming as any).summary || '').trim().toLowerCase();
    const extBody = (existing.body || (existing as any).summary || '').trim().toLowerCase();

    // 1. Headline & Body Exact Match -> UNCHANGED_ARTICLE
    if (incHeadline === extHeadline && incBody === extBody) {
      return {
        updateClass: 'UNCHANGED_ARTICLE',
        hasMaterialUpdate: false,
        reason: 'Identical headline and body text'
      };
    }

    // 2. High text similarity (>95% text match) -> UNCHANGED_ARTICLE
    if (incHeadline === extHeadline && Math.abs(incBody.length - extBody.length) < 15) {
      return {
        updateClass: 'UNCHANGED_ARTICLE',
        hasMaterialUpdate: false,
        reason: 'Minor whitespace or minor formatting change'
      };
    }

    // 3. Article body or headline changed -> UPDATED_ARTICLE
    // Evaluate if update contains materially new information (e.g. numerical differences, new financial metrics)
    const incNumbers = (incBody.match(/₹?\d+(?:,\d+)*(?:\.\d+)?\s*(?:crore|lakh|billion|million|%)?/gi) || []).join(' ');
    const extNumbers = (extBody.match(/₹?\d+(?:,\d+)*(?:\.\d+)?\s*(?:crore|lakh|billion|million|%)?/gi) || []).join(' ');

    const numbersChanged = incNumbers !== extNumbers && incNumbers.length > 0;
    const majorLengthDiff = Math.abs(incBody.length - extBody.length) > 100;

    const hasMaterialUpdate = numbersChanged || majorLengthDiff || incHeadline !== extHeadline;

    return {
      updateClass: 'UPDATED_ARTICLE',
      hasMaterialUpdate,
      reason: hasMaterialUpdate
        ? `Material update detected (Numbers revised: ${numbersChanged}, Length diff: ${majorLengthDiff})`
        : 'Timestamp or minor page layout update only'
    };
  }

  /**
   * Evaluates article against Stage 8.3 Quality Gate before canonical summary or dispatch.
   */
  public static validateQuality(article: Partial<NewsArticle>): QualityCheckResult {
    const headline = (article.headline || '').trim();
    const body = (article.body || (article as any).summary || (article as any).content || '').trim();
    const url = (article.sourceUrl || article.source?.url || '').trim();

    // 1. Empty Article
    if (!headline || (!body && headline.length < 20)) {
      this.quarantine(article, 'EMPTY_ARTICLE');
      return { accepted: false, rejectionReason: 'EMPTY_ARTICLE', qualityScore: 0 };
    }

    // 2. Extremely Short Stub
    if (headline.length < 10 || body.length < 25) {
      this.quarantine(article, 'EXTREMELY_SHORT_STUB');
      return { accepted: false, rejectionReason: 'EXTREMELY_SHORT_STUB', qualityScore: 10 };
    }

    // 3. Obvious Navigation Pages / Category Pages
    const lowerHead = headline.toLowerCase();
    const lowerBody = body.toLowerCase();

    if (/^home\s*>\s*markets|^click here for more|^footer navigation|terms of use|privacy policy|sitemap/i.test(lowerHead) ||
        /^home\s*>\s*markets|^click here for more/i.test(lowerBody)) {
      this.quarantine(article, 'NAVIGATION_PAGE');
      return { accepted: false, rejectionReason: 'NAVIGATION_PAGE', qualityScore: 0 };
    }

    // 4. Category Pages accidentally ingested
    if (lowerHead.includes('top 10 stocks to watch today') || lowerHead.includes('latest news live updates') || lowerHead.includes('all news listings')) {
      if (body.length < 100 || body.includes('list of articles')) {
        this.quarantine(article, 'CATEGORY_PAGE');
        return { accepted: false, rejectionReason: 'CATEGORY_PAGE', qualityScore: 20 };
      }
    }

    // 5. Live Price Pages with no event narrative
    if (/^current price:\s*₹?\d+|^stock price today|^52 week high low/i.test(lowerHead) && !/announces|wins|reports|approves|secures|profit|revenue|sebi|rbi/i.test(lowerBody)) {
      this.quarantine(article, 'LIVE_PRICE_PAGE');
      return { accepted: false, rejectionReason: 'LIVE_PRICE_PAGE', qualityScore: 25 };
    }

    // 6. Malformed RSS Entries
    if (!url || url.length < 8) {
      this.quarantine(article, 'MALFORMED_RSS_ENTRY');
      return { accepted: false, rejectionReason: 'MALFORMED_RSS_ENTRY', qualityScore: 0 };
    }

    // 7. Pure Publisher Boilerplate / Disclaimer
    if (lowerBody.length < 100 && /disclaimer: the views expressed above are solely|subscribe to unlock this article|sign in to continue reading/i.test(lowerBody)) {
      this.quarantine(article, 'PUBLISHER_BOILERPLATE');
      return { accepted: false, rejectionReason: 'PUBLISHER_BOILERPLATE', qualityScore: 15 };
    }

    // 8. Stale Article Check
    const freshness = this.evaluateFreshness(article);
    if (freshness.isStale && !(article as any).hasMaterialUpdate) {
      this.quarantine(article, 'STALE_ARTICLE');
      return { accepted: false, rejectionReason: 'STALE_ARTICLE', qualityScore: 30 };
    }

    return { accepted: true, qualityScore: 95 };
  }

  /**
   * Stores rejection record for auditability without deleting source records.
   */
  private static quarantine(article: Partial<NewsArticle>, reason: string): void {
    const record: QuarantinedArticleRecord = {
      articleId: article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      headline: article.headline || 'Untitled',
      sourceUrl: article.sourceUrl || article.source?.url || '',
      publisher: article.source?.name || article.source?.publisher || 'Unknown',
      rejectionReason: reason,
      quarantinedAt: new Date().toISOString()
    };
    this.quarantineLog.push(record);
  }

  public static getQuarantineLog(): QuarantinedArticleRecord[] {
    return [...this.quarantineLog];
  }

  public static clearQuarantineLog(): void {
    this.quarantineLog = [];
  }
}
