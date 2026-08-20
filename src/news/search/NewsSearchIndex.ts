/**
 * ATHENA NEWS ENGINE — STAGE 7.5 NEWS SEARCH INDEX ABSTRACTION (MEILISEARCH PREPARATION)
 * Safe search interface with PostgreSQL fallback so Meilisearch is not a startup dependency.
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsRepository } from '../storage/NewsRepository';

export interface NewsSearchIndex {
  searchArticles(query: string, limit?: number): Promise<NewsArticle[]>;
  searchBySymbol(symbol: string, limit?: number): Promise<NewsArticle[]>;
  searchBySource(source: string, limit?: number): Promise<NewsArticle[]>;
  searchByEvent(eventType: string, limit?: number): Promise<NewsArticle[]>;
  isAvailable(): boolean;
}

export class PostgresNewsSearchIndex implements NewsSearchIndex {
  private repository: NewsRepository;

  constructor(repository: NewsRepository) {
    this.repository = repository;
  }

  public async searchArticles(query: string, limit = 20): Promise<NewsArticle[]> {
    return this.repository.getArticles({ search: query, limit });
  }

  public async searchBySymbol(symbol: string, limit = 20): Promise<NewsArticle[]> {
    return this.repository.getArticles({ search: symbol, limit });
  }

  public async searchBySource(source: string, limit = 20): Promise<NewsArticle[]> {
    return this.repository.getArticles({ source, limit });
  }

  public async searchByEvent(eventType: string, limit = 20): Promise<NewsArticle[]> {
    return this.repository.getArticles({ section: eventType, limit });
  }

  public isAvailable(): boolean {
    return true; // Always available via SQL/JSON repository fallback
  }
}
