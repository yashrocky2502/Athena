/**
 * ATHENA NEWS ENGINE — STAGE 8.9.13
 * SourceArticleExtractionGate
 * 
 * Production quality gate for source article extraction.
 * Delegates to SourceArticleExtractor with Tier 1-4 Indian financial source support,
 * deep HTML entity decoding, sanitization, and deterministic scoring.
 */

import { NewsArticle } from '../models/NewsArticle';
import { SourceArticleExtractor, SourceExtractionResult } from './SourceArticleExtractor';

export type ExtractionFailureCategory =
  | 'UNSUPPORTED_PUBLISHER'
  | 'NO_SOURCE_BODY'
  | 'HEADLINE_ONLY'
  | 'SNIPPET_ONLY'
  | 'PAYWALL_OR_LOGIN'
  | 'BOT_PROTECTION'
  | 'HTTP_FAILURE'
  | 'TIMEOUT'
  | 'HTML_PARSE_FAILURE'
  | 'CONTENT_SELECTOR_FAILURE'
  | 'HTML_CONTAMINATION'
  | 'CONTENT_TOO_SHORT'
  | 'NAVIGATION_CONTAMINATION'
  | 'DUPLICATE_CONTENT'
  | 'ENCODING_FAILURE'
  | 'MALFORMED_SOURCE'
  | 'TEMPORARY_SOURCE_FAILURE'
  | 'UNKNOWN_EXTRACTION_FAILURE';

export interface ExtractionTaxonomyReport {
  totalArticles: number;
  groundedCount: number;
  failedCount: number;
  groundedPercentage: number;
  taxonomyBreakdown: Record<ExtractionFailureCategory, number>;
  topFailedPublishers: { publisher: string; failureCount: number }[];
  qualityGateThreshold: number;
  timestamp: string;
}

export interface ExtractionDiagnostic {
  publisher: string;
  extractionStatus: 'SUCCESS' | 'FAILED';
  extractionScore: number;
  bodyLength: number;
  sentenceCount: number;
  contaminationDetected: boolean;
  headlineSimilarity: number;
  rejectionReason: string | null;
  tier?: string;
  wordCount?: number;
  failureCategory?: ExtractionFailureCategory;
}

export class SourceArticleExtractionGate {
  public static getMinScoreThreshold(): number {
    return SourceArticleExtractor.getMinScoreThreshold();
  }

  /**
   * Helper to compute lexical word overlap similarity between headline and body.
   */
  public static calculateSimilarity(s1: string, s2: string): number {
    return SourceArticleExtractor.calculateSimilarity(s1, s2);
  }

  /**
   * Determines if a publisher matches supported tiers (Tier 1 to Tier 4).
   */
  public static detectPublisher(article: any): { matched: boolean; name: string } {
    const match = SourceArticleExtractor.detectPublisher(article);
    return {
      matched: match.matched,
      name: match.canonicalName
    };
  }

  /**
   * Evaluates the extraction quality and returns status, score and internal diagnostic metadata.
   */
  public static evaluate(article: any): { diagnostic: ExtractionDiagnostic; cleanBody: string | null } {
    const result = SourceArticleExtractor.evaluate(article);

    const diagnostic: ExtractionDiagnostic = {
      publisher: result.publisher,
      extractionStatus: result.extractionStatus,
      extractionScore: result.extractionScore,
      bodyLength: result.bodyLength,
      sentenceCount: result.sentenceCount,
      contaminationDetected: result.contaminationDetected,
      headlineSimilarity: result.headlineSimilarity,
      rejectionReason: result.rejectionReason,
      tier: result.tier,
      wordCount: result.wordCount,
      failureCategory: result.failureCategory
    };

    return {
      diagnostic,
      cleanBody: result.cleanBody
    };
  }
}
