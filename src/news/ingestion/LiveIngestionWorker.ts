/**
 * ATHENA NEWS ENGINE — STAGE 8.1 LIVE INGESTION WORKER
 * 
 * Continuous background worker orchestrating multi-source live ingestion,
 * feed polling, deduplication, isolated failure boundaries, and zero-AI startup compliance.
 */

import { INewsStore } from '../storage/NewsStore';
import { JsonNewsStore } from '../storage/JsonNewsStore';
import { IngestionPipeline, IngestionResult } from './IngestionPipeline';
import { CollectorAdapter, ICollectorSource } from './CollectorAdapter';
import {
  AUTHORITATIVE_LIVE_FEEDS,
  LiveRssSourceProvider,
  OfficialFeedsSourceProvider,
  LiveSourceFeedConfig
} from './LiveSourceProviders';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';

export type WorkerState = 'STOPPED' | 'RUNNING' | 'POLLING' | 'ERROR';

export interface SourceHealthRecord {
  sourceId: string;
  sourceName: string;
  publisher: string;
  tier: number;
  enabled: boolean;
  lastPollAt?: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
  totalFetched: number;
  totalSaved: number;
  lastError?: string;
}

export interface WorkerTelemetry {
  state: WorkerState;
  intervalMs: number;
  isPolling: boolean;
  lastPollStartedAt: string | null;
  lastPollCompletedAt: string | null;
  lastPollDurationMs: number;
  lifetimePolls: number;
  lifetimeFetched: number;
  lifetimeSaved: number;
  lifetimeDuplicates: number;
  lifetimeErrors: number;
  activeSourceCount: number;
  sources: SourceHealthRecord[];
  telegramPipeline?: any;
}

export class LiveIngestionWorker {
  private static instance: LiveIngestionWorker;
  private state: WorkerState = 'STOPPED';
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 60000; // Default 1 minute
  private isPolling: boolean = false;

  private store: INewsStore;
  private pipeline: IngestionPipeline;
  private sources: Map<string, { config: LiveSourceFeedConfig; provider: ICollectorSource; health: SourceHealthRecord }> = new Map();

  // Telemetry metrics
  private lifetimePolls: number = 0;
  private lifetimeFetched: number = 0;
  private lifetimeSaved: number = 0;
  private lifetimeDuplicates: number = 0;
  private lifetimeErrors: number = 0;
  private lastPollStartedAt: string | null = null;
  private lastPollCompletedAt: string | null = null;
  private lastPollDurationMs: number = 0;

  private constructor(store?: INewsStore) {
    this.store = store || new JsonNewsStore();
    this.pipeline = new IngestionPipeline(this.store);
    this.initializeDefaultSources();
  }

  public static getInstance(store?: INewsStore): LiveIngestionWorker {
    if (!LiveIngestionWorker.instance) {
      LiveIngestionWorker.instance = new LiveIngestionWorker(store);
    } else if (store && LiveIngestionWorker.instance.store !== store) {
      LiveIngestionWorker.instance.setStore(store);
    }
    return LiveIngestionWorker.instance;
  }

  public static resetInstance(store?: INewsStore): LiveIngestionWorker {
    if (LiveIngestionWorker.instance) {
      LiveIngestionWorker.instance.stop();
    }
    LiveIngestionWorker.instance = new LiveIngestionWorker(store);
    return LiveIngestionWorker.instance;
  }

  public setStore(store: INewsStore): void {
    this.store = store;
    this.pipeline = new IngestionPipeline(this.store);
  }

  private initializeDefaultSources(): void {
    // 1. Authoritative Live RSS Feeds
    for (const feedCfg of AUTHORITATIVE_LIVE_FEEDS) {
      const provider = new LiveRssSourceProvider(feedCfg);
      this.sources.set(feedCfg.id, {
        config: feedCfg,
        provider,
        health: {
          sourceId: feedCfg.id,
          sourceName: feedCfg.name,
          publisher: feedCfg.publisher,
          tier: feedCfg.tier,
          enabled: feedCfg.enabled,
          consecutiveFailures: 0,
          totalFetched: 0,
          totalSaved: 0
        }
      });
    }

    // 2. Official Regulatory / Exchange Provider
    const officialProvider = new OfficialFeedsSourceProvider();
    this.sources.set('official-regulatory', {
      config: {
        id: 'official-regulatory',
        name: officialProvider.name,
        publisher: 'SEBI/RBI/PIB',
        category: 'REGULATORY',
        url: 'https://sebi.gov.in',
        tier: 1,
        enabled: true
      },
      provider: officialProvider,
      health: {
        sourceId: 'official-regulatory',
        sourceName: officialProvider.name,
        publisher: 'SEBI/RBI/PIB',
        tier: 1,
        enabled: true,
        consecutiveFailures: 0,
        totalFetched: 0,
        totalSaved: 0
      }
    });
  }

  /**
   * Starts periodic polling in the background.
   */
  public start(intervalMs: number = this.intervalMs): void {
    if (this.state === 'RUNNING' && this.timer) {
      return;
    }

    this.intervalMs = intervalMs;
    this.state = 'RUNNING';

    // Start recurring timer
    this.timer = setInterval(async () => {
      await this.pollOnce();
    }, this.intervalMs);

    console.log(`[LiveIngestionWorker] Started live ingestion worker (Interval: ${this.intervalMs}ms)`);
  }

  /**
   * Stops periodic background polling.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = 'STOPPED';
    console.log('[LiveIngestionWorker] Stopped live ingestion worker');
  }

  /**
   * Executes a single isolated ingestion cycle across all active sources.
   */
  public async pollOnce(): Promise<{
    durationMs: number;
    fetched: number;
    saved: number;
    duplicates: number;
    errors: number;
    sourceResults: Record<string, IngestionResult & { rawCount: number; error?: string }>;
  }> {
    if (this.isPolling) {
      console.warn('[LiveIngestionWorker] Polling cycle already in progress, skipping concurrent run');
      return {
        durationMs: 0,
        fetched: 0,
        saved: 0,
        duplicates: 0,
        errors: 0,
        sourceResults: {}
      };
    }

    this.isPolling = true;
    const startTime = Date.now();
    this.lastPollStartedAt = new Date().toISOString();
    this.lifetimePolls++;

    let cycleFetched = 0;
    let cycleSaved = 0;
    let cycleDuplicates = 0;
    let cycleErrors = 0;
    const sourceResults: Record<string, IngestionResult & { rawCount: number; error?: string }> = {};

    try {
      const activeEntries = Array.from(this.sources.entries()).filter(([_, entry]) => entry.config.enabled);

      // Concurrently collect from all sources with individual timeout & error boundaries
      const batchPromises = activeEntries.map(async ([sourceId, entry]) => {
        const sourceStartTime = new Date().toISOString();
        const health = entry.health;
        health.lastPollAt = sourceStartTime;

        try {
          // Collect payloads safely
          const batch = await CollectorAdapter.collectFrom(entry.provider, 15000);
          health.totalFetched += batch.rawCount;
          cycleFetched += batch.rawCount;

          if (batch.error) {
            health.consecutiveFailures++;
            health.lastError = batch.error;
            sourceResults[sourceId] = {
              processed: 0,
              saved: 0,
              duplicates: 0,
              errors: 1,
              malformed: 0,
              rawCount: batch.rawCount,
              error: batch.error
            };
            cycleErrors++;
            return;
          }

          // Ingest into pipeline
          const ingestionRes = await this.pipeline.ingest(batch.payloads, entry.config.publisher);
          health.totalSaved += ingestionRes.saved;
          health.lastSuccessAt = new Date().toISOString();
          health.consecutiveFailures = 0;
          health.lastError = undefined;

          cycleSaved += ingestionRes.saved;
          cycleDuplicates += ingestionRes.duplicates;
          cycleErrors += ingestionRes.errors;

          sourceResults[sourceId] = {
            ...ingestionRes,
            rawCount: batch.rawCount
          };
        } catch (err: any) {
          health.consecutiveFailures++;
          health.lastError = err.message || 'Unknown ingestion failure';
          cycleErrors++;
          sourceResults[sourceId] = {
            processed: 0,
            saved: 0,
            duplicates: 0,
            errors: 1,
            malformed: 0,
            rawCount: 0,
            error: err.message
          };
        }
      });

      await Promise.allSettled(batchPromises);
    } catch (workerErr: any) {
      console.error('[LiveIngestionWorker] Critical error during polling cycle:', workerErr);
    } finally {
      const endTime = Date.now();
      this.lastPollDurationMs = endTime - startTime;
      this.lastPollCompletedAt = new Date().toISOString();
      this.isPolling = false;

      this.lifetimeFetched += cycleFetched;
      this.lifetimeSaved += cycleSaved;
      this.lifetimeDuplicates += cycleDuplicates;
      this.lifetimeErrors += cycleErrors;
    }

    return {
      durationMs: this.lastPollDurationMs,
      fetched: cycleFetched,
      saved: cycleSaved,
      duplicates: cycleDuplicates,
      errors: cycleErrors,
      sourceResults
    };
  }

  /**
   * Registers or updates a custom collector source.
   */
  public registerSource(config: LiveSourceFeedConfig, provider?: ICollectorSource): void {
    const prov = provider || new LiveRssSourceProvider(config);
    this.sources.set(config.id, {
      config,
      provider: prov,
      health: {
        sourceId: config.id,
        sourceName: config.name,
        publisher: config.publisher,
        tier: config.tier,
        enabled: config.enabled,
        consecutiveFailures: 0,
        totalFetched: 0,
        totalSaved: 0
      }
    });
  }

  /**
   * Enables or disables a specific source.
   */
  public toggleSource(sourceId: string, enabled: boolean): boolean {
    const entry = this.sources.get(sourceId);
    if (!entry) return false;
    entry.config.enabled = enabled;
    entry.health.enabled = enabled;
    return true;
  }

  /**
   * Returns authoritative status & telemetry.
   */
  public getTelemetry(): WorkerTelemetry {
    return {
      state: this.state,
      intervalMs: this.intervalMs,
      isPolling: this.isPolling,
      lastPollStartedAt: this.lastPollStartedAt,
      lastPollCompletedAt: this.lastPollCompletedAt,
      lastPollDurationMs: this.lastPollDurationMs,
      lifetimePolls: this.lifetimePolls,
      lifetimeFetched: this.lifetimeFetched,
      lifetimeSaved: this.lifetimeSaved,
      lifetimeDuplicates: this.lifetimeDuplicates,
      lifetimeErrors: this.lifetimeErrors,
      activeSourceCount: Array.from(this.sources.values()).filter(s => s.config.enabled).length,
      sources: Array.from(this.sources.values()).map(s => ({ ...s.health })),
      telegramPipeline: TelegramNotificationPipeline.getInstance().getTelemetry()
    };
  }
}
