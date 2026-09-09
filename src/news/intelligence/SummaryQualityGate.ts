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
    let rejectionReason = '';

    if (sumClean === titleClean) {
      isRepeatedHeadline = true;
      rejectionReason = 'Summary repeats headline verbatim';
    } else if (sumClean.endsWith(titleClean)) {
      isRepeatedHeadline = true;
      rejectionReason = 'Summary is just prefix tag plus headline';
    } else if (sumClean.startsWith(titleClean)) {
      const extra = sumClean.slice(titleClean.length).replace(/^[.\s:—-]+/, '').trim();
      if (
        extra.length < 15 ||
        SourceArticleExtractionGate.calculateSimilarity(titleClean, extra) > 0.65 ||
        /^(experts|analysts)\s+are\s+tracking/i.test(extra) ||
        /analysts\s+track/i.test(extra) ||
        /this\s+development\s+may\s+impact\s+sentiment/i.test(extra) ||
        /market\s+participants\s+are\s+monitoring/i.test(extra) ||
        /routine\s+operational\s+disclosure/i.test(extra) ||
        /favorable\s+announcement\s+for/i.test(extra)
      ) {
        isRepeatedHeadline = true;
        rejectionReason = 'Summary merely appends brief/redundant padding to headline';
      }
    } else if (sumClean.includes(titleClean)) {
      const extra = sumClean.replace(titleClean, '').trim();
      if (
        extra.length < 15 ||
        SourceArticleExtractionGate.calculateSimilarity(titleClean, extra) > 0.65 ||
        /^(experts|analysts)\s+are\s+tracking/i.test(extra) ||
        /analysts\s+track/i.test(extra) ||
        /this\s+development\s+may\s+impact\s+sentiment/i.test(extra) ||
        /market\s+participants\s+are\s+monitoring/i.test(extra) ||
        /routine\s+operational\s+disclosure/i.test(extra) ||
        /favorable\s+announcement\s+for/i.test(extra)
      ) {
        isRepeatedHeadline = true;
        rejectionReason = 'Summary merely contains headline with trivial padding';
      }
    } else if (titleClean.includes(sumClean) && sumClean.length > 10) {
      isRepeatedHeadline = true;
      rejectionReason = 'Summary is a substring of headline';
    } else if (SourceArticleExtractionGate.calculateSimilarity(titleClean, sumClean) > 0.80) {
      isRepeatedHeadline = true;
      rejectionReason = 'Summary has excessive lexical overlap with headline (>80%)';
    }

    // Check sentence-level multi-sentence repetition: (e.g. Headline + rephrased headline)
    const sentences = sumText.split(/(?<=[.?!])\s+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 10);
    if (sentences.length >= 2) {
      const s1 = sentences[0];
      const s2 = sentences[1];
      const s1SimToTitle = SourceArticleExtractionGate.calculateSimilarity(titleClean, s1);
      const s2SimToTitle = SourceArticleExtractionGate.calculateSimilarity(titleClean, s2);
      const s1SimToS2 = SourceArticleExtractionGate.calculateSimilarity(s1, s2);

      // If sentence 1 is the headline and sentence 2 is just rephrasing it
      if (s1SimToTitle > 0.70 && (s2SimToTitle > 0.65 || s1SimToS2 > 0.65)) {
        isRepeatedHeadline = true;
        rejectionReason = 'Summary is a headline-repetition concatenation without substantive body synthesis';
      }
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

    // Guard against contaminated raw HTML or URLs in summary
    if (/<[a-z/][\s\S]*?>/i.test(sumText) || /https?:\/\//i.test(sumText)) {
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

    // Check for Material Fact retention if body has explicit numbers/GMP
    const bodyText = (article.body || article.cleanText || '').toLowerCase();
    if (bodyText.includes('gmp') && /\bgmp\s+(?:at|of|is|stands at)?\s*(?:₹|rs\.?|\$)?\s*(\d+(?:\.\d+)?)\b/i.test(bodyText)) {
      const gmpMatch = bodyText.match(/\bgmp\s+(?:at|of|is|stands at)?\s*(?:₹|rs\.?|\$)?\s*(\d+(?:\.\d+)?)\b/i);
      if (gmpMatch && !sumTextLower.includes('gmp') && !sumTextLower.includes(gmpMatch[1])) {
        // GMP was lost
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
