import { NormalizedMetric, FinancialMetricNormalizer, SUPPORTED_METRICS } from './FinancialMetricNormalizer';

export class FinancialFactExtractor {
  /**
   * Scans a text body to extract supported financial metrics.
   */
  public static extract(text: string): NormalizedMetric[] {
    if (!text) return [];

    const metrics: NormalizedMetric[] = [];
    const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);

    // Track seen metric names to prevent duplication
    const seenMetrics = new Set<string>();

    for (const sentence of sentences) {
      for (const metricName of SUPPORTED_METRICS) {
        if (seenMetrics.has(metricName)) continue;

        // Check if the sentence mentions this metric
        const metricRegex = new RegExp(`\\b${metricName.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (metricRegex.test(sentence)) {
          // Attempt to extract value, change, comparison, direction, period
          const extracted = this.extractFromSentence(sentence, metricName);
          if (extracted) {
            metrics.push(extracted);
            seenMetrics.add(metricName);
          }
        }
      }
    }

    return metrics;
  }

  private static extractFromSentence(sentence: string, metricName: string): NormalizedMetric | null {
    const lower = sentence.toLowerCase();

    // 1. Extract Value (e.g. ₹8,600 crore, 31.6%, ₹1,054 crore)
    // Matches: ₹8,600, ₹ 8600, Rs. 1054, 31.6%, 12.5 percent, etc.
    const valueRegex = /(?:₹|Rs\.?|Rupees|\$)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|billions?|millions?|bn|mn)?\b|([\d,]+(?:\.\d+)?)\s*(?:%|percent)\b|stretching to\s*(?:₹|Rs\.?|Rupees)\s*([\d,]+(?:\.\d+)?)/gi;
    let valueMatch = valueRegex.exec(sentence);
    let rawValue = "";
    let rawUnit = "";

    if (valueMatch) {
      if (valueMatch[1]) {
        rawValue = valueMatch[1];
        rawUnit = valueMatch[2] || "crore";
      } else if (valueMatch[3]) {
        rawValue = valueMatch[3];
        rawUnit = "%";
      }
    } else {
      // Secondary fallback value finder (simple number after words like "of", "to", "at", "stands at")
      const numRegex = /\b(?:at|to|of|stands at|reaches|totaling|totalled)\s*(?:₹|Rs\.?|Rupees)?\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|billions?|millions?|bn|mn|%|percent)?/i;
      const numMatch = numRegex.exec(sentence);
      if (numMatch) {
        rawValue = numMatch[1];
        rawUnit = numMatch[2] || "";
      }
    }

    if (!rawValue) return null;

    // 2. Extract Change (e.g. up 25%, rose 8%, fell 10%)
    const changeRegex = /\b(?:up|down|rose|fell|increased|decreased|growth|jumped|declined|slid|surged|of)\s*([\+-]?\d+(?:\.\d+)?\s*(?:%|percent))\b|\b([\+-]?\d+(?:\.\d+)?\s*(?:%|percent))\b/i;
    const changeMatch = changeRegex.exec(sentence);
    let change = "";
    if (changeMatch) {
      change = changeMatch[1] || changeMatch[2] || "";
    }

    // 3. Extract Comparison (YoY, QoQ, HoH, etc.)
    const compRegex = /\b(YoY|QoQ|HoH|MoM|year-on-year|quarter-on-quarter)\b/i;
    const compMatch = compRegex.exec(sentence);
    const comparison = compMatch ? compMatch[1] : "YoY";

    // 4. Extract Direction
    let direction: 'UP' | 'DOWN' | 'FLAT' | 'NONE' = 'NONE';
    if (/\b(up|rose|increased|grew|jumped|surged|improving|expanding)\b/i.test(lower)) {
      direction = 'UP';
    } else if (/\b(down|fell|decreased|declined|dropped|slid|shrinking|contracting)\b/i.test(lower)) {
      direction = 'DOWN';
    } else if (/\b(flat|stable|unchanged)\b/i.test(lower)) {
      direction = 'FLAT';
    }

    // 5. Extract Period (Q1FY27, FY26, Q3 FY26, etc.)
    const periodRegex = /\b(Q[1-4]\s*FY\s*\d{2}|FY\s*\d{2}|Q[1-4])\b/i;
    const periodMatch = periodRegex.exec(sentence);
    const period = periodMatch ? periodMatch[1] : "Q1FY27";

    return FinancialMetricNormalizer.normalize({
      name: metricName,
      value: rawValue,
      unit: rawUnit,
      period,
      comparison,
      change,
      direction
    });
  }
}
