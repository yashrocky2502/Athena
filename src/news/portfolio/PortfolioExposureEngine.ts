/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioExposureEngine.ts
 * 
 * Exposure Engine.
 * Resolves gross, net, long, short, beta, sector, index, underlying, and leverage exposures.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, ExposureBreakdown, PositionAssetClass } from './types.ts';

export class PortfolioExposureEngine {
  private static instance: PortfolioExposureEngine;

  private constructor() {}

  public static getInstance(): PortfolioExposureEngine {
    if (!this.instance) {
      this.instance = new PortfolioExposureEngine();
    }
    return this.instance;
  }

  /**
   * Calculates detailed Exposure breakdown across portfolio positions
   */
  public calculateExposure(
    positions: NormalizedPosition[],
    totalCapitalINR: number
  ): ExposureBreakdown {
    const capital = totalCapitalINR > 0 ? totalCapitalINR : 1;

    let grossExposureINR = 0;
    let netExposureINR = 0;
    let longExposureINR = 0;
    let shortExposureINR = 0;
    let directionalBetaWeightedSum = 0;
    let leverageAdjustedExposureINR = 0;

    const sectorExposureMap: Record<string, number> = {};
    const indexExposureMap: Record<string, number> = {};
    const underlyingExposureMap: Record<string, number> = {};
    const assetClassExposureMap: Record<PositionAssetClass, number> = {
      EQUITY: 0,
      FUTURES: 0,
      OPTIONS: 0,
      CASH: 0
    };

    for (const pos of positions) {
      const notional = Math.abs(pos.notionalExposureINR || 0);
      const dirExposure = pos.directionalExposureINR || 0;
      const levExposure = pos.leveragedExposureINR || notional;

      grossExposureINR += notional;
      netExposureINR += dirExposure;

      if (dirExposure > 0) {
        longExposureINR += dirExposure;
      } else if (dirExposure < 0) {
        shortExposureINR += Math.abs(dirExposure);
      }

      directionalBetaWeightedSum += dirExposure * (pos.beta || 1.0);
      leverageAdjustedExposureINR += levExposure;

      // Sector aggregation
      const sector = pos.sector || 'GENERAL';
      sectorExposureMap[sector] = (sectorExposureMap[sector] || 0) + notional;

      // Index aggregation
      const idx = pos.indexSymbol || 'NIFTY';
      indexExposureMap[idx] = (indexExposureMap[idx] || 0) + notional;

      // Underlying aggregation
      const und = pos.underlyingSymbol || pos.symbol;
      underlyingExposureMap[und] = (underlyingExposureMap[und] || 0) + notional;

      // Asset Class aggregation
      const ac = pos.assetClass || 'EQUITY';
      assetClassExposureMap[ac] = (assetClassExposureMap[ac] || 0) + notional;
    }

    const sectorExposurePctMap: Record<string, number> = {};
    for (const sec in sectorExposureMap) {
      sectorExposurePctMap[sec] = Number(((sectorExposureMap[sec] / capital) * 100).toFixed(2));
    }

    const directionalBetaExposure = Number((directionalBetaWeightedSum / capital).toFixed(3));
    const grossNotionalToCapitalRatio = Number((grossExposureINR / capital).toFixed(2));
    const netNotionalToCapitalRatio = Number((netExposureINR / capital).toFixed(2));

    return {
      grossExposureINR: Math.round(grossExposureINR),
      netExposureINR: Math.round(netExposureINR),
      longExposureINR: Math.round(longExposureINR),
      shortExposureINR: Math.round(shortExposureINR),
      grossNotionalToCapitalRatio,
      netNotionalToCapitalRatio,
      directionalBetaExposure,
      leverageAdjustedExposureINR: Math.round(leverageAdjustedExposureINR),
      sectorExposureMap,
      sectorExposurePctMap,
      indexExposureMap,
      underlyingExposureMap,
      assetClassExposureMap
    };
  }
}

export const portfolioExposureEngine = PortfolioExposureEngine.getInstance();
