/**
 * ATHENA NEWS ENGINE — PHASE 14
 * ExecutionSlippageEngine.ts
 * 
 * Execution Slippage & Market Impact Engine.
 * Measures Decision Price vs Target Price vs Actual Fill Price, computes implementation shortfall,
 * and assigns fill quality grades (EXCELLENT, GOOD, ACCEPTABLE, POOR, EXCESSIVE).
 * 
 * ZERO-AI COST CONTRACT: 100% mathematical analytics.
 */

import { ExecutionOrder, ExecutionSlippageReport } from './types.ts';

export class ExecutionSlippageEngine {
  private static instance: ExecutionSlippageEngine;

  private constructor() {}

  public static getInstance(): ExecutionSlippageEngine {
    if (!this.instance) {
      this.instance = new ExecutionSlippageEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates order execution fill quality and calculates exact slippage metrics.
   */
  public calculateSlippage(
    order: ExecutionOrder,
    decisionPrice?: number
  ): ExecutionSlippageReport {
    const basePrice = decisionPrice || order.limitPrice;
    const expectedPrice = order.limitPrice;
    const actualFillPrice = order.avgFillPrice || order.limitPrice;

    // Absolute slippage
    const isBuy = order.side === 'BUY';
    const priceDiff = isBuy ? (actualFillPrice - expectedPrice) : (expectedPrice - actualFillPrice);
    const absoluteSlippageINR = Number((Math.max(0, priceDiff) * order.filledQuantity).toFixed(2));
    const slippagePct = Number((basePrice > 0 ? (priceDiff / basePrice) * 100 : 0).toFixed(2));

    // Implementation shortfall
    const shortfallPriceDiff = isBuy ? (actualFillPrice - basePrice) : (basePrice - actualFillPrice);
    const implementationShortfallINR = Number((shortfallPriceDiff * order.filledQuantity).toFixed(2));

    // Fill Quality Grading
    let fillQualityGrade: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'EXCESSIVE' = 'EXCELLENT';
    const absSlippagePct = Math.abs(slippagePct);

    if (absSlippagePct <= 0.05) {
      fillQualityGrade = 'EXCELLENT';
    } else if (absSlippagePct <= 0.15) {
      fillQualityGrade = 'GOOD';
    } else if (absSlippagePct <= 0.30) {
      fillQualityGrade = 'ACCEPTABLE';
    } else if (absSlippagePct <= 0.50) {
      fillQualityGrade = 'POOR';
    } else {
      fillQualityGrade = 'EXCESSIVE';
    }

    return {
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      decisionPrice: basePrice,
      expectedPrice,
      actualFillPrice,
      absoluteSlippageINR,
      slippagePct,
      implementationShortfallINR,
      fillQualityGrade
    };
  }
}

export const executionSlippageEngine = ExecutionSlippageEngine.getInstance();
