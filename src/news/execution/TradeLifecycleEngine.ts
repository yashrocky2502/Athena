/**
 * ATHENA NEWS ENGINE — PHASE 14
 * TradeLifecycleEngine.ts
 * 
 * Trade Lifecycle Engine.
 * Connects Signal (Phase 11) -> Strategy (Phase 12) -> Portfolio (Phase 13) -> Execution & Position (Phase 14) -> Outcome.
 * Tracks trade lifecycle records, holding duration, MFE/MAE excursions, and realized P&L.
 */

import { TradeLifecycleRecord, TradeLifecycleState, ExecutionOrder, ExecutionPlan } from './types.ts';
import { PortfolioDecision } from '../portfolio/types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

export class TradeLifecycleEngine {
  private static instance: TradeLifecycleEngine;
  private activeTrades: Map<string, TradeLifecycleRecord> = new Map();
  private closedTrades: Map<string, TradeLifecycleRecord> = new Map();

  private constructor() {}

  public static getInstance(): TradeLifecycleEngine {
    if (!this.instance) {
      this.instance = new TradeLifecycleEngine();
    }
    return this.instance;
  }

  /**
   * Initializes a TradeLifecycleRecord when an execution plan is approved.
   */
  public initializeTradeRecord(
    signal: TransmissionSignalResult,
    candidate: CanonicalStrategyCandidate,
    decision: PortfolioDecision,
    plan: ExecutionPlan,
    orders: ExecutionOrder[]
  ): TradeLifecycleRecord {
    const tradeId = `trd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const record: TradeLifecycleRecord = {
      tradeId,
      signalId: signal.signalId,
      strategyId: candidate.strategyId,
      portfolioDecisionId: decision.decisionId,
      executionPlanId: plan.planId,
      orderIds: orders.map(o => o.orderId),
      symbol: candidate.symbol,
      direction: candidate.direction === 'SHORT' ? 'SHORT' : 'LONG',
      lifecycleState: 'EXECUTION_APPROVED',
      entryTimestamp: now,
      entryPrice: candidate.entryPrice || plan.legs[0]?.targetPrice || 0,
      quantity: plan.legs[0]?.quantity || 1,
      stopLossPrice: candidate.stopLossPrice,
      targetPrice: candidate.targetPrice,
      maxFavorableExcursionPct: 0,
      maxAdverseExcursionPct: 0,
      holdingDurationMs: 0,
      realizedPnLINR: 0,
      executionQualityScore: 95,
      updatedAt: now
    };

    this.activeTrades.set(tradeId, record);
    return record;
  }

  /**
   * Updates trade record when orders fill.
   */
  public recordFill(tradeId: string, order: ExecutionOrder): TradeLifecycleRecord {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    trade.lifecycleState = 'FILLED';
    trade.entryPrice = order.avgFillPrice || trade.entryPrice;
    trade.updatedAt = new Date().toISOString();

    // Transition to POSITION_ACTIVE
    trade.lifecycleState = 'POSITION_ACTIVE';
    this.activeTrades.set(tradeId, trade);
    return trade;
  }

  /**
   * Updates MFE / MAE as mark-to-market prices evolve.
   */
  public updateMarkToMarket(tradeId: string, currentPrice: number): TradeLifecycleRecord {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return null as any;

    const returnPct = trade.direction === 'LONG'
      ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

    if (returnPct > trade.maxFavorableExcursionPct) {
      trade.maxFavorableExcursionPct = Number(returnPct.toFixed(2));
    }
    if (returnPct < trade.maxAdverseExcursionPct) {
      trade.maxAdverseExcursionPct = Number(returnPct.toFixed(2));
    }

    trade.updatedAt = new Date().toISOString();
    return trade;
  }

  /**
   * Closes out active trade and records realized P&L.
   */
  public closeTrade(tradeId: string, exitPrice: number, exitReason: string = 'TARGET_HIT'): TradeLifecycleRecord {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    const exitTime = new Date().toISOString();
    const entryTimeMs = new Date(trade.entryTimestamp).getTime();
    const exitTimeMs = new Date(exitTime).getTime();

    trade.exitTimestamp = exitTime;
    trade.exitPrice = exitPrice;
    trade.holdingDurationMs = exitTimeMs - entryTimeMs;

    const priceDiff = trade.direction === 'LONG' ? (exitPrice - trade.entryPrice) : (trade.entryPrice - exitPrice);
    trade.realizedPnLINR = Number((priceDiff * trade.quantity).toFixed(2));
    trade.lifecycleState = 'CLOSED';
    trade.updatedAt = exitTime;

    this.activeTrades.delete(tradeId);
    this.closedTrades.set(tradeId, trade);
    return trade;
  }

  public getActiveTrades(): TradeLifecycleRecord[] {
    return Array.from(this.activeTrades.values());
  }

  public getClosedTrades(): TradeLifecycleRecord[] {
    return Array.from(this.closedTrades.values());
  }

  public getTrade(tradeId: string): TradeLifecycleRecord | undefined {
    return this.activeTrades.get(tradeId) || this.closedTrades.get(tradeId);
  }
}

export const tradeLifecycleEngine = TradeLifecycleEngine.getInstance();
