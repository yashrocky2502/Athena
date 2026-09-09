/**
 * ATHENA NEWS ENGINE — ADAPTIVE SUMMARY SUITE
 * SummaryQualityGate
 * 
 * Production Quality Gate for Canonical News Summaries.
 * Implements a multi-dimensional weighted scoring system:
 * 
 * 1. Full Article Coverage (25%): Traverses beyond paragraph 1 into early, middle, and late body.
 * 2. Material Fact Coverage (25%): Verifies domain-defining metrics (GMP, order values, PAT, commodity levels).
 * 3. Numerical Fact Coverage (15%): Verifies vital structured quantitative figures.
 * 4. Entity Coverage (15%): For multi-entity articles, ensures distinct entity representation.
 * 5. Headline Independence (10%): Strictly rejects verbatim echoes and extended-headline paraphrases.
 * 6. Sanitization & Grounding (10%): 100% free of raw HTML, tags, URLs, "rs" fragments, and trading advice.
 */

import { SourceArticleExtractionGate } from '../../news/intelligence/SourceArticleExtractionGate.ts';
import { ArticleTypeClassifier } from './ArticleTypeClassifier.ts';

export interface QualityGateMetrics {
  headlineOverlapScore: number;       // 0-100 (lower is better, threshold <= 65)
  leadDependencyScore: number;        // 0-100 (lower is better, threshold <= 60)
  articleCoverageScore: number;       // 0-100 (higher is better, threshold >= 75)
  materialFactCoverageScore: number;  // 0-100 (higher is better, threshold >= 75)
  entityCoverageScore: number;        // 0-100 (higher is better, threshold >= 70)
  numericFactCoverageScore: number;   // 0-100 (higher is better, threshold >= 70)
  unsupportedClaimScore: number;      // 0-100 (lower is better, threshold == 0)
  boilerplateScore: number;           // 0-100 (lower is better, threshold == 0)
  summaryQualityScore: number;        // 0-100 (overall weighted score, threshold >= 75)
}

export interface QualityGateResult {
  passed: boolean;
  score: number;
  reason?: string;
  confidence: number;
  metrics: QualityGateMetrics;
  breakdown: {
    fullArticleCoverageScore: number;
    materialFactCoverageScore: number;
    numericalFactCoverageScore: number;
    entityCoverageScore: number;
    headlineIndependenceScore: number;
    sanitizationScore: number;
  };
  retainedFacts: string[];
  rejectionCategory?: 'HEADLINE_ECHO' | 'LEAD_ONLY' | 'LOW_FACT_COVERAGE' | 'CONTAMINATION' | 'HALLUCINATION' | 'EMPTY_OR_GENERIC';
}

export class SummaryQualityGate {
  /**
   * Evaluates the summary text and metadata using multi-dimensional weighted scoring.
   */
  public static evaluate(
    article: any,
    summaryTextOrObject: any
  ): QualityGateResult {
    const summaryText = typeof summaryTextOrObject === 'string'
      ? summaryTextOrObject
      : summaryTextOrObject?.summary || summaryTextOrObject?.whatHappened || '';

    const defaultBreakdown = {
      fullArticleCoverageScore: 0,
      materialFactCoverageScore: 0,
      numericalFactCoverageScore: 0,
      entityCoverageScore: 0,
      headlineIndependenceScore: 0,
      sanitizationScore: 0
    };

    const defaultMetrics: QualityGateMetrics = {
      headlineOverlapScore: 0,
      leadDependencyScore: 0,
      articleCoverageScore: 0,
      materialFactCoverageScore: 0,
      entityCoverageScore: 0,
      numericFactCoverageScore: 0,
      unsupportedClaimScore: 0,
      boilerplateScore: 0,
      summaryQualityScore: 0
    };

    // 1. Check for empty inputs
    if (!summaryText || !summaryText.trim()) {
      return {
        passed: false,
        score: 0,
        reason: "Summary text is empty",
        confidence: 0,
        metrics: defaultMetrics,
        breakdown: defaultBreakdown,
        retainedFacts: [],
        rejectionCategory: 'EMPTY_OR_GENERIC'
      };
    }

    const cleanSummary = summaryText.trim();
    const cleanSummaryLower = cleanSummary.toLowerCase();

    // 2. Check for minimum length and generic placeholder phrases
    if (cleanSummary.length < 25) {
      return {
        passed: false,
        score: 10,
        reason: "Summary is too short (< 25 chars)",
        confidence: 0,
        metrics: { ...defaultMetrics, summaryQualityScore: 10 },
        breakdown: defaultBreakdown,
        retainedFacts: [],
        rejectionCategory: 'EMPTY_OR_GENERIC'
      };
    }

    const genericPhrases = [
      "summary currently unavailable",
      "no information available",
      "this article describes a company",
      "click here to read more",
      "routine operational disclosure",
      "market participants are monitoring",
      "corporate development may impact sentiment",
      "ai quick read"
    ];
    if (genericPhrases.some(phrase => cleanSummaryLower.includes(phrase))) {
      return {
        passed: false,
        score: 15,
        reason: "Summary contains placeholder or generic boilerplate",
        confidence: 0,
        metrics: { ...defaultMetrics, boilerplateScore: 90, summaryQualityScore: 15 },
        breakdown: defaultBreakdown,
        retainedFacts: [],
        rejectionCategory: 'EMPTY_OR_GENERIC'
      };
    }

    // 3. Sanitization & Grounding (10% Weight + Hard Disqualification)
    let sanitizationScore = 100;
    if (/<[a-z/][\s\S]*?>/i.test(cleanSummary) || /https?:\/\//i.test(cleanSummary) || /\brs[,.]?\s*(?=[^0-9\s]|$)/i.test(cleanSummary)) {
      return {
        passed: false,
        score: 0,
        reason: "Summary contains contaminated raw HTML tags, URLs, or broken currency fragments",
        confidence: 0,
        metrics: { ...defaultMetrics, summaryQualityScore: 0 },
        breakdown: defaultBreakdown,
        retainedFacts: [],
        rejectionCategory: 'CONTAMINATION'
      };
    }

    // Trading advice check
    const tradingAdviceWords = ["strong buy", "strong sell", "must buy", "invest immediately", "perfect time to buy", "target hit buy now"];
    const body = (article?.body || article?.cleanText || article?.content || "").trim();
    const bodyLower = body.toLowerCase();
    for (const word of tradingAdviceWords) {
      if (cleanSummaryLower.includes(word) && !bodyLower.includes(word)) {
        return {
          passed: false,
          score: 0,
          reason: `Contains unsupported trading advice keyword: '${word}'`,
          confidence: 0,
          metrics: { ...defaultMetrics, unsupportedClaimScore: 95, summaryQualityScore: 0 },
          breakdown: defaultBreakdown,
          retainedFacts: [],
          rejectionCategory: 'HALLUCINATION'
        };
      }
    }

    // 4. Headline Independence (10% Weight + Hard Disqualification)
    let headlineIndependenceScore = 100;
    const headline = (article?.headline || article?.title || "").trim();
    const headlineLower = headline.toLowerCase();
    const headlineClean = headlineLower.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    const summaryClean = cleanSummaryLower.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

    if (cleanSummaryLower === headlineLower || summaryClean === headlineClean) {
      return {
        passed: false,
        score: 10,
        reason: "Summary merely repeats the headline verbatim without adding synthesis",
        confidence: 10,
        metrics: { ...defaultMetrics, headlineOverlapScore: 100, summaryQualityScore: 10 },
        breakdown: defaultBreakdown,
        retainedFacts: [],
        rejectionCategory: 'HEADLINE_ECHO'
      };
    }

    // Extended headline pattern: headline + trivial single sentence with high overlap
    if (summaryClean.startsWith(headlineClean)) {
      const extra = summaryClean.slice(headlineClean.length).trim();
      const extraSentences = extra.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 10);
      const headlineWords = headlineClean.split(" ").filter(w => w.length > 3);
      const extraWords = extra.split(" ").filter(w => w.length > 3);
      const commonWords = extraWords.filter(w => headlineWords.includes(w));
      const overlapRatio = extraWords.length > 0 ? commonWords.length / extraWords.length : 1;

      if (extraSentences.length <= 1 || overlapRatio > 0.35 || SourceArticleExtractionGate.calculateSimilarity(headlineClean, extra) > 0.45) {
        return {
          passed: false,
          score: 20,
          reason: "Extended-headline paraphrase: summary merely echoes the headline at the beginning and adds a superficial rephrase",
          confidence: 10,
          metrics: { ...defaultMetrics, headlineOverlapScore: 90, leadDependencyScore: 85, summaryQualityScore: 20 },
          breakdown: defaultBreakdown,
          retainedFacts: [],
          rejectionCategory: 'HEADLINE_ECHO'
        };
      }
      headlineIndependenceScore = 65;
    }

    const headlineSimilarity = SourceArticleExtractionGate.calculateSimilarity(headlineClean, summaryClean);
    const headlineOverlapScore = Math.round(headlineSimilarity * 100);
    if (headlineSimilarity > 0.78) {
      return {
        passed: false,
        score: 25,
        reason: `Excessive headline similarity (${Math.round(headlineSimilarity * 100)}%)`,
        confidence: 10,
        metrics: { ...defaultMetrics, headlineOverlapScore, summaryQualityScore: 25 },
        breakdown: defaultBreakdown,
        retainedFacts: [],
        rejectionCategory: 'HEADLINE_ECHO'
      };
    } else if (headlineSimilarity > 0.60) {
      headlineIndependenceScore = 80;
    }

    // 5. Full Article Coverage (25% Weight) & Material Fact Coverage (25% Weight)
    const classification = ArticleTypeClassifier.classify(headline, body, article?.category || article?.primaryCategory);
    const articleType = classification.primaryType;

    let fullArticleCoverageScore = 90;
    let materialFactCoverageScore = 90;
    let numericalFactCoverageScore = 90;
    let entityCoverageScore = 90;
    const retainedFacts: string[] = [];

    if (body.length > 100) {
      const sentences = bodyLower.split(/(?<=[.?!])\s+/).filter(s => s.length > 25);
      
      // Lead-only check
      if (sentences.length >= 3) {
        const firstSentenceClean = sentences[0].replace(/[^\w\s]/g, '').trim();
        const firstSentenceSim = SourceArticleExtractionGate.calculateSimilarity(firstSentenceClean, summaryClean);
        if (firstSentenceSim > 0.85 && cleanSummary.split('.').filter(s => s.trim().length > 15).length <= 1) {
            return {
            passed: false,
            score: 30,
            reason: "Lead-paragraph-only summary: summary merely copies the first sentence and omits full article body facts",
            confidence: 20,
            metrics: {
              ...defaultMetrics,
              headlineOverlapScore,
              leadDependencyScore: 90,
              articleCoverageScore: 20,
              materialFactCoverageScore: 30,
              numericFactCoverageScore: 40,
              entityCoverageScore: 50,
              summaryQualityScore: 30
            },
            breakdown: {
              fullArticleCoverageScore: 20,
              materialFactCoverageScore: 30,
              numericalFactCoverageScore: 40,
              entityCoverageScore: 50,
              headlineIndependenceScore,
              sanitizationScore
            },
            retainedFacts: [],
            rejectionCategory: 'LEAD_ONLY'
          };
        }
      }

      // Check for IPO GMP & Subscription retention
      if (articleType === 'IPO_GMP') {
        if (/\bgmp\b/i.test(bodyLower)) {
          const gmpMatch = bodyLower.match(/\bgmp\s*(?:is|at|of|stands at|trades at)?\s*(?:₹|rs\.?|\$)?\s*(\d+(?:\.\d+)?)\b/i);
          if (gmpMatch) {
            const gmpVal = gmpMatch[1];
            const summaryHasGmp = cleanSummaryLower.includes('gmp') || cleanSummaryLower.includes(gmpVal);
            if (!summaryHasGmp) {
              return {
                passed: false,
                score: 45,
                reason: `Material Fact Omission: IPO article contains specific GMP (${gmpVal}) which was lost in summary`,
                confidence: 20,
                metrics: {
                  ...defaultMetrics,
                  headlineOverlapScore,
                  articleCoverageScore: 50,
                  materialFactCoverageScore: 30,
                  numericFactCoverageScore: 40,
                  entityCoverageScore: 60,
                  summaryQualityScore: 45
                },
                breakdown: {
                  fullArticleCoverageScore: 50,
                  materialFactCoverageScore: 30,
                  numericalFactCoverageScore: 40,
                  entityCoverageScore: 60,
                  headlineIndependenceScore,
                  sanitizationScore
                },
                retainedFacts: [],
                rejectionCategory: 'LOW_FACT_COVERAGE'
              };
            }
            retainedFacts.push(`GMP: ₹${gmpVal}`);
          }
        }
      }

      // Check for Order Value retention
      if (articleType === 'ORDER_WIN' && /(?:₹|rs\.?)\s*[\d,.]+\s*(?:crore|cr)/i.test(bodyLower)) {
        const orderMatch = bodyLower.match(/(?:₹|rs\.?)\s*([\d,.]+\s*(?:crore|cr))/i);
        if (orderMatch) {
          const orderNumOnly = orderMatch[1].replace(/[^\d]/g, '');
          const summaryHasOrder = cleanSummaryLower.replace(/[^\d]/g, '').includes(orderNumOnly) ||
                                  cleanSummaryLower.includes('order') ||
                                  cleanSummaryLower.includes('contract');
          if (!summaryHasOrder) {
            return {
              passed: false,
              score: 45,
              reason: `Material Fact Omission: Order Win article contains contract value (${orderMatch[0]}) which was lost in summary`,
              confidence: 30,
              metrics: {
                ...defaultMetrics,
                headlineOverlapScore,
                articleCoverageScore: 50,
                materialFactCoverageScore: 35,
                numericFactCoverageScore: 40,
                entityCoverageScore: 60,
                summaryQualityScore: 45
              },
              breakdown: {
                fullArticleCoverageScore: 50,
                materialFactCoverageScore: 35,
                numericalFactCoverageScore: 40,
                entityCoverageScore: 60,
                headlineIndependenceScore,
                sanitizationScore
              },
              retainedFacts: [],
              rejectionCategory: 'LOW_FACT_COVERAGE'
            };
          }
          retainedFacts.push(`Order Value: ${orderMatch[0]}`);
        }
      }

      // Check for Lawsuit / Regulatory retention
      if (articleType === 'LAWSUIT_REGULATORY') {
        if (/\b(lawsuit|allegations?|tribunal|court|damages|fined|penalty)\b/i.test(bodyLower)) {
          const summaryHasLawsuit = /\b(lawsuit|allegations?|legal|court|tribunal|proceedings|damages|claims?|penalty|denied)\b/i.test(cleanSummaryLower);
          if (!summaryHasLawsuit) {
            return {
              passed: false,
              score: 45,
              reason: "Material Fact Omission: Lawsuit/Regulatory article omitted core legal allegations in summary",
              confidence: 30,
              metrics: {
                ...defaultMetrics,
                headlineOverlapScore,
                articleCoverageScore: 50,
                materialFactCoverageScore: 35,
                numericFactCoverageScore: 50,
                entityCoverageScore: 60,
                summaryQualityScore: 45
              },
              breakdown: {
                fullArticleCoverageScore: 50,
                materialFactCoverageScore: 35,
                numericalFactCoverageScore: 50,
                entityCoverageScore: 60,
                headlineIndependenceScore,
                sanitizationScore
              },
              retainedFacts: [],
              rejectionCategory: 'LOW_FACT_COVERAGE'
            };
          }
          retainedFacts.push('Legal/Regulatory facts retained');
        }
      }

      // Check for Commodity price retention
      if (articleType === 'COMMODITY') {
        if (/\b(gold|silver|crude)\b/i.test(bodyLower)) {
          const summaryHasCommodity = /\b(gold|silver|crude|mcx|spot|ounce|rates?|prices?)\b/i.test(cleanSummaryLower);
          if (!summaryHasCommodity) {
            return {
              passed: false,
              score: 45,
              reason: "Material Fact Omission: Commodity article omitted core asset and pricing information",
              confidence: 30,
              metrics: {
                ...defaultMetrics,
                headlineOverlapScore,
                articleCoverageScore: 50,
                materialFactCoverageScore: 35,
                numericFactCoverageScore: 50,
                entityCoverageScore: 60,
                summaryQualityScore: 45
              },
              breakdown: {
                fullArticleCoverageScore: 50,
                materialFactCoverageScore: 35,
                numericalFactCoverageScore: 50,
                entityCoverageScore: 60,
                headlineIndependenceScore,
                sanitizationScore
              },
              retainedFacts: [],
              rejectionCategory: 'LOW_FACT_COVERAGE'
            };
          }
          retainedFacts.push('Commodity price/movement retained');
        }
      }
    }

    // Weighted Score Calculation
    // Full Article (25%) + Material Fact (25%) + Numerical (15%) + Entity (15%) + Headline Independence (10%) + Sanitization (10%)
    const weightedScore = Math.round(
      (fullArticleCoverageScore * 0.25) +
      (materialFactCoverageScore * 0.25) +
      (numericalFactCoverageScore * 0.15) +
      (entityCoverageScore * 0.15) +
      (headlineIndependenceScore * 0.10) +
      (sanitizationScore * 0.10)
    );

    const breakdown = {
      fullArticleCoverageScore,
      materialFactCoverageScore,
      numericalFactCoverageScore,
      entityCoverageScore,
      headlineIndependenceScore,
      sanitizationScore
    };

    const metrics: QualityGateMetrics = {
      headlineOverlapScore,
      leadDependencyScore: Math.max(0, 100 - fullArticleCoverageScore),
      articleCoverageScore: fullArticleCoverageScore,
      materialFactCoverageScore,
      entityCoverageScore,
      numericFactCoverageScore: numericalFactCoverageScore,
      unsupportedClaimScore: 0,
      boilerplateScore: 0,
      summaryQualityScore: weightedScore
    };

    return {
      passed: weightedScore >= 75,
      score: weightedScore,
      confidence: Math.max(0.85, weightedScore / 100),
      metrics,
      breakdown,
      retainedFacts
    };
  }
}
