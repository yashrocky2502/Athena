import crypto from 'crypto';
import { SummaryResult } from './SummaryService';

export interface SummaryCacheEntry {
  value: SummaryResult;
  expiresAt: number;
  lastAccessed: number;
}

export class SummaryCache {
  private static instance: SummaryCache;
  private cache = new Map<string, SummaryCacheEntry>();
  private readonly maxEntries: number = 1000;
  private readonly defaultTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): SummaryCache {
    if (!SummaryCache.instance) {
      SummaryCache.instance = new SummaryCache();
    }
    return SummaryCache.instance;
  }

  /**
   * Generates a fully isolated, unique, deterministic, and immutable cache key for an article
   * based on: canonical URL + publisher + publication timestamp.
   */
  public static generateKey(
    canonicalUrl: string | undefined,
    url: string,
    publisher: string,
    publishedAt: string | undefined
  ): string {
    const canonical = (canonicalUrl || url || '').trim().toLowerCase();
    const pub = (publisher || '').trim().toLowerCase();
    const timestamp = (publishedAt || '').trim().toLowerCase();

    // Generate SHA-256 hash for perfect cryptographic isolation
    return crypto.createHash('sha256').update(`${canonical}|${pub}|${timestamp}`).digest('hex');
  }

  public get<T>(key: string): T | null {
    if (!key) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.lastAccessed = Date.now();
    return entry.value as unknown as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    if (!key) return;

    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    const ttl = ttlMs || this.defaultTtlMs;
    this.cache.set(key, {
      value: value as unknown as SummaryResult,
      expiresAt: Date.now() + ttl,
      lastAccessed: Date.now(),
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  public getStats() {
    return {
      size: this.cache.size,
      maxCapacity: this.maxEntries,
    };
  }
}
