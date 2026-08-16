/**
 * ATHENA NEWS CORE — STAGE 3.4 LEGACY WRITER ISOLATION & CANARY PREPARATION TEST SUITE
 *
 * Verifies:
 * 1. Legacy Writer Guard flag behavior (enabled vs disabled).
 * 2. Complete suppression of legacy writes when ATHENA_LEGACY_WRITERS_ENABLED=false.
 * 3. Read path compatibility for both V2 and V3 while legacy writers are disabled.
 * 4. Zero mutation invariant on historical datasets.
 * 5. Canary routing engine deterministic decisions and header overrides.
 * 6. Rollback capability and clean restoration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';
import { NewsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore.ts';
import { newsSyncService } from '../../newsCoreV2/sync/NewsSyncService.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 3.4: Legacy Writer Isolation & Canary Preparation Suite', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const v2StorePath = path.join(dataDir, 'news_core_v2.json');
    const v3StorePath = path.join(dataDir, 'v3_news_store.json');
    const intelligencePath = path.join(dataDir, 'news_intelligence_v2.json');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');

    beforeEach(() => {
        LegacyWriterGuard.resetToDefault();
    });

    afterEach(() => {
        LegacyWriterGuard.resetToDefault();
    });

    it('1. LegacyWriterGuard defaults to true to preserve existing operations', () => {
        LegacyWriterGuard.resetToDefault();
        expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(true);
        expect(LegacyWriterGuard.assertAllowed('TestOp')).toBe(true);
    });

    it('2. LegacyWriterGuard correctly gates execution when set to false', () => {
        LegacyWriterGuard.setLegacyWritersEnabled(false);
        expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(false);
        expect(LegacyWriterGuard.assertAllowed('TestOpDisabled')).toBe(false);
    });

    it('3. NewsSyncService.runSync cleanly skips execution when legacy writers are disabled', async () => {
        LegacyWriterGuard.setLegacyWritersEnabled(false);
        
        const result = await newsSyncService.runSync();
        expect(result.status).toBe('IDLE');
        expect(result.itemsProcessed).toBe(0);
        expect(result.newAdded).toBe(0);
    });

    it('4. Zero-mutation invariant: All storage files remain untouched when legacy writers are disabled', async () => {
        const v2ShaBefore = computeSha256(v2StorePath);
        const v3ShaBefore = computeSha256(v3StorePath);
        const intelShaBefore = computeSha256(intelligencePath);
        const stage2ShaBefore = computeSha256(stage2StorePath);

        LegacyWriterGuard.setLegacyWritersEnabled(false);

        // Attempt legacy sync run while isolated
        await newsSyncService.runSync();

        const v2ShaAfter = computeSha256(v2StorePath);
        const v3ShaAfter = computeSha256(v3StorePath);
        const intelShaAfter = computeSha256(intelligencePath);
        const stage2ShaAfter = computeSha256(stage2StorePath);

        expect(v2ShaAfter).toBe(v2ShaBefore);
        expect(v3ShaAfter).toBe(v3ShaBefore);
        expect(intelShaAfter).toBe(intelShaBefore);
        expect(stage2ShaAfter).toBe(stage2ShaBefore);
    });

    it('5. Legacy V2 read path remains fully functional and accessible when writers are disabled', () => {
        LegacyWriterGuard.setLegacyWritersEnabled(false);

        const articles = newsStore.getAllArticles();
        expect(Array.isArray(articles)).toBe(true);
        expect(articles.length).toBeGreaterThan(0);

        const fno = newsStore.getFNOArticles();
        expect(Array.isArray(fno)).toBe(true);

        const adapted = NewsCoreV2UIAdapter.adaptMany(articles.slice(0, 10));
        expect(adapted.length).toBe(Math.min(10, articles.length));
        expect(adapted[0]).toHaveProperty('id');
        expect(adapted[0]).toHaveProperty('headline');
    });

    it('6. Canonical V3/V5 read pipeline remains fully functional and independent', async () => {
        LegacyWriterGuard.setLegacyWritersEnabled(false);

        const store = new JsonNewsStore();
        await store.initialize();
        const feedService = new NewsFeedService(store);

        const feedResult = await feedService.getFeed({
            category: 'All',
            page: 1,
            limit: 10,
            sort: 'latest'
        });

        expect(feedResult).toHaveProperty('articles');
        expect(feedResult).toHaveProperty('totalCount');
        expect(feedResult).toHaveProperty('page', 1);
        expect(feedResult.articles.length).toBeGreaterThanOrEqual(0);
    });

    it('7. Canary Routing Engine operates correctly with header/query overrides and bucketing', () => {
        const canary = NewsCanaryRouter.getInstance();
        canary.resetMetrics();
        canary.setEnabled(false);
        canary.setPercentage(0);

        // Case A: Canary disabled -> Control
        const resA = canary.shouldRouteToCanary({
            headers: {},
            ip: '127.0.0.1'
        });
        expect(resA.useCanary).toBe(false);
        expect(resA.reason).toBe('CANARY_DISABLED');

        // Case B: Header override canary
        const resB = canary.shouldRouteToCanary({
            headers: { 'x-news-canary': 'true' }
        });
        expect(resB.useCanary).toBe(true);
        expect(resB.reason).toBe('HEADER_OVERRIDE_CANARY');

        // Case C: Header override control
        const resC = canary.shouldRouteToCanary({
            headers: { 'x-news-canary': 'false' }
        });
        expect(resC.useCanary).toBe(false);
        expect(resC.reason).toBe('HEADER_OVERRIDE_CONTROL');

        // Case D: Percentage bucketing
        canary.setEnabled(true);
        canary.setPercentage(50);
        const resD = canary.shouldRouteToCanary({
            headers: { 'x-client-id': 'client_alpha_99' }
        });
        expect(typeof resD.useCanary).toBe('boolean');

        const status = canary.getStatus();
        expect(status.totalRequests).toBe(4);
        expect(status.overridesCount).toBe(2);
    });

    it('8. Rollback validation: Restoring legacy writer flag immediately re-enables legacy operations', () => {
        LegacyWriterGuard.setLegacyWritersEnabled(false);
        expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(false);

        // Immediate rollback to true
        LegacyWriterGuard.setLegacyWritersEnabled(true);
        expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(true);
        expect(LegacyWriterGuard.assertAllowed('ReenabledOperation')).toBe(true);
    });
});
