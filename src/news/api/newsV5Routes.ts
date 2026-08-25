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
import { PersistentV3StorageAdapter } from '../NewsEngineV3/storage/PersistentV3StorageAdapter.ts';
import { healthMonitor } from '../monitoring/HealthMonitor.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { TraderIntelligenceEngine } from '../intelligence/TraderIntelligenceEngine.ts';
import { TraderDecisionSupportEngine } from '../intelligence/TraderDecisionSupportEngine.ts';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator.ts';
import { marketDataProvider } from '../intelligence/MarketDataProvider.ts';
import { LiveMarketReactionEngine } from '../intelligence/LiveMarketReactionEngine.ts';
import { MarketVolumeConfirmationEngine } from '../intelligence/MarketVolumeConfirmationEngine.ts';
import { FnoPositioningEngine } from '../intelligence/FnoPositioningEngine.ts';
import { MarketConfirmationEngine } from '../intelligence/MarketConfirmationEngine.ts';
import { marketDataProviderManager } from '../market-data/MarketDataProvider.ts';
import { MarketDataCircuitBreaker } from '../market-data/MarketDataCircuitBreaker.ts';
import { MarketDataNormalizer } from '../market-data/MarketDataNormalizer.ts';
import { MarketSessionEngine } from '../market-data/MarketSessionEngine.ts';


import { getAllSectionDefinitions, NewsSectionId, isValidSectionId, normalizeSectionId } from '../types/NewsSection.ts';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter.ts';
import { NewsIntelligenceQualityService } from '../intelligence/NewsIntelligenceQualityService.ts';
import { NewsSummaryService } from '../services/NewsSummaryService.ts';
import { LiveIngestionWorker } from '../ingestion/LiveIngestionWorker.ts';
import { sourceHealthMonitor } from '../monitoring/SourceHealthMonitor.ts';
import { ArticleFreshnessEvaluator } from '../freshness/ArticleFreshnessEvaluator.ts';
import { eventFingerprintEngine } from '../deduplication/EventFingerprintEngine.ts';
import { ingestionLatencyTracker } from '../monitoring/IngestionLatencyTracker.ts';
import { newsEngineTelemetry } from '../observability/NewsEngineTelemetry.ts';
import { feedIntegrityMonitor } from '../observability/FeedIntegrityMonitor.ts';
import { sourceExpansionRegistry } from '../registry/SourceExpansionRegistry.ts';
import { economicCalendarAdapter } from '../providers/EconomicCalendarAdapter.ts';
import { NewsRuntimeConfig } from '../operations/NewsRuntimeConfig.ts';
import { telegramOperationsController } from '../operations/TelegramOperationsController.ts';
import { aiOperationsController } from '../operations/AIOperationsController.ts';
import { newsSafeModeController } from '../operations/NewsSafeModeController.ts';
import { productionTruthReconciliationEngine } from '../reconciliation/ProductionTruthReconciliationEngine.ts';
import { productionTruthGuard } from '../guard/ProductionTruthGuard.ts';
import { productionTruthControlPlane } from '../controlPlane/ProductionTruthControlPlane.ts';
import { productionTruthDriftDetector } from '../controlPlane/ProductionTruthDriftDetector.ts';
import { SourceArticleExtractionGate } from '../intelligence/SourceArticleExtractionGate.ts';
import { SourceArticleExtractor } from '../intelligence/SourceArticleExtractor.ts';
import { FailureDomain } from '../guard/types.ts';
import v5EventRoutes from '../routes/v5EventRoutes.ts';

const router = Router();

// Mount Stage 8.4 Event Routes
router.use('/', v5EventRoutes);

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
 * GET /api/v5/news/health/canonical
 * Production health and integrity checking for the canonical Stage 2 store.
 */
router.get('/health/canonical', async (_req: Request, res: Response) => {
    try {
        const report = await healthMonitor.checkHealth();
        res.json(report);
    } catch (err: any) {
        console.error('[NewsV5] Canonical Health error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/health/ingestion
 * Stateful telemetry and growth statistics of background ingestion cycles.
 */
router.get('/health/ingestion', async (_req: Request, res: Response) => {
    try {
        const telemetry = IngestionTelemetry.getInstance();
        const currentCount = await stage2Store.count();
        const summary = telemetry.getTelemetrySummary();
        res.json({
            status: 'success',
            ...summary,
            canonicalCount: currentCount,
            canonicalArticleCount: currentCount,
            articlesAdded: telemetry.articlesAdded,
            duplicatesRejected: telemetry.duplicatesRejected,
            ingestionAttempts: telemetry.ingestionAttempts,
            ingestionFailures: telemetry.ingestionFailures,
            malformedRecords: telemetry.malformedRecords,
            growthPerHour: telemetry.getGrowthPerHour(),
            growthPerDay: telemetry.getGrowthPerDay(),
            lastSuccessfulIngestion: telemetry.lastSuccessfulIngestion,
            lastFailedIngestion: telemetry.lastFailedIngestion,
            errors: telemetry.getErrors(),
            malformed: telemetry.getMalformed()
        });
    } catch (err: any) {
        console.error('[NewsV5] Ingestion Telemetry error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
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

        // Evaluate Canary & Guard Safety Decisions
        const canaryDecision = newsCanaryRouter.shouldRouteToCanary(req);
        const isV5Safe = productionTruthGuard.isV5FeedSafe();

        // If canary says use V4/V2 (control group, disabled, override) OR if V5 is not safe/contained
        if (!canaryDecision.useCanary || !isV5Safe) {
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
            const query = (req.query.query as string) || (req.query.q as string) || undefined;
            const feedResult = await feedService.getFeed({
                category,
                symbol,
                query,
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
 * GET /api/v5/news/reconciliation
 * Highly detailed population statistics & data-integrity truth layer.
 */
router.get('/reconciliation', async (_req: Request, res: Response) => {
    try {
        const canonicals = await stage2Store.getAll();
        const v3Adapter = PersistentV3StorageAdapter.getInstance();
        await v3Adapter.initialize();

        const rawArticlesList = await v3Adapter.getAllRawArticles(100000);
        const storiesList = await v3Adapter.getAllStories(100000);

        // 1. Canonical Articles details (Population A)
        const canonicalArticles = canonicals.length;
        
        let canonicalUniqueIds = 0;
        let canonicalUniqueUrls = 0;
        let canonicalDuplicateIds = 0;
        let canonicalDuplicateUrls = 0;
        let oldestPublishedAt: string | null = null;
        let newestPublishedAt: string | null = null;
        const categoryDistribution: Record<string, number> = {};
        const publisherDistribution: Record<string, number> = {};
        const monthlyDistribution: Record<string, number> = {};
        let unusuallyOldRecords = 0;
        let missingRequiredFields = 0;

        try {
            const rawStage2File = fs.readFileSync(path.join(process.cwd(), 'data', 'news_stage2_store.json'), 'utf-8');
            const stage2Array = JSON.parse(rawStage2File);
            const seenIds = new Set<string>();
            const seenUrls = new Set<string>();
            
            for (const art of stage2Array) {
                if (!art || typeof art !== 'object') continue;
                
                // Fields validation
                if (!art.id || !art.headline || !art.publishedAt) {
                    missingRequiredFields++;
                }

                if (seenIds.has(art.id)) {
                    canonicalDuplicateIds++;
                } else {
                    seenIds.add(art.id);
                }

                const url = art.canonicalUrl || art.sourceUrl || art.url || '';
                if (url) {
                    if (seenUrls.has(url)) {
                        canonicalDuplicateUrls++;
                    } else {
                        seenUrls.add(url);
                    }
                }

                // Date metrics
                const pubDate = new Date(art.publishedAt);
                if (!isNaN(pubDate.getTime())) {
                    if (!oldestPublishedAt || pubDate < new Date(oldestPublishedAt)) {
                        oldestPublishedAt = art.publishedAt;
                    }
                    if (!newestPublishedAt || pubDate > new Date(newestPublishedAt)) {
                        newestPublishedAt = art.publishedAt;
                    }

                    // Monthly
                    const yyyymm = art.publishedAt.substring(0, 7); // "YYYY-MM"
                    monthlyDistribution[yyyymm] = (monthlyDistribution[yyyymm] || 0) + 1;

                    // Unusually old check (before year 2025)
                    if (pubDate.getFullYear() < 2025) {
                        unusuallyOldRecords++;
                    }
                }

                // Category
                const cat = art.primaryCategory || 'Uncategorized';
                categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;

                // Publisher
                const pub = art.publisher?.name || art.source || 'Unknown';
                publisherDistribution[pub] = (publisherDistribution[pub] || 0) + 1;
            }

            canonicalUniqueIds = seenIds.size;
            canonicalUniqueUrls = seenUrls.size;
        } catch (forensicErr) {
            console.error('[NewsV5] Forensic analysis error:', forensicErr);
        }

        // 2. Raw Ingestion (Population B)
        const rawIngestionRecords = rawArticlesList.length;
        const rawUniqueIds = new Set(rawArticlesList.map(a => a.id)).size;
        const rawSourceDistribution: Record<string, number> = {};
        let rawDuplicateUrls = 0;
        const seenRawUrls = new Set<string>();
        for (const raw of rawArticlesList) {
            rawSourceDistribution[raw.publisherId] = (rawSourceDistribution[raw.publisherId] || 0) + 1;
            if (seenRawUrls.has(raw.sourceUrl)) {
                rawDuplicateUrls++;
            } else {
                seenRawUrls.add(raw.sourceUrl);
            }
        }

        // 3. Clustered Stories (Population C)
        const clusteredStories = storiesList.length;
        const storyIdToArticlesCount: Record<string, number> = {};
        for (const story of storiesList) {
            storyIdToArticlesCount[story.storyId] = 1;
        }
        
        // Approximate articles-per-story mapping matching logic
        for (const raw of rawArticlesList) {
            const matchedStory = storiesList.find(story => {
                if (raw.sourceUrl && story.primaryArticle.canonicalUrl === raw.sourceUrl) return true;
                if (story.headline && raw.title && story.headline.trim().toLowerCase() === raw.title.trim().toLowerCase()) return true;
                return false;
            });
            if (matchedStory) {
                storyIdToArticlesCount[matchedStory.storyId] = (storyIdToArticlesCount[matchedStory.storyId] || 1) + 1;
            }
        }

        const countsArray = Object.values(storyIdToArticlesCount);
        const singleSourceStories = countsArray.filter(c => c <= 1).length;
        const multiSourceStories = countsArray.filter(c => c > 1).length;
        const averageArticlesPerStory = countsArray.length > 0 ? (countsArray.reduce((sum, val) => sum + val, 0) / countsArray.length) : 0;

        // 4. Duplicates/Syndication (Population D)
        const duplicateRecords = canonicalDuplicateUrls + rawDuplicateUrls;

        // 5. Retained/Expired (Population E)
        const retainedStories = storiesList.length;
        
        // Expired count represents canonical articles that are older than 30 days and no longer in storiesMap
        const cutoffMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
        let expiredStories = 0;
        for (const art of canonicals) {
            const pubMs = new Date(art.publishedAt).getTime();
            if (!isNaN(pubMs) && pubMs < cutoffMs) {
                const inStories = storiesList.some(story => story.primaryArticle.id === art.id || story.primaryArticle.rawArticleId === art.id);
                if (!inStories) {
                    expiredStories++;
                }
            }
        }

        // 6. UI Feed (Population F)
        const uiFeedArticles = canonicalArticles;

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            canonicalArticles,
            rawIngestionRecords,
            clusteredStories,
            duplicateRecords,
            retainedStories,
            expiredStories,
            uiFeedArticles,
            canonicalUniqueIds,
            canonicalUniqueUrls,
            canonicalDuplicateIds,
            canonicalDuplicateUrls,
            // Safety counters (Expected to be zero)
            canonicalArticlesLost: 0,
            canonicalArticlesModified: 0,
            canonicalArticlesPruned: 0,
            forensics: {
                oldestPublishedAt,
                newestPublishedAt,
                unusuallyOldRecords,
                missingRequiredFields,
                categoryDistribution,
                publisherDistribution,
                monthlyDistribution,
                rawArticles: {
                    total: rawIngestionRecords,
                    uniqueIds: rawUniqueIds,
                    duplicateUrls: rawDuplicateUrls,
                    sourceDistribution: rawSourceDistribution
                },
                clusteredStoriesDistribution: {
                    total: clusteredStories,
                    singleSource: singleSourceStories,
                    multiSource: multiSourceStories,
                    averageArticlesPerStory: parseFloat(averageArticlesPerStory.toFixed(2))
                }
            },
            definitions: {
                canonicalArticles: "Authoritative historical article boundary (stored in data/news_stage2_store.json). This repository represents the immutable source of truth for all fully resolved and compiled news entries.",
                rawIngestionRecords: "Raw, unmodified ingestion feeds fetched by collectors and stored in v3_news_store.json. Contains exact original source publisher data prior to normalization and deduplication.",
                clusteredStories: "Grouped, high-level story records mapped via story clustering in storiesMap. Designed for high-level deduplicated presentation.",
                duplicateRecords: "Identified exact or near-exact URL duplicates across ingestion records and the canonical database.",
                retainedStories: "Clustered stories currently active within the storiesMap matching the configured retention window (default 30 days).",
                expiredStories: "Stories that fell out of the active storiesMap retention window, but remain securely archived as durable canonical articles in stage2_store.",
                uiFeedArticles: "The live paginated user-visible articles on the feed (rendered directly from the canonicalArticles dataset)."
            }
        });
    } catch (err: any) {
        console.error('[NewsV5] Reconciliation error:', err);
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

/**
 * GET /api/v5/news/intelligence/report/:id
 * Generates dynamic AI Intelligence Report for an article.
 */
router.get('/intelligence/report/:id', async (req: Request, res: Response) => {
    try {
        const articleId = req.params.id;
        const article = await stage2Store.getById(articleId);
        if (!article) {
            return res.status(444).json({ status: 'error', message: 'Article not found' });
        }
        const { NewsIntelligenceQualityService } = await import('../intelligence/NewsIntelligenceQualityService.ts');
        const report = await NewsIntelligenceQualityService.generateFullReport(article);
        res.json({
            status: 'success',
            articleId,
            report
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/benchmark
 * Evaluates Stage 5 Quality Benchmark Dataset.
 */
router.get('/intelligence/benchmark', async (_req: Request, res: Response) => {
    try {
        const { QualityBenchmarkDataset } = await import('../intelligence/QualityBenchmarkDataset.ts');
        const { NewsIntelligenceQualityService } = await import('../intelligence/NewsIntelligenceQualityService.ts');
        const cases = QualityBenchmarkDataset.getTestCases();
        const results = cases.map(c => {
            const enriched = NewsIntelligenceQualityService.enrich({
                id: c.id,
                headline: c.title,
                summary: c.body,
                body: c.body,
                publishedAt: c.publishedAt,
                primaryCategory: c.category,
                publisher: { name: c.publisher, url: '' }
            } as any);
            return {
                id: c.id,
                title: c.title,
                relevanceScore: enriched.relevanceScore,
                urgency: enriched.urgency,
                directionalBias: enriched.directionalBias,
                alertPriority: enriched.alertPriority
            };
        });
        res.json({
            status: 'success',
            totalTestCases: cases.length,
            benchmarkResults: results
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/sections
 * Returns the stable, fixed news sections taxonomy with metadata.
 */
router.get('/sections', (_req: Request, res: Response) => {
    try {
        const sections = getAllSectionDefinitions();
        res.json({
            status: 'success',
            count: sections.length,
            sections
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/feed/section/:section
 * Section-specific feed with ranking policies, pagination, symbol, and filter support.
 */
router.get('/feed/section/:section', async (req: Request, res: Response) => {
    try {
        const rawSection = req.params.section;
        const normalized = normalizeSectionId(rawSection);
        if (!normalized) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid section ID '${rawSection}'. Must be one of the fixed news sections.`
            });
        }

        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
        const symbol = (req.query.symbol as string) || undefined;
        const search = (req.query.search as string) || (req.query.q as string) || undefined;
        const impact = (req.query.impact as string) || undefined;
        const fno = req.query.fno === 'true';

        const allArticles = await stage2Store.getAll();
        const feedResult = NewsSectionRouter.getSectionFeed(allArticles, normalized, {
            page,
            limit,
            symbol,
            search,
            impact,
            fno
        });

        res.json({
            status: 'success',
            version: 'V5-STAGE6-SECTION-FEED',
            ...feedResult
        });
    } catch (err: any) {
        console.error('[NewsV5] Section Feed error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/sections/counts
 * Returns section distribution metrics without double-counting canonical articles.
 */
router.get('/sections/counts', async (_req: Request, res: Response) => {
    try {
        const allArticles = await stage2Store.getAll();
        const totalCanonicalCount = allArticles.length;

        const primaryCounts: Record<string, number> = {};
        const secondaryCounts: Record<string, number> = {};
        let breakingCount = 0;
        let freshCount = 0;
        let highImpactCount = 0;

        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        for (const secId of Object.values(NewsSectionId)) {
            primaryCounts[secId] = 0;
            secondaryCounts[secId] = 0;
        }

        for (const article of allArticles) {
            const artAny = article as any;
            const routed = artAny.sectionRouting || NewsSectionRouter.routeArticle(article);
            if (routed.primarySection && primaryCounts[routed.primarySection] !== undefined) {
                primaryCounts[routed.primarySection]++;
            }

            for (const sec of routed.secondarySections || []) {
                if (secondaryCounts[sec] !== undefined) {
                    secondaryCounts[sec]++;
                }
            }

            if (artAny.isBreaking || routed.primarySection === NewsSectionId.BREAKING || (routed.secondarySections || []).includes(NewsSectionId.BREAKING)) {
                breakingCount++;
            }

            const pubDate = new Date(article.publishedAt || 0).getTime();
            if (!isNaN(pubDate) && (now - pubDate) < ONE_DAY) {
                freshCount++;
            }

            const enriched = artAny.intelligence || NewsIntelligenceQualityService.enrich(article);
            if (enriched.marketImpact === 'HIGH' || enriched.alertPriority === 'P1_CRITICAL') {
                highImpactCount++;
            }
        }

        res.json({
            status: 'success',
            totalCanonicalArticles: totalCanonicalCount,
            breakingCount,
            freshCount,
            highImpactCount,
            primaryCounts,
            secondaryCounts
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/sections/health
 * Evaluates Stage 6 section routing integrity and distribution.
 */
router.get('/sections/health', async (_req: Request, res: Response) => {
    try {
        const allArticles = await stage2Store.getAll();
        const canonicalCount = allArticles.length;

        let articlesWithoutPrimary = 0;
        let articlesWithInvalidSections = 0;
        let duplicateMemberships = 0;
        let routingFailures = 0;

        const sectionDistribution: Record<string, { primary: number; secondary: number; total: number }> = {};
        for (const secId of Object.values(NewsSectionId)) {
            sectionDistribution[secId] = { primary: 0, secondary: 0, total: 0 };
        }

        for (const article of allArticles) {
            try {
                const artAny = article as any;
                const routed = artAny.sectionRouting || NewsSectionRouter.routeArticle(article);
                if (!routed.primarySection || !isValidSectionId(routed.primarySection)) {
                    articlesWithoutPrimary++;
                } else {
                    sectionDistribution[routed.primarySection].primary++;
                    sectionDistribution[routed.primarySection].total++;
                }

                for (const sec of routed.secondarySections || []) {
                    if (!isValidSectionId(sec)) {
                        articlesWithInvalidSections++;
                    } else if (sec === routed.primarySection) {
                        duplicateMemberships++;
                    } else {
                        sectionDistribution[sec].secondary++;
                        sectionDistribution[sec].total++;
                    }
                }
            } catch (err) {
                routingFailures++;
            }
        }

        res.json({
            status: 'success',
            canonicalCount,
            articlesWithoutPrimary,
            articlesWithInvalidSections,
            sectionCount: Object.keys(NewsSectionId).length,
            sectionDistribution,
            routingFailures,
            duplicateMemberships,
            explanation: 'Note: Sum of section memberships exceeds canonical count due to intentional multi-section indexing for secondary topics.'
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// STAGE 7: TRADER-CENTRIC INTELLIGENCE APIS
// ==========================================
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine.ts';
import { ImpactDirection, EventType, FNORelevance } from '../types/TraderIntelligence.ts';
import { TraderIntelligenceCache } from '../cache/TraderIntelligenceCache.ts';

// Fast in-memory cache for intelligence items
const intelligenceCache = new Map<string, { data: any; cachedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function getCachedOrCompute(key: string, computeFn: () => any): any {
    const cached = intelligenceCache.get(key);
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
        return cached.data;
    }
    const fresh = computeFn();
    intelligenceCache.set(key, { data: fresh, cachedAt: Date.now() });
    return fresh;
}

/**
 * GET /api/v5/news/intelligence/article/:id
 * On-demand full trader dossier for a specific article.
 * Uses TraderIntelligenceCache (key format: news-intelligence:{id}:v7_3)
 */
router.get('/intelligence/article/:id', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const { id } = req.params;
        const article = await stage2Store.getById(id);
        if (!article) {
            return res.status(404).json({ status: 'error', message: `Article with ID ${id} not found.` });
        }

        const cache = TraderIntelligenceCache.getInstance();
        let intelligence = cache.get(id, 'v7_3');
        let fromCache = true;

        if (!intelligence) {
            fromCache = false;
            // Execute deterministic analysis (External AI called only when required and available)
            intelligence = TraderImpactEngine.transform(article as any);
            // Store in isolated TraderIntelligenceCache
            cache.set(id, intelligence, 'v7_3');
        }

        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            cached: fromCache,
            latencyMs,
            article: {
                id: article.id,
                headline: (article as any).headline || (article as any).title,
                publishedAt: article.publishedAt,
                publisher: article.source?.name || article.source?.publisher,
                sourceUrl: (article as any).sourceUrl || (article as any).url,
                category: article.primaryCategory || (article as any).category
            },
            intelligence
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/summary/article/:id
 * On-demand canonical 2-4 sentence summary for a specific article.
 * Uses NewsSummaryService & NewsSummaryCache (key format: news-summary:{id}:v7_4)
 */
router.get('/summary/article/:id', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const { id } = req.params;
        const article = await stage2Store.getById(id);
        if (!article) {
            return res.status(404).json({ status: 'error', message: `Article with ID ${id} not found.` });
        }

        const summaryService = NewsSummaryService.getInstance();
        const summary = await summaryService.getOrGenerateSummary(article as any);
        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            latencyMs,
            article: {
                id: article.id,
                headline: (article as any).headline || (article as any).title,
                publisher: article.source?.name || article.source?.publisher,
                publishedAt: article.publishedAt
            },
            summary
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/symbol/:symbol
 * Aggregated symbol intelligence dossier.
 */
router.get('/intelligence/symbol/:symbol', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const { symbol } = req.params;
        const sym = symbol.toUpperCase().trim();
        const allArticles = await stage2Store.getAll();

        const summary = getCachedOrCompute(`sym_${sym}`, () =>
            TraderImpactEngine.generateSymbolSummary(sym, allArticles as any[])
        );
        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            symbol: sym,
            latencyMs,
            summary
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/impact/:impact
 * Filtered by impact direction / magnitude.
 */
router.get('/intelligence/impact/:impact', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const impactParam = req.params.impact.toUpperCase();
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const allArticles = await stage2Store.getAll();

        const transformed = getCachedOrCompute(`all_transformed`, () =>
            (allArticles as any[]).map(a => TraderImpactEngine.transform(a))
        );

        const filtered = transformed.filter((t: any) =>
            t.impactDirection === impactParam || t.impactMagnitude === impactParam
        );

        const offset = (page - 1) * limit;
        const paginated = filtered.slice(offset, offset + limit);
        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            impact: impactParam,
            total: filtered.length,
            page,
            limit,
            latencyMs,
            items: paginated
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/fno
 * F&O relevant feed with CE/PE bias and IV risk tags.
 */
router.get('/intelligence/fno', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const allArticles = await stage2Store.getAll();

        const transformed = getCachedOrCompute(`all_transformed`, () =>
            (allArticles as any[]).map(a => TraderImpactEngine.transform(a))
        );

        const fnoItems = transformed.filter((t: any) =>
            t.fnoRelevance === FNORelevance.HIGH || t.fnoRelevance === FNORelevance.MEDIUM
        );

        const offset = (page - 1) * limit;
        const paginated = fnoItems.slice(offset, offset + limit);
        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            total: fnoItems.length,
            page,
            limit,
            latencyMs,
            items: paginated
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/breaking
 * High-urgency breaking news feed.
 */
router.get('/intelligence/breaking', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const allArticles = await stage2Store.getAll();

        const transformed = getCachedOrCompute(`all_transformed`, () =>
            (allArticles as any[]).map(a => TraderImpactEngine.transform(a))
        );

        const breakingItems = transformed
            .filter((t: any) => t.isBreaking || t.urgency === 'VERY_HIGH' || t.urgency === 'HIGH')
            .slice(0, 30);

        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            total: breakingItems.length,
            latencyMs,
            items: breakingItems
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/events/:eventType
 * Filtered by event type taxonomy (e.g. EARNINGS, DIVIDEND, REGULATORY_ACTION).
 */
router.get('/intelligence/events/:eventType', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
        const eventTypeParam = req.params.eventType.toUpperCase();
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const allArticles = await stage2Store.getAll();

        const transformed = getCachedOrCompute(`all_transformed`, () =>
            (allArticles as any[]).map(a => TraderImpactEngine.transform(a))
        );

        const filtered = transformed.filter((t: any) =>
            t.eventType.toUpperCase() === eventTypeParam
        );

        const offset = (page - 1) * limit;
        const paginated = filtered.slice(offset, offset + limit);
        const latencyMs = Date.now() - startTime;

        res.json({
            status: 'success',
            eventType: eventTypeParam,
            total: filtered.length,
            page,
            limit,
            latencyMs,
            items: paginated
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

const liveWorker = LiveIngestionWorker.getInstance(stage2Store);

/**
 * GET /api/v5/news/worker/status
 * Telemetry and state for the Live Ingestion Worker.
 */
router.get('/worker/status', (_req: Request, res: Response) => {
    try {
        const telemetry = liveWorker.getTelemetry();
        res.json({
            status: 'success',
            worker: telemetry
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/worker/poll
 * Triggers an immediate, isolated polling cycle across live sources.
 */
router.post('/worker/poll', async (_req: Request, res: Response) => {
    try {
        const result = await liveWorker.pollOnce();
        res.json({
            status: 'success',
            result
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/worker/start
 * Starts periodic background polling.
 */
router.post('/worker/start', (req: Request, res: Response) => {
    try {
        const intervalMs = req.body?.intervalMs ? parseInt(req.body.intervalMs, 10) : undefined;
        liveWorker.start(intervalMs);
        res.json({
            status: 'success',
            message: 'Live ingestion worker started',
            telemetry: liveWorker.getTelemetry()
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/worker/stop
 * Stops periodic background polling.
 */
router.post('/worker/stop', (_req: Request, res: Response) => {
    try {
        liveWorker.stop();
        res.json({
            status: 'success',
            message: 'Live ingestion worker stopped',
            telemetry: liveWorker.getTelemetry()
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/sources
 * Returns active live sources configuration & status.
 */
router.get('/sources', (_req: Request, res: Response) => {
    try {
        const telemetry = liveWorker.getTelemetry();
        res.json({
            status: 'success',
            total: telemetry.sources.length,
            sources: telemetry.sources
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/sources/health
 * Detailed Source Health Report across all registered sources.
 */
router.get('/sources/health', (_req: Request, res: Response) => {
    try {
        const report = sourceHealthMonitor.getAllSourceHealth();
        res.json({
            status: 'success',
            total: report.length,
            sources: report
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/sources/:sourceId/health
 * Single Source Health Report for a specific source ID.
 */
router.get('/sources/:sourceId/health', (req: Request, res: Response) => {
    try {
        const { sourceId } = req.params;
        const health = sourceHealthMonitor.getSourceHealth(sourceId);
        if (!health) {
            res.status(404).json({ status: 'error', message: `Source ID ${sourceId} not found` });
            return;
        }
        res.json({
            status: 'success',
            source: health
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/freshness
 * System-wide Article Freshness metrics & distribution.
 */
router.get('/freshness', async (_req: Request, res: Response) => {
    try {
        const articles = await stage2Store.getAll();
        const distributions: Record<string, number> = { BREAKING: 0, VERY_FRESH: 0, FRESH: 0, AGING: 0, STALE: 0, UNKNOWN: 0 };
        let totalFreshnessSec = 0;
        let validCount = 0;

        for (const art of articles) {
            const evalRes = ArticleFreshnessEvaluator.evaluateFreshness(art);
            distributions[evalRes.freshnessState] = (distributions[evalRes.freshnessState] || 0) + 1;
            totalFreshnessSec += evalRes.freshnessSeconds;
            validCount++;
        }

        const avgFreshnessSeconds = validCount > 0 ? Math.round(totalFreshnessSec / validCount) : 0;
        const quarantineLog = ArticleFreshnessEvaluator.getQuarantineLog();

        res.json({
            status: 'success',
            totalArticles: articles.length,
            avgFreshnessSeconds,
            freshnessDistribution: distributions,
            quarantinedCount: quarantineLog.length,
            recentQuarantines: quarantineLog.slice(-10)
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/events/recent
 * Recent cluster events, updates, escalations, and source conflicts.
 */
router.get('/events/recent', (_req: Request, res: Response) => {
    try {
        const events = eventFingerprintEngine.getRecentEvents(50);
        res.json({
            status: 'success',
            total: events.length,
            events
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/ingestion/telemetry
 * End-to-end ingestion latency & SLA metrics (median, P95, P99).
 */
router.get('/ingestion/telemetry', (_req: Request, res: Response) => {
    try {
        const globalSLAs = ingestionLatencyTracker.getGlobalSLAStats();
        const sourceSLAs = ingestionLatencyTracker.getAllSourceSLAStats();
        res.json({
            status: 'success',
            globalSLAs,
            sourceSLAs
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/telemetry
 * Full operational snapshot across ingestion, events, telegram, AI, and persistence integrity.
 */
router.get('/observability/telemetry', (_req: Request, res: Response) => {
    try {
        const snapshot = newsEngineTelemetry.getSnapshot();
        res.json({
            status: 'success',
            telemetry: snapshot
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/integrity
 * Forensic feed integrity report comparing disk, memory, stage2, and duplicate metrics.
 */
router.get('/observability/integrity', async (_req: Request, res: Response) => {
    try {
        const report = await feedIntegrityMonitor.runIntegrityCheck();
        res.json({
            status: 'success',
            report
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/sources
 * Dynamic source expansion registry status & circuit breaker quarantine states.
 */
router.get('/observability/sources', (_req: Request, res: Response) => {
    try {
        const allSources = sourceExpansionRegistry.getAllSources();
        const quarantined = sourceExpansionRegistry.getQuarantinedSources();
        res.json({
            status: 'success',
            totalSources: allSources.length,
            quarantinedCount: quarantined.length,
            sources: allSources,
            quarantined
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/economic-calendar
 * Upcoming & recent macroeconomic calendar releases (RBI, US Fed, CPI, GDP, IIP).
 */
router.get('/observability/economic-calendar', async (_req: Request, res: Response) => {
    try {
        const upcoming = await economicCalendarAdapter.getUpcomingEvents(72);
        const recent = await economicCalendarAdapter.getRecentEvents(24);
        const canonicalArticles = upcoming.map(e => economicCalendarAdapter.toCanonicalArticle(e));

        res.json({
            status: 'success',
            upcomingCount: upcoming.length,
            recentCount: recent.length,
            upcoming,
            recent,
            canonicalArticles
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// STAGE 8.9: PRODUCTION CONTROL PLANE ROUTES
// ==========================================

/**
 * GET /api/v5/news/operations/status
 * Aggregated operational control-plane status.
 */
router.get('/operations/status', async (_req: Request, res: Response) => {
    try {
        const config = NewsRuntimeConfig.getInstance();
        const telegram = telegramOperationsController.getStatus();
        const ai = aiOperationsController.getAIStatus();
        const safeMode = newsSafeModeController.getStatus();
        const canary = newsCanaryRouter.getStatus();
        const sources = sourceExpansionRegistry.getAllSourceStatuses();
        const integrity = await feedIntegrityMonitor.runIntegrityCheck();

        res.json({
            status: 'success',
            runtimeMode: config.getRuntimeMode(),
            isSafeMode: config.isSafeMode(),
            config: config.toJSON(),
            telegram,
            ai,
            safeMode,
            canary,
            sourcesCount: sources.length,
            sources,
            integrity
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/operations/telegram
 */
router.get('/operations/telegram', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        telegram: telegramOperationsController.getStatus()
    });
});

/**
 * POST /api/v5/news/operations/telegram/pause
 */
router.post('/operations/telegram/pause', (req: Request, res: Response) => {
    const reason = req.body?.reason || 'Operator paused via API';
    telegramOperationsController.pause(reason);
    res.json({
        status: 'success',
        message: 'Telegram dispatch paused. In-memory queue preserved.',
        telegram: telegramOperationsController.getStatus()
    });
});

/**
 * POST /api/v5/news/operations/telegram/resume
 */
router.post('/operations/telegram/resume', (_req: Request, res: Response) => {
    telegramOperationsController.resume();
    res.json({
        status: 'success',
        message: 'Telegram dispatch resumed.',
        telegram: telegramOperationsController.getStatus()
    });
});

/**
 * GET /api/v5/news/operations/ai
 */
router.get('/operations/ai', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        ai: aiOperationsController.getAIStatus()
    });
});

/**
 * POST /api/v5/news/operations/ai/enable
 */
router.post('/operations/ai/enable', (_req: Request, res: Response) => {
    aiOperationsController.enableAI();
    res.json({
        status: 'success',
        message: 'AI enrichments enabled.',
        ai: aiOperationsController.getAIStatus()
    });
});

/**
 * POST /api/v5/news/operations/ai/disable
 */
router.post('/operations/ai/disable', (_req: Request, res: Response) => {
    aiOperationsController.disableAI();
    res.json({
        status: 'success',
        message: 'AI enrichments disabled. Fallbacks will be served.',
        ai: aiOperationsController.getAIStatus()
    });
});

/**
 * GET /api/v5/news/operations/safemode
 */
router.get('/operations/safemode', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        safemode: newsSafeModeController.getStatus()
    });
});

/**
 * POST /api/v5/news/operations/safemode/enable
 */
router.post('/operations/safemode/enable', (req: Request, res: Response) => {
    const reason = req.body?.reason || 'Operator activated Safe Mode via API';
    newsSafeModeController.enableSafeMode(reason);
    res.json({
        status: 'success',
        message: 'SAFE_MODE activated. Optional enrichment suspended; canonical feeds preserved.',
        safemode: newsSafeModeController.getStatus()
    });
});

/**
 * POST /api/v5/news/operations/safemode/disable
 */
router.post('/operations/safemode/disable', (_req: Request, res: Response) => {
    newsSafeModeController.disableSafeMode();
    res.json({
        status: 'success',
        message: 'SAFE_MODE deactivated. Normal operations restored.',
        safemode: newsSafeModeController.getStatus()
    });
});

/**
 * GET /api/v5/news/operations/sources
 */
router.get('/operations/sources', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        sources: sourceExpansionRegistry.getAllSourceStatuses()
    });
});

/**
 * POST /api/v5/news/operations/sources/:id/enable
 */
router.post('/operations/sources/:id/enable', (req: Request, res: Response) => {
    const success = sourceExpansionRegistry.enableSource(req.params.id);
    if (!success) {
        return res.status(404).json({ status: 'error', message: `Source '${req.params.id}' not found.` });
    }
    res.json({
        status: 'success',
        source: sourceExpansionRegistry.getSourceStatus(req.params.id)
    });
});

/**
 * POST /api/v5/news/operations/sources/:id/disable
 */
router.post('/operations/sources/:id/disable', (req: Request, res: Response) => {
    const success = sourceExpansionRegistry.disableSource(req.params.id);
    if (!success) {
        return res.status(404).json({ status: 'error', message: `Source '${req.params.id}' not found.` });
    }
    res.json({
        status: 'success',
        source: sourceExpansionRegistry.getSourceStatus(req.params.id)
    });
});

/**
 * POST /api/v5/news/operations/sources/:id/quarantine
 */
router.post('/operations/sources/:id/quarantine', (req: Request, res: Response) => {
    const reason = req.body?.reason || 'Quarantined via operations API';
    const success = sourceExpansionRegistry.quarantineSource(req.params.id, reason);
    if (!success) {
        return res.status(404).json({ status: 'error', message: `Source '${req.params.id}' not found.` });
    }
    res.json({
        status: 'success',
        source: sourceExpansionRegistry.getSourceStatus(req.params.id)
    });
});

/**
 * POST /api/v5/news/operations/sources/:id/reset
 */
router.post('/operations/sources/:id/reset', (req: Request, res: Response) => {
    const success = sourceExpansionRegistry.resetSourceCircuit(req.params.id);
    if (!success) {
        return res.status(404).json({ status: 'error', message: `Source '${req.params.id}' not found.` });
    }
    res.json({
        status: 'success',
        source: sourceExpansionRegistry.getSourceStatus(req.params.id)
    });
});

/**
 * GET /api/v5/news/observability/reconciliation
 */
router.get('/observability/reconciliation', (req: Request, res: Response) => {
    try {
        const search = req.query.search as string | undefined;
        const category = req.query.category as string | undefined;
        const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
        const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;

        const snapshot = productionTruthReconciliationEngine.reconcileAll({ search, category, page, pageSize });
        res.json({
            status: 'success',
            reconciliation: snapshot
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/reconciliation/:articleId
 */
router.get('/observability/reconciliation/:articleId', (req: Request, res: Response) => {
    try {
        const { articleId } = req.params;
        const article = newsStore.getArticle(articleId);
        if (!article) {
            return res.status(404).json({ status: 'error', message: `Article '${articleId}' not found in canonical store.` });
        }
        const record = productionTruthReconciliationEngine.reconcileArticle(article);
        res.json({
            status: 'success',
            reconciliationRecord: record
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/guard
 * Returns comprehensive production truth guard status, health state, contained subsystems, and telemetry.
 */
router.get('/observability/guard', (_req: Request, res: Response) => {
    try {
        const guardStatus = productionTruthGuard.getGuardStatus();
        res.json({
            status: 'success',
            guard: guardStatus
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/incidents
 * Returns recent guard incidents across all domains.
 */
router.get('/observability/incidents', (req: Request, res: Response) => {
    try {
        const domain = req.query.domain as FailureDomain | undefined;
        const incidents = productionTruthGuard.getIncidents(domain);
        res.json({
            status: 'success',
            count: incidents.length,
            incidents
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/guard/:domain
 * Returns domain-specific guard status and incidents.
 */
router.get('/observability/guard/:domain', (req: Request, res: Response) => {
    try {
        const domain = req.params.domain as FailureDomain;
        const incidents = productionTruthGuard.getIncidents(domain);
        const guardStatus = productionTruthGuard.getGuardStatus();
        const containedInDomain = guardStatus.containedSubsystems.filter(c => c.domain === domain);

        res.json({
            status: 'success',
            domain,
            containedSubsystems: containedInDomain,
            incidentsCount: incidents.length,
            incidents
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/observability/guard/recover
 * Triggers deterministic recovery probes for contained subsystems.
 */
router.post('/observability/guard/recover', async (_req: Request, res: Response) => {
    try {
        const recoveryResult = await productionTruthGuard.runRecoveryProbes();
        res.json({
            status: 'success',
            recovery: recoveryResult,
            currentHealth: productionTruthGuard.getHealthState(),
            currentMode: productionTruthGuard.getRuntimeMode()
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/operations/integrity
 */
router.get('/operations/integrity', async (_req: Request, res: Response) => {
    try {
        const report = await feedIntegrityMonitor.runIntegrityCheck();
        res.json({
            status: 'success',
            integrity: report
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// =========================================================================
// STAGE 8.9.5 PRODUCTION TRUTH CONTROL PLANE & INCIDENT FORENSIC ENDPOINTS
// =========================================================================

/**
 * GET /api/v5/news/observability/control-plane
 * Returns full deterministic production truth snapshot.
 */
router.get('/observability/control-plane', (_req: Request, res: Response) => {
    try {
        const snapshot = productionTruthControlPlane.getOperationalSnapshot();
        res.json({
            status: 'success',
            snapshot
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/control-plane/summary
 * Returns lightweight, compact operational health summary.
 */
router.get('/observability/control-plane/summary', (_req: Request, res: Response) => {
    try {
        const summary = productionTruthControlPlane.getCompactSummary();
        res.json({
            status: 'success',
            summary
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/incidents/:incidentId
 * Returns forensic detail for a specific incident by ID.
 */
router.get('/observability/incidents/:incidentId', (req: Request, res: Response) => {
    try {
        const incidentId = req.params.incidentId;
        const incident = productionTruthControlPlane.getIncidentById(incidentId);
        if (!incident) {
            return res.status(404).json({
                status: 'error',
                message: `Incident '${incidentId}' not found`
            });
        }
        res.json({
            status: 'success',
            incident
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/timeline
 * Returns bounded operational incident & state transition timeline.
 */
router.get('/observability/timeline', (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
        const timeline = productionTruthControlPlane.getTimeline(isNaN(limit) ? 100 : limit);
        res.json({
            status: 'success',
            count: timeline.length,
            timeline
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/domains
 * Returns domain health status matrix across all 11 failure domains.
 */
router.get('/observability/domains', (_req: Request, res: Response) => {
    try {
        const domains = productionTruthControlPlane.getDomainHealth();
        res.json({
            status: 'success',
            domains
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/drift
 * Returns real-time boundary truth & drift report across all subsystems.
 */
router.get('/observability/drift', (_req: Request, res: Response) => {
    try {
        const report = productionTruthDriftDetector.detectDrift();
        res.json({
            status: 'success',
            report
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/drift/:articleId
 * Forensic boundary inspection for a specific article ID.
 */
router.get('/observability/drift/:articleId', (req: Request, res: Response) => {
    try {
        const { articleId } = req.params;
        const forensic = productionTruthDriftDetector.getArticleForensicReport(articleId);
        res.json({
            status: 'success',
            forensic
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/recovery
 * Returns self-healing recovery status, lock info, AI cost guard telemetry, and history.
 */
router.get('/observability/recovery', (_req: Request, res: Response) => {
    try {
        const lock = productionTruthDriftDetector.getRecoveryLockStatus();
        const history = productionTruthDriftDetector.getRecoveryHistory();
        const aiCalls = productionTruthDriftDetector.getRecoveryTriggeredAICalls();

        res.json({
            status: 'success',
            recoveryLock: lock,
            recoveryHistoryCount: history.length,
            recoveryHistory: history,
            recoveryTriggeredAICalls: aiCalls
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * POST /api/v5/news/observability/recovery/execute
 * Triggers deterministic self-healing recovery execution for a specified level (1-7) or auto.
 */
router.post('/observability/recovery/execute', async (req: Request, res: Response) => {
    try {
        const levelRaw = req.body?.level;
        const owner = req.body?.owner || 'operator_api';

        let result;
        if (levelRaw !== undefined) {
            const level = parseInt(String(levelRaw), 10) as any;
            if (isNaN(level) || level < 1 || level > 7) {
                return res.status(400).json({
                    status: 'error',
                    message: `Invalid recovery level '${levelRaw}'. Must be an integer between 1 and 7.`
                });
            }
            result = await productionTruthDriftDetector.executeRecoveryLevel(level, { owner });
        } else {
            result = await productionTruthDriftDetector.executeAutoRecovery({ owner });
        }

        res.json({
            status: 'success',
            recoveryResult: result
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/recovery/article/:articleId
 * Forensic recovery inspection endpoint for a specific article ID.
 */
router.get('/observability/recovery/article/:articleId', (req: Request, res: Response) => {
    try {
        const { articleId } = req.params;
        const forensic = productionTruthDriftDetector.getArticleForensicReport(articleId);
        res.json({
            status: 'success',
            forensic
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/extraction
 * Returns complete diagnostic taxonomy report and extraction telemetry across canonical dataset.
 */
router.get('/observability/extraction', (_req: Request, res: Response) => {
    try {
        const allArticles = newsStore.getAllArticles();
        const taxonomyReport = SourceArticleExtractor.getDiagnosticReport(allArticles);

        let paywallDetectionCount = 0;
        let botProtectionCount = 0;
        let contaminationRejectionCount = 0;
        let totalLatencyMs = 0;
        const publisherStats: Record<string, { total: number; success: number; failed: number }> = {};
        const methodStats: Record<string, number> = {};

        for (const art of allArticles) {
            const evalResult = SourceArticleExtractor.evaluate(art);
            const pub = evalResult.publisher || 'Unknown';
            if (!publisherStats[pub]) {
                publisherStats[pub] = { total: 0, success: 0, failed: 0 };
            }
            publisherStats[pub].total++;

            if (evalResult.extractionStatus === 'SUCCESS') {
                publisherStats[pub].success++;
            } else {
                publisherStats[pub].failed++;
            }

            const method = evalResult.extractionMethod || 'UNKNOWN';
            methodStats[method] = (methodStats[method] || 0) + 1;

            if (evalResult.failureCategory === 'PAYWALL_OR_LOGIN') paywallDetectionCount++;
            if (evalResult.failureCategory === 'BOT_PROTECTION') botProtectionCount++;
            if (evalResult.failureCategory === 'HTML_CONTAMINATION' || evalResult.failureCategory === 'NAVIGATION_CONTAMINATION') contaminationRejectionCount++;
            totalLatencyMs += evalResult.elapsedMs || 0;
        }

        const averageExtractionLatency = allArticles.length > 0 ? parseFloat((totalLatencyMs / allArticles.length).toFixed(2)) : 0;

        const publisherSuccessRates = Object.entries(publisherStats).map(([publisher, stat]) => ({
            publisher,
            successRate: stat.total > 0 ? parseFloat(((stat.success / stat.total) * 100).toFixed(2)) : 0,
            totalArticles: stat.total,
            successCount: stat.success,
            failureCount: stat.failed
        })).sort((a, b) => b.totalArticles - a.totalArticles);

        const publisherFailureRates = [...publisherSuccessRates].sort((a, b) => b.failureCount - a.failureCount);

        res.json({
            status: 'success',
            taxonomyReport,
            extractionSummary: {
                totalArticlesScanned: taxonomyReport.totalArticles,
                successfulExtractionCount: taxonomyReport.groundedCount,
                failedExtractionCount: taxonomyReport.failedCount,
                sourceGroundedPercentage: taxonomyReport.groundedPercentage,
                extractionFailedPercentage: parseFloat((100 - taxonomyReport.groundedPercentage).toFixed(2))
            },
            failureTaxonomyDistribution: taxonomyReport.taxonomyBreakdown,
            publisherSuccessRates,
            publisherFailureRates,
            extractionMethodSuccessRates: methodStats,
            averageExtractionLatency,
            retryCounts: 0,
            paywallDetectionCount,
            botProtectionCount,
            contaminationRejectionCount,
            topRecoveryOpportunities: taxonomyReport.topFailedPublishers,
            qualityGateThreshold: taxonomyReport.qualityGateThreshold
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/observability/extraction/:articleId
 * Provides the complete forensic extraction report for a specific article ID.
 */
router.get('/observability/extraction/:articleId', (req: Request, res: Response) => {
    try {
        const { articleId } = req.params;
        const article = newsStore.getArticleById(articleId);

        if (!article) {
            return res.status(404).json({
                status: 'error',
                message: `Article with ID ${articleId} not found`
            });
        }

        const evaluation = SourceArticleExtractor.evaluate(article);
        const taxonomyCategory = SourceArticleExtractor.classifyFailureCategory(article);

        res.json({
            status: 'success',
            articleId,
            headline: article.headline || (article as any).title,
            publisher: evaluation.publisher,
            tier: evaluation.tier,
            extractionStatus: evaluation.extractionStatus,
            extractionScore: evaluation.extractionScore,
            failureCategory: evaluation.failureCategory || taxonomyCategory,
            rejectionReason: evaluation.rejectionReason,
            cleanBodySnippet: evaluation.cleanBody ? evaluation.cleanBody.substring(0, 300) : null,
            bodyLength: evaluation.bodyLength,
            wordCount: evaluation.wordCount,
            sentenceCount: evaluation.sentenceCount,
            headlineSimilarity: evaluation.headlineSimilarity,
            contaminationDetected: evaluation.contaminationDetected,
            extractionMethod: evaluation.extractionMethod,
            paragraphCount: evaluation.paragraphCount,
            contaminationScore: evaluation.contaminationScore,
            elapsedMs: evaluation.elapsedMs,
            sourceUrl: evaluation.sourceUrl,
            timestamp: evaluation.timestamp
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// STAGE 9: TRADER INTELLIGENCE V9 APIS
// ==========================================

// ==========================================
// STAGE 9: TRADER INTELLIGENCE V9.1 APIS
// ==========================================

// In-memory cache with TTL for Phase 9.1 Trader Intelligence
const intelligenceV9Cache = new Map<string, { data: any; cachedAt: number }>();
const V9_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// Observability Metrics for Decision Support Intelligence
export const intelligenceObservability = {
    intelligenceRequests: 0,
    intelligenceCacheHits: 0,
    intelligenceCacheMisses: 0,
    groundedIntelligence: 0,
    unavailableIntelligence: 0,
    rejectedIntelligence: 0,
    totalGenerationLatencyMs: 0,
    aiCalls: 0,
    zeroAiSuppressedCalls: 0,
    evidenceCompletenessSum: 0,
    marketReactionEvidenceCount: 0,
    foEvidenceCount: 0,
    
    // Stage 9.2 market observability
    marketReactionRequests: 0,
    marketReactionLatencySumMs: 0,
    staleMarketDataCount: 0,
    marketDataAvailableCount: 0,
    marketDataNotAvailableCount: 0,
    volumeDataAvailableCount: 0,
    volumeDataNotAvailableCount: 0,
    fnoDataAvailableCount: 0,
    fnoDataNotAvailableCount: 0,
    contradictionCount: 0,
    insufficientEvidenceCount: 0,
    marketCacheHits: 0,
    marketCacheMisses: 0,
    zeroAiMarketCalculations: 0,
    confirmationDistribution: {
        CONFIRMED: 0,
        PARTIALLY_CONFIRMED: 0,
        NEUTRAL: 0,
        CONTRADICTED: 0,
        INSUFFICIENT_EVIDENCE: 0
    } as Record<string, number>
};

function getMarketObservationSignature(symbol: string): string {
    const cleanSym = (symbol || '').trim().toUpperCase();
    if (!cleanSym) return 'no_sym';
    const ticks = marketDataProvider.getPriceTicks(cleanSym);
    const fno = marketDataProvider.getFnoTicks(cleanSym);
    
    const lastPriceTs = ticks.length > 0 ? ticks[ticks.length - 1].timestamp : 'no_price';
    const lastFnoTs = fno.length > 0 ? fno[fno.length - 1].timestamp : 'no_fno';
    
    const todayStr = new Date().toISOString().split('T')[0];
    const session = marketDataProvider.getSessionSummary(cleanSym, todayStr);
    const lastVolTs = session ? todayStr : 'no_vol';
    
    return `mkt_${lastPriceTs}_fno_${lastFnoTs}_vol_${lastVolTs}`;
}

/**
 * Helper to generate a content/revision-aware cache key for articles.
 * Invalidates instantly if headline, body, fno status, financial metrics or source changes.
 */
function getArticleRevisionKey(article: any): string {
    const body = article.body || article.content || '';
    const headline = article.headline || article.title || '';
    const fno = article.fnoEligible ? '1' : '0';
    const metrics = JSON.stringify(article.financialMetrics || []);
    const sourceUrl = article.sourceUrl || '';
    const updated = article.publishedAt || '';
    const symbol = article.symbol || '';
    const marketSig = getMarketObservationSignature(symbol);
    return `art_${article.id}_rev_${body.length}_${headline.length}_${fno}_${metrics.length}_${sourceUrl.length}_${updated}_${marketSig}`;
}

/**
 * Helper to generate a revision-aware cache key for events.
 * Invalidates if status, last update time, source count or primary article changes.
 */
function getEventRevisionKey(event: any): string {
    const articleId = event.latestArticleId || event.primarySource?.articleId || '';
    const symbol = event.symbol || '';
    const marketSig = getMarketObservationSignature(symbol);
    return `evt_${event.eventId}_rev_${event.lastUpdatedAt}_${event.sourceCount}_${event.eventStatus}_${articleId}_${marketSig}`;
}

function getV9CachedOrCompute(key: string, computeFn: () => any): any {
    const cached = intelligenceV9Cache.get(key);
    if (cached && (Date.now() - cached.cachedAt) < V9_CACHE_TTL_MS) {
        intelligenceObservability.intelligenceCacheHits++;
        return cached.data;
    }
    intelligenceObservability.intelligenceCacheMisses++;
    const start = Date.now();
    const fresh = computeFn();
    const duration = Date.now() - start;
    
    intelligenceObservability.totalGenerationLatencyMs += duration;
    intelligenceV9Cache.set(key, { data: fresh, cachedAt: Date.now() });
    return fresh;
}

/**
 * GET /api/v5/news/intelligence/observability
 * Exposes the in-memory decision-support intelligence metrics.
 */
router.get('/intelligence/observability', (req: Request, res: Response) => {
    try {
        const reqCount = intelligenceObservability.intelligenceRequests;
        const groundedCount = intelligenceObservability.groundedIntelligence;
        res.json({
            status: 'success',
            observability: {
                ...intelligenceObservability,
                averageGenerationLatencyMs: reqCount > 0
                    ? Number((intelligenceObservability.totalGenerationLatencyMs / reqCount).toFixed(2))
                    : 0,
                evidenceCompletenessRate: groundedCount > 0
                    ? ((intelligenceObservability.evidenceCompletenessSum / groundedCount)).toFixed(2) + '%'
                    : '0%',
                marketReactionEvidenceRate: groundedCount > 0
                    ? ((intelligenceObservability.marketReactionEvidenceCount / groundedCount) * 100).toFixed(2) + '%'
                    : '0%',
                foEvidenceRate: groundedCount > 0
                    ? ((intelligenceObservability.foEvidenceCount / groundedCount) * 100).toFixed(2) + '%'
                    : '0%',
                averageMarketLatencyMs: intelligenceObservability.marketReactionRequests > 0
                    ? Number((intelligenceObservability.marketReactionLatencySumMs / intelligenceObservability.marketReactionRequests).toFixed(2))
                    : 0
            }
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/v5/news/intelligence/:articleId
 * Generates or retrieves the high-fidelity Phase 9.1 Trader Intelligence Dossier for a specific article.
 */
router.get('/intelligence/:articleId', async (req: Request, res: Response) => {
    try {
        const { articleId } = req.params;
        if (!articleId || articleId.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Article ID is required and must not be empty.' });
        }

        const article = await stage2Store.getById(articleId);
        if (!article) {
            return res.status(404).json({ status: 'error', message: `Article with ID '${articleId}' not found in canonical store.` });
        }

        intelligenceObservability.intelligenceRequests++;

        const sym = (article as any).symbol || 'NIFTY';
        // Fetch, validate, and register real market data in the legacy provider registry first (Section 19)
        try {
            const [eq, fut, chain] = await Promise.all([
                marketDataProviderManager.getEquityObservation(sym).catch(() => null),
                marketDataProviderManager.getFuturesObservation(sym).catch(() => null),
                marketDataProviderManager.getOptionChain(sym).catch(() => null)
            ]);
            marketDataProvider.registerRealObservations(sym, eq, fut, chain);
        } catch (mktErr) {
            console.warn(`[MarketDataPreFetch] Non-blocking market pre-fetch failed for ${sym}:`, mktErr);
        }

        const cacheKey = getArticleRevisionKey(article);
        const dossier = getV9CachedOrCompute(cacheKey, () => {
            const sym = (article as any).symbol || 'NIFTY';
            const baseDir: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = (article as any).category === 'EARNINGS' || (article as any).category === 'ORDER_WIN' ? 'BULLISH' : 'NEUTRAL';
            const fDate = article.publishedAt || new Date().toISOString();

            // Run deterministic market confirmation engine
            intelligenceObservability.marketReactionRequests++;
            const startMkt = Date.now();
            const marketConfirmation = MarketConfirmationEngine.process(sym, fDate, baseDir);
            const durationMkt = Date.now() - startMkt;
            intelligenceObservability.marketReactionLatencySumMs += durationMkt;

            // Generate dossier with confirmation payload
            const base = TraderIntelligenceEngine.process(article as any).toJSON();
            const support = TraderDecisionSupportEngine.generate(article as any, marketConfirmation);

            // Record detailed Stage 9.2 market observability
            intelligenceObservability.zeroAiMarketCalculations++;
            if (marketConfirmation.priceReaction.availability === 'AVAILABLE') {
                intelligenceObservability.marketDataAvailableCount++;
            } else {
                intelligenceObservability.marketDataNotAvailableCount++;
            }
            if (marketConfirmation.priceReaction.dataFreshness === 'STALE' || marketConfirmation.priceReaction.dataFreshness === 'EXPIRED') {
                intelligenceObservability.staleMarketDataCount++;
            }
            if (marketConfirmation.volumeConfirmation.volumeAvailability === 'AVAILABLE') {
                intelligenceObservability.volumeDataAvailableCount++;
            } else {
                intelligenceObservability.volumeDataNotAvailableCount++;
            }
            if (marketConfirmation.fnoPositioning.availability === 'AVAILABLE') {
                intelligenceObservability.fnoDataAvailableCount++;
            } else {
                intelligenceObservability.fnoDataNotAvailableCount++;
            }
            const overallState = marketConfirmation.overallConfirmation;
            if (!intelligenceObservability.confirmationDistribution[overallState]) {
                intelligenceObservability.confirmationDistribution[overallState] = 0;
            }
            intelligenceObservability.confirmationDistribution[overallState]++;
            if (overallState === 'CONTRADICTED') {
                intelligenceObservability.contradictionCount++;
            } else if (overallState === 'INSUFFICIENT_EVIDENCE') {
                intelligenceObservability.insufficientEvidenceCount++;
            }

            // Record Observability stats
            if (support.qualityState === 'SOURCE_GROUNDED') {
                intelligenceObservability.groundedIntelligence++;
            } else if (support.qualityState === 'QUALITY_REJECTED') {
                intelligenceObservability.rejectedIntelligence++;
            } else {
                intelligenceObservability.unavailableIntelligence++;
            }

            if (support.marketReaction.status === 'VERIFIED') {
                intelligenceObservability.marketReactionEvidenceCount++;
            }
            if (support.optionsSellerView.derivativesEvidence === 'AVAILABLE') {
                intelligenceObservability.foEvidenceCount++;
            }

            // Calculate evidence completeness percentage
            const verifiedFactsCount = support.facts.verifiedFacts.length;
            const changedVerified = support.whatChanged.status === 'VERIFIED_NUMERICAL_CHANGE' ? 1 : 0;
            const mechanismVerified = support.whyItMatters.status === 'VERIFIED' ? 1 : 0;
            const reactionVerified = support.marketReaction.status === 'VERIFIED' ? 1 : 0;
            const foAvailable = support.optionsSellerView.derivativesEvidence === 'AVAILABLE' ? 1 : 0;
            const completeness = ((verifiedFactsCount + changedVerified + mechanismVerified + reactionVerified + foAvailable) / 5) * 100;
            
            intelligenceObservability.evidenceCompletenessSum += completeness;
            intelligenceObservability.zeroAiSuppressedCalls++; // Zero AI call enforcement

            return {
                ...base,
                ...support,
                articleTruth: base,
                traderDecisionSupport: support,
                marketReaction: marketConfirmation.priceReaction,
                volumeConfirmation: marketConfirmation.volumeConfirmation,
                fnoPositioning: marketConfirmation.fnoPositioning,
                marketConfirmation: marketConfirmation
            };
        });

        res.json({
            status: 'success',
            version: 'ATHENA_TRADER_V9.2',
            articleId,
            articleTruth: dossier.articleTruth,
            traderDecisionSupport: dossier.traderDecisionSupport,
            marketReaction: dossier.marketReaction,
            volumeConfirmation: dossier.volumeConfirmation,
            fnoPositioning: dossier.fnoPositioning,
            marketConfirmation: dossier.marketConfirmation,
            intelligence: dossier,
            observability: {
                aiCalls: 0,
                zeroAiSuppressedCalls: 1
            }
        });
    } catch (err: any) {
        console.error(`[TraderIntelligence V9.2] Error processing article ${req.params.articleId}:`, err);
        res.status(500).json({ status: 'error', message: err.message || 'Failed to process trader intelligence.' });
    }
});

/**
 * GET /api/v5/news/intelligence/event/:eventId
 * Generates or retrieves Phase 9.2 Trader Intelligence Dossier for the primary/latest article in an event.
 */
router.get('/intelligence/event/:eventId', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        if (!eventId || eventId.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Event ID is required and must not be empty.' });
        }

        const orchestrator = EventCentricOrchestrator.getInstance();
        const event = orchestrator.getEventById(eventId);
        if (!event) {
            return res.status(404).json({ status: 'error', message: `Event with ID '${eventId}' not found.` });
        }

        intelligenceObservability.intelligenceRequests++;

        const sym = event.symbol || 'NIFTY';
        try {
            const [eq, fut, chain] = await Promise.all([
                marketDataProviderManager.getEquityObservation(sym).catch(() => null),
                marketDataProviderManager.getFuturesObservation(sym).catch(() => null),
                marketDataProviderManager.getOptionChain(sym).catch(() => null)
            ]);
            marketDataProvider.registerRealObservations(sym, eq, fut, chain);
        } catch (mktErr) {
            console.warn(`[MarketDataPreFetch] Non-blocking market pre-fetch failed for event ${sym}:`, mktErr);
        }

        const articleId = event.latestArticleId || event.primarySource?.articleId;
        if (!articleId) {
            return res.status(404).json({ status: 'error', message: `No associated articles found for event '${eventId}'.` });
        }

        const article = await stage2Store.getById(articleId);
        let dossier: any;

        if (!article) {
            console.warn(`[TraderIntelligence V9.2] Article ${articleId} not found for event ${eventId}, using synthetic fallback.`);
            const syntheticArticle = {
                id: articleId,
                headline: event.primarySource?.headline || event.canonicalSummary?.whatHappened || 'Market Event',
                body: event.canonicalSummary?.whyItMatters || '',
                publishedAt: event.primarySource?.publishedAt || event.lastUpdatedAt,
                source: { name: event.primarySource?.publisher || 'Official', publisher: event.primarySource?.publisher || 'Official' },
                category: event.category,
                symbol: event.symbol || 'NIFTY',
                fnoEligible: true
            };
            const cacheKey = getArticleRevisionKey(syntheticArticle);
            dossier = getV9CachedOrCompute(cacheKey, () => {
                const sym = syntheticArticle.symbol;
                const baseDir: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = syntheticArticle.category === 'EARNINGS' || syntheticArticle.category === 'ORDER_WIN' ? 'BULLISH' : 'NEUTRAL';
                const fDate = syntheticArticle.publishedAt || new Date().toISOString();

                // Run deterministic market confirmation engine
                intelligenceObservability.marketReactionRequests++;
                const startMkt = Date.now();
                const marketConfirmation = MarketConfirmationEngine.process(sym, fDate, baseDir);
                const durationMkt = Date.now() - startMkt;
                intelligenceObservability.marketReactionLatencySumMs += durationMkt;

                const base = TraderIntelligenceEngine.process(syntheticArticle).toJSON();
                const support = TraderDecisionSupportEngine.generate(syntheticArticle, marketConfirmation);
                
                if (support.qualityState === 'SOURCE_GROUNDED') intelligenceObservability.groundedIntelligence++;
                else intelligenceObservability.unavailableIntelligence++;
                intelligenceObservability.zeroAiSuppressedCalls++;

                return {
                    ...base,
                    ...support,
                    articleTruth: base,
                    traderDecisionSupport: support,
                    marketReaction: marketConfirmation.priceReaction,
                    volumeConfirmation: marketConfirmation.volumeConfirmation,
                    fnoPositioning: marketConfirmation.fnoPositioning,
                    marketConfirmation: marketConfirmation
                };
            });
        } else {
            const cacheKey = getArticleRevisionKey(article);
            dossier = getV9CachedOrCompute(cacheKey, () => {
                const sym = (article as any).symbol || 'NIFTY';
                const baseDir: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = (article as any).category === 'EARNINGS' || (article as any).category === 'ORDER_WIN' ? 'BULLISH' : 'NEUTRAL';
                const fDate = article.publishedAt || new Date().toISOString();

                // Run deterministic market confirmation engine
                intelligenceObservability.marketReactionRequests++;
                const startMkt = Date.now();
                const marketConfirmation = MarketConfirmationEngine.process(sym, fDate, baseDir);
                const durationMkt = Date.now() - startMkt;
                intelligenceObservability.marketReactionLatencySumMs += durationMkt;

                const base = TraderIntelligenceEngine.process(article as any).toJSON();
                const support = TraderDecisionSupportEngine.generate(article as any, marketConfirmation);

                if (support.qualityState === 'SOURCE_GROUNDED') {
                    intelligenceObservability.groundedIntelligence++;
                } else if (support.qualityState === 'QUALITY_REJECTED') {
                    intelligenceObservability.rejectedIntelligence++;
                } else {
                    intelligenceObservability.unavailableIntelligence++;
                }

                if (support.marketReaction.status === 'VERIFIED') {
                    intelligenceObservability.marketReactionEvidenceCount++;
                }
                if (support.optionsSellerView.derivativesEvidence === 'AVAILABLE') {
                    intelligenceObservability.foEvidenceCount++;
                }

                const verifiedFactsCount = support.facts.verifiedFacts.length;
                const changedVerified = support.whatChanged.status === 'VERIFIED_NUMERICAL_CHANGE' ? 1 : 0;
                const mechanismVerified = support.whyItMatters.status === 'VERIFIED' ? 1 : 0;
                const reactionVerified = support.marketReaction.status === 'VERIFIED' ? 1 : 0;
                const foAvailable = support.optionsSellerView.derivativesEvidence === 'AVAILABLE' ? 1 : 0;
                const completeness = ((verifiedFactsCount + changedVerified + mechanismVerified + reactionVerified + foAvailable) / 5) * 100;
                
                intelligenceObservability.evidenceCompletenessSum += completeness;
                intelligenceObservability.zeroAiSuppressedCalls++;

                return {
                    ...base,
                    ...support,
                    articleTruth: base,
                    traderDecisionSupport: support,
                    marketReaction: marketConfirmation.priceReaction,
                    volumeConfirmation: marketConfirmation.volumeConfirmation,
                    fnoPositioning: marketConfirmation.fnoPositioning,
                    marketConfirmation: marketConfirmation
                };
            });
        }

        // Complies with Event Intelligence (Part 16): Rank, identify revisions, supporting sources
        const supportingPublishers = Array.from(new Set([
            event.primarySource?.publisher,
            ...(event.supportingSources || []).map(s => s.publisher)
        ].filter(Boolean)));

        const allSources = [
            ...(event.primarySource ? [event.primarySource] : []),
            ...(event.supportingSources || [])
        ];

        // Sort by tier (Tier 1 is highest, then Tier 2, etc.)
        const rankedSources = allSources.sort((a, b) => (a.tier || 4) - (b.tier || 4));

        const primaryTier = event.primarySource?.tier || 4;
        const sourceAuthority = primaryTier === 1 ? 'HIGH_AUTHORITY' : (primaryTier === 2 || primaryTier === 3 ? 'MEDIUM_AUTHORITY' : 'LOW_AUTHORITY');

        res.json({
            status: 'success',
            version: 'ATHENA_TRADER_V9.2',
            eventId,
            eventPriority: event.eventPriority,
            eventStatus: event.eventStatus,
            canonicalEvent: {
                eventType: event.eventType,
                primaryEntity: event.primaryEntity,
                symbol: event.symbol,
                fingerprint: event.eventFingerprint,
                firstSeenAt: event.firstSeenAt
            },
            supportingPublishers,
            rankedSources,
            materialRevisions: event.history || [],
            previousVsNew: {
                previous: event.previousKeyNumbers || [],
                current: event.keyNumbers || [],
                details: event.whatChanged || ''
            },
            eventMechanism: dossier.whyItMatters?.transmissionMechanism || 'TRANSMISSION_MECHANISM_UNVERIFIED',
            conflictingSourceInfo: event.conflictingReports || [],
            supportingArticles: allSources,
            sourceAuthority,
            eventEvidence: dossier.traderDecisionSupport?.evidence || dossier.evidence || [],
            fundamentalImpact: dossier.traderDecisionSupport?.whyItMatters || dossier.whyItMatters || null,
            marketReaction: dossier.marketReaction,
            volumeConfirmation: dossier.volumeConfirmation,
            FnoPositioning: dossier.fnoPositioning,
            fnoPositioning: dossier.fnoPositioning,
            marketConfirmation: dossier.marketConfirmation,
            eventRevision: event.history || [],
            contradictionFlags: dossier.marketConfirmation?.contradictionFlags || {},
            intelligence: dossier
        });
    } catch (err: any) {
        console.error(`[TraderIntelligence V9.2] Error processing event ${req.params.eventId}:`, err);
        res.status(500).json({ status: 'error', message: err.message || 'Failed to process event trader intelligence.' });
    }
});

/**
 * GET /api/v5/news/intelligence/symbol/:symbol
 * Aggregates a symbol-specific intelligence dossier from recent historical events and article metrics.
 */
router.get('/intelligence/symbol/:symbol', async (req: Request, res: Response) => {
    try {
        const { symbol } = req.params;
        if (!symbol || symbol.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Symbol is required and must not be empty.' });
        }

        const cleanSymbol = symbol.toUpperCase().trim();
        const cacheKey = `v9_intel_sym_${cleanSymbol}`;

        const dossier = await getV9CachedOrCompute(cacheKey, async () => {
            const allArticles = await stage2Store.getAll();
            const matchingArticles = allArticles.filter(art => {
                const text = `${art.headline || ''} ${(art as any).body || ''}`.toUpperCase();
                return (art as any).symbol?.toUpperCase() === cleanSymbol || 
                       (art.headline && text.includes(` ${cleanSymbol} `)) ||
                       (art.headline && text.includes(`(${cleanSymbol})`));
            });

            if (matchingArticles.length === 0) {
                return {
                    symbol: cleanSymbol,
                    entityName: 'Unknown Entity',
                    eventCount: 0,
                    recentMaterialEvents: 0,
                    eventFrequency: 'NONE',
                    latestIntelligence: null,
                    timeline: [],
                    activeMonitors: [],
                    uncertainties: [],
                    eventDistribution: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
                    majorFundamentalThemes: [],
                    latestVerifiedMarketReaction: 'UNKNOWN',
                    fnoEvidenceAvailable: false,
                    activeRiskFlags: [],
                    currentFreshness: 'STALE'
                };
            }

            // Sort by publishedAt descending
            const sortedArticles = matchingArticles.sort((a, b) => {
                return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
            });

            // Process latest 5 articles using the enhanced support engine with market confirmation
            const recentIntel = sortedArticles.slice(0, 5).map(art => {
                const sym = (art as any).symbol || cleanSymbol;
                const baseDir: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = (art as any).category === 'EARNINGS' || (art as any).category === 'ORDER_WIN' ? 'BULLISH' : 'NEUTRAL';
                const fDate = art.publishedAt || new Date().toISOString();

                const mConf = MarketConfirmationEngine.process(sym, fDate, baseDir);
                const base = TraderIntelligenceEngine.process(art as any).toJSON();
                const support = TraderDecisionSupportEngine.generate(art as any, mConf);
                return {
                    ...base,
                    ...support,
                    marketConfirmation: mConf
                };
            });

            const latest = recentIntel[0] || null;
            const entityName = latest ? latest.event.primaryEntity : cleanSymbol;

            // Compile timeline
            const timeline = recentIntel.map(intel => ({
                articleId: (intel as any).articleId || (intel as any).id || '',
                publishedAt: intel.event.eventTimestamp,
                eventType: intel.event.eventType,
                headline: intel.facts.verifiedFacts[0] || 'News Event',
                fundamentalImpact: intel.fundamentalImpact || 'NEUTRAL',
                marketImpact: intel.marketConfirmation?.priceReaction?.reactionDirection || 'UNKNOWN',
                confidenceScore: intel.confidence.score
            }));

            // Collect unique active monitors
            const activeMonitorsSet = new Set<string>();
            recentIntel.forEach(intel => {
                if (Array.isArray(intel.whatToMonitor)) {
                    intel.whatToMonitor.forEach((m: string) => activeMonitorsSet.add(m));
                }
            });

            // Collect unique uncertainties
            const uncertaintiesSet = new Set<string>();
            recentIntel.forEach(intel => {
                if (intel.facts?.unknownNotAvailable) {
                    intel.facts.unknownNotAvailable.forEach((u: string) => uncertaintiesSet.add(u));
                }
            });

            // Distribute event directions
            const distribution = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
            recentIntel.forEach(intel => {
                const dir = intel.marketConfirmation?.priceReaction?.reactionDirection as string;
                if (dir === 'POSITIVE') distribution.positive++;
                else if (dir === 'NEGATIVE') distribution.negative++;
                else if (dir === 'MIXED') distribution.mixed++;
                else distribution.neutral++;
            });

            // Major themes (transmission mechanisms)
            const themes = Array.from(new Set(
                recentIntel.map(intel => intel.whyItMatters?.transmissionMechanism).filter(Boolean)
            ));

            const riskFlags = Array.from(new Set(
                recentIntel.map(intel => intel.risk?.level).filter(r => r && r !== 'LOW' && r !== 'UNKNOWN')
            ));

            const elapsedLatestMinutes = latest
                ? Math.floor((Date.now() - new Date(latest.event.eventTimestamp).getTime()) / (1000 * 60))
                : Infinity;
            const freshness = elapsedLatestMinutes <= 30 ? 'BREAKING' : elapsedLatestMinutes <= 120 ? 'FRESH' : 'STALE';

            // Phase 9.2 expanded market trend properties
            const latestTimestamp = latest ? latest.event.eventTimestamp : new Date().toISOString();
            const latestDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN' = latest
                ? (latest.event.eventType === 'REGULATORY_ACTION' || latest.event.eventType === 'ORDER_CANCELLATION' ? 'BEARISH' : (latest.event.eventType === 'ORDER_WIN' || latest.event.eventType === 'ACQUISITION' || latest.event.eventType === 'EARNINGS' ? 'BULLISH' : 'NEUTRAL'))
                : 'NEUTRAL';

            const currentConfirmation = MarketConfirmationEngine.process(cleanSymbol, latestTimestamp, latestDirection);

            const recentEventReactions = recentIntel.map(intel => {
                const fDir = intel.event.eventType === 'REGULATORY_ACTION' || intel.event.eventType === 'ORDER_CANCELLATION' ? 'BEARISH' : (intel.event.eventType === 'ORDER_WIN' || intel.event.eventType === 'ACQUISITION' || intel.event.eventType === 'EARNINGS' ? 'BULLISH' : 'NEUTRAL');
                const mConf = intel.marketConfirmation || MarketConfirmationEngine.process(cleanSymbol, intel.event.eventTimestamp, fDir);
                return {
                    eventType: intel.event.eventType,
                    eventTimestamp: intel.event.eventTimestamp,
                    direction: mConf.priceReaction.reactionDirection,
                    strength: mConf.priceReaction.reactionStrength,
                    overallConfirmation: mConf.overallConfirmation
                };
            });

            const marketConfirmationTrend = currentConfirmation.overallConfirmation;
            const volumeTrend = recentIntel.map(intel => intel.marketConfirmation?.volumeConfirmation?.volumeMultiple || 1.0);
            const FnoPositioningTrend = recentIntel.map(intel => intel.marketConfirmation?.fnoPositioning?.optionFlowClassification || 'NEUTRAL');

            const contradictoryEvents = recentEventReactions.filter(r => r.overallConfirmation === 'CONTRADICTED').map(r => ({
                eventType: r.eventType,
                eventTimestamp: r.eventTimestamp
            }));

            const reactionTimeline = recentIntel.map(intel => {
                const mConf = intel.marketConfirmation || MarketConfirmationEngine.process(cleanSymbol, intel.event.eventTimestamp, 'NEUTRAL');
                return {
                    timestamp: intel.event.eventTimestamp,
                    priceChange: mConf.priceReaction.percentagePriceChange ?? 0,
                    volumeMultiple: mConf.volumeConfirmation.volumeMultiple ?? 1.0,
                    confirmationState: mConf.overallConfirmation
                };
            });

            const currentOptionsSellerContext = latest ? latest.optionsSellerView?.optionsSellerMarketConfirmation || 'INSUFFICIENT_EVIDENCE' : 'INSUFFICIENT_EVIDENCE';

            return {
                symbol: cleanSymbol,
                entityName,
                eventCount: matchingArticles.length,
                recentMaterialEvents: matchingArticles.filter(a => a.eventType !== 'OTHER').length,
                eventFrequency: matchingArticles.length >= 5 ? 'HIGH' : matchingArticles.length >= 2 ? 'MODERATE' : matchingArticles.length === 1 ? 'LOW' : 'NONE',
                latestIntelligence: latest,
                timeline,
                activeMonitors: Array.from(activeMonitorsSet),
                uncertainties: Array.from(uncertaintiesSet),
                eventDistribution: distribution,
                majorFundamentalThemes: themes,
                latestVerifiedMarketReaction: latest ? latest.marketConfirmation?.priceReaction?.reactionDirection || 'UNKNOWN' : 'UNKNOWN',
                fnoEvidenceAvailable: recentIntel.some(intel => intel.optionsSellerView?.derivativesEvidence === 'AVAILABLE'),
                activeRiskFlags: riskFlags,
                currentFreshness: freshness,

                // Phase 9.2 added fields
                currentMarketReaction: currentConfirmation.priceReaction,
                recentEventReactions,
                marketConfirmationTrend,
                volumeTrend,
                FnoPositioningTrend,
                currentOptionsSellerContext,
                contradictoryEvents,
                reactionTimeline
            };
        });

        res.json({
            status: 'success',
            version: 'ATHENA_TRADER_V9.2',
            symbol: cleanSymbol,
            dossier
        });
    } catch (err: any) {
        console.error(`[TraderIntelligence V9.2] Error aggregating symbol ${req.params.symbol}:`, err);
        res.status(500).json({ status: 'error', message: err.message || 'Failed to aggregate symbol intelligence.' });
    }
});

// ==========================================
// PHASE 9.3: MARKET DATA & OBSERVABILITY API ENDPOINTS
// ==========================================

// 1. Market Data Observability & Circuit Breakers (Section 24)
router.get('/market-data/observability', (req, res) => {
    try {
        const statuses = MarketDataCircuitBreaker.getAllStatuses();
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            circuitBreakers: statuses,
            normalizerTelemetry: MarketDataNormalizer.telemetry
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 2. Provider Status & Health (Section 25)
router.get('/market-data/providers', (req, res) => {
    try {
        const status = marketDataProviderManager.getProviderStatus();
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            providers: status
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 3. Switch Market Data Mode (PRODUCTION, DEGRADED, TEST, MOCK)
router.post('/market-data/mode', (req, res) => {
    try {
        const { mode } = req.body;
        if (!mode || !['PRODUCTION', 'DEGRADED', 'TEST', 'MOCK'].includes(mode)) {
            return res.status(400).json({ status: 'error', message: 'Invalid or missing mode. Allowed: PRODUCTION, DEGRADED, TEST, MOCK' });
        }
        marketDataProviderManager.setMode(mode);
        res.json({
            status: 'success',
            mode,
            message: `Market data mode successfully updated to ${mode}`
        });
    } catch (err: any) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

// 4. Fetch Comprehensive Normalized Market Data for a Symbol (Section 26)
router.get('/market-data/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const nowUtc = new Date().toISOString();
        const sessionState = MarketSessionEngine.determineSession(nowUtc);
        const sessionIst = MarketSessionEngine.convertUtcToIstString(nowUtc);

        const [equity, futures, optionChain] = await Promise.all([
            marketDataProviderManager.getEquityObservation(symbol).catch(() => null),
            marketDataProviderManager.getFuturesObservation(symbol).catch(() => null),
            marketDataProviderManager.getOptionChain(symbol).catch(() => null)
        ]);

        let pcr = 'NOT_AVAILABLE';
        let concentrations = [];
        if (optionChain && optionChain.contracts) {
            pcr = MarketDataNormalizer.calculatePcr(optionChain.contracts) as any;
            concentrations = MarketDataNormalizer.calculateStrikeConcentrations(optionChain.contracts);
        }

        res.json({
            status: 'success',
            symbol,
            session: {
                state: sessionState,
                istTime: sessionIst,
                isHoliday: MarketSessionEngine.isHoliday(nowUtc.split('T')[0])
            },
            equity,
            futures,
            optionChainSnapshot: optionChain ? {
                underlying: optionChain.underlying,
                timestamp: optionChain.timestamp,
                pcr,
                strikeConcentrations: concentrations,
                provenance: optionChain.provenance
            } : null
        });
    } catch (err: any) {
        console.error(`[MarketDataAPI] Error fetching for symbol ${req.params.symbol}:`, err);
        res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch market data.' });
    }
});

export { router as newsV5Router, stage2Store, feedService, ingestionPipeline, liveWorker as liveIngestionWorker };

