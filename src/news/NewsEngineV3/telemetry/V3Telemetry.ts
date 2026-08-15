/**
 * ATHENA NEWS ENGINE V3 — TELEMETRY & PERFORMANCE METRICS
 * 
 * Real-time monitoring of CPU, RAM, processing time, pipeline queues,
 * publish rate, error rates, and collector status.
 */

export interface V3CollectorHealthStatus {
  collectorId: string;
  isHealthy: boolean;
  lastPollAt?: string;
  totalArticlesCollected: number;
  consecutiveFailures: number;
  lastError?: string;
  avgLatencyMs: number;
  healthPercentage?: number;
  circuitBreakerOpen?: boolean;
}

export interface V3TelemetrySnapshot {
  timestamp: string;
  system: {
    cpuUsagePercent: number;
    memoryUsageMB: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    uptimeSeconds: number;
  };
  pipeline: {
    queueLength: number;
    articlesReceivedTotal: number;
    articlesNormalizedTotal: number;
    storiesPublishedTotal: number;
    qualityGateRejectionsTotal: number;
    errorCountTotal: number;
    retryCountTotal: number;
    avgProcessingTimeMs: number;
    publishRatePerMin: number;
  };
  collectors: Record<string, V3CollectorHealthStatus>;
}

export class V3Telemetry {
  private static instance: V3Telemetry;
  
  private queueLength = 0;
  private articlesReceivedTotal = 0;
  private articlesNormalizedTotal = 0;
  private storiesPublishedTotal = 0;
  private qualityGateRejectionsTotal = 0;
  private errorCountTotal = 0;
  private retryCountTotal = 0;

  private processingTimesMs: number[] = [];
  private publishTimestamps: number[] = [];
  private collectorStatusMap: Map<string, V3CollectorHealthStatus> = new Map();

  private constructor() {}

  public static getInstance(): V3Telemetry {
    if (!V3Telemetry.instance) {
      V3Telemetry.instance = new V3Telemetry();
    }
    return V3Telemetry.instance;
  }

  public recordArticleReceived(): void {
    this.articlesReceivedTotal++;
  }

  public recordArticleNormalized(): void {
    this.articlesNormalizedTotal++;
  }

  public recordStoryPublished(): void {
    this.storiesPublishedTotal++;
    this.publishTimestamps.push(Date.now());
  }

  public recordQualityGateRejection(): void {
    this.qualityGateRejectionsTotal++;
  }

  public recordError(): void {
    this.errorCountTotal++;
  }

  public recordRetry(): void {
    this.retryCountTotal++;
  }

  public setQueueLength(len: number): void {
    this.queueLength = len;
  }

  public recordProcessingTime(timeMs: number): void {
    this.processingTimesMs.push(timeMs);
    if (this.processingTimesMs.length > 500) {
      this.processingTimesMs.shift();
    }
  }

  public updateCollectorStatus(status: V3CollectorHealthStatus): void {
    this.collectorStatusMap.set(status.collectorId, status);
  }

  public getSnapshot(): V3TelemetrySnapshot {
    const mem = process.memoryUsage();
    const now = Date.now();

    // Calculate publish rate in the last 60 seconds
    const oneMinAgo = now - 60000;
    this.publishTimestamps = this.publishTimestamps.filter(t => t > oneMinAgo);
    const publishRatePerMin = this.publishTimestamps.length;

    // Calculate average processing time
    const avgProcTime = this.processingTimesMs.length > 0
      ? Math.round(this.processingTimesMs.reduce((a, b) => a + b, 0) / this.processingTimesMs.length)
      : 0;

    const collectorsObj: Record<string, V3CollectorHealthStatus> = {};
    this.collectorStatusMap.forEach((val, key) => {
      collectorsObj[key] = { ...val };
    });

    return {
      timestamp: new Date(now).toISOString(),
      system: {
        cpuUsagePercent: 0, // Placeholder for OS CPU measurement
        memoryUsageMB: {
          rss: Math.round(mem.rss / (1024 * 1024)),
          heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
          heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
          external: Math.round(mem.external / (1024 * 1024))
        },
        uptimeSeconds: Math.round(process.uptime())
      },
      pipeline: {
        queueLength: this.queueLength,
        articlesReceivedTotal: this.articlesReceivedTotal,
        articlesNormalizedTotal: this.articlesNormalizedTotal,
        storiesPublishedTotal: this.storiesPublishedTotal,
        qualityGateRejectionsTotal: this.qualityGateRejectionsTotal,
        errorCountTotal: this.errorCountTotal,
        retryCountTotal: this.retryCountTotal,
        avgProcessingTimeMs: avgProcTime,
        publishRatePerMin
      },
      collectors: collectorsObj
    };
  }

  public reset(): void {
    this.queueLength = 0;
    this.articlesReceivedTotal = 0;
    this.articlesNormalizedTotal = 0;
    this.storiesPublishedTotal = 0;
    this.qualityGateRejectionsTotal = 0;
    this.errorCountTotal = 0;
    this.retryCountTotal = 0;
    this.processingTimesMs = [];
    this.publishTimestamps = [];
    this.collectorStatusMap.clear();
  }
}
