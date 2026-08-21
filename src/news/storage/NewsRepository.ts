/**
 * ATHENA NEWS ENGINE — STAGE 8.4 NEWS REPOSITORY ABSTRACTION
 * Interface separating UI and News Engine from underlying storage (JSON or PostgreSQL).
 * Extended to support NewsEvent durable persistence.
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsSummary, PublisherProfile } from '../types/NewsSummary';
import { TraderIntelligence } from '../types/TraderIntelligence';
import { NewsEvent } from '../types/NewsEvent';

export interface ArticleQueryFilters {
  limit?: number;
  section?: string;
  fnoOnly?: boolean;
  search?: string;
  source?: string;
}

export interface EventQueryFilters {
  limit?: number;
  category?: string;
  symbol?: string;
  status?: string;
  fnoOnly?: boolean;
}

export interface NewsRepository {
  getArticle(id: string): Promise<NewsArticle | null>;
  getArticles(filters?: ArticleQueryFilters): Promise<NewsArticle[]>;
  saveArticle(article: NewsArticle): Promise<void>;
  
  getSummary(articleId: string): Promise<NewsSummary | null>;
  saveSummary(articleId: string, summary: NewsSummary): Promise<void>;
  
  getTraderIntelligence(articleId: string): Promise<TraderIntelligence | null>;
  saveTraderIntelligence(articleId: string, intel: TraderIntelligence): Promise<void>;
  
  getPublisherProfile(domain: string): Promise<PublisherProfile | null>;
  savePublisherProfile(profile: PublisherProfile): Promise<void>;
  
  getArticleCount(): Promise<number>;

  // Stage 8.4 Event Repository Extensions
  getEvent(eventId: string): Promise<NewsEvent | null>;
  getEvents(filters?: EventQueryFilters): Promise<NewsEvent[]>;
  saveEvent(event: NewsEvent): Promise<void>;
  getEventByFingerprint(fingerprint: string): Promise<NewsEvent | null>;
}
