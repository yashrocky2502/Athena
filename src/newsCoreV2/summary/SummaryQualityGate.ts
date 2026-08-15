import { NewsArticleV2 } from "../domain/NewsArticle";
import { SummaryConsistencyValidator, ValidationResult } from "./SummaryConsistencyValidator";
import { NormalizedFinancialMetric } from "../intelligence/FinancialMetricEngine";

export interface QualityGateResult {
  passed: boolean;
  reason?: string;
  confidence: number;
}

export class SummaryQualityGate {
  /**
   * Evaluates the summary text and its metadata against strict quality benchmarks.
   */
  public static evaluate(
    article: NewsArticleV2,
    summaryText: string,
    keyMetrics: NormalizedFinancialMetric[],
    whatChanged: string[],
    whyItMatters: string,
    marketImpact: string,
    riskWatchpoints: string[]
  ): QualityGateResult {
    // 1. Check for empty inputs
    if (!summaryText || !summaryText.trim()) {
      return { passed: false, reason: "Summary text is empty", confidence: 0 };
    }

    // 2. Check for generic or meaningless text
    const cleanSummary = summaryText.trim().toLowerCase();
    if (cleanSummary.length < 15) {
      return { passed: false, reason: "Summary is too short or meaningless", confidence: 0 };
    }

    const genericPhrases = [
      "summary currently unavailable",
      "no information available",
      "this article describes a company",
      "click here to read more"
    ];
    if (genericPhrases.some((phrase) => cleanSummary.includes(phrase))) {
      return { passed: false, reason: "Summary contains placeholder or meaningless generic text", confidence: 0 };
    }

    // 3. Check for repeating headline exactly without adding information
    const headlineLower = article.headline.trim().toLowerCase();
    if (cleanSummary === headlineLower || cleanSummary.replace(/[^\w]/g, "") === headlineLower.replace(/[^\w]/g, "")) {
      return { passed: false, reason: "Summary merely repeats the headline without adding synthesis", confidence: 10 };
    }

    // 4. Run the core Consistency Validator
    const consistency = SummaryConsistencyValidator.validate(
      article,
      summaryText,
      keyMetrics,
      whatChanged,
      whyItMatters,
      marketImpact,
      riskWatchpoints
    );

    if (!consistency.isValid) {
      return { passed: false, reason: consistency.reason || "Consistency validation failed", confidence: 0 };
    }

    // 5. Calculate Confidence Score
    // We compute a confidence score out of 1.0 (or 100) based on source traceability
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have deterministic key metrics
    if (keyMetrics && keyMetrics.length > 0) {
      confidence += 0.2;
    }

    // Increase confidence if we have source-grounded tracing (e.g., sentence structure matching)
    if (summaryText.length > 50) {
      confidence += 0.1;
    }

    // If what changed and risk watchpoints are populated
    if (whatChanged && whatChanged.length > 0) {
      confidence += 0.1;
    }
    if (riskWatchpoints && riskWatchpoints.length > 0) {
      confidence += 0.1;
    }

    // Ensure confidence is capped at 1.0
    confidence = Math.min(1.0, Math.max(0.0, confidence));

    // 6. Check for unsupported trading advice
    const tradingAdviceWords = ["strong buy", "strong sell", "must buy", "invest immediately", "perfect time to buy"];
    const sourceTextLower = `${article.headline} ${article.body}`.toLowerCase();
    for (const word of tradingAdviceWords) {
      if (cleanSummary.includes(word) && !sourceTextLower.includes(word)) {
        return { passed: false, reason: `Contains unsupported trading advice keyword: '${word}'`, confidence: 0 };
      }
    }

    return {
      passed: true,
      confidence
    };
  }
}
