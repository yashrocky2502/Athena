/**
 * ATHENA NEWS ENGINE — STAGE 7.4 EXTRACTION QUALITY EVALUATOR
 * Deterministic quality scoring (0-100) mapping to EXCELLENT, ACCEPTABLE, WEAK, FAILED.
 */

import { ExtractionQuality } from '../types/NewsSummary';

export interface QualityEvaluationResult {
  score: number;
  quality: ExtractionQuality;
  reasons: string[];
}

export class ExtractionQualityEvaluator {
  /**
   * Deterministically evaluates the quality of extracted article content.
   */
  public static evaluate(title: string, body: string, rawText: string = ''): QualityEvaluationResult {
    let score = 100;
    const reasons: string[] = [];

    const cleanTitle = (title || '').trim();
    const cleanBody = (body || rawText || '').trim();

    // 1. Length check
    if (cleanBody.length === 0) {
      return { score: 0, quality: 'FAILED', reasons: ['Empty body text'] };
    }

    if (cleanBody.length < 150) {
      score -= 40;
      reasons.push('Severely short body text (<150 chars)');
    } else if (cleanBody.length < 400) {
      score -= 20;
      reasons.push('Short body text (<400 chars)');
    } else if (cleanBody.length > 800) {
      score += 5; // Bonus for substantial content
    }

    // 2. Paragraph count
    const paragraphs = cleanBody.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    if (paragraphs.length <= 1 && cleanBody.length < 300) {
      score -= 15;
      reasons.push('Single paragraph with low word count');
    }

    // 3. Sentence completeness
    const sentences = cleanBody.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) {
      score -= 25;
      reasons.push('No valid sentences ending in punctuation');
    }

    // 4. Title / Body Relationship
    if (cleanTitle.length > 0) {
      const titleWords = cleanTitle.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      const bodyLower = cleanBody.toLowerCase();
      const matchedWords = titleWords.filter(w => bodyLower.includes(w));
      const overlapRatio = titleWords.length > 0 ? matchedWords.length / titleWords.length : 1;

      if (overlapRatio < 0.2 && titleWords.length >= 3) {
        score -= 25;
        reasons.push('Low title-body semantic overlap');
      }
    }

    // 5. Repeated Text Ratio
    if (cleanBody.length > 200) {
      const halfLen = Math.floor(cleanBody.length / 2);
      const firstHalf = cleanBody.substring(0, halfLen);
      const secondHalf = cleanBody.substring(halfLen);
      if (firstHalf === secondHalf) {
        score -= 40;
        reasons.push('High repeated text ratio (duplicate blocks)');
      }
    }

    // 6. Navigation & Ad Contamination
    const navContaminationRegex = /cookie policy|privacy policy|terms of service|all rights reserved|click here to subscribe|advertisement|sign up for newsletter|sponsored content/gi;
    const navMatches = cleanBody.match(navContaminationRegex);
    if (navMatches && navMatches.length > 2) {
      score -= 25;
      reasons.push('High navigation / ad text contamination');
    }

    // 7. Cookie / Login Paywall Contamination
    const paywallRegex = /accept cookies|login to continue reading|subscribe now to unlock|register for free access|paywall/gi;
    if (paywallRegex.test(cleanBody)) {
      score -= 30;
      reasons.push('Paywall / cookie prompt contamination detected');
    }

    // 8. Truncation Indicators
    const truncationRegex = /(?:read more at|full story on|continue reading on|click link below)\s*$/i;
    if (truncationRegex.test(cleanBody) && cleanBody.length < 300) {
      score -= 25;
      reasons.push('Truncated article teaser');
    }

    // 9. Uncleaned HTML Artifacts
    const htmlArtifactRegex = /<div|<script|<style|&amp;|&nbsp;|class="|id="/gi;
    const htmlMatches = cleanBody.match(htmlArtifactRegex);
    if (htmlMatches && htmlMatches.length > 3) {
      score -= 20;
      reasons.push('Raw HTML tags/entities detected in clean text');
    }

    // 10. Financial Entity Bonus
    const financialDensityRegex = /\b(?:rs\.?|inr|\$|crore|lakh|billion|percent|%|ipo|qip|sebi|nifty|sensex|shares?|target price|ebitda|profit|loss)\b/gi;
    const finMatches = cleanBody.match(financialDensityRegex);
    if (finMatches && finMatches.length >= 3) {
      score += 10;
      reasons.push('High financial metric/entity density');
    }

    // Clamp score to 0-100
    const finalScore = Math.max(0, Math.min(100, score));

    let quality: ExtractionQuality = 'FAILED';
    if (finalScore >= 80) {
      quality = 'EXCELLENT';
    } else if (finalScore >= 60) {
      quality = 'ACCEPTABLE';
    } else if (finalScore >= 40) {
      quality = 'WEAK';
    } else {
      quality = 'FAILED';
    }

    return {
      score: finalScore,
      quality,
      reasons
    };
  }
}
