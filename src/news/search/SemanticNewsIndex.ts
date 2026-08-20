/**
 * ATHENA NEWS ENGINE — STAGE 7.5 SEMANTIC NEWS INDEX ABSTRACTION (QDRANT PREPARATION)
 * Safe interface with NullSemanticNewsIndex fallback so Qdrant failure never breaks ingestion.
 */

import { NewsArticle } from '../models/NewsArticle';

export interface SemanticMatch {
  articleId: string;
  similarityScore: number;
  title: string;
}

export interface SemanticNewsIndex {
  findSimilarArticles(articleId: string, limit?: number): Promise<SemanticMatch[]>;
  findRelatedEvents(eventType: string, limit?: number): Promise<SemanticMatch[]>;
  findSemanticDuplicates(text: string, threshold?: number): Promise<SemanticMatch[]>;
  indexArticle(article: NewsArticle): Promise<void>;
  isAvailable(): boolean;
}

export class NullSemanticNewsIndex implements SemanticNewsIndex {
  public async findSimilarArticles(_articleId: string, _limit = 5): Promise<SemanticMatch[]> {
    return [];
  }

  public async findRelatedEvents(_eventType: string, _limit = 5): Promise<SemanticMatch[]> {
    return [];
  }

  public async findSemanticDuplicates(_text: string, _threshold = 0.9): Promise<SemanticMatch[]> {
    return [];
  }

  public async indexArticle(_article: NewsArticle): Promise<void> {
    // Null index ignores indexing requests safely
  }

  public isAvailable(): boolean {
    return false;
  }
}

export class QdrantSemanticNewsIndex implements SemanticNewsIndex {
  private url: string;
  private apiKey?: string;

  constructor(url = process.env.QDRANT_URL || '', apiKey = process.env.QDRANT_API_KEY) {
    this.url = url;
    this.apiKey = apiKey;
  }

  public async findSimilarArticles(_articleId: string, _limit = 5): Promise<SemanticMatch[]> {
    if (!this.isAvailable()) return [];
    return [];
  }

  public async findRelatedEvents(_eventType: string, _limit = 5): Promise<SemanticMatch[]> {
    if (!this.isAvailable()) return [];
    return [];
  }

  public async findSemanticDuplicates(_text: string, _threshold = 0.9): Promise<SemanticMatch[]> {
    if (!this.isAvailable()) return [];
    return [];
  }

  public async indexArticle(_article: NewsArticle): Promise<void> {
    if (!this.isAvailable()) return;
  }

  public isAvailable(): boolean {
    return !!this.url && this.url.length > 0;
  }
}
