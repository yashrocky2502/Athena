/**
 * ATHENA NEWS ENGINE — PHASE 14
 * types.ts
 * 
 * Canonical Versioned Schema: v14_execution_intelligence
 * Defines types for ExecutionIntent, ExecutionPlan, ExecutionOrder,
 * ExecutionRiskGate, Slippage, State Machine, Trade Lifecycle, Reconciliation, and Monitoring.
 */

import { PortfolioDecision } from '../portfolio/types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

export type ExecutionMode = 'PAPER' | 'LIVE' | 'READ_ONLY';

export type ExecutionOrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M' | 'STOP' | 'STOP-LIMIT';
export type TimeInForce = 'DAY' | 'IOC' | 'GTC' | 'FOK';

export type ExecutionRiskGateStatus =
  | 'APPROVED'
  | 'APPROVED_WITH_LIMITS'
  | 'CONDITIONAL'
  | 'BLOCKED'
  | 'EXPIRED'
  | 'CANCEL_REQUIRED';

export type OrderState =
  | 'CREATED'
  | 'VALIDATING'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type ExecutionTacticMode =
  | 'IMMEDIATE'
  | 'PASSIVE_LIMIT'
  | 'AGGRESSIVE_LIMIT'
  | 'VWAP_STYLE'
  | 'STAGED_ENTRY'
  | 'STAGED_EXIT'
  | 'HEDGE_FIRST'
  | 'SPREAD_FIRST';

export type TradeLifecycleState =
  | 'SIGNAL'
  | 'STRATEGY'
  | 'PORTFOLIO_APPROVED'
  | 'EXECUTION_APPROVED'
  | 'ORDER_SUBMITTED'
  | 'FILLED'
  | 'POSITION_ACTIVE'
  | 'EXIT_PENDING'
  | 'CLOSED'
  | 'REJECTED';

export type KillSwitchTrigger =
  | 'NONE'
  | 'GLOBAL_KILL'
  | 'STRATEGY_KILL'
  | 'INSTRUMENT_KILL'
  | 'BROKER_KILL'
  | 'PORTFOLIO_RISK_KILL'
  | 'DATA_STALENESS_KILL'
  | 'LOSS_LIMIT_KILL';

export interface ExecutionIntent {
  schemaVersion: 'v14_execution_intelligence';
  executionId: string;
  strategyId: string;
  portfolioDecisionId: string;
  symbol: string;
  underlyingSymbol: string;
  instrument: string;
  assetClass: 'EQUITY' | 'FUTURES' | 'OPTIONS' | 'CRYPTO_PERP';
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  quantity: number;
  targetPrice: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  orderType: ExecutionOrderType;
  timeInForce: TimeInForce;
  entryRationale: string;
  sourceSignalId: string;
  riskGateStatus: ExecutionRiskGateStatus;
  portfolioGateStatus: string;
  timestamp: string;
  expiry: string;
  confidenceScore: number;
  executionPriority: 'HIGH' | 'MEDIUM' | 'LOW' | 'URGENT';
  mode: ExecutionMode;
}

export interface ExecutionLeg {
  legId: string;
  symbol: string;
  underlyingSymbol: string;
  assetClass: 'EQUITY' | 'FUTURES' | 'OPTIONS' | 'CRYPTO_PERP';
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: ExecutionOrderType;
  targetPrice: number;
  stopPrice?: number;
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expiryDate?: string;
  expectedPrice: number;
  maxSlippagePct: number;
  isHedgeLeg?: boolean;
}

export interface ExecutionPlan {
  schemaVersion: 'v14_execution_intelligence';
  planId: string;
  intentId: string;
  strategyId: string;
  candidateStrategyName: string;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL' | 'BULLISH' | 'BEARISH';
  legs: ExecutionLeg[];
  totalCapitalRequiredINR: number;
  totalMarginRequiredINR: number;
  maxRiskINR: number;
  expectedCreditOrDebitINR: number;
  tacticMode: ExecutionTacticMode;
  stagedEntryConfig?: {
    totalStages: number;
    delayMsBetweenStages: number;
  };
  createdTimestamp: string;
}

export interface ExecutionOrder {
  orderId: string;
  planId: string;
  legId: string;
  intentId: string;
  symbol: string;
  underlyingSymbol: string;
  exchange: string;
  orderType: ExecutionOrderType;
  side: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  limitPrice: number;
  stopPrice?: number;
  triggerPrice?: number;
  timeInForce: TimeInForce;
  status: OrderState;
  avgFillPrice: number;
  slippageINR: number;
  slippagePct: number;
  implementationShortfallINR: number;
  brokerOrderId?: string;
  clientOrderId?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionValidationResult {
  isValid: boolean;
  hardRejection: boolean;
  rejectionReasons: string[];
  warnings: string[];
  validatedAt: string;
  quoteTimestampAgeMs: number;
  marketSessionValid: boolean;
}

export interface ExecutionRiskGateResult {
  status: ExecutionRiskGateStatus;
  requestedQuantity: number;
  approvedQuantity: number;
  maxAllowedSlippagePct: number;
  reasons: string[];
  warnings: string[];
  evaluatedAt: string;
}

export interface ExecutionSlippageReport {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  decisionPrice: number;
  expectedPrice: number;
  actualFillPrice: number;
  absoluteSlippageINR: number;
  slippagePct: number;
  implementationShortfallINR: number;
  fillQualityGrade: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'EXCESSIVE';
}

export interface TradeLifecycleRecord {
  tradeId: string;
  signalId: string;
  strategyId: string;
  portfolioDecisionId: string;
  executionPlanId: string;
  orderIds: string[];
  symbol: string;
  direction: 'LONG' | 'SHORT';
  lifecycleState: TradeLifecycleState;
  entryTimestamp: string;
  exitTimestamp?: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  stopLossPrice?: number;
  targetPrice?: number;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  holdingDurationMs: number;
  realizedPnLINR: number;
  executionQualityScore: number;
  updatedAt: string;
}

export interface ReconciliationMismatch {
  symbol: string;
  expectedQuantity: number;
  brokerQuantity: number;
  quantityDelta: number;
  expectedAvgPrice: number;
  brokerAvgPrice: number;
  priceDelta: number;
  mismatchType: 'QUANTITY_MISMATCH' | 'PRICE_MISMATCH' | 'MISSING_IN_ATHENA' | 'UNEXPECTED_IN_BROKER' | 'ORPHANED_HEDGE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
}

export interface PositionReconciliationReport {
  timestamp: string;
  status: 'IN_SYNC' | 'MISMATCH_DETECTED' | 'ORPHANED_POSITION' | 'UNEXPECTED_BROKER_POSITION';
  totalAthenaPositions: number;
  totalBrokerPositions: number;
  mismatches: ReconciliationMismatch[];
  actionTaken: string;
}

export interface ExecutionKillSwitchStatus {
  active: boolean;
  trigger: KillSwitchTrigger;
  triggeredAt?: string;
  triggeredBy?: string;
  reason?: string;
  blockedOrdersCount: number;
}

export interface ExecutionHealthReport {
  brokerConnected: boolean;
  adapterName: string;
  mode: ExecutionMode;
  totalOrdersSubmitted: number;
  filledOrdersCount: number;
  rejectedOrdersCount: number;
  fillRatePct: number;
  avgOrderLatencyMs: number;
  avgSlippagePct: number;
  rejectionRatePct: number;
  killSwitchStatus: ExecutionKillSwitchStatus;
  lastHealthCheckTimestamp: string;
}

export interface ExecutionAuditRecord {
  auditId: string;
  timestamp: string;
  signal: TransmissionSignalResult;
  candidateStrategy: CanonicalStrategyCandidate;
  portfolioDecision: PortfolioDecision;
  executionIntent: ExecutionIntent;
  validationResult: ExecutionValidationResult;
  riskGateResult: ExecutionRiskGateResult;
  executionPlan: ExecutionPlan;
  orders: ExecutionOrder[];
  fills: { orderId: string; fillPrice: number; fillQty: number; fillTime: string }[];
  positionStateAfter: any;
  lifecycleRecord: TradeLifecycleRecord;
}
