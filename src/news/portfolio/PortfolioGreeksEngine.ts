/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioGreeksEngine.ts
 * 
 * Options Greeks Aggregation Engine.
 * Aggregates Delta, Gamma, Theta, Vega across equity, futures, individual options, and multi-leg spreads.
 * Computes BEFORE vs AFTER candidate strategy comparisons.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic mathematical aggregation.
 */

import { NormalizedPosition, PortfolioGreeks } from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';

export class PortfolioGreeksEngine {
  private static instance: PortfolioGreeksEngine;

  private constructor() {}

  public static getInstance(): PortfolioGreeksEngine {
    if (!this.instance) {
      this.instance = new PortfolioGreeksEngine();
    }
    return this.instance;
  }

  /**
   * Aggregates Greeks for a list of normalized portfolio positions
   */
  public aggregateGreeks(positions: NormalizedPosition[]): PortfolioGreeks {
    let netDelta = 0;
    let netGamma = 0;
    let netTheta = 0;
    let netVega = 0;
    let deltaExposureINR = 0;

    const greekConcentrationByUnderlying: Record<string, { delta: number; vega: number }> = {};
    const greekConcentrationByExpiry: Record<string, { delta: number; theta: number }> = {};

    for (const pos of positions) {
      const qty = pos.netQuantity;
      const g = pos.greeks || { delta: 0, gamma: 0, theta: 0, vega: 0 };

      // Multiply Greek by quantity
      const posDelta = g.delta * qty;
      const posGamma = g.gamma * Math.abs(qty);
      const posTheta = g.theta * Math.abs(qty);
      const posVega = g.vega * Math.abs(qty);

      netDelta += posDelta;
      netGamma += posGamma;
      netTheta += posTheta;
      netVega += posVega;

      deltaExposureINR += posDelta * pos.currentPrice;

      // Concentration by Underlying
      const und = pos.underlyingSymbol || pos.symbol;
      if (!greekConcentrationByUnderlying[und]) {
        greekConcentrationByUnderlying[und] = { delta: 0, vega: 0 };
      }
      greekConcentrationByUnderlying[und].delta += posDelta;
      greekConcentrationByUnderlying[und].vega += posVega;

      // Concentration by Expiry
      if (pos.expiryDate) {
        const exp = pos.expiryDate;
        if (!greekConcentrationByExpiry[exp]) {
          greekConcentrationByExpiry[exp] = { delta: 0, theta: 0 };
        }
        greekConcentrationByExpiry[exp].delta += posDelta;
        greekConcentrationByExpiry[exp].theta += posTheta;
      }
    }

    return {
      netDelta: Number(netDelta.toFixed(3)),
      netGamma: Number(netGamma.toFixed(4)),
      netTheta: Number(netTheta.toFixed(2)),
      netVega: Number(netVega.toFixed(2)),
      deltaExposureINR: Math.round(deltaExposureINR),
      greekConcentrationByUnderlying,
      greekConcentrationByExpiry
    };
  }

  /**
   * Calculates BEFORE vs AFTER Greeks impact when injecting a candidate strategy
   */
  public calculateGreeksImpact(
    currentPositions: NormalizedPosition[],
    candidate: CanonicalStrategyCandidate
  ): { before: PortfolioGreeks; after: PortfolioGreeks; deltaChange: PortfolioGreeks } {
    const before = this.aggregateGreeks(currentPositions);

    // Convert candidate strategy into simulated positions
    const candidatePositions: NormalizedPosition[] = [];
    const spot = candidate.entryPrice || 1000;
    const qty = candidate.positionSizeContractsOrQty || 1;
    const isLong = candidate.direction === 'LONG';

    if (candidate.category === 'EQUITY') {
      candidatePositions.push({
        id: `cand-${candidate.strategyId}`,
        symbol: candidate.symbol,
        underlyingSymbol: candidate.symbol,
        assetClass: 'EQUITY',
        side: isLong ? 'LONG' : 'SHORT',
        netQuantity: isLong ? qty : -qty,
        grossQuantity: qty,
        entryPrice: spot,
        currentPrice: spot,
        currentMarketValueINR: qty * spot,
        notionalExposureINR: qty * spot,
        directionalExposureINR: (isLong ? 1 : -1) * qty * spot,
        leveragedExposureINR: qty * spot,
        unrealizedPnLINR: 0,
        realizedPnLINR: 0,
        sector: candidate.sector || 'GENERAL',
        indexSymbol: 'NIFTY',
        beta: 1.0,
        leverage: 1.0,
        stopLossPrice: candidate.stopLossPrice,
        targetPrice: candidate.targetPrice,
        greeks: { delta: isLong ? 1.0 : -1.0, gamma: 0, theta: 0, vega: 0 }
      });
    } else if (candidate.category === 'FUTURES') {
      candidatePositions.push({
        id: `cand-${candidate.strategyId}`,
        symbol: candidate.symbol,
        underlyingSymbol: candidate.symbol,
        assetClass: 'FUTURES',
        side: isLong ? 'LONG' : 'SHORT',
        netQuantity: isLong ? qty : -qty,
        grossQuantity: qty,
        entryPrice: spot,
        currentPrice: spot,
        currentMarketValueINR: qty * spot,
        notionalExposureINR: qty * spot * 5,
        directionalExposureINR: (isLong ? 1 : -1) * qty * spot * 5,
        leveragedExposureINR: qty * spot * 5,
        unrealizedPnLINR: 0,
        realizedPnLINR: 0,
        sector: candidate.sector || 'GENERAL',
        indexSymbol: 'NIFTY',
        beta: 1.0,
        leverage: 5.0,
        stopLossPrice: candidate.stopLossPrice,
        targetPrice: candidate.targetPrice,
        greeks: { delta: isLong ? 1.0 : -1.0, gamma: 0, theta: 0, vega: 0 }
      });
    } else if (candidate.category === 'OPTIONS') {
      if (candidate.optionLegs && candidate.optionLegs.length > 0) {
        for (const leg of candidate.optionLegs) {
          const legIsBuy = leg.action === 'BUY';
          const legQty = legIsBuy ? qty : -qty;
          candidatePositions.push({
            id: `cand-leg-${leg.legId}`,
            symbol: `${candidate.symbol}_${leg.strike}_${leg.type}`,
            underlyingSymbol: candidate.symbol,
            assetClass: 'OPTIONS',
            side: legIsBuy ? 'LONG' : 'SHORT',
            netQuantity: legQty,
            grossQuantity: qty,
            entryPrice: leg.premium,
            currentPrice: leg.premium,
            currentMarketValueINR: qty * leg.premium,
            notionalExposureINR: qty * leg.strike,
            directionalExposureINR: legQty * leg.delta * leg.strike,
            leveragedExposureINR: qty * leg.strike,
            unrealizedPnLINR: 0,
            realizedPnLINR: 0,
            sector: candidate.sector || 'GENERAL',
            indexSymbol: 'NIFTY',
            beta: 1.0,
            leverage: 1.0,
            stopLossPrice: candidate.stopLossPrice,
            targetPrice: candidate.targetPrice,
            optionType: leg.type,
            strikePrice: leg.strike,
            expiryDate: new Date(Date.now() + leg.expiryDays * 86400000).toISOString(),
            greeks: {
              delta: leg.delta,
              gamma: leg.gamma,
              theta: leg.theta,
              vega: leg.vega
            }
          });
        }
      } else {
        // Fallback options estimate from Greeks object if available
        const g = candidate.optionsGreeks || { netDelta: isLong ? 0.5 : -0.5, netGamma: 0.002, netTheta: -2, netVega: 1.5 };
        candidatePositions.push({
          id: `cand-${candidate.strategyId}`,
          symbol: `${candidate.symbol}_OPT`,
          underlyingSymbol: candidate.symbol,
          assetClass: 'OPTIONS',
          side: isLong ? 'LONG' : 'SHORT',
          netQuantity: isLong ? qty : -qty,
          grossQuantity: qty,
          entryPrice: spot * 0.05,
          currentPrice: spot * 0.05,
          currentMarketValueINR: qty * spot * 0.05,
          notionalExposureINR: qty * spot,
          directionalExposureINR: (isLong ? 1 : -1) * qty * g.netDelta * spot,
          leveragedExposureINR: qty * spot,
          unrealizedPnLINR: 0,
          realizedPnLINR: 0,
          sector: candidate.sector || 'GENERAL',
          indexSymbol: 'NIFTY',
          beta: 1.0,
          leverage: 1.0,
          stopLossPrice: candidate.stopLossPrice,
          targetPrice: candidate.targetPrice,
          greeks: {
            delta: g.netDelta,
            gamma: g.netGamma || 0,
            theta: g.netTheta || 0,
            vega: g.netVega || 0
          }
        });
      }
    }

    const combinedPositions = [...currentPositions, ...candidatePositions];
    const after = this.aggregateGreeks(combinedPositions);

    const deltaChange: PortfolioGreeks = {
      netDelta: Number((after.netDelta - before.netDelta).toFixed(3)),
      netGamma: Number((after.netGamma - before.netGamma).toFixed(4)),
      netTheta: Number((after.netTheta - before.netTheta).toFixed(2)),
      netVega: Number((after.netVega - before.netVega).toFixed(2)),
      deltaExposureINR: after.deltaExposureINR - before.deltaExposureINR,
      greekConcentrationByUnderlying: {},
      greekConcentrationByExpiry: {}
    };

    return { before, after, deltaChange };
  }
}

export const portfolioGreeksEngine = PortfolioGreeksEngine.getInstance();
