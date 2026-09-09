/**
 * ATHENA NEWS ENGINE — PHASE 14
 * OrderConstructionEngine.ts
 * 
 * Order Construction Engine.
 * Converts approved ExecutionIntent into multi-leg ExecutionPlan objects
 * and broker-compatible ExecutionOrder objects across Equity, Futures, Options, and Crypto.
 */

import { ExecutionIntent, ExecutionLeg, ExecutionOrder, ExecutionPlan, ExecutionRiskGateResult, ExecutionTacticMode } from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';

export class OrderConstructionEngine {
  private static instance: OrderConstructionEngine;

  private constructor() {}

  public static getInstance(): OrderConstructionEngine {
    if (!this.instance) {
      this.instance = new OrderConstructionEngine();
    }
    return this.instance;
  }

  /**
   * Constructs an ExecutionPlan based on ExecutionIntent and candidate strategy legs.
   */
  public createExecutionPlan(
    intent: ExecutionIntent,
    candidate: CanonicalStrategyCandidate,
    gateResult: ExecutionRiskGateResult,
    tacticMode: ExecutionTacticMode = 'IMMEDIATE'
  ): ExecutionPlan {
    const planId = `plan-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const approvedQty = gateResult.approvedQuantity;
    const legs: ExecutionLeg[] = [];

    // If candidate has multi-leg option structure
    const isOption = candidate.strategyType.startsWith('OPTION_') || candidate.category === 'OPTIONS' || Boolean(candidate.optionsGreeks);
    if (isOption) {
      if (candidate.strategyType === 'OPTION_BULL_CALL_SPREAD' || candidate.strategyType === 'OPTION_BEAR_PUT_SPREAD') {
        const isBull = candidate.strategyType === 'OPTION_BULL_CALL_SPREAD';
        // Leg 1: Main Buy Option Leg
        legs.push({
          legId: `${planId}-leg-1`,
          symbol: `${intent.underlyingSymbol}_${intent.targetPrice}_${isBull ? 'CE' : 'PE'}`,
          underlyingSymbol: intent.underlyingSymbol,
          assetClass: 'OPTIONS',
          side: 'BUY',
          quantity: approvedQty,
          orderType: 'LIMIT',
          targetPrice: intent.targetPrice * 0.05, // Option premium estimate
          optionType: isBull ? 'CALL' : 'PUT',
          strikePrice: intent.targetPrice,
          expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          expectedPrice: intent.targetPrice * 0.05,
          maxSlippagePct: gateResult.maxAllowedSlippagePct
        });

        // Leg 2: OTM Sell Option Leg (Spread)
        const otmStrike = isBull ? intent.targetPrice * 1.03 : intent.targetPrice * 0.97;
        legs.push({
          legId: `${planId}-leg-2`,
          symbol: `${intent.underlyingSymbol}_${Math.round(otmStrike)}_${isBull ? 'CE' : 'PE'}`,
          underlyingSymbol: intent.underlyingSymbol,
          assetClass: 'OPTIONS',
          side: 'SELL',
          quantity: approvedQty,
          orderType: 'LIMIT',
          targetPrice: intent.targetPrice * 0.02,
          optionType: isBull ? 'CALL' : 'PUT',
          strikePrice: Math.round(otmStrike),
          expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          expectedPrice: intent.targetPrice * 0.02,
          maxSlippagePct: gateResult.maxAllowedSlippagePct
        });
      } else if (candidate.strategyType === 'OPTION_IRON_CONDOR') {
        // 4 Legs: Bull Put Spread + Bear Call Spread
        legs.push(
          {
            legId: `${planId}-leg-1`,
            symbol: `${intent.underlyingSymbol}_${Math.round(intent.targetPrice * 0.95)}_PE`,
            underlyingSymbol: intent.underlyingSymbol,
            assetClass: 'OPTIONS',
            side: 'BUY',
            quantity: approvedQty,
            orderType: 'LIMIT',
            targetPrice: intent.targetPrice * 0.015,
            optionType: 'PUT',
            strikePrice: Math.round(intent.targetPrice * 0.95),
            expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            expectedPrice: intent.targetPrice * 0.015,
            maxSlippagePct: gateResult.maxAllowedSlippagePct
          },
          {
            legId: `${planId}-leg-2`,
            symbol: `${intent.underlyingSymbol}_${Math.round(intent.targetPrice * 0.98)}_PE`,
            underlyingSymbol: intent.underlyingSymbol,
            assetClass: 'OPTIONS',
            side: 'SELL',
            quantity: approvedQty,
            orderType: 'LIMIT',
            targetPrice: intent.targetPrice * 0.03,
            optionType: 'PUT',
            strikePrice: Math.round(intent.targetPrice * 0.98),
            expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            expectedPrice: intent.targetPrice * 0.03,
            maxSlippagePct: gateResult.maxAllowedSlippagePct
          },
          {
            legId: `${planId}-leg-3`,
            symbol: `${intent.underlyingSymbol}_${Math.round(intent.targetPrice * 1.02)}_CE`,
            underlyingSymbol: intent.underlyingSymbol,
            assetClass: 'OPTIONS',
            side: 'SELL',
            quantity: approvedQty,
            orderType: 'LIMIT',
            targetPrice: intent.targetPrice * 0.03,
            optionType: 'CALL',
            strikePrice: Math.round(intent.targetPrice * 1.02),
            expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            expectedPrice: intent.targetPrice * 0.03,
            maxSlippagePct: gateResult.maxAllowedSlippagePct
          },
          {
            legId: `${planId}-leg-4`,
            symbol: `${intent.underlyingSymbol}_${Math.round(intent.targetPrice * 1.05)}_CE`,
            underlyingSymbol: intent.underlyingSymbol,
            assetClass: 'OPTIONS',
            side: 'BUY',
            quantity: approvedQty,
            orderType: 'LIMIT',
            targetPrice: intent.targetPrice * 0.015,
            optionType: 'CALL',
            strikePrice: Math.round(intent.targetPrice * 1.05),
            expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            expectedPrice: intent.targetPrice * 0.015,
            maxSlippagePct: gateResult.maxAllowedSlippagePct
          }
        );
      } else {
        // Single option leg
        legs.push({
          legId: `${planId}-leg-1`,
          symbol: `${intent.underlyingSymbol}_${intent.targetPrice}_${candidate.direction === 'SHORT' ? 'PE' : 'CE'}`,
          underlyingSymbol: intent.underlyingSymbol,
          assetClass: 'OPTIONS',
          side: intent.side === 'LONG' || intent.side === 'BUY' ? 'BUY' : 'SELL',
          quantity: approvedQty,
          orderType: intent.orderType,
          targetPrice: intent.targetPrice * 0.04,
          optionType: candidate.direction === 'SHORT' ? 'PUT' : 'CALL',
          strikePrice: intent.targetPrice,
          expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          expectedPrice: intent.targetPrice * 0.04,
          maxSlippagePct: gateResult.maxAllowedSlippagePct
        });
      }
    } else {
      // Standard Equity, Futures, or Crypto single leg
      legs.push({
        legId: `${planId}-leg-1`,
        symbol: intent.symbol,
        underlyingSymbol: intent.underlyingSymbol,
        assetClass: intent.assetClass,
        side: intent.side === 'LONG' || intent.side === 'BUY' ? 'BUY' : 'SELL',
        quantity: approvedQty,
        orderType: intent.orderType,
        targetPrice: intent.targetPrice,
        stopPrice: intent.stopLossPrice,
        expectedPrice: intent.targetPrice,
        maxSlippagePct: gateResult.maxAllowedSlippagePct
      });
    }

    // Capital & Margin estimations
    const totalCapitalRequiredINR = legs.reduce((sum, l) => sum + (l.targetPrice * l.quantity), 0);
    const totalMarginRequiredINR = intent.assetClass === 'EQUITY' ? totalCapitalRequiredINR : totalCapitalRequiredINR * 0.25;
    const maxRiskINR = candidate.optionsGreeks?.maxLoss || (totalCapitalRequiredINR * 0.05);
    const expectedCreditOrDebitINR = legs.length > 1 ? (legs[0].targetPrice - legs[1].targetPrice) * approvedQty : totalCapitalRequiredINR;

    return {
      schemaVersion: 'v14_execution_intelligence',
      planId,
      intentId: intent.executionId,
      strategyId: intent.strategyId,
      candidateStrategyName: candidate.strategyName,
      symbol: intent.symbol,
      direction: candidate.direction,
      legs,
      totalCapitalRequiredINR,
      totalMarginRequiredINR,
      maxRiskINR,
      expectedCreditOrDebitINR,
      tacticMode,
      createdTimestamp: new Date().toISOString()
    };
  }

  /**
   * Constructs broker-compatible ExecutionOrder objects for each leg in an ExecutionPlan.
   */
  public buildOrdersForPlan(plan: ExecutionPlan): ExecutionOrder[] {
    const orders: ExecutionOrder[] = [];

    for (const leg of plan.legs) {
      const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      orders.push({
        orderId,
        planId: plan.planId,
        legId: leg.legId,
        intentId: plan.intentId,
        symbol: leg.symbol,
        underlyingSymbol: leg.underlyingSymbol,
        exchange: leg.assetClass === 'CRYPTO_PERP' ? 'BINANCE' : 'NSE',
        orderType: leg.orderType,
        side: leg.side,
        quantity: leg.quantity,
        filledQuantity: 0,
        remainingQuantity: leg.quantity,
        limitPrice: leg.targetPrice,
        stopPrice: leg.stopPrice,
        timeInForce: 'DAY',
        status: 'CREATED',
        avgFillPrice: 0,
        slippageINR: 0,
        slippagePct: 0,
        implementationShortfallINR: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return orders;
  }
}

export const orderConstructionEngine = OrderConstructionEngine.getInstance();
