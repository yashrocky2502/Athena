import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CollectorRegistry } from '../collectorRegistry/CollectorRegistry';
import { EconomicTimesCollector } from '../collectors/EconomicTimesCollector';
import { ReutersCollector } from '../collectors/ReutersCollector';
import { MoneycontrolCollector } from '../collectors/MoneycontrolCollector';
import { LiveMintCollector } from '../collectors/LiveMintCollector';
import { BaseCollectorV3 } from '../collectors/BaseCollectorV3';
import { ArticleQueue } from '../queue/ArticleQueue';
import { CollectorHealthMonitor } from '../collectorHealth/CollectorHealthMonitor';
import { TelegramObserver } from '../distribution/telegram/TelegramObserver';
import { TelegramCommandHandler } from '../distribution/telegram/TelegramCommandHandler';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';

// Mock failing collector for circuit breaker test
class MockFailingCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'REUTERS';
  public readonly name = 'Mock Failing Reuters';

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    throw new Error('Simulated Feed Outage');
  }
}

describe('NewsEngineV3 Phase 2 — Collector & Telegram Observability Suite', () => {
  beforeEach(() => {
    CollectorRegistry.getInstance().clear();
    ArticleQueue.getInstance().clear();
    TelegramObserver.getInstance().resetStats();
  });

  afterEach(() => {
    CollectorRegistry.getInstance().clear();
    ArticleQueue.getInstance().clear();
  });

  describe('1. Collector Registry & Implementation', () => {
    it('registers and initializes the 4 core production collectors', async () => {
      const registry = CollectorRegistry.getInstance();

      const et = new EconomicTimesCollector();
      const reuters = new ReutersCollector();
      const mc = new MoneycontrolCollector();
      const mint = new LiveMintCollector();

      registry.register(et);
      registry.register(reuters);
      registry.register(mc);
      registry.register(mint);

      expect(registry.getAll().length).toBe(4);

      await registry.initializeAll();

      expect(et.getState()).toBe('RUNNING');
      expect(reuters.getState()).toBe('RUNNING');
      expect(mc.getState()).toBe('RUNNING');
      expect(mint.getState()).toBe('RUNNING');
    });

    it('fetches raw articles and prevents duplicates', async () => {
      const registry = CollectorRegistry.getInstance();
      const et = new EconomicTimesCollector();
      registry.register(et);
      await et.initialize();

      const fetched1 = await registry.pollSingle('ECONOMIC_TIMES');
      expect(fetched1.length).toBeGreaterThan(0);

      // Immediate second fetch should be deduplicated
      const fetched2 = await registry.pollSingle('ECONOMIC_TIMES');
      expect(fetched2.length).toBe(0);
    });

    it('pauses and resumes a collector via registry', async () => {
      const registry = CollectorRegistry.getInstance();
      const reuters = new ReutersCollector();
      registry.register(reuters);
      await reuters.initialize();

      registry.disable('REUTERS');
      expect(reuters.getState()).toBe('PAUSED');

      const fetchedWhilePaused = await reuters.fetch();
      expect(fetchedWhilePaused.length).toBe(0);

      registry.enable('REUTERS');
      expect(reuters.getState()).toBe('RUNNING');
    });
  });

  describe('2. Circuit Breaker & Health Tracking', () => {
    it('trips circuit breaker after consecutive failures', async () => {
      const failingCol = new MockFailingCollector();
      await failingCol.initialize();

      // Trigger repeated failures
      for (let i = 0; i < 5; i++) {
        await failingCol.fetch();
      }

      expect(failingCol.getState()).toBe('FAILED');
      expect(failingCol.getHealth().circuitBreakerOpen).toBe(true);
      expect(failingCol.getHealth().healthPercentage).toBe(0);
    });

    it('computes aggregate health report correctly', async () => {
      const registry = CollectorRegistry.getInstance();
      const et = new EconomicTimesCollector();
      const reuters = new ReutersCollector();

      registry.register(et);
      registry.register(reuters);

      await registry.initializeAll();

      const report = CollectorHealthMonitor.getInstance().getAggregateReport();
      expect(report.totalCollectors).toBe(2);
      expect(report.runningCount).toBe(2);
      expect(report.overallHealthPct).toBe(100);
    });
  });

  describe('3. Article Processing Queue', () => {
    it('enqueues, prioritizes, and dequeues articles', () => {
      const queue = ArticleQueue.getInstance();

      const lowArt: V3RawArticle = {
        id: 'ART_LOW',
        publisherId: 'LIVEMINT',
        sourceUrl: 'https://mint.com/1',
        title: 'Low Priority Article Title',
        rawBody: 'Body',
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString()
      };

      const highArt: V3RawArticle = {
        id: 'ART_HIGH',
        publisherId: 'REUTERS',
        sourceUrl: 'https://reuters.com/1',
        title: 'High Priority Breaking News',
        rawBody: 'Body',
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString()
      };

      queue.enqueue(lowArt, 'LOW');
      queue.enqueue(highArt, 'HIGH');

      expect(queue.getPendingCount()).toBe(2);

      // High priority item should be dequeued first
      const firstDequeued = queue.dequeue();
      expect(firstDequeued?.article.id).toBe('ART_HIGH');
      expect(firstDequeued?.status).toBe('PROCESSING');

      queue.markCompleted(firstDequeued!.queueId);
      expect(queue.getCompletedCount()).toBe(1);
    });
  });

  describe('4. Telegram Subsystem & Commands', () => {
    it('handles all administrative Telegram commands safely', async () => {
      const registry = CollectorRegistry.getInstance();
      const et = new EconomicTimesCollector();
      registry.register(et);
      await et.initialize();

      const statusResp = await TelegramCommandHandler.processCommand('/status');
      expect(statusResp).toContain('ATHENA NEWS ENGINE V3 STARTED');

      const collectorsResp = await TelegramCommandHandler.processCommand('/collectors');
      expect(collectorsResp).toContain('Economic Times');

      const queueResp = await TelegramCommandHandler.processCommand('/queue');
      expect(queueResp).toContain('ARTICLE PROCESSING QUEUE');

      const pauseResp = await TelegramCommandHandler.processCommand('/pause ECONOMIC_TIMES');
      expect(pauseResp).toContain('PAUSED');
      expect(et.getState()).toBe('PAUSED');

      const resumeResp = await TelegramCommandHandler.processCommand('/resume ECONOMIC_TIMES');
      expect(resumeResp).toContain('RESUMED');
      expect(et.getState()).toBe('RUNNING');

      const logsResp = await TelegramCommandHandler.processCommand('/logs');
      expect(logsResp).toContain('RECENT SYSTEM LOGS');

      const healthResp = await TelegramCommandHandler.processCommand('/health');
      expect(healthResp).toContain('SYSTEM HEALTH DIAGNOSTIC');
    });

    it('safely sends notifications via Telegram Observer in fallback mode without crashing', async () => {
      const observer = TelegramObserver.getInstance();
      observer.initialize();

      const result = await observer.safeSend('Test Event Notification');
      expect(result).toBe(true);
      expect(observer.getStats().sentCount).toBe(1);
    });
  });
});
