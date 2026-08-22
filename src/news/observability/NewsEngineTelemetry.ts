/**
 * ATHENA NEWS ENGINE — STAGE 8.7 PRODUCTION OBSERVABILITY
 * NewsEngineTelemetry
 * 
 * Deterministic, in-memory, non-blocking operational telemetry singleton.
 * Aggregates runtime telemetry across:
 * - Ingestion & Growth
 * - Normalization & Freshness
 * - Event Clustering & Escalation
 * - Telegram Dispatch & Delivery
 * - AI Usage & Provider Distribution
 * - Storage Sync & Integrity Boundaries
 * 
 * Guarantees:
 * - Zero disk writes / zero canonical mutation
 * - Non-blocking execution (sub-millisecond metric collection)
 * - Thread-safe reset for isolated test execution
 */

import { IngestionTelemetry } from '../monitoring/IngestionTelemetry';
import { IngestionLatencyTracker } from '../monitoring/IngestionLatencyTracker';
import { SourceHealthMonitor } from '../monitoring/SourceHealthMonitor';
import { ArticleFreshnessEvaluator } from '../freshness/ArticleFreshnessEvaluator';
import { EventFingerprintEngine } from '../deduplication/EventFingerprintEngine';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { NewsAIUsageMonitor } from '../monitoring/NewsAIUsageMonitor';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';

export interface TelemetrySnapshot {
  timestamp: string;
  uptimeSeconds: number;
  ingestion: {
    totalIngested: number;
    totalRejected: number;
    duplicateCount: number;
    averageLatencyMs: number;
    lastIngestedAt: string | null;
  };
  normalization: {
    malformedCount: number;
    sanitizedCount: number;
    freshnessDistribution: Record<string, number>;
  };
  events: {
    totalEvents: number;
    breakingEvents: number;
    escalationCount: number;
    numericalConflictCount: number;
  };
  telegram: {
    queuedCount: number;
    dispatchedCount: number;
    suppressedCount: number;
    failedCount: number;
    medianDeliveryLatencyMs: number;
  };
  ai: {
    summaryRequests: number;
    traderRequests: number;
    groqRequests: number;
    geminiRequests: number;
    localFallbackRequests: number;
    bypassedCount: number;
  };
  integrity: {
    canonicalDiskCount: number;
    persistentMemoryCount: number;
    apiCountMismatch: boolean;
    quarantineCount: number;
  };
}

export class NewsEngineTelemetry {
  private static instance: NewsEngineTelemetry | null = null;
  private startTime: number = Date.now();

  // Internal counters for telemetry directly logged
  private customEvents = {
    sanitizedCount: 0,
    breakingEventsCount: 0,
    escalationsCount: 0,
    conflictsCount: 0,
  };

  private constructor() {
    this.startTime = Date.now();
  }

  public static getInstance(): NewsEngineTelemetry {
    if (!NewsEngineTelemetry.instance) {
      NewsEngineTelemetry.instance = new NewsEngineTelemetry();
    }
    return NewsEngineTelemetry.instance;
  }

  public static resetInstance(): NewsEngineTelemetry {
    NewsEngineTelemetry.instance = new NewsEngineTelemetry();
    return NewsEngineTelemetry.instance;
  }

  public recordSanitizedRecord(): void {
    this.customEvents.sanitizedCount++;
  }

  public recordBreakingEvent(): void {
    this.customEvents.breakingEventsCount++;
  }

  public recordEscalation(): void {
    this.customEvents.escalationsCount++;
  }

  public recordConflict(): void {
    this.customEvents.conflictsCount++;
  }

  /**
   * Builds an aggregated operational telemetry snapshot across all subsystem monitors.
   */
  public getSnapshot(): TelemetrySnapshot {
    const ingSummary = IngestionTelemetry.getInstance().getTelemetrySummary();
    const latStats = IngestionLatencyTracker.getInstance().getGlobalSLAStats();
    const tgTelem = TelegramNotificationPipeline.getInstance().getTelemetry();
    const aiStats = NewsAIUsageMonitor.getInstance().getStats();
    
    // Event metrics
    const eventsList = EventCentricOrchestrator.getInstance().getAllEvents();
    const breakingEvents = eventsList.filter(e => e.eventFreshness === 'BREAKING' || e.eventPriority === 'P0').length + this.customEvents.breakingEventsCount;
    const escalationCount = eventsList.filter(e => e.escalationLevel > 0).length + this.customEvents.escalationsCount;
    const numericalConflictCount = eventsList.filter(e => e.conflictStatus !== 'NONE').length + this.customEvents.conflictsCount;

    // Integrity metrics
    const persistentMemoryArticles = newsStore.getAllArticles();
    const persistentMemoryCount = persistentMemoryArticles.length;
    
    let canonicalDiskCount = persistentMemoryCount;
    try {
      if (typeof newsStore.getStats === 'function') {
        const stats = newsStore.getStats();
        canonicalDiskCount = stats.storageCount || persistentMemoryCount;
      }
    } catch {}

    const quarantineLog = ArticleFreshnessEvaluator.getQuarantineLog();

    const freshnessDist = ArticleFreshnessEvaluator.evaluateBatchFreshness(persistentMemoryArticles.slice(-200) as any[]);

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      ingestion: {
        totalIngested: ingSummary.articlesAccepted,
        totalRejected: ingSummary.articlesRejected,
        duplicateCount: ingSummary.duplicateArticles,
        averageLatencyMs: latStats.totalEndToEndLatencyMs.median,
        lastIngestedAt: ingSummary.latestSuccessfulIngestionTime
      },
      normalization: {
        malformedCount: ingSummary.malformedArticles,
        sanitizedCount: this.customEvents.sanitizedCount,
        freshnessDistribution: freshnessDist
      },
      events: {
        totalEvents: eventsList.length,
        breakingEvents,
        escalationCount,
        numericalConflictCount
      },
      telegram: {
        queuedCount: tgTelem.totalQueued,
        dispatchedCount: tgTelem.totalDispatched,
        suppressedCount: tgTelem.totalSuppressed,
        failedCount: tgTelem.totalFailed,
        medianDeliveryLatencyMs: tgTelem.medianDeliveryLatencyMs
      },
      ai: {
        summaryRequests: aiStats.summaryRequests,
        traderRequests: aiStats.traderRequests,
        groqRequests: aiStats.groqRequests,
        geminiRequests: aiStats.geminiRequests,
        localFallbackRequests: aiStats.localFallbackRequests,
        bypassedCount: aiStats.aiRequestsAvoided
      },
      integrity: {
        canonicalDiskCount,
        persistentMemoryCount,
        apiCountMismatch: canonicalDiskCount !== persistentMemoryCount,
        quarantineCount: quarantineLog.length
      }
    };
  }

  public resetTelemetry(): void {
    this.startTime = Date.now();
    this.customEvents = {
      sanitizedCount: 0,
      breakingEventsCount: 0,
      escalationsCount: 0,
      conflictsCount: 0,
    };
    IngestionTelemetry.getInstance().reset();
    IngestionLatencyTracker.getInstance().reset();
    NewsAIUsageMonitor.getInstance().reset();
  }
}

export const newsEngineTelemetry = NewsEngineTelemetry.getInstance();
