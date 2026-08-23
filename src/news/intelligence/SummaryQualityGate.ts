/**
 * ATHENA NEWS ENGINE — STAGE 8.9.11
 * SummaryQualityGate
 * 
 * Strict quality gate for Canonical AI Summaries.
 * Blocks and sanitizes any fabricated, repeated-headline, or low-quality summaries.
 */

import { SourceArticleExtractionGate } from './SourceArticleExtractionGate.ts';

export interface SummaryQualityResult {
  passed: boolean;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  keyFacts: string[];
  status: 'AVAILABLE' | 'SOURCE_UNAVAILABLE';
}

export class SummaryQualityGate {
  /**
   * Evaluates an article and its generated summary against strict quality standards.
   */
  public static evaluate(article: any, generatedSummary?: any): SummaryQualityResult {
    const { diagnostic, cleanBody } = SourceArticleExtractionGate.evaluate(article);
    const hasSuccessfulExtraction = diagnostic.extractionStatus === 'SUCCESS' && cleanBody;

    if (!hasSuccessfulExtraction) {
      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE'
      };
    }

    const title = (article.title || article.headline || "").trim().toLowerCase();
    const sumText = (typeof generatedSummary === 'string' ? generatedSummary : generatedSummary?.summary || "").trim();
    const sumTextLower = sumText.toLowerCase();

    const titleClean = title.replace(/\s+/g, ' ').trim();
    const sumClean = sumTextLower.replace(/\s+/g, ' ').trim();

    // Guard against repeated headlines or headline extensions (e.g., repeating the headline + a generic sentence)
    let isRepeatedHeadline = false;
    if (sumClean === titleClean) {
      isRepeatedHeadline = true;
    } else if (sumClean.includes(titleClean)) {
      const extra = sumClean.replace(titleClean, '').trim();
      // If extra is short, or contains boilerplate, reject
      if (extra.length < 45 || extra.includes('market participants') || extra.includes('analysts') || extra.includes('experts') || extra.includes('monitoring') || extra.includes('tracking') || extra.includes('sentiment')) {
        isRepeatedHeadline = true;
      }
    } else if (titleClean.includes(sumClean) && sumClean.length > 10) {
      isRepeatedHeadline = true;
    } else if (SourceArticleExtractionGate.calculateSimilarity(titleClean, sumClean) > 0.75) {
      isRepeatedHeadline = true;
    }

    if (isRepeatedHeadline) {
      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE'
      };
    }

    // Guard against fabricated fallback boilerplate (such as "Market participants are monitoring...")
    const forbiddenPatterns = [
      "market participants are monitoring",
      "institutional analysts are assessing",
      "routine operational disclosure",
      "favorable announcement for",
      "corporate development may impact sentiment"
    ];

    for (const pattern of forbiddenPatterns) {
      if (sumTextLower.includes(pattern)) {
        return {
          passed: false,
          summary: "Summary unavailable — Open original source",
          whatHappened: "Summary unavailable — Open original source",
          whyItMatters: "",
          keyFacts: [],
          status: 'SOURCE_UNAVAILABLE'
        };
      }
    }

    const finalWhatHappened = typeof generatedSummary === 'object' && generatedSummary?.whatHappened 
      ? generatedSummary.whatHappened 
      : sumText;

    const finalWhyItMatters = typeof generatedSummary === 'object' && generatedSummary?.whyItMatters 
      ? generatedSummary.whyItMatters 
      : "";

    const finalKeyFacts = typeof generatedSummary === 'object' && Array.isArray(generatedSummary?.keyFacts)
      ? generatedSummary.keyFacts
      : [];

    return {
      passed: true,
      summary: sumText || "Summary unavailable — Open original source",
      whatHappened: finalWhatHappened || "Summary unavailable — Open original source",
      whyItMatters: finalWhyItMatters,
      keyFacts: finalKeyFacts,
      status: 'AVAILABLE'
    };
  }
}
