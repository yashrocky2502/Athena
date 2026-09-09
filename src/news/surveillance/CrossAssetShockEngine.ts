/**
 * ATHENA — Phase 18 Cross-Asset Shock Engine
 * CrossAssetShockEngine.ts
 */

import { CrossAssetMetrics } from './types.ts';

export class CrossAssetShockEngine {
  private static instance: CrossAssetShockEngine;

  private constructor() {}

  public static getInstance(): CrossAssetShockEngine {
    if (!CrossAssetShockEngine.instance) {
      CrossAssetShockEngine.instance = new CrossAssetShockEngine();
    }
    return CrossAssetShockEngine.instance;
  }

  public analyze(
    usdInrDeltaPct: number,
    crudeDeltaPct: number,
    goldDeltaPct: number,
    equityIndexDeltaPct: number,
    sectorSymbol?: string
  ): { metrics: CrossAssetMetrics; score: number; evidence: string[] } {
    const evidence: string[] = [];
    let correlationStatus: 'CORRELATED' | 'DIVERGENT' | 'POTENTIAL_TRANSMISSION' | 'UNCONFIRMED' = 'UNCONFIRMED';

    // Crude Spike vs Equity index or OMC underperformance
    if (crudeDeltaPct > 3.0) {
      evidence.push(`Crude Oil spike (+${crudeDeltaPct.toFixed(1)}%) detected.`);
      if (sectorSymbol === 'OMC' && equityIndexDeltaPct < -0.5) {
        correlationStatus = 'POTENTIAL_TRANSMISSION';
        evidence.push('OMC underperformance confirming oil transmission shock vector.');
      } else if (equityIndexDeltaPct < -1.0) {
        correlationStatus = 'CORRELATED';
      } else {
        correlationStatus = 'DIVERGENT';
      }
    }

    // Gold Spike + Equity Index Decline (safe haven transition)
    if (goldDeltaPct > 2.0 && equityIndexDeltaPct < -1.0) {
      correlationStatus = 'POTENTIAL_TRANSMISSION';
      evidence.push(`Gold spike (+${goldDeltaPct.toFixed(1)}%) coinciding with index decline (${equityIndexDeltaPct.toFixed(1)}%). Indicates risk-off flow.`);
    }

    // USD/INR spike vs Equity Index Decline
    if (usdInrDeltaPct > 0.8) {
      evidence.push(`USD/INR currency depreciation spike (+${usdInrDeltaPct.toFixed(2)}%) observed.`);
      if (equityIndexDeltaPct < -0.8) {
        correlationStatus = 'POTENTIAL_TRANSMISSION';
        evidence.push('Broad market equity selling confirming currency depreciation transmission pathway.');
      }
    }

    // Score (0-100)
    let score = 0;
    score += Math.min(Math.abs(usdInrDeltaPct) * 30, 40); // Max 40 from FX shock
    score += Math.min(Math.abs(crudeDeltaPct) * 10, 30); // Max 30 from Crude shock
    score += Math.min(Math.abs(goldDeltaPct) * 12, 30); // Max 30 from Gold shock
    if (correlationStatus === 'POTENTIAL_TRANSMISSION') {
      score += 20;
    }

    return {
      metrics: {
        usdInrDeltaPct,
        crudeDeltaPct,
        goldDeltaPct,
        correlationStatus,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
      evidence,
    };
  }
}
export const crossAssetShockEngine = CrossAssetShockEngine.getInstance();
