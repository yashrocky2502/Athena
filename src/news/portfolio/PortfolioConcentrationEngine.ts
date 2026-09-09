/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioConcentrationEngine.ts
 * 
 * Concentration Engine.
 * Calculates concentration across single security, underlying, sector, index, asset class, expiry, and direction.
 * Configurable thresholds with machine-readable rationales.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic mathematical evaluation.
 */

import { NormalizedPosition, PortfolioConcentrationReport, ConcentrationLevel, PositionAssetClass } from './types.ts';

export interface ConcentrationLimitsConfig {
  maxSingleSecurityPctLimit: number; // e.g., 25%
  maxUnderlyingPctLimit: number;     // e.g., 30%
  maxSectorPctLimit: number;         // e.g., 40%
  maxIndexPctLimit: number;          // e.g., 50%
  maxAssetClassPctLimit: number;     // e.g., 60%
  maxExpiryPctLimit: number;         // e.g., 40%
}

export const DEFAULT_CONCENTRATION_LIMITS: ConcentrationLimitsConfig = {
  maxSingleSecurityPctLimit: 25.0,
  maxUnderlyingPctLimit: 30.0,
  maxSectorPctLimit: 40.0,
  maxIndexPctLimit: 50.0,
  maxAssetClassPctLimit: 60.0,
  maxExpiryPctLimit: 40.0
};

export class PortfolioConcentrationEngine {
  private static instance: PortfolioConcentrationEngine;

  private constructor() {}

  public static getInstance(): PortfolioConcentrationEngine {
    if (!this.instance) {
      this.instance = new PortfolioConcentrationEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates concentration levels across normalized portfolio positions
   */
  public evaluateConcentration(
    positions: NormalizedPosition[],
    totalCapitalINR: number,
    config: ConcentrationLimitsConfig = DEFAULT_CONCENTRATION_LIMITS
  ): PortfolioConcentrationReport {
    const capital = totalCapitalINR > 0 ? totalCapitalINR : 1;
    if (!positions || positions.length === 0) {
      return {
        maxSingleSecurityPct: 0,
        maxUnderlyingPct: 0,
        maxSectorPct: 0,
        maxIndexPct: 0,
        maxAssetClassPct: 0,
        maxExpiryPct: 0,
        singleSecurityConcentration: 'LOW',
        sectorConcentration: 'LOW',
        underlyingConcentration: 'LOW',
        overallConcentrationScore: 0,
        flaggedConcentrations: []
      };
    }

    const singleSecurityMap: Record<string, number> = {};
    const underlyingMap: Record<string, number> = {};
    const sectorMap: Record<string, number> = {};
    const indexMap: Record<string, number> = {};
    const assetClassMap: Record<PositionAssetClass, number> = {
      EQUITY: 0, FUTURES: 0, OPTIONS: 0, CASH: 0
    };
    const expiryMap: Record<string, number> = {};

    let totalGrossNotional = 0;

    for (const pos of positions) {
      const notional = pos.notionalExposureINR || 0;
      totalGrossNotional += notional;

      // Single Security
      singleSecurityMap[pos.symbol] = (singleSecurityMap[pos.symbol] || 0) + notional;

      // Underlying
      const und = pos.underlyingSymbol || pos.symbol;
      underlyingMap[und] = (underlyingMap[und] || 0) + notional;

      // Sector
      const sec = pos.sector || 'GENERAL';
      sectorMap[sec] = (sectorMap[sec] || 0) + notional;

      // Index
      const idx = pos.indexSymbol || 'NIFTY';
      indexMap[idx] = (indexMap[idx] || 0) + notional;

      // Asset Class
      const ac = pos.assetClass || 'EQUITY';
      assetClassMap[ac] = (assetClassMap[ac] || 0) + notional;

      // Expiry
      if (pos.expiryDate) {
        expiryMap[pos.expiryDate] = (expiryMap[pos.expiryDate] || 0) + notional;
      }
    }

    const denom = capital; // evaluate concentration against total portfolio capital

    const getMaxPct = (map: Record<string, number>): number => {
      let maxVal = 0;
      for (const key in map) {
        if (map[key] > maxVal) maxVal = map[key];
      }
      return Number(((maxVal / denom) * 100).toFixed(2));
    };

    const maxSingleSecurityPct = getMaxPct(singleSecurityMap);
    const maxUnderlyingPct = getMaxPct(underlyingMap);
    const maxSectorPct = getMaxPct(sectorMap);
    const maxIndexPct = getMaxPct(indexMap);
    const maxAssetClassPct = getMaxPct(assetClassMap);
    const maxExpiryPct = getMaxPct(expiryMap);

    const classifyConcentration = (pct: number, limit: number): ConcentrationLevel => {
      if (pct >= limit * 1.25) return 'EXTREME';
      if (pct >= limit) return 'HIGH';
      if (pct >= limit * 0.7) return 'MODERATE';
      return 'LOW';
    };

    const singleSecurityConcentration = classifyConcentration(maxSingleSecurityPct, config.maxSingleSecurityPctLimit);
    const underlyingConcentration = classifyConcentration(maxUnderlyingPct, config.maxUnderlyingPctLimit);
    const sectorConcentration = classifyConcentration(maxSectorPct, config.maxSectorPctLimit);

    const flaggedConcentrations: string[] = [];
    if (maxSingleSecurityPct > config.maxSingleSecurityPctLimit) {
      flaggedConcentrations.push(`Single Security Exposure (${maxSingleSecurityPct}%) exceeds limit (${config.maxSingleSecurityPctLimit}%)`);
    }
    if (maxUnderlyingPct > config.maxUnderlyingPctLimit) {
      flaggedConcentrations.push(`Underlying Exposure (${maxUnderlyingPct}%) exceeds limit (${config.maxUnderlyingPctLimit}%)`);
    }
    if (maxSectorPct > config.maxSectorPctLimit) {
      flaggedConcentrations.push(`Sector Exposure (${maxSectorPct}%) exceeds limit (${config.maxSectorPctLimit}%)`);
    }
    if (maxIndexPct > config.maxIndexPctLimit) {
      flaggedConcentrations.push(`Index Exposure (${maxIndexPct}%) exceeds limit (${config.maxIndexPctLimit}%)`);
    }
    if (maxExpiryPct > config.maxExpiryPctLimit) {
      flaggedConcentrations.push(`Expiry Exposure (${maxExpiryPct}%) exceeds limit (${config.maxExpiryPctLimit}%)`);
    }

    // Overall Concentration Score (0 to 100)
    const scoreRaw = (
      (maxSingleSecurityPct / config.maxSingleSecurityPctLimit) * 30 +
      (maxUnderlyingPct / config.maxUnderlyingPctLimit) * 35 +
      (maxSectorPct / config.maxSectorPctLimit) * 35
    );
    const overallConcentrationScore = Math.min(100, Math.round(scoreRaw));

    return {
      maxSingleSecurityPct,
      maxUnderlyingPct,
      maxSectorPct,
      maxIndexPct,
      maxAssetClassPct,
      maxExpiryPct,
      singleSecurityConcentration,
      sectorConcentration,
      underlyingConcentration,
      overallConcentrationScore,
      flaggedConcentrations
    };
  }
}

export const portfolioConcentrationEngine = PortfolioConcentrationEngine.getInstance();
