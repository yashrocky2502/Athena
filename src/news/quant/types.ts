/**
 * ATHENA NEWS ENGINE — PHASE 12
 * types.ts
 * 
 * Quantitative Strategy Intelligence & Signal-to-Strategy Engine Types.
 * Schema: v12_strategy_candidate
 */

import { TransmissionSignalResult, ActionabilityState as Phase11Actionability, TransmissionPriority } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { TransmissionAlignment } from '../intelligence/EventTransmissionGraph.ts';

export type StrategyCategory = 'EQUITY' | 'FUTURES' | 'OPTIONS';

export type StrategyType =
  // EQUITY
  | 'EQUITY_MOMENTUM_CONTINUATION'
  | 'EQUITY_BREAKOUT'
  | 'EQUITY_PULLBACK_CONTINUATION'
  | 'EQUITY_MEAN_REVERSION'
  | 'EQUITY_EVENT_DRIVEN_CONTINUATION'
  | 'EQUITY_EVENT_DRIVEN_REVERSAL'
  // FUTURES
  | 'FUTURES_DIRECTIONAL_LONG'
  | 'FUTURES_DIRECTIONAL_SHORT'
  | 'FUTURES_BREAKOUT'
  | 'FUTURES_TREND_CONTINUATION'
  // OPTIONS
  | 'OPTION_LONG_CALL'
  | 'OPTION_LONG_PUT'
  | 'OPTION_BULL_CALL_SPREAD'
  | 'OPTION_BEAR_PUT_SPREAD'
  | 'OPTION_BULL_PUT_SPREAD'
  | 'OPTION_BEAR_CALL_SPREAD'
  | 'OPTION_IRON_CONDOR'
  | 'OPTION_COVERED_CALL'
  | 'OPTION_CASH_SECURED_PUT'
  | 'NO_TRADE_STRATEGY';

export type CompatibilityRating = 'COMPATIBLE' | 'CONDITIONAL' | 'WEAK' | 'INCOMPATIBLE';

export type ValidationStatus = 'VALIDATED' | 'CONDITIONAL' | 'UNVALIDATED' | 'OVERFIT_RISK' | 'INSUFFICIENT_SAMPLE';

export type StrategyActionability = 'TRADEABLE' | 'WATCH' | 'CONDITIONAL' | 'NO_TRADE';

export interface OptionLegDetails {
  legId: string;
  type: 'CALL' | 'PUT';
  action: 'BUY' | 'SELL';
  strike: number;
  expiryDays: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  premium: number;
  openInterest: number;
  volume: number;
}

export interface OptionsStrategyGreeks {
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  ivRankPct: number;
  ivPercentilePct: number;
  expectedMovePct: number;
  underlyingSpot: number;
  breakevenPoints: number[];
  maxProfit: number; // INR
  maxLoss: number;   // INR
  probabilityOfProfitPct: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  grossPnL: number;
  netPnL: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  volatilityPct: number;
  mfeMedianPct: number;
  maeMedianPct: number;
  avgHoldingPeriodMinutes: number;
  medianHoldingPeriodMinutes: number;
  bestTradePnL: number;
  worstTradePnL: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  hasLookaheadBiasProtection: boolean;
}

export interface ExpectedValueMetrics {
  expectedValueINR: number; // (P(win)*AvgWin) - (P(loss)*AvgLoss) - Costs - Slippage
  expectedReturnPct: number;
  expectedRiskPct: number;
  rewardToRiskRatio: number;
  targetProbabilityPct: number;
  stopProbabilityPct: number;
  noResolutionProbabilityPct: number;
  confidenceInterval95Pct: [number, number];
}

export interface HistoricalAnaloguePrecedent {
  historicalEventId: string;
  similarityScore: number; // 0-100
  eventType: string;
  entity: string;
  marketRegime: string;
  initialReactionPct: number;
  subsequentReactionPct: number;
  mfePct: number;
  maePct: number;
  resolutionTimeMinutes: number;
  outcome: 'PROFITABLE' | 'LOSS' | 'NEUTRAL';
  sourceEvidence: string;
}

export interface HistoricalPrecedentSet {
  sampleSize: number;
  sampleQuality: 'INSUFFICIENT_SAMPLE' | 'LIMITED_SAMPLE' | 'VALID_HISTORICAL_SAMPLE';
  historicalAnalogues: HistoricalAnaloguePrecedent[];
  winRatePct?: number;
  avgMfePct?: number;
  avgMaePct?: number;
}

export interface RobustnessValidationReport {
  walkForwardPassed: boolean;
  outOfSamplePassed: boolean;
  parameterSensitivityScore: number; // 0-100 (higher = less sensitive / more stable)
  regimeStabilityPassed: boolean;
  overfittingRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  validationStatus: ValidationStatus;
  warnings: string[];
}

export interface StrategyRiskProfile {
  maxLossINR: number;
  maxDrawdownPct: number;
  liquidityScore: number; // 0-100
  slippageEstimatePct: number;
  eventRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  gapRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  leverageRatio: number; // e.g., 1.0 = Spot, 5.0 = Futures
  sampleSizeQuality: string;
  contradictionRisk: boolean;
  overallRiskScore: number; // 0-100 (higher = safer)
}

/**
 * Versioned Canonical Object Schema: v12_strategy_candidate
 */
export interface CanonicalStrategyCandidate {
  schemaVersion: 'v12_strategy_candidate';
  strategyId: string;
  signalId: string;
  articleId: string;
  symbol: string;
  companyName: string;
  sector: string;
  marketRegime: string;
  signalDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalConfidence: number;
  transmissionScore: number;
  lifecycleState: 'NEW' | 'ACTIVE' | 'CONFIRMED' | 'WEAKENING' | 'CONTRADICTED' | 'EXPIRED' | 'INVALIDATED';
  
  // Strategy Definition
  strategyType: StrategyType;
  category: StrategyCategory;
  strategyName: string;
  description: string;
  underlyingSymbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  
  // Specific Controls
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  holdingPeriodMinutes: number;
  positionSizeContractsOrQty: number;
  estimatedCapitalRequiredINR: number;
  
  // Options specific (if applicable)
  optionLegs?: OptionLegDetails[];
  optionsGreeks?: OptionsStrategyGreeks;
  
  // Quant Calculations (Deterministic)
  compatibilityScore: number;
  compatibilityRating: CompatibilityRating;
  backtestMetrics: BacktestMetrics;
  expectedValue: ExpectedValueMetrics;
  robustnessReport: RobustnessValidationReport;
  riskProfile: StrategyRiskProfile;
  historicalPrecedents: HistoricalPrecedentSet;
  
  // Gatekeepers
  validationStatus: ValidationStatus;
  contradictionStatus: boolean;
  actionability: StrategyActionability;
  actionabilityRationale: string;
  
  // Evidence & Provenance
  evidenceReferences: {
    stage: string;
    summary: string;
  }[];
  
  generatedAt: string;
  engineVersion: string;
}

export interface QuantIntelligenceObservability {
  signalsConsumed: number;
  strategyCandidatesGenerated: number;
  strategiesRejected: number;
  backtestsExecuted: number;
  validationFailures: number;
  insufficientSamples: number;
  overfittingWarnings: number;
  contradictorySignalsProcessed: number;
  riskGateRejections: number;
  cacheHits: number;
  cacheMisses: number;
  computationLatencyMs: number[];
  aiResearchInvocations: number;
  deterministicCalculations: number;
}
