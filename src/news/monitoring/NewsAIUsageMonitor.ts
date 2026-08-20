/**
 * ATHENA NEWS ENGINE — AI USAGE MONITOR (STAGE 7.6)
 */

export interface AIUsageStats {
  summaryRequests: number;
  summaryCacheHits: number;
  traderRequests: number;
  traderCacheHits: number;
  fnoAutoEnrichmentCount: number;
  groqRequests: number;
  geminiRequests: number;
  localFallbackRequests: number;
  failedRequests: number;
  aiRequestsAvoided: number;
}

export class NewsAIUsageMonitor {
  private static instance: NewsAIUsageMonitor;

  private stats: AIUsageStats = {
    summaryRequests: 0,
    summaryCacheHits: 0,
    traderRequests: 0,
    traderCacheHits: 0,
    fnoAutoEnrichmentCount: 0,
    groqRequests: 0,
    geminiRequests: 0,
    localFallbackRequests: 0,
    failedRequests: 0,
    aiRequestsAvoided: 0
  };

  private constructor() {}

  public static getInstance(): NewsAIUsageMonitor {
    if (!NewsAIUsageMonitor.instance) {
      NewsAIUsageMonitor.instance = new NewsAIUsageMonitor();
    }
    return NewsAIUsageMonitor.instance;
  }

  public recordSummaryRequest(cacheHit: boolean = false): void {
    this.stats.summaryRequests++;
    if (cacheHit) this.stats.summaryCacheHits++;
  }

  public recordTraderRequest(cacheHit: boolean = false, isFnoAuto: boolean = false): void {
    this.stats.traderRequests++;
    if (cacheHit) this.stats.traderCacheHits++;
    if (isFnoAuto) this.stats.fnoAutoEnrichmentCount++;
  }

  public recordNormalArticleBypassedTrader(): void {
    this.stats.aiRequestsAvoided++;
  }

  public recordProviderUsage(provider: 'GROQ' | 'GEMINI' | 'LOCAL', failed: boolean = false): void {
    if (failed) {
      this.stats.failedRequests++;
      return;
    }
    if (provider === 'GROQ') this.stats.groqRequests++;
    else if (provider === 'GEMINI') this.stats.geminiRequests++;
    else if (provider === 'LOCAL') this.stats.localFallbackRequests++;
  }

  public getStats(): AIUsageStats {
    return { ...this.stats };
  }

  public reset(): void {
    this.stats = {
      summaryRequests: 0,
      summaryCacheHits: 0,
      traderRequests: 0,
      traderCacheHits: 0,
      fnoAutoEnrichmentCount: 0,
      groqRequests: 0,
      geminiRequests: 0,
      localFallbackRequests: 0,
      failedRequests: 0,
      aiRequestsAvoided: 0
    };
  }
}
