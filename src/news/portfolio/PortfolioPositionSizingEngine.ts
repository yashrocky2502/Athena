/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioPositionPositionSizingEngine.ts
 * 
 * Position Sizing Engine.
 * Calculates portfolio-aware position sizing (Max Allowed Qty, Recommended Qty, Conservative Qty)
 * considering capital, stop-loss risk, concentration, drawdown state, and margin limits.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, PositionSizingResult, DrawdownState } from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';

export class PortfolioPositionSizingEngine {
  private static instance: PortfolioPositionSizingEngine;

  private constructor() {}

  public static getInstance(): PortfolioPositionSizingEngine {
    if (!this.instance) {
      this.instance = new PortfolioPositionSizingEngine();
    }
    return this.instance;
  }

  /**
   * Calculates portfolio-aware position sizing for a candidate strategy
   */
  public calculatePositionSizing(
    candidate: CanonicalStrategyCandidate,
    totalCapitalINR: number,
    availableCapitalINR: number,
    freeMarginINR: number,
    drawdownState: DrawdownState = 'DRAWDOWN_NORMAL',
    existingCorrelationScore: number = 0
  ): PositionSizingResult {
    const capital = totalCapitalINR > 0 ? totalCapitalINR : 100000;
    const availCap = availableCapitalINR > 0 ? availableCapitalINR : capital * 0.5;
    const freeMargin = freeMarginINR > 0 ? freeMarginINR : capital * 0.5;

    const spot = candidate.entryPrice > 0 ? candidate.entryPrice : 1000;
    const stopLoss = candidate.stopLossPrice > 0 ? candidate.stopLossPrice : spot * 0.95;
    const riskPerUnit = Math.max(spot * 0.02, Math.abs(spot - stopLoss));

    // 1. Risk-Capital Based Limit (Max 2% total portfolio risk)
    const maxRiskCapINR = capital * 0.02; // 2% of total capital max risk
    const qtyByRisk = Math.floor(maxRiskCapINR / riskPerUnit);

    // 2. Available Capital Limit
    const candidateEstCap = candidate.estimatedCapitalRequiredINR || (spot * 0.15);
    const unitCapRequired = candidateEstCap > 0 ? candidateEstCap : spot;
    const qtyByCapital = Math.floor(availCap / unitCapRequired);

    // 3. Free Margin Limit
    const unitMarginRequired = unitCapRequired * 0.8;
    const qtyByMargin = Math.floor(freeMargin / unitMarginRequired);

    // Raw Max Allowed Qty
    let maxAllowed = Math.max(1, Math.min(qtyByRisk, qtyByCapital, qtyByMargin));

    let limitingFactor = 'Stop-Loss Risk Budget';
    if (maxAllowed === qtyByMargin && qtyByMargin < qtyByRisk) limitingFactor = 'Free Margin Limit';
    else if (maxAllowed === qtyByCapital && qtyByCapital < qtyByRisk) limitingFactor = 'Available Capital Limit';

    // Apply Drawdown State Multiplier
    let drawdownMultiplier = 1.0;
    if (drawdownState === 'DRAWDOWN_CRITICAL') {
      drawdownMultiplier = 0.4;
      limitingFactor += ' (Dampened by CRITICAL Drawdown)';
    } else if (drawdownState === 'DRAWDOWN_ELEVATED') {
      drawdownMultiplier = 0.7;
      limitingFactor += ' (Dampened by ELEVATED Drawdown)';
    }

    // Apply Correlation Overlap Penalty
    if (existingCorrelationScore >= 70) {
      drawdownMultiplier *= 0.5;
      limitingFactor += ' (Dampened by High Portfolio Correlation)';
    }

    const recommendedQuantity = Math.max(1, Math.floor(maxAllowed * drawdownMultiplier));
    const conservativeQuantity = Math.max(1, Math.floor(recommendedQuantity * 0.5));

    const estimatedCapitalRequiredINR = Math.round(recommendedQuantity * unitCapRequired);
    const estimatedMarginRequiredINR = Math.round(recommendedQuantity * unitMarginRequired);

    return {
      maxAllowedQuantity: Math.max(1, maxAllowed),
      recommendedQuantity,
      conservativeQuantity,
      limitingFactor,
      estimatedCapitalRequiredINR,
      estimatedMarginRequiredINR
    };
  }
}

export const portfolioPositionSizingEngine = PortfolioPositionSizingEngine.getInstance();
