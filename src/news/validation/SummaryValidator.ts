/**
 * ATHENA NEWS ENGINE — STAGE 7.4 SUMMARY VALIDATOR
 * Strict validation and hallucination checks for AI Canonical Summaries.
 */

import { NewsSummary } from '../types/NewsSummary';

export interface SummaryValidationResult {
  valid: boolean;
  reasons: string[];
}

export class SummaryValidator {
  /**
   * Validates AI-generated structured news summary.
   */
  public static validate(
    summaryObj: any,
    headline: string,
    articleText: string
  ): SummaryValidationResult {
    const reasons: string[] = [];

    // 1. Check for basic JSON structure
    if (!summaryObj || typeof summaryObj !== 'object') {
      return { valid: false, reasons: ['Summary output is empty or not an object'] };
    }

    const summaryText = (summaryObj.summary || '').trim();
    const whatHappened = (summaryObj.whatHappened || '').trim();
    const whyItMatters = (summaryObj.whyItMatters || '').trim();

    if (!summaryText && !whatHappened) {
      return { valid: false, reasons: ['Summary body text is empty'] };
    }

    if (summaryText.length < 10 && whatHappened.length < 10) {
      reasons.push('Summary body text is too short');
    }

    // 2. Headline Repetition Check
    const cleanHeadline = (headline || '').trim().toLowerCase();
    const cleanSummary = summaryText.toLowerCase();

    if (cleanHeadline.length > 10 && cleanSummary.length > 10) {
      if (cleanSummary === cleanHeadline || cleanSummary.includes(cleanHeadline)) {
        reasons.push('Summary repeats headline verbatim');
      }
      
      // Check edit distance / similarity
      const overlap = this.calculateWordOverlap(cleanHeadline, cleanSummary);
      if (overlap > 0.85 && cleanSummary.length < cleanHeadline.length * 1.3) {
        reasons.push('Summary has >85% headline repetition without added value');
      }
    }

    // 3. Guaranteed Return / False Trading Advice Language
    const forbiddenAdviceRegex = /100% guaranteed|sure shot|guaranteed profit|massive gains|buy immediately|must buy now|target 1000%|risk free profit/gi;
    if (forbiddenAdviceRegex.test(summaryText) || forbiddenAdviceRegex.test(whatHappened)) {
      reasons.push('Contains forbidden trading advice / guaranteed return language');
    }

    // 4. Invented Financial Metrics & Numbers Validation
    const textLower = (articleText || '').toLowerCase();

    // Check important numbers in summaryObj against article text
    if (Array.isArray(summaryObj.importantNumbers)) {
      const cleanTextLower = textLower.replace(/,/g, '');
      const cleanHeadlineLower = cleanHeadline.replace(/,/g, '');
      for (const item of summaryObj.importantNumbers) {
        if (item && item.value) {
          const rawVal = item.value.toString().replace(/[^0-9.]/g, '');
          if (rawVal.length > 0 && !cleanTextLower.includes(rawVal) && !textLower.includes(item.value.toLowerCase())) {
            // Check if headline has it
            if (!cleanHeadlineLower.includes(rawVal)) {
              reasons.push(`Invented numerical value not present in source text: "${item.value}"`);
            }
          }
        }
      }
    }

    // 5. Invented F&O Metrics (Strike, OI, PCR, IV) if article text has no F&O content
    const hasFnoInSource = /options|futures|strike|open interest|\boi\b|pcr|implied volatility|\biv\b|call option|put option/i.test(textLower) ||
                           /options|futures|strike|open interest|\boi\b|pcr|implied volatility|\biv\b|call option|put option/i.test(cleanHeadline);

    if (!hasFnoInSource) {
      const fnoClaimRegex = /\bstrike price\b|\bopen interest\b|\bput call ratio\b|\bpcr\b|\bimplied volatility\b|\biv\b/gi;
      if (fnoClaimRegex.test(summaryText) || fnoClaimRegex.test(whatHappened)) {
        reasons.push('Invented F&O metrics (strike/OI/PCR/IV) in non-F&O article');
      }
    }

    return {
      valid: reasons.length === 0,
      reasons
    };
  }

  private static calculateWordOverlap(str1: string, str2: string): number {
    const words1 = str1.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const words2 = new Set(str2.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    
    if (words1.length === 0) return 0;
    const matchCount = words1.filter(w => words2.has(w)).length;
    return matchCount / words1.length;
  }
}
