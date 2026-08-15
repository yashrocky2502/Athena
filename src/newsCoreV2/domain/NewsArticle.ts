import { NewsSource } from "./NewsSource.ts";
import { NewsCategoryV2, SentimentV2 } from "./NewsClassification.ts";
import { FNOClassificationResult } from "./FNOClassification.ts";

export interface NewsArticleV2 {
  id: string;
  canonicalUrl: string;
  headline: string;
  body: string;
  source: NewsSource;
  publishedAt: string;
  collectedAt: string;
  category: NewsCategoryV2;
  sentiment: SentimentV2;
  relevanceScore: number;
  fno: FNOClassificationResult;
  // Phase 25: Source-Grounded News Summary fields
  summary?: string;
  whatChanged?: string[];
  keyMetrics?: any[];
  whyItMatters?: string;
  marketImpact?: string;
  riskWatchpoints?: string[];
  summaryConfidence?: number;
  summaryProcessingMode?: "DETERMINISTIC" | "AI_GROUNDED" | "DETERMINISTIC_FALLBACK";
  sourceGrounded?: boolean;
  // Phase 23.4: Canonical Category Resolution & Event Fields
  primaryCategory?: string;
  secondaryCategories?: string[];
  eventType?: string;
  categoryConfidence?: "HIGH" | "MEDIUM" | "LOW";
  classificationEvidence?: string[];
}
