/**
 * ATHENA NEWS ENGINE V3 — PERSISTENT STORAGE ADAPTER
 * 
 * Durable file-backed persistent repository implementation that serves as
 * the SOURCE OF TRUTH for all V3 news entities.
 * Automatically handles serialization, disk write atomicity, hot-cache hydration,
 * deduplication restoration, and configurable retention cleanup.
 */

import fs from 'fs';
import path from 'path';
import { 
  IRawArticleRepository, 
  INormalizedRepository, 
  IStructuredRepository, 
  IIntelligenceRepository, 
  IAuditRepository,
  InMemoryV3StorageAdapter,
  findDuplicateStory,
  mergeStories
} from './V3StorageInterfaces';
import { 
  V3RawArticle, 
  V3NormalizedArticle, 
  V3StructuredData, 
  V3AIIntelligence, 
  V3Story,
  V3ProcessingContext 
} from '../types/V3Types';
import { V3Logger } from '../logging/V3Logger';
import { V3Telemetry } from '../telemetry/V3Telemetry';

export interface PersistentStoreData {
  rawArticles: Record<string, V3RawArticle>;
  normalizedArticles: Record<string, V3NormalizedArticle>;
  structuredDataMap: Record<string, V3StructuredData>;
  intelligenceMap: Record<string, V3AIIntelligence>;
  storiesMap: Record<string, V3Story>;
  auditLogsMap: Record<string, V3ProcessingContext>;
  lastPersistedAt: string | null;
  lastHydrationAt: string | null;
}

export class PersistentV3StorageAdapter implements 
  IRawArticleRepository, 
  INormalizedRepository, 
  IStructuredRepository, 
  IIntelligenceRepository, 
  IAuditRepository 
{
  private static instance: PersistentV3StorageAdapter;
  private storageFilePath: string;
  private rawArticles: Map<string, V3RawArticle> = new Map();
  private normalizedArticles: Map<string, V3NormalizedArticle> = new Map();
  private structuredDataMap: Map<string, V3StructuredData> = new Map();
  private intelligenceMap: Map<string, V3AIIntelligence> = new Map();
  private storiesMap: Map<string, V3Story> = new Map();
  private auditLogsMap: Map<string, V3ProcessingContext> = new Map();

  private initialized = false;
  private lastPersistedAt: string | null = null;
  private lastHydrationAt: string | null = null;
  private retentionDays = 30;

  constructor(filePath?: string) {
    const dataDir = path.resolve(process.cwd(), 'data');
    this.storageFilePath = filePath || path.join(dataDir, 'v3_news_store.json');
  }

  public static getInstance(): PersistentV3StorageAdapter {
    if (!PersistentV3StorageAdapter.instance) {
      PersistentV3StorageAdapter.instance = new PersistentV3StorageAdapter();
    }
    return PersistentV3StorageAdapter.instance;
  }

  public setStoragePath(filePath: string): void {
    this.storageFilePath = filePath;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    V3Logger.getInstance().info('PersistentStorage', 'PERSISTENCE_START', { filePath: this.storageFilePath });
    V3Logger.getInstance().info('PersistentStorage', 'PERSISTENCE_HYDRATION_STARTED');

    try {
      const dataDir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.storageFilePath)) {
        const fileContent = fs.readFileSync(this.storageFilePath, 'utf-8');
        if (fileContent.trim().length > 0) {
          const parsed: PersistentStoreData = JSON.parse(fileContent);
          
          if (parsed.rawArticles) {
            for (const [id, article] of Object.entries(parsed.rawArticles)) {
              this.rawArticles.set(id, article);
            }
          }
          if (parsed.normalizedArticles) {
            for (const [id, article] of Object.entries(parsed.normalizedArticles)) {
              this.normalizedArticles.set(id, article);
            }
          }
          if (parsed.structuredDataMap) {
            for (const [id, data] of Object.entries(parsed.structuredDataMap)) {
              this.structuredDataMap.set(id, data);
            }
          }
          if (parsed.intelligenceMap) {
            for (const [id, intel] of Object.entries(parsed.intelligenceMap)) {
              this.intelligenceMap.set(id, intel);
            }
          }
          if (parsed.storiesMap) {
            let hasMergedDuplicates = false;
            // Sort by publishedAt ascending so older stories are processed first (or direct override logic can naturally take place)
            const sortedStories = Object.values(parsed.storiesMap).sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
            for (const story of sortedStories) {
              const existingList = Array.from(this.storiesMap.values());
              const duplicate = findDuplicateStory(story, existingList);
              if (duplicate) {
                const merged = mergeStories(duplicate, story);
                this.storiesMap.set(duplicate.storyId, merged);
                hasMergedDuplicates = true;
              } else {
                this.storiesMap.set(story.storyId, story);
              }
            }
            if (hasMergedDuplicates) {
              V3Logger.getInstance().info('PersistentStorage', 'AUTO_DEDUPLICATED_ON_STARTUP', {
                beforeCount: Object.keys(parsed.storiesMap).length,
                afterCount: this.storiesMap.size
              });
              this.persistToDisk();
            }
          }
          if (parsed.auditLogsMap) {
            for (const [id, log] of Object.entries(parsed.auditLogsMap)) {
              this.auditLogsMap.set(id, log);
            }
          }

          this.lastPersistedAt = parsed.lastPersistedAt || null;
        }
      }

      this.lastHydrationAt = new Date().toISOString();
      this.initialized = true;

      V3Logger.getInstance().info('PersistentStorage', 'PERSISTENCE_HYDRATION_COMPLETED', {
        rawArticlesCount: this.rawArticles.size,
        storiesCount: this.storiesMap.size
      });
    } catch (err: any) {
      V3Logger.getInstance().error('PersistentStorage', 'PERSISTENCE_HYDRATION_FAILED', { error: err?.message });
      this.initialized = true;
    }
  }

  public hydrateHotCache(cache: InMemoryV3StorageAdapter): { hydratedStories: number; totalStories: number } {
    for (const article of this.rawArticles.values()) {
      cache.saveRawArticle(article);
    }
    for (const article of this.normalizedArticles.values()) {
      cache.saveNormalizedArticle(article);
    }
    for (const [articleId, data] of this.structuredDataMap.entries()) {
      cache.saveStructuredData(articleId, data);
    }
    for (const [storyId, intel] of this.intelligenceMap.entries()) {
      cache.saveIntelligence(storyId, intel);
    }
    for (const story of this.storiesMap.values()) {
      cache.saveStory(story);
    }
    for (const auditLog of this.auditLogsMap.values()) {
      cache.saveProcessingAudit(auditLog);
    }

    return {
      hydratedStories: this.storiesMap.size,
      totalStories: this.storiesMap.size
    };
  }

  private persistToDisk(): void {
    try {
      const dataDir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.lastPersistedAt = new Date().toISOString();

      const dataToSave: PersistentStoreData = {
        rawArticles: Object.fromEntries(this.rawArticles),
        normalizedArticles: Object.fromEntries(this.normalizedArticles),
        structuredDataMap: Object.fromEntries(this.structuredDataMap),
        intelligenceMap: Object.fromEntries(this.intelligenceMap),
        storiesMap: Object.fromEntries(this.storiesMap),
        auditLogsMap: Object.fromEntries(this.auditLogsMap),
        lastPersistedAt: this.lastPersistedAt,
        lastHydrationAt: this.lastHydrationAt
      };

      const tempFile = `${this.storageFilePath}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, this.storageFilePath);
    } catch (err: any) {
      V3Logger.getInstance().error('PersistentStorage', 'DISK_PERSISTENCE_ERROR', { error: err?.message });
    }
  }

  // IRawArticleRepository
  async saveRawArticle(article: V3RawArticle): Promise<void> {
    this.rawArticles.set(article.id, { ...article });
    this.persistToDisk();
  }

  async getRawArticleById(id: string): Promise<V3RawArticle | null> {
    return this.rawArticles.get(id) || null;
  }

  async getRawArticlesByPublisher(publisherId: string, limit = 50): Promise<V3RawArticle[]> {
    return Array.from(this.rawArticles.values())
      .filter(a => a.publisherId === publisherId)
      .slice(0, limit);
  }

  async existsBySourceUrl(url: string): Promise<boolean> {
    return Array.from(this.rawArticles.values()).some(a => a.sourceUrl === url);
  }

  async getAllRawArticles(limit = 10000): Promise<V3RawArticle[]> {
    return Array.from(this.rawArticles.values()).slice(0, limit);
  }

  // INormalizedRepository
  async saveNormalizedArticle(article: V3NormalizedArticle): Promise<void> {
    this.normalizedArticles.set(article.id, { ...article });
    this.persistToDisk();
  }

  async getNormalizedArticleById(id: string): Promise<V3NormalizedArticle | null> {
    return this.normalizedArticles.get(id) || null;
  }

  async getNormalizedArticleByHash(contentHash: string): Promise<V3NormalizedArticle | null> {
    return Array.from(this.normalizedArticles.values()).find(a => a.contentHash === contentHash) || null;
  }

  // IStructuredRepository
  async saveStructuredData(articleId: string, data: V3StructuredData): Promise<void> {
    this.structuredDataMap.set(articleId, { ...data });
    this.persistToDisk();
  }

  async getStructuredDataByArticleId(articleId: string): Promise<V3StructuredData | null> {
    return this.structuredDataMap.get(articleId) || null;
  }

  // IIntelligenceRepository
  async saveIntelligence(storyId: string, intelligence: V3AIIntelligence): Promise<void> {
    this.intelligenceMap.set(storyId, { ...intelligence });
    this.persistToDisk();
  }

  async getIntelligenceByStoryId(storyId: string): Promise<V3AIIntelligence | null> {
    return this.intelligenceMap.get(storyId) || null;
  }

  // IAuditRepository
  async saveStory(story: V3Story): Promise<void> {
    const existingStories = Array.from(this.storiesMap.values());
    const duplicate = findDuplicateStory(story, existingStories);

    if (duplicate) {
      const mergedStory = mergeStories(duplicate, story);
      this.storiesMap.set(duplicate.storyId, mergedStory);
      this.persistToDisk();

      V3Logger.getInstance().info('PersistentStorage', 'STORY_MERGED_ON_SAVE', {
        existingStoryId: duplicate.storyId,
        incomingStoryId: story.storyId,
        headline: mergedStory.headline,
        publisher: mergedStory.publisher.name
      });
      return;
    }

    this.storiesMap.set(story.storyId, { ...story });
    this.persistToDisk();

    V3Logger.getInstance().info('PersistentStorage', 'STORY_PERSISTED', {
      storyId: story.storyId,
      headline: story.headline,
      publisher: story.publisher.name
    });
    V3Telemetry.getInstance().recordStoryPublished();
  }

  async getStoryById(storyId: string): Promise<V3Story | null> {
    const story = this.storiesMap.get(storyId);
    if (story) {
      V3Logger.getInstance().debug('PersistentStorage', 'STORY_CACHE_HIT', { storyId });
      return story;
    }
    V3Logger.getInstance().debug('PersistentStorage', 'STORY_CACHE_MISS', { storyId });
    return null;
  }

  async getAllStories(limit = 10000): Promise<V3Story[]> {
    return Array.from(this.storiesMap.values())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
  }

  async saveProcessingAudit(context: V3ProcessingContext): Promise<void> {
    this.auditLogsMap.set(context.correlationId, { ...context });
    this.persistToDisk();
  }

  async getAuditLogs(correlationId: string): Promise<V3ProcessingContext | null> {
    return this.auditLogsMap.get(correlationId) || null;
  }

  public runRetentionCleanup(days = this.retentionDays): number {
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [storyId, story] of this.storiesMap.entries()) {
      const pubMs = new Date(story.publishedAt).getTime();
      if (!isNaN(pubMs) && pubMs < cutoffMs) {
        this.storiesMap.delete(storyId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.persistToDisk();
      V3Logger.getInstance().info('PersistentStorage', 'RETENTION_CLEANUP_EXECUTED', {
        deletedCount,
        retentionDays: days,
        remainingStories: this.storiesMap.size
      });
    }

    return deletedCount;
  }

  public getStorageMetrics() {
    return {
      healthy: true,
      totalStories: this.storiesMap.size,
      hydratedStories: this.storiesMap.size,
      lastHydrationAt: this.lastHydrationAt,
      lastPersistedAt: this.lastPersistedAt,
      rawArticlesCount: this.rawArticles.size
    };
  }

  public clearAll(): void {
    this.rawArticles.clear();
    this.normalizedArticles.clear();
    this.structuredDataMap.clear();
    this.intelligenceMap.clear();
    this.storiesMap.clear();
    this.auditLogsMap.clear();
    this.lastPersistedAt = null;
    this.initialized = false;
    
    if (fs.existsSync(this.storageFilePath)) {
      try {
        fs.unlinkSync(this.storageFilePath);
      } catch (_) {}
    }
  }
}
