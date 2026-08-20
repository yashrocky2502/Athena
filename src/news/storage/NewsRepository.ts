/**
 * ATHENA NEWS ENGINE — STAGE 7.5 NEWS REPOSITORY ABSTRACTION
 * Interface separating UI and News Engine from underlying storage (JSON or PostgreSQL).
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsSummary, PublisherProfile } from '../types/NewsSummary';
import { TraderIntelligence } from '../types/TraderIntelligence';

export interface ArticleQueryFilters {
  limit?: number;
  section?: string;
  fnoOnly?: boolean;
  search?: string;
  source?: string;
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
}
