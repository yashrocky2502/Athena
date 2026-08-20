/**
 * ATHENA NEWS ENGINE — STAGE 7.3
 * TraderIntelligenceCache: Dedicated, isolated cache for trader intelligence results.
 * Key format: news-intelligence:{canonicalArticleId}:{engineVersion}
 * Does NOT mutate canonical news store.
 */

import { TraderIntelligence } from '../types/TraderIntelligence.ts';

export class TraderIntelligenceCache {
  private static instance: TraderIntelligenceCache;
  private cache = new Map<string, { data: TraderIntelligence; cachedAt: number }>();
  private readonly DEFAULT_ENGINE_VERSION = 'v7_3';
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

  private constructor() {}

  public static getInstance(): TraderIntelligenceCache {
    if (!TraderIntelligenceCache.instance) {
      TraderIntelligenceCache.instance = new TraderIntelligenceCache();
    }
    return TraderIntelligenceCache.instance;
  }

  public getKey(articleId: string, engineVersion: string = this.DEFAULT_ENGINE_VERSION): string {
    return `news-intelligence:${articleId}:${engineVersion}`;
  }

  public get(articleId: string, engineVersion: string = this.DEFAULT_ENGINE_VERSION): TraderIntelligence | null {
    const key = this.getKey(articleId, engineVersion);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  public set(articleId: string, data: TraderIntelligence, engineVersion: string = this.DEFAULT_ENGINE_VERSION): void {
    const key = this.getKey(articleId, engineVersion);
    this.cache.set(key, {
      data,
      cachedAt: Date.now()
    });
  }

  public has(articleId: string, engineVersion: string = this.DEFAULT_ENGINE_VERSION): boolean {
    return this.get(articleId, engineVersion) !== null;
  }

  public delete(articleId: string, engineVersion: string = this.DEFAULT_ENGINE_VERSION): void {
    const key = this.getKey(articleId, engineVersion);
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
