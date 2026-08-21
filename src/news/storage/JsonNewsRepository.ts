/**
 * ATHENA NEWS ENGINE — STAGE 8.4 JSON NEWS REPOSITORY
 * Migration-compatible JSON repository wrapping canonical store data and news events.
 * Rule: Preserves data/news_stage2_store.json untouched during normal operation.
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsSummary, PublisherProfile } from '../types/NewsSummary';
import { TraderIntelligence } from '../types/TraderIntelligence';
import { NewsEvent } from '../types/NewsEvent';
import { NewsRepository, ArticleQueryFilters, EventQueryFilters } from './NewsRepository';
import { JsonNewsStore } from './JsonNewsStore';
import { NewsSummaryCache } from '../cache/NewsSummaryCache';
import { TraderIntelligenceCache } from '../cache/TraderIntelligenceCache';
import { PublisherProfileManager } from '../extraction/PublisherProfileManager';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';

export class JsonNewsRepository implements NewsRepository {
  private jsonStore: JsonNewsStore;
  private summaryCache = NewsSummaryCache.getInstance();
  private intelCache = TraderIntelligenceCache.getInstance();
  private publisherManager = PublisherProfileManager.getInstance();
  private eventOrchestrator = EventCentricOrchestrator.getInstance();

  constructor(customPath?: string) {
    this.jsonStore = new JsonNewsStore(customPath);
  }

  public async getArticle(id: string): Promise<NewsArticle | null> {
    await this.jsonStore.initialize();
    const raw = await this.jsonStore.getById(id);
    return raw ? (raw as unknown as NewsArticle) : null;
  }

  public async getArticles(filters?: ArticleQueryFilters): Promise<NewsArticle[]> {
    await this.jsonStore.initialize();
    let list = (await this.jsonStore.getAll()) as unknown as NewsArticle[];

    if (filters?.section) {
      const sec = filters.section.toLowerCase();
      list = list.filter(a =>
        (a.category || '').toLowerCase() === sec ||
        (a.primaryCategory || '').toLowerCase() === sec
      );
    }

    if (filters?.fnoOnly) {
      list = list.filter(a =>
        a.isFno ||
        a.category === 'FNO' ||
        a.primaryCategory === 'FNO' ||
        /options|futures|strike|open interest|pcr|iv/i.test(`${a.title || ''} ${a.summary || ''}`)
      );
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.summary || '').toLowerCase().includes(q)
      );
    }

    if (filters?.source) {
      const src = filters.source.toLowerCase();
      list = list.filter(a =>
        (a.source?.name || a.publisher || '').toLowerCase().includes(src)
      );
    }

    if (filters?.limit && filters.limit > 0) {
      list = list.slice(0, filters.limit);
    }

    return list;
  }

  public async saveArticle(article: NewsArticle): Promise<void> {
    await this.jsonStore.initialize();
    await this.jsonStore.insert(article as any);
  }

  public async getSummary(articleId: string): Promise<NewsSummary | null> {
    return this.summaryCache.get(articleId);
  }

  public async saveSummary(articleId: string, summary: NewsSummary): Promise<void> {
    this.summaryCache.set(articleId, summary);
  }

  public async getTraderIntelligence(articleId: string): Promise<TraderIntelligence | null> {
    return this.intelCache.get(articleId);
  }

  public async saveTraderIntelligence(articleId: string, intel: TraderIntelligence): Promise<void> {
    this.intelCache.set(articleId, intel);
  }

  public async getPublisherProfile(domain: string): Promise<PublisherProfile | null> {
    return this.publisherManager.getProfile(domain);
  }

  public async savePublisherProfile(profile: PublisherProfile): Promise<void> {
    if (profile) {
      this.publisherManager.recordResult(
        profile.domain,
        profile.preferredExtractor,
        profile.averageQuality,
        profile.successRate > 50
      );
    }
  }

  public async getArticleCount(): Promise<number> {
    await this.jsonStore.initialize();
    return this.jsonStore.count();
  }

  // Stage 8.4 NewsEvent Repository Implementation
  public async getEvent(eventId: string): Promise<NewsEvent | null> {
    return this.eventOrchestrator.getEventById(eventId) || null;
  }

  public async getEvents(filters?: EventQueryFilters): Promise<NewsEvent[]> {
    let events = this.eventOrchestrator.getAllEvents();

    if (filters?.category) {
      const cat = filters.category.toLowerCase();
      events = events.filter(e => (e.category || '').toLowerCase() === cat);
    }

    if (filters?.symbol) {
      const sym = filters.symbol.toUpperCase();
      events = events.filter(e => e.symbol.toUpperCase() === sym || e.primaryEntity.toUpperCase() === sym);
    }

    if (filters?.status) {
      events = events.filter(e => e.eventStatus === filters.status);
    }

    if (filters?.limit && filters.limit > 0) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  public async saveEvent(event: NewsEvent): Promise<void> {
    // Stored in orchestrator in-memory / cache layer
  }

  public async getEventByFingerprint(fingerprint: string): Promise<NewsEvent | null> {
    return this.eventOrchestrator.getEventByFingerprint(fingerprint) || null;
  }
}
