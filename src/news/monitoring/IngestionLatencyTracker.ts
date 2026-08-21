/**
 * ATHENA NEWS ENGINE — STAGE 8.3 INGESTION LATENCY & FRESHNESS SLA TRACKER
 * Measures publishedAt -> discoveredAt -> normalizedAt -> summaryReadyAt -> eligibilityCheckedAt -> queuedAt -> sentAt.
 * Calculates median, P95, and P99 SLAs globally and per source.
 */

export interface ArticleLatencyTelemetry {
  articleId: string;
  publisher: string;
  publishedAt: string;
  discoveredAt: string;
  normalizedAt: string;
  summaryReadyAt: string;
  eligibilityCheckedAt: string;
  queuedAt?: string;
  sentAt?: string;

  // Latencies in MS
  sourceDiscoveryLatencyMs: number;
  normalizationLatencyMs: number;
  summaryLatencyMs: number;
  signalEvaluationLatencyMs: number;
  telegramQueueLatencyMs: number;
  totalEndToEndLatencyMs: number;
}

export interface SLAStats {
  sampleCount: number;
  sourceDiscoveryLatencyMs: { median: number; p95: number; p99: number };
  normalizationLatencyMs: { median: number; p95: number; p99: number };
  summaryLatencyMs: { median: number; p95: number; p99: number };
  signalEvaluationLatencyMs: { median: number; p95: number; p99: number };
  telegramQueueLatencyMs: { median: number; p95: number; p99: number };
  totalEndToEndLatencyMs: { median: number; p95: number; p99: number };
}

export class IngestionLatencyTracker {
  private static instance: IngestionLatencyTracker | null = null;
  private records: ArticleLatencyTelemetry[] = [];
  private sourceRecords: Map<string, ArticleLatencyTelemetry[]> = new Map();

  private constructor() {}

  public static getInstance(): IngestionLatencyTracker {
    if (!IngestionLatencyTracker.instance) {
      IngestionLatencyTracker.instance = new IngestionLatencyTracker();
    }
    return IngestionLatencyTracker.instance;
  }

  public static resetInstance(): IngestionLatencyTracker {
    IngestionLatencyTracker.instance = new IngestionLatencyTracker();
    return IngestionLatencyTracker.instance;
  }

  /**
   * Calculates and records end-to-end latency metrics for an article.
   */
  public recordTelemetry(data: {
    articleId: string;
    publisher: string;
    publishedAt: string;
    discoveredAt: string;
    normalizedAt: string;
    summaryReadyAt: string;
    eligibilityCheckedAt: string;
    queuedAt?: string;
    sentAt?: string;
  }): ArticleLatencyTelemetry {
    const tPub = new Date(data.publishedAt).getTime();
    const tDisc = new Date(data.discoveredAt).getTime();
    const tNorm = new Date(data.normalizedAt).getTime();
    const tSumm = new Date(data.summaryReadyAt).getTime();
    const tElig = new Date(data.eligibilityCheckedAt).getTime();
    const tQue = data.queuedAt ? new Date(data.queuedAt).getTime() : tElig;
    const tSent = data.sentAt ? new Date(data.sentAt).getTime() : tQue;

    const sourceDiscoveryLatencyMs = Math.max(0, tDisc - (isNaN(tPub) ? tDisc : tPub));
    const normalizationLatencyMs = Math.max(0, tNorm - tDisc);
    const summaryLatencyMs = Math.max(0, tSumm - tNorm);
    const signalEvaluationLatencyMs = Math.max(0, tElig - tSumm);
    const telegramQueueLatencyMs = Math.max(0, tSent - tQue);
    const totalEndToEndLatencyMs = Math.max(0, tSent - (isNaN(tPub) ? tDisc : tPub));

    const record: ArticleLatencyTelemetry = {
      articleId: data.articleId,
      publisher: data.publisher,
      publishedAt: data.publishedAt,
      discoveredAt: data.discoveredAt,
      normalizedAt: data.normalizedAt,
      summaryReadyAt: data.summaryReadyAt,
      eligibilityCheckedAt: data.eligibilityCheckedAt,
      queuedAt: data.queuedAt,
      sentAt: data.sentAt,
      sourceDiscoveryLatencyMs,
      normalizationLatencyMs,
      summaryLatencyMs,
      signalEvaluationLatencyMs,
      telegramQueueLatencyMs,
      totalEndToEndLatencyMs
    };

    this.records.push(record);

    if (!this.sourceRecords.has(data.publisher)) {
      this.sourceRecords.set(data.publisher, []);
    }
    this.sourceRecords.get(data.publisher)!.push(record);

    return record;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, index)]);
  }

  private computeSLAForList(list: ArticleLatencyTelemetry[]): SLAStats {
    if (list.length === 0) {
      const zero = { median: 0, p95: 0, p99: 0 };
      return {
        sampleCount: 0,
        sourceDiscoveryLatencyMs: zero,
        normalizationLatencyMs: zero,
        summaryLatencyMs: zero,
        signalEvaluationLatencyMs: zero,
        telegramQueueLatencyMs: zero,
        totalEndToEndLatencyMs: zero
      };
    }

    const disc = list.map(r => r.sourceDiscoveryLatencyMs);
    const norm = list.map(r => r.normalizationLatencyMs);
    const summ = list.map(r => r.summaryLatencyMs);
    const elig = list.map(r => r.signalEvaluationLatencyMs);
    const que = list.map(r => r.telegramQueueLatencyMs);
    const e2e = list.map(r => r.totalEndToEndLatencyMs);

    return {
      sampleCount: list.length,
      sourceDiscoveryLatencyMs: {
        median: this.calculatePercentile(disc, 50),
        p95: this.calculatePercentile(disc, 95),
        p99: this.calculatePercentile(disc, 99)
      },
      normalizationLatencyMs: {
        median: this.calculatePercentile(norm, 50),
        p95: this.calculatePercentile(norm, 95),
        p99: this.calculatePercentile(norm, 99)
      },
      summaryLatencyMs: {
        median: this.calculatePercentile(summ, 50),
        p95: this.calculatePercentile(summ, 95),
        p99: this.calculatePercentile(summ, 99)
      },
      signalEvaluationLatencyMs: {
        median: this.calculatePercentile(elig, 50),
        p95: this.calculatePercentile(elig, 95),
        p99: this.calculatePercentile(elig, 99)
      },
      telegramQueueLatencyMs: {
        median: this.calculatePercentile(que, 50),
        p95: this.calculatePercentile(que, 95),
        p99: this.calculatePercentile(que, 99)
      },
      totalEndToEndLatencyMs: {
        median: this.calculatePercentile(e2e, 50),
        p95: this.calculatePercentile(e2e, 95),
        p99: this.calculatePercentile(e2e, 99)
      }
    };
  }

  public getGlobalSLAStats(): SLAStats {
    return this.computeSLAForList(this.records);
  }

  public getSourceSLAStats(publisher: string): SLAStats {
    const list = this.sourceRecords.get(publisher) || [];
    return this.computeSLAForList(list);
  }

  public getAllSourceSLAStats(): Record<string, SLAStats> {
    const result: Record<string, SLAStats> = {};
    for (const [publisher, list] of this.sourceRecords.entries()) {
      result[publisher] = this.computeSLAForList(list);
    }
    return result;
  }

  public reset(): void {
    this.records = [];
    this.sourceRecords.clear();
  }
}

export const ingestionLatencyTracker = IngestionLatencyTracker.getInstance();
