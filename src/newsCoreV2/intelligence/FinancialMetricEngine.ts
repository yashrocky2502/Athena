import { SemanticFactExtractor } from "./SemanticFactExtractor.ts";

export interface NormalizedFinancialMetric {
  metricName: "PAT" | "Revenue" | "EBITDA" | "EBITDA Margin" | "EPS" | "Debt" | "Order Book" | "Market Share" | "NII" | "Sales Volume" | "Credit Rating" | "IPO" | "Total Income";
  currentValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  direction: "UP" | "DOWN" | "FLAT" | "NEUTRAL";
  unit: string; // e.g. "Cr", "%", "Rs", "USD", "Mn"
  sourceSentence: string;
  displayText: string;
}

const METRIC_PATTERNS: Array<{
  name: NormalizedFinancialMetric["metricName"];
  regex: RegExp;
}> = [
  { name: "PAT", regex: /\b(net profit|pat|profit after tax|pure profit|net loss)\b/i },
  { name: "Revenue", regex: /\b(revenue|total revenue|topline|turnover|sales)\b/i },
  { name: "EBITDA Margin", regex: /\b(ebitda margin|operating margin)\b/i },
  { name: "EBITDA", regex: /\b(ebitda|operating profit)\b/i },
  { name: "EPS", regex: /\b(eps|diluted eps|earnings per share)\b/i },
  { name: "NII", regex: /\b(net interest income|nii)\b/i },
  { name: "Debt", regex: /\b(total debt|net debt|borrowings|debt level)\b/i },
  { name: "Order Book", regex: /\b(order book|order intake|order inflow)\b/i },
  { name: "Market Share", regex: /\b(market share)\b/i }
];

const DIRECTION_UP_REGEX = /\b(rises|rose|rises by|surges|surged|jumps|jumped|grew|grows|growth|up|increased|increase|climbs|climbed|soars|soared|gains|gained|turnaround|turns profit|swings to profit|net profit of)\b/i;
const DIRECTION_DOWN_REGEX = /\b(falls|fell|drops|dropped|slumps|slumped|declines|declined|down|decreased|decrease|plunges|plunged|sinks|sank|slips|slipped|cuts|cut|swings to loss|swings to net loss|net loss of)\b/i;
const DIRECTION_FLAT_REGEX = /\b(flat|unchanged|steady|stagnant)\b/i;

export class FinancialMetricEngine {
  /**
   * Converts monetary units between Crore and Million / Lakh.
   */
  public static convertUnits(value: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    // Standardize to Crore first
    let valueInCr = value;
    if (from === "mn" || from === "million") {
      valueInCr = value / 10; // 10 Million = 1 Crore
    } else if (from === "bn" || from === "billion") {
      valueInCr = value * 100; // 1 Billion = 100 Crore
    } else if (from === "lakh" || from === "lakhs") {
      valueInCr = value / 100; // 100 Lakh = 1 Crore
    }

    if (to === "mn" || to === "million") {
      return valueInCr * 10;
    } else if (to === "bn" || to === "billion") {
      return valueInCr / 100;
    } else if (to === "lakh" || to === "lakhs") {
      return valueInCr * 100;
    }
    return valueInCr; // Default in Crore
  }

  /**
   * Deterministically extracts financial metrics and their directions from article text.
   */
  public static extractMetrics(text: string): NormalizedFinancialMetric[] {
    if (!text) return [];

    const facts = SemanticFactExtractor.extractFacts(text);
    return facts.map(f => ({
      metricName: f.metricName as any,
      currentValue: f.currentValue,
      previousValue: f.previousValue,
      change: f.change,
      changePercent: f.changePercent,
      direction: f.direction as any,
      unit: f.unit || "Cr",
      sourceSentence: f.sourceSentence,
      displayText: f.displayText,
    }));
  }

  private static parseSentenceForMetric(
    metricName: NormalizedFinancialMetric["metricName"],
    sentence: string
  ): NormalizedFinancialMetric | null {
    // Look for percentage changes (e.g., "rises 15%", "down 8.5%", "up 51% YoY")
    const pctMatch = sentence.match(/(?:(?:up|down|rises?|falls?|grew|jumps?|declines?)\s+)?(\d+(?:\.\d+)?)\s*%/i);
    const changePercent = pctMatch ? parseFloat(pctMatch[1]) : null;

    // Look for rupee / monetary amounts (explicit Rs/₹ or followed by crore/cr/lakh/bn/mn)
    // Avoid matching isolated 'Q1', 'Q2', or bare numbers without monetary context
    const monetaryMatches = Array.from(
      sentence.matchAll(/(?:(?:Rs\.?|₹|INR)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore|cr|lakh|bn|billion|mn|million)?)|(?:(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore|cr|lakh|bn|billion|mn|million))/gi)
    );

    let currentValue: number | null = null;
    let previousValue: number | null = null;
    let unit = "Cr";

    if (monetaryMatches.length > 0) {
      // First monetary match
      const m1 = monetaryMatches[0];
      const numStr1 = m1[1] || m1[3];
      const unitStr1 = m1[2] || m1[4];
      if (numStr1) {
        currentValue = parseFloat(numStr1.replace(/,/g, ""));
      }
      if (unitStr1) {
        unit = unitStr1.toUpperCase();
        if (unit === "CRORE") unit = "Cr";
      }

      if (monetaryMatches.length > 1) {
        const m2 = monetaryMatches[1];
        const numStr2 = m2[1] || m2[3];
        if (numStr2) {
          previousValue = parseFloat(numStr2.replace(/,/g, ""));
        }
      }
    }

    if (currentValue === null && changePercent === null) {
      return null;
    }

    // Direction calculation
    let direction: NormalizedFinancialMetric["direction"] = "NEUTRAL";

    const lowerSentence = sentence.toLowerCase();
    const isNetLoss = lowerSentence.includes("net loss") || lowerSentence.includes("swings to loss") || lowerSentence.includes("swings to net loss") || lowerSentence.includes("recorded a loss") || lowerSentence.includes("reported a loss") || lowerSentence.includes("loss of") || lowerSentence.includes("incurred a loss");
    const isTurnaround = lowerSentence.includes("swings to profit") || lowerSentence.includes("turns profit") || lowerSentence.includes("turnaround");

    if (isTurnaround) {
      direction = "UP";
    } else if (isNetLoss) {
      direction = "DOWN";
      if (currentValue !== null && currentValue > 0) {
        currentValue = -currentValue; // Store negative PAT for loss
      }
    } else if (DIRECTION_UP_REGEX.test(sentence)) {
      direction = "UP";
    } else if (DIRECTION_DOWN_REGEX.test(sentence)) {
      direction = "DOWN";
    } else if (DIRECTION_FLAT_REGEX.test(sentence)) {
      direction = "FLAT";
    }

    let absoluteChange: number | null = null;
    if (currentValue !== null && previousValue !== null) {
      absoluteChange = currentValue - previousValue;
    }

    // Standard display text construction
    let displayText = "";
    if (currentValue !== null) {
      const formattedVal = Math.abs(currentValue).toLocaleString("en-IN");
      displayText = `₹${formattedVal} ${unit}`;
      if (isNetLoss && currentValue < 0) {
        displayText = `Net Loss of ₹${formattedVal} ${unit}`;
      }
    } else if (changePercent !== null) {
      displayText = `${changePercent}%`;
    }

    return {
      metricName,
      currentValue,
      previousValue,
      change: absoluteChange,
      changePercent,
      direction,
      unit,
      sourceSentence: sentence.trim(),
      displayText,
    };
  }
}
