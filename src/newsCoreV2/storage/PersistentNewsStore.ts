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
   * Hydrates in-memory map from persistent disk file on startup with backup safety.
   * Re-evaluates persisted articles using current deterministic FNO and NewsClassifier rules.
   */
  public hydrateFromDisk(): void {
    try {
      const backupPath = `${this.filePath}.bak`;
      let primaryParsed: any[] | null = null;
      let backupParsed: any[] | null = null;

      if (fs.existsSync(this.filePath)) {
        try {
          const rawPrimary = fs.readFileSync(this.filePath, "utf-8");
          if (rawPrimary && rawPrimary.trim()) {
            const parsed = JSON.parse(rawPrimary);
            if (Array.isArray(parsed)) {
              primaryParsed = parsed;
            }
          }
        } catch (e) {
          console.warn("[PersistentNewsStore] Primary store JSON parse failed.");
        }
      }

      if (fs.existsSync(backupPath)) {
        try {
          const rawBackup = fs.readFileSync(backupPath, "utf-8");
          if (rawBackup && rawBackup.trim()) {
            const parsed = JSON.parse(rawBackup);
            if (Array.isArray(parsed)) {
              backupParsed = parsed;
            }
          }
        } catch (e) {
          console.warn("[PersistentNewsStore] Backup store JSON parse failed.");
        }
      }

      let chosenArticles: any[] = [];
      if (primaryParsed && backupParsed) {
        if (primaryParsed.length >= backupParsed.length) {
          chosenArticles = primaryParsed;
        } else {
          console.warn(`[PersistentNewsStore] SUSPICIOUS SHRINK DETECTED ON HYDRATION: Primary has ${primaryParsed.length} records, but backup has ${backupParsed.length}. Automatically restoring from backup.`);
          chosenArticles = backupParsed;
          fs.writeFileSync(this.filePath, JSON.stringify(backupParsed, null, 2), "utf-8");
        }
      } else if (primaryParsed) {
        chosenArticles = primaryParsed;
      } else if (backupParsed) {
        console.warn(`[PersistentNewsStore] Primary store missing or invalid. Restoring from backup with ${backupParsed.length} records.`);
        chosenArticles = backupParsed;
        fs.writeFileSync(this.filePath, JSON.stringify(backupParsed, null, 2), "utf-8");
      }

      if (chosenArticles.length > 0) {
        this.articles = chosenArticles;
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
          this.saveToDisk(true);
        }

        console.log(`[PersistentNewsStore] Hydrated ${this.articles.length} articles from disk (${this.filePath})`);
      }
    } catch (e: any) {
      console.warn("[PersistentNewsStore] Could not hydrate disk store:", e.message);
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Saves articles atomically to disk with strict backup safety and dataset shrink protection.
   */
  private saveToDisk(force = false): void {
    try {
      this.ensureDirectoryExists();
      const backupPath = `${this.filePath}.bak`;
      const tempPath = `${this.filePath}.tmp`;

      let previousCount = 0;
      if (fs.existsSync(this.filePath)) {
        try {
          const existingRaw = fs.readFileSync(this.filePath, "utf-8");
          const existingParsed = JSON.parse(existingRaw);
          if (Array.isArray(existingParsed)) {
            previousCount = existingParsed.length;
          }
        } catch (e) {}
      }

      const candidateCount = this.articles.length;

      if (!force && previousCount > 0 && candidateCount < previousCount) {
        console.warn(`[PERSISTENCE_GUARD] WRITE_REJECTED previousCount=${previousCount} candidateCount=${candidateCount} reason=DATASET_SHRINK`);
        return;
      }

      const dataStr = JSON.stringify(this.articles, null, 2);

      fs.writeFileSync(tempPath, dataStr, "utf-8");

      const tempRaw = fs.readFileSync(tempPath, "utf-8");
      const tempParsed = JSON.parse(tempRaw);
      if (!Array.isArray(tempParsed)) {
        throw new Error("Temporary file is not a valid array JSON");
      }

      if (fs.existsSync(this.filePath)) {
        fs.copyFileSync(this.filePath, backupPath);
      }

      fs.renameSync(tempPath, this.filePath);

      const verifyRaw = fs.readFileSync(this.filePath, "utf-8");
      const verifyParsed = JSON.parse(verifyRaw);
      if (!Array.isArray(verifyParsed) || verifyParsed.length !== candidateCount) {
        throw new Error("Verification of written canonical file failed count match");
      }
    } catch (e: any) {
      console.error("[PersistentNewsStore] Atomic disk write failed:", e.message);
      const backupPath = `${this.filePath}.bak`;
      if (fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, this.filePath);
          console.log("[PersistentNewsStore] Successfully restored from .bak after write failure.");
        } catch (restoreErr) {
          console.error("[PersistentNewsStore] Failed to restore from backup:", restoreErr);
        }
      }
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
