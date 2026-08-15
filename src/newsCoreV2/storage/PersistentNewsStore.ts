import fs from "fs";
import path from "path";
import { NewsArticleV2 } from "../domain/NewsArticle";
import { CanonicalDeduplicator } from "../deduplication/CanonicalDeduplicator";
import { FNOEligibilityEngine } from "../fno/FNOEligibilityEngine";
import { NewsClassifier } from "../classification/NewsClassifier";

export interface NewsStoreStats {
  storageCount: number;
  apiCount: number;
  uniqueArticleIds: number;
  duplicateIds: number;
  duplicateCanonicalUrls: number;
  activeCollectors: number;
}

export class PersistentNewsStore {
  private filePath: string;
  private articles: NewsArticleV2[] = [];
  private articleMap: Map<string, NewsArticleV2> = new Map();
  private isLoaded = false;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), "data", "news_core_v2.json");
    this.ensureDirectoryExists();
    this.hydrateFromDisk();
  }

  private ensureDirectoryExists(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error("[PersistentNewsStore] Failed to create directory:", e);
    }
  }

  /**
   * Hydrates in-memory map from persistent disk file on startup.
   * Re-evaluates persisted articles using current deterministic FNO and NewsClassifier rules.
   */
  public hydrateFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.articles = parsed;
            this.articleMap.clear();
            let hasChanges = false;

            for (const art of this.articles) {
              if (art.id) {
                const fnoResult = FNOEligibilityEngine.evaluate(
                  art.headline || "",
                  art.body || ""
                );
                const classification = NewsClassifier.classify(
                  art.headline || "",
                  art.body || "",
                  art.source?.publisher || "",
                  fnoResult
                );

                const prevFnoEligible = art.fno?.eligible;
                const prevFnoDecision = art.fno?.decision;
                const prevFnoSymbol = art.fno?.symbol;
                const prevCategory = art.category;
                const prevPrimaryCategory = art.primaryCategory;
                const prevSecondaryCategories = JSON.stringify(art.secondaryCategories || []);
                const prevEventType = art.eventType;

                const newSecondaryCategories = JSON.stringify(classification.secondaryCategories || []);

                if (
                  prevFnoEligible !== fnoResult.eligible ||
                  prevFnoDecision !== fnoResult.decision ||
                  prevFnoSymbol !== fnoResult.symbol ||
                  prevCategory !== classification.category ||
                  prevPrimaryCategory !== classification.primaryCategory ||
                  prevSecondaryCategories !== newSecondaryCategories ||
                  prevEventType !== classification.eventType
                ) {
                  hasChanges = true;
                }

                art.fno = fnoResult;
                art.category = classification.category;
                art.primaryCategory = classification.primaryCategory;
                art.secondaryCategories = classification.secondaryCategories;
                art.eventType = classification.eventType;
                art.categoryConfidence = classification.categoryConfidence;
                art.classificationEvidence = classification.classificationEvidence;

                this.articleMap.set(art.id, art);
              }
            }

            if (hasChanges) {
              console.log(`[PersistentNewsStore] Reclassified persisted articles with current rules. Persisting updated store...`);
              this.saveToDisk();
            }

            console.log(`[PersistentNewsStore] Hydrated ${this.articles.length} articles from disk (${this.filePath})`);
          }
        }
      }
    } catch (e: any) {
      console.warn("[PersistentNewsStore] Could not hydrate disk store:", e.message);
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Saves articles atomically to disk to prevent corrupt file writes.
   */
  private saveToDisk(): void {
    try {
      this.ensureDirectoryExists();
      const tempPath = `${this.filePath}.tmp`;
      const dataStr = JSON.stringify(this.articles, null, 2);

      fs.writeFileSync(tempPath, dataStr, "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch (e: any) {
      console.error("[PersistentNewsStore] Atomic disk write failed:", e.message);
    }
  }

  /**
   * Saves or updates articles after canonical deduplication.
   */
  public saveArticles(newArticles: NewsArticleV2[]): NewsArticleV2[] {
    if (!newArticles || newArticles.length === 0) return [];

    const { uniqueArticles } = CanonicalDeduplicator.deduplicate(newArticles, this.articles);

    if (uniqueArticles.length === 0) return [];

    for (const art of uniqueArticles) {
      this.articleMap.set(art.id, art);
    }

    // Re-build array sorted by publishedAt descending
    this.articles = Array.from(this.articleMap.values()).sort((a, b) => {
      const timeA = new Date(a.publishedAt || a.collectedAt).getTime();
      const timeB = new Date(b.publishedAt || b.collectedAt).getTime();
      return timeB - timeA;
    });

    this.saveToDisk();
    return uniqueArticles;
  }

  /**
   * Upserts a single article.
   */
  public upsertArticle(article: NewsArticleV2): number {
    return this.saveArticles([article]).length;
  }

  /**
   * Returns an article by its ID.
   */
  public getArticle(id: string): NewsArticleV2 | undefined {
    return this.articleMap.get(id);
  }

  /**
   * Returns all stored articles.
   */
  public getAllArticles(): NewsArticleV2[] {
    return [...this.articles];
  }

  /**
   * Returns articles filtered by F&O eligibility.
   */
  public getFNOArticles(): NewsArticleV2[] {
    return this.articles.filter(
      (a) => a.fno && a.fno.eligible && a.fno.decision === "INCLUDE"
    );
  }

  /**
   * Performs bulk reclassification on stored articles asynchronously in batches.
   */
  public async reclassifyArticles(force: boolean, limit: number): Promise<{ processed: number; updated: number }> {
    let processed = 0;
    let updated = 0;
    const batchLimit = limit > 0 ? limit : 50;

    for (const art of this.articles) {
      // If not forcing, skip articles that already have canonical primaryCategory classification
      if (!force && art.primaryCategory) {
        continue;
      }

      if (processed >= batchLimit) {
        break;
      }

      const fnoResult = FNOEligibilityEngine.evaluate(
        art.headline || "",
        art.body || ""
      );
      const classification = NewsClassifier.classify(
        art.headline || "",
        art.body || "",
        art.source?.publisher || "",
        fnoResult
      );

      const prevFnoEligible = art.fno?.eligible;
      const prevFnoDecision = art.fno?.decision;
      const prevFnoSymbol = art.fno?.symbol;
      const prevCategory = art.category;
      const prevPrimaryCategory = art.primaryCategory;
      const prevSecondaryCategories = JSON.stringify(art.secondaryCategories || []);
      const prevEventType = art.eventType;

      const newSecondaryCategories = JSON.stringify(classification.secondaryCategories || []);

      const hasChanges = (
        prevFnoEligible !== fnoResult.eligible ||
        prevFnoDecision !== fnoResult.decision ||
        prevFnoSymbol !== fnoResult.symbol ||
        prevCategory !== classification.category ||
        prevPrimaryCategory !== classification.primaryCategory ||
        prevSecondaryCategories !== newSecondaryCategories ||
        prevEventType !== classification.eventType
      );

      if (hasChanges) {
        art.fno = fnoResult;
        art.category = classification.category;
        art.primaryCategory = classification.primaryCategory;
        art.secondaryCategories = classification.secondaryCategories;
        art.eventType = classification.eventType;
        art.categoryConfidence = classification.categoryConfidence;
        art.classificationEvidence = classification.classificationEvidence;
        
        this.articleMap.set(art.id, art);
        updated++;
      }

      processed++;
    }

    if (updated > 0) {
      this.saveToDisk();
    }

    return { processed, updated };
  }

  /**
   * Computes exact storage diagnostic statistics.
   */
  public getStats(activeCollectorsCount = 0): NewsStoreStats {
    const uniqueIds = new Set<string>();
    const uniqueUrls = new Set<string>();
    let duplicateIds = 0;
    let duplicateCanonicalUrls = 0;

    for (const art of this.articles) {
      if (uniqueIds.has(art.id)) {
        duplicateIds++;
      } else {
        uniqueIds.add(art.id);
      }

      if (art.canonicalUrl) {
        if (uniqueUrls.has(art.canonicalUrl)) {
          duplicateCanonicalUrls++;
        } else {
          uniqueUrls.add(art.canonicalUrl);
        }
      }
    }

    return {
      storageCount: this.articles.length,
      apiCount: this.articles.length,
      uniqueArticleIds: uniqueIds.size,
      duplicateIds,
      duplicateCanonicalUrls,
      activeCollectors: activeCollectorsCount
    };
  }
}

// Global Singleton Instance to survive dev server hot-reloads
const globalStoreKey = "__NEWS_CORE_V2_STORE_SINGLETON__";
if (!(global as any)[globalStoreKey]) {
  (global as any)[globalStoreKey] = new PersistentNewsStore();
}

export const newsStore: PersistentNewsStore = (global as any)[globalStoreKey];
