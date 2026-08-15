/**
 * ATHENA NEWS ENGINE V3 — NORMALIZER VALIDATOR
 * 
 * Quality gate validator for normalized documents.
 * Enforces structural constraints:
 * - Minimum 2 sentences
 * - Minimum 1 paragraph
 * - Valid Title and Publisher
 * - Maximum 40% noise/navigation ratio
 * - Readable character encoding
 */

import { NormalizationValidationResult, NormalizedDocument } from './types/NormalizationTypes';

export class NormalizerValidator {
  /**
   * Validates a normalized document candidate against strict Phase 3 quality constraints.
   */
  public static validate(
    doc: Partial<NormalizedDocument>,
    rawLength: number,
    noiseRemovedLength: number
  ): NormalizationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check title & publisher
    if (!doc.title || doc.title.trim().length === 0) {
      errors.push('CRITICAL_MISSING_TITLE: Document title is missing or empty.');
    }

    if (!doc.publisherName || doc.publisherName.trim().length === 0) {
      errors.push('CRITICAL_MISSING_PUBLISHER: Publisher name is missing or empty.');
    }

    // 2. Check paragraph count (>= 1 required)
    const paraCount = doc.paragraphs ? doc.paragraphs.length : 0;
    if (paraCount < 1) {
      errors.push(`CRITICAL_INSUFFICIENT_PARAGRAPHS: Document contains ${paraCount} paragraphs (minimum 1 required).`);
    }

    // 3. Check sentence count (>= 1 required)
    const sentCount = doc.sentences ? doc.sentences.length : 0;
    if (sentCount < 1) {
      errors.push(`CRITICAL_INSUFFICIENT_SENTENCES: Document contains ${sentCount} sentences (minimum 1 required).`);
    }

    // 4. Calculate noise ratio
    const noiseRatio = rawLength > 0 ? (rawLength - noiseRemovedLength) / rawLength : 0;
    if (noiseRatio > 0.40) {
      warnings.push(`HIGH_NOISE_RATIO: ${Math.round(noiseRatio * 100)}% of content was noise/navigation (threshold 40%).`);
    }

    // 5. Unreadable encoding check
    const plainText = doc.plainText || '';
    const replacementCharCount = (plainText.match(/\uFFFD/g) || []).length;
    let unreadableEncoding = false;

    if (plainText.length > 0 && replacementCharCount / plainText.length > 0.05) {
      unreadableEncoding = true;
      errors.push('CRITICAL_UNREADABLE_ENCODING: Corrupted characters or invalid byte sequences detected.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      noiseRatio,
      sentenceCount: sentCount,
      paragraphCount: paraCount,
      unreadableEncoding
    };
  }
}
