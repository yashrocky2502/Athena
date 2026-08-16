/**
 * ATHENA NEWS CORE — STAGE 3.6 WARM-PATH RELIABILITY, LATENCY & NEWS RETENTION TEST SUITE
 *
 * Verifies:
 * 1. Architecture Preservation: V2 control path, V3 canary path, ATHENA_LEGACY_WRITERS_ENABLED=true.
 * 2. Cold vs. Warm Latency Audit: Record p50, p95, p99, and Max latency for V3 read path.
 * 3. Sustained Concurrency Test: Execute ~1,000 requests across 10 concurrent workers without errors.
 * 4. Response Payload Integrity: 100% valid articles, no duplicate IDs, category purity, non-overlapping pagination.
 * 5. Read-Only Invariants: V3 feed reads do NOT mutate dataset files or leave temporary files on disk.
 * 6. V3 Store Growth & Idempotency: Confirm store accepts new articles and handles duplicate insertions cleanly.
 * 7. Dataset Forensic Hashes: SHA-256 baseline verification before and after test execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { NewsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function calculatePercentiles(latencies: number[]) {
    if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0, min: 0, avg: 0 };
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
        min: Number(sorted[0].toFixed(2)),
        avg: Number((sum / count).toFixed(2))
    };
}

describe('Stage 3.6: Warm-Path Reliability, Latency & News Retention Audit Suite', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');
    const newsCoreV2Path = path.join(dataDir, 'news_core_v2.json');
    const v3NewsStorePath = path.join(dataDir, 'v3_news_store.json');

    let store: JsonNewsStore;
    let feedService: NewsFeedService;
    let canary: NewsCanaryRouter;

    beforeEach(async () => {
        LegacyWriterGuard.resetToDefault(); // ATHENA_LEGACY_WRITERS_ENABLED = true
        canary = NewsCanaryRouter.getInstance();
        canary.resetMetrics();
        canary.setEnabled(true);
        canary.setPercentage(10);

        store = new JsonNewsStore();
        await store.initialize();
        feedService = new NewsFeedService(store);
    });

    afterEach(() => {
        canary.resetMetrics();
        canary.setEnabled(false);
    });

    it('1. Architecture & Feature Flag Verification', () => {
        expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(true);
        const canaryStatus = canary.getStatus();
        expect(canaryStatus.enabled).toBe(true);
        expect(canaryStatus.percentage).toBe(10);

        expect(fs.existsSync(stage2StorePath)).toBe(true);
        expect(fs.existsSync(newsCoreV2Path)).toBe(true);
        expect(fs.existsSync(v3NewsStorePath)).toBe(true);
    });

    it('2. Cold-Start vs Warm-Path Latency Audit', async () => {
        // Cold start test with fresh uninitialized store
        const coldStore = new JsonNewsStore();
        const coldStartTimer = performance.now();
        await coldStore.initialize();
        const coldFeedService = new NewsFeedService(coldStore);
        await coldFeedService.getFeed({ category: 'All', page: 1, limit: 20 });
        const coldLatency = performance.now() - coldStartTimer;

        // Warm path benchmark across 12 categories, limits, pages, and symbols
        const categories = [
            'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy', 
            'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
        ];
        const limits = [10, 20, 50];
        const latencies: number[] = [];

        // Warm up cache first
        await feedService.getFeed({ category: 'All', page: 1, limit: 20 });

        // Execute warm read suite
        for (let i = 0; i < 200; i++) {
            const category = categories[i % categories.length];
            const limit = limits[i % limits.length];
            const page = (i % 3) + 1;

            const t0 = performance.now();
            const res = await feedService.getFeed({ category, page, limit });
            const duration = performance.now() - t0;
            latencies.push(duration);

            expect(res).toBeDefined();
            expect(Array.isArray(res.articles)).toBe(true);
        }

        const metrics = calculatePercentiles(latencies);

        console.log(`[Stage 3.6 Audit] Cold Start Latency: ${coldLatency.toFixed(2)} ms`);
        console.log(`[Stage 3.6 Audit] Warm Path Metrics (200 requests):`, metrics);

        expect(metrics.p50).toBeLessThan(15); // Warm p50 target < 15ms
        expect(metrics.p95).toBeLessThan(35); // Warm p95 target < 35ms
        expect(metrics.p99).toBeLessThan(60); // Warm p99 target < 60ms
    });

    it('3. Sustained Concurrency Test (~1,000 Requests across 10 Concurrent Workers)', async () => {
        const hashBeforeStage2 = computeSha256(stage2StorePath);
        const hashBeforeV2 = computeSha256(newsCoreV2Path);

        const WORKER_COUNT = 10;
        const REQUESTS_PER_WORKER = 100; // 1,000 requests total
        const categories = ['All', 'F&O', 'Market', 'Results', 'Crypto', 'IPO', 'Economy'];
        const latencies: number[] = [];
        let totalSuccesses = 0;
        let totalErrors = 0;

        const workerTask = async (workerId: number) => {
            for (let i = 0; i < REQUESTS_PER_WORKER; i++) {
                const category = categories[(workerId + i) % categories.length];
                const page = (i % 5) + 1;
                const limit = (i % 2 === 0) ? 20 : 50;

                const t0 = performance.now();
                try {
                    const res = await feedService.getFeed({ category, page, limit });
                    const dur = performance.now() - t0;
                    latencies.push(dur);

                    if (res && Array.isArray(res.articles)) {
                        totalSuccesses++;
                    } else {
                        totalErrors++;
                    }
                } catch (e) {
                    totalErrors++;
                }
            }
        };

        const workers = Array.from({ length: WORKER_COUNT }, (_, idx) => workerTask(idx));
        await Promise.all(workers);

        const metrics = calculatePercentiles(latencies);
        console.log(`[Stage 3.6 Concurrency] Total Requests: ${totalSuccesses + totalErrors}, Successes: ${totalSuccesses}, Errors: ${totalErrors}`);
        console.log(`[Stage 3.6 Concurrency] Latency Distribution:`, metrics);

        expect(totalErrors).toBe(0);
        expect(totalSuccesses).toBe(WORKER_COUNT * REQUESTS_PER_WORKER);
        expect(metrics.avg).toBeLessThan(30); // Average per-request queued duration under 10 concurrent workers < 30ms
        expect(metrics.p50).toBeLessThan(45); // Concurrency event loop queue p50 < 45ms

        // Read-only Invariant Check: Hashes must remain 100% unchanged
        const hashAfterStage2 = computeSha256(stage2StorePath);
        const hashAfterV2 = computeSha256(newsCoreV2Path);
        expect(hashAfterStage2).toBe(hashBeforeStage2);
        expect(hashAfterV2).toBe(hashBeforeV2);

        // Temp file check: No stray .tmp files in data/
        const dataDirFiles = fs.readdirSync(dataDir);
        const strayTmpFiles = dataDirFiles.filter(f => f.includes('.tmp.'));
        expect(strayTmpFiles.length).toBe(0);
    });

    it('4. Response Payload & Category Purity Verification', async () => {
        // Test Category Purity for F&O
        const fnoFeed = await feedService.getFeed({ category: 'F&O', page: 1, limit: 50 });
        for (const art of fnoFeed.articles) {
            const isFno = art.primaryCategory === 'F&O' || art.fnoEligible === true || (art as any).isFnO === true || (art as any).isFO === true;
            expect(isFno).toBe(true);
        }

        // Test Category Purity for Crypto
        const cryptoFeed = await feedService.getFeed({ category: 'Crypto', page: 1, limit: 50 });
        for (const art of cryptoFeed.articles) {
            expect(art.primaryCategory).toBe('Crypto');
        }

        // Test Pagination Non-Overlap
        const page1 = await feedService.getFeed({ category: 'All', page: 1, limit: 20 });
        const page2 = await feedService.getFeed({ category: 'All', page: 2, limit: 20 });

        const page1Ids = new Set(page1.articles.map(a => a.id));
        const page2Ids = new Set(page2.articles.map(a => a.id));

        for (const id2 of page2Ids) {
            expect(page1Ids.has(id2)).toBe(false); // Page 1 and Page 2 must not overlap
        }

        // Duplicate ID check within single payload
        expect(page1Ids.size).toBe(page1.articles.length);
        expect(page2Ids.size).toBe(page2.articles.length);
    });

    it('5. V3 Store Ingestion Growth & Idempotency Check', async () => {
        const initialCount = await store.count();

        // Create mock distinct new article
        const testId = `test_stage3_6_growth_${Date.now()}`;
        const newArt: any = {
            id: testId,
            headline: 'STAGE 3.6 AUDIT TEST: Reserve Bank Announces Policy Rate Decision',
            body: 'Detailed body test for stage 3.6 audit.',
            primaryCategory: 'Economy',
            publishedAt: new Date().toISOString(),
            source: { publisher: 'Athena Audit', url: `https://athena.test/${testId}` },
            canonicalUrl: `https://athena.test/${testId}`
        };

        // 1. Insert distinct article
        await store.insert(newArt);
        const countAfterInsert = await store.count();
        expect(countAfterInsert).toBe(initialCount + 1);

        // 2. Idempotent re-insert (same article ID)
        await store.insert(newArt);
        const countAfterReinsert = await store.count();
        expect(countAfterReinsert).toBe(initialCount + 1); // Must not duplicate or grow

        // Verify retrieval
        const retrieved = await store.getById(testId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.headline).toBe(newArt.headline);
    });
});
