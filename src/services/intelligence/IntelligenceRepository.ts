import { CompanyKnowledge } from "../../types";

export interface CacheEntry {
  knowledge: CompanyKnowledge;
  timestamp: number;
  marketOpenState: boolean;
}

export interface IntelligenceRepository {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  update(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  
  // Advanced Persistence Support
  fetchByCompany?(symbol: string): Promise<CacheEntry[]>;
  fetchRecent?(limit: number): Promise<CacheEntry[]>;
  fetchByCategory?(category: string): Promise<CacheEntry[]>;
  fetchByEventId?(eventId: string): Promise<CacheEntry | null>;
  updateConfidence?(eventId: string, confidence: number): Promise<void>;
  updateSources?(eventId: string, sources: string[]): Promise<void>;
}
