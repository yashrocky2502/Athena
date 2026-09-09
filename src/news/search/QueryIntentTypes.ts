/**
 * ATHENA — Phase 21: Contextual Intelligence & Query Routing Types
 * QueryIntentTypes.ts
 */

export enum QueryIntent {
  MARKET_CAUSE_ANALYSIS = 'MARKET_CAUSE_ANALYSIS',
  INDEX_CAUSE_ANALYSIS = 'INDEX_CAUSE_ANALYSIS',
  STOCK_CAUSE_ANALYSIS = 'STOCK_CAUSE_ANALYSIS',
  SECTOR_CAUSE_ANALYSIS = 'SECTOR_CAUSE_ANALYSIS',
  MARKET_STATUS = 'MARKET_STATUS',
  STOCK_LOOKUP = 'STOCK_LOOKUP',
  COMPANY_ANALYSIS = 'COMPANY_ANALYSIS',
  SECTOR_ANALYSIS = 'SECTOR_ANALYSIS',
  NEWS_SEARCH = 'NEWS_SEARCH',
  NEWS_ANALYSIS = 'NEWS_ANALYSIS',
  MACRO_ANALYSIS = 'MACRO_ANALYSIS',
  CALENDAR_LOOKUP = 'CALENDAR_LOOKUP',
  PORTFOLIO_ANALYSIS = 'PORTFOLIO_ANALYSIS',
  TECHNICAL_ANALYSIS = 'TECHNICAL_ANALYSIS',
  DAILY_DIGEST = 'DAILY_DIGEST',
  HISTORICAL_DIGEST = 'HISTORICAL_DIGEST',
  INTRADAY_CHANGE_ANALYSIS = 'INTRADAY_CHANGE_ANALYSIS',
  COMPARISON = 'COMPARISON',
  GENERAL_FINANCE = 'GENERAL_FINANCE'
}

export type TemporalPeriod = 
  | 'TODAY'
  | 'CURRENT_SESSION'
  | 'YESTERDAY'
  | 'PREVIOUS_TRADING_DAY'
  | 'THIS_MORNING'
  | 'SINCE_MORNING'
  | 'AFTERNOON'
  | 'EVENING'
  | 'TOMORROW'
  | 'OVERNIGHT'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'HISTORICAL_DATE';

export interface TemporalReference {
  period: TemporalPeriod;
  reference: string;
  targetDate?: string; // YYYY-MM-DD
  rawQueryTimeSnippet?: string;
}

export type MarketScope = 
  | 'INDIAN_MARKET'
  | 'GLOBAL_MARKET'
  | 'INDEX_SPECIFIC'
  | 'SECTOR_SPECIFIC'
  | 'STOCK_SPECIFIC'
  | 'MACRO_COMMODITIES'
  | 'PORTFOLIO_INTERNAL'
  | 'GENERAL';

export type EvidenceDataType =
  | 'MARKET_TICK'
  | 'NEWS_CATALYST'
  | 'MACRO_INDICATOR'
  | 'SECTOR_RETURN'
  | 'DERIVATIVES_FLOW'
  | 'CORPORATE_ACTION'
  | 'TECHNICAL_LEVEL'
  | 'INSTITUTIONAL_FLOW';

export type EvidenceRelationship =
  | 'PRIMARY_DRIVER'
  | 'SECONDARY_DRIVER'
  | 'OFFSETTING_FACTOR'
  | 'CONTRADICTION'
  | 'CORROBORATING_SIGNAL';

export interface EvidenceItem {
  id: string;
  source: string;
  timestamp: string;
  dataType: EvidenceDataType;
  relevantEntity: string;
  observedValue: string | number;
  significance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number; // 0 - 100
  relationshipToConclusion: EvidenceRelationship;
  explanation: string;
}

export type StockAttributionType =
  | 'IDIOSYNCRATIC'
  | 'SECTOR_DRIVEN'
  | 'MARKET_DRIVEN'
  | 'MACRO_DRIVEN'
  | 'MIXED'
  | 'UNKNOWN';

export interface StructuredContextualAnswer {
  headline: string;
  primaryCause: string;
  attributionType?: StockAttributionType;
  facts: string[];
  marketReactions: string[];
  athenaInterpretation: string;
  risksAndContradictions: string[];
  watchlist: string[];
  confidenceScore: number; // 0 - 100
  confidenceFormulaRationale: string;
}

export interface RelatedIntelligenceLinks {
  stocks: { symbol: string; name: string; changePct: number }[];
  sectors: { name: string; changePct: number; sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' }[];
  newsQueries: string[];
  macroFactors: { name: string; value: string; impact: string }[];
  events: string[];
}

export type QueryUIDestination =
  | 'MARKET_DIAGNOSIS'
  | 'STOCK_DIAGNOSIS'
  | 'SECTOR_DIAGNOSIS'
  | 'COMPANY_PROFILE'
  | 'DIGEST_WORKSPACE'
  | 'NEWS_INTELLIGENCE'
  | 'CALENDAR_INTELLIGENCE'
  | 'MARKET_DASHBOARD'
  | 'PORTFOLIO_INTELLIGENCE';

export interface AthenaQueryResult {
  query: string;
  intent: QueryIntent;
  confidence: number; // 0 - 100
  temporal: TemporalReference;
  marketScope: MarketScope;
  entities: {
    symbol?: string;
    officialName?: string;
    sector?: string;
    indexName?: string;
    secondarySymbol?: string;
  };
  destination: QueryUIDestination;
  answer: StructuredContextualAnswer;
  evidence: EvidenceItem[];
  relatedLinks: RelatedIntelligenceLinks;
}
