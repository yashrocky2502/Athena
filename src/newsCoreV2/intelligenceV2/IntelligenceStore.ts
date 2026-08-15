import fs from "fs";
import path from "path";
import { IntelligenceRecord } from "./IntelligenceTypes.ts";

export class IntelligenceStore {
  private static instance: IntelligenceStore;
  private cache: Map<string, IntelligenceRecord> = new Map();
  private filePath: string;
  private readonly version = "27.3";

  private constructor() {
    this.filePath = path.join(process.cwd(), "data", "news_intelligence_v2.json");
    this.hydrateFromDisk();
  }

  public static getInstance(): IntelligenceStore {
    if (!IntelligenceStore.instance) {
      IntelligenceStore.instance = new IntelligenceStore();
    }
    return IntelligenceStore.instance;
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

  public hydrateFromDisk(): void {
    try {
      this.ensureDirectoryExists();
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.cache.clear();
            for (const rec of parsed) {
              if (rec.articleId && rec.intelligenceVersion === this.version) {
                const key = `${rec.articleId}_${rec.intelligenceVersion}`;
                this.cache.set(key, rec);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("[IntelligenceStore] Hydrate error:", err?.message);
    }
  }

  private saveTimeout: NodeJS.Timeout | null = null;

  public saveToDisk(): void {
    if (this.saveTimeout) return;
    
    this.saveTimeout = setTimeout(() => {
      try {
        this.ensureDirectoryExists();
        const records = Array.from(this.cache.values());
        const tempPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(records.slice(0, 3000), null, 2), "utf-8");
        fs.renameSync(tempPath, this.filePath);
      } catch (err: any) {
        console.error("[IntelligenceStore] Save error:", err?.message);
      } finally {
        this.saveTimeout = null;
      }
    }, 1000); // Debounce saves by 1 second
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
  }

  public size(): number {
    return this.cache.size;
  }
}
