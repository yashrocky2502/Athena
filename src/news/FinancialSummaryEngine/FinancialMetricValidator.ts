import { NormalizedMetric, SUPPORTED_METRICS } from './FinancialMetricNormalizer';

export class FinancialMetricValidator {
  /**
   * Validate a list of extracted/normalized metrics.
   * Returns a list of error strings. If empty, the metrics list is valid.
   */
  public static validateMetricsList(metrics: NormalizedMetric[]): string[] {
    const errors: string[] = [];
    const seenNames = new Set<string>();

    for (const m of metrics) {
      // 1. Wrong metric name check
      if (!SUPPORTED_METRICS.includes(m.name)) {
        errors.push(`Invalid metric name detected: "${m.name}"`);
      }

      // 2. Metric duplicated check
      if (seenNames.has(m.name)) {
        errors.push(`Duplicate metric detected: "${m.name}"`);
      }
      seenNames.add(m.name);

      // 3. Metric value missing or placeholder check
      const cleanVal = m.value.replace(/₹|Rs\.?|Rupees|USD|\$|%|crores?|cr\.?|lakhs?|billions?|millions?|bn|mn/gi, "").trim();
      if (!cleanVal || cleanVal.toLowerCase() === "n/a" || cleanVal.toLowerCase() === "null" || cleanVal.toLowerCase() === "undefined") {
        errors.push(`Metric "${m.name}" has missing or invalid value`);
      }

      // 4. Margin/NIM mentioned without % check
      if (m.name.includes("Margin") || m.name === "NIM" || m.name === "GNPA" || m.name === "NNPA") {
        if (!m.value.includes("%")) {
          errors.push(`Margin metric "${m.name}" value must contain "%"`);
        }
      }
    }

    return errors;
  }

  /**
   * Scans summary text to reject generic phrases like "Revenue increased" or "Revenue improved" without values.
   */
  public static validateSummaryText(text: string): string[] {
    const errors: string[] = [];
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

    // Check for generic, un-quantified financial statements
    const keywords = ["revenue", "profit", "ebitda", "pat", "pbt", "margin", "income", "sales"];
    const genericVerbs = ["increased", "decreased", "rose", "fell", "grew", "declined", "improved", "dropped", "slid", "surged", "growth", "jumped", "up", "down"];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      // Look for a keyword and a verb indicating change
      const hasKeyword = keywords.some(k => lower.includes(k));
      const hasVerb = genericVerbs.some(v => new RegExp(`\\b${v}\\b`).test(lower));

      if (hasKeyword && hasVerb) {
        // Skip check if it is clearly a qualitative/contextual remark or outlook/takeaway statement
        const isQualitative = [
          "guidance", "outlook", "consider", "evaluating", "subsequent", "future",
          "upcoming", "long-term", "strategic", "impact", "takeaway", "monitor",
          "track", "observe", "focus on", "evaluate", "indicate", "indicates",
          "trend", "trends", "performance", "investor", "investors", "confidence",
          "rating", "ratings", "sentiment", "potential", "benefit", "expect",
          "expectations", "view", "support", "suggest", "suggests", "analyst", "analysts"
        ].some(term => lower.includes(term));

        if (isQualitative) {
          continue;
        }

        // Must contain a numeric figure (e.g., "8,600", "25%", "₹", "Rs", "percent")
        const hasNumber = /\d/.test(lower) || lower.includes("percent");
        const hasSpecificValue = (
          lower.includes("₹") || lower.includes("rs") || lower.includes("percent") || lower.includes("%") || 
          lower.includes("crore") || lower.includes("cr") || lower.includes("bps") || lower.includes("basis points") ||
          lower.includes("point") || lower.includes("points") || lower.includes("lakh") || lower.includes("lakhs") ||
          lower.includes("million") || lower.includes("billion") || lower.includes("usd") || lower.includes("$") ||
          (() => {
            const numbers = lower.match(/\b\d+(?:\.\d+)?\b/g) || [];
            return numbers.some(numStr => {
              const num = parseFloat(numStr);
              if (num >= 2020 && num <= 2030) return false;
              const index = lower.indexOf(numStr);
              if (index > 0) {
                const prevChar = lower[index - 1];
                const prevWord = lower.substring(Math.max(0, index - 5), index);
                if (prevChar === 'q' || prevWord.includes('q') || prevWord.includes('fy')) {
                  return false;
                }
              }
              return true;
            });
          })()
        );

        if (!hasNumber || !hasSpecificValue) {
          errors.push(`Generic phrase detected: "${sentence}". Financial metrics must specify exact values (e.g. ₹8,600 crore or 25%).`);
        }
      }
    }

    // Check for explicit bans from Step 4
    const bannedPhrases = ["revenue improved", "profit increased", "strong performance", "solid quarter"];
    for (const phrase of bannedPhrases) {
      if (text.toLowerCase().includes(phrase)) {
        const containingSentence = sentences.find(s => s.toLowerCase().includes(phrase));
        if (containingSentence) {
          const lowerS = containingSentence.toLowerCase();
          const hasNumber = /\d/.test(lowerS) || lowerS.includes("percent");
          const hasSpecificValue = (
            lowerS.includes("₹") || lowerS.includes("rs") || lowerS.includes("percent") || lowerS.includes("%") || 
            lowerS.includes("crore") || lowerS.includes("cr") || lowerS.includes("bps") || lowerS.includes("basis points") ||
            lowerS.includes("point") || lowerS.includes("points") || lowerS.includes("lakh") || lowerS.includes("lakhs") ||
            lowerS.includes("million") || lowerS.includes("billion") || lowerS.includes("usd") || lowerS.includes("$") ||
            (() => {
              const numbers = lowerS.match(/\b\d+(?:\.\d+)?\b/g) || [];
              return numbers.some(numStr => {
                const num = parseFloat(numStr);
                if (num >= 2020 && num <= 2030) return false;
                const index = lowerS.indexOf(numStr);
                if (index > 0) {
                  const prevChar = lowerS[index - 1];
                  const prevWord = lowerS.substring(Math.max(0, index - 5), index);
                  if (prevChar === 'q' || prevWord.includes('q') || prevWord.includes('fy')) {
                    return false;
                  }
                }
                return true;
              });
            })()
          );
          if (hasNumber && hasSpecificValue) {
            continue;
          }
        }
        errors.push(`Banned generic phrase detected: "${phrase}"`);
      }
    }

    return errors;
  }

  /**
   * Check if the summary passes the Quality Gate (Step 10).
   * Every earnings article summary must contain: Revenue, Profit (or PAT).
   * Returns true if the quality gate is met.
   */
  public static passesQualityGate(metrics: NormalizedMetric[], text: string): boolean {
    const hasRevenue = metrics.some(m => m.name === "Revenue" || m.name === "Net Revenue");
    const hasProfit = metrics.some(m => m.name === "Net Profit" || m.name === "PAT" || m.name === "PBT");
    
    // We can also check summary text
    const textLower = text.toLowerCase();
    const textHasRevenue = textLower.includes("revenue") || textLower.includes("turnover");
    const textHasProfit = textLower.includes("profit") || textLower.includes("pat");

    return (hasRevenue && hasProfit) || (textHasRevenue && textHasProfit);
  }
}
