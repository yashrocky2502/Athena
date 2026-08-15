import { BaseMCP, MCPMetrics } from "./BaseMCP";
import { NormalizedEvent } from "../types";
import { IntelligenceCoordinator } from "./IntelligenceCoordinator";

export abstract class AbstractBaseMCP implements BaseMCP {
  protected abstract name: string;
  protected abstract refreshInterval: number; // in milliseconds
  protected abstract priorityValue: number;
  protected abstract sources: string[];
  protected mcpStatus: "online" | "offline" | "syncing" | "error" = "offline";
  protected lastSyncTime: Date | null = null;
  protected latencies: number[] = [];
  protected lastErrorMsg: string | null = null;

  // Access to singleton coordinator
  protected coordinator = IntelligenceCoordinator.getInstance();
  
  // Metrics counters
  protected totalRecordsProcessed = 0;
  protected totalChangedRecords = 0;
  protected totalFailedRecords = 0;
  protected totalFetchAttempts = 0;
  protected failedFetchAttempts = 0;

  // Change detection: Map of Record ID -> Content Hash
  protected processedHashes: Map<string, string> = new Map();
  // Store valid cached events for fallback
  protected cachedVerifiedEvidence: NormalizedEvent[] = [];

  public async initialize(): Promise<void> {
    try {
      this.coordinator.registerConnector(this.name, this.refreshInterval);
      this.mcpStatus = "online";
    } catch (e: any) {
      this.mcpStatus = "error";
      this.lastErrorMsg = e.message || "Failed to initialize";
    }
  }

  public async healthCheck(): Promise<boolean> {
    return this.mcpStatus !== "error" && this.mcpStatus !== "offline";
  }

  /**
   * Subclasses must implement raw fetching.
   */
  public abstract fetchUpdates(): Promise<any[]>;

  /**
   * Subclasses must implement record normalization.
   */
  public abstract normalize(raw: any): NormalizedEvent;

  /**
   * Returns a unique ID for a raw record (e.g., raw.id or raw.title).
   */
  protected abstract getRecordKey(raw: any): string;

  /**
   * Computes a hash or string representation to detect content changes.
   */
  protected getRecordHash(raw: any): string {
    return JSON.stringify(raw);
  }

  /**
   * Validates URLs and removes duplicates.
   */
  private validateAndDeduplicate(events: NormalizedEvent[]): NormalizedEvent[] {
    const seenUrls = new Set<string>();
    return events.filter(event => {
      // Ignore malformed URLs
      if (!event.originalUrl || !event.originalUrl.startsWith("http")) {
        return false;
      }
      
      const normalizedUrl = this.normalizeUrl(event.originalUrl);
      if (!normalizedUrl) return false;

      // Remove duplicate URLs
      if (seenUrls.has(normalizedUrl)) {
        return false;
      }
      seenUrls.add(normalizedUrl);
      return true;
    });
  }

  private normalizeUrl(url: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.origin + u.pathname.replace(/\/$/, "");
    } catch (e) {
      return url.toLowerCase().split("?")[0].replace(/\/$/, "");
    }
  }

  /**
   * Core execution flow with Change Detection, Latency Tracking, Retry, and Fallback.
   */
  public async sync(): Promise<NormalizedEvent[]> {
    const startTime = Date.now();
    this.mcpStatus = "syncing";

    let rawRecords: any[] = [];
    let fetchSuccess = false;
    let retries = 1;

    for (let attempt = 0; attempt <= retries; attempt++) {
      this.totalFetchAttempts++;
      try {
        rawRecords = await this.fetchUpdates();
        fetchSuccess = true;
        break;
      } catch (err: any) {
        this.failedFetchAttempts++;
        console.warn(`MCP [${this.name}] Fetch attempt ${attempt + 1} failed:`, err.message || err);
        if (attempt === retries) {
          this.lastErrorMsg = err.message || "Fetch failed";
        }
      }
    }

    if (!fetchSuccess) {
      this.mcpStatus = "error";
      this.totalFailedRecords++;
      const latency = Date.now() - startTime;
      this.latencies.push(latency);

      return this.triggerFallback(startTime);
    }

    try {
      this.totalRecordsProcessed += rawRecords.length;
      
      // If live records are empty (e.g. due to quota limit returning []), 
      // and we have NO cached evidence yet, we trigger a forced fallback 
      // so the UI isn't completely empty during initialization failures.
      if (rawRecords.length === 0 && this.cachedVerifiedEvidence.length === 0) {
        return this.triggerFallback(startTime);
      }

      let changedNormEvents: NormalizedEvent[] = [];
      let currentFailed = 0;

      for (const raw of rawRecords) {
        try {
          const key = this.getRecordKey(raw);
          const hash = this.getRecordHash(raw);
          
          const isNewOrChanged = !this.processedHashes.has(key) || this.processedHashes.get(key) !== hash;

          if (isNewOrChanged) {
            this.processedHashes.set(key, hash);
            this.totalChangedRecords++;
            const normalized = this.normalize(raw);
            changedNormEvents.push(normalized);
          }
        } catch (err) {
          currentFailed++;
          this.totalFailedRecords++;
        }
      }

      changedNormEvents = this.validateAndDeduplicate(changedNormEvents);
      
      // Update cached verified evidence
      this.cachedVerifiedEvidence = [...changedNormEvents, ...this.cachedVerifiedEvidence].slice(0, 50);

      // Track latency
      const latency = Date.now() - startTime;
      this.latencies.push(latency);
      if (this.latencies.length > 20) {
        this.latencies.shift();
      }

      this.mcpStatus = "online";
      this.lastSyncTime = new Date();
      this.lastErrorMsg = null;

      return changedNormEvents;
    } catch (err: any) {
      this.mcpStatus = "error";
      this.lastErrorMsg = err.message || "Sync failed";
      this.totalFailedRecords++;
      
      const latency = Date.now() - startTime;
      this.latencies.push(latency);
      
      return [];
    }
  }

  public lastSync(): Date | null {
    return this.lastSyncTime;
  }

  public priority(): number {
    return this.priorityValue;
  }

  public supportedSources(): string[] {
    return this.sources;
  }

  public status(): "online" | "offline" | "syncing" | "error" {
    return this.mcpStatus;
  }

  public getName(): string {
    return this.name;
  }

  public getRefreshInterval(): number {
    return this.coordinator.getAdjustedRefreshInterval(this.name, this.refreshInterval);
  }

  public getMetrics(): MCPMetrics {
    const avgLatency = this.latencies.length > 0 
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length) 
      : 0;
    
    const successRate = this.totalFetchAttempts > 0 
      ? Math.round(((this.totalFetchAttempts - this.failedFetchAttempts) / this.totalFetchAttempts) * 100)
      : 100;

    return {
      status: this.mcpStatus,
      lastSuccessfulSync: this.lastSyncTime,
      averageLatency: avgLatency,
      lastError: this.lastErrorMsg,
      recordsProcessed: this.totalRecordsProcessed,
      changedRecords: this.totalChangedRecords,
      failedRecords: this.totalFailedRecords,
      queueSize: this.processedHashes.size,
      latencyMs: avgLatency,
      successRate,
      lastSync: this.lastSyncTime,
      errorCount: this.failedFetchAttempts,
      averageResponseTime: avgLatency
    };
  }

  private triggerFallback(startTime: number): NormalizedEvent[] {
    const fallbackEvent: NormalizedEvent = {
      id: `fallback-${this.name}-${Date.now()}`,
      title: `${this.name}: Using cached evidence.`,
      summary: `Live ${this.name} feed is currently on rate-limited standby. Authenticating latest verified signals from cache.`,
      source: this.name,
      publishedTime: new Date().toISOString(),
      retrievedTime: new Date().toISOString(),
      companies: [],
      sectors: [],
      themes: [],
      confidence: 60,
      originalUrl: "https://system.fallback.local"
    };
    
    return [fallbackEvent, ...this.cachedVerifiedEvidence];
  }
}
