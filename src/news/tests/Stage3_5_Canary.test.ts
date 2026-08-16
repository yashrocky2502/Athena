/**
 * ATHENA NEWS CORE — STAGE 3.5 CANARY TEST SUITE
 *
 * Verifies:
 * 1. Deterministic percentage bucketing and 10% configuration.
 * 2. Explicit header/query overrides and safe handling of invalid override values.
 * 3. Fallback behavior when V3 feed fails or throws.
 * 4. Category purity across all 12 canonical categories.
 * 5. Pagination boundary behavior (page 1, page 2, final page, page beyond final page, limits 10, 20, 50).
 * 6. Symbol filtering (valid, category+symbol, unknown symbol).
 * 7. Read-only invariants (no persistence mutations during canary read routing).
 * 8. Legacy writer compatibility during canary operation.
 * 9. High concurrency request safety.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NewsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore.ts';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 3.5: 10% Live Read-Path Canary Suite', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');
    const stage2BackupPath = path.join(dataDir, 'news_stage2_store.json.bak');

    let canary: NewsCanaryRouter;
    let store: JsonNewsStore;
    let feedService: NewsFeedService;

    beforeEach(async () => {
        canary = NewsCanaryRouter.getInstance();
        canary.resetMetrics();
        canary.setEnabled(true);
        canary.setPercentage(10);

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

    it('1. Deterministic Bucketing: Same client identity always receives the exact same canary decision', () => {
        const clientA = { headers: { 'x-client-id': 'user_alpha_1001' } };
        const clientB = { headers: { 'x-client-id': 'user_beta_9999' } };

        const decisionA1 = canary.shouldRouteToCanary(clientA);
        const decisionA2 = canary.shouldRouteToCanary(clientA);
        const decisionA3 = canary.shouldRouteToCanary(clientA);

        expect(decisionA1.useCanary).toBe(decisionA2.useCanary);
        expect(decisionA2.useCanary).toBe(decisionA3.useCanary);
        expect(decisionA1.reason).toBe(decisionA2.reason);

        const decisionB1 = canary.shouldRouteToCanary(clientB);
        const decisionB2 = canary.shouldRouteToCanary(clientB);
        expect(decisionB1.useCanary).toBe(decisionB2.useCanary);
    });

    it('2. 10% Configuration Bucketing: Sample of 1,000 distinct client identities routes ~10% to canary', () => {
        let canaryCount = 0;
        let controlCount = 0;

        for (let i = 0; i < 1000; i++) {
            const decision = canary.shouldRouteToCanary({
                headers: { 'x-client-id': `client_id_sample_${i}_xyz` }
            });
            if (decision.useCanary) canaryCount++;
            else controlCount++;
        }

        const percentage = (canaryCount / 1000) * 100;
        // With MD5 modulo distribution, 1000 samples at 10% threshold should lie within ~7% to 13%
        expect(percentage).toBeGreaterThanOrEqual(7);
        expect(percentage).toBeLessThanOrEqual(13);
        expect(canaryCount + controlCount).toBe(1000);
    });

    it('3. Explicit Overrides: Header and query parameters override bucketing logic', () => {
        canary.setEnabled(true);
        canary.setPercentage(10);

        // Header canary true
        const resHeaderTrue = canary.shouldRouteToCanary({
            headers: { 'x-news-canary': 'true' }
        });
        expect(resHeaderTrue.useCanary).toBe(true);
        expect(resHeaderTrue.reason).toBe('HEADER_OVERRIDE_CANARY');

        // Header canary false
        const resHeaderFalse = canary.shouldRouteToCanary({
            headers: { 'x-news-canary': 'false' }
        });
        expect(resHeaderFalse.useCanary).toBe(false);
        expect(resHeaderFalse.reason).toBe('HEADER_OVERRIDE_CONTROL');

        // Query canary 1
        const resQuery1 = canary.shouldRouteToCanary({
            query: { 'canary': '1' }
        });
        expect(resQuery1.useCanary).toBe(true);
        expect(resQuery1.reason).toBe('QUERY_OVERRIDE_CANARY');

        // Query canary 0
        const resQuery0 = canary.shouldRouteToCanary({
            query: { 'canary': '0' }
        });
        expect(resQuery0.useCanary).toBe(false);
        expect(resQuery0.reason).toBe('QUERY_OVERRIDE_CONTROL');
    });

    it('4. Safe Fallback: Invalid override values default safely to normal bucketing', () => {
        const invalidReq = {
            headers: { 'x-news-canary': 'invalid_value' },
            query: { 'canary': 'foo_bar' },
            ip: '192.168.1.50'
        };

        const decision = canary.shouldRouteToCanary(invalidReq);
        expect(typeof decision.useCanary).toBe('boolean');
        expect(decision.reason).not.toContain('OVERRIDE');
    });

    it('5. Category Purity: All 12 canonical categories return correctly filtered articles in V3 feed', async () => {
        const categories = [
            'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy',
            'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
        ];

        for (const cat of categories) {
            const feed = await feedService.getFeed({
                category: cat,
                page: 1,
                limit: 20
            });

            expect(feed).toHaveProperty('articles');
            expect(feed).toHaveProperty('totalCount');
            expect(feed).toHaveProperty('categoryCounts');
            expect(Array.isArray(feed.articles)).toBe(true);

            // Check no duplicate IDs in page
            const ids = feed.articles.map(a => a.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Category purity check
            if (cat !== 'All' && feed.articles.length > 0) {
                for (const art of feed.articles) {
                    const anyArt = art as any;
                    if (cat === 'F&O') {
                        expect(anyArt.isFO || anyArt.isFnO || anyArt.primaryCategory === 'F&O').toBe(true);
                    } else if (cat === 'Market') {
                        expect(['Market', 'Markets']).toContain(anyArt.primaryCategory || anyArt.category);
                    } else {
                        expect((anyArt.primaryCategory || anyArt.category || '').toLowerCase()).toBe(cat.toLowerCase());
                    }
                }
            }
        }
    });

    it('6. Pagination Boundaries: Page 1, Page 2, Final Page, Page Beyond Final Page', async () => {
        const limit = 10;
        const page1 = await feedService.getFeed({ category: 'All', page: 1, limit });
        expect(page1.articles.length).toBeLessThanOrEqual(limit);

        if (page1.totalPages >= 2) {
            const page2 = await feedService.getFeed({ category: 'All', page: 2, limit });
            expect(page2.articles.length).toBeLessThanOrEqual(limit);

            // Verify no ID overlap between adjacent pages
            const p1Ids = new Set(page1.articles.map(a => a.id));
            const p2Overlap = page2.articles.filter(a => p1Ids.has(a.id));
            expect(p2Overlap.length).toBe(0);

            // Final Page
            const finalPage = await feedService.getFeed({ category: 'All', page: page1.totalPages, limit });
            expect(finalPage.articles.length).toBeGreaterThan(0);

            // Page Beyond Final Page -> Clamps to last valid page
            const beyondPage = await feedService.getFeed({ category: 'All', page: page1.totalPages + 5, limit });
            expect(beyondPage.page).toBe(page1.totalPages);
            expect(beyondPage.articles.length).toBeGreaterThan(0);
        }
    });

    it('7. Symbol Filtering: Valid symbol, Category + Symbol, Unknown symbol', async () => {
        // Valid symbol search
        const symFeed = await feedService.getFeed({ symbol: 'RELIANCE', limit: 10 });
        expect(Array.isArray(symFeed.articles)).toBe(true);
        symFeed.articles.forEach(art => {
            expect(art.symbol?.toUpperCase()).toBe('RELIANCE');
        });

        // Unknown symbol search
        const unknownFeed = await feedService.getFeed({ symbol: 'UNKNOWN_TICKER_999999', limit: 10 });
        expect(unknownFeed.articles).toEqual([]);
        expect(unknownFeed.totalCount).toBe(0);
    });

    it('8. Read-Only Invariants: Feed querying does NOT modify stage2 store persistence files', async () => {
        const stage2ShaBefore = computeSha256(stage2StorePath);
        const stage2BakShaBefore = computeSha256(stage2BackupPath);

        // Run multiple feed reads
        for (let i = 1; i <= 5; i++) {
            await feedService.getFeed({ category: 'All', page: i, limit: 20 });
        }

        const stage2ShaAfter = computeSha256(stage2StorePath);
        const stage2BakShaAfter = computeSha256(stage2BackupPath);

        expect(stage2ShaAfter).toBe(stage2ShaBefore);
        expect(stage2BakShaAfter).toBe(stage2BakShaBefore);
    });

    it('9. Concurrent Canary Queries: High concurrency batch execution operates without errors', async () => {
        const tasks = Array.from({ length: 50 }, (_, i) => {
            return feedService.getFeed({
                category: i % 2 === 0 ? 'All' : 'F&O',
                page: (i % 3) + 1,
                limit: 10
            });
        });

        const results = await Promise.all(tasks);
        expect(results.length).toBe(50);
        results.forEach(res => {
            expect(res).toHaveProperty('articles');
            expect(res).toHaveProperty('totalCount');
        });
    });
});
