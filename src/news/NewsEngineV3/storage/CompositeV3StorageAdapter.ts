/**
 * ATHENA NEWS ENGINE V3 — COMPOSITE STORAGE ADAPTER
 * 
 * Orchestrates dual-layer persistence and acceleration:
 * Persistent Storage = SOURCE OF TRUTH (Disk-backed)
 * InMemoryV3StorageAdapter = HOT CACHE (Memory-accelerated)
 * 
 * Writes are routed to Persistent Storage first, then update Hot Cache.
 * Reads hit Hot Cache for instant performance, falling back to Persistent Storage.
 */

import { 
  IRawArticleRepository, 
  INormalizedRepository, 
  IStructuredRepository, 
  IIntelligenceRepository, 
  IAuditRepository,
  InMemoryV3StorageAdapter
} from './V3StorageInterfaces';
import { PersistentV3StorageAdapter } from './PersistentV3StorageAdapter';
import { 
  V3RawArticle, 
  V3NormalizedArticle, 
  V3StructuredData, 
  V3AIIntelligence, 
  V3Story,
  V3ProcessingContext 
} from '../types/V3Types';

export class CompositeV3StorageAdapter implements 
  IRawArticleRepository, 
  INormalizedRepository, 
  IStructuredRepository, 
  IIntelligenceRepository, 
  IAuditRepository 
{
  private persistent: PersistentV3StorageAdapter;
  private cache: InMemoryV3StorageAdapter;

  constructor(persistent: PersistentV3StorageAdapter, cache: InMemoryV3StorageAdapter) {
    this.persistent = persistent;
    this.cache = cache;
  }

  // IRawArticleRepository
  async saveRawArticle(article: V3RawArticle): Promise<void> {
    await this.persistent.saveRawArticle(article);
    await this.cache.saveRawArticle(article);
  }

  async getRawArticleById(id: string): Promise<V3RawArticle | null> {
    const cached = await this.cache.getRawArticleById(id);
    if (cached) return cached;
    return this.persistent.getRawArticleById(id);
  }

  async getRawArticlesByPublisher(publisherId: string, limit = 50): Promise<V3RawArticle[]> {
    const cached = await this.cache.getRawArticlesByPublisher(publisherId, limit);
    if (cached && cached.length > 0) return cached;
    return this.persistent.getRawArticlesByPublisher(publisherId, limit);
  }

  async existsBySourceUrl(url: string): Promise<boolean> {
    const cachedExist = await this.cache.existsBySourceUrl(url);
    if (cachedExist) return true;
    return this.persistent.existsBySourceUrl(url);
  }

  async getAllRawArticles(limit = 10000): Promise<V3RawArticle[]> {
    const cached = await this.cache.getAllRawArticles(limit);
    if (cached && cached.length > 0) return cached;
    return this.persistent.getAllRawArticles(limit);
  }

  // INormalizedRepository
  async saveNormalizedArticle(article: V3NormalizedArticle): Promise<void> {
    await this.persistent.saveNormalizedArticle(article);
    await this.cache.saveNormalizedArticle(article);
  }

  async getNormalizedArticleById(id: string): Promise<V3NormalizedArticle | null> {
    const cached = await this.cache.getNormalizedArticleById(id);
    if (cached) return cached;
    return this.persistent.getNormalizedArticleById(id);
  }

  async getNormalizedArticleByHash(contentHash: string): Promise<V3NormalizedArticle | null> {
    const cached = await this.cache.getNormalizedArticleByHash(contentHash);
    if (cached) return cached;
    return this.persistent.getNormalizedArticleByHash(contentHash);
  }

  // IStructuredRepository
  async saveStructuredData(articleId: string, data: V3StructuredData): Promise<void> {
    await this.persistent.saveStructuredData(articleId, data);
    await this.cache.saveStructuredData(articleId, data);
  }

  async getStructuredDataByArticleId(articleId: string): Promise<V3StructuredData | null> {
    const cached = await this.cache.getStructuredDataByArticleId(articleId);
    if (cached) return cached;
    return this.persistent.getStructuredDataByArticleId(articleId);
  }

  // IIntelligenceRepository
  async saveIntelligence(storyId: string, intelligence: V3AIIntelligence): Promise<void> {
    await this.persistent.saveIntelligence(storyId, intelligence);
    await this.cache.saveIntelligence(storyId, intelligence);
  }

  async getIntelligenceByStoryId(storyId: string): Promise<V3AIIntelligence | null> {
    const cached = await this.cache.getIntelligenceByStoryId(storyId);
    if (cached) return cached;
    return this.persistent.getIntelligenceByStoryId(storyId);
  }

  // IAuditRepository
  async saveStory(story: V3Story): Promise<void> {
    await this.persistent.saveStory(story);
    await this.cache.saveStory(story);
  }

  async getStoryById(storyId: string): Promise<V3Story | null> {
    const cached = await this.cache.getStoryById(storyId);
    if (cached) return cached;
    return this.persistent.getStoryById(storyId);
  }

  async getAllStories(limit = 10000): Promise<V3Story[]> {
    const cached = await this.cache.getAllStories(limit);
    if (cached && cached.length > 0) return cached;
    return this.persistent.getAllStories(limit);
  }

  async saveProcessingAudit(context: V3ProcessingContext): Promise<void> {
    await this.persistent.saveProcessingAudit(context);
    await this.cache.saveProcessingAudit(context);
  }

  async getAuditLogs(correlationId: string): Promise<V3ProcessingContext | null> {
    const cached = await this.cache.getAuditLogs(correlationId);
    if (cached) return cached;
    return this.persistent.getAuditLogs(correlationId);
  }

  public getPersistentStorage(): PersistentV3StorageAdapter {
    return this.persistent;
  }

  public getHotCache(): InMemoryV3StorageAdapter {
    return this.cache;
  }

  public clearAll(): void {
    this.persistent.clearAll();
    this.cache.clearAll();
  }
}
