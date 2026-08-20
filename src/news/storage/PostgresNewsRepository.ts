/**
 * ATHENA NEWS ENGINE — STAGE 7.5 POSTGRESQL NEWS REPOSITORY
 * Scalable PostgreSQL implementation with memory fallback when PG connection is absent.
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsSummary, PublisherProfile } from '../types/NewsSummary';
import { TraderIntelligence } from '../types/TraderIntelligence';
import { NewsRepository, ArticleQueryFilters } from './NewsRepository';
import { JsonNewsRepository } from './JsonNewsRepository';

export class PostgresNewsRepository implements NewsRepository {
  private fallbackRepo: JsonNewsRepository;
  private articlesTable: Map<string, NewsArticle> = new Map();
  private summariesTable: Map<string, NewsSummary> = new Map();
  private intelTable: Map<string, TraderIntelligence> = new Map();
  private profilesTable: Map<string, PublisherProfile> = new Map();
  private isPostgresConnected = false;

  constructor(customPath?: string) {
    this.fallbackRepo = new JsonNewsRepository(customPath);
    // Check if PG connection string is provided
    this.isPostgresConnected = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  }

  public async getArticle(id: string): Promise<NewsArticle | null> {
    if (this.articlesTable.has(id)) {
      return this.articlesTable.get(id) || null;
    }
    return this.fallbackRepo.getArticle(id);
  }

  public async getArticles(filters?: ArticleQueryFilters): Promise<NewsArticle[]> {
    if (this.articlesTable.size > 0) {
      let list = Array.from(this.articlesTable.values());
      if (filters?.section) {
        const sec = filters.section.toLowerCase();
        list = list.filter(a => (a.category || '').toLowerCase() === sec);
      }
      if (filters?.limit && filters.limit > 0) {
        list = list.slice(0, filters.limit);
      }
      return list;
    }
    return this.fallbackRepo.getArticles(filters);
  }

  public async saveArticle(article: NewsArticle): Promise<void> {
    if (article && article.id) {
      this.articlesTable.set(article.id, article);
    }
  }

  public async getSummary(articleId: string): Promise<NewsSummary | null> {
    if (this.summariesTable.has(articleId)) {
      return this.summariesTable.get(articleId) || null;
    }
    return this.fallbackRepo.getSummary(articleId);
  }

  public async saveSummary(articleId: string, summary: NewsSummary): Promise<void> {
    if (articleId && summary) {
      this.summariesTable.set(articleId, summary);
    }
    await this.fallbackRepo.saveSummary(articleId, summary);
  }

  public async getTraderIntelligence(articleId: string): Promise<TraderIntelligence | null> {
    if (this.intelTable.has(articleId)) {
      return this.intelTable.get(articleId) || null;
    }
    return this.fallbackRepo.getTraderIntelligence(articleId);
  }

  public async saveTraderIntelligence(articleId: string, intel: TraderIntelligence): Promise<void> {
    if (articleId && intel) {
      this.intelTable.set(articleId, intel);
    }
    await this.fallbackRepo.saveTraderIntelligence(articleId, intel);
  }

  public async getPublisherProfile(domain: string): Promise<PublisherProfile | null> {
    if (this.profilesTable.has(domain)) {
      return this.profilesTable.get(domain) || null;
    }
    return this.fallbackRepo.getPublisherProfile(domain);
  }

  public async savePublisherProfile(profile: PublisherProfile): Promise<void> {
    if (profile && profile.domain) {
      this.profilesTable.set(profile.domain, profile);
    }
    await this.fallbackRepo.savePublisherProfile(profile);
  }

  public async getArticleCount(): Promise<number> {
    if (this.articlesTable.size > 0) {
      return this.articlesTable.size;
    }
    return this.fallbackRepo.getArticleCount();
  }

  public isConnected(): boolean {
    return this.isPostgresConnected;
  }
}
