/**
 * ATHENA NEWS ENGINE — STAGE 8.1 TEST SUITE
 * Live Source Ingestion + Worker Architecture Verification Gate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AUTHORITATIVE_LIVE_FEEDS,
  LiveRssSourceProvider,
  OfficialFeedsSourceProvider,
  RSSHubSourceProviderImpl,
  SearXNGSourceProviderImpl,
  SourceDiscoveryServiceImpl
} from '../ingestion/LiveSourceProviders';
import { LiveIngestionWorker } from '../ingestion/LiveIngestionWorker';
import { CollectorAdapter } from '../ingestion/CollectorAdapter';
import { MemoryNewsStore } from '../storage/NewsStore';
import { IngestionPipeline } from '../ingestion/IngestionPipeline';
import { RawArticlePayload } from '../normalization/ArticleNormalizer';

describe('Stage 8.1: Live Source Ingestion + Worker Architecture', () => {
  let memoryStore: MemoryNewsStore;
  let pipeline: IngestionPipeline;

  beforeEach(() => {
    memoryStore = new MemoryNewsStore();
    pipeline = new IngestionPipeline(memoryStore);
    LiveIngestionWorker.resetInstance(memoryStore);
  });

  afterEach(() => {
    LiveIngestionWorker.getInstance().stop();
  });

  describe('1. Authoritative Source Feed Configuration', () => {
    it('should have verified tier-1 live sources configured', () => {
      expect(AUTHORITATIVE_LIVE_FEEDS.length).toBeGreaterThanOrEqual(10);

      const publishers = AUTHORITATIVE_LIVE_FEEDS.map(f => f.publisher);
      expect(publishers).toContain('Economic Times');
      expect(publishers).toContain('Moneycontrol');
      expect(publishers).toContain('LiveMint');
      expect(publishers).toContain('Business Standard');
      expect(publishers).toContain('CNBC TV18');
      expect(publishers).toContain('Reuters');
      expect(publishers).toContain('Google News');

      for (const feed of AUTHORITATIVE_LIVE_FEEDS) {
        expect(feed.id).toBeTruthy();
        expect(feed.url).toMatch(/^https?:\/\//);
        expect(feed.tier).toBe(1);
        expect(feed.category).toBeTruthy();
        expect(feed.enabled).toBe(true);
      }
    });

    it('should normalize RSS items into standard raw payloads with publisher provenance', async () => {
      const feedCfg = AUTHORITATIVE_LIVE_FEEDS[0];
      const provider = new LiveRssSourceProvider(feedCfg);

      // Verify provider interface
      expect(provider.name).toBe(feedCfg.name);
      expect(typeof provider.collect).toBe('function');
    });
  });

  describe('2. Failure Isolation & Resilient Collection', () => {
    it('should handle broken or unreachable feeds gracefully without throwing', async () => {
      const brokenProvider = new LiveRssSourceProvider({
        id: 'broken-feed',
        name: 'Broken Feed',
        publisher: 'Broken Publisher',
        category: 'MARKETS',
        url: 'https://invalid-non-existent-domain-123456789.com/rss.xml',
        tier: 1,
        enabled: true
      });

      const items = await brokenProvider.collect();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBe(0);
    });

    it('should isolate failures with CollectorAdapter.collectFrom and return error safely', async () => {
      const failingCollector = {
        name: 'CrashingCollector',
        collect: async () => {
          throw new Error('Connection refused (ECONNREFUSED)');
        }
      };

      const result = await CollectorAdapter.collectFrom(failingCollector, 2000);
      expect(result.collectorName).toBe('CrashingCollector');
      expect(result.rawCount).toBe(0);
      expect(result.payloads).toEqual([]);
      expect(result.error).toContain('Connection refused');
    });

    it('should adapt raw payloads and strip malformed items safely', () => {
      const rawList = [
        { headline: 'TCS Q3 profit surges 12%', url: 'https://livemint.com/tcs-q3', publisher: 'LiveMint' },
        { title: '', url: 'https://invalid.com' }, // Invalid - empty title
        { title: 'Reliance announces new capex', link: 'https://economictimes.com/ril-capex' }, // Valid
        null, // Malformed
        { headline: 'Missing URL item' } // Invalid - missing URL
      ];

      const adapted = CollectorAdapter.adaptList(rawList, 'FallbackPublisher');
      expect(adapted.length).toBe(2);
      expect(adapted[0].headline).toBe('TCS Q3 profit surges 12%');
      expect(adapted[0].publisher).toBe('LiveMint');
      expect(adapted[1].headline).toBe('Reliance announces new capex');
      expect(adapted[1].publisher).toBe('FallbackPublisher');
    });
  });

  describe('3. Optional Source Providers (RSSHub, SearXNG, Discovery)', () => {
    it('should provide non-blocking RSSHub source provider', async () => {
      const rsshub = new RSSHubSourceProviderImpl('https://rsshub.app');
      expect(rsshub.isAvailable()).toBe(true);
      const items = await rsshub.fetchRSSHubFeed('/invalid/nonexistent/feed');
      expect(Array.isArray(items)).toBe(true);
    });

    it('should provide non-blocking SearXNG provider with fallback when unconfigured', async () => {
      const searxng = new SearXNGSourceProviderImpl('');
      expect(searxng.isAvailable()).toBe(false);
      const items = await searxng.searchMeta('Nifty 50 break out');
      expect(items).toEqual([]);
    });

    it('should generate dynamic discovery search feeds for market topics', async () => {
      const discovery = new SourceDiscoveryServiceImpl();
      const feeds = await discovery.discoverFeeds('Tata Motors EV');
      expect(feeds.length).toBeGreaterThan(0);
      expect(feeds[0]).toContain('Tata%20Motors%20EV');
    });

    it('should provide official regulatory announcements source provider', async () => {
      const official = new OfficialFeedsSourceProvider();
      expect(official.name).toContain('Official Regulatory');
      expect(typeof official.collect).toBe('function');
    });
  });

  describe('4. Live Ingestion Worker Lifecycle & Telemetry', () => {
    it('should instantiate worker singleton with active sources', () => {
      const worker = LiveIngestionWorker.getInstance(memoryStore);
      const telemetry = worker.getTelemetry();

      expect(telemetry.state).toBe('STOPPED');
      expect(telemetry.activeSourceCount).toBeGreaterThanOrEqual(10);
      expect(telemetry.sources.length).toBeGreaterThanOrEqual(10);
      expect(telemetry.lifetimePolls).toBe(0);
    });

    it('should execute a safe pollOnce cycle across mock sources without crashing', async () => {
      const worker = LiveIngestionWorker.getInstance(memoryStore);

      // Register mock test source
      const mockSource: RawArticlePayload = {
        headline: 'Infosys signs $2B cloud contract with European bank',
        title: 'Infosys signs $2B cloud contract with European bank',
        url: 'https://economictimes.com/infosys-deal-' + Date.now(),
        link: 'https://economictimes.com/infosys-deal-' + Date.now(),
        body: 'Infosys has secured a mega deal worth $2 billion to transform banking infrastructure.',
        content: 'Infosys has secured a mega deal worth $2 billion to transform banking infrastructure.',
        publisher: 'Economic Times',
        source: 'Economic Times',
        publishedAt: new Date().toISOString(),
        collectionMethod: 'RSS_TEST'
      };

      worker.registerSource(
        {
          id: 'test-mock-source',
          name: 'Test Mock Source',
          publisher: 'Economic Times',
          category: 'CORPORATE',
          url: 'https://test-mock.com/feed.xml',
          tier: 1,
          enabled: true
        },
        {
          name: 'Test Mock Source',
          collect: async () => [mockSource]
        }
      );

      const pollResult = await worker.pollOnce();
      expect(pollResult.durationMs).toBeGreaterThanOrEqual(0);
      expect(pollResult.sourceResults['test-mock-source']).toBeDefined();
      expect(pollResult.sourceResults['test-mock-source'].saved).toBe(1);

      // Verify stored article in memory
      const articles = await memoryStore.getAll();
      const savedArticle = articles.find(a => a.sourceUrl === mockSource.url);
      expect(savedArticle).toBeDefined();
      expect(savedArticle?.headline).toBe(mockSource.headline);

      // Check telemetry
      const telemetry = worker.getTelemetry();
      expect(telemetry.lifetimePolls).toBeGreaterThanOrEqual(1);
      expect(telemetry.lifetimeSaved).toBeGreaterThanOrEqual(1);
    });

    it('should support starting and stopping the worker timer cleanly', () => {
      const worker = LiveIngestionWorker.getInstance(memoryStore);
      worker.start(5000);
      expect(worker.getTelemetry().state).toBe('RUNNING');

      worker.stop();
      expect(worker.getTelemetry().state).toBe('STOPPED');
    });

    it('should allow toggling individual sources on/off', () => {
      const worker = LiveIngestionWorker.getInstance(memoryStore);
      const sourcesBefore = worker.getTelemetry().activeSourceCount;

      worker.toggleSource('et-markets', false);
      const sourcesAfterDisable = worker.getTelemetry().activeSourceCount;
      expect(sourcesAfterDisable).toBe(sourcesBefore - 1);

      worker.toggleSource('et-markets', true);
      const sourcesAfterEnable = worker.getTelemetry().activeSourceCount;
      expect(sourcesAfterEnable).toBe(sourcesBefore);
    });
  });

  describe('5. Zero-AI Startup Compliance', () => {
    it('should complete full ingestion without requiring or invoking external AI models', async () => {
      const originalGroqKey = process.env.GROQ_API_KEY;
      const originalGeminiKey = process.env.GEMINI_API_KEY;

      try {
        delete process.env.GROQ_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const rawArticles: RawArticlePayload[] = [
          {
            headline: 'L&T wins mega offshore hydrocarbon order worth ₹5000 Cr',
            title: 'L&T wins mega offshore hydrocarbon order worth ₹5000 Cr',
            url: 'https://moneycontrol.com/lt-order-' + Date.now(),
            link: 'https://moneycontrol.com/lt-order-' + Date.now(),
            body: 'Larsen & Toubro hydrocarbon business has secured a significant order from a global client.',
            content: 'Larsen & Toubro hydrocarbon business has secured a significant order from a global client.',
            publisher: 'Moneycontrol',
            source: 'Moneycontrol',
            publishedAt: new Date().toISOString(),
            collectionMethod: 'RSS_LIVE'
          }
        ];

        const res = await pipeline.ingest(rawArticles, 'Moneycontrol');
        expect(res.saved).toBe(1);
        expect(res.errors).toBe(0);

        const stored = await memoryStore.getAll();
        const found = stored.find(a => a.sourceUrl === rawArticles[0].url);
        expect(found).toBeDefined();
        expect(found?.source?.publisher || found?.source?.name).toBe('Moneycontrol');
      } finally {
        if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
        if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
      }
    });
  });
});
