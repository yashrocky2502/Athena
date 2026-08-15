import { Router, Request, Response } from 'express';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { IngestionPipeline } from '../ingestion/IngestionPipeline.ts';
import { CollectorAdapter } from '../ingestion/CollectorAdapter.ts';
import { CollectorRegistry } from '../../newsCoreV2/ingestion/CollectorRegistry.ts';

const router = Router();

// Shared Singleton for Stage 2 isolated storage
const stage2Store = new JsonNewsStore();
const feedService = new NewsFeedService(stage2Store);
const ingestionPipeline = new IngestionPipeline(stage2Store);

/**
 * GET /api/v5/news/feed
 * Paginated, category-filtered, symbol-filtered, read-only feed.
 * NEVER mutates persistence.
 */
router.get('/feed', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
        const category = (req.query.category as string) || 'All';
        const symbol = (req.query.symbol as string) || undefined;
        const sort = (req.query.sort as 'latest' | 'relevance') || 'latest';

        const feedResult = await feedService.getFeed({
            category,
            symbol,
            page,
            limit,
            sort
        });

        res.json({
            status: 'success',
            version: 'V5-STAGE2',
            ...feedResult
        });
    } catch (err: any) {
        console.error('[NewsV5] Feed error:', err);
        res.status(500).json({
            status: 'error',
            message: err.message || 'Failed to retrieve news feed'
        });
    }
});

/**
 * GET /api/v5/news/status
 * Diagnostic status for the Stage 2 parallel store.
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const count = await stage2Store.count();
        res.json({
            status: 'success',
            version: 'V5-STAGE2',
            articleCount: count,
            storageType: 'JsonNewsStore',
            isolatedStore: 'data/news_stage2_store.json'
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/sync
 * Triggers a real collector ingest run into the isolated Stage 2 store ONLY.
 * Does NOT touch data/news_core_v2.json or data/v3_news_store.json.
 */
router.post('/sync', async (req: Request, res: Response) => {
    try {
        const collectorRegistry = new CollectorRegistry();
        const rawItems = await collectorRegistry.collectAll();
        const adaptedPayloads = CollectorAdapter.adaptList(rawItems);

        const ingestResult = await ingestionPipeline.ingest(adaptedPayloads, 'ProductionCollectorSync');
        const currentCount = await stage2Store.count();

        res.json({
            status: 'success',
            ingestResult,
            totalStoredArticles: currentCount
        });
    } catch (err: any) {
        console.error('[NewsV5] Sync error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

export { router as newsV5Router, stage2Store, feedService, ingestionPipeline };
