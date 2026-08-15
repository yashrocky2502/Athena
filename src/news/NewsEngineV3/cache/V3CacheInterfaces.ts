/**
 * ATHENA NEWS ENGINE V3 — CACHE INTERFACE & ABSTRACTION
 * 
 * Generic caching contract with Redis and In-Memory adapter support.
 */

export interface IV3CacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  ttl(key: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  clear(): Promise<void>;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null; // epoch ms
}

/**
 * In-Memory Cache implementation for local testing and zero-dependency mode
 */
export class InMemoryV3Cache implements IV3CacheClient {
  private cache: Map<string, CacheEntry<any>> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;

    const remainingMs = entry.expiresAt - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : -2;
  }

  async exists(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async keys(pattern: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    if (pattern === '*') return allKeys;

    // Convert simple wildcard to regex
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(k => regexPattern.test(k));
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}
