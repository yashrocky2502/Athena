/**
 * ATHENA NEWS ENGINE — PHASE 15
 * types.ts
 * 
 * Canonical Schema: v15_closed_loop_intelligence
 * Standardized data structures for Performance Attribution, Expected vs Realized,
 * Signal/Strategy/Regime/Execution performance, False Signal Forensics,
 * NO_TRADE evaluation, Adaptive Ranking, Edge Decay, and Learning Safety.
 */

import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { CanonicalStrategyCandidate, StrategyType } from '../quant/types.ts';
import { PortfolioDecision, PortfolioSnapshot, PortfolioDecisionType } from '../portfolio/types.ts';
import { ExecutionIntent, ExecutionPlan, ExecutionOrder } from '../execution/types.ts';

export type MarketRegime =
  | 'BULL'
  | 'BEAR'
  | 'SIDEWAYS'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'RISK_ON'
  | 'RISK_OFF'
  | 'EVENT_DRIVEN'
  | 'BALANCED';

export type SchemaVersionPhase15 = 'v15_closed_loop_intelligence';

/** Complete Lineage Identifier */
export interface CompleteLineage {
  newsEventId: string;
  entityId: string;
  signalId: string;
  strategyCandidateId: string;
  portfolioDecisionId: string;
  executionId: string;
  orderId: string;
  positionId: string;
  tradeId: string;
}

/** Trade Outcome Record */
export interface TradeOutcome {
  schemaVersion: SchemaVersionPhase15;
  lineage: CompleteLineage;
  tradeId?: string;
  symbol: string;
  underlyingSymbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTimestamp: string;
  exitTimestamp: string;
  holdingPeriodMinutes: number;
  realizedPnLINR: number;
  realizedReturnPct: number;
  realizedRMultiple: number;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  exitReason: 'TARGET_HIT' | 'STOP_LOSS_HIT' | 'TRAILING_STOP_HIT' | 'TIME_EXPIRED' | 'MANUAL_EXIT' | 'KILL_SWITCH';
  grossPnLINR: number;
  slippageCostINR: number;
  transactionCostsINR: number;
  netPnLINR: number;
  isWin: boolean;
  marketRegime: MarketRegime;
}

/** Component Attribution Breakdown */
export interface AttributionRecord {
  attributionId: string;
  tradeId: string;
  symbol: string;
  lineage: CompleteLineage;
  realizedPnLINR: number;
  reconciliationDeltaINR: number;
  reconciliationStatus: 'EXACT' | 'WITHIN_TOLERANCE' | 'DISCREPANCY';
  components: {
    signalContributionINR: number;
    strategyContributionINR: number;
    portfolioContributionINR: number;
    executionContributionINR: number;
    marketRegimeContributionINR: number;
    slippageContributionINR: number; // usually negative
    transactionCostContributionINR: number; // usually negative
    timingContributionINR: number;
  };
  evaluatedAt: string;
}

/** Prediction Error (Expected vs Realized) */
export interface PredictionError {
  errorId: string;
  lineage: CompleteLineage;
  symbol: string;
  expected: {
    expectedReturnPct: number;
    targetProbabilityPct: number;
    rewardToRiskRatio: number;
    expectedMFEPct: number;
    expectedMAEPct: number;
    expectedHoldingPeriodMinutes: number;
    expectedSlippagePct: number;
    expectedExecutionQuality: string;
    expectedStressLossINR: number;
  };
  realized: {
    realizedReturnPct: number;
    isWin: boolean;
    realizedRMultiple: number;
    realizedMFEPct: number;
    realizedMAEPct: number;
    realizedHoldingPeriodMinutes: number;
    realizedSlippagePct: number;
    realizedExecutionQuality: string;
    realizedStressLossINR: number;
  };
  deltas: {
    returnErrorPct: number;
    mfeErrorPct: number;
    maeErrorPct: number;
    holdingPeriodErrorMinutes: number;
    slippageErrorPct: number;
    calibrationError: number;
  };
  evaluatedAt: string;
}

/** Signal Outcome & Performance */
export interface SignalOutcome {
  signalId: string;
  signalType: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  transmissionScore: number;
  rvolBucket: 'LOW_RVOL' | 'NORMAL_RVOL' | 'HIGH_RVOL' | 'EXTREME_RVOL';
  marketRegime: MarketRegime;
  assetClass: 'EQUITY' | 'OPTIONS' | 'FUTURES';
  sector: string;
  newsCategory: string;
  isWin: boolean;
  returnPct: number;
  mfePct: number;
  maePct: number;
  evaluatedAt: string;
}

export interface SignalPerformanceMetrics {
  totalSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRatePct: number;
  avgReturnPct: number;
  medianReturnPct: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  mfeMedianPct: number;
  maeMedianPct: number;
  expectedValueINR: number;
  calibrationErrorPct: number;
  falsePositiveRatePct: number;
  falseNegativeRatePct: number;
  bootstrapConfidence95: [number, number]; // [lower, upper]
  sampleQuality: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'GOOD' | 'STRONG';
}

/** Strategy Performance & Status */
export type StrategyStateStatus = 'STRATEGY_EDGE' | 'STRATEGY_NEUTRAL' | 'STRATEGY_DECAY' | 'STRATEGY_INVALIDATED';

export interface StrategyPerformanceMetrics {
  strategyType: StrategyType;
  totalTrades: number;
  winRatePct: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgSlippagePct: number;
  status: StrategyStateStatus;
  statusReason: string;
  bootstrapConfidence95: [number, number];
  sampleQuality: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'GOOD' | 'STRONG';
}

/** Regime Performance Segment */
export interface RegimePerformance {
  regime: MarketRegime;
  totalTrades: number;
  winRatePct: number;
  profitFactor: number;
  totalPnLINR: number;
  topStrategyTypes: StrategyType[];
  recommendedExecutionMode: 'PAPER' | 'PASSIVE_LIMIT' | 'IMMEDIATE_AGGR';
  evaluatedAt: string;
}

/** News -> Trade Transmission Chain Scorecard */
export interface TransmissionScorecard {
  eventCategory: string;
  totalEventsAnalyzed: number;
  signalAccuracyPct: number;
  priceReactionConfirmationPct: number;
  fnoConfirmationPct: number;
  strategySuccessPct: number;
  executionSuccessPct: number;
  finalTradeWinRatePct: number;
  weakestLink: 'SIGNAL' | 'PRICE_REACTION' | 'FNO' | 'STRATEGY' | 'EXECUTION';
  evaluatedAt: string;
}

/** False Signal Forensics Record */
export interface FalseSignalForensicsRecord {
  forensicId: string;
  lineage: CompleteLineage;
  symbol: string;
  failureType: 
    | 'FALSE_BREAKOUT'
    | 'FALSE_MOMENTUM'
    | 'NEWS_WITHOUT_PRICE_REACTION'
    | 'PRICE_REACTION_WITHOUT_NEWS'
    | 'VOLUME_CONTRADICTION'
    | 'FNO_CONTRADICTION'
    | 'LATE_SIGNAL'
    | 'OVEREXTENDED_ENTRY'
    | 'BAD_LIQUIDITY_ENTRY'
    | 'REGIME_MISMATCH';
  primaryFailureReason: string;
  secondaryFailureReason: string;
  lossRMultiple: number;
  preventativeLesson: string;
  evaluatedAt: string;
}

/** Execution Performance Feedback Record */
export interface ExecutionPerformanceFeedback {
  broker: string;
  executionMode: 'PAPER' | 'LIVE' | 'READ_ONLY';
  orderType: 'LIMIT' | 'MARKET' | 'TWAP' | 'VWAP';
  avgSlippagePct: number;
  avgFillLatencyMs: number;
  partialFillFrequencyPct: number;
  rejectionRatePct: number;
  implementationShortfallINR: number;
  winAdjustedAdvantagePct: number;
  evaluatedAt: string;
}

/** Portfolio Decision Attribution Record */
export interface PortfolioDecisionAttribution {
  decisionId: string;
  portfolioDecisionType: PortfolioDecisionType;
  symbol: string;
  portfolioReturnContributionINR: number;
  drawdownAvoidedINR: number;
  stressReductionPct: number;
  marginEfficiencyPct: number;
  greekEfficiencyPct: number;
  outcomeEvaluation: 'POSITIVE_VALUE' | 'NEUTRAL_VALUE' | 'NEGATIVE_VALUE';
  evaluatedAt: string;
}

/** NO_TRADE Counterfactual Performance */
export interface NoTradePerformanceRecord {
  recordId: string;
  lineage: CompleteLineage;
  symbol: string;
  decisionReason: string;
  counterfactualHypothesis: {
    hypotheticalEntryPrice: number;
    hypotheticalMaxAdversePrice: number;
    hypotheticalExitPrice: number;
    hypotheticalPnLINR: number;
  };
  classification: 'GOOD_NO_TRADE' | 'BAD_NO_TRADE' | 'MISSED_OPPORTUNITY' | 'CORRECT_RISK_BLOCK';
  avoidedLossINR: number;
  avoidedDrawdownPct: number;
  missedProfitINR: number;
  evaluatedAt: string;
}

/** Adaptive Ranking Score */
export interface AdaptiveScore {
  entityType: 'SIGNAL' | 'STRATEGY' | 'EXECUTION_MODE' | 'SIZING_TEMPLATE';
  entityKey: string; // e.g. StrategyType or SignalType
  rawScore: number; // 0-100
  discountedScore: number; // 0-100 after sample quality discount
  evidenceSummary: {
    winRatePct: number;
    profitFactor: number;
    sharpeRatio: number;
    recentDecayStatus: string;
    regimeCompatibilityPct: number;
    executionQualityScore: number;
  };
  sampleQuality: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'GOOD' | 'STRONG';
  version: string;
  updatedAt: string;
}

/** Edge Decay Status */
export type DecayStatus = 'HEALTHY' | 'WATCH' | 'DECAYING' | 'SEVERE_DECAY' | 'INSUFFICIENT_DATA';

export interface EdgeDecayReport {
  entityKey: string;
  decayStatus: DecayStatus;
  rolling30WinRatePct: number;
  expandingWinRatePct: number;
  winRateDeltaPct: number;
  rolling30ProfitFactor: number;
  expandingProfitFactor: number;
  mfeToMaeRatio: number;
  reason: string;
  evaluatedAt: string;
}

/** Adaptive Change Log Record (Immutable Audit) */
export interface AdaptiveChangeLogRecord {
  logId: string;
  entityKey: string;
  previousScore: number;
  newScore: number;
  evidenceWindow: string;
  sampleSize: number;
  performanceChange: string;
  reason: string;
  learningVersion: string;
  riskGateChanged: false; // Safety invariant
  timestamp: string;
}

/** Versioned Learning Snapshot */
export interface LearningVersion {
  versionId: string; // e.g. "v15.1"
  createdAt: string;
  isActive: boolean;
  trainingWindow: { start: string; end: string };
  validationWindow: { start: string; end: string };
  forwardWindow: { start: string; end: string };
  totalObservedTrades: number;
  scores: Record<string, AdaptiveScore>;
  decayReports: Record<string, EdgeDecayReport>;
  createdBy: 'ATHENA_CLOSED_LOOP_ENGINE';
}

/** Complete Closed-Loop Intelligence Result */
export interface ClosedLoopIntelligenceResult {
  schemaVersion: SchemaVersionPhase15;
  tradeOutcome: TradeOutcome;
  attribution: AttributionRecord;
  predictionError: PredictionError;
  forensics?: FalseSignalForensicsRecord;
  learningLog: AdaptiveChangeLogRecord;
  learningVersion: string;
  telegramText: string;
  evaluatedAt: string;
}
