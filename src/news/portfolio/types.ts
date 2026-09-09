/**
 * ATHENA NEWS ENGINE — PHASE 13
 * portfolio/types.ts
 * 
 * Portfolio Intelligence & Position Decision Engine Types & Interfaces.
 * Schema: v13_portfolio_intelligence
 * 
 * ZERO-AI COST CONTRACT:
 * All calculations are 100% deterministic, robust, and mathematically auditable.
 */

import { CanonicalStrategyCandidate, OptionLegDetails } from '../quant/types.ts';

export type PositionAssetClass = 'EQUITY' | 'FUTURES' | 'OPTIONS' | 'CASH';

export type OptionType = 'CALL' | 'PUT';
export type PositionSide = 'LONG' | 'SHORT';

export interface RawPortfolioPosition {
  id: string;
  symbol: string;
  underlyingSymbol: string;
  assetClass: PositionAssetClass;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnLINR: number;
  realizedPnLINR: number;
  sector?: string;
  indexSymbol?: string;
  beta?: number;
  leverage?: number;
  stopLossPrice?: number;
  targetPrice?: number;

  // Options Specific fields
  optionType?: OptionType;
  strikePrice?: number;
  expiryDate?: string;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;

  // Multi-leg reference
  strategyGroupTag?: string;
}

export interface NormalizedPosition {
  id: string;
  symbol: string;
  underlyingSymbol: string;
  assetClass: PositionAssetClass;
  side: PositionSide;
  netQuantity: number;
  grossQuantity: number;
  entryPrice: number;
  currentPrice: number;
  currentMarketValueINR: number;
  notionalExposureINR: number;
  directionalExposureINR: number; // positive = long, negative = short
  leveragedExposureINR: number;
  unrealizedPnLINR: number;
  realizedPnLINR: number;
  sector: string;
  indexSymbol: string;
  beta: number;
  leverage: number;
  stopLossPrice: number;
  targetPrice: number;

  // Options normalized
  optionType?: OptionType;
  strikePrice?: number;
  expiryDate?: string;
  daysToExpiry?: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };

  strategyGroupTag?: string;
}

export interface PortfolioSnapshot {
  schemaVersion: 'v13_portfolio_intelligence';
  timestamp: string;
  totalCapitalINR: number;
  availableCapitalINR: number;
  usedMarginINR: number;
  freeMarginINR: number;
  cashINR: number;
  totalUnrealizedPnLINR: number;
  totalRealizedPnLINR: number;
  positions: NormalizedPosition[];
}

export interface ExposureBreakdown {
  grossExposureINR: number;
  netExposureINR: number;
  longExposureINR: number;
  shortExposureINR: number;
  grossNotionalToCapitalRatio: number;
  netNotionalToCapitalRatio: number;
  directionalBetaExposure: number;
  leverageAdjustedExposureINR: number;
  sectorExposureMap: Record<string, number>; // sector -> exposure INR
  sectorExposurePctMap: Record<string, number>; // sector -> exposure %
  indexExposureMap: Record<string, number>; // index -> exposure INR
  underlyingExposureMap: Record<string, number>; // symbol -> exposure INR
  assetClassExposureMap: Record<PositionAssetClass, number>;
}

export interface PortfolioGreeks {
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  deltaExposureINR: number;
  greekConcentrationByUnderlying: Record<string, { delta: number; vega: number }>;
  greekConcentrationByExpiry: Record<string, { delta: number; theta: number }>;
}

export type OverlapLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface PortfolioOverlapReport {
  overlapScore: number; // 0 to 100
  overlapLevel: OverlapLevel;
  highCorrelatedHoldings: Array<{ pos1: string; pos2: string; correlation: number; reason: string }>;
  overlappingDirectionalBets: string[];
  sectorDuplications: string[];
  underlyingDuplications: string[];
  strategyDuplications: string[];
  detectedFactorExposures: string[];
}

export type ConcentrationLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export interface PortfolioConcentrationReport {
  maxSingleSecurityPct: number;
  maxUnderlyingPct: number;
  maxSectorPct: number;
  maxIndexPct: number;
  maxAssetClassPct: number;
  maxExpiryPct: number;
  singleSecurityConcentration: ConcentrationLevel;
  sectorConcentration: ConcentrationLevel;
  underlyingConcentration: ConcentrationLevel;
  overallConcentrationScore: number; // 0 to 100
  flaggedConcentrations: string[];
}

export interface PortfolioCapitalReport {
  totalCapitalINR: number;
  availableCapitalINR: number;
  investedCapitalINR: number;
  usedMarginINR: number;
  freeMarginINR: number;
  marginUtilizationPct: number;
  effectiveLeverage: number;
  grossNotionalToCapitalRatio: number;
  incrementalMarginRequiredINR: number;
  postTradeMarginUtilizationPct: number;
  capitalPreservationBreached: boolean;
  marginCallRisk: boolean;
}

export type DrawdownState = 'DRAWDOWN_NORMAL' | 'DRAWDOWN_ELEVATED' | 'DRAWDOWN_CRITICAL';

export interface PortfolioDrawdownReport {
  currentEquityINR: number;
  peakEquityINR: number;
  currentDrawdownINR: number;
  currentDrawdownPct: number;
  maxHistoricalDrawdownPct: number;
  dailyPnLINR: number;
  weeklyPnLINR: number;
  monthlyPnLINR: number;
  drawdownState: DrawdownState;
  positionDrawdownContributions: Array<{ positionId: string; symbol: string; drawdownContributionINR: number; pctOfDrawdown: number }>;
}

export type PortfolioRegimeStatus = 'REGIME_ALIGNED' | 'REGIME_NEUTRAL' | 'REGIME_VULNERABLE' | 'REGIME_CONTRADICTED';

export interface MarketRegimeExposureReport {
  currentRegime: string;
  regimeStatus: PortfolioRegimeStatus;
  bullishRegimeStressPnLINR: number;
  bearishRegimeStressPnLINR: number;
  sidewaysRegimeStressPnLINR: number;
  highVolRegimeStressPnLINR: number;
  lowVolRegimeStressPnLINR: number;
  riskOnExposureINR: number;
  riskOffExposureINR: number;
  rationale: string;
}

export interface StressScenarioResult {
  scenarioName: string;
  description: string;
  projectedPnLINR: number;
  projectedPnLPct: number;
  projectedDrawdownPct: number;
  marginImpactINR: number;
  riskClassification: 'SAFE' | 'MODERATE_LOSS' | 'SEVERE_LOSS' | 'CATASTROPIC_LOSS';
}

export interface PortfolioStressReport {
  overallStressScore: number; // 0-100 (100 = safe, 0 = highly vulnerable)
  worstCaseLossINR: number;
  worstCaseLossPct: number;
  worstCaseScenarioName: string;
  scenarios: StressScenarioResult[];
}

export interface HedgeCandidate {
  hedgeId: string;
  hedgeInstrument: string;
  reason: string;
  exposureReducedType: string;
  exposureReducedValue: number;
  estimatedCostINR: number;
  residualRisk: string;
  confidenceScore: number;
  recommendedQty: number;
}

export interface PortfolioImpactReport {
  candidateStrategyId: string;
  candidateStrategyName: string;
  
  before: {
    grossExposureINR: number;
    netExposureINR: number;
    marginUtilizationPct: number;
    netDelta: number;
    netVega: number;
    overallConcentrationScore: number;
    worstCaseStressLossINR: number;
  };
  
  after: {
    grossExposureINR: number;
    netExposureINR: number;
    marginUtilizationPct: number;
    netDelta: number;
    netVega: number;
    overallConcentrationScore: number;
    worstCaseStressLossINR: number;
  };

  delta: {
    grossExposureDeltaINR: number;
    netExposureDeltaINR: number;
    marginUtilizationDeltaPct: number;
    netDeltaChange: number;
    netVegaChange: number;
    concentrationChangeScore: number;
    stressLossChangeINR: number;
  };

  riskChangeClassification: 'RISK_REDUCING' | 'NEUTRAL_RISK' | 'RISK_INCREMENTAL' | 'RISK_EXCESSIVE';
  capitalChangeINR: number;
}

export interface PositionSizingResult {
  maxAllowedQuantity: number;
  recommendedQuantity: number;
  conservativeQuantity: number;
  limitingFactor: string;
  estimatedCapitalRequiredINR: number;
  estimatedMarginRequiredINR: number;
}

export type PortfolioRiskGateStatus =
  | 'APPROVED'
  | 'APPROVED_REDUCED_SIZE'
  | 'CONDITIONAL'
  | 'HEDGE_REQUIRED'
  | 'REBALANCE_REQUIRED'
  | 'WATCH'
  | 'NO_TRADE'
  | 'EXIT_REQUIRED';

export interface PortfolioRiskGateResult {
  status: PortfolioRiskGateStatus;
  rejectionRulesTriggered: string[];
  warnings: string[];
  rationales: string[];
  passed: boolean;
}

export type PortfolioDecisionType =
  | 'ADD'
  | 'REDUCE'
  | 'HOLD'
  | 'HEDGE'
  | 'REBALANCE'
  | 'CONDITIONAL'
  | 'WATCH'
  | 'NO_TRADE'
  | 'EXIT';

export interface PortfolioDecision {
  schemaVersion: 'v13_portfolio_intelligence';
  decisionId: string;
  candidateStrategyId: string;
  candidateStrategyName: string;
  symbol: string;
  decision: PortfolioDecisionType;
  positionSizing: PositionSizingResult;
  portfolioImpact: 'RISK_REDUCING' | 'NEUTRAL_RISK' | 'RISK_INCREMENTAL' | 'RISK_EXCESSIVE';
  capitalImpactINR: number;
  marginImpactINR: number;
  deltaImpact: number;
  concentrationImpactScore: number;
  stressImpactLossINR: number;
  riskGateStatus: PortfolioRiskGateStatus;
  rationales: string[];
  hedgeRecommendations?: HedgeCandidate[];
  evidenceReferences: Array<{ stage: string; summary: string }>;
  generatedAt: string;
  engineVersion: 'ATHENA_PORTFOLIO_INTELLIGENCE_V13.0';
}
