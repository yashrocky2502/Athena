/**
 * ATHENA EVIDENCE-GROUNDED TRADER INTELLIGENCE — DATA CONTRACTS
 * Strictly defined types and enums to prevent hallucination and false synthesis.
 */

export type EvidenceState = 'VERIFIED' | 'DERIVED' | 'UNKNOWN' | 'CONFLICTING' | 'NOT_APPLICABLE';

export type TraderIntelligenceEventType =
  | 'EARNINGS'
  | 'REVENUE_UPDATE'
  | 'PROFIT_UPDATE'
  | 'DIVIDEND'
  | 'BUYBACK'
  | 'BONUS'
  | 'SPLIT'
  | 'ORDER_WIN'
  | 'ORDER_CANCELLATION'
  | 'M_AND_A'
  | 'ACQUISITION'
  | 'STAKE_SALE'
  | 'BLOCK_DEAL'
  | 'DEBT_LISTING'
  | 'FUNDRAISING'
  | 'REGULATORY_ACTION'
  | 'LEGAL_ACTION'
  | 'TAX_ACTION'
  | 'PRICE_CHANGE'
  | 'CAPACITY_EXPANSION'
  | 'CAPEX'
  | 'MANAGEMENT_CHANGE'
  | 'CREDIT_RATING'
  | 'IPO'
  | 'MACROECONOMIC'
  | 'FNO_POSITIONING'
  | 'OTHER';

export type EvidenceType =
  | 'SOURCE_FACT'
  | 'NUMERICAL_FACT'
  | 'EVENT_FACT'
  | 'PRICE_DATA'
  | 'DERIVATIVES_DATA'
  | 'EXCHANGE_FILING'
  | 'MANAGEMENT_COMMENT'
  | 'MACRO_DATA'
  | 'DERIVED_CONCLUSION';

export interface EvidenceItem {
  id: string;
  source: string;
  sourceTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  articleId?: string;
  eventId?: string;
  publishedAt?: string;
  evidenceText: string;
  evidenceType: EvidenceType;
  supportingFactIds?: string[];
}

export type TraderProfileType =
  | 'INTRADAY_TRADER'
  | 'SWING_TRADER'
  | 'LONG_TERM_INVESTOR'
  | 'FNO_TRADER'
  | 'OPTIONS_SELLER'
  | 'VOLATILITY_TRADER'
  | 'EVENT_DRIVEN_TRADER'
  | 'ARBITRAGE_TRADER'
  | 'MUTUAL_FUND_INVESTOR';

export interface TraderRelevanceProfile {
  profile: TraderProfileType;
  relevanceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  relevanceReason: string;
}

export interface MarketReactionData {
  status: EvidenceState;
  preEventPrice?: number;
  postEventPrice?: number;
  absoluteChange?: number;
  percentageChange?: number;
  reactionWindow?: '5m' | '15m' | '30m' | '1h' | 'session' | '1D';
  volumeChange?: number;
}

export interface FnoEvidenceDetail {
  type: 'OI' | 'OI_CHANGE' | 'PCR' | 'IV' | 'STRIKE' | 'CALL_WRITING' | 'PUT_WRITING' | 'FUTURES_POSITIONING' | 'VOLUME' | 'BASIS';
  value: string | number;
  source: string;
}

export interface FnoIntelligenceData {
  status: EvidenceState;
  available: boolean;
  reason?: string;
  underlying?: string;
  evidence?: FnoEvidenceDetail[];
  optionsSellerRelevance?: string;
  volatilityContext?: string;
  callWriterEvidence?: string;
  putWriterEvidence?: string;
  supportResistanceEvidence?: string;
  riskConditions?: string;
}

export interface WhatChangedData {
  status: 'NEW_INFORMATION' | 'ALREADY_KNOWN' | 'REVISION' | 'CONFIRMATION' | 'UNRESOLVED';
  previousValue?: string | number;
  newValue?: string | number;
  changeMagnitude?: string | number;
  changeDirection?: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  details: string;
}

export interface ConfidenceData {
  confidenceScore: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';
  confidenceReasons: string[];
}

export interface TraderIntelligence {
  eventId?: string;
  articleId: string;
  entity: string;
  symbol: string | null;
  category: string;
  eventType: TraderIntelligenceEventType;

  executiveInterpretation: string;

  fundamentalImpact: EvidenceState;
  fundamentalMechanism: string;

  marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';
  marketDirection: string;
  marketReaction: MarketReactionData;

  traderRelevance: TraderRelevanceProfile[];

  fnoIntelligence: FnoIntelligenceData;

  evidence: EvidenceItem[];
  evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW';

  confidence: ConfidenceData;

  uncertainty: string[];

  whatChanged: WhatChangedData;

  whatToMonitor: string[];

  generatedAt: string;
  engineVersion: string;
}
