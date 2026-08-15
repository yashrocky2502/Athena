/**
 * ATHENA NEWS ENGINE V3 — CLASSIFICATION TYPES
 * 
 * Strict type definitions for Phase 5 Institutional Classification Engine.
 * Purely deterministic, rule-based classification types.
 */

export type ClassificationCategory =
  | 'QUARTERLY_RESULTS'
  | 'BROKER_REPORT'
  | 'CORPORATE_ACTION'
  | 'DIVIDEND'
  | 'BONUS'
  | 'SPLIT'
  | 'BUYBACK'
  | 'MERGER'
  | 'ACQUISITION'
  | 'IPO'
  | 'QIP'
  | 'RIGHTS_ISSUE'
  | 'BLOCK_DEAL'
  | 'BULK_DEAL'
  | 'PROMOTER_ACTION'
  | 'BOARD_MEETING'
  | 'GUIDANCE'
  | 'CAPEX'
  | 'ORDER_WIN'
  | 'ORDER_LOSS'
  | 'MANAGEMENT_CHANGE'
  | 'CEO_CHANGE'
  | 'CFO_CHANGE'
  | 'RESIGNATION'
  | 'SEBI_ACTION'
  | 'RBI_POLICY'
  | 'MACRO'
  | 'GDP'
  | 'CPI'
  | 'WPI'
  | 'IIP'
  | 'TRADE'
  | 'FOREX'
  | 'COMMODITY'
  | 'CRYPTO'
  | 'GLOBAL_MARKETS'
  | 'DOMESTIC_MARKETS'
  | 'RESULT_PREVIEW'
  | 'RESULT_REACTION'
  | 'GENERAL_MARKET'
  | 'UNKNOWN';

export type MarketImpactScore = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export type MarketCapBucket = 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP' | 'MICRO_CAP';

export type NiftySectorIndex =
  | 'NIFTY BANK'
  | 'NIFTY IT'
  | 'NIFTY FMCG'
  | 'NIFTY AUTO'
  | 'NIFTY METAL'
  | 'NIFTY PHARMA'
  | 'NIFTY PSU BANK'
  | 'NIFTY REALTY'
  | 'NIFTY ENERGY'
  | 'NIFTY OIL & GAS'
  | 'NIFTY FINANCIAL SERVICES'
  | 'NIFTY MEDIA'
  | 'NIFTY CONSUMPTION'
  | 'NIFTY INFRA'
  | 'MACRO_ECONOMY'
  | 'GENERAL';

export interface ResolvedCompany {
  name: string;
  ticker: string;
  exchange: 'NSE' | 'BSE' | 'BOTH';
  sector: NiftySectorIndex;
  industry: string;
  marketCapBucket: MarketCapBucket;
  confidence: number; // 0 - 100
}

export interface CategoryMatch {
  category: ClassificationCategory;
  confidence: number; // 0 - 100
  matchedKeywords: string[];
  ruleId: string;
}

export interface ParserRoute {
  parserName:
    | 'QuarterlyResultsParser'
    | 'BrokerParser'
    | 'CorporateActionParser'
    | 'DividendParser'
    | 'ManagementChangeParser'
    | 'IPOParser'
    | 'MacroParser'
    | 'SEBIParser'
    | 'RBIParser'
    | 'CommodityParser'
    | 'ForexParser'
    | 'OrderWinParser'
    | 'GeneralParser';
  priority: number;
  handlerName: string;
}

export interface ClassificationResult {
  documentId: string;
  title: string;
  primaryCategory: ClassificationCategory;
  allCategories: ClassificationCategory[];
  categoryMatches: CategoryMatch[];
  resolvedCompany?: ResolvedCompany;
  resolvedCompanies: ResolvedCompany[];
  urgencyScore: number; // 0 - 100
  impactScore: MarketImpactScore;
  classificationConfidence: number; // 0 - 100
  targetParser: ParserRoute;
  isRejected: boolean;
  rejectionReason?: string;
  conflictsDetected: string[];
  processingTimeMs: number;
  timestamp: string;
}

export interface ClassificationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
