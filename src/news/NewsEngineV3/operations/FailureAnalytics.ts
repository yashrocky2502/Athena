/**
 * ATHENA NEWS ENGINE V3 — FAILURE ANALYTICS ENGINE
 * 
 * Aggregates, categorizes, and ranks pipeline failures:
 * - Collector failures
 * - Parser failures
 * - AI failures
 * - Quality Gate failures
 * - Telegram delivery failures
 * - Memory/System failures
 */

export type V3FailureCategory =
  | 'COLLECTOR_FAILURE'
  | 'PARSER_FAILURE'
  | 'AI_FAILURE'
  | 'QUALITY_GATE_FAILURE'
  | 'TELEGRAM_FAILURE'
  | 'MEMORY_SYSTEM_FAILURE';

export interface V3FailureRecord {
  id: string;
  category: V3FailureCategory;
  rootCause: string;
  count: number;
  lastOccurredAt: string;
  samplePayload?: Record<string, any>;
}

export interface V3RankedFailureReport {
  timestamp: string;
  totalFailures: number;
  topFailures: V3FailureRecord[];
  failuresByCategory: Record<V3FailureCategory, number>;
}

export class FailureAnalytics {
  private static instance: FailureAnalytics;
  private failuresMap: Map<string, V3FailureRecord> = new Map();

  private constructor() {
    // Seed initial mock records for operational visibility
    this.recordFailure('COLLECTOR_FAILURE', 'HTTP 503 Service Unavailable from Feed Source');
    this.recordFailure('QUALITY_GATE_FAILURE', 'Missing required PAT metric in Quarterly Results');
  }

  public static getInstance(): FailureAnalytics {
    if (!FailureAnalytics.instance) {
      FailureAnalytics.instance = new FailureAnalytics();
    }
    return FailureAnalytics.instance;
  }

  public recordFailure(
    category: V3FailureCategory,
    rootCause: string,
    samplePayload?: Record<string, any>
  ): void {
    const key = `${category}::${rootCause}`;
    const existing = this.failuresMap.get(key);

    if (existing) {
      existing.count++;
      existing.lastOccurredAt = new Date().toISOString();
      if (samplePayload) existing.samplePayload = samplePayload;
    } else {
      this.failuresMap.set(key, {
        id: `FAIL_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        category,
        rootCause,
        count: 1,
        lastOccurredAt: new Date().toISOString(),
        samplePayload
      });
    }
  }

  public getRankedReport(): V3RankedFailureReport {
    const allRecords = Array.from(this.failuresMap.values());
    allRecords.sort((a, b) => b.count - a.count);

    let total = 0;
    const byCategory: Record<V3FailureCategory, number> = {
      COLLECTOR_FAILURE: 0,
      PARSER_FAILURE: 0,
      AI_FAILURE: 0,
      QUALITY_GATE_FAILURE: 0,
      TELEGRAM_FAILURE: 0,
      MEMORY_SYSTEM_FAILURE: 0
    };

    allRecords.forEach(r => {
      total += r.count;
      byCategory[r.category] = (byCategory[r.category] || 0) + r.count;
    });

    return {
      timestamp: new Date().toISOString(),
      totalFailures: total,
      topFailures: allRecords,
      failuresByCategory: byCategory
    };
  }

  public clear(): void {
    this.failuresMap.clear();
  }
}
