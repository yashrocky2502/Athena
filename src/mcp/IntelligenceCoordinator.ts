import { SearchManager } from "./SearchManager";
import { QuotaManager } from "./QuotaManager";
import { CoordinatorStatus, SearchRequest } from "../types";

export class IntelligenceCoordinator {
  private static instance: IntelligenceCoordinator;
  
  private searchManager = SearchManager.getInstance();
  private quotaManager = QuotaManager.getInstance();
  
  private queue: SearchRequest[] = [];
  private activeCount = 0;
  private MAX_CONCURRENT = 2; // Limit parallel Gemini calls to prevent sudden spikes
  
  private connectors: Record<string, { lastSync: string; status: string; refreshInterval: number }> = {};

  private constructor() {
    // Start queue processing loop
    this.processQueue();
  }

  public static getInstance(): IntelligenceCoordinator {
    if (!IntelligenceCoordinator.instance) {
      IntelligenceCoordinator.instance = new IntelligenceCoordinator();
    }
    return IntelligenceCoordinator.instance;
  }

  /**
   * Request data from external sources.
   * Prioritizes requests and handles batching/deduplication through SearchManager.
   */
  public async requestData(request: Omit<SearchRequest, "id" | "timestamp" | "onSuccess" | "onError"> & { customFetcher?: () => Promise<any> }): Promise<any> {
    return new Promise((resolve, reject) => {
      const fullRequest: SearchRequest & { customFetcher?: () => Promise<any> } = {
        ...request,
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        onSuccess: resolve,
        onError: reject
      };

      // Register connector if not already
      if (!this.connectors[request.source]) {
        this.connectors[request.source] = {
          lastSync: "Never",
          status: "Idle",
          refreshInterval: 0
        };
      }

      // Add to queue and sort by priority
      this.queue.push(fullRequest);
      this.queue.sort((a, b) => a.priority - b.priority); // Lower number = higher priority
    });
  }

  private async processQueue() {
    if (this.activeCount >= this.MAX_CONCURRENT || this.queue.length === 0) {
      setTimeout(() => this.processQueue(), 100);
      return;
    }

    const request = this.queue.shift();
    if (!request) {
      setTimeout(() => this.processQueue(), 100);
      return;
    }

    this.activeCount++;
    this.connectors[request.source].status = "Searching";

    // Dynamic TTL based on source type
    const ttl = this.getTTLForSource(request.source);

    try {
      let data;
      if ((request as any).customFetcher) {
        data = await (request as any).customFetcher();
      } else {
        data = await this.searchManager.search(request.query, request.source, ttl);
      }
      this.connectors[request.source].lastSync = new Date().toLocaleTimeString();
      this.connectors[request.source].status = "Success";
      request.onSuccess(data);
    } catch (error) {
      this.connectors[request.source].status = "Failed";
      request.onError(error);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private getTTLForSource(source: string): number {
    const s = source.toLowerCase();
    if (s.includes("breaking") || s.includes("news")) return 120000; // 2m
    if (s.includes("nse") || s.includes("bse")) return 300000; // 5m
    if (s.includes("filing") || s.includes("corporate")) return 900000; // 15m
    if (s.includes("sebi")) return 1800000; // 30m
    if (s.includes("rbi")) return 3600000; // 1h
    if (s.includes("macro")) return 7200000; // 2h
    return 300000; // Default 5m
  }

  public getStatus(): CoordinatorStatus {
    const metrics = this.searchManager.getMetrics();
    const stats = this.quotaManager.getStats();
    
    const totalRequests = metrics.cacheHits + metrics.cacheMisses;
    const cacheRatio = totalRequests > 0 ? (metrics.cacheHits / totalRequests) * 100 : 0;

    let status: CoordinatorStatus["status"] = "Online";
    if (this.quotaManager.isQuotaExhausted()) status = "Standby";
    else if (this.quotaManager.shouldThrottle()) status = "Throttled";

    return {
      status,
      queueLength: this.queue.length,
      activeSearches: this.activeCount,
      cacheHitRatio: Math.round(cacheRatio),
      mergedRequestsCount: metrics.mergedRequests,
      callsSavedCount: metrics.callsSaved,
      estimatedTokenSavings: metrics.estimatedTokenSavings, // Needs implementation to be real
      apiBudgetRemaining: stats.remainingCapacity,
      averageLatency: stats.averageResponseTime,
      connectors: this.connectors
    };
  }

  /**
   * Adjust connector behavior based on system health
   */
  public registerConnector(name: string, interval: number) {
    this.connectors[name] = {
      lastSync: "Never",
      status: "Initialized",
      refreshInterval: interval
    };
  }

  public getAdjustedRefreshInterval(name: string, baseInterval: number): number {
    if (this.quotaManager.isQuotaExhausted()) return baseInterval * 10;
    if (this.quotaManager.shouldThrottle()) return baseInterval * 2;
    return baseInterval;
  }
}
