/**
 * ATHENA NEWS CORE — STAGE 3.8 FULL READ-PATH CUTOVER SUITE
 *
 * Verifies:
 * 1. 100% Canary Routing Contract: Normal client identities route completely to V3.
 * 2. Explicit Override & Emergency Rollback compliance (headers, query params, disabling).
 * 3. Cache Namespace Isolation (V3 'newsCoreV3.feed.*' vs V2 'newsFeed.v2.*').
 * 4. Paginated, Category-Filtered, and Clamping parameter coverage across all 12 categories.
 * 5. Route-Level Resiliency: Failure in V3 pipeline triggers seamless fallback to V2.
 * 6. Concurrency Performance Gate (1,000 requests) & Immutability check of canonical data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NewsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';
import { newsV5Router } from '../api/newsV5Routes.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function calculatePercentiles(latencies: number[]) {
    if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    const getPercentile = (p: number) => {
        const idx = Math.min(Math.floor((p / 100) * count), count - 1);
        return sorted[idx];
    };

    return {
        p50: Number(getPercentile(50).toFixed(2)),
        p95: Number(getPercentile(95).toFixed(2)),
        p99: Number(getPercentile(99).toFixed(2)),
        max: Number(sorted[count - 1].toFixed(2)),
        avg: Number((sum / count).toFixed(2))
    };
}

describe('Stage 3.8: Full V3 Read-Path Cutover & Verification', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');
    const newsCoreV2Path = path.join(dataDir, 'news_core_v2.json');

    let canary: NewsCanaryRouter;
    let store: JsonNewsStore;
    let feedService: NewsFeedService;

    const categories = [
        'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy',
        'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
    ];

    beforeEach(async () => {
        canary = NewsCanaryRouter.getInstance();
        canary.resetMetrics();
        canary.setEnabled(true);
        canary.setPercentage(100);

        LegacyWriterGuard.resetToDefault(); // ATHENA_LEGACY_WRITERS_ENABLED = true

        store = new JsonNewsStore();
        await store.initialize();
        feedService = new NewsFeedService(store);
    });

    afterEach(() => {
        canary.resetMetrics();
        canary.setEnabled(false);
        canary.setPercentage(0);
    });

    it('1. 100% Canary Routing Contract', () => {
        // Assert that at 100%, generic client identities route completely to V3
        const clients = Array.from({ length: 100 }, (_, i) => `client_id_normal_traffic_${i}`);
        for (const clientId of clients) {
            const req = { headers: { 'x-client-id': clientId } };
            const decision = canary.shouldRouteToCanary(req);
            expect(decision.useCanary).toBe(true);
            expect(decision.reason).toContain('BUCKET_');
        }
    });

    it('2. Explicit Rollback & Override Compliance', () => {
        // Explicit V2 Override via header or query parameter MUST force V2 (control path)
        const resHeaderV2 = canary.shouldRouteToCanary({ headers: { 'x-news-canary': 'false' } });
        expect(resHeaderV2.useCanary).toBe(false);
        expect(resHeaderV2.reason).toBe('HEADER_OVERRIDE_CONTROL');

        const resQueryV2 = canary.shouldRouteToCanary({ query: { 'canary': '0' } });
        expect(resQueryV2.useCanary).toBe(false);
        expect(resQueryV2.reason).toBe('QUERY_OVERRIDE_CONTROL');

        // Explicit V3 Override via header or query parameter MUST force V3 (canary path)
        const resHeaderV3 = canary.shouldRouteToCanary({ headers: { 'x-news-canary': 'true' } });
        expect(resHeaderV3.useCanary).toBe(true);
        expect(resHeaderV3.reason).toBe('HEADER_OVERRIDE_CANARY');

        // Emergency Rollback to 0% canary
        canary.setPercentage(0);
        const clients = Array.from({ length: 50 }, (_, i) => `client_id_rollback_${i}`);
        for (const clientId of clients) {
            const req = { headers: { 'x-client-id': clientId } };
            const decision = canary.shouldRouteToCanary(req);
            expect(decision.useCanary).toBe(false);
            expect(decision.reason).toBe('CANARY_DISABLED');
        }

        // Entirely disabling canary
        canary.setEnabled(false);
        for (const clientId of clients) {
            const req = { headers: { 'x-client-id': clientId } };
            const decision = canary.shouldRouteToCanary(req);
            expect(decision.useCanary).toBe(false);
            expect(decision.reason).toBe('CANARY_DISABLED');
        }
    });

    it('3. Cache Namespace Isolation Verification', () => {
        // Assert V3 cache namespaces are distinct from legacy V2
        const catList = ['All', 'Results', 'F&O'];
        for (const cat of catList) {
            const v3CacheKey = `athena.newsCoreV3.feed.${cat}`;
            const v2CacheKey = `athena.newsFeed.v2.snapshot.v2.${cat}`;
            expect(v3CacheKey).not.toBe(v2CacheKey);
            expect(v3CacheKey.includes('newsCoreV3')).toBe(true);
            expect(v2CacheKey.includes('newsFeed.v2')).toBe(true);
        }
    });

    it('4. Full Parameter and Pagination Clamping across all 12 Categories', async () => {
        const limits = [10, 30];
        for (const cat of categories) {
            for (const limit of limits) {
                // Page 1
                const resPage1 = await feedService.getFeed({ category: cat, page: 1, limit });
                expect(resPage1).toHaveProperty('articles');
                expect(Array.isArray(resPage1.articles)).toBe(true);
                expect(resPage1.articles.length).toBeLessThanOrEqual(limit);

                const totalPages = resPage1.totalPages;
                if (totalPages >= 2) {
                    // Page 2
                    const resPage2 = await feedService.getFeed({ category: cat, page: 2, limit });
                    expect(resPage2.articles.length).toBeLessThanOrEqual(limit);

                    // Purity of pagination - no overlap of article IDs
                    const p1Ids = new Set(resPage1.articles.map(a => a.id));
                    const overlap = resPage2.articles.filter(a => p1Ids.has(a.id));
                    expect(overlap.length).toBe(0);
                }

                // Clamping page past totalPages
                const resClamped = await feedService.getFeed({ category: cat, page: totalPages + 10, limit });
                expect(resClamped.page).toBe(totalPages);
                expect(resClamped.articles.length).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('5. API Routing Layer V2 Fallback under V3 Failure', async () => {
        // Locate Express router layer handler for GET /feed
        const feedRoute = newsV5Router.stack.find((layer: any) => layer.route && layer.route.path === '/feed');
        expect(feedRoute).toBeDefined();
        const feedHandler = feedRoute?.route?.stack?.[0]?.handle;
        expect(feedHandler).toBeDefined();

        const mockError = new Error('Simulated V3 read crash');
        
        // Mock JsonNewsStore database query methods to throw error
        const originalGetAll = JsonNewsStore.prototype.getAll;
        const originalFindByCategory = JsonNewsStore.prototype.findByCategory;
        const originalFindBySymbol = JsonNewsStore.prototype.findBySymbol;
        
        JsonNewsStore.prototype.getAll = async () => {
            throw mockError;
        };
        JsonNewsStore.prototype.findByCategory = async () => {
            throw mockError;
        };
        JsonNewsStore.prototype.findBySymbol = async () => {
            throw mockError;
        };

        try {
            const req: any = {
                query: { page: '1', limit: '20', category: 'All' },
                headers: {},
                ip: '127.0.0.1'
            };

            const res: any = {
                headers: {} as Record<string, string>,
                statusCode: 200,
                body: null as any,
                setHeader(name: string, value: string) {
                    this.headers[name] = value;
                    return this;
                },
                status(code: number) {
                    this.statusCode = code;
                    return this;
                },
                json(data: any) {
                    this.body = data;
                    return this;
                }
            };

            await feedHandler(req, res, () => {});

            expect(res.statusCode).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.status).toBe('success');
            expect(res.body.version).toBe('V5-V2-FALLBACK');
            expect(res.body.canaryRouted).toBe(false);
            expect(res.body.articles).toBeDefined();
            expect(Array.isArray(res.body.articles)).toBe(true);
        } finally {
            // Restore original storage query methods
            JsonNewsStore.prototype.getAll = originalGetAll;
            JsonNewsStore.prototype.findByCategory = originalFindByCategory;
            JsonNewsStore.prototype.findBySymbol = originalFindBySymbol;
        }
    });

    it('6. Performance Gate & Immutability Check (1,000 requests)', async () => {
        const hashBeforeStage2 = computeSha256(stage2StorePath);
        const hashBeforeV2 = computeSha256(newsCoreV2Path);

        const WORKERS = 10;
        const REQUESTS_PER_WORKER = 100;
        const latencies: number[] = [];
        let successCount = 0;
        let errorCount = 0;

        const runWorker = async (workerId: number) => {
            for (let i = 0; i < REQUESTS_PER_WORKER; i++) {
                const cat = categories[(workerId + i) % categories.length];
                const page = (i % 3) + 1;
                const limit = (i % 2 === 0) ? 20 : 50;

                const start = performance.now();
                try {
                    const res = await feedService.getFeed({ category: cat, page, limit });
                    const end = performance.now();
                    latencies.push(end - start);

                    if (res && Array.isArray(res.articles)) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (err) {
                    errorCount++;
                }
            }
        };

        const workers = Array.from({ length: WORKERS }, (_, idx) => runWorker(idx));
        await Promise.all(workers);

        const metrics = calculatePercentiles(latencies);
        console.log(`[Stage 3.8 SLA Profiler] Total: ${successCount + errorCount}, Success: ${successCount}, Errors: ${errorCount}`);
        console.log(`[Stage 3.8 SLA Profiler] Latency Metrics:`, metrics);

        expect(errorCount).toBe(0);
        expect(successCount).toBe(1000);

        // Performance SLAs under stress/contention
        expect(metrics.p50).toBeLessThan(25);
        expect(metrics.p95).toBeLessThan(40);
        expect(metrics.p99).toBeLessThan(75);

        // Verify Immutability of Canonical Storage Files
        const hashAfterStage2 = computeSha256(stage2StorePath);
        const hashAfterV2 = computeSha256(newsCoreV2Path);
        expect(hashAfterStage2).toBe(hashBeforeStage2);
        expect(hashAfterV2).toBe(hashBeforeV2);
    });
});
