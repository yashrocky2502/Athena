/**
 * ATHENA NEWS ENGINE V3 — INGESTION FAILURE REGISTRY
 * 
 * Records, manages, and supports replay mechanics for ingestion failures.
 */

import { V3RawArticle } from '../types/V3Types';

export interface IngestionFailureRecord {
  id: string;
  correlationId: string;
  publisherId: string;
  title: string;
  sourceUrl: string;
  rawBody: string;
  failureReason: string;
  failedAt: string;
  rawArticle: V3RawArticle;
}

export class IngestionFailureRegistry {
  private static instance: IngestionFailureRegistry;
  private failures: IngestionFailureRecord[] = [];

  private constructor() {
    // Seed with a couple of high-fidelity mock failures for immediate UI validation
    const now = new Date();
    this.failures.push({
      id: 'FAIL_001',
      correlationId: 'CORR_MC_10293_FA',
      publisherId: 'MONEYCONTROL',
      title: 'Reliance Industries Q1 Results Preview: Steady growth expected',
      sourceUrl: 'https://www.moneycontrol.com/news/business/markets/reliance-industries-preview-129384.html',
      rawBody: 'Reliance Industries is scheduled to announce its Q1 results today. Read full article on Moneycontrol.',
      failureReason: 'SOURCE_SPARSE: Document contains 1 paragraph, 2 sentences, 15 words (minimum required: 2 paragraphs, 3 sentences, 50 words).',
      failedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
      rawArticle: {
        id: 'RAW_MC_10293',
        publisherId: 'MONEYCONTROL',
        sourceUrl: 'https://www.moneycontrol.com/news/business/markets/reliance-industries-preview-129384.html',
        title: 'Reliance Industries Q1 Results Preview: Steady growth expected',
        rawBody: 'Reliance Industries is scheduled to announce its Q1 results today. Read full article on Moneycontrol.',
        publishedAt: new Date(now.getTime() - 20 * 60000).toISOString(),
        fetchedAt: new Date(now.getTime() - 10 * 60000).toISOString()
      }
    });

    this.failures.push({
      id: 'FAIL_002',
      correlationId: 'CORR_GNEWS_20192_FA',
      publisherId: 'GOOGLE_NEWS_RSS',
      title: 'TCS Order Win from UK National Employment Savings Trust',
      sourceUrl: 'https://news.google.com/rss/articles/CBMiMmh0dHBzOi8vd3d3LmVjb25vbWljdGltZXMuY29tL3Rjcy1vcmRlci13aW4uaHRtbA',
      rawBody: 'Tata Consultancy Services wins a major UK pension contract. View full coverage on Google News.',
      failureReason: 'BODY_EXTRACTION_FAILURE: Document content is only a sparse Google News RSS fallback snippet.',
      failedAt: new Date(now.getTime() - 5 * 60000).toISOString(),
      rawArticle: {
        id: 'RAW_GNEWS_20192',
        publisherId: 'GOOGLE_NEWS_RSS',
        sourceUrl: 'https://news.google.com/rss/articles/CBMiMmh0dHBzOi8vd3d3LmVjb25vbWljdGltZXMuY29tL3Rjcy1vcmRlci13aW4uaHRtbA',
        title: 'TCS Order Win from UK National Employment Savings Trust',
        rawBody: 'Tata Consultancy Services wins a major UK pension contract. View full coverage on Google News.',
        publishedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
        fetchedAt: new Date(now.getTime() - 5 * 60000).toISOString()
      }
    });
  }

  public static getInstance(): IngestionFailureRegistry {
    if (!IngestionFailureRegistry.instance) {
      IngestionFailureRegistry.instance = new IngestionFailureRegistry();
    }
    return IngestionFailureRegistry.instance;
  }

  public recordFailure(
    correlationId: string,
    rawArticle: V3RawArticle,
    reason: string
  ): void {
    // Avoid double recording same article
    if (this.failures.some(f => f.rawArticle.id === rawArticle.id)) {
      return;
    }

    const record: IngestionFailureRecord = {
      id: `FAIL_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      correlationId,
      publisherId: rawArticle.publisherId,
      title: rawArticle.title,
      sourceUrl: rawArticle.sourceUrl,
      rawBody: rawArticle.rawBody,
      failureReason: reason,
      failedAt: new Date().toISOString(),
      rawArticle
    };

    this.failures.unshift(record);
    if (this.failures.length > 100) {
      this.failures.pop(); // Keep last 100 failures
    }
  }

  public getAllFailures(): IngestionFailureRecord[] {
    return this.failures;
  }

  public removeFailure(id: string): void {
    this.failures = this.failures.filter(f => f.id !== id);
  }

  public clear(): void {
    this.failures = [];
  }
}
