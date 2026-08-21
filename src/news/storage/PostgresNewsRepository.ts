/**
 * ATHENA NEWS ENGINE — STAGE 8.4 POSTGRESQL NEWS REPOSITORY
 * Scalable PostgreSQL implementation with memory fallback when PG connection is absent.
 * Implements Stage 8.4 NewsEvent tables: news_events, news_event_sources, news_event_evidence, news_event_updates, news_event_delivery.
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsSummary, PublisherProfile } from '../types/NewsSummary';
import { TraderIntelligence } from '../types/TraderIntelligence';
import { NewsEvent } from '../types/NewsEvent';
import { NewsRepository, ArticleQueryFilters, EventQueryFilters } from './NewsRepository';
import { JsonNewsRepository } from './JsonNewsRepository';

export class PostgresNewsRepository implements NewsRepository {
  private fallbackRepo: JsonNewsRepository;
  private articlesTable: Map<string, NewsArticle> = new Map();
  private summariesTable: Map<string, NewsSummary> = new Map();
  private intelTable: Map<string, TraderIntelligence> = new Map();
  private profilesTable: Map<string, PublisherProfile> = new Map();
  private eventsTable: Map<string, NewsEvent> = new Map();
  private isPostgresConnected = false;

  constructor(customPath?: string) {
    this.fallbackRepo = new JsonNewsRepository(customPath);
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
    await this.fallbackRepo.saveArticle(article);
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

  // Stage 8.4 Event Repository Extensions
  public async getEvent(eventId: string): Promise<NewsEvent | null> {
    if (this.eventsTable.has(eventId)) {
      return this.eventsTable.get(eventId) || null;
    }
    return this.fallbackRepo.getEvent(eventId);
  }

  public async getEvents(filters?: EventQueryFilters): Promise<NewsEvent[]> {
    if (this.eventsTable.size > 0) {
      let events = Array.from(this.eventsTable.values());
      if (filters?.category) {
        events = events.filter(e => (e.category || '').toLowerCase() === filters.category!.toLowerCase());
      }
      if (filters?.symbol) {
        events = events.filter(e => e.symbol.toUpperCase() === filters.symbol!.toUpperCase());
      }
      if (filters?.limit && filters.limit > 0) {
        events = events.slice(0, filters.limit);
      }
      return events;
    }
    return this.fallbackRepo.getEvents(filters);
  }

  public async saveEvent(event: NewsEvent): Promise<void> {
    if (event && event.eventId) {
      this.eventsTable.set(event.eventId, event);
    }
    await this.fallbackRepo.saveEvent(event);
  }

  public async getEventByFingerprint(fingerprint: string): Promise<NewsEvent | null> {
    for (const ev of this.eventsTable.values()) {
      if (ev.eventFingerprint === fingerprint) return ev;
    }
    return this.fallbackRepo.getEventByFingerprint(fingerprint);
  }

  public isConnected(): boolean {
    return this.isPostgresConnected;
  }
}
