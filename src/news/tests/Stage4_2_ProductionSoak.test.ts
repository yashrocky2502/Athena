import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { healthMonitor } from '../monitoring/HealthMonitor.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { collectorHealthMonitor } from '../monitoring/CollectorHealthMonitor.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { IngestionPipeline } from '../ingestion/IngestionPipeline.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator.ts';
import { ArticleNormalizer } from '../normalization/ArticleNormalizer.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 4.2: Production Soak Test & Operational Invariants', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');
    const stage2BackupPath = `${stage2StorePath}.bak`;
    const testTempDir = path.join(process.cwd(), '.test_temp_stage4_2');

    beforeEach(async () => {
        if (!fs.existsSync(testTempDir)) {
            fs.mkdirSync(testTempDir, { recursive: true });
        }
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        collectorHealthMonitor.reset();
        await healthMonitor.initialize();
    });

    afterEach(() => {
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        collectorHealthMonitor.reset();
        if (fs.existsSync(testTempDir)) {
            fs.rmSync(testTempDir, { recursive: true, force: true });
        }
    });

    it('1. Canonical Store Safety: Non-Decrease Invariant & SHA-256 Check Before/After Diagnostics', async () => {
        const hashBefore = computeSha256(stage2StorePath);
        const backupHashBefore = computeSha256(stage2BackupPath);
        expect(hashBefore).not.toBeNull();

        const report = await healthMonitor.checkHealth();
        expect(report.canonicalArticleCount).toBeGreaterThan(0);
        expect(report.sha256).toBe(hashBefore);

        // Run multiple diagnostic passes
        for (let i = 0; i < 50; i++) {
            await healthMonitor.checkHealth();
        }

        const hashAfter = computeSha256(stage2StorePath);
        const backupHashAfter = computeSha256(stage2BackupPath);
        expect(hashAfter).toBe(hashBefore);
        expect(backupHashAfter).toBe(backupHashBefore);
        expect(healthMonitor.isCountDecreased()).toBe(false);
    });

    it('2. Ingestion Idempotency (Tests A, B, C, D)', async () => {
        const store = new JsonNewsStore(path.join(testTempDir, 'soak_idempotency.json'));
        await store.initialize();
        const pipeline = new IngestionPipeline(store);

        const basePayload = {
            title: 'HDFC Bank Signs Multi-Billion Tech Modernization Framework with Microsoft',
            url: 'https://reuters.com/business/hdfc-bank-microsoft-cloud-2026',
            body: 'HDFC Bank announced a transformative cloud partnership.',
            publishedAt: new Date().toISOString(),
            source: 'REUTERS'
        };

        // Test A — Genuinely new article (+1)
        const resA = await pipeline.ingest([basePayload], 'REUTERS');
        expect(resA.saved).toBe(1);
        expect(resA.duplicates).toBe(0);
        expect(await store.count()).toBe(1);

        // Test B — Exact same article (+0)
        const resB = await pipeline.ingest([basePayload], 'REUTERS');
        expect(resB.saved).toBe(0);
        expect(resB.duplicates).toBe(1);
        expect(await store.count()).toBe(1);

        // Test C — Same canonical URL with changed metadata (DUPLICATE / +0)
        const payloadC = {
            ...basePayload,
            title: 'HDFC Bank Expands Tech Modernization Framework (Updated)',
            body: 'Expanded details regarding strategic execution.'
        };
        const resC = await pipeline.ingest([payloadC], 'REUTERS');
        expect(resC.saved).toBe(0);
        expect(resC.duplicates).toBe(1);
        expect(await store.count()).toBe(1);

        // Test D — Semantically equivalent syndicated article
        const payloadD = {
            title: 'HDFC Bank Signs Multi-Billion Tech Modernization Framework with Microsoft',
            url: 'https://economictimes.indiatimes.com/tech/hdfc-microsoft-syndicated',
            body: 'HDFC Bank announced a transformative cloud partnership.',
            publishedAt: new Date().toISOString(),
            source: 'ECONOMIC_TIMES'
        };
        const articleD = ArticleNormalizer.normalize(payloadD, 'ECONOMIC_TIMES', 'RSS');
        articleD.id = ArticleIdentity.generateId(articleD);
        
        const existing = await store.getAll();
        const dedupD = ArticleDeduplicator.check(articleD, existing);
        expect(dedupD.status).toBe('POSSIBLE_DUPLICATE');
        expect(dedupD.evidence).toContain('Exact Normalized Headline Match');
    });

    it('3. Collector Health Matrix: All 12 Sources Verified', async () => {
        const SOURCES = [
            'REUTERS', 'ECONOMIC_TIMES', 'MONEYCONTROL', 'LIVEMINT', 
            'BUSINESS_STANDARD', 'CNBC_TV18', 'NSE', 'BSE', 
            'RBI', 'SEBI', 'PIB', 'GOOGLE_NEWS'
        ];

        // Simulate normal executions
        collectorHealthMonitor.recordCollectorExecution('REUTERS', 20, 18, 2);
        collectorHealthMonitor.recordCollectorExecution('ECONOMIC_TIMES', 15, 12, 3);
        collectorHealthMonitor.recordCollectorExecution('MONEYCONTROL', 10, 10, 0);
        collectorHealthMonitor.recordCollectorFailure('PIB', 'Gateway timed out');

        const report = collectorHealthMonitor.getCollectorHealthReport();
        for (const src of SOURCES) {
            expect(report[src]).toBeDefined();
            expect(report[src].schedule).toBeDefined();
            expect(['HEALTHY', 'WARNING', 'CRITICAL', 'IDLE']).toContain(report[src].currentHealth);
        }

        expect(report.REUTERS.currentHealth).toBe('HEALTHY');
        expect(report.PIB.currentHealth).toBe('WARNING');
        expect(report.PIB.errors).toBe(1);
    });

    it('4. Continuous Ingestion Telemetry: Bounded Rolling Metrics', async () => {
        const telemetry = IngestionTelemetry.getInstance();

        for (let i = 0; i < 25; i++) {
            telemetry.recordAttempt();
            telemetry.recordSuccess(2, 1, 'REUTERS');
        }

        const summary = telemetry.getTelemetrySummary();
        expect(summary.totalIngestionAttempts).toBe(25);
        expect(summary.articlesAccepted).toBe(50);
        expect(summary.duplicateArticles).toBe(25);
        expect(summary.articlesAddedLastHour).toBe(50);
        expect(summary.duplicateRate).toBe(33.33);
        expect(summary.boundedLogSizes.historyLog).toBeLessThanOrEqual(500);
        expect(summary.boundedLogSizes.errorLog).toBeLessThanOrEqual(100);
    });

    it('5. UI Feed Verification: All 12 Canonical Categories, Pagination & Symbols', async () => {
        const stage2Store = new JsonNewsStore();
        await stage2Store.initialize();
        const feedService = new NewsFeedService(stage2Store);
        const CATEGORIES = [
            'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy', 'Market', 
            'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
        ];

        for (const cat of CATEGORIES) {
            const feed = await feedService.getFeed({ category: cat, page: 1, limit: 10 });
            expect(feed).toBeDefined();
            expect(feed.page).toBe(1);
            expect(feed.limit).toBe(10);
            expect(Array.isArray(feed.articles)).toBe(true);

            // Verify no duplicate IDs on the returned page
            const ids = feed.articles.map((a: any) => a.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // If not 'All', verify category purity
            if (cat !== 'All' && feed.articles.length > 0) {
                for (const art of feed.articles) {
                    const artCat = (art.primaryCategory || (art as any).category || '').toLowerCase();
                    if (cat.toLowerCase() === 'f&o') {
                        const isFO = artCat === 'f&o' || artCat === 'fno' || art.fnoEligible === true || (art as any).isFO === true || (art as any).isFnO === true;
                        expect(isFO).toBe(true);
                    } else {
                        expect(artCat).toBe(cat.toLowerCase());
                    }
                }
            }
        }

        // Test Pagination Boundary & Clamping on Out of range page
        const outOfRangeFeed = await feedService.getFeed({ category: 'All', page: 9999, limit: 10 });
        expect(outOfRangeFeed.articles.length).toBeGreaterThan(0);
        expect(outOfRangeFeed.page).toBe(outOfRangeFeed.totalPages);

        // Test Symbol Filtering
        const symbolFeed = await feedService.getFeed({ category: 'All', symbol: 'RELIANCE', page: 1, limit: 10 });
        expect(symbolFeed).toBeDefined();
        if (symbolFeed.articles.length > 0) {
            for (const art of symbolFeed.articles) {
                expect(art.symbol).toBe('RELIANCE');
            }
        }
    });

    it('6. Performance Soak Test: 1,000 Consecutive Feed Requests', async () => {
        const stage2Store = new JsonNewsStore();
        await stage2Store.initialize();
        const feedService = new NewsFeedService(stage2Store);
        const iterations = 1000;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const res = await feedService.getFeed({ category: 'All', page: 1, limit: 20 });
            const dur = performance.now() - start;
            latencies.push(dur);
            expect(res.articles).toBeDefined();
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(iterations * 0.50)];
        const p95 = latencies[Math.floor(iterations * 0.95)];
        const p99 = latencies[Math.floor(iterations * 0.99)];
        const max = latencies[latencies.length - 1];

        console.log(`[Soak Performance] 1,000 Feed Queries: p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms, max=${max.toFixed(2)}ms`);

        expect(p50).toBeLessThan(15);
        expect(p95).toBeLessThan(35);
        expect(p99).toBeLessThan(60);
    });

    it('7. Temporary File Safety: Zero Orphaned .tmp Files', async () => {
        const filesBefore = fs.readdirSync(dataDir);
        
        // Execute heavy feed queries & diagnostics
        for (let i = 0; i < 50; i++) {
            await healthMonitor.checkHealth();
        }

        const filesAfter = fs.readdirSync(dataDir);
        const tmpFiles = filesAfter.filter(f => f.endsWith('.tmp') || f.includes('.tmp.'));
        expect(tmpFiles.length).toBe(0);
        expect(filesAfter.length).toBe(filesBefore.length);
    });
});
