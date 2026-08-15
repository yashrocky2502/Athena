import { IntelligenceRecord, IntelligenceValidationResult } from "./IntelligenceTypes.ts";

export class IntelligenceValidator {
  public static validate(record: IntelligenceRecord): IntelligenceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!record.articleId) {
      errors.push("Missing articleId");
    }

    if (!record.headline || record.headline.trim() === "") {
      errors.push("Missing headline");
    }

    // 1. Entity Validity
    if (record.companyName === "NONE" && record.symbol) {
      errors.push("Invalid companyName 'NONE' when valid symbol exists");
    }

    if (record.fnoEligible && !record.symbol) {
      errors.push("fnoEligible is true but symbol is null");
    }

    // Check false NIFTY assignment on non-index articles
    if (record.symbol === "NIFTY" && record.entityType !== "BROAD_MARKET") {
      errors.push("NIFTY symbol assigned to non-broad-market entityType");
    }

    // 2. Financial Metrics Check
    if (record.financialMetrics) {
      for (const m of record.financialMetrics) {
        if (m.currentValue === null && m.changePercent === null && m.direction === "NEUTRAL") {
          warnings.push(`Metric ${m.name} has no valid value or direction`);
        }
      }
    }

    // 3. Options Seller Impact Safety Check
    const optionsText = (record.optionsSellerImpact || "").toLowerCase();
    const unsupportedPatterns = [
      /\b(buy\s*\d+\s*(ce|pe)|sell\s*\d+\s*(ce|pe))\b/i, // Specific strike recommendations
      /\b(target\s*price\s*:\s*rs\.?\s*\d+)\b/i,          // Unsupported target price
      /\b(stop\s*loss\s*:\s*rs\.?\s*\d+)\b/i,           // Unsupported stop loss
      /\b(guaranteed\s*theta|100%\s*win\s*rate)\b/i     // Fabricated guarantees
    ];

    for (const pattern of unsupportedPatterns) {
      if (pattern.test(optionsText)) {
        errors.push(`Options Seller Impact contains unsupported speculative text: "${optionsText}"`);
      }
    }

    // 4. Executive Summary Check
    if (!record.executiveSummary || record.executiveSummary.trim() === "") {
      errors.push("Executive summary is empty");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
