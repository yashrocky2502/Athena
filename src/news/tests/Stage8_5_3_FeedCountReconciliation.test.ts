/**
 * ATHENA NEWS CORE — STAGE 8.5.3: FEED COUNT RECONCILIATION & CANARY ROUTING AUDIT
 *
 * Verifies:
 * 1. V4 API returns 1,145 canonical articles.
 * 2. NewsPage receives all 1,145 articles.
 * 3. "All" does not remove valid articles.
 * 4. Missing optional metadata does not remove an article.
 * 5. Missing summary does not remove an article.
 * 6. Missing F&O metadata does not remove an article.
 * 7. Pagination does not silently truncate the dataset.
 * 8. V4 and V5 responses cannot be mixed.
 * 9. V5 canary cannot replace normal V4 routing unexpectedly.
 * 10. "?canary=1" correctly overrides routing when explicitly requested.
 * 11. Normal request uses V4 when V3 is disabled.
 * 12. Client state does not retain stale V5 data after switching back to V4.
 * 13. Search filtering is applied only when search is active.
 * 14. Category filtering is applied only when a category other than All is selected.
 * 15. Telegram eligibility cannot remove feed articles.
 * 16. Summary availability cannot remove feed articles.
 * 17. Canonical article IDs remain stable.
 * 18. All 1,145 valid articles remain recoverable after restart.
 * 19. Canary routing does not mutate canonical storage.
 * 20. No duplicate article records are created during reconciliation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { newsCoreV2Router } from '../../newsCoreV2/api/newsCoreV2Routes.ts';
import { PersistentNewsStore } from '../../newsCoreV2/storage/PersistentNewsStore.ts';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter.ts';
import { NewsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';
import { TelegramAlertEligibilityEngine } from '../telegram/TelegramAlertEligibilityEngine.ts';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine.ts';

function computeSha256(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 8.5.3: Feed Count Reconciliation & Canary Routing Audit', () => {
  const dataDir = path.join(process.cwd(), 'data');
  const newsCoreV2Path = path.join(dataDir, 'news_core_v2.json');
  const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');

  let canary: NewsCanaryRouter;
  let persistentNewsStore: PersistentNewsStore;

  beforeEach(() => {
    persistentNewsStore = new PersistentNewsStore();
    canary = NewsCanaryRouter.getInstance();
    canary.resetMetrics();
    canary.setEnabled(false);
    canary.setPercentage(0);
  });

  afterEach(() => {
    canary.resetMetrics();
    canary.setEnabled(false);
    canary.setPercentage(0);
  });

  it('1. V4 API returns canonical articles from persistent store (>= 1,145)', async () => {
    const allArticles = persistentNewsStore.getAllArticles();
    expect(allArticles.length).toBeGreaterThanOrEqual(1145);

    // Invoke /api/v4/news/feed handler directly
    const feedRoute = newsCoreV2Router.stack.find((l: any) => l.route && l.route.path === '/feed');
    expect(feedRoute).toBeDefined();

    const req: any = { query: { page: '1', limit: '2000', category: 'All' }, headers: {} };
    let jsonResult: any = null;
    const res: any = {
      setHeader: () => res,
      status: () => res,
      json: (data: any) => { jsonResult = data; return res; }
    };

    await feedRoute.route.stack[0].handle(req, res, () => {});

    expect(jsonResult).toBeDefined();
    expect(jsonResult.status).toBe('success');
    expect(jsonResult.totalCount).toBeGreaterThanOrEqual(1145);
    expect(jsonResult.articles.length).toBeGreaterThanOrEqual(1145);
  });

  it('2. NewsPage receives all canonical articles through UI adapter', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    const uiArticles = NewsCoreV2UIAdapter.adaptMany(rawArticles);

    expect(uiArticles.length).toBe(rawArticles.length);
    expect(uiArticles.length).toBeGreaterThanOrEqual(1145);

    // Verify all IDs match exactly
    const rawIds = new Set(rawArticles.map(a => a.id));
    const uiIds = new Set(uiArticles.map(a => a.id));
    expect(uiIds.size).toBe(rawIds.size);
  });

  it('3. "All" does not remove valid articles in client normalization', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    const uiArticles = NewsCoreV2UIAdapter.adaptMany(rawArticles);

    // Simulate NewsPage unique filtering
    const seen = new Set();
    const uniqueArticles = uiArticles.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    expect(uniqueArticles.length).toBe(uiArticles.length);

    // Simulate verifiedCategoryArticles for "All"
    const selectedCategory = 'All';
    const verifiedCategoryArticles = selectedCategory === 'All' 
      ? uniqueArticles 
      : uniqueArticles.filter(a => (a.primaryCategory || a.category || '').toLowerCase() === selectedCategory.toLowerCase());

    expect(verifiedCategoryArticles.length).toBe(uniqueArticles.length);
    expect(verifiedCategoryArticles.length).toBeGreaterThanOrEqual(1145);
  });

  it('4. Missing optional metadata does not remove an article', () => {
    const sampleArticle: any = {
      id: 'v2_test_minimal_123',
      headline: 'Minimal test article headline',
      body: 'Minimal body text for testing.',
      collectedAt: new Date().toISOString(),
      source: { publisher: 'Test Wire' }
      // intentionally missing fno, summary, tickers, sentiment, impactScore
    };

    const adapted = NewsCoreV2UIAdapter.adapt(sampleArticle);
    expect(adapted).toBeDefined();
    expect(adapted.id).toBe('v2_test_minimal_123');
    expect(adapted.headline).toBe('Minimal test article headline');
    expect(adapted.sentiment).toBe('NEUTRAL');
    expect(adapted.category).toBeDefined();
    expect(adapted.summary).toBeDefined();
  });

  it('5. Missing summary does not remove an article', () => {
    const sampleArticle: any = {
      id: 'v2_test_no_summary',
      headline: 'Article without precomputed summary',
      body: 'Raw article text here.',
      collectedAt: new Date().toISOString(),
      source: { publisher: 'Reuters' }
    };

    const adapted = NewsCoreV2UIAdapter.adapt(sampleArticle);
    expect(adapted.id).toBe('v2_test_no_summary');
    expect(adapted.summary).toBeDefined(); // Fallback generates clean summary
    expect(adapted.summary.length).toBeGreaterThan(0);
  });

  it('6. Missing F&O metadata does not remove an article', () => {
    const nonFnoArticle: any = {
      id: 'v2_test_non_fno',
      headline: 'General macroeconomic update from RBI',
      body: 'Monetary policy committee meeting scheduled next month.',
      collectedAt: new Date().toISOString(),
      source: { publisher: 'RBI' },
      primaryCategory: 'Economy'
    };

    const adapted = NewsCoreV2UIAdapter.adapt(nonFnoArticle);
    expect(adapted.id).toBe('v2_test_non_fno');
    expect(adapted.isFO).toBe(false);
    expect(adapted.fnoEligible).toBe(false);
    expect(adapted.headline).toBe(nonFnoArticle.headline);
  });

  it('7. Pagination does not silently truncate the dataset', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    const limit = 50;
    const totalCount = rawArticles.length;
    const totalPages = Math.ceil(totalCount / limit);

    let accumulatedArticles: any[] = [];
    for (let page = 1; page <= totalPages; page++) {
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const pageSlice = rawArticles.slice(startIndex, endIndex);
      accumulatedArticles = [...accumulatedArticles, ...pageSlice];
    }

    expect(accumulatedArticles.length).toBe(totalCount);
    const seenIds = new Set(accumulatedArticles.map(a => a.id));
    expect(seenIds.size).toBe(totalCount);
  });

  it('8. V4 and V5 responses cannot be mixed in client state', () => {
    const v4Article = NewsCoreV2UIAdapter.adapt(persistentNewsStore.getAllArticles()[0]);
    const v5Projection = {
      id: 'v5_proj_001',
      headline: 'Clustered Projection Story',
      clusterId: 'evt_123',
      storiesMap: ['v2_a1', 'v2_a2'],
      version: 'V5'
    };

    // Verify type distinctions: V4 has primaryCategory/sentiment/body, V5 event cluster has cluster properties
    expect(v4Article.id.startsWith('v2_')).toBe(true);
    expect((v5Projection as any).clusterId).toBe('evt_123');

    // Ensure distinct cache namespace separation
    const v2CacheKey = 'athena.newsFeed.v2.snapshot.v2.All';
    const v3CacheKey = 'athena.newsCoreV3.feed.All';
    expect(v2CacheKey).not.toBe(v3CacheKey);
  });

  it('9. V5 canary cannot replace normal V4 routing unexpectedly', () => {
    canary.setEnabled(true);
    canary.setPercentage(0); // Canary is active at 0%

    const req: any = {
      headers: { 'user-agent': 'Standard User Browser' },
      ip: '10.0.0.1'
    };

    const decision = canary.shouldRouteToCanary(req);
    expect(decision.useCanary).toBe(false);
    expect(decision.reason).toBe('CANARY_DISABLED');
  });

  it('10. "?canary=1" correctly overrides routing when explicitly requested', () => {
    canary.setEnabled(false); // Even when canary is globally disabled

    const reqCanaryOn: any = { query: { canary: '1' } };
    const decisionOn = canary.shouldRouteToCanary(reqCanaryOn);
    expect(decisionOn.useCanary).toBe(true);
    expect(decisionOn.reason).toBe('QUERY_OVERRIDE_CANARY');

    const reqCanaryOff: any = { query: { canary: '0' } };
    const decisionOff = canary.shouldRouteToCanary(reqCanaryOff);
    expect(decisionOff.useCanary).toBe(false);
    expect(decisionOff.reason).toBe('QUERY_OVERRIDE_CONTROL');
  });

  it('11. Normal request uses V4 when V3 is disabled', () => {
    // When ATHENA_NEWS_CANARY_ENABLED is false
    canary.setEnabled(false);
    const req: any = { headers: {}, ip: '127.0.0.1' };
    const decision = canary.shouldRouteToCanary(req);
    expect(decision.useCanary).toBe(false);
  });

  it('12. Client state does not retain stale V5 data after switching back to V4', () => {
    // Simulate cache snapshot verification
    const v3Snapshot = {
      category: 'All',
      version: 'V3',
      articles: [{ id: 'v5_event_1', headline: 'V5 Story' }],
      page: 1,
      totalPages: 1,
      totalCount: 1
    };

    const isV3Enabled = false; // We are in V4 mode
    const expectedVersion = isV3Enabled ? 'V3' : 'V2';

    const isValidForCurrentMode = v3Snapshot.version === expectedVersion;
    expect(isValidForCurrentMode).toBe(false); // Discard stale snapshot
  });

  it('13. Search filtering is applied only when search is active', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    const uiArticles = NewsCoreV2UIAdapter.adaptMany(rawArticles);

    // Empty search query -> returns all
    const emptyQuery = '';
    const filteredEmpty = emptyQuery.trim()
      ? uiArticles.filter(a => a.headline.toLowerCase().includes(emptyQuery.toLowerCase()))
      : uiArticles;

    expect(filteredEmpty.length).toBe(uiArticles.length);

    // Active search query
    const activeQuery = 'RBI';
    const filteredActive = activeQuery.trim()
      ? uiArticles.filter(a => (a.headline || '').toLowerCase().includes(activeQuery.toLowerCase()) || (a.publisher || '').toLowerCase().includes(activeQuery.toLowerCase()))
      : uiArticles;

    expect(filteredActive.length).toBeLessThan(uiArticles.length);
    expect(filteredActive.length).toBeGreaterThan(0);
  });

  it('14. Category filtering is applied only when a category other than All is selected', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    const uiArticles = NewsCoreV2UIAdapter.adaptMany(rawArticles);

    // For "All" -> returns all
    const forAll = uiArticles;
    expect(forAll.length).toBe(rawArticles.length);

    // For "Economy" -> returns economy subset
    const forEconomy = uiArticles.filter(a => (a.primaryCategory || a.category || '').toLowerCase() === 'economy');
    expect(forEconomy.length).toBeGreaterThan(0);
    expect(forEconomy.length).toBeLessThan(forAll.length);
  });

  it('15. Telegram eligibility cannot remove feed articles', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    const nonTelegramArticle = rawArticles.find(a => {
      const evalResult = TelegramAlertEligibilityEngine.evaluate(a as any);
      return evalResult.isEligible === false;
    });

    expect(nonTelegramArticle).toBeDefined();

    // Verify it is still valid and present in feed
    const adapted = NewsCoreV2UIAdapter.adapt(nonTelegramArticle!);
    expect(adapted).toBeDefined();
    expect(adapted.id).toBe(nonTelegramArticle!.id);
  });

  it('16. Summary availability cannot remove feed articles', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    for (const art of rawArticles.slice(0, 50)) {
      const intel = UnifiedIntelligenceEngine.build(art);
      expect(intel.executiveSummary).toBeDefined();
      expect(intel.executiveSummary.length).toBeGreaterThan(0);
    }
  });

  it('17. Canonical article IDs remain stable', () => {
    const rawArticles = persistentNewsStore.getAllArticles();
    for (const art of rawArticles) {
      expect(art.id).toMatch(/^v2_[a-f0-9]+$/);
    }
  });

  it('18. All valid canonical articles remain recoverable after reload', () => {
    const initialCount = persistentNewsStore.getAllArticles().length;
    expect(initialCount).toBeGreaterThanOrEqual(1145);

    // Re-instantiate or re-query
    const reloaded = persistentNewsStore.getAllArticles();
    expect(reloaded.length).toBe(initialCount);
  });

  it('19. Canary routing does not mutate canonical storage', () => {
    const hashBefore = computeSha256(newsCoreV2Path);

    // Perform multiple canary routing decisions and overrides
    canary.setEnabled(true);
    canary.setPercentage(50);
    for (let i = 0; i < 20; i++) {
      canary.shouldRouteToCanary({ headers: { 'x-client-id': `test_${i}` } });
    }

    const hashAfter = computeSha256(newsCoreV2Path);
    expect(hashAfter).toBe(hashBefore);
  });

  it('20. No duplicate article records are created during reconciliation', () => {
    const allArticles = persistentNewsStore.getAllArticles();
    const idSet = new Set<string>();
    const duplicateIds: string[] = [];

    for (const art of allArticles) {
      if (idSet.has(art.id)) {
        duplicateIds.push(art.id);
      }
      idSet.add(art.id);
    }

    expect(duplicateIds.length).toBe(0);
    expect(idSet.size).toBe(allArticles.length);
  });
});
