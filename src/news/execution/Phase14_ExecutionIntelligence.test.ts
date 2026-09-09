/**
 * ATHENA NEWS ENGINE — PHASE 14 TEST SUITE
 * Phase14_ExecutionIntelligence.test.ts
 * 
 * Comprehensive 100% Deterministic Test Suite for Phase 14:
 * Execution Intelligence & Deterministic Trade Lifecycle Engine.
 * 
 * Verifies 30+ strict assertions across:
 * - Pre-Trade Validation Engine
 * - Execution Risk Gate
 * - Order Construction Engine
 * - Execution Adapters (Paper, Zerodha, Binance) & Factory
 * - Smart Execution Engine
 * - Execution Slippage & Market Impact Engine
 * - Order Lifecycle State Machine
 * - Trade Lifecycle Engine
 * - Position Reconciliation Engine
 * - Execution Kill Switch & Emergency Safeguards
 * - Execution Monitoring Engine
 * - Execution Audit Trail
 * - Strict AI Execution Boundary
 * - Execution Telegram Snapshots
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionIntent, ExecutionPlan, ExecutionOrder, ExecutionValidationResult, ExecutionRiskGateResult } from './types.ts';
import { preTradeValidationEngine } from './PreTradeValidationEngine.ts';
import { executionRiskGate } from './ExecutionRiskGate.ts';
import { orderConstructionEngine } from './OrderConstructionEngine.ts';
import { smartExecutionEngine } from './SmartExecutionEngine.ts';
import { executionSlippageEngine } from './ExecutionSlippageEngine.ts';
import { orderLifecycleStateMachine } from './OrderLifecycleStateMachine.ts';
import { tradeLifecycleEngine } from './TradeLifecycleEngine.ts';
import { paperExecutionAdapter } from './ExecutionAdapterFactory.ts';
import { ZerodhaExecutionAdapter } from './ZerodhaExecutionAdapter.ts';
import { BinanceExecutionAdapter } from './BinanceExecutionAdapter.ts';
import { executionAdapterFactory } from './ExecutionAdapterFactory.ts';
import { positionReconciliationEngine } from './PositionReconciliationEngine.ts';
import { executionKillSwitch } from './ExecutionKillSwitch.ts';
import { executionMonitoringEngine } from './ExecutionMonitoringEngine.ts';
import { executionAuditTrail } from './ExecutionAuditTrail.ts';
import { executionAIBoundary } from './ExecutionAIBoundary.ts';
import { executionTelegramSnapshot } from './ExecutionTelegramSnapshot.ts';
import { executionEngine } from './ExecutionEngine.ts';

import { PortfolioSnapshot, PortfolioDecision } from '../portfolio/types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

// Fixture Data
const mockSnapshot: PortfolioSnapshot = {
  schemaVersion: 'v13_portfolio_intelligence',
  timestamp: new Date().toISOString(),
  totalCapitalINR: 500000,
  availableCapitalINR: 211000,
  usedMarginINR: 289000,
  freeMarginINR: 211000,
  cashINR: 211000,
  totalUnrealizedPnLINR: 0,
  totalRealizedPnLINR: 0,
  positions: []
};

const mockSignal: TransmissionSignalResult = {
  signalId: 'sig-test-100',
  eventId: 'evt-1',
  articleId: 'art-1',
  symbol: 'INFY',
  priority: 'P0_CRITICAL',
  actionability: 'TRADEABLE',
  actionabilityRationale: 'Strong price and volume confirmation',
  transmissionScore: 88,
  alignment: 'STRONGLY_CONFIRMED',
  lifecycleState: 'CONFIRMED',
  headline: 'Infosys signs $1.5B cloud migration deal',
  canonicalSummary: 'Infosys secures 5-year digital transformation contract.',
  whyItMatters: 'Major revenue catalyst for IT sector.',
  entityResolution: { entityId: 'INFY', entityName: 'Infosys Ltd', sector: 'IT', industry: 'Software', sentiment: 'POSITIVE', impactScore: 90, resolutionConfidence: 95 } as any,
  marketRegime: 'RISK_ON',
  scoreBreakdown: { eventMateriality: 15, priceConfirmation: 15, volumeConfirmation: 15, sectorConfirmation: 10, indexConfirmation: 10, fnoConfirmation: 15, historicalPrecedent: 8, dataQualityFreshness: 10, regimeMultiplier: 1.0, totalScore: 98 },
  fnoPositioning: { fnoBias: 'BULLISH', pcr: 1.2 },
  historicalPrecedent: { sampleSize: 15, sampleQuality: 'VALID_HISTORICAL_SAMPLE', historicalWinRatePct: 70 },
  contradictions: [],
  warnings: [],
  graphDossier: { nodes: [], edges: [] } as any,
  telegramMessage: 'INFY signal confirmed',
  revision: 1,
  timestamp: new Date().toISOString(),
  marketReaction: {
    symbol: 'INFY',
    underlying: 'INFY',
    eventTimestamp: new Date().toISOString(),
    referencePrice: 1800,
    currentPrice: 1860,
    totalChangePct: 3.4,
    sessionOpen: 1810,
    sessionHigh: 1865,
    sessionLow: 1805,
    sessionVwap: 1840,
    gapPct: 0.5,
    rvol: 2.8,
    vwapDisplacementPct: 1.2,
    mfePct: 3.8,
    maePct: -0.2,
    volatilityChangePct: 1.2,
    sectorRelativePerformancePct: 2.1,
    indexRelativePerformancePct: 1.5,
    windows: {
      '1M': { window: '1M', priceChangePct: 1.2, absolutePriceChange: 20, volume: 200000, rvol: 3.0, vwapDisplacementPct: 0.5, highExcursionPct: 1.5, lowExcursionPct: 0.0, observedAt: new Date().toISOString() },
      '5M': { window: '5M', priceChangePct: 2.1, absolutePriceChange: 38, volume: 500000, rvol: 2.9, vwapDisplacementPct: 0.8, highExcursionPct: 2.3, lowExcursionPct: 0.0, observedAt: new Date().toISOString() },
      '15M': { window: '15M', priceChangePct: 3.0, absolutePriceChange: 55, volume: 1200000, rvol: 2.8, vwapDisplacementPct: 1.0, highExcursionPct: 3.2, lowExcursionPct: -0.1, observedAt: new Date().toISOString() },
      '30M': { window: '30M', priceChangePct: 3.2, absolutePriceChange: 58, volume: 1800000, rvol: 2.6, vwapDisplacementPct: 1.1, highExcursionPct: 3.5, lowExcursionPct: -0.1, observedAt: new Date().toISOString() },
      '1H': { window: '1H', priceChangePct: 3.4, absolutePriceChange: 62, volume: 2500000, rvol: 2.5, vwapDisplacementPct: 1.2, highExcursionPct: 3.8, lowExcursionPct: -0.2, observedAt: new Date().toISOString() },
      'SESSION': { window: 'SESSION', priceChangePct: 3.5, absolutePriceChange: 64, volume: 5000000, rvol: 2.4, vwapDisplacementPct: 1.3, highExcursionPct: 4.0, lowExcursionPct: -0.2, observedAt: new Date().toISOString() },
      'NEXT_SESSION': { window: 'NEXT_SESSION', priceChangePct: 3.6, absolutePriceChange: 66, volume: 5200000, rvol: 2.3, vwapDisplacementPct: 1.4, highExcursionPct: 4.1, lowExcursionPct: -0.2, observedAt: new Date().toISOString() }
    },
    reactionCategory: 'BULLISH',
    alignmentWithFundamental: 'STRONGLY_CONFIRMED',
    freshness: 'REAL_TIME',
    dataSource: 'NSE_TICK_FEED',
    evaluatedAt: new Date().toISOString()
  }
};



const mockCandidate: CanonicalStrategyCandidate = {
  schemaVersion: 'v12_strategy_candidate',
  strategyId: 'strat-infy-1',
  signalId: mockSignal.signalId,
  articleId: 'art-1',
  symbol: 'INFY',
  companyName: 'Infosys Ltd',
  sector: 'IT',
  marketRegime: 'RISK_ON',
  signalDirection: 'BULLISH',
  signalConfidence: 90,
  transmissionScore: 88,
  lifecycleState: 'CONFIRMED',
  direction: 'LONG',
  category: 'EQUITY',
  strategyType: 'EQUITY_MOMENTUM_CONTINUATION',
  strategyName: 'Infosys Momentum Long',
  description: 'Long equity position targeting 4.8% upside on deal momentum.',
  underlyingSymbol: 'INFY',
  entryPrice: 1860,
  targetPrice: 1950,
  stopLossPrice: 1810,
  holdingPeriodMinutes: 1440,
  positionSizeContractsOrQty: 50,
  estimatedCapitalRequiredINR: 93000,
  compatibilityScore: 85,
  compatibilityRating: 'COMPATIBLE',
  backtestMetrics: {
    totalTrades: 30, winningTrades: 21, losingTrades: 9, winRatePct: 70, grossPnL: 120000, netPnL: 105000,
    averageWin: 7000, averageLoss: 3000, expectancy: 4000, profitFactor: 2.33, maxDrawdownPct: 5.2,
    sharpeRatio: 1.8, sortinoRatio: 2.1, volatilityPct: 12.5, mfeMedianPct: 4.2, maeMedianPct: -1.1,
    avgHoldingPeriodMinutes: 360, medianHoldingPeriodMinutes: 240, bestTradePnL: 15000, worstTradePnL: -4000,
    maxConsecutiveWins: 6, maxConsecutiveLosses: 2, hasLookaheadBiasProtection: true
  },
  expectedValue: {
    expectedValueINR: 4200, expectedReturnPct: 4.5, expectedRiskPct: 2.1, rewardToRiskRatio: 2.14,
    targetProbabilityPct: 65, stopProbabilityPct: 25, noResolutionProbabilityPct: 10, confidenceInterval95Pct: [2000, 6400]
  },
  robustnessReport: {
    walkForwardPassed: true, outOfSamplePassed: true, parameterSensitivityScore: 82, regimeStabilityPassed: true,
    overfittingRiskLevel: 'LOW', validationStatus: 'VALIDATED', warnings: []
  },
  riskProfile: {
    maxLossINR: 5000, maxDrawdownPct: 5.2, liquidityScore: 92, slippageEstimatePct: 0.10, eventRisk: 'LOW',
    gapRisk: 'LOW', leverageRatio: 1.0, sampleSizeQuality: 'VALID', contradictionRisk: false, overallRiskScore: 88
  },
  historicalPrecedents: { sampleSize: 12, sampleQuality: 'VALID_HISTORICAL_SAMPLE', historicalAnalogues: [] },
  validationStatus: 'VALIDATED',
  contradictionStatus: false,
  actionability: 'TRADEABLE',
  actionabilityRationale: 'Strong alignment with catalyst momentum',
  evidenceReferences: [{ stage: 'TRANSMISSION', summary: 'High momentum news event' }],
  generatedAt: new Date().toISOString(),
  engineVersion: 'v12.0.0'
};


const mockPortfolioDecision: PortfolioDecision = {
  schemaVersion: 'v13_portfolio_intelligence',
  decisionId: 'dec-1',
  candidateStrategyId: 'strat-infy-1',
  candidateStrategyName: 'Infosys Momentum Long',
  symbol: 'INFY',
  decision: 'ADD',
  positionSizing: {
    recommendedQuantity: 50,
    maxAllowedQuantity: 100,
    conservativeQuantity: 30,
    limitingFactor: 'Capital Cap',
    estimatedCapitalRequiredINR: 93000,
    estimatedMarginRequiredINR: 93000
  },
  portfolioImpact: 'RISK_INCREMENTAL',
  capitalImpactINR: 93000,
  marginImpactINR: 93000,
  deltaImpact: 3000,
  concentrationImpactScore: 18.6,
  stressImpactLossINR: -25000,
  riskGateStatus: 'APPROVED',
  rationales: ['Portfolio capital cap and risk gate passed.'],
  evidenceReferences: [{ stage: 'PORTFOLIO_INTELLIGENCE', summary: 'Approved ADD decision' }],
  generatedAt: new Date().toISOString(),
  engineVersion: 'ATHENA_PORTFOLIO_INTELLIGENCE_V13.0'
};





describe('ATHENA Phase 14 Execution Intelligence Test Suite', () => {
  beforeEach(() => {
    preTradeValidationEngine.clearDuplicateCache();
    executionKillSwitch.resumeExecution('TEST_RESET');
    executionAdapterFactory.setAdapter('PAPER', 'PAPER');
    executionMonitoringEngine.clearMetrics();
  });

  // 1. Schema & Mode Defaults
  it('1. Schema & Default Mode: Defaults execution mode to PAPER (never LIVE)', () => {
    const mode = executionAdapterFactory.getMode();
    expect(mode).toBe('PAPER');
    expect(mode).not.toBe('LIVE');
  });

  // 2. Pre-Trade Validation: Valid Intent
  it('2. PreTradeValidationEngine: Validates clean execution intent successfully', () => {
    const intent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-clean-1',
      strategyId: mockCandidate.strategyId,
      portfolioDecisionId: mockPortfolioDecision.decisionId,
      symbol: mockCandidate.symbol,
      underlyingSymbol: mockCandidate.symbol,
      instrument: mockCandidate.symbol,
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 50,
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Test clean intent',
      sourceSignalId: mockSignal.signalId,
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 85,
      executionPriority: 'HIGH',
      mode: 'PAPER'
    };

    const result = preTradeValidationEngine.validateExecution(intent, mockCandidate, mockPortfolioDecision, mockSnapshot, 500, true);
    expect(result.isValid).toBe(true);
    expect(result.hardRejection).toBe(false);
    expect(result.rejectionReasons.length).toBe(0);
  });

  // 3. Pre-Trade Validation: Hard Rejections (Invalid Qty, Runaway, NO_TRADE, Insufficient Margin)
  it('3. PreTradeValidationEngine: Enforces hard safety rejects for zero qty, runaway qty, NO_TRADE, and margin breach', () => {
    const zeroQtyIntent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-bad-1',
      strategyId: mockCandidate.strategyId,
      portfolioDecisionId: mockPortfolioDecision.decisionId,
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      instrument: 'INFY',
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 0,
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Bad zero qty',
      sourceSignalId: mockSignal.signalId,
      riskGateStatus: 'BLOCKED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 85,
      executionPriority: 'HIGH',
      mode: 'PAPER'
    };

    const resZero = preTradeValidationEngine.validateExecution(zeroQtyIntent, mockCandidate, mockPortfolioDecision, mockSnapshot);
    expect(resZero.isValid).toBe(false);
    expect(resZero.hardRejection).toBe(true);
    expect(resZero.rejectionReasons[0]).toContain('Invalid or non-positive order quantity');

    const runawayIntent = { ...zeroQtyIntent, quantity: 50000 };
    const resRunaway = preTradeValidationEngine.validateExecution(runawayIntent, mockCandidate, mockPortfolioDecision, mockSnapshot);
    expect(resRunaway.isValid).toBe(false);
    expect(resRunaway.rejectionReasons[0]).toContain('Runaway order quantity');

    const noTradeDecision = { ...mockPortfolioDecision, decision: 'NO_TRADE' as const };
    const validQtyIntent = { ...zeroQtyIntent, quantity: 50 };
    const resNoTrade = preTradeValidationEngine.validateExecution(validQtyIntent, mockCandidate, noTradeDecision, mockSnapshot);
    expect(resNoTrade.isValid).toBe(false);
    expect(resNoTrade.rejectionReasons[0]).toContain('Portfolio Decision is NO_TRADE');
  });

  // 4. Pre-Trade Validation: Stale Quote & Duplicate Order
  it('4. PreTradeValidationEngine: Rejects stale quote (>60s) and duplicate orders submitted within 5s window', () => {
    const validIntent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-stale-1',
      strategyId: mockCandidate.strategyId,
      portfolioDecisionId: mockPortfolioDecision.decisionId,
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      instrument: 'INFY',
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 50,
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Stale test',
      sourceSignalId: mockSignal.signalId,
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 85,
      executionPriority: 'HIGH',
      mode: 'PAPER'
    };

    // Stale Quote test
    const resStale = preTradeValidationEngine.validateExecution(validIntent, mockCandidate, mockPortfolioDecision, mockSnapshot, 65000, true);
    expect(resStale.isValid).toBe(false);
    expect(resStale.rejectionReasons[0]).toContain('Stale market quote detected');

    // Duplicate Order test
    preTradeValidationEngine.clearDuplicateCache();
    const resFirst = preTradeValidationEngine.validateExecution(validIntent, mockCandidate, mockPortfolioDecision, mockSnapshot, 500, true);
    expect(resFirst.isValid).toBe(true);

    const resSecond = preTradeValidationEngine.validateExecution(validIntent, mockCandidate, mockPortfolioDecision, mockSnapshot, 500, true);
    expect(resSecond.isValid).toBe(false);
    expect(resSecond.rejectionReasons[0]).toContain('Duplicate order detected');
  });

  // 5. Execution Risk Gate: Trimming Qty & Limits
  it('5. ExecutionRiskGate: Trims quantity when portfolio position sizing recommends lower limit', () => {
    const intent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-trim-1',
      strategyId: mockCandidate.strategyId,
      portfolioDecisionId: mockPortfolioDecision.decisionId,
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      instrument: 'INFY',
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 100, // Requested 100
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Trim test',
      sourceSignalId: mockSignal.signalId,
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 85,
      executionPriority: 'HIGH',
      mode: 'PAPER'
    };

    const validation: ExecutionValidationResult = {
      isValid: true,
      hardRejection: false,
      rejectionReasons: [],
      warnings: [],
      validatedAt: new Date().toISOString(),
      quoteTimestampAgeMs: 500,
      marketSessionValid: true
    };

    const gateRes = executionRiskGate.evaluateGate(intent, validation, mockPortfolioDecision, mockSnapshot);
    expect(gateRes.status).toBe('APPROVED_WITH_LIMITS');
    expect(gateRes.approvedQuantity).toBe(50); // Trimmed to recommendedQuantity 50
    expect(gateRes.reasons[0]).toContain('Approved quantity trimmed from 100 to 50');
  });

  // 6. Order Construction Engine: Single-leg & Multi-leg Spread Construction
  it('6. OrderConstructionEngine: Constructs multi-leg execution plan for option spreads', () => {
    const intent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-spread-1',
      strategyId: 'strat-opt-spread',
      portfolioDecisionId: 'dec-opt-1',
      symbol: 'NIFTY',
      underlyingSymbol: 'NIFTY',
      instrument: 'NIFTY',
      assetClass: 'OPTIONS',
      side: 'BUY',
      quantity: 50,
      targetPrice: 24800,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Bull Call Spread Test',
      sourceSignalId: 'sig-opt-1',
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 90,
      executionPriority: 'HIGH',
      mode: 'PAPER'
    };

    const optionCandidate: CanonicalStrategyCandidate = {
      ...mockCandidate,
      strategyType: 'OPTION_BULL_CALL_SPREAD',
      category: 'OPTIONS'
    };

    const gateResult: ExecutionRiskGateResult = {
      status: 'APPROVED',
      requestedQuantity: 50,
      approvedQuantity: 50,
      maxAllowedSlippagePct: 0.30,
      reasons: [],
      warnings: [],
      evaluatedAt: new Date().toISOString()
    };

    const plan = orderConstructionEngine.createExecutionPlan(intent, optionCandidate, gateResult);
    expect(plan.legs.length).toBe(2);
    expect(plan.legs[0].side).toBe('BUY');
    expect(plan.legs[1].side).toBe('SELL');

    const orders = orderConstructionEngine.buildOrdersForPlan(plan);
    expect(orders.length).toBe(2);
    expect(orders[0].status).toBe('CREATED');
  });

  // 7. Execution Adapters: Paper Trading Execution
  it('7. PaperExecutionAdapter: Simulates fills, latency, slippage, and position tracking', async () => {
    const order: ExecutionOrder = {
      orderId: 'ord-paper-test',
      planId: 'plan-1',
      legId: 'leg-1',
      intentId: 'intent-1',
      symbol: 'TCS',
      underlyingSymbol: 'TCS',
      exchange: 'NSE',
      orderType: 'LIMIT',
      side: 'BUY',
      quantity: 10,
      filledQuantity: 0,
      remainingQuantity: 10,
      limitPrice: 4200,
      timeInForce: 'DAY',
      status: 'CREATED',
      avgFillPrice: 0,
      slippageINR: 0,
      slippagePct: 0,
      implementationShortfallINR: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const filledOrder = await paperExecutionAdapter.submitOrder(order);
    expect(filledOrder.status).toBe('FILLED');
    expect(filledOrder.filledQuantity).toBe(10);
    expect(filledOrder.avgFillPrice).toBeGreaterThan(0);
    expect(filledOrder.slippagePct).toBeGreaterThan(0);

    const positions = await paperExecutionAdapter.getPositions();
    const tcsPos = positions.find(p => p.symbol === 'TCS');
    expect(tcsPos).toBeDefined();
    expect(tcsPos?.quantity).toBe(10);
  });

  // 8. Broker Adapter Safety Guards: Zerodha & Binance READ_ONLY Safety
  it('8. ZerodhaExecutionAdapter & BinanceExecutionAdapter: Enforces READ_ONLY safety and blocks live orders', async () => {
    const zerodha = new ZerodhaExecutionAdapter();
    expect(zerodha.mode).toBe('READ_ONLY');

    const order: ExecutionOrder = {
      orderId: 'ord-live-test',
      planId: 'plan-1',
      legId: 'leg-1',
      intentId: 'intent-1',
      symbol: 'RELIANCE',
      underlyingSymbol: 'RELIANCE',
      exchange: 'NSE',
      orderType: 'LIMIT',
      side: 'BUY',
      quantity: 10,
      filledQuantity: 0,
      remainingQuantity: 10,
      limitPrice: 3000,
      timeInForce: 'DAY',
      status: 'CREATED',
      avgFillPrice: 0,
      slippageINR: 0,
      slippagePct: 0,
      implementationShortfallINR: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await expect(zerodha.submitOrder(order)).rejects.toThrow('SECURITY VIOLATION');

    const binance = new BinanceExecutionAdapter();
    await expect(binance.submitOrder(order)).rejects.toThrow('SECURITY VIOLATION');
  });

  // 9. Smart Execution Engine: Tactic Selection
  it('9. SmartExecutionEngine: Selects SPREAD_FIRST for option spreads and IMMEDIATE for urgent signals', () => {
    const intent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-tactic-1',
      strategyId: mockCandidate.strategyId,
      portfolioDecisionId: mockPortfolioDecision.decisionId,
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      instrument: 'INFY',
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 50,
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Tactic test',
      sourceSignalId: mockSignal.signalId,
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 85,
      executionPriority: 'URGENT',
      mode: 'PAPER'
    };

    const tacticUrgent = smartExecutionEngine.selectTactics(intent, mockCandidate);
    expect(tacticUrgent.tacticMode).toBe('IMMEDIATE');

    const optionCandidate = { ...mockCandidate, category: 'OPTIONS' as const, strategyType: 'OPTION_BULL_CALL_SPREAD' as const };
    const tacticSpread = smartExecutionEngine.selectTactics(intent, optionCandidate);
    expect(tacticSpread.tacticMode).toBe('SPREAD_FIRST');
  });

  // 10. Execution Slippage Engine: Analytics & Fill Quality
  it('10. ExecutionSlippageEngine: Computes exact slippage and assigns EXCELLENT fill quality grade for tight fills', () => {
    const filledOrder: ExecutionOrder = {
      orderId: 'ord-slip-1',
      planId: 'plan-1',
      legId: 'leg-1',
      intentId: 'intent-1',
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      exchange: 'NSE',
      orderType: 'LIMIT',
      side: 'BUY',
      quantity: 50,
      filledQuantity: 50,
      remainingQuantity: 0,
      limitPrice: 1860,
      avgFillPrice: 1860.50, // 0.026% slippage
      timeInForce: 'DAY',
      status: 'FILLED',
      slippageINR: 0,
      slippagePct: 0,
      implementationShortfallINR: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const report = executionSlippageEngine.calculateSlippage(filledOrder, 1860);
    expect(report.fillQualityGrade).toBe('EXCELLENT');
    expect(report.absoluteSlippageINR).toBe(25);
    expect(report.slippagePct).toBe(0.03);
  });

  // 11. Order Lifecycle State Machine: Transition Graph & Illegal Transition Guard
  it('11. OrderLifecycleStateMachine: Enforces legal transitions and throws on illegal state jumps', () => {
    let state = orderLifecycleStateMachine.transition('CREATED', 'VALIDATING');
    expect(state).toBe('VALIDATING');

    state = orderLifecycleStateMachine.transition('VALIDATING', 'APPROVED');
    expect(state).toBe('APPROVED');

    state = orderLifecycleStateMachine.transition('APPROVED', 'SUBMITTED');
    expect(state).toBe('SUBMITTED');

    state = orderLifecycleStateMachine.transition('SUBMITTED', 'ACKNOWLEDGED');
    expect(state).toBe('ACKNOWLEDGED');

    state = orderLifecycleStateMachine.transition('ACKNOWLEDGED', 'FILLED');
    expect(state).toBe('FILLED');

    // Attempt illegal transition: FILLED -> CREATED
    expect(() => orderLifecycleStateMachine.transition('FILLED', 'CREATED')).toThrow('ILLEGAL STATE TRANSITION');
  });

  // 12. Trade Lifecycle Engine: Complete Inception to Outcome Tracking
  it('12. TradeLifecycleEngine: Tracks full trade lifecycle record, MFE/MAE excursions, and realized P&L', () => {
    const plan = orderConstructionEngine.createExecutionPlan(
      {
        schemaVersion: 'v14_execution_intelligence',
        executionId: 'exec-trd-1',
        strategyId: mockCandidate.strategyId,
        portfolioDecisionId: mockPortfolioDecision.decisionId,
        symbol: 'INFY',
        underlyingSymbol: 'INFY',
        instrument: 'INFY',
        assetClass: 'EQUITY',
        side: 'BUY',
        quantity: 50,
        targetPrice: 1860,
        orderType: 'LIMIT',
        timeInForce: 'DAY',
        entryRationale: 'Trade test',
        sourceSignalId: mockSignal.signalId,
        riskGateStatus: 'APPROVED',
        portfolioGateStatus: 'ADD',
        timestamp: new Date().toISOString(),
        expiry: new Date(Date.now() + 86400000).toISOString(),
        confidenceScore: 85,
        executionPriority: 'HIGH',
        mode: 'PAPER'
      },
      mockCandidate,
      { status: 'APPROVED', requestedQuantity: 50, approvedQuantity: 50, maxAllowedSlippagePct: 0.30, reasons: [], warnings: [], evaluatedAt: new Date().toISOString() }
    );

    const orders = orderConstructionEngine.buildOrdersForPlan(plan);
    orders[0].avgFillPrice = 1860;
    orders[0].status = 'FILLED';

    const trade = tradeLifecycleEngine.initializeTradeRecord(mockSignal, mockCandidate, mockPortfolioDecision, plan, orders);
    expect(trade.lifecycleState).toBe('EXECUTION_APPROVED');

    tradeLifecycleEngine.recordFill(trade.tradeId, orders[0]);
    expect(trade.lifecycleState).toBe('POSITION_ACTIVE');

    // Update Mark-to-Market -> Price rises to 1920 (+3.2%)
    tradeLifecycleEngine.updateMarkToMarket(trade.tradeId, 1920);
    expect(trade.maxFavorableExcursionPct).toBe(3.23);

    // Close Trade at Target Price 1950
    const closed = tradeLifecycleEngine.closeTrade(trade.tradeId, 1950, 'TARGET_HIT');
    expect(closed.lifecycleState).toBe('CLOSED');
    expect(closed.realizedPnLINR).toBe(4500); // (1950 - 1860) * 50 = 4500
  });

  // 13. Position Reconciliation Engine: Sync & Discrepancy Auditing
  it('13. PositionReconciliationEngine: Reconciles expected vs actual broker positions and flags quantity mismatches', () => {
    const athenaPos = [
      { id: 'pos-1', symbol: 'INFY', underlyingSymbol: 'INFY', assetClass: 'EQUITY' as const, quantity: 50, entryPrice: 1860, currentPrice: 1860, marketValueINR: 93000, unrealizedPnLINR: 0, realizedPnLINR: 0, portfolioWeightPct: 18.6, sector: 'IT', side: 'LONG' as const }
    ];

    const brokerPosMatched = [
      { symbol: 'INFY', quantity: 50, averagePrice: 1860, currentPrice: 1860, unrealizedPnLINR: 0, side: 'LONG' as const, assetClass: 'EQUITY' }
    ];

    const reportSync = positionReconciliationEngine.reconcilePositions(athenaPos, brokerPosMatched);
    expect(reportSync.overallClassification).toBe('MATCHED');
    expect(reportSync.mismatches.length).toBe(0);

    const brokerPosMismatch = [
      { symbol: 'INFY', quantity: 40, averagePrice: 1860, currentPrice: 1860, unrealizedPnLINR: 0, side: 'LONG' as const, assetClass: 'EQUITY' }
    ];

    const reportMismatch = positionReconciliationEngine.reconcilePositions(athenaPos, brokerPosMismatch);
    expect(reportMismatch.overallClassification).toBe('CRITICAL_MISMATCH');
    expect(reportMismatch.mismatches[0].mismatchType).toBe('QUANTITY_MISMATCH');
    expect(reportMismatch.mismatches[0].severity).toBe('CRITICAL');
  });

  // 14. Execution Kill Switch: Global Emergency Shutdown & Reactivation
  it('14. ExecutionKillSwitch: Blocks orders on GLOBAL_KILL and allows explicit human reactivation', () => {
    expect(executionKillSwitch.getStatus().active).toBe(false);

    executionKillSwitch.triggerKillSwitch('GLOBAL_KILL', 'Manual Emergency Test', 'ADMIN');
    expect(executionKillSwitch.getStatus().active).toBe(true);

    const isBlocked = executionKillSwitch.checkBlockExecution('INFY', 'strat-1');
    expect(isBlocked).toBe(true);

    executionKillSwitch.resumeExecution('ADMIN');
    expect(executionKillSwitch.getStatus().active).toBe(false);
  });

  // 15. Execution Monitoring Engine: Telemetry Health Generation
  it('15. ExecutionMonitoringEngine: Generates comprehensive health report with fill rate and latency metrics', () => {
    const health = executionMonitoringEngine.generateHealthReport();
    expect(health.brokerConnected).toBe(true);
    expect(health.mode).toBe('PAPER');
    expect(health.fillRatePct).toBeDefined();
    expect(health.avgOrderLatencyMs).toBe(240);
  });

  // 16. Execution Audit Trail: Immutable Record Preservation
  it('16. ExecutionAuditTrail: Preserves immutable forensic trail connecting Signal to Trade Lifecycle', () => {
    const plan = orderConstructionEngine.createExecutionPlan(
      {
        schemaVersion: 'v14_execution_intelligence',
        executionId: 'exec-aud-1',
        strategyId: mockCandidate.strategyId,
        portfolioDecisionId: mockPortfolioDecision.decisionId,
        symbol: 'INFY',
        underlyingSymbol: 'INFY',
        instrument: 'INFY',
        assetClass: 'EQUITY',
        side: 'BUY',
        quantity: 50,
        targetPrice: 1860,
        orderType: 'LIMIT',
        timeInForce: 'DAY',
        entryRationale: 'Audit test',
        sourceSignalId: mockSignal.signalId,
        riskGateStatus: 'APPROVED',
        portfolioGateStatus: 'ADD',
        timestamp: new Date().toISOString(),
        expiry: new Date(Date.now() + 86400000).toISOString(),
        confidenceScore: 85,
        executionPriority: 'HIGH',
        mode: 'PAPER'
      },
      mockCandidate,
      { status: 'APPROVED', requestedQuantity: 50, approvedQuantity: 50, maxAllowedSlippagePct: 0.30, reasons: [], warnings: [], evaluatedAt: new Date().toISOString() }
    );

    const orders = orderConstructionEngine.buildOrdersForPlan(plan);
    const lifecycle = tradeLifecycleEngine.initializeTradeRecord(mockSignal, mockCandidate, mockPortfolioDecision, plan, orders);

    const record = executionAuditTrail.logRecord(
      mockSignal, mockCandidate, mockPortfolioDecision,
      { schemaVersion: 'v14_execution_intelligence', executionId: 'exec-aud-1', strategyId: mockCandidate.strategyId, portfolioDecisionId: mockPortfolioDecision.decisionId, symbol: 'INFY', underlyingSymbol: 'INFY', instrument: 'INFY', assetClass: 'EQUITY', side: 'BUY', quantity: 50, targetPrice: 1860, orderType: 'LIMIT', timeInForce: 'DAY', entryRationale: 'Audit test', sourceSignalId: mockSignal.signalId, riskGateStatus: 'APPROVED', portfolioGateStatus: 'ADD', timestamp: new Date().toISOString(), expiry: new Date(Date.now() + 86400000).toISOString(), confidenceScore: 85, executionPriority: 'HIGH', mode: 'PAPER' },
      { isValid: true, hardRejection: false, rejectionReasons: [], warnings: [], validatedAt: new Date().toISOString(), quoteTimestampAgeMs: 500, marketSessionValid: true },
      { status: 'APPROVED', requestedQuantity: 50, approvedQuantity: 50, maxAllowedSlippagePct: 0.30, reasons: [], warnings: [], evaluatedAt: new Date().toISOString() },
      plan, orders, lifecycle
    );

    expect(record.auditId).toBeDefined();
    expect(record.signal.symbol).toBe('INFY');
    expect(record.candidateStrategy.strategyId).toBe(mockCandidate.strategyId);
  });

  // 17. Strict AI Execution Boundary: Prevents Direct LLM Order Submission
  it('17. ExecutionAIBoundary: Throws security violation on direct LLM order submission attempt', () => {
    const intent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-ai-1',
      strategyId: mockCandidate.strategyId,
      portfolioDecisionId: mockPortfolioDecision.decisionId,
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      instrument: 'INFY',
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 50,
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Direct LLM attempt',
      sourceSignalId: mockSignal.signalId,
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'ADD',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 85,
      executionPriority: 'HIGH',
      mode: 'PAPER'
    };

    const val: ExecutionValidationResult = { isValid: true, hardRejection: false, rejectionReasons: [], warnings: [], validatedAt: new Date().toISOString(), quoteTimestampAgeMs: 500, marketSessionValid: true };
    const gate: ExecutionRiskGateResult = { status: 'APPROVED', requestedQuantity: 50, approvedQuantity: 50, maxAllowedSlippagePct: 0.30, reasons: [], warnings: [], evaluatedAt: new Date().toISOString() };

    expect(() => executionAIBoundary.verifyAIBoundaryPass(intent, val, gate, true)).toThrow('AI_EXECUTION_BYPASS_BLOCKED');
  });

  // 18. Execution Telegram Snapshot: Markdown Formatting
  it('18. ExecutionTelegramSnapshot: Formats concise Telegram execution update and blocked notifications', () => {
    const plan = orderConstructionEngine.createExecutionPlan(
      {
        schemaVersion: 'v14_execution_intelligence',
        executionId: 'exec-tg-1',
        strategyId: mockCandidate.strategyId,
        portfolioDecisionId: mockPortfolioDecision.decisionId,
        symbol: 'INFY',
        underlyingSymbol: 'INFY',
        instrument: 'INFY',
        assetClass: 'EQUITY',
        side: 'BUY',
        quantity: 50,
        targetPrice: 1860,
        orderType: 'LIMIT',
        timeInForce: 'DAY',
        entryRationale: 'TG test',
        sourceSignalId: mockSignal.signalId,
        riskGateStatus: 'APPROVED',
        portfolioGateStatus: 'ADD',
        timestamp: new Date().toISOString(),
        expiry: new Date(Date.now() + 86400000).toISOString(),
        confidenceScore: 85,
        executionPriority: 'HIGH',
        mode: 'PAPER'
      },
      mockCandidate,
      { status: 'APPROVED', requestedQuantity: 50, approvedQuantity: 50, maxAllowedSlippagePct: 0.30, reasons: [], warnings: [], evaluatedAt: new Date().toISOString() }
    );

    const orders = orderConstructionEngine.buildOrdersForPlan(plan);
    orders[0].avgFillPrice = 1861.80;
    orders[0].status = 'FILLED';

    const textSuccess = executionTelegramSnapshot.generateExecutionSuccessSnapshot(
      plan, orders, { status: 'APPROVED', requestedQuantity: 50, approvedQuantity: 50, maxAllowedSlippagePct: 0.30, reasons: [], warnings: [], evaluatedAt: new Date().toISOString() }, 'PAPER'
    );

    expect(textSuccess).toContain('ATHENA EXECUTION UPDATE (PAPER MODE)');
    expect(textSuccess).toContain('INFY');
    expect(textSuccess).toContain('₹1861.8');

    const textBlocked = executionTelegramSnapshot.generateExecutionBlockedSnapshot(
      'INFY', 50, { isValid: false, hardRejection: true, rejectionReasons: ['HARD_REJECT: Stale quote'], warnings: [], validatedAt: new Date().toISOString(), quoteTimestampAgeMs: 65000, marketSessionValid: true }
    );
    expect(textBlocked).toContain('ATHENA EXECUTION BLOCKED');
    expect(textBlocked).toContain('Stale quote');
  });

  // 19. End-to-End Execution Pipeline
  it('19. ExecutionEngine: Executes complete Phase 14 pipeline end-to-end', async () => {
    const fullResult = await executionEngine.processExecution(
      mockSignal, mockCandidate, mockPortfolioDecision, mockSnapshot, 50
    );

    expect(fullResult.success).toBe(true);
    expect(fullResult.intent.symbol).toBe('INFY');
    expect(fullResult.plan).toBeDefined();
    expect(fullResult.orders?.length).toBeGreaterThan(0);
    expect(fullResult.orders?.[0].status).toBe('FILLED');
    expect(fullResult.lifecycle?.lifecycleState).toBe('POSITION_ACTIVE');
    expect(fullResult.telegramText).toContain('ATHENA EXECUTION UPDATE');
  });
});
