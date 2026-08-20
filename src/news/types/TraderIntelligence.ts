/**
 * ATHENA NEWS ENGINE — STAGE 7: TRADER-CENTRIC INTELLIGENCE TYPES
 * Production-hardened data contracts and controlled enums for financial derivatives intelligence.
 */

export enum ImpactDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
  MIXED = 'MIXED',
  UNKNOWN = 'UNKNOWN'
}

export enum ImpactMagnitude {
  VERY_HIGH = 'VERY_HIGH',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  UNKNOWN = 'UNKNOWN'
}

export enum TimeHorizon {
  INTRADAY = 'INTRADAY',
  ONE_TO_THREE_DAYS = '1_3_DAYS',
  SWING = 'SWING',
  POSITIONAL = 'POSITIONAL',
  STRUCTURAL = 'STRUCTURAL',
  UNKNOWN = 'UNKNOWN'
}

export enum EventType {
  EARNINGS = 'EARNINGS',
  GUIDANCE = 'GUIDANCE',
  DIVIDEND = 'DIVIDEND',
  BUYBACK = 'BUYBACK',
  BONUS = 'BONUS',
  SPLIT = 'SPLIT',
  M_AND_A = 'M_AND_A',
  CONTRACT = 'CONTRACT',
  ORDER = 'ORDER',
  MANAGEMENT_CHANGE = 'MANAGEMENT_CHANGE',
  REGULATORY_ACTION = 'REGULATORY_ACTION',
  POLICY_CHANGE = 'POLICY_CHANGE',
  IPO = 'IPO',
  FUNDRAISING = 'FUNDRAISING',
  CREDIT_EVENT = 'CREDIT_EVENT',
  RATING_CHANGE = 'RATING_CHANGE',
  MACRO_DATA = 'MACRO_DATA',
  CENTRAL_BANK = 'CENTRAL_BANK',
  COMMODITY_EVENT = 'COMMODITY_EVENT',
  GLOBAL_MARKET_EVENT = 'GLOBAL_MARKET_EVENT',
  TECHNOLOGY_EVENT = 'TECHNOLOGY_EVENT',
  LEGAL_EVENT = 'LEGAL_EVENT',
  CORPORATE_GOVERNANCE = 'CORPORATE_GOVERNANCE',
  MARKET_MOVEMENT = 'MARKET_MOVEMENT',
  OTHER = 'OTHER'
}

export enum FNORelevance {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE'
}

export enum FNOBias {
  CE_BIAS = 'CE_BIAS',
  PE_BIAS = 'PE_BIAS',
  NEUTRAL_BIAS = 'NEUTRAL_BIAS',
  MIXED_BIAS = 'MIXED_BIAS',
  INSUFFICIENT_INFORMATION = 'INSUFFICIENT_INFORMATION'
}

export enum RiskLevel {
  VERY_HIGH = 'VERY_HIGH',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum EvidenceStrength {
  STRONG = 'STRONG',
  MODERATE = 'MODERATE',
  WEAK = 'WEAK',
  INSUFFICIENT = 'INSUFFICIENT'
}

export enum ImpactRelationship {
  DIRECT = 'DIRECT',
  INDIRECT = 'INDIRECT'
}

/**
 * Stage 7.2 Symbol Resolution State
 */
export enum SymbolResolutionState {
  LISTED_SYMBOL_CONFIRMED = 'LISTED_SYMBOL_CONFIRMED',
  MULTIPLE_SYMBOLS = 'MULTIPLE_SYMBOLS',
  UNLISTED_OR_NO_TRADING_SYMBOL = 'UNLISTED_OR_NO_TRADING_SYMBOL',
  ENTITY_UNRESOLVED = 'ENTITY_UNRESOLVED'
}

/**
 * Stage 7.2 Evidence Classification Model
 */
export enum EvidenceClass {
  FACT = 'FACT',
  DERIVED = 'DERIVED',
  INTERPRETATION = 'INTERPRETATION',
  UNSUPPORTED = 'UNSUPPORTED'
}

/**
 * Stage 7.2 Observed Market Reaction
 */
export enum ObservedMarketReaction {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
  MIXED = 'MIXED',
  UNKNOWN = 'UNKNOWN'
}

export interface EntityAttribution {
  primaryAffectedEntity: {
    name: string;
    symbol: string | null;
    resolutionState: SymbolResolutionState;
    entityType: 'COMPANY' | 'MACRO' | 'INDEX' | 'SECTOR' | 'COMMODITY' | 'UNLISTED';
  };
  secondaryAffectedEntities: Array<{
    name: string;
    symbol: string | null;
    resolutionState: SymbolResolutionState;
  }>;
  analystsAndBrokerages: string[];
  promoters: string[];
  regulators: string[];
  exchanges: string[];
  indices: string[];
  sectors: string[];
  unrelatedEntities: string[];
}

export interface DecomposedEvent {
  entityName: string;
  symbol: string | null;
  symbolResolutionState: SymbolResolutionState;
  eventType: EventType;
  sourceEvidence: string;
  observedPriceReaction: ObservedMarketReaction;
  marketImpact: ImpactDirection;
  traderRelevance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EvidenceItem {
  text: string;
  classification: EvidenceClass;
  sourceLocation: 'HEADLINE' | 'BODY' | 'FINANCIAL_METRIC' | 'ANALYST_QUOTE';
  confidence: number;
}

export interface ConfidenceScoreBreakdown {
  sourceAuthorityScore: number;     // Max 25
  directEntityMatchScore: number;   // Max 25
  eventCertaintyScore: number;      // Max 20
  quantitativeEvidenceScore: number;// Max 15
  marketReactionScore: number;     // Max 15
  totalScore: number;               // 0-100
  rating: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';
  reasoning: string;
}

export interface FNOEvidenceDetails {
  isFnoEligible: boolean;
  fnoEvidencePresent: boolean;
  detectedFnoMetrics: string[];
  cePeBias: FNOBias;
  biasReasoning: string;
}

export interface RewrittenTraderTakeaway {
  traderContext: string;
  marketDirection: string;
  whatToMonitor: string;
  formattedText: string;
}

export interface SymbolImpact {
  primarySymbol: string | null;
  secondarySymbols: string[];
  sector: string | null;
  relatedIndex: string | null;
  directImpact: string[];
  indirectImpact: string[];
  relationship: ImpactRelationship;
}

export interface AffectedEntities {
  companies: string[];
  sectors: string[];
  indices: string[];
  commodities?: string[];
  currencies?: string[];
  fnoInstruments?: string[];
}

export interface WhyThisMatters {
  whatHappened: string;
  whyItMatters: string;
  whoIsAffected: AffectedEntities;
  traderImpact: string;
  evidence: string[];
  evidenceStrength: EvidenceStrength;
  evidenceItems?: EvidenceItem[];
  whatRemainsUnknown?: string[];
}

export interface TraderIntelligence {
  articleId: string;
  headline: string;
  marketImpact: ImpactDirection;
  impactDirection: ImpactDirection;
  impactMagnitude: ImpactMagnitude;
  timeHorizon: TimeHorizon;
  affectedSymbols: string[];
  affectedSectors: string[];
  affectedIndices: string[];
  fnoRelevance: FNORelevance;
  cePeBias: FNOBias;
  biasConfidence: number; // 0-100
  ivImpactRisk: RiskLevel;
  gapRisk: RiskLevel;
  eventRisk: RiskLevel;
  eventType: EventType;
  urgency: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  sourceAuthority: number; // 0-100
  freshnessMinutes: number;
  evidenceStrength: EvidenceStrength;
  traderTakeaway: string;
  whyThisMatters: WhyThisMatters;
  symbolImpact: SymbolImpact;
  isBreaking: boolean;
  generatedAt: string;
  engine: 'deterministic_trader_v7' | 'deterministic_trader_v7_2';

  // Stage 7.2 Extensions
  symbolResolutionState?: SymbolResolutionState;
  entityAttribution?: EntityAttribution;
  decomposedEvents?: DecomposedEvent[];
  observedMarketReaction?: ObservedMarketReaction;
  impactReasoning?: string;
  confidenceBreakdown?: ConfidenceScoreBreakdown;
  fnoDetails?: FNOEvidenceDetails;
  takeawayStructure?: RewrittenTraderTakeaway;
  whatRemainsUnknown?: string[];
  evidenceModel?: EvidenceItem[];
}

export interface SymbolIntelligenceSummary {
  symbol: string;
  companyName: string;
  sector: string;
  indices: string[];
  isFnoEligible: boolean;
  totalArticles: number;
  sentimentBreakdown: {
    bullish: number;
    bearish: number;
    neutral: number;
    mixed: number;
  };
  dominantBias: FNOBias;
  avgConfidence: number;
  dominantIVRisk: RiskLevel;
  recentEvents: {
    eventType: EventType;
    headline: string;
    publishedAt: string;
    impact: ImpactDirection;
  }[];
  recentArticles: TraderIntelligence[];
}
