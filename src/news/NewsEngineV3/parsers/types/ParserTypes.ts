/**
 * ATHENA NEWS ENGINE V3 — PARSER TYPES
 *
 * Type definitions for Phase 6 Institutional Grade Financial Parsers.
 * Purely deterministic, structured extraction without AI/LLM hallucinations.
 */

export interface MetricTraceability {
  paragraphIndex: number;
  sentenceIndex: number;
  sourceSentence: string;
  characterOffset: number;
}

export interface ExtractedMetric {
  metricName: string;
  value: number | string | null;
  unit: string;
  currency: string;
  YoY: number | null;
  QoQ: number | null;
  previousValue: number | null;
  confidence: number; // 0 - 100
  reason?: string;
  sourceSentence: string;
  paragraphIndex: number;
  sentenceIndex: number;
  characterOffset: number;
}

export interface ExtractedEntity {
  name: string;
  type:
    | 'COMPANY'
    | 'PERSON'
    | 'REGULATORY_BODY'
    | 'BROKER'
    | 'CLIENT'
    | 'GEOGRAPHY'
    | 'EXCHANGE'
    | 'COMMODITY'
    | 'CURRENCY';
  confidence: number;
  sourceSentence: string;
}

export interface ExtractedQuote {
  speaker: string;
  designation?: string;
  quoteText: string;
  paragraphIndex: number;
  sentenceIndex: number;
}

export interface BusinessEvent {
  eventType: string;
  description: string;
  effectiveDate?: string;
  financialImpact?: string;
  sourceSentence: string;
}

export interface ExtractedDate {
  label: string;
  date: string; // ISO date string or normalized date
  sourceSentence: string;
}

export interface ExtractionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StructuredExtraction {
  articleId: string;
  parserType: string;
  company?: string;
  ticker?: string;
  category: string;
  metrics: ExtractedMetric[];
  entities: ExtractedEntity[];
  quotes: ExtractedQuote[];
  businessEvents: BusinessEvent[];
  dates: ExtractedDate[];
  currencies: string[];
  summaryFacts: string[];
  confidence: number; // 0 - 100
  processingTimeMs: number;
  traceability: MetricTraceability[];
  validation: ExtractionValidation;
  specificFields?: Record<string, any>;
}

// Category-Specific Structured Schema Definitions

export interface QuarterlyResultsData {
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  financialYear?: string; // e.g. FY24, FY25
  revenue?: number | null;
  pat?: number | null;
  ebitda?: number | null;
  ebitdaMargin?: number | null;
  netMargin?: number | null;
  eps?: number | null;
  segmentPerformance?: Array<{ segmentName: string; revenue?: number | null; margin?: number | null }>;
  guidance?: string | null;
  capexPlan?: number | null;
  operationalMetrics?: Record<string, any>;
  managementCommentary?: string[];
  futureOutlook?: string | null;
}

export interface BrokerReportData {
  brokerName?: string | null;
  targetPrice?: number | null;
  previousTargetPrice?: number | null;
  rating?: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'SELL' | 'NEUTRAL' | 'OUTPERFORM' | null;
  action?: 'UPGRADE' | 'DOWNGRADE' | 'INITIATION' | 'REITERATE' | 'MAINTAIN' | null;
  valuationMethod?: string | null;
  keyPositives?: string[];
  keyRisks?: string[];
  catalysts?: string[];
  upsidePercent?: number | null;
  downsidePercent?: number | null;
}

export interface DividendData {
  dividendAmountPerShare?: number | null;
  dividendYieldPercent?: number | null;
  type?: 'INTERIM' | 'FINAL' | 'SPECIAL' | 'DEFAULT' | null;
  recordDate?: string | null;
  exDate?: string | null;
  paymentDate?: string | null;
}

export interface BuybackData {
  offerPrice?: number | null;
  buybackSizeCrores?: number | null;
  mechanism?: 'TENDER_OFFER' | 'OPEN_MARKET' | null;
  recordDate?: string | null;
  totalSharesCount?: number | null;
}

export interface BonusSplitData {
  type?: 'BONUS' | 'SPLIT' | 'BONUS_AND_SPLIT' | null;
  bonusRatio?: string | null; // e.g. "1:1"
  splitRatio?: string | null; // e.g. "1:10" or "Rs 10 to Rs 1"
  recordDate?: string | null;
  exDate?: string | null;
}

export interface ManagementChangeData {
  executiveName?: string | null;
  designation?: string | null;
  action?: 'APPOINTED' | 'RESIGNED' | 'RETIRED' | 'ELEVATED' | 'REPLACED' | null;
  effectiveDate?: string | null;
  reason?: string | null;
}

export interface OrderWinData {
  clientName?: string | null;
  contractValueCrores?: number | null;
  currency?: string | null;
  durationMonthsYears?: string | null;
  geography?: string | null;
  segment?: string | null;
  executionTimeline?: string | null;
  marginImpact?: string | null;
}

export interface MergersAcquisitionData {
  buyerName?: string | null;
  sellerName?: string | null;
  targetCompany?: string | null;
  stakePercent?: number | null;
  dealValueCrores?: number | null;
  fundingSource?: string | null;
  approvalStatus?: string | null;
  expectedClosingDate?: string | null;
  synergiesDescription?: string | null;
}

export interface IPOData {
  issueSizeCrores?: number | null;
  freshIssueCrores?: number | null;
  ofsCrores?: number | null;
  priceBandMin?: number | null;
  priceBandMax?: number | null;
  lotSize?: number | null;
  subscriptionTimes?: number | null;
  anchorInvestors?: string[];
  listingDate?: string | null;
  gmpAmount?: number | null;
  registrar?: string | null;
  leadManagers?: string[];
}

export interface BlockDealData {
  buyer?: string | null;
  seller?: string | null;
  quantity?: number | null;
  averagePrice?: number | null;
  dealValueCrores?: number | null;
  exchange?: 'NSE' | 'BSE' | 'BOTH' | null;
}

export interface BulkDealData extends BlockDealData {}

export interface FundRaiseData {
  mode?: 'QIP' | 'RIGHTS_ISSUE' | 'DEBT' | 'PREFERENTIAL_ISSUE' | 'BONUS' | null;
  amountCrores?: number | null;
  floorPrice?: number | null;
  issuePrice?: number | null;
  investorDetails?: string | null;
}

export interface RBIParserData {
  repoRatePercent?: number | null;
  reverseRepoRatePercent?: number | null;
  sdfPercent?: number | null;
  msfPercent?: number | null;
  crrPercent?: number | null;
  slrPercent?: number | null;
  gdpForecastPercent?: number | null;
  inflationForecastPercent?: number | null;
  policyStance?: 'ACCOMMODATIVE' | 'NEUTRAL' | 'HAWKISH' | 'WITHDRAWAL_OF_ACCOMMODATION' | null;
  liquidityMeasures?: string[];
}

export interface SEBIParserData {
  documentType?: 'CIRCULAR' | 'PENALTY' | 'RESTRICTION' | 'SETTLEMENT' | 'CONSULTATION' | 'FRAMEWORK' | 'COMPLIANCE' | null;
  affectedEntities?: string[];
  complianceRequirement?: string | null;
  penaltyAmountLakhs?: number | null;
}

export interface MacroData {
  gdpGrowthPercent?: number | null;
  cpiInflationPercent?: number | null;
  wpiInflationPercent?: number | null;
  pmiValue?: number | null;
  tradeDeficitBillionUSD?: number | null;
  fiscalDeficitPercent?: number | null;
  iipGrowthPercent?: number | null;
  gstCollectionCrores?: number | null;
  unemploymentPercent?: number | null;
  autoSalesUnits?: number | null;
}

export interface CommodityData {
  commodityName?: string | null;
  price?: number | null;
  priceChangePercent?: number | null;
  movementDirection?: 'UP' | 'DOWN' | 'FLAT' | null;
  drivers?: string[];
  inventoryStatus?: string | null;
}

export interface ForexData {
  pair?: string | null;
  rate?: number | null;
  changePercent?: number | null;
  dollarIndex?: number | null;
  tenYearYieldPercent?: number | null;
  drivers?: string[];
}
