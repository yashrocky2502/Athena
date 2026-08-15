/**
 * ATHENA NEWS ENGINE V3 — UNIVERSAL TYPES & CONTRACTS
 * 
 * Independent type definitions for NewsEngineV3 architecture.
 * Completely detached from legacy NewsEngineV2 types.
 */

export type V3PublisherId = 
  | 'ECONOMIC_TIMES'
  | 'MONEYCONTROL'
  | 'REUTERS'
  | 'LIVEMINT'
  | 'BUSINESS_STANDARD'
  | 'CNBC_TV18'
  | 'NSE'
  | 'BSE'
  | 'COMPANY_FILING'
  | 'SEBI'
  | 'RBI'
  | 'PIB'
  | 'INVESTOR_RELATIONS'
  | 'GOOGLE_NEWS_RSS'
  | 'OTHER_PUBLISHER';

export type V3ArticleCategory =
  | 'QUARTERLY_RESULTS'
  | 'BROKER_REPORTS'
  | 'CORPORATE_ACTIONS'
  | 'IPO'
  | 'M_AND_A'
  | 'FUND_RAISING'
  | 'RBI_POLICY'
  | 'SEBI_ACTION'
  | 'MACROECONOMICS'
  | 'GOVERNMENT_POLICY'
  | 'COMMODITY_MARKETS'
  | 'FOREX'
  | 'CRYPTO'
  | 'GENERAL_MARKETS';

export type V3PipelineStage =
  | 'COLLECTION'
  | 'NORMALIZATION'
  | 'DEDUPLICATION'
  | 'CLASSIFICATION'
  | 'SPECIALIZED_PARSING'
  | 'STRUCTURED_EXTRACTION'
  | 'AI_INTELLIGENCE'
  | 'QUALITY_GATE'
  | 'STORAGE'
  | 'TELEGRAM_PUBLISHING';

export type V3EventPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface V3Publisher {
  id: V3PublisherId;
  name: string;
  baseUrl: string;
  isOfficialExchange: boolean;
  trustScore: number; // 0-100
}

export interface V3RawArticle {
  id: string;
  correlationId?: string;
  publisherId: V3PublisherId;
  sourceUrl: string;
  title: string;
  rawBody: string;
  publishedAt: string; // ISO 8601
  fetchedAt: string; // ISO 8601
  headers?: Record<string, string>;
  rawMetadata?: Record<string, any>;
}

export interface V3NormalizedArticle {
  id: string;
  correlationId?: string;
  rawArticleId: string;
  publisher: V3Publisher;
  cleanTitle: string;
  cleanBody: string;
  summaryLead: string;
  paragraphs: string[];
  wordCount: number;
  characterCount: number;
  publishedAt: string;
  normalizedAt: string;
  canonicalUrl: string;
  language: string;
  contentHash: string;
}

export interface V3Company {
  symbol: string;
  name: string;
  isin?: string;
  sector?: string;
  isFO: boolean;
  marketCapCategory?: 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP' | 'MICRO_CAP';
}

export interface V3Sector {
  code: string;
  name: string;
  subSectors?: string[];
}

export interface V3FinancialMetric {
  metricName: string; // e.g. 'Net Revenue', 'Net Profit (PAT)', 'EBITDA Margin'
  currentValue: string; // e.g. 'Rs 12,450 Cr'
  previousValue?: string; // e.g. 'Rs 10,200 Cr'
  unit?: string; // 'Cr', 'Lakh', '%', 'Bps'
  comparisonPeriod?: 'QoQ' | 'YoY' | 'Sequential' | 'Annual';
  pctChange?: number;
  direction?: 'UP' | 'DOWN' | 'FLAT';
  sourceParagraphIndex?: number;
  sourceSentenceIndex?: number;
}

export interface V3BusinessEvent {
  eventType: string; // e.g. 'Plant Expansion', 'Order Win', 'Regulatory Fine'
  headline: string;
  details: string;
  financialImpactCr?: number;
  expectedCompletionDate?: string;
}

export interface V3ExecutiveQuote {
  speakerName: string;
  speakerTitle: string; // e.g. 'Managing Director', 'CFO'
  quoteText: string;
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  sourceParagraphIndex?: number;
  sourceSentenceIndex?: number;
}

export interface V3BrokerOpinion {
  brokerageHouse: string; // e.g. 'Goldman Sachs', 'Jefferies', 'Motilal Oswal'
  rating: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'SELL';
  previousRating?: string;
  targetPrice: number;
  previousTargetPrice?: number;
  impliedUpsidePct?: number;
  rationale: string;
}

export interface V3StructuredData {
  category: V3ArticleCategory;
  primaryCompany?: V3Company;
  mentionedCompanies: V3Company[];
  sectors: V3Sector[];
  financialMetrics: V3FinancialMetric[];
  businessEvents: V3BusinessEvent[];
  executiveQuotes: V3ExecutiveQuote[];
  brokerOpinions: V3BrokerOpinion[];
  extractedAt: string;
  parserVersion: string;
}

export interface V3MarketImpact {
  score: number; // -100 to +100
  sentiment: 'STRONG_BULLISH' | 'MODERATE_BULLISH' | 'NEUTRAL' | 'MODERATE_BEARISH' | 'STRONG_BEARISH';
  shortTermCatalysts: string[];
  keyRisks: string[];
  bullDrivers: string[];
  bearDrivers: string[];
}

export interface V3OptionsSellerView {
  impliedVolatilityImpact: 'HIGH_VOLATILITY_EXPANSION' | 'VOLATILITY_CRUSH' | 'STABLE_NEUTRAL';
  keyLevelsToWatch: {
    support: string[];
    resistance: string[];
  };
  recommendedStrategyBias: 'DELTA_NEUTRAL' | 'LONG_STRADDLE' | 'SHORT_STRANGLE' | 'DIRECTIONAL_SPREAD';
  notes: string;
}

export interface V3AIIntelligence {
  institutionalSummary: string;
  marketImpact: V3MarketImpact;
  affectedCompanies: V3Company[];
  affectedSectors: V3Sector[];
  optionsSellerView: V3OptionsSellerView;
  confidenceScore: number; // 0-100
  generatedAt: string;
  modelIdentifier: string;
}

export interface V3QualityGateResult {
  passed: boolean;
  score: number; // 0-100
  reasons: string[];
  checksPerformed: {
    hasRequiredMetrics: boolean;
    noCopiedParagraphs: boolean;
    noPlaceholderValues: boolean;
    correctClassification: boolean;
    validSources: boolean;
  };
  evaluatedAt: string;
}

export interface V3StoryCluster {
  clusterId: string;
  headline: string;
  primaryArticleId: string;
  associatedArticleIds: string[];
  publishersCount: number;
  verificationScore: number; // 0-100
  firstSeenAt: string;
  lastUpdatedAt: string;
}

export interface V3Story {
  storyId: string;
  correlationId?: string;
  clusterId: string;
  headline: string;
  category: V3ArticleCategory;
  publisher: V3Publisher;
  primaryArticle: V3NormalizedArticle;
  structuredData: V3StructuredData;
  intelligence?: V3AIIntelligence;
  qualityGate: V3QualityGateResult;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface V3ProcessingContext {
  correlationId: string;
  requestId: string;
  startTimeMs: number;
  stage: V3PipelineStage;
  logs: string[];
  metadata: Record<string, any>;
}

export interface V3PipelineEvent {
  eventId: string;
  type: 
    | 'ARTICLE_RECEIVED'
    | 'ARTICLE_QUEUED'
    | 'ARTICLE_NORMALIZED'
    | 'ARTICLE_CLASSIFIED'
    | 'METRICS_EXTRACTED'
    | 'QUALITY_GATE_PASSED'
    | 'QUALITY_GATE_FAILED'
    | 'STORY_PUBLISHED'
    | 'TELEGRAM_SENT'
    | 'COLLECTOR_FAILED'
    | 'SYSTEM_HEALTH_CHECK'
    | 'CLUSTER_CREATED'
    | 'STORY_UPDATED'
    | 'NEW_SOURCE_VERIFIED'
    | 'DUPLICATE_DETECTED'
    | 'MERGE_FAILED'
    | 'CLASSIFICATION_FAILED'
    | 'ROUTING_SUCCESSFUL'
    | 'FNO_SIGNAL_GENERATED';
  priority: V3EventPriority;
  timestamp: string;
  correlationId: string;
  payload: Record<string, any>;
}
