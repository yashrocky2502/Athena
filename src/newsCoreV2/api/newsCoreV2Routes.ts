import { Router, Request, Response } from "express";
import { newsStore } from "../storage/PersistentNewsStore.ts";
import { newsSyncService } from "../sync/NewsSyncService.ts";
import { NewsCoreV2Regression } from "../tests/NewsCoreV2Regression.ts";
import { NewsCoreV2UIAdapter } from "./NewsCoreV2UIAdapter.ts";
import { UnifiedIntelligenceEngine } from "../intelligenceV2/UnifiedIntelligenceEngine.ts";

export const newsCoreV2Router = Router();

/**
 * GET /api/v4/news/:articleId/intelligence
 * Returns canonical intelligence record for the specified article.
 */
newsCoreV2Router.get("/:articleId/intelligence", async (req: Request, res: Response) => {
  try {
    const articleId = req.params.articleId;
    const article = newsStore.getArticle(articleId) || newsStore.getAllArticles().find(a => a.id === articleId);

    if (!article) {
      return res.status(404).json({
        status: "error",
        message: `Article with ID ${articleId} not found`
      });
    }

    const intelligence = await UnifiedIntelligenceEngine.generateAIIntelligence(article);

    res.json({
      status: "success",
      article,
      intelligence
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to retrieve intelligence record"
    });
  }
});

/**
 * GET /api/v4/news/feed
 * Returns all articles adapted for the UI.
 */
newsCoreV2Router.get("/feed", (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : (req.query.page ? 50 : 150);
    const categoryQuery = req.query.category as string | undefined;

    const allArticles = newsStore.getAllArticles();
    let filtered = allArticles;

    if (categoryQuery && categoryQuery.toLowerCase() !== "all") {
      const lowerQuery = categoryQuery.toLowerCase();
      if (lowerQuery === "f&o" || lowerQuery === "fno") {
        filtered = newsStore.getFNOArticles();
      } else {
        filtered = allArticles.filter(art => {
          const primary = (art.primaryCategory || art.category || "").toLowerCase();
          return primary === lowerQuery;
        });
      }
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedArticles = filtered.slice(startIndex, endIndex);

    const syncStatus = newsSyncService.getStatus();
    const uiArticles = NewsCoreV2UIAdapter.adaptMany(paginatedArticles);

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    // Compute canonical category counts on the server
    const categoryCounts: Record<string, number> = {
      "All": allArticles.length,
      "F&O": newsStore.getFNOArticles().length
    };
    const checkCategories = [
      "Crypto",
      "Commodities",
      "IPO",
      "Results",
      "Market",
      "Corporate",
      "Economy",
      "Global",
      "Technology",
      "Exchange"
    ];
    for (const cat of checkCategories) {
      categoryCounts[cat] = allArticles.filter(art => {
        const primary = (art.primaryCategory || art.category || "").toLowerCase();
        return primary === cat.toLowerCase();
      }).length;
    }

    res.json({
      status: "success",
      articles: uiArticles,
      count: uiArticles.length,
      totalCount,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrevious,
      categoryCounts,
      lastSuccessfulSyncAt: syncStatus.lastSuccessfulSyncAt,
      nextSyncAt: syncStatus.nextSyncAt
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to fetch news feed"
    });
  }
});

/**
 * GET /api/v4/news/fno
 * Returns strictly F&O eligible articles adapted for the UI.
 */
newsCoreV2Router.get("/fno", (req: Request, res: Response) => {
  try {
    const fnoArticles = newsStore.getFNOArticles();
    const uiArticles = NewsCoreV2UIAdapter.adaptMany(fnoArticles);

    res.json({
      status: "success",
      articles: uiArticles,
      count: uiArticles.length
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to fetch F&O news feed"
    });
  }
});

/**
 * GET /api/v4/news/status
 */
newsCoreV2Router.get("/status", (req: Request, res: Response) => {
  try {
    const activeCollectors = newsSyncService.getActiveCollectorsCount();
    const stats = newsStore.getStats(activeCollectors);
    const syncStatus = newsSyncService.getStatus();
    const fnoArticles = newsStore.getFNOArticles();

    res.json({
      status: "success",
      currentState: syncStatus.syncState,
      syncState: syncStatus.syncState,
      lastSuccessfulSyncAt: syncStatus.lastSuccessfulSyncAt,
      lastAttemptAt: syncStatus.lastAttemptAt,
      nextSyncAt: syncStatus.nextSyncAt,
      syncDuration: syncStatus.lastSyncDurationMs ?? null,
      lastSyncDurationMs: syncStatus.lastSyncDurationMs ?? null,
      lastSyncError: syncStatus.lastError ?? null,
      lastError: syncStatus.lastError ?? null,
      articleCount: stats.storageCount,
      fnoCount: fnoArticles.length,
      storageCount: stats.storageCount,
      apiCount: stats.apiCount,
      uniqueArticleIds: stats.uniqueArticleIds,
      duplicateIds: stats.duplicateIds,
      duplicateCanonicalUrls: stats.duplicateCanonicalUrls,
      activeCollectors: stats.activeCollectors
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to fetch status"
    });
  }
});

/**
 * POST /api/v4/news/sync
 */
newsCoreV2Router.post("/sync", async (req: Request, res: Response) => {
  try {
    const result = await newsSyncService.runSync();
    res.json({
      status: "success",
      syncState: result.status,
      itemsProcessed: result.itemsProcessed,
      newAdded: result.newAdded,
      syncReport: newsSyncService.getStatus()
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Manual sync failed"
    });
  }
});

/**
 * POST /api/v4/news/reclassify
 * Performs bulk reclassification on stored articles asynchronously in batches.
 */
newsCoreV2Router.post("/reclassify", async (req: Request, res: Response) => {
  try {
    const force = req.body.force === true || req.query.force === "true";
    const limit = req.body.limit ? parseInt(req.body.limit as string) : (req.query.limit ? parseInt(req.query.limit as string) : 50);

    const statsBefore = newsStore.getStats();
    
    // Bulk reclassify invocation
    const result = await newsStore.reclassifyArticles(force, limit);
    
    const statsAfter = newsStore.getStats();

    res.json({
      status: "success",
      message: "Bulk reclassification completed.",
      parameters: { force, limit },
      processed: result.processed,
      updated: result.updated,
      statsBefore: {
        totalArticles: statsBefore.storageCount,
        uniqueArticleIds: statsBefore.uniqueArticleIds
      },
      statsAfter: {
        totalArticles: statsAfter.storageCount,
        uniqueArticleIds: statsAfter.uniqueArticleIds
      }
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Bulk reclassification failed"
    });
  }
});

/**
 * GET /api/v4/news/health
 */
newsCoreV2Router.get("/health", (req: Request, res: Response) => {
  try {
    const allArticles = newsStore.getAllArticles();
    const fnoArticles = newsStore.getFNOArticles();
    const syncStatus = newsSyncService.getStatus();
    const activeCollectors = newsSyncService.getActiveCollectorsCount();
    const stats = newsStore.getStats(activeCollectors);

    const isStoreAvailable = Array.isArray(allArticles);
    const isSchedulerAvailable = !!syncStatus && !!syncStatus.syncState;
    const isHealthy = isStoreAvailable && isSchedulerAvailable;

    const responseCode = isHealthy ? 200 : 503;

    res.status(responseCode).json({
      status: isHealthy ? "healthy" : "unhealthy",
      newsCoreVersion: "V2",
      persistentStoreAvailable: isStoreAvailable,
      cacheAvailable: true,
      schedulerAvailable: isSchedulerAvailable,
      collectorState: {
        activeCollectors,
        status: activeCollectors > 0 ? "ACTIVE" : "INACTIVE"
      },
      lastSuccessfulSyncAt: syncStatus.lastSuccessfulSyncAt,
      articleCount: allArticles.length,
      fnoCount: fnoArticles.length,
      syncStatus,
      storageStats: stats
    });
  } catch (err: any) {
    res.status(503).json({
      status: "unhealthy",
      newsCoreVersion: "V2",
      error: err.message || "News Core V2 health check failed"
    });
  }
});

import { Phase23_5_FeedIntegrityRegression } from "../tests/Phase23_5_FeedIntegrityRegression.ts";
import { Phase23_5_C_RuntimeIntegrityRegression } from "../tests/Phase23_5_C_RuntimeIntegrityRegression.ts";
import { Phase23_5_D_ForensicAudit } from "../tests/Phase23_5_D_ForensicAudit.ts";

/**
 * GET /api/v4/news/regression
 */
newsCoreV2Router.get("/regression", async (req: Request, res: Response) => {
  try {
    const report = await NewsCoreV2Regression.runSuite();
    const phase235Report = await Phase23_5_FeedIntegrityRegression.runSuite();
    const phase235CReport = await Phase23_5_C_RuntimeIntegrityRegression.runSuite();
    const phase235DReport = await Phase23_5_D_ForensicAudit.runSuite();
    res.json({
      ...report,
      phase23_5: phase235Report,
      phase23_5_c: phase235CReport,
      phase23_5_d: phase235DReport
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Regression test suite execution failed"
    });
  }
});

newsCoreV2Router.get("/regression-23-5", async (req: Request, res: Response) => {
  try {
    const report = await Phase23_5_FeedIntegrityRegression.runSuite();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Phase 23.5 regression execution failed"
    });
  }
});

newsCoreV2Router.get("/regression-23-5-c", async (req: Request, res: Response) => {
  try {
    const report = await Phase23_5_C_RuntimeIntegrityRegression.runSuite();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Phase 23.5-C runtime integrity regression execution failed"
    });
  }
});

newsCoreV2Router.get("/regression-23-5-d", async (req: Request, res: Response) => {
  try {
    const report = await Phase23_5_D_ForensicAudit.runSuite();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message || "Phase 23.5-D forensic audit execution failed"
    });
  }
});

import { TelegramNotificationStateStore } from "../../news/NewsEngine/TelegramNotificationStateStore.ts";
import { TelegramQualityGate } from "../../news/NewsEngine/TelegramQualityGate.ts";

newsCoreV2Router.get("/diagnostics/article/:articleId", (req: Request, res: Response) => {
  try {
    const articleId = req.params.articleId;
    const article = newsStore.getAllArticles().find(a => a.id === articleId);

    if (!article) {
      return res.status(404).json({ status: "error", message: "Article not found" });
    }

    const stateStore = TelegramNotificationStateStore.getInstance();
    const telegramState = stateStore.getAllStates().find(s => s.articleId === articleId);

    let qgEval = null;
    try {
      qgEval = TelegramQualityGate.evaluate(article, { watermarkIso: "2020-01-01T00:00:00Z" });
    } catch(e) {}

    const inFeed = newsStore.getAllArticles().some(a => a.id === articleId);
    const inFno = newsStore.getFNOArticles().some(a => a.id === articleId);

    res.json({
      status: "success",
      diagnostic: {
        articleId: article.id,
        canonicalUrl: article.canonicalUrl || article.source?.url,
        headline: article.headline,
        publisher: article.source?.publisher,
        publishedAt: article.publishedAt,
        detectedEntity: article.fno?.symbol,
        resolvedFnoSymbol: article.fno?.symbol,
        fnoEligibility: article.fno?.eligible,
        fnoConfidence: article.fno?.confidence,
        fnoDecision: article.fno?.decision,
        fnoReason: article.fno?.reason,
        metrics: article.keyMetrics,
        whyItMatters: article.whyItMatters,
        marketImpact: article.marketImpact,
        catalyst: article.category,
        materialityScore: qgEval?.materialityScore,
        fnoRelevanceScore: article.relevanceScore,
        telegramDecision: qgEval?.decision,
        telegramReason: qgEval?.reason,
        telegramState: telegramState?.status || "NOT_FOUND",
        isOldWatermark: new Date(article.publishedAt) < new Date("2024-08-01T00:00:00Z"),
        isDuplicate: qgEval?.isDuplicateCluster,
        inPersistentStore: true,
        inFeed: inFeed,
        inFno: inFno,
        qgEvaluated: !!qgEval
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});
