export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export class Cache {
  private static instance: Cache;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxEntries: number = 1000;
  private readonly defaultTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
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
    return entry.value as T;
  }

  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    if (!key) return;

    // LRU Eviction if cache reaches limit
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    const ttl = ttlMs || this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      lastAccessed: Date.now(),
    });
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

  public getStats(): { size: number; maxCapacity: number } {
    return {
      size: this.cache.size,
      maxCapacity: this.maxEntries,
    };
  }
}
