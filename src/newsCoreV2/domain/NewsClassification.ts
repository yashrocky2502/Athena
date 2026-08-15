export type NewsCategoryV2 =
  | "F&O"
  | "Crypto"
  | "Commodities"
  | "IPO"
  | "Results"
  | "Market"
  | "Corporate"
  | "Economy"
  | "Global"
  | "Technology"
  | "Exchange"
  | "Other"
  | "MARKET"
  | "COMMODITY"
  | "M&A"
  | "POLICY"
  | "MACRO"
  | "GENERAL"
  | "RESULTS"
  | "CORPORATE"
  | (string & {});

export type SentimentV2 = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface NewsClassificationResult {
  category: NewsCategoryV2;
  sentiment: SentimentV2;
  relevanceScore: number;
  primaryCategory?: string;
  secondaryCategories?: string[];
  eventType?: string;
  categoryConfidence?: "HIGH" | "MEDIUM" | "LOW";
  classificationEvidence?: string[];
}
