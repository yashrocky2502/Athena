export type EntityType =
  | "EQUITY"
  | "BROAD_MARKET"
  | "MACRO"
  | "COMMODITY"
  | "SECTOR"
  | "POLICY"
  | "UNRESOLVED";

export type EntityConfidence = "HIGH" | "MEDIUM" | "NONE";
export type SentimentType = "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
export type UrgencyType = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type MetricDirection = "UP" | "DOWN" | "FLAT" | "NEUTRAL";

export interface FinancialMetricRecord {
  name:
    | "PAT"
    | "Revenue"
    | "Total Income"
    | "EBITDA"
    | "EBITDA Margin"
    | "EPS"
    | "NII"
    | "Debt"
    | "Margin"
    | "Order Book"
    | "Sales Volume"
    | "Credit Rating"
    | "IPO";
  currentValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  changeType?: "YoY" | "QoQ" | "Sequential" | "Annual" | "None";
  direction: MetricDirection;
  unit: string;
  period?: string;
  comparatorPeriod?: string;
  sourceSentence?: string;
  displayText: string;
}

export interface IntelligenceRecord {
  // identity
  articleId: string;
  canonicalUrl: string;
  headline: string;
  source: string;
  publishedAt: string;

  // entity
  companyName: string;
  symbol: string | null;
  entityType: EntityType;
  entityConfidence: EntityConfidence;
  fnoEligible: boolean;
  fnoConfidence: EntityConfidence;

  // classification
  category: string;
  eventType: string;
  sentiment: SentimentType;
  materialityScore: number;
  relevanceScore: number;
  urgency: UrgencyType;

  // financial
  metricConsistencyStatus?: "CONSISTENT" | "CONTRADICTORY" | "INSUFFICIENT_DATA";
  financialMetrics: FinancialMetricRecord[];
  pat?: FinancialMetricRecord | null;
  revenue?: FinancialMetricRecord | null;
  ebitda?: FinancialMetricRecord | null;
  eps?: FinancialMetricRecord | null;
  nii?: FinancialMetricRecord | null;
  debt?: FinancialMetricRecord | null;
  margin?: FinancialMetricRecord | null;
  orderBook?: FinancialMetricRecord | null;

  // summary
  executiveSummary: string;
  keyFacts: string[];
  whyItMatters: string;
  marketImpact: string;
  risk: string[];
  optionsSellerImpact: string;

  // traceability
  sourceEvidence: string[];
  evidenceSpans: string[];
  intelligenceVersion: string;
  generatedAt: string;
}

export interface IntelligenceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
