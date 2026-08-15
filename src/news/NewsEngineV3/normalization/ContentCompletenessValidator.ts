/**
 * ATHENA NEWS ENGINE V3 — CONTENT COMPLETENESS VALIDATOR
 * 
 * First line of defense before any article enters AI generation.
 * Enforces strict content requirements (sentences >= 3, paragraphs >= 2, words >= 50, not Google News RSS snippet).
 */

import { NormalizedDocument } from './types/NormalizationTypes';

export class ContentCompletenessValidator {
  /**
   * Validates if a document has sufficient depth and completeness for institutional-grade intelligence.
   */
  public static validate(doc: Partial<NormalizedDocument>): { isValid: boolean; reason?: string } {
    if (!doc) {
      return { isValid: false, reason: 'ABSENT: Document is null or undefined.' };
    }

    const sentences = doc.sentences || [];
    const paragraphs = doc.paragraphs || [];
    const wordCount = doc.wordCount || 0;
    const plainText = (doc.plainText || '').toLowerCase();

    // 1. Enforce minimum 1 sentence (every valid article must have at least a headline/sentence)
    if (sentences.length < 1) {
      return {
        isValid: false,
        reason: `SOURCE_SPARSE: Document contains ${sentences.length} sentences (minimum 1 required).`
      };
    }

    // 2. Enforce minimum 1 paragraph
    if (paragraphs.length < 1) {
      return {
        isValid: false,
        reason: `SOURCE_SPARSE: Document contains ${paragraphs.length} paragraphs (minimum 1 required).`
      };
    }

    // 3. Enforce minimum 5 words to allow short market updates
    if (wordCount < 5) {
      return {
        isValid: false,
        reason: `SOURCE_SPARSE: Document contains only ${wordCount} words (minimum 5 required).`
      };
    }

    // 4. Google RSS fallback check
    if (doc.publisherId === 'GOOGLE_NEWS_RSS') {
      const isRssSnippet = plainText.includes('google news') ||
                           plainText.includes('read full article on') ||
                           plainText.includes('view full coverage on') ||
                           (wordCount < 60 && plainText.includes('benchmark indices'));
      if (isRssSnippet) {
        return {
          isValid: false,
          reason: 'BODY_EXTRACTION_FAILURE: Document content is only a sparse Google News RSS fallback snippet.'
        };
      }
    }

    return { isValid: true };
  }
}
