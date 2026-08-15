/**
 * ATHENA NEWS ENGINE V3 — BASE COLLECTOR ABSTRACT CLASS
 * 
 * Provides robust infrastructure for all news collectors:
 * - State management (STARTING, RUNNING, RETRYING, PAUSED, FAILED, OFFLINE)
 * - Circuit breaker & recovery logic
 * - Deduplication cache per collector
 * - Timeout handling
 * - Exponential backoff retries
 * - Health telemetry tracking
 */

import { ICollector, V3CollectorState, V3CollectorHealthMetrics } from './ICollector';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3ConfigManager } from '../config/V3Config';
import { V3Logger } from '../logging/V3Logger';
import { V3EventBus } from '../events/V3EventBus';
import { V3Telemetry } from '../telemetry/V3Telemetry';
import { V3Utils } from '../utils/V3Utils';

export abstract class BaseCollectorV3 implements ICollector {
  public abstract readonly id: V3PublisherId;
  public abstract readonly name: string;

  protected state: V3CollectorState = 'OFFLINE';
  protected consecutiveFailures = 0;
  protected totalArticlesFetched = 0;
  protected totalFetchAttempts = 0;
  protected circuitBreakerOpen = false;
  protected lastBreakerTripMs = 0;
  protected breakerCooldownMs = 30000; // 30 seconds cooldown
  protected maxConsecutiveFailures = 5;

  protected lastFetchAt?: string;
  protected lastError?: string;
  protected latenciesMs: number[] = [];
  
  protected seenSourceUrls: Set<string> = new Set();
  protected maxSeenUrls = 5000;

  protected isInitialized = false;

  public getState(): V3CollectorState {
    return this.state;
  }

  public getHealth(): V3CollectorHealthMetrics {
    const total = this.totalFetchAttempts || 1;
    const successCount = total - this.consecutiveFailures;
    const healthPct = Math.max(0, Math.min(100, Math.round((successCount / total) * 100)));

    const avgLatency = this.latenciesMs.length > 0
      ? Math.round(this.latenciesMs.reduce((a, b) => a + b, 0) / this.latenciesMs.length)
      : 0;

    return {
      collectorId: this.id,
      name: this.name,
      state: this.state,
      lastFetchAt: this.lastFetchAt,
      totalArticlesFetched: this.totalArticlesFetched,
      totalFetchAttempts: this.totalFetchAttempts,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      avgLatencyMs: avgLatency,
      healthPercentage: this.circuitBreakerOpen ? 0 : healthPct,
      lastError: this.lastError
    };
  }

  public async initialize(): Promise<void> {
    this.state = 'STARTING';
    V3Logger.getInstance().info('Collector', `Initializing collector: ${this.name}`, { id: this.id });
    try {
      await this.onInitialize();
      this.isInitialized = true;
      this.state = 'RUNNING';
      V3Logger.getInstance().info('Collector', `Collector ${this.name} started successfully`, { id: this.id });
    } catch (err) {
      this.state = 'FAILED';
      this.lastError = err instanceof Error ? err.message : String(err);
      V3Logger.getInstance().error('Collector', `Collector ${this.name} initialization failed`, err, { id: this.id });
      throw err;
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract executeRawFetch(): Promise<V3RawArticle[]>;

  public async fetch(): Promise<V3RawArticle[]> {
    if (this.state === 'PAUSED') {
      V3Logger.getInstance().debug('Collector', `Collector ${this.name} is paused. Skipping fetch.`);
      return [];
    }

    if (this.state === 'OFFLINE' || !this.isInitialized) {
      V3Logger.getInstance().warn('Collector', `Collector ${this.name} is offline or uninitialized. Skipping fetch.`);
      return [];
    }

    // Check circuit breaker cooldown
    if (this.circuitBreakerOpen) {
      const now = Date.now();
      if (now - this.lastBreakerTripMs > this.breakerCooldownMs) {
        // Cooldown period elapsed, attempt half-open recovery
        V3Logger.getInstance().info('Collector', `Circuit breaker half-open reset for ${this.name}. Retrying fetch.`);
        this.circuitBreakerOpen = false;
        this.state = 'RETRYING';
      } else {
        V3Logger.getInstance().warn('Collector', `Circuit breaker OPEN for ${this.name}. Fetch blocked.`);
        return [];
      }
    }

    const config = V3ConfigManager.getInstance().getCollectorConfig(this.id) || {
      timeoutMs: 8000,
      maxRetries: 3
    };

    this.totalFetchAttempts++;
    const startTime = Date.now();
    let attempt = 0;
    let fetchedArticles: V3RawArticle[] = [];

    while (attempt <= config.maxRetries) {
      attempt++;
      try {
        if (attempt > 1) {
          this.state = 'RETRYING';
          V3Logger.getInstance().warn('Collector', `Retrying fetch for ${this.name} (attempt ${attempt}/${config.maxRetries + 1})`);
        }

        // Timeout wrapper
        const fetchPromise = this.executeRawFetch();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Collector fetch timeout after ${config.timeoutMs}ms`)), config.timeoutMs);
        });

        const rawArticles = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Filter, validate, and deduplicate
        const validNewArticles: V3RawArticle[] = [];
        for (const art of rawArticles) {
          if (this.validate(art) && !this.seenSourceUrls.has(art.sourceUrl)) {
            this.seenSourceUrls.add(art.sourceUrl);
            validNewArticles.push(art);
          }
        }

        // Limit memory size of seen URLs
        if (this.seenSourceUrls.size > this.maxSeenUrls) {
          const arr = Array.from(this.seenSourceUrls);
          this.seenSourceUrls = new Set(arr.slice(-3000));
        }

        fetchedArticles = validNewArticles;
        const latency = Date.now() - startTime;
        this.recordLatency(latency);

        // Success state update
        const wasRecovering = this.consecutiveFailures > 0;
        this.consecutiveFailures = 0;
        this.totalArticlesFetched += fetchedArticles.length;
        this.state = 'RUNNING';
        this.lastFetchAt = new Date().toISOString();

        if (wasRecovering) {
          V3Logger.getInstance().info('Collector', `Collector ${this.name} recovered successfully from previous errors.`);
          await V3EventBus.getInstance().publish({
            eventId: V3Utils.generateId('EVT'),
            type: 'SYSTEM_HEALTH_CHECK',
            priority: 'NORMAL',
            timestamp: new Date().toISOString(),
            correlationId: V3Utils.generateId('RECOVER'),
            payload: { message: `Collector ${this.name} Recovered`, collectorId: this.id }
          });
        }

        // Update global telemetry
        this.updateTelemetry();

        return fetchedArticles;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.lastError = errorMsg;

        if (attempt <= config.maxRetries) {
          const backoff = V3Utils.calculateExponentialBackoff(attempt);
          await new Promise(res => setTimeout(res, backoff));
        } else {
          // All retries exhausted
          this.consecutiveFailures++;
          V3Logger.getInstance().error('Collector', `Collector ${this.name} fetch failed after ${config.maxRetries + 1} attempts`, err);

          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.circuitBreakerOpen = true;
            this.lastBreakerTripMs = Date.now();
            this.state = 'FAILED';
            V3Logger.getInstance().error('Collector', `Circuit breaker TRIPPED for ${this.name}. Pausing fetches for ${this.breakerCooldownMs / 1000}s`);

            await V3EventBus.getInstance().publish({
              eventId: V3Utils.generateId('EVT'),
              type: 'COLLECTOR_FAILED',
              priority: 'HIGH',
              timestamp: new Date().toISOString(),
              correlationId: V3Utils.generateId('CB_TRIP'),
              payload: { collectorId: this.id, collectorName: this.name, error: errorMsg, consecutiveFailures: this.consecutiveFailures }
            });
          } else {
            this.state = 'RETRYING';
          }

          this.updateTelemetry();
          return [];
        }
      }
    }

    return [];
  }

  public validate(article: V3RawArticle): boolean {
    if (!article || !article.title || !article.sourceUrl || !article.id) {
      return false;
    }
    // Minimal content check
    if (article.title.trim().length < 5) {
      return false;
    }
    return true;
  }

  public pause(): void {
    this.state = 'PAUSED';
    V3Logger.getInstance().info('Collector', `Collector ${this.name} PAUSED`);
    this.updateTelemetry();
  }

  public resume(): void {
    this.state = 'RUNNING';
    this.circuitBreakerOpen = false;
    this.consecutiveFailures = 0;
    V3Logger.getInstance().info('Collector', `Collector ${this.name} RESUMED`);
    this.updateTelemetry();
  }

  public async restart(): Promise<void> {
    V3Logger.getInstance().info('Collector', `Restarting collector ${this.name}...`);
    await this.shutdown();
    await this.initialize();
  }

  public async shutdown(): Promise<void> {
    this.state = 'OFFLINE';
    this.isInitialized = false;
    V3Logger.getInstance().info('Collector', `Collector ${this.name} shut down.`);
    this.updateTelemetry();
  }

  protected updateTelemetry(): void {
    const h = this.getHealth();
    V3Telemetry.getInstance().updateCollectorStatus({
      collectorId: h.collectorId,
      isHealthy: h.state === 'RUNNING',
      lastPollAt: h.lastFetchAt,
      totalArticlesCollected: h.totalArticlesFetched,
      consecutiveFailures: h.consecutiveFailures,
      lastError: h.lastError,
      avgLatencyMs: h.avgLatencyMs,
      healthPercentage: h.healthPercentage,
      circuitBreakerOpen: h.circuitBreakerOpen
    });
  }

  private recordLatency(latencyMs: number): void {
    this.latenciesMs.push(latencyMs);
    if (this.latenciesMs.length > 50) {
      this.latenciesMs.shift();
    }
  }
}
