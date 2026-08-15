import { SemanticFactExtractor } from "../intelligence/SemanticFactExtractor.ts";
import { FinancialMetricRecord } from "./IntelligenceTypes.ts";

export interface ResolvedMetrics {
  metrics: FinancialMetricRecord[];
  metricConsistencyStatus: "CONSISTENT" | "CONTRADICTORY" | "INSUFFICIENT_DATA";
  pat?: FinancialMetricRecord | null;
  revenue?: FinancialMetricRecord | null;
  ebitda?: FinancialMetricRecord | null;
  eps?: FinancialMetricRecord | null;
  nii?: FinancialMetricRecord | null;
  debt?: FinancialMetricRecord | null;
  margin?: FinancialMetricRecord | null;
  orderBook?: FinancialMetricRecord | null;
}

export class IntelligenceMetricResolver {
  public static resolve(headline: string, body: string, existingMetrics?: any[]): ResolvedMetrics {
    const h = (headline || "").trim();
    const b = (body || "").trim();
    const separator = h && !/[.?!]$/.test(h) ? ". " : " ";
    const text = `${h}${separator}${b}`.trim();
    const lowerHeadline = h.toLowerCase();
    
    // Deterministically extract semantically grounded financial facts
    const facts = SemanticFactExtractor.extractFacts(text);

    const metricRecords: FinancialMetricRecord[] = [];
    let pat: FinancialMetricRecord | null = null;
    let revenue: FinancialMetricRecord | null = null;
    let ebitda: FinancialMetricRecord | null = null;
    let eps: FinancialMetricRecord | null = null;
    let nii: FinancialMetricRecord | null = null;
    let debt: FinancialMetricRecord | null = null;
    let margin: FinancialMetricRecord | null = null;
    let orderBook: FinancialMetricRecord | null = null;

    let isContradictory = false;

    for (const f of facts) {
      let direction = f.direction;
      let changePercent = f.changePercent;

      // 1. Verify direction strictly against current & previous numeric values if both exist
      if (f.currentValue !== null && f.previousValue !== null) {
        if (f.currentValue > f.previousValue) {
          direction = "UP";
          if (changePercent === null && f.previousValue !== 0) {
            changePercent = Math.round(((f.currentValue - f.previousValue) / Math.abs(f.previousValue)) * 100 * 10) / 10;
          }
        } else if (f.currentValue < f.previousValue) {
          direction = "DOWN";
          if (changePercent === null && f.previousValue !== 0) {
            changePercent = Math.round(((f.currentValue - f.previousValue) / Math.abs(f.previousValue)) * 100 * 10) / 10;
          }
        } else {
          direction = "FLAT";
        }

        // Check if headline claimed opposite direction
        const headlineClaimedUp = /\b(rises?|rose|jumps?|jumped|surges?|surged|soars?|soared|up|rallies|rally|gains?|gained)\b/i.test(lowerHeadline);
        const headlineClaimedDown = /\b(falls?|fell|drops?|dropped|plunges?|plunged|slips?|slipped|down|declines?|declined|slumps?|slumped|loss)\b/i.test(lowerHeadline);

        if ((direction === "DOWN" && headlineClaimedUp) || (direction === "UP" && headlineClaimedDown)) {
          isContradictory = true;
        }
      }

      const rec: FinancialMetricRecord = {
        name: f.metricName,
        currentValue: f.currentValue,
        previousValue: f.previousValue,
        change: f.change,
        changePercent,
        changeType: f.changeType,
        direction,
        unit: f.unit || "Cr",
        period: f.period,
        comparatorPeriod: f.comparatorPeriod,
        sourceSentence: f.sourceSentence,
        displayText: f.displayText,
      };

      metricRecords.push(rec);

      if (f.metricName === "PAT" && !pat) pat = rec;
      else if (f.metricName === "Revenue" && !revenue) revenue = rec;
      else if (f.metricName === "EBITDA" && !ebitda) ebitda = rec;
      else if (f.metricName === "EPS" && !eps) eps = rec;
      else if (f.metricName === "NII" && !nii) nii = rec;
      else if (f.metricName === "Debt" && !debt) debt = rec;
      else if ((f.metricName === "EBITDA Margin" || f.metricName === "Margin") && !margin) margin = rec;
      else if (f.metricName === "Order Book" && !orderBook) orderBook = rec;
    }

    let metricConsistencyStatus: "CONSISTENT" | "CONTRADICTORY" | "INSUFFICIENT_DATA" = "INSUFFICIENT_DATA";
    if (metricRecords.length > 0) {
      metricConsistencyStatus = isContradictory ? "CONTRADICTORY" : "CONSISTENT";
    }

    return {
      metrics: metricRecords,
      metricConsistencyStatus,
      pat,
      revenue,
      ebitda,
      eps,
      nii,
      debt,
      margin,
      orderBook,
    };
  }
}
