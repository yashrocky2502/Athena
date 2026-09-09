/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence & Evidence-Backed Opportunity Engine
 * Canonical Types & Schema Declarations
 */

export type OpportunityType =
  | 'BREAKOUT'
  | 'BREAKDOWN'
  | 'MOMENTUM'
  | 'MEAN_REVERSION'
  | 'EVENT_DRIVEN'
  | 'EARNINGS'
  | 'MACRO'
  | 'SECTOR_ROTATION'
  | 'DERIVATIVE_FLOW'
  | 'VOLATILITY'
  | 'ARBITRAGE'
  | 'CONTRADICTION'
  | 'LIQUIDITY_SHOCK'
  | 'WATCHLIST';

export type OpportunityDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export type InstrumentType = 'EQUITY' | 'INDEX' | 'FUTURE' | 'OPTION' | 'COMMODITY' | 'CURRENCY' | 'CRYPTO';

export type ExchangeId = 'NSE' | 'BSE' | 'MCX' | 'NFO' | 'CDS' | 'CRYPTO' | 'GLOBAL';

export type DecisionState =
  | 'DETECTED'
  | 'EVIDENCE_VALIDATION'
  | 'CONFIRMATION_PENDING'
  | 'CONFIRMED'
  | 'RISK_REVIEW'
  | 'TRADEABLE'
  | 'EXECUTION_ELIGIBLE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'UNCONFIRMED'
  | 'CONTRADICTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'BLOCKED';

export type ActionRecommendation = 'TRADE' | 'WATCH' | 'WAIT' | 'AVOID' | 'BLOCKED' | 'EXPIRED';

export type PriorityTier = 'P0_CRITICAL' | 'P1_IMMEDIATE' | 'P2_HIGH' | 'P3_MONITOR' | 'P4_INFORMATIONAL';

export type ConfirmationDimension =
  | 'PRICE'
  | 'VOLUME'
  | 'OPEN_INTEREST'
  | 'IV'
  | 'BREADTH'
  | 'SECTOR'
  | 'INDEX'
  | 'MACRO'
  | 'NEWS'
  | 'FUNDAMENTALS';

export type ConfirmationStatus =
  | 'STRONGLY_CONFIRMED'
  | 'CONFIRMED'
  | 'PARTIALLY_CONFIRMED'
  | 'UNCONFIRMED'
  | 'CONTRADICTED'
  | 'CRITICALLY_CONTRADICTED';

export type PortfolioCompatibilityStatus = 'PORTFOLIO_COMPATIBLE' | 'PORTFOLIO_WARNING' | 'PORTFOLIO_BLOCKED';

export interface InvalidationCondition {
  id: string;
  conditionType: 
    | 'PRICE_LEVEL' 
    | 'VOLUME_DROP' 
    | 'REGIME_SHIFT' 
    | 'EVIDENCE_EXPIRY' 
    | 'CRITICAL_CONTRADICTION' 
    | 'TIME_STOP' 
    | 'CIRCUIT_BREAKER'
    | 'SURVEILLANCE_ANOMALY';
  description: string;
  thresholdValue?: number;
  currentValue?: number;
  isTriggered: boolean;
  triggeredAt?: string;
  deterministicRuleId?: string;
}

export interface DimensionConfirmationResult {
  dimension: ConfirmationDimension;
  status: ConfirmationStatus;
  score: number; // 0 - 100
  weight: number; // 0 - 1
  isIndependentSource: boolean;
  sourceId: string;
  evidenceId?: string;
  metricLabel: string;
  metricValue: string | number;
  threshold: string | number;
  contradictionDetected?: boolean;
  details?: string;
}

export interface MultiSourceConfirmationResult {
  overallStatus: ConfirmationStatus;
  confirmationScore: number; // 0 - 100
  dimensionResults: Record<ConfirmationDimension, DimensionConfirmationResult>;
  independentDimensionCount: number;
  confirmingDimensionCount: number;
  contradictingDimensionCount: number;
  isStronglyConfirmed: boolean;
  isContradicted: boolean;
  criticalContradictionReason?: string;
}

export interface MathematicalDecomposition {
  evidenceScoreComponent: number;
  confirmationScoreComponent: number;
  historicalSupportComponent: number;
  regimeCompatibilityComponent: number;
  liquidityComponent: number;
  expectedValueComponent: number;
  contradictionPenalty: number;
  riskPenalty: number;
  rawScore: number;
  finalScore: number;
  weights: {
    evidenceWeight: number;
    confirmationWeight: number;
    historicalWeight: number;
    regimeWeight: number;
    liquidityWeight: number;
    expectedValueWeight: number;
  };
  equationFormula: string;
}

export interface HistoricalAnalogueResult {
  analogueCount: number;
  matchedRegimes: string[];
  historicalWinRate: number; // 0.0 - 1.0
  historicalAvgReturnPct: number;
  returnDistribution: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  maxAdverseExcursionPct: number;
  maxFavourableExcursionPct: number;
  confidenceInterval95: [number, number];
  sampleEventIds: string[];
  qualityScore: number; // 0 - 100
  hasSufficientData: boolean;
}

export interface RegimeCompatibilityResult {
  currentRegime: string;
  opportunityType: OpportunityType;
  compatibilityScore: number; // 0 - 100
  isCompatible: boolean;
  historicalRegimeSharpe: number;
  historicalRegimeWinRate: number;
  expectedVolMultiplier: number;
  regimeNotes: string;
}

export interface ExpectedValueResult {
  probabilityOfSuccess: number; // 0.0 - 1.0 (derived strictly deterministically from analogues & confirmation)
  expectedProfitPct: number;
  expectedLossPct: number;
  expectedValuePct: number;
  riskRewardRatio: number;
  maxAdverseExcursion: number;
  maxFavourableExcursion: number;
  estimatedSlippageBps: number;
  transactionCostsBps: number;
  hasSufficientDeterministicEvidence: boolean;
  calculationNotes: string[];
}

export interface PortfolioReviewResult {
  status: PortfolioCompatibilityStatus;
  portfolioDelta: number;
  portfolioGamma: number;
  portfolioTheta: number;
  portfolioVega: number;
  symbolConcentrationPct: number;
  sectorConcentrationPct: number;
  correlationExposureScore: number;
  valueAtRiskPct: number;
  availableCapital: number;
  marginRequirement: number;
  maxAllowedPositionSize: number;
  blockingReasons: string[];
  warningNotes: string[];
}

export interface ExecutionEligibilityDecision {
  isEligible: boolean;
  status: 'ELIGIBLE' | 'BLOCKED' | 'PENDING_GATES';
  reason?: string;
  failedGates?: string[];
  authorizerApproval?: boolean;
  circuitBreakerBlocked?: boolean;
  killSwitchBlocked?: boolean;
  passedGatesCount: number;
  totalGatesCount: number;
  timestamp: string;
}

export interface CausalChainNode {
  stage: 
    | 'NEWS'
    | 'CATALYST'
    | 'MARKET_REACTION'
    | 'SURVEILLANCE_ANOMALY'
    | 'MARKET_TRUTH_VALIDATION'
    | 'SECTOR_INDEX_CONFIRMATION'
    | 'DERIVATIVE_CONFIRMATION'
    | 'HISTORICAL_ANALOGUE'
    | 'OPPORTUNITY'
    | 'RISK_REVIEW'
    | 'EXECUTION_ELIGIBILITY'
    | 'OUTCOME'
    | 'LEARNING';
  nodeId: string;
  title: string;
  timestamp: string;
  status: 'VERIFIED' | 'PENDING' | 'INVALIDATED' | 'FAILED';
  details: Record<string, any>;
  evidenceId?: string;
  provenanceRef?: string;
}

export interface OpportunityLifecycleEvent {
  eventId: string;
  opportunityId: string;
  timestamp: string;
  previousState: DecisionState;
  newState: DecisionState;
  reason: string;
  confidence: number;
  evidenceIds: string[];
  deterministicRuleIds: string[];
  actor: 'SYSTEM_DETERMINISTIC_ENGINE' | 'MARKET_TRUTH_TRIGGER' | 'RISK_GATE' | 'CIRCUIT_BREAKER' | 'EXPIRATION_TIMER';
  metadata?: Record<string, any>;
}

export interface OpportunityAttribution {
  opportunityId: string;
  predictedDirection: OpportunityDirection;
  predictedConfidence: number;
  predictedExpectedValue: number;
  actualDirection?: OpportunityDirection;
  actualReturnPct?: number;
  maxAdverseExcursionPct?: number;
  maxFavourableExcursionPct?: number;
  calibrationError?: number;
  wasSuccessful?: boolean;
  regime: string;
  strategy: string;
  evidenceQualityScore: number;
  contradictionStateAtCreation: number;
  executionTimestamp?: string;
  closeTimestamp?: string;
  evaluatedAt: string;
}

export interface CanonicalOpportunity {
  opportunityId: string;
  timestamp: string;
  marketSession: string;
  instrument: string;
  instrumentType: InstrumentType;
  exchange: ExchangeId;
  direction: OpportunityDirection;
  opportunityType: OpportunityType;
  thesis: string;
  catalyst: string;
  marketImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'SYSTEMIC';
  
  // Provenance and Evidence
  evidenceIds: string[];
  provenanceRootId: string;
  
  // Deterministic Multi-Factor Scores (0 - 100)
  evidenceQualityScore: number;
  evidenceFreshnessScore: number;
  confidenceScore: number;
  confirmationScore: number;
  contradictionScore: number;
  historicalAnalogueScore: number;
  regimeCompatibilityScore: number;
  liquidityScore: number;
  riskScore: number;
  
  // Quantitative Expectancy
  expectedValue: number; // e.g. +1.85%
  riskReward: number; // e.g. 2.4 (1:2.4)
  
  // Mathematical Transparency
  mathematicalDecomposition: MathematicalDecomposition;
  
  // Analytical Engine Breakdowns
  confirmationBreakdown: MultiSourceConfirmationResult;
  historicalAnalogueBreakdown: HistoricalAnalogueResult;
  regimeCompatibilityBreakdown: RegimeCompatibilityResult;
  expectedValueBreakdown: ExpectedValueResult;
  portfolioReview?: PortfolioReviewResult;
  
  // Invalidation & Safety
  invalidationConditions: InvalidationCondition[];
  
  // Decisions & Life Cycle
  decisionState: DecisionState;
  actionRecommendation: ActionRecommendation;
  priorityTier: PriorityTier;
  executionEligibility: ExecutionEligibilityDecision;
  
  // Full Causal Chain
  causalChain: CausalChainNode[];
  
  // Lifecycle Timestamps
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  schemaVersion: '25.0.0';
  
  // Attribution / Post-trade (populated upon resolution)
  attribution?: OpportunityAttribution;
}

export interface OpportunityFilterCriteria {
  opportunityType?: OpportunityType[];
  sector?: string[];
  instrument?: string[];
  direction?: OpportunityDirection[];
  minConfidence?: number;
  minEvidenceQuality?: number;
  regime?: string[];
  priorityTier?: PriorityTier[];
  executionEligibility?: ('ELIGIBLE' | 'BLOCKED' | 'PENDING_GATES')[];
  actionRecommendation?: ActionRecommendation[];
  decisionState?: DecisionState[];
  marketSession?: string;
  searchQuery?: string;
}
