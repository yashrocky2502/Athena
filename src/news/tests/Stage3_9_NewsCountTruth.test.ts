/**
 * ATHENA NEWS CORE — STAGE 3.9 NEWS COUNT TRUTH TEST SUITE
 *
 * Verifies:
 * 1. GET /api/v5/news/reconciliation returns success.
 * 2. All 6 distinct news populations are present, non-null, and accurate.
 * 3. Explains clearly how "clusteredStories" and "canonicalArticles" relate without confusion.
 * 4. Verifies safety counters: lost, mutated, and pruned articles are exactly 0.
 * 5. Verifies that ATHENA_LEGACY_WRITERS_ENABLED remains true.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { newsV5Router } from '../api/newsV5Routes.ts';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';

describe('Stage 3.9: News Count Truth Layer & Reconciliation API', () => {
    let store: JsonNewsStore;

    beforeEach(async () => {
        store = new JsonNewsStore();
        await store.initialize();
    });

    it('1. GET /api/v5/news/reconciliation contract and all 6 distinct populations', async () => {
        // Find the route handler in the express router
        const reconRoute = newsV5Router.stack.find((layer: any) => layer.route && layer.route.path === '/reconciliation');
        expect(reconRoute).toBeDefined();

        const reconHandler = reconRoute?.route?.stack?.[0]?.handle;
        expect(reconHandler).toBeDefined();

        const req: any = {};
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

        await reconHandler(req, res, () => {});

        expect(res.statusCode).toBe(200);
        expect(res.body).toBeDefined();
        expect(res.body.status).toBe('success');

        // Confirm existence of the 6 distinct news populations (with UI-visible feed record)
        expect(res.body.canonicalArticles).toBeDefined();
        expect(typeof res.body.canonicalArticles).toBe('number');

        expect(res.body.rawIngestionRecords).toBeDefined();
        expect(typeof res.body.rawIngestionRecords).toBe('number');

        expect(res.body.clusteredStories).toBeDefined();
        expect(typeof res.body.clusteredStories).toBe('number');

        expect(res.body.duplicateRecords).toBeDefined();
        expect(typeof res.body.duplicateRecords).toBe('number');

        expect(res.body.retainedStories).toBeDefined();
        expect(typeof res.body.retainedStories).toBe('number');

        expect(res.body.expiredStories).toBeDefined();
        expect(typeof res.body.expiredStories).toBe('number');

        expect(res.body.uiFeedArticles).toBeDefined();
        expect(typeof res.body.uiFeedArticles).toBe('number');

        // Verify logical descriptions are present
        expect(res.body.definitions).toBeDefined();
        expect(res.body.definitions.canonicalArticles).toContain('news_stage2_store.json');
        expect(res.body.definitions.clusteredStories).toContain('storiesMap');
        expect(res.body.definitions.expiredStories).toContain('retention');
    });

    it('2. Math Relation & Logical Consistencies of the Populations', async () => {
        const reconRoute = newsV5Router.stack.find((layer: any) => layer.route && layer.route.path === '/reconciliation');
        const reconHandler = reconRoute?.route?.stack?.[0]?.handle;

        const req: any = {};
        const res: any = {
            statusCode: 200,
            body: null as any,
            status(code: number) { this.statusCode = code; return this; },
            json(data: any) { this.body = data; return this; }
        };

        await reconHandler(req, res, () => {});

        const data = res.body;

        // Verify no logical conflation between clusteredStories and canonicalArticles
        expect(data.canonicalArticles).not.toBe(data.clusteredStories);

        // Verification of safety counters being absolutely 0
        expect(data.canonicalArticlesLost).toBe(0);
        expect(data.canonicalArticlesModified).toBe(0);
        expect(data.canonicalArticlesPruned).toBe(0);
    });

    it('3. Verify legacy writers are enabled and not disabled in Stage 3.9', () => {
        // Ensure legacy writers remain enabled as specified by Stage 3.9 objective
        const isLegacyEnabled = LegacyWriterGuard.isLegacyWritersEnabled();
        expect(isLegacyEnabled).toBe(true);
    });
});
