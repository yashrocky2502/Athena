export type DirectionalBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';

export type RecommendationType = 
  | 'SELL_CE'
  | 'SELL_PE'
  | 'SELL_STRANGLE'
  | 'SELL_CONDOR'
  | 'WAIT'
  | 'NO_TRADE'
  | 'INFORMATIONAL_ONLY';

export type VolatilityBias = 'VOLATILITY_EXPANSION' | 'VOLATILITY_COMPRESSION' | 'NEUTRAL' | 'HIGH_VOLATILITY_AVOID';

export type EventRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'BINARY';

export type FreshnessStatus = 'LIVE' | 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED';

export type DataAvailabilityStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';

export type AlertSeverity = 'INFO' | 'WATCH' | 'ACTIONABLE' | 'CRITICAL';

export interface FNOEligibilityResult {
  eligible: boolean;
  symbol: string | null;
  matchedEntity: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  matchLocation: 'HEADLINE' | 'TITLE' | 'METADATA' | 'BODY_ONLY' | 'NONE';
  reason: string;
}

export type FNORelevanceLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type OptionsSellerRelevanceLevel = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type FNODecision = "INCLUDE" | "EXCLUDE";

export interface FNOAuditResult {
  fnoEligible: boolean;
  fnoSymbol: string | null;
  matchedEntity?: string | null;
  entityMatchLocation?: 'HEADLINE' | 'TITLE' | 'METADATA' | 'BODY_ONLY' | 'NONE';
  entityConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  fnoRelevance: FNORelevanceLevel;
  fnoScore: number;
  fnoReasons: string[];
  fnoDecision: FNODecision;
  fnoRuleVersion: "21.2";
  optionsSellerRelevance: OptionsSellerRelevanceLevel;
}

export interface FODecisionSignal {
  signalId: string;
  articleId: string;
  storyClusterId: string;
  timestamp: string;
  symbol: string;
  underlyingType: 'INDEX' | 'STOCK' | 'COMMODITY' | 'CURRENCY' | 'UNKNOWN';
  indexOrStock: string;
  eventType: string;
  eventPolarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';
  impactMagnitude: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'UNKNOWN';
  catalystHorizon: 'INTRADAY' | 'SHORT_TERM' | 'SWING' | 'STRUCTURAL' | 'UNKNOWN';
  fnoRelevance: FNORelevanceLevel;
  directionalBias: DirectionalBias;
  directionalConfidence: number; // 0 - 100
  volatilityBias: VolatilityBias;
  binaryEventRisk: EventRiskLevel;
  gapRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  overnightRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: RecommendationType;
  preferredOptionSide: 'CE' | 'PE' | 'BOTH' | 'NONE';
  preferredStrategy: 'Naked CE' | 'Naked PE' | 'Iron Condor' | 'Strangle' | 'Wait / Hold' | 'No Trade';
  entryConditions: string[];
  invalidationConditions: string[];
  stopLossLogic: string;
  hedgeRequired: boolean;
  hedgeReason: string;
  rationale: string;
  supportingFacts: string[];
  sourceUrls: string[];
  sourcePublisher: string;
  intelligenceStatus: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';
  freshnessStatus: FreshnessStatus;
  decisionStatus: 'ACTIVE' | 'DOWNGRADED' | 'EXPIRED' | 'BLOCKED';
  dataAvailability: {
    underlyingPrice: DataAvailabilityStatus;
    optionChain: DataAvailabilityStatus;
    ivData: DataAvailabilityStatus;
    deltaStatus: DataAvailabilityStatus;
    positionsData: DataAvailabilityStatus;
  };
  alertSeverity: AlertSeverity;
  evidenceCount: number;
  independentPublisherCount: number;
  sourceAgreementScore: number; // 0 - 100
  blockedReason?: string;
}
