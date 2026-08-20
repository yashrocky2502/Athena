/**
 * ATHENA NEWS ENGINE — STAGE 7.4 SUMMARY CACHE
 * Dedicated cache for canonical news summaries under key news-summary:{articleId}:v7_4
 */

import { NewsSummary } from '../types/NewsSummary';

export class NewsSummaryCache {
  private static instance: NewsSummaryCache;
  private memoryCache: Map<string, NewsSummary> = new Map();

  private constructor() {}

  public static getInstance(): NewsSummaryCache {
    if (!NewsSummaryCache.instance) {
      NewsSummaryCache.instance = new NewsSummaryCache();
    }
    return NewsSummaryCache.instance;
  }

  public getCacheKey(articleId: string): string {
    return `news-summary:${articleId}:v7_4`;
  }

  public get(articleId: string): NewsSummary | null {
    if (!articleId) return null;
    const key = this.getCacheKey(articleId);
    return this.memoryCache.get(key) || null;
  }

  public set(articleId: string, summary: NewsSummary): void {
    if (!articleId || !summary) return;
    const key = this.getCacheKey(articleId);
    this.memoryCache.set(key, {
      ...summary,
      generatedAt: summary.generatedAt || new Date().toISOString()
    });
  }

  public has(articleId: string): boolean {
    if (!articleId) return false;
    return this.memoryCache.has(this.getCacheKey(articleId));
  }

  public clear(): void {
    this.memoryCache.clear();
  }
}
