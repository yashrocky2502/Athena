/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioHedgeEngine.ts
 * 
 * Hedge Engine.
 * Identifies deterministic hedge candidates when portfolio risks (Delta, Gamma, Vega, Concentration) exceed thresholds.
 * Hedges do NOT auto-execute; they provide machine-readable hedge proposals with cost and residual risk estimates.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, PortfolioGreeks, PortfolioConcentrationReport, HedgeCandidate } from './types.ts';

export class PortfolioHedgeEngine {
  private static instance: PortfolioHedgeEngine;

  private constructor() {}

  public static getInstance(): PortfolioHedgeEngine {
    if (!this.instance) {
      this.instance = new PortfolioHedgeEngine();
    }
    return this.instance;
  }

  /**
   * Identifies candidate hedges for current portfolio state
   */
  public evaluateHedgeCandidates(
    positions: NormalizedPosition[],
    greeks: PortfolioGreeks,
    concentration: PortfolioConcentrationReport,
    totalCapitalINR: number
  ): HedgeCandidate[] {
    const candidates: HedgeCandidate[] = [];
    const capital = totalCapitalINR > 0 ? totalCapitalINR : 100000;

    // 1. High Net Long Delta Hedge -> NIFTY Protective Put
    if (greeks.netDelta > 1.5 || greeks.deltaExposureINR > capital * 0.5) {
      const deltaToHedge = greeks.netDelta * 0.5;
      candidates.push({
        hedgeId: `hedge-delta-long-${Date.now()}`,
        hedgeInstrument: 'NIFTY_ATM_PUT_OPTION',
        reason: `Excessive Net Long Delta exposure (Net Delta: ${greeks.netDelta.toFixed(2)}, INR Exposure: ₹${greeks.deltaExposureINR})`,
        exposureReducedType: 'LONG_DELTA',
        exposureReducedValue: Number(deltaToHedge.toFixed(2)),
        estimatedCostINR: Math.round(capital * 0.015),
        residualRisk: 'Base risk on out-of-the-money gap movements',
        confidenceScore: 90,
        recommendedQty: Math.max(1, Math.round(deltaToHedge))
      });
    }

    // 2. High Net Short Delta Hedge -> NIFTY Long Call / Futures
    if (greeks.netDelta < -1.5 || greeks.deltaExposureINR < -capital * 0.5) {
      const deltaToHedge = Math.abs(greeks.netDelta) * 0.5;
      candidates.push({
        hedgeId: `hedge-delta-short-${Date.now()}`,
        hedgeInstrument: 'NIFTY_ATM_CALL_OPTION',
        reason: `Excessive Net Short Delta exposure (Net Delta: ${greeks.netDelta.toFixed(2)})`,
        exposureReducedType: 'SHORT_DELTA',
        exposureReducedValue: Number(deltaToHedge.toFixed(2)),
        estimatedCostINR: Math.round(capital * 0.015),
        residualRisk: 'Upside squeeze tail risk mitigated',
        confidenceScore: 88,
        recommendedQty: Math.max(1, Math.round(deltaToHedge))
      });
    }

    // 3. Short Gamma Risk -> Add Long Options Leg / Reduce Short Position
    if (greeks.netGamma < -0.05) {
      candidates.push({
        hedgeId: `hedge-gamma-${Date.now()}`,
        hedgeInstrument: 'OTM_LONG_STRADDLE_SPREAD',
        reason: `Excessive Net Short Gamma (${greeks.netGamma.toFixed(4)}) creates gap vulnerability`,
        exposureReducedType: 'SHORT_GAMMA',
        exposureReducedValue: Number(Math.abs(greeks.netGamma * 0.5).toFixed(4)),
        estimatedCostINR: Math.round(capital * 0.01),
        residualRisk: 'Theta decay on long hedge leg',
        confidenceScore: 85,
        recommendedQty: 1
      });
    }

    // 4. Sector Concentration Hedge -> Sector Index Futures Short
    if (concentration.maxSectorPct > 40.0) {
      const topSector = concentration.flaggedConcentrations.find(c => c.includes('Sector')) || 'Dominant Sector';
      candidates.push({
        hedgeId: `hedge-sector-${Date.now()}`,
        hedgeInstrument: 'SECTOR_INDEX_SHORT_FUTURES',
        reason: `High Sector Concentration (${concentration.maxSectorPct}%) in ${topSector}`,
        exposureReducedType: 'SECTOR_CONCENTRATION',
        exposureReducedValue: concentration.maxSectorPct - 25.0,
        estimatedCostINR: Math.round(capital * 0.008),
        residualRisk: 'Basis risk between stock selection and sector index',
        confidenceScore: 82,
        recommendedQty: 1
      });
    }

    return candidates;
  }
}

export const portfolioHedgeEngine = PortfolioHedgeEngine.getInstance();
