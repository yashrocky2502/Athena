import crypto from 'crypto';
import { AIResponse } from './AIProvider';

export type NewsCacheCategory = 'Breaking News' | 'Market News' | 'Corporate Filing' | 'Macro Reports' | 'Default';

export interface CacheKeyInput {
  url?: string;
  title?: string;
  publisher?: string;
  articleHash?: string;
  promptVersion?: string;
  modelVersion?: string;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, { response: AIResponse; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  // TTL in seconds
  private readonly TTLS: Record<NewsCacheCategory, number> = {
    'Breaking News': 10 * 60,              // 10 minutes
    'Market News': 30 * 60,                // 30 minutes
    'Corporate Filing': 365 * 24 * 3600,   // 365 days
    'Macro Reports': 24 * 3600,            // 24 hours
    'Default': 30 * 60
  };

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public generateKey(input: CacheKeyInput): string {
    const raw = `${input.url || ''}|${input.title || ''}|${input.publisher || ''}|${input.articleHash || ''}|${input.promptVersion || 'v5'}|${input.modelVersion || 'v1'}`;
    
    try {
      return crypto.createHash('sha256').update(raw).digest('hex');
    } catch {
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return `sha256_fallback_${Math.abs(hash)}`;
    }
  }

  public get(key: string): AIResponse | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return {
      ...entry.response,
      cached: true
    };
  }

  public set(key: string, response: AIResponse, category: NewsCacheCategory = 'Default'): void {
    // Cache Integrity Gate: Never cache invalid, empty, or low-confidence/rejected responses
    if (!response || typeof response !== 'object') {
      return;
    }
    if (!response.text || typeof response.text !== 'string' || response.text.trim().length < 10) {
      return;
    }
    if (typeof response.confidence === 'number' && response.confidence < 70) {
      return;
    }

    const ttlSeconds = this.TTLS[category] || this.TTLS['Default'];
    const expiresAt = Date.now() + ttlSeconds * 1000;
    // Deep clone/freeze response snapshot to prevent caller mutation from altering cache identity
    const clonedResponse: AIResponse = {
      text: response.text,
      provider: response.provider,
      confidence: response.confidence,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      latencyMs: response.latencyMs,
      costEstimate: response.costEstimate,
      fallbackUsed: Boolean(response.fallbackUsed),
      model: response.model
    };
    this.cache.set(key, { response: clonedResponse, expiresAt });
  }

  public getStats() {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      totalRequests: total,
      hitRatioPercentage: Math.round(hitRatio * 100) / 100,
      cachedItemsCount: this.cache.size
    };
  }

  public clear(): void {
    this.cache.clear();
  }
}
