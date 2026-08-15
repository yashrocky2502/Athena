import { IntelligenceRepository, CacheEntry } from "./IntelligenceRepository";

export class InMemoryRepository implements IntelligenceRepository {
  private cache = new Map<string, CacheEntry>();

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (entry) {
      console.log(`[Cache Hit] Found entry for: ${key}`);
    } else {
      console.log(`[Cache Miss] No entry for: ${key}`);
    }
    return entry || null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    console.log(`[Cache Save] Saving entry for: ${key}`);
    this.cache.set(key, entry);
  }

  async update(key: string, entry: CacheEntry): Promise<void> {
    console.log(`[Cache Update] Updating entry for: ${key}`);
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    console.log(`[Cache Delete] Deleting entry for: ${key}`);
    this.cache.delete(key);
  }
}
