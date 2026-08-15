import { SyncState, SyncStatusReport } from "./SyncState.ts";
import { CollectorRegistry } from "../ingestion/CollectorRegistry.ts";
import { NewsNormalizer } from "../normalization/NewsNormalizer.ts";
import { FNOEligibilityEngine } from "../fno/FNOEligibilityEngine.ts";
import { TelegramNotificationPipeline } from "../../news/NewsEngine/TelegramNotificationPipeline.ts";
import { NewsClassifier } from "../classification/NewsClassifier.ts";
import { NewsArticleV2 } from "../domain/NewsArticle.ts";
import { newsStore, PersistentNewsStore } from "../storage/PersistentNewsStore.ts";
import { SummaryEngine } from "../summary/SummaryEngine.ts";
import crypto from "crypto";

import { TelegramOutbox, TelegramOutboxEntry } from "../storage/TelegramOutbox.ts";

export class NewsSyncService {
  private collectorRegistry: CollectorRegistry;
  private store: PersistentNewsStore;
  private outbox: TelegramOutbox;

  private syncState: SyncState = "IDLE";
  private lastSuccessfulSyncAt: string | null = null;
  private lastAttemptAt: string | null = null;
  private nextSyncAt: string | null = null;
  private lastSyncItemCount = 0;
  private lastSyncDurationMs: number | null = null;
  private lastError: string | null = null;

  private autoSyncIntervalMs = 60000; // 60 seconds interval
  private timer: NodeJS.Timeout | null = null;

  // ... (existing constructor)
  constructor(store?: PersistentNewsStore) {
    this.collectorRegistry = new CollectorRegistry();
    this.store = store || newsStore;
    this.outbox = new TelegramOutbox();
    this.startOutboxProcessor();
  }

  private startOutboxProcessor(): void {
    setInterval(async () => {
      const entries = this.outbox.getEntries();
      for (const entry of entries) {
        // Implement retry logic with backoff
        if (entry.nextRetryAt && new Date(entry.nextRetryAt) > new Date()) continue;
        
        try {
            await TelegramNotificationPipeline.getInstance().processArticle(entry.payload);
            this.outbox.removeEntry(entry.articleId);
        } catch (err: any) {
            entry.attempts++;
            entry.lastAttemptAt = new Date().toISOString();
            // Simple exponential backoff: 1m, 2m, 4m, 8m...
            const delay = Math.pow(2, entry.attempts - 1) * 60000;
            entry.nextRetryAt = new Date(Date.now() + delay).toISOString();
            console.warn(`[NewsSyncService] Telegram retry ${entry.attempts} for ${entry.articleId} in ${delay}ms`);
        }
      }
    }, 60000); // Check outbox every minute
  }

  public getStatus(): SyncStatusReport {
    return {
      syncState: this.syncState,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      lastAttemptAt: this.lastAttemptAt,
      nextSyncAt: this.nextSyncAt,
      lastSyncItemCount: this.lastSyncItemCount,
      lastSyncDurationMs: this.lastSyncDurationMs,
      lastError: this.lastError
    };
  }

  public getActiveCollectorsCount(): number {
    return this.collectorRegistry.getActiveCollectorsCount();
  }

  /**
   * Starts the background scheduler loop. Ensures only one timer exists.
   */
  public startScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.scheduleNextRun();
    this.timer = setInterval(() => {
      this.runSync().catch((err) => {
        console.error("[NewsSyncService] Unhandled sync error:", err);
      });
    }, this.autoSyncIntervalMs);

    // Run initial sync in background on boot
    setTimeout(() => {
      this.runSync().catch((e) => console.error("[NewsSyncService] Initial boot sync error:", e));
    }, 2000);
  }

  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextRun(): void {
    const nextDate = new Date(Date.now() + this.autoSyncIntervalMs);
    this.nextSyncAt = nextDate.toISOString();
  }

  /**
   * Executes a full synchronization pipeline with strict timeout protection and guaranteed terminal state.
   */
  public async runSync(): Promise<{ status: SyncState; itemsProcessed: number; newAdded: number }> {
    if (this.syncState === "SYNCING") {
      console.log("[NewsSyncService] Sync already in progress, skipping duplicate call.");
      return { status: "SYNCING", itemsProcessed: 0, newAdded: 0 };
    }

    this.syncState = "SYNCING";
    this.lastAttemptAt = new Date().toISOString();
    this.lastError = null;
    const startTime = Date.now();
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.store.lastSyncId = syncId;
    this.store.lastSyncStart = this.lastAttemptAt;
    this.store.lastSyncEnd = null;
    this.store.lastSyncStatus = "SYNCING";

    let itemsProcessed = 0;
    let newAdded = 0;

    // 60 second global timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("News sync operation timed out after 60 seconds")), 60000);
    });

    try {
      const syncWork = async () => {
        // Step 1: Collect raw items concurrently
        const rawItems = await this.collectorRegistry.collectAll();
        itemsProcessed = rawItems.length;

        const processedArticles: NewsArticleV2[] = [];
        const nowIso = new Date().toISOString();

        // Step 2: Normalize, classify, and create canonical articles
        for (const raw of rawItems) {
          const headline = NewsNormalizer.cleanText(raw.headline);
          const body = NewsNormalizer.cleanText(raw.body || headline);
          const canonicalUrl = NewsNormalizer.normalizeCanonicalUrl(raw.url);

          if (!headline || headline.length < 5) continue;

          // Deterministic F&O evaluation
          const fnoResult = FNOEligibilityEngine.evaluate(headline, body);

          // Deterministic Classification
          const classification = NewsClassifier.classify(
            headline,
            body,
            raw.publisher,
            fnoResult
          );

          // Generate stable article ID
          const hashInput = canonicalUrl || `${raw.publisher}:${headline}`;
          const id = "v2_" + crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

          const article: NewsArticleV2 = {
            id,
            canonicalUrl,
            headline,
            body,
            source: {
              publisher: raw.publisher || "Unknown",
              url: canonicalUrl || raw.url || "",
              collectionMethod: raw.collectionMethod || "RSS"
            },
            publishedAt: NewsNormalizer.normalizeDate(raw.publishedAt),
            collectedAt: nowIso,
            category: classification.category,
            sentiment: classification.sentiment,
            relevanceScore: classification.relevanceScore,
            primaryCategory: classification.primaryCategory,
            secondaryCategories: classification.secondaryCategories,
            eventType: classification.eventType,
            categoryConfidence: classification.categoryConfidence,
            classificationEvidence: classification.classificationEvidence,
            fno: fnoResult
          };

          processedArticles.push(article);
        }

        // Step 3: Atomic write to Persistent Store
        const savedArticles = await this.store.saveArticles(processedArticles);
        newAdded = savedArticles.length;
        this.lastSyncItemCount = newAdded;
        this.lastSuccessfulSyncAt = new Date().toISOString();

        // Step 4: Dispatch newly ingested articles through Telegram Notification Pipeline
        if (savedArticles.length > 0) {
          const pipeline = TelegramNotificationPipeline.getInstance();
          for (const art of savedArticles) {
            try {
              const summaryData = SummaryEngine.generateDeterministicSummarySync(art);
              art.summary = summaryData.summary;
              art.whatChanged = summaryData.whatChanged;
              art.keyMetrics = summaryData.keyMetrics;
              art.whyItMatters = summaryData.whyItMatters;
              art.marketImpact = summaryData.marketImpact;
              art.riskWatchpoints = summaryData.riskWatchpoints;
              art.summaryConfidence = summaryData.confidence;
              art.summaryProcessingMode = summaryData.processingMode;
                
              // Re-persist article with summary so UI sees it
              await this.store.upsertArticle(art);
                
              // Add to outbox instead of immediate dispatch
              this.outbox.addEntry(art.id, art);
            } catch (err) {
              console.warn('[NewsSyncService] Telegram outbox entry error for article', art.id, err);
            }
          }
        }

        return "COMPLETED" as SyncState;
      };

      const finalStatus = await Promise.race([syncWork(), timeoutPromise]);
      this.syncState = finalStatus;
    } catch (err: any) {
      console.error("[NewsSyncService] Sync failed:", err.message);
      this.syncState = "FAILED";
      this.lastError = err.message || "Sync execution failed";
    } finally {
      this.lastSyncDurationMs = Date.now() - startTime;
      this.store.lastSyncEnd = new Date().toISOString();
      this.store.lastSyncStatus = this.syncState;
      this.scheduleNextRun();
    }

    return {
      status: this.syncState,
      itemsProcessed,
      newAdded
    };
  }
}

// Global Singleton Instance
const globalSyncKey = "__NEWS_CORE_V2_SYNC_SINGLETON__";
if (!(global as any)[globalSyncKey]) {
  const service = new NewsSyncService();
  (global as any)[globalSyncKey] = service;
}

export const newsSyncService: NewsSyncService = (global as any)[globalSyncKey];
