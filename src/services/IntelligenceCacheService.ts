import { AthenaIntelligence } from "../types";
import { safeLocalStorage } from "./storage/safeStorage";

let fs: any = null;
if (typeof window === "undefined") {
  try {
    fs = eval("require")("fs");
  } catch (e) {}
}

export class IntelligenceCacheService {
  private static instance: IntelligenceCacheService;
  private cacheMap: Map<string, { intelligence: AthenaIntelligence; timestamp: number }> = new Map();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CACHE_FILE = (typeof window === "undefined" && typeof process !== "undefined" && typeof process.cwd === "function")
    ? `${process.cwd()}/athena_intelligence_v2_cache.json`
    : "";

  private constructor() {
    this.loadCache();
  }

  public static getInstance(): IntelligenceCacheService {
    if (!IntelligenceCacheService.instance) {
      IntelligenceCacheService.instance = new IntelligenceCacheService();
    }
    return IntelligenceCacheService.instance;
  }

  public generateKey(publisher: string, headline: string, publishedAt: string): string {
    const pub = (publisher || "unknown").trim().toLowerCase();
    const head = (headline || "untitled").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const date = (publishedAt || "today").trim().substring(0, 10);
    return `athena_intel_v2_${pub}_${head}_${date}`;
  }

  public get(publisher: string, headline: string, publishedAt: string): AthenaIntelligence | null {
    const key = this.generateKey(publisher, headline, publishedAt);
    const entry = this.cacheMap.get(key);

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.TTL_MS) {
      this.cacheMap.delete(key);
      this.saveCache();
      return null;
    }

    return entry.intelligence;
  }

  public set(publisher: string, headline: string, publishedAt: string, intelligence: AthenaIntelligence): void {
    const key = this.generateKey(publisher, headline, publishedAt);
    this.cacheMap.set(key, {
      intelligence,
      timestamp: Date.now()
    });
    this.saveCache();
  }

  public has(publisher: string, headline: string, publishedAt: string): boolean {
    return this.get(publisher, headline, publishedAt) !== null;
  }

  public getByHash(documentHash: string): AthenaIntelligence | null {
    if (!documentHash) return null;
    const key = `hash_${documentHash}`;
    const entry = this.cacheMap.get(key);

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.TTL_MS) {
      this.cacheMap.delete(key);
      this.saveCache();
      return null;
    }

    return entry.intelligence;
  }

  public setByHash(documentHash: string, intelligence: AthenaIntelligence): void {
    if (!documentHash) return;
    const key = `hash_${documentHash}`;
    this.cacheMap.set(key, {
      intelligence,
      timestamp: Date.now()
    });
    this.saveCache();
  }

  public hasByHash(documentHash: string): boolean {
    return this.getByHash(documentHash) !== null;
  }

  private loadCache(): void {
    if (typeof window !== "undefined") {
      try {
        const raw = safeLocalStorage.getItem("athena_intelligence_v2_cache");
        if (raw) {
          const parsed = JSON.parse(raw);
          const now = Date.now();
          Object.keys(parsed).forEach(key => {
            const item = parsed[key];
            if (item && item.timestamp && (now - item.timestamp) < this.TTL_MS) {
              this.cacheMap.set(key, item);
            }
          });
        }
      } catch (err) {
        console.warn("[IntelligenceCacheService] Failed to load local storage cache:", err);
      }
    } else {
      try {
        if (IntelligenceCacheService.CACHE_FILE && fs && fs.existsSync && fs.existsSync(IntelligenceCacheService.CACHE_FILE)) {
          const raw = fs.readFileSync(IntelligenceCacheService.CACHE_FILE, "utf-8");
          const parsed = JSON.parse(raw);
          const now = Date.now();
          Object.keys(parsed).forEach(key => {
            const item = parsed[key];
            if (item && item.timestamp && (now - item.timestamp) < this.TTL_MS) {
              this.cacheMap.set(key, item);
            }
          });
          console.log(`[IntelligenceCacheService] Loaded ${this.cacheMap.size} cached reports from file.`);
        }
      } catch (err) {
        console.warn("[IntelligenceCacheService] Failed to load server-side file cache:", err);
      }
    }
  }

  private saveCache(): void {
    if (typeof window !== "undefined") {
      try {
        const obj: Record<string, any> = {};
        this.cacheMap.forEach((val, key) => {
          obj[key] = val;
        });
        safeLocalStorage.setItem("athena_intelligence_v2_cache", JSON.stringify(obj));
      } catch (err) {
        console.warn("[IntelligenceCacheService] Failed to save local storage cache:", err);
      }
    } else {
      try {
        if (IntelligenceCacheService.CACHE_FILE && fs && fs.writeFileSync) {
          const obj: Record<string, any> = {};
          this.cacheMap.forEach((val, key) => {
            obj[key] = val;
          });
          fs.writeFileSync(IntelligenceCacheService.CACHE_FILE, JSON.stringify(obj, null, 2), "utf-8");
        }
      } catch (err) {
        console.warn("[IntelligenceCacheService] Failed to save server-side file cache:", err);
      }
    }
  }
}
