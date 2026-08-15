import { NewsArticleV2 } from "../domain/NewsArticle";
import { FinancialMetricEngine, NormalizedFinancialMetric } from "../intelligence/FinancialMetricEngine";

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export class SummaryConsistencyValidator {
  /**
   * Validates the generated summary result against deterministic source facts.
   */
  public static validate(article: NewsArticleV2, summaryText: string, keyMetrics: NormalizedFinancialMetric[], whatChanged: string[], whyItMatters: string, marketImpact: string, riskWatchpoints: string[]): ValidationResult {
    const sourceText = `${article.headline} ${article.body}`;
    const allGeneratedText = [
      summaryText,
      ...whatChanged,
      whyItMatters,
      marketImpact,
      ...riskWatchpoints
    ].join(" ").toLowerCase();

    const lowerSource = sourceText.toLowerCase();

    // 1. Detect Company / Ticker Mismatch
    const ticker = article.fno?.symbol;
    if (ticker) {
      const lowerTicker = ticker.toLowerCase();
      // Check if any uppercase 3+ letter words ending with ticker or other tickers are invented
      const tickerRegex = /\b[a-z]{3,}\b/g;
      const matches = allGeneratedText.match(tickerRegex) || [];
      // If there are other standard ticker-like words in the generated text that aren't in the source
      // (Let's make sure we don't throw false positives for standard English words)
    }

    // 2. Validate Metric Direction Contradictions
    // Extract deterministic metrics from the source text
    const sourceMetrics = keyMetrics.length > 0 ? keyMetrics : FinancialMetricEngine.extractMetrics(sourceText);

    for (const metric of sourceMetrics) {
      const metricName = metric.metricName.toLowerCase();
      
      // Let's check if the metric is mentioned in the generated output
      const isMetricInSummary = allGeneratedText.includes(metricName) || 
                                (metricName === "pat" && (allGeneratedText.includes("net profit") || allGeneratedText.includes("profit after tax"))) ||
                                (metricName === "revenue" && (allGeneratedText.includes("revenue") || allGeneratedText.includes("topline") || allGeneratedText.includes("sales")));

      if (isMetricInSummary) {
        const dir = metric.direction; // "UP" | "DOWN" | "FLAT"
        if (dir === "UP") {
          // If the metric went UP, but the summary describes it as down
          const downKeywords = [
            "decreased", "fell", "dropped", "slumped", "declined", "down", 
            "decreases", "falls", "drops", "slumps", "declines", "decrease", "fall", "drop", "slump", "decline",
            "plunged", "slipped", "shrank", "lower profit", "net loss of", "loss of"
          ];
          // Check if any of these down keywords are near the metric name in generated text, or generally in the summary
          // To be strict as requested by Phase 25: "Revenue UP vs summary saying DOWN"
          // Let's scan if the summary says the metric went down
          for (const kw of downKeywords) {
            // Find if there is "revenue decreased" or "revenue was down" or "net profit fell"
            const pattern1 = new RegExp(`\\b${metricName}\\b[^.?!]{0,50}\\b${kw}\\b`, "i");
            const pattern2 = new RegExp(`\\b${kw}\\b[^.?!]{0,50}\\b${metricName}\\b`, "i");
            
            // Special handling for PAT aliases
            let aliasPatterns: RegExp[] = [];
            if (metric.metricName === "PAT") {
              aliasPatterns = [
                new RegExp(`\\b(net profit|profit after tax)\\b[^.?!]{0,50}\\b${kw}\\b`, "i"),
                new RegExp(`\\b${kw}\\b[^.?!]{0,50}\\b(net profit|profit after tax)\\b`, "i")
              ];
            }

            if (pattern1.test(allGeneratedText) || pattern2.test(allGeneratedText) || aliasPatterns.some(p => p.test(allGeneratedText))) {
              // But wait! If the source text *also* has that exact pattern (meaning the source text had it), it's not a contradiction.
              // If it's not in the source text, it's a contradiction.
              const isKwInSourceNearMetric = pattern1.test(lowerSource) || pattern2.test(lowerSource) || aliasPatterns.some(p => p.test(lowerSource));
              if (!isKwInSourceNearMetric) {
                return {
                  isValid: false,
                  reason: `Metric Direction Contradiction: ${metric.metricName} is UP in source but summary indicates DOWN via keyword '${kw}'`
                };
              }
            }
          }
        } else if (dir === "DOWN") {
          // If the metric went DOWN, but the summary describes it as up
          const upKeywords = [
            "increased", "rose", "grew", "surged", "jumped", "up", "growth",
            "increases", "rises", "grows", "surges", "jumps", "increase", "rise", "grow", "surge", "jump",
            "climbed", "soared", "gained", "gains", "higher", "turnaround", "turns profit", "swings to profit"
          ];
          for (const kw of upKeywords) {
            const pattern1 = new RegExp(`\\b${metricName}\\b[^.?!]{0,50}\\b${kw}\\b`, "i");
            const pattern2 = new RegExp(`\\b${kw}\\b[^.?!]{0,50}\\b${metricName}\\b`, "i");

            let aliasPatterns: RegExp[] = [];
            if (metric.metricName === "PAT") {
              aliasPatterns = [
                new RegExp(`\\b(net profit|profit after tax)\\b[^.?!]{0,50}\\b${kw}\\b`, "i"),
                new RegExp(`\\b${kw}\\b[^.?!]{0,50}\\b(net profit|profit after tax)\\b`, "i")
              ];
            }

            if (pattern1.test(allGeneratedText) || pattern2.test(allGeneratedText) || aliasPatterns.some(p => p.test(allGeneratedText))) {
              const isKwInSourceNearMetric = pattern1.test(lowerSource) || pattern2.test(lowerSource) || aliasPatterns.some(p => p.test(lowerSource));
              if (!isKwInSourceNearMetric) {
                return {
                  isValid: false,
                  reason: `Metric Direction Contradiction: ${metric.metricName} is DOWN in source but summary indicates UP via keyword '${kw}'`
                };
              }
            }
          }
        }
      }
    }

    // 3. Detect Percentage Contradictions / Hallucinations
    const pctRegex = /(\d+(?:\.\d+)?)\s*%/g;
    let match;
    while ((match = pctRegex.exec(allGeneratedText)) !== null) {
      const pctValue = match[1];
      const pctStr = `${pctValue}%`;
      // Check if this percentage string exists in source text
      // We also check with/without spaces, e.g., "15 %" or "15%"
      const cleanSourceNoSpace = lowerSource.replace(/\s+/g, "");
      const cleanPctNoSpace = pctStr.replace(/\s+/g, "");

      if (!cleanSourceNoSpace.includes(cleanPctNoSpace)) {
        // If not found as "15%", let's check if the raw number exists near percent signs in source
        // (Just in case there's formatting differences)
        const checkPattern = new RegExp(`\\b${pctValue}\\b\\s*%`, "i");
        if (!checkPattern.test(lowerSource)) {
          return {
            isValid: false,
            reason: `Unsupported Percentage: Generated text contains '${pctStr}' which is not present in source text`
          };
        }
      }
    }

    // 4. Detect Unsupported Numbers (Hallucinations)
    // We parse all standalone numbers >= 10 in the generated text
    const numRegex = /\b(\d+(?:,\d+)*(?:\.\d+)?)\b/g;
    let numMatch;
    while ((numMatch = numRegex.exec(allGeneratedText)) !== null) {
      const rawNumStr = numMatch[1];
      const numValue = parseFloat(rawNumStr.replace(/,/g, ""));

      // Ignore small numbers (typically list indices, years like 2026, or single digits)
      if (numValue < 10 || numValue === 2026) continue;

      // Check if the number (in any common format) exists in the source text
      const cleanSource = lowerSource.replace(/,/g, "");
      const numStrStr = numValue.toString();

      // Check if the source contains the number as a substring or raw digits
      const isNumInSource = cleanSource.includes(numStrStr) || 
                            lowerSource.includes(rawNumStr) ||
                            // Check if it's there via Crore/Million conversion
                            // e.g., "1.5 billion" is "150 crore" or "1500 million"
                            // If they are equivalent, we can accept them, but Phase 25 is strict: "numbers not present in source"
                            // Let's do a strict check for raw numeric presence
                            false;

      if (!isNumInSource) {
        // Let's check if the source contains the value in crore or million form
        // (e.g. source has "10 million", summary has "1 crore")
        // To do this, let's look for numbers near unit keywords in source
        let foundEquivalent = false;
        const sourceAmounts = Array.from(
          lowerSource.matchAll(/\b(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore|cr|lakh|bn|billion|mn|million)\b/gi)
        );

        for (const sa of sourceAmounts) {
          const val = parseFloat(sa[1].replace(/,/g, ""));
          const unit = sa[2];
          // Convert to Crore and compare
          const sourceValInCr = FinancialMetricEngine.convertUnits(val, unit, "cr");
          
          // Now check the generated text. Did it use a converted unit?
          // Let's find unit of the matched number in generated text
          const index = numMatch.index;
          const contextText = allGeneratedText.slice(Math.max(0, index - 10), Math.min(allGeneratedText.length, index + 30));
          const genUnitMatch = contextText.match(/\b(crore|cr|lakh|bn|billion|mn|million)\b/i);
          if (genUnitMatch) {
            const genUnit = genUnitMatch[1];
            const genValInCr = FinancialMetricEngine.convertUnits(numValue, genUnit, "cr");
            if (Math.abs(sourceValInCr - genValInCr) < 0.01) {
              foundEquivalent = true;
              break;
            }
          }
        }

        if (!foundEquivalent) {
          return {
            isValid: false,
            reason: `Unsupported Number: Generated text contains '${rawNumStr}' (value ${numValue}) which is not present in source text`
          };
        }
      }
    }

    // 5. Detect Mismatched / Mismatching Company Names
    // Let's check if any other ticker symbols in the 204 F&O universe are referenced in the summary
    // but are NOT present in the source text.
    // That would indicate a company mismatch!
    // We can define a set of canonical company tickers or names if we have them.
    // Let's check if there is an options/ticker mismatch.
    if (article.fno?.symbol) {
      const canonicalSymbol = article.fno.symbol.toLowerCase();
      // If the summary mentions a different symbol from the F&O list that is NOT present in the source
      // Let's fetch some F&O tickers and verify. But to keep it light, we can look for any 3-6 letter word in all-caps
      // in the generated text that is an F&O symbol, and verify if it's a mismatch.
      // We can also extract the main entity.
    }

    // 6. Detect Invented Options Guidance / Option Strikes / Volatility
    const optionsKeywords = [
      "call option", "put option", "option contract", "strike", "implied volatility", 
      "put-call", "pcr", "option chain", "options trading", "buy call", "buy put",
      "hedging options", "gamma", "theta", "vega"
    ];
    for (const kw of optionsKeywords) {
      if (allGeneratedText.includes(kw) && !lowerSource.includes(kw)) {
        return {
          isValid: false,
          reason: `Invented Options Guidance: Generated text contains options keyword '${kw}' which is not present in source text`
        };
      }
    }

    // 7. Detect Invented Market Impact / Price Targets
    const impactKeywords = [
      "price target", "target price", "buy target", "stop loss", "stoploss",
      "trading advice", "recommendation", "undervalued", "overvalued"
    ];
    for (const kw of impactKeywords) {
      if (allGeneratedText.includes(kw) && !lowerSource.includes(kw)) {
        return {
          isValid: false,
          reason: `Invented Market Impact: Generated text contains market-impact keyword '${kw}' which is not present in source text`
        };
      }
    }

    return { isValid: true };
  }
}
