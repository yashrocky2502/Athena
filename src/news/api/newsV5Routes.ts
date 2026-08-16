import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { IngestionPipeline } from '../ingestion/IngestionPipeline.ts';
import { CollectorAdapter } from '../ingestion/CollectorAdapter.ts';
import { CollectorRegistry } from '../../newsCoreV2/ingestion/CollectorRegistry.ts';
import { newsShadowComparator } from '../shadow/NewsShadowComparator.ts';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard.ts';
import { newsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore.ts';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter.ts';

const router = Router();

// Shared Singleton for Stage 2 isolated storage
const stage2Store = new JsonNewsStore();
const feedService = new NewsFeedService(stage2Store);
const ingestionPipeline = new IngestionPipeline(stage2Store);

function getFileMeta(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return { exists: false, size: 0, count: 0, sha256: null };
    }
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    let count = 0;
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) count = parsed.length;
        else if (parsed && typeof parsed === 'object') {
            count = Object.keys(parsed.storiesMap || parsed.rawArticles || parsed).length;
        }
    } catch {}
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    return {
        exists: true,
        size: stat.size,
        count,
        sha256,
        lastModified: stat.mtime.toISOString()
    };
}

/**
 * GET /api/v5/news/health
 * Comprehensive diagnostic endpoint for Stage 3.4 verification.
 */
router.get('/health', async (_req: Request, res: Response) => {
    try {
        const v2Count = newsStore.getAllArticles().length;
        const v3Count = await stage2Store.count();
        const legacyWritersEnabled = LegacyWriterGuard.isLegacyWritersEnabled();
        const v3Enabled = process.env.VITE_NEWS_CORE_V3_ENABLED === 'true';
        const shadowModeEnabled = newsShadowComparator.isEnabled();
        const canaryStatus = newsCanaryRouter.getStatus();

        const datasets = {
            v2Store: getFileMeta(path.join(process.cwd(), 'data', 'news_core_v2.json')),
            v2Backup: getFileMeta(path.join(process.cwd(), 'data', 'news_core_v2.json.bak')),
            v3NewsStore: getFileMeta(path.join(process.cwd(), 'data', 'v3_news_store.json')),
            intelligenceV2: getFileMeta(path.join(process.cwd(), 'data', 'news_intelligence_v2.json')),
            stage2Store: getFileMeta(path.join(process.cwd(), 'data', 'news_stage2_store.json')),
            stage2Backup: getFileMeta(path.join(process.cwd(), 'data', 'news_stage2_store.json.bak'))
        };

        res.json({
            status: 'success',
            version: 'V5-STAGE3.4-DIAGNOSTICS',
            timestamp: new Date().toISOString(),
            legacyWritersEnabled,
            v3Enabled,
            shadowModeEnabled,
            canary: canaryStatus,
            v2StoreAvailable: datasets.v2Store.exists && v2Count > 0,
            v3StoreAvailable: datasets.stage2Store.exists,
            legacySchedulerStatus: legacyWritersEnabled ? 'ACTIVE' : 'ISOLATED',
            newNewsCoreStatus: 'ACTIVE',
            activeCounts: {
                v2LoadedInMemory: v2Count,
                v3StoredCount: v3Count
            },
            datasets
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/isolation/status
 */
router.get('/isolation/status', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        isolation: LegacyWriterGuard.getStatus()
    });
});

/**
 * POST /api/v5/news/isolation/toggle
 * Runtime toggle for testing legacy writer isolation without restart.
 */
router.post('/isolation/toggle', (req: Request, res: Response) => {
    const targetState = req.body?.enabled !== undefined ? !!req.body.enabled : !LegacyWriterGuard.isLegacyWritersEnabled();
    LegacyWriterGuard.setLegacyWritersEnabled(targetState);
    res.json({
        status: 'success',
        isolation: LegacyWriterGuard.getStatus()
    });
});

/**
 * GET /api/v5/news/canary/status
 */
router.get('/canary/status', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        canary: newsCanaryRouter.getStatus()
    });
});

/**
 * POST /api/v5/news/canary/config
 */
router.post('/canary/config', (req: Request, res: Response) => {
    if (req.body?.enabled !== undefined) {
        newsCanaryRouter.setEnabled(!!req.body.enabled);
    }
    if (req.body?.percentage !== undefined) {
        newsCanaryRouter.setPercentage(parseInt(req.body.percentage, 10) || 0);
    }
    res.json({
        status: 'success',
        canary: newsCanaryRouter.getStatus()
    });
});

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

        // Evaluate Canary Decision
        const canaryDecision = newsCanaryRouter.shouldRouteToCanary(req);

        // If canary says use V2 (control group, disabled, or override)
        if (!canaryDecision.useCanary) {
            const allArticles = newsStore.getAllArticles();
            let filtered = allArticles;
            if (category && category.toLowerCase() !== 'all') {
                const lowerCat = category.toLowerCase();
                if (lowerCat === 'f&o' || lowerCat === 'fno') {
                    filtered = newsStore.getFNOArticles();
                } else {
                    filtered = allArticles.filter(a => (a.primaryCategory || a.category || '').toLowerCase() === lowerCat);
                }
            }
            if (symbol && symbol.trim().length > 0) {
                const symUpper = symbol.trim().toUpperCase();
                filtered = filtered.filter(a => ((a as any).symbol || '').toUpperCase() === symUpper);
            }
            const totalCount = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / limit));
            const startIndex = (page - 1) * limit;
            const paginated = (page >= 1 && page <= totalPages && startIndex < totalCount) ? filtered.slice(startIndex, startIndex + limit) : [];
            const uiArticles = NewsCoreV2UIAdapter.adaptMany(paginated);

            return res.json({
                status: 'success',
                version: 'V4-CONTROL-OVERRIDE',
                canaryRouted: false,
                canaryReason: canaryDecision.reason,
                articles: uiArticles,
                totalCount,
                page,
                limit,
                totalPages
            });
        }

        try {
            const feedResult = await feedService.getFeed({
                category,
                symbol,
                page,
                limit,
                sort
            });

            res.setHeader('x-news-canary-routed', 'true');
            res.setHeader('x-news-canary-reason', canaryDecision.reason);

            res.json({
                status: 'success',
                version: 'V5-STAGE2',
                canaryRouted: true,
                canaryReason: canaryDecision.reason,
                ...feedResult
            });
        } catch (canaryErr: any) {
            console.warn('[NewsV5] V3 Feed failed, falling back to V2:', canaryErr.message);
            const allArticles = newsStore.getAllArticles();
            let filtered = allArticles;
            if (category && category.toLowerCase() !== 'all') {
                const lowerCat = category.toLowerCase();
                if (lowerCat === 'f&o' || lowerCat === 'fno') {
                    filtered = newsStore.getFNOArticles();
                } else {
                    filtered = allArticles.filter(a => (a.primaryCategory || a.category || '').toLowerCase() === lowerCat);
                }
            }
            if (symbol && symbol.trim().length > 0) {
                const symUpper = symbol.trim().toUpperCase();
                filtered = filtered.filter(a => ((a as any).symbol || '').toUpperCase() === symUpper);
            }
            const totalCount = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / limit));
            const startIndex = (page - 1) * limit;
            const paginated = (page >= 1 && page <= totalPages && startIndex < totalCount) ? filtered.slice(startIndex, startIndex + limit) : [];
            const uiArticles = NewsCoreV2UIAdapter.adaptMany(paginated);

            return res.json({
                status: 'success',
                version: 'V5-V2-FALLBACK',
                canaryRouted: false,
                canaryReason: `FALLBACK_${canaryErr.message}`,
                articles: uiArticles,
                totalCount,
                page,
                limit,
                totalPages
            });
        }
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
 * GET /api/v5/news/shadow/status
 * Exposes real-time V2/V3 shadow mode metrics, latency, and comparison history.
 */
router.get('/shadow/status', async (_req: Request, res: Response) => {
    try {
        const metrics = newsShadowComparator.getMetrics();
        const recent = newsShadowComparator.getRecentComparisons(15);
        res.json({
            status: 'success',
            version: 'V5-SHADOW-V2',
            metrics,
            recentComparisons: recent
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/shadow/toggle
 * Runtime toggle for shadow comparison without restarting server.
 */
router.post('/shadow/toggle', async (req: Request, res: Response) => {
    try {
        const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : !newsShadowComparator.isEnabled();
        newsShadowComparator.setEnabled(enabled);
        res.json({
            status: 'success',
            shadowModeEnabled: newsShadowComparator.isEnabled(),
            metrics: newsShadowComparator.getMetrics()
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
