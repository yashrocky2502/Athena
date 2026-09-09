/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioCapitalEngine.ts
 * 
 * Capital & Margin Engine.
 * Calculates capital utilization, margin requirements, leverage, incremental candidate margin,
 * and enforces strict capital preservation rules.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, PortfolioSnapshot, PortfolioCapitalReport } from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';

export interface CapitalLimitsConfig {
  maxMarginUtilizationPctLimit: number; // default 80%
  minFreeMarginPctLimit: number;       // default 15%
  maxLeverageLimit: number;            // default 3.0x
}

export const DEFAULT_CAPITAL_LIMITS: CapitalLimitsConfig = {
  maxMarginUtilizationPctLimit: 80.0,
  minFreeMarginPctLimit: 15.0,
  maxLeverageLimit: 3.0
};

export class PortfolioCapitalEngine {
  private static instance: PortfolioCapitalEngine;

  private constructor() {}

  public static getInstance(): PortfolioCapitalEngine {
    if (!this.instance) {
      this.instance = new PortfolioCapitalEngine();
    }
    return this.instance;
  }

  /**
   * Calculates capital & margin metrics for snapshot and candidate strategy
   */
  public evaluateCapital(
    snapshot: PortfolioSnapshot,
    candidate?: CanonicalStrategyCandidate,
    config: CapitalLimitsConfig = DEFAULT_CAPITAL_LIMITS
  ): PortfolioCapitalReport {
    const totalCapital = snapshot.totalCapitalINR > 0 ? snapshot.totalCapitalINR : 100000;
    
    // Calculate current invested capital & current margin used
    let grossNotional = 0;
    let currentInvestedCapital = 0;
    let currentUsedMargin = snapshot.usedMarginINR || 0;

    for (const pos of snapshot.positions) {
      const notional = pos.notionalExposureINR || 0;
      grossNotional += notional;
      currentInvestedCapital += pos.currentMarketValueINR || 0;
      
      if (!snapshot.usedMarginINR) {
        if (pos.assetClass === 'FUTURES') {
          currentUsedMargin += notional * 0.15; // 15% futures margin estimate
        } else if (pos.assetClass === 'OPTIONS') {
          if (pos.side === 'SHORT') currentUsedMargin += notional * 0.20; // 20% short option margin
          else currentUsedMargin += pos.currentMarketValueINR; // paid premium
        } else {
          currentUsedMargin += pos.currentMarketValueINR;
        }
      }
    }

    const availableCapitalINR = Math.max(0, snapshot.availableCapitalINR || (totalCapital - currentInvestedCapital));
    const freeMarginINR = Math.max(0, totalCapital - currentUsedMargin);
    const marginUtilizationPct = Number(((currentUsedMargin / totalCapital) * 100).toFixed(2));
    const effectiveLeverage = Number((grossNotional / totalCapital).toFixed(2));
    const grossNotionalToCapitalRatio = effectiveLeverage;

    // Incremental margin required by candidate
    let incrementalMarginRequiredINR = 0;
    if (candidate) {
      if (candidate.estimatedCapitalRequiredINR && candidate.estimatedCapitalRequiredINR > 0) {
        incrementalMarginRequiredINR = candidate.estimatedCapitalRequiredINR;
      } else {
        const spot = candidate.entryPrice || 1000;
        const qty = candidate.positionSizeContractsOrQty || 1;
        if (candidate.category === 'OPTIONS') {
          incrementalMarginRequiredINR = Math.round(spot * qty * 0.10); // Defined risk spread or premium
        } else if (candidate.category === 'FUTURES') {
          incrementalMarginRequiredINR = Math.round(spot * qty * 0.15); // Futures margin
        } else {
          incrementalMarginRequiredINR = Math.round(spot * qty);
        }
      }
    }

    const postTradeUsedMargin = currentUsedMargin + incrementalMarginRequiredINR;
    const postTradeMarginUtilizationPct = Number(((postTradeUsedMargin / totalCapital) * 100).toFixed(2));

    const capitalPreservationBreached = postTradeMarginUtilizationPct > config.maxMarginUtilizationPctLimit;
    const postTradeFreeMarginPct = 100 - postTradeMarginUtilizationPct;
    const marginCallRisk = postTradeFreeMarginPct < config.minFreeMarginPctLimit || postTradeUsedMargin > totalCapital;

    return {
      totalCapitalINR: Math.round(totalCapital),
      availableCapitalINR: Math.round(availableCapitalINR),
      investedCapitalINR: Math.round(currentInvestedCapital),
      usedMarginINR: Math.round(currentUsedMargin),
      freeMarginINR: Math.round(freeMarginINR),
      marginUtilizationPct,
      effectiveLeverage,
      grossNotionalToCapitalRatio,
      incrementalMarginRequiredINR: Math.round(incrementalMarginRequiredINR),
      postTradeMarginUtilizationPct,
      capitalPreservationBreached,
      marginCallRisk
    };
  }
}

export const portfolioCapitalEngine = PortfolioCapitalEngine.getInstance();
