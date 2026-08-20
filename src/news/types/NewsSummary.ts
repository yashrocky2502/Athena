/**
 * ATHENA NEWS ENGINE — STAGE 7.4 SUMMARY TYPES
 * Data contracts for AI-Assisted Canonical News Summaries & Extraction Quality.
 */

export type ExtractionQuality = 'EXCELLENT' | 'ACCEPTABLE' | 'WEAK' | 'FAILED';

export interface ImportantNumber {
  value: string;
  context: string;
}

export interface NewsSummary {
  articleId: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  keyFacts: string[];
  importantNumbers: ImportantNumber[];
  entities: string[];
  eventType: string;
  unknowns: string[];
  extractionQuality?: ExtractionQuality;
  extractionMethod?: string;
  provider?: string;
  model?: string;
  validated?: boolean;
  generatedAt?: string;
}

export interface ExtractedArticle {
  title: string;
  body: string;
  rawText: string;
  cleanText: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
  method: string;
  quality: ExtractionQuality;
  qualityScore: number;
  jsRendered?: boolean;
}

export interface PublisherProfile {
  domain: string;
  preferredExtractor: string;
  fallbackExtractor: string;
  averageQuality: number;
  successRate: number;
  jsRequired: boolean;
  lastFailureReason?: string;
  lastSuccessfulExtraction?: string;
  totalExtractions: number;
  failedExtractions: number;
}
