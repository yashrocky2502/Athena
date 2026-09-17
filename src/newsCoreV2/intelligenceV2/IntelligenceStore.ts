import fs from "fs";
import path from "path";
import { IntelligenceRecord } from "./IntelligenceTypes.ts";

/**
 * Deterministic timestamp sorting comparator for IntelligenceRecord persistence retention.
 * Sorts descending (newest records first):
 * 1. Authoritative generation timestamp: generatedAt (ISO string converted to milliseconds)
 * 2. Secondary publication timestamp: publishedAt (ISO string converted to milliseconds)
 * 3. Deterministic alphabetical tie-breaker: articleId localeCompare
 */
function getRecordTimestamp(rec: any): number {
  if (rec && rec.generatedAt) {
    const t = new Date(rec.generatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (rec && rec.publishedAt) {
    const t = new Date(rec.publishedAt).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

function compareRecordsDescending(a: any, b: any): number {
  const timeA = getRecordTimestamp(a);
  const timeB = getRecordTimestamp(b);
  if (timeB !== timeA) {
    return timeB - timeA;
  }
  const idA = String((a && a.articleId) || "");
  const idB = String((b && b.articleId) || "");
  return idA.localeCompare(idB);
}

export class IntelligenceStore {
  private static instance: IntelligenceStore;
  private static shutdownRegistered: boolean = false;

  private cache: Map<string, IntelligenceRecord> = new Map();
  // Safe forward-compatible preservation for legacy or alternate version records
  private legacyRecords: Map<string, IntelligenceRecord> = new Map();

  private filePath: string;
  private backupPath: string;
  private readonly version = "27.4";
  private isSaving: boolean = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  public constructor(customFilePath?: string, customBackupPath?: string) {
    if (typeof window !== "undefined") {
      this.filePath = "";
      this.backupPath = "";
      return;
    }
    this.filePath = customFilePath || path.join(process.cwd(), "data", "news_intelligence_v2.json");
    this.backupPath = customBackupPath || (customFilePath ? `${customFilePath}.bak` : path.join(process.cwd(), "data", "news_intelligence_v2.json.bak"));
    this.hydrateFromDisk();
    this.registerShutdownHandler();
  }

  public static getInstance(): IntelligenceStore {
    if (!IntelligenceStore.instance) {
      IntelligenceStore.instance = new IntelligenceStore();
    }
    return IntelligenceStore.instance;
  }

  public static resetInstance(customFilePath?: string, customBackupPath?: string): void {
    if (!customFilePath || typeof customFilePath !== "string" || customFilePath.trim() === "") {
      throw new Error("[IntelligenceStore] resetInstance() requires explicit customFilePath for test isolation. Call resetInstanceForProduction() if production reset is intended.");
    }
    if (IntelligenceStore.instance) {
      IntelligenceStore.instance.flushToDisk();
    }
    IntelligenceStore.instance = new IntelligenceStore(customFilePath, customBackupPath);
  }

  public static resetInstanceForProduction(): void {
    if (IntelligenceStore.instance) {
      IntelligenceStore.instance.flushToDisk();
    }
    IntelligenceStore.instance = new IntelligenceStore();
  }

  private ensureDirectoryExists(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      // Directory creation warning ignored
    }
  }

  private registerShutdownHandler(): void {
    if (typeof process === "undefined") return;
    if (process.env.VITEST || process.env.NODE_ENV === "test") return;
    if (IntelligenceStore.shutdownRegistered) return;

    const onShutdown = () => {
      try {
        if (IntelligenceStore.instance) {
          IntelligenceStore.instance.flushToDisk();
        }
      } catch (e) {
        // Safe exit
      }
    };

    try {
      process.once("SIGTERM", onShutdown);
      process.once("SIGINT", onShutdown);
      IntelligenceStore.shutdownRegistered = true;
    } catch {}
  }

  public hydrateFromDisk(): void {
    try {
      this.ensureDirectoryExists();
      let hydrated = false;

      if (fs.existsSync(this.filePath)) {
        try {
          const raw = fs.readFileSync(this.filePath, "utf-8");
          if (raw && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              this.cache.clear();
              this.legacyRecords.clear();
              for (const rec of parsed) {
                if (rec && rec.articleId) {
                  if (rec.intelligenceVersion === this.version) {
                    const key = `${rec.articleId}_${rec.intelligenceVersion}`;
                    this.cache.set(key, rec);
                  } else {
                    // Forward-compatible legacy record preservation
                    const key = `${rec.articleId}_${rec.intelligenceVersion || "unknown"}`;
                    this.legacyRecords.set(key, rec);
                  }
                }
              }
              hydrated = true;
            }
          }
        } catch (primaryErr: any) {
          console.warn("[IntelligenceStore] Primary hydration failed, attempting backup recovery:", primaryErr?.message);
        }
      }

      // If primary is missing or invalid, attempt recovery from valid backup
      if (!hydrated && this.backupPath && fs.existsSync(this.backupPath)) {
        try {
          const rawBackup = fs.readFileSync(this.backupPath, "utf-8");
          if (rawBackup && rawBackup.trim()) {
            const parsedBackup = JSON.parse(rawBackup);
            if (Array.isArray(parsedBackup)) {
              this.cache.clear();
              this.legacyRecords.clear();
              for (const rec of parsedBackup) {
                if (rec && rec.articleId) {
                  if (rec.intelligenceVersion === this.version) {
                    const key = `${rec.articleId}_${rec.intelligenceVersion}`;
                    this.cache.set(key, rec);
                  } else {
                    const key = `${rec.articleId}_${rec.intelligenceVersion || "unknown"}`;
                    this.legacyRecords.set(key, rec);
                  }
                }
              }
              hydrated = true;
              console.warn("[IntelligenceStore] Hydrated successfully from backupPath:", this.backupPath);
            }
          }
        } catch (backupErr: any) {
          console.error("[IntelligenceStore] Backup recovery failed:", backupErr?.message);
        }
      }
    } catch (err: any) {
      console.warn("[IntelligenceStore] Hydrate error:", err?.message);
    }
  }

  /**
   * Deterministically sorts and selects up to 3,000 newest records for persistence.
   * Merges active v27.4 cache with preserved legacy/different-version records.
   */
  private getRecordsForPersistence(): IntelligenceRecord[] {
    const currentRecords = Array.from(this.cache.values());
    const preservedLegacy = Array.from(this.legacyRecords.values());
    const all = [...currentRecords, ...preservedLegacy];

    all.sort(compareRecordsDescending);

    return all.slice(0, 3000);
  }

  /**
   * Synchronously executes atomic save sequence with candidate validation,
   * snapshot backup, shrink guard, and orphan temp cleanup.
   */
  public executeAtomicSaveSync(): void {
    // Protect production dataset from test suite mutation
    if ((process.env.VITEST || process.env.NODE_ENV === "test") && this.filePath.includes("news_intelligence_v2.json")) {
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;

    const tempPath = `${this.filePath}.tmp`;
    try {
      this.ensureDirectoryExists();
      const recordsToPersist = this.getRecordsForPersistence();

      // Assess current primary on disk for backup snapshot and shrink guard
      let currentDiskCount = 0;
      let primaryValid = false;
      if (fs.existsSync(this.filePath)) {
        try {
          const rawCurrent = fs.readFileSync(this.filePath, "utf-8");
          if (rawCurrent && rawCurrent.trim()) {
            const parsedCurrent = JSON.parse(rawCurrent);
            if (Array.isArray(parsedCurrent)) {
              currentDiskCount = parsedCurrent.length;
              primaryValid = true;
            }
          }
        } catch {
          primaryValid = false;
        }
      }

      // Shrink guard check
      if (currentDiskCount > 0 && recordsToPersist.length === 0) {
        throw new Error(`[IntelligenceStore] Shrink guard rejected empty candidate persistence (current disk count: ${currentDiskCount})`);
      }
      if (currentDiskCount > 50 && recordsToPersist.length < currentDiskCount * 0.8) {
        throw new Error(`[IntelligenceStore] Shrink guard rejected anomalous count drop from ${currentDiskCount} to ${recordsToPersist.length}`);
      }

      // Step 1: Write candidate to same-directory temp file
      const payload = JSON.stringify(recordsToPersist, null, 2);
      fs.writeFileSync(tempPath, payload, "utf-8");

      // Step 2: Read candidate back
      const readBack = fs.readFileSync(tempPath, "utf-8");

      // Step 3: JSON.parse()
      const candidateParsed = JSON.parse(readBack);

      // Step 4: Require Array.isArray()
      if (!Array.isArray(candidateParsed)) {
        throw new Error("[IntelligenceStore] Serialized candidate is not a JSON array");
      }

      // Step 5: Validate required identity and version fields
      for (const item of candidateParsed) {
        if (!item || typeof item !== "object" || !item.articleId || typeof item.articleId !== "string" || !item.intelligenceVersion || typeof item.intelligenceVersion !== "string") {
          throw new Error("[IntelligenceStore] Serialized candidate record missing required articleId or intelligenceVersion");
        }
      }

      // Step 6: Verify candidate count matches prepared count
      if (candidateParsed.length !== recordsToPersist.length) {
        throw new Error(`[IntelligenceStore] Candidate record count mismatch: expected ${recordsToPersist.length}, got ${candidateParsed.length}`);
      }

      // Step 6.5: Candidate verified completely valid. Snapshot existing primary to backup before promotion
      if (primaryValid && this.backupPath) {
        try {
          fs.copyFileSync(this.filePath, this.backupPath);
        } catch (backupErr: any) {
          console.warn("[IntelligenceStore] Failed to update backup:", backupErr?.message);
        }
      }

      // Step 7: Atomic rename promotion
      fs.renameSync(tempPath, this.filePath);

    } catch (err: any) {
      console.error("[IntelligenceStore] Save error:", err?.message || err);
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {}
      throw err;
    } finally {
      this.isSaving = false;
    }
  }

  public saveToDisk(): void {
    // Protect production dataset from test suite mutation
    if ((process.env.VITEST || process.env.NODE_ENV === "test") && this.filePath.includes("news_intelligence_v2.json")) {
      return;
    }

    if (this.saveTimeout) return;
    
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      try {
        this.executeAtomicSaveSync();
      } catch (err: any) {
        // Error already handled and logged by executeAtomicSaveSync
      }
    }, 1000); // Debounce saves by 1 second
  }

  /**
   * Synchronously flushes any pending debounced save to disk.
   */
  public flushToDisk(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      this.executeAtomicSaveSync();
    } catch (err: any) {
      // Logged by executeAtomicSaveSync
    }
  }

  public get(articleId: string, version: string = this.version): IntelligenceRecord | null {
    if (!articleId) return null;
    const key = `${articleId}_${version}`;
    return this.cache.get(key) || null;
  }

  public set(record: IntelligenceRecord): void {
    if (!record || !record.articleId) return;
    const key = `${record.articleId}_${record.intelligenceVersion || this.version}`;
    this.cache.set(key, record);
    this.saveToDisk();
  }

  public clear(): void {
    this.cache.clear();
    this.legacyRecords.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  public totalSize(): number {
    return this.cache.size + this.legacyRecords.size;
  }

  public legacySize(): number {
    return this.legacyRecords.size;
  }
}
