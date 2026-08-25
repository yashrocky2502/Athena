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
  status: 'AVAILABLE' | 'SOURCE_UNAVAILABLE' | 'EXTRACTION_FAILED' | 'QUALITY_REJECTED';
  summaryStatus?: 'SOURCE_GROUNDED' | 'SOURCE_UNAVAILABLE' | 'EXTRACTION_FAILED' | 'QUALITY_REJECTED';
}

export class SummaryQualityGate {
  /**
   * Evaluates an article and its generated summary against strict quality standards.
   */
  public static evaluate(article: any, generatedSummary?: any): SummaryQualityResult {
    if (!article) {
      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE',
        summaryStatus: 'SOURCE_UNAVAILABLE'
      };
    }

    const { diagnostic, cleanBody } = SourceArticleExtractionGate.evaluate(article);
    const hasSuccessfulExtraction = diagnostic.extractionStatus === 'SUCCESS' && cleanBody;

    if (!hasSuccessfulExtraction) {
      // Differentiate between SOURCE_UNAVAILABLE and EXTRACTION_FAILED
      const isUnavailable = diagnostic.failureCategory === 'NO_SOURCE_BODY' || 
                             diagnostic.failureCategory === 'UNSUPPORTED_PUBLISHER';
      const state = isUnavailable ? 'SOURCE_UNAVAILABLE' : 'EXTRACTION_FAILED';

      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE',
        summaryStatus: state
      };
    }

    const title = (article.headline || article.title || "").trim().toLowerCase();
    const sumText = (typeof generatedSummary === 'string' ? generatedSummary : generatedSummary?.summary || "").trim();
    const sumTextLower = sumText.toLowerCase();

    if (!sumText) {
      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE',
        summaryStatus: 'QUALITY_REJECTED'
      };
    }

    // Strip punctuation/brackets/quotes for clean headline comparison
    const titleClean = title.replace(/[\[\]"']/g, '').replace(/\s+/g, ' ').trim();
    const sumClean = sumTextLower.replace(/[\[\]"']/g, '').replace(/\s+/g, ' ').trim();

    // Guard against repeated headlines or headline extensions (e.g., repeating the headline + a generic sentence)
    let isRepeatedHeadline = false;
    if (sumClean === titleClean) {
      isRepeatedHeadline = true;
    } else if (sumClean.endsWith(titleClean)) {
      // Summary is just a prefix tag + headline (e.g. "Economic Times: Headline")
      isRepeatedHeadline = true;
    } else if (sumClean.startsWith(titleClean)) {
      const extra = sumClean.slice(titleClean.length).replace(/^[.\s:—-]+/, '').trim();
      // If extra is too short (< 10 chars) or contains forbidden boilerplate phrases, reject
      if (
        extra.length < 10 ||
        /^(experts|analysts)\s+are\s+tracking/i.test(extra) ||
        /analysts\s+track/i.test(extra) ||
        /this\s+development\s+may\s+impact\s+sentiment/i.test(extra) ||
        /market\s+participants\s+are\s+monitoring/i.test(extra) ||
        /routine\s+operational\s+disclosure/i.test(extra) ||
        /favorable\s+announcement\s+for/i.test(extra)
      ) {
        isRepeatedHeadline = true;
      }
    } else if (sumClean.includes(titleClean)) {
      const extra = sumClean.replace(titleClean, '').trim();
      if (
        extra.length < 10 ||
        /^(experts|analysts)\s+are\s+tracking/i.test(extra) ||
        /analysts\s+track/i.test(extra) ||
        /this\s+development\s+may\s+impact\s+sentiment/i.test(extra) ||
        /market\s+participants\s+are\s+monitoring/i.test(extra) ||
        /routine\s+operational\s+disclosure/i.test(extra) ||
        /favorable\s+announcement\s+for/i.test(extra)
      ) {
        isRepeatedHeadline = true;
      }
    } else if (titleClean.includes(sumClean) && sumClean.length > 10) {
      isRepeatedHeadline = true;
    } else if (SourceArticleExtractionGate.calculateSimilarity(titleClean, sumClean) > 0.88) {
      isRepeatedHeadline = true;
    }

    if (isRepeatedHeadline) {
      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE',
        summaryStatus: 'QUALITY_REJECTED'
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
          status: 'SOURCE_UNAVAILABLE',
          summaryStatus: 'QUALITY_REJECTED'
        };
      }
    }

    // Guard against summaries that are too short (less than 15 chars)
    if (sumText.length < 15) {
      return {
        passed: false,
        summary: "Summary unavailable — Open original source",
        whatHappened: "Summary unavailable — Open original source",
        whyItMatters: "",
        keyFacts: [],
        status: 'SOURCE_UNAVAILABLE',
        summaryStatus: 'QUALITY_REJECTED'
      };
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
      status: 'AVAILABLE',
      summaryStatus: 'SOURCE_GROUNDED'
    };
  }
}
