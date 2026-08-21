/**
 * ATHENA NEWS ENGINE — STAGE 8.3 SOURCE HEALTH MONITOR
 * Deterministic source health tracking, failure classification, stall detection, and extraction monitoring.
 */

export type HealthState = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'OFFLINE' | 'UNKNOWN';
export type FailureClass = 'TRANSIENT' | 'PERMANENT' | 'ACCESS_RESTRICTED' | 'MISSING_RESOURCE' | 'UNKNOWN';
export type StallState = 'HEALTHY' | 'NO_NEW_CONTENT' | 'STALLED';

export interface ExtractionHealthRecord {
  successfulHtmlExtractions: number;
  fallbackExtractions: number;
  metadataOnlyExtractions: number;
  blockedPages: number;
  truncatedContent: number;
  avgExtractionQuality: number;
}

export interface SourceHealthRecord {
  sourceId: string;
  publisher: string;
  sourceType: string;
  enabled: boolean;
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
  lastSuccessfulArticleAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  totalPolls: number;
  successfulPolls: number;
  failedPolls: number;
  fetchedArticles: number;
  acceptedArticles: number;
  rejectedArticles: number;
  duplicateArticles: number;
  averagePollLatencyMs: number;
  latestPollLatencyMs: number;
  estimatedFreshnessSeconds: number;
  httpStatusDistribution: Record<string, number>;
  healthState: HealthState;
  stallState: StallState;
  lastFailureClass?: FailureClass;
  lastErrorMsg?: string;
  backoffUntilMs?: number;
  expectedPollingIntervalMs: number;
  extractionHealth: ExtractionHealthRecord;
}

export class SourceHealthMonitor {
  private static instance: SourceHealthMonitor | null = null;
  private sources: Map<string, SourceHealthRecord> = new Map();

  private constructor() {}

  public static getInstance(): SourceHealthMonitor {
    if (!SourceHealthMonitor.instance) {
      SourceHealthMonitor.instance = new SourceHealthMonitor();
    }
    return SourceHealthMonitor.instance;
  }

  public static resetInstance(): SourceHealthMonitor {
    SourceHealthMonitor.instance = new SourceHealthMonitor();
    return SourceHealthMonitor.instance;
  }

  /**
   * Registers a source with default initial state.
   */
  public registerSource(
    sourceId: string,
    publisher: string,
    sourceType: string = 'RSS',
    expectedPollingIntervalMs: number = 60000
  ): SourceHealthRecord {
    const existing = this.sources.get(sourceId);
    if (existing) {
      return existing;
    }

    const record: SourceHealthRecord = {
      sourceId,
      publisher,
      sourceType,
      enabled: true,
      lastPollAt: null,
      lastSuccessfulPollAt: null,
      lastSuccessfulArticleAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      fetchedArticles: 0,
      acceptedArticles: 0,
      rejectedArticles: 0,
      duplicateArticles: 0,
      averagePollLatencyMs: 0,
      latestPollLatencyMs: 0,
      estimatedFreshnessSeconds: 0,
      httpStatusDistribution: {},
      healthState: 'UNKNOWN',
      stallState: 'HEALTHY',
      expectedPollingIntervalMs,
      extractionHealth: {
        successfulHtmlExtractions: 0,
        fallbackExtractions: 0,
        metadataOnlyExtractions: 0,
        blockedPages: 0,
        truncatedContent: 0,
        avgExtractionQuality: 100
      }
    };

    this.sources.set(sourceId, record);
    return record;
  }

  public recordPollStart(sourceId: string): void {
    const record = this.sources.get(sourceId);
    if (!record) return;

    record.totalPolls++;
    record.lastPollAt = new Date().toISOString();
  }

  /**
   * Records a successful polling execution.
   */
  public recordPollSuccess(
    sourceId: string,
    latencyMs: number,
    fetched: number,
    accepted: number,
    rejected: number,
    duplicates: number,
    latestArticleTimestamp?: string,
    httpStatus: number = 200
  ): void {
    let record = this.sources.get(sourceId);
    if (!record) {
      record = this.registerSource(sourceId, sourceId);
    }

    const nowIso = new Date().toISOString();
    record.successfulPolls++;
    record.consecutiveFailures = 0;
    record.lastSuccessfulPollAt = nowIso;
    record.latestPollLatencyMs = latencyMs;
    record.backoffUntilMs = undefined;

    // HTTP Status distribution
    const statusKey = String(httpStatus);
    record.httpStatusDistribution[statusKey] = (record.httpStatusDistribution[statusKey] || 0) + 1;

    // Latency moving average
    if (record.averagePollLatencyMs === 0) {
      record.averagePollLatencyMs = latencyMs;
    } else {
      record.averagePollLatencyMs = Math.round(record.averagePollLatencyMs * 0.8 + latencyMs * 0.2);
    }

    record.fetchedArticles += fetched;
    record.acceptedArticles += accepted;
    record.rejectedArticles += rejected;
    record.duplicateArticles += duplicates;

    if (latestArticleTimestamp || accepted > 0 || fetched > 0) {
      const artTime = latestArticleTimestamp || nowIso;
      record.lastSuccessfulArticleAt = artTime;
      const ageSec = Math.max(0, Math.floor((Date.now() - new Date(artTime).getTime()) / 1000));
      record.estimatedFreshnessSeconds = ageSec;
    }

    this.updateSourceHealth(record);
  }

  /**
   * Deterministically classifies source failures and records the failure metrics.
   */
  public classifyFailure(error: any, httpStatus?: number): { failureClass: FailureClass; isTransient: boolean; suggestedBackoffMs: number } {
    const msg = String(error?.message || error || '').toLowerCase();
    const status = httpStatus || error?.status || error?.httpStatus;

    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
        msg.includes('timeout') || msg.includes('econnreset') || msg.includes('enotfound') ||
        msg.includes('network') || msg.includes('fetch_error') || msg.includes('connection reset')) {
      return { failureClass: 'TRANSIENT', isTransient: true, suggestedBackoffMs: 2000 };
    }

    if (status === 400 || status === 401 || msg.includes('unauthorized') || msg.includes('invalid credentials') || msg.includes('malformed feed')) {
      return { failureClass: 'PERMANENT', isTransient: false, suggestedBackoffMs: 3600000 };
    }

    if (status === 403 || msg.includes('access denied') || msg.includes('robots') || msg.includes('forbidden') || msg.includes('blocking')) {
      return { failureClass: 'ACCESS_RESTRICTED', isTransient: false, suggestedBackoffMs: 3600000 };
    }

    if (status === 404 || msg.includes('not found') || msg.includes('invalid feed url')) {
      return { failureClass: 'MISSING_RESOURCE', isTransient: false, suggestedBackoffMs: 3600000 };
    }

    return { failureClass: 'TRANSIENT', isTransient: true, suggestedBackoffMs: 1000 };
  }

  /**
   * Records a failed poll execution with error classification and exponential backoff.
   */
  public recordPollFailure(sourceId: string, latencyMs: number, error: any, httpStatus?: number): FailureClass {
    let record = this.sources.get(sourceId);
    if (!record) {
      record = this.registerSource(sourceId, sourceId);
    }

    const nowIso = new Date().toISOString();
    record.failedPolls++;
    record.consecutiveFailures++;
    record.lastFailureAt = nowIso;
    record.latestPollLatencyMs = latencyMs;
    record.lastErrorMsg = String(error?.message || error || 'Unknown source error');

    const status = httpStatus || error?.status || error?.httpStatus || 500;
    const statusKey = String(status);
    record.httpStatusDistribution[statusKey] = (record.httpStatusDistribution[statusKey] || 0) + 1;

    const classification = this.classifyFailure(error, status);
    record.lastFailureClass = classification.failureClass;

    if (classification.isTransient) {
      // Bounded exponential backoff: 2s, 4s, 8s, 16s... up to 60s
      const backoffSec = Math.min(60, Math.pow(2, record.consecutiveFailures));
      record.backoffUntilMs = Date.now() + backoffSec * 1000;
    } else {
      // Permanent failure or access denial: long backoff, do not retry endlessly
      record.backoffUntilMs = Date.now() + classification.suggestedBackoffMs;
    }

    this.updateSourceHealth(record);
    return classification.failureClass;
  }

  /**
   * Records Publisher HTML extraction outcome (Part L).
   */
  public recordExtractionOutcome(
    sourceId: string,
    outcome: 'SUCCESS' | 'FALLBACK' | 'METADATA_ONLY' | 'BLOCKED' | 'TRUNCATED',
    qualityScore: number = 100
  ): void {
    const record = this.sources.get(sourceId);
    if (!record) return;

    const eh = record.extractionHealth;
    if (outcome === 'SUCCESS') eh.successfulHtmlExtractions++;
    else if (outcome === 'FALLBACK') eh.fallbackExtractions++;
    else if (outcome === 'METADATA_ONLY') eh.metadataOnlyExtractions++;
    else if (outcome === 'BLOCKED') eh.blockedPages++;
    else if (outcome === 'TRUNCATED') eh.truncatedContent++;

    // Update moving average quality
    eh.avgExtractionQuality = Math.round(eh.avgExtractionQuality * 0.8 + qualityScore * 0.2);
  }

  /**
   * Updates healthState and stallState based on metrics.
   */
  private updateSourceHealth(record: SourceHealthRecord): void {
    const now = Date.now();

    // 1. Stall State Evaluation (Part K)
    if (record.lastSuccessfulArticleAt) {
      const timeSinceLastArticleMs = now - new Date(record.lastSuccessfulArticleAt).getTime();
      const sixHoursMs = 6 * 60 * 60 * 1000;
      const doubleIntervalMs = record.expectedPollingIntervalMs * 2;

      if (timeSinceLastArticleMs > sixHoursMs) {
        record.stallState = 'STALLED';
      } else if (timeSinceLastArticleMs > doubleIntervalMs) {
        record.stallState = 'NO_NEW_CONTENT';
      } else {
        record.stallState = 'HEALTHY';
      }
    } else if (record.successfulPolls > 0) {
      record.stallState = 'NO_NEW_CONTENT';
    }

    // 2. Health State Evaluation
    if (record.lastFailureClass === 'PERMANENT' || record.lastFailureClass === 'ACCESS_RESTRICTED' || record.lastFailureClass === 'MISSING_RESOURCE') {
      record.healthState = 'OFFLINE';
    } else if (record.consecutiveFailures >= 5) {
      record.healthState = 'OFFLINE';
    } else if (record.consecutiveFailures >= 3) {
      record.healthState = 'FAILING';
    } else if (record.consecutiveFailures > 0 || record.stallState === 'STALLED' || record.averagePollLatencyMs > 5000) {
      record.healthState = 'DEGRADED';
    } else if (record.successfulPolls > 0) {
      record.healthState = 'HEALTHY';
    } else {
      record.healthState = 'UNKNOWN';
    }
  }

  public isSourceInBackoff(sourceId: string): boolean {
    const record = this.sources.get(sourceId);
    if (!record || !record.backoffUntilMs) return false;
    return Date.now() < record.backoffUntilMs;
  }

  public getSourceHealth(sourceId: string): SourceHealthRecord | undefined {
    const record = this.sources.get(sourceId);
    if (record) {
      this.updateSourceHealth(record);
    }
    return record;
  }

  public getAllSourceHealth(): SourceHealthRecord[] {
    for (const record of this.sources.values()) {
      this.updateSourceHealth(record);
    }
    return Array.from(this.sources.values());
  }

  public reset(): void {
    this.sources.clear();
  }
}

export const sourceHealthMonitor = SourceHealthMonitor.getInstance();
