/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioCorrelationEngine.ts
 * 
 * Correlation & Overlap Engine.
 * Identifies correlated holdings, overlapping directional bets, sector/underlying duplication,
 * and multi-dimensional factor correlation.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, PortfolioOverlapReport, OverlapLevel } from './types.ts';

export class PortfolioCorrelationEngine {
  private static instance: PortfolioCorrelationEngine;

  private constructor() {}

  public static getInstance(): PortfolioCorrelationEngine {
    if (!this.instance) {
      this.instance = new PortfolioCorrelationEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates correlation and overlap across normalized portfolio positions
   */
  public evaluateCorrelationAndOverlap(positions: NormalizedPosition[]): PortfolioOverlapReport {
    if (!positions || positions.length === 0) {
      return {
        overlapScore: 0,
        overlapLevel: 'NONE',
        highCorrelatedHoldings: [],
        overlappingDirectionalBets: [],
        sectorDuplications: [],
        underlyingDuplications: [],
        strategyDuplications: [],
        detectedFactorExposures: []
      };
    }

    const highCorrelatedHoldings: Array<{ pos1: string; pos2: string; correlation: number; reason: string }> = [];
    const underlyingCountMap: Record<string, number> = {};
    const sectorCountMap: Record<string, number> = {};
    const longSymbols: string[] = [];
    const shortSymbols: string[] = [];
    const strategyTagsMap: Record<string, number> = {};

    for (const pos of positions) {
      const und = pos.underlyingSymbol || pos.symbol;
      underlyingCountMap[und] = (underlyingCountMap[und] || 0) + 1;

      const sec = pos.sector || 'GENERAL';
      sectorCountMap[sec] = (sectorCountMap[sec] || 0) + 1;

      if (pos.directionalExposureINR > 0) longSymbols.push(pos.symbol);
      else if (pos.directionalExposureINR < 0) shortSymbols.push(pos.symbol);

      if (pos.strategyGroupTag) {
        strategyTagsMap[pos.strategyGroupTag] = (strategyTagsMap[pos.strategyGroupTag] || 0) + 1;
      }
    }

    // Pairwise Correlation & Duplication Analysis
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i];
        const p2 = positions[j];

        const sameUnderlying = (p1.underlyingSymbol || p1.symbol) === (p2.underlyingSymbol || p2.symbol);
        const sameSector = p1.sector === p2.sector && p1.sector !== 'GENERAL';
        const sameSide = (p1.directionalExposureINR > 0 && p2.directionalExposureINR > 0) ||
                         (p1.directionalExposureINR < 0 && p2.directionalExposureINR < 0);

        let pairCorr = 0;
        let reason = '';

        if (sameUnderlying && sameSide) {
          pairCorr = 0.95;
          reason = `Identical underlying (${p1.underlyingSymbol}) and directional alignment`;
        } else if (sameUnderlying) {
          pairCorr = 0.70;
          reason = `Same underlying (${p1.underlyingSymbol}) opposing legs`;
        } else if (sameSector && sameSide) {
          pairCorr = 0.80;
          reason = `Sector duplication (${p1.sector}) with same direction`;
        } else if (sameSector) {
          pairCorr = 0.50;
          reason = `Same sector (${p1.sector}) exposure`;
        } else if (Math.abs((p1.beta || 1) - (p2.beta || 1)) < 0.2 && sameSide) {
          pairCorr = 0.65;
          reason = `High Beta correlation (${p1.beta}) and directional match`;
        }

        if (pairCorr >= 0.70) {
          highCorrelatedHoldings.push({
            pos1: p1.symbol,
            pos2: p2.symbol,
            correlation: pairCorr,
            reason
          });
        }
      }
    }

    // Duplications
    const underlyingDuplications = Object.keys(underlyingCountMap).filter(k => underlyingCountMap[k] > 1);
    const sectorDuplications = Object.keys(sectorCountMap).filter(k => sectorCountMap[k] > 1);
    const strategyDuplications = Object.keys(strategyTagsMap).filter(k => strategyTagsMap[k] > 1);

    // Overlapping directional bets
    const overlappingDirectionalBets: string[] = [];
    if (longSymbols.length >= 3) {
      overlappingDirectionalBets.push(`Multiple (${longSymbols.length}) Long Directional Exposures`);
    }
    if (shortSymbols.length >= 3) {
      overlappingDirectionalBets.push(`Multiple (${shortSymbols.length}) Short Directional Exposures`);
    }

    // Detected Factors
    const detectedFactorExposures: string[] = [];
    if (longSymbols.length > 0 && shortSymbols.length === 0) detectedFactorExposures.push('UNHEDGED_LONG_BETA_FACTOR');
    if (sectorDuplications.length > 0) detectedFactorExposures.push('SECTOR_CONCENTRATION_FACTOR');
    if (highCorrelatedHoldings.length >= 2) detectedFactorExposures.push('HIGH_PAIRWISE_CORRELATION_FACTOR');

    // Calculate Overlap Score (0 to 100)
    let overlapScore = 0;
    overlapScore += highCorrelatedHoldings.length * 15;
    overlapScore += underlyingDuplications.length * 20;
    overlapScore += sectorDuplications.length * 10;
    overlapScore += strategyDuplications.length * 10;
    if (longSymbols.length >= 4 || shortSymbols.length >= 4) overlapScore += 15;

    overlapScore = Math.min(100, Math.max(0, overlapScore));

    let overlapLevel: OverlapLevel = 'NONE';
    if (overlapScore >= 75) overlapLevel = 'CRITICAL';
    else if (overlapScore >= 50) overlapLevel = 'HIGH';
    else if (overlapScore >= 30) overlapLevel = 'MODERATE';
    else if (overlapScore > 0) overlapLevel = 'LOW';

    return {
      overlapScore,
      overlapLevel,
      highCorrelatedHoldings,
      overlappingDirectionalBets,
      sectorDuplications,
      underlyingDuplications,
      strategyDuplications,
      detectedFactorExposures
    };
  }
}

export const portfolioCorrelationEngine = PortfolioCorrelationEngine.getInstance();
