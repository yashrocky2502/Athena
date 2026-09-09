/**
 * ATHENA — Phase 18 Sector & Index Divergence Engine
 * SectorDivergenceEngine.ts
 */

import { SectorMetrics } from './types.ts';

export class SectorDivergenceEngine {
  private static instance: SectorDivergenceEngine;

  private constructor() {}

  public static getInstance(): SectorDivergenceEngine {
    if (!SectorDivergenceEngine.instance) {
      SectorDivergenceEngine.instance = new SectorDivergenceEngine();
    }
    return SectorDivergenceEngine.instance;
  }

  public analyze(
    symbol: string,
    stockReturn: number,
    sectorReturn: number,
    indexReturn: number
  ): { metrics: SectorMetrics; score: number; evidence: string } {
    const stockVsSectorReturnPct = stockReturn - sectorReturn;
    const sectorVsIndexReturnPct = sectorReturn - indexReturn;

    const outperformingSector = stockVsSectorReturnPct > 1.0;
    const isSectorLeader = stockVsSectorReturnPct > 2.5;

    // Produce evidence string exactly as requested without flowery adjectives
    const indexName = symbol === 'RELIANCE' ? 'NIFTY 50' : 'BANKNIFTY';
    const evidence = `${symbol} is outperforming its sector by ${stockVsSectorReturnPct.toFixed(2)} percentage points and ${indexName} by ${(stockReturn - indexReturn).toFixed(2)} percentage points.`;

    // Score calculations
    let score = 0;
    score += Math.min(Math.abs(stockVsSectorReturnPct) * 15, 50); // Max 50 from sector relative strength
    score += Math.min(Math.abs(sectorVsIndexReturnPct) * 10, 30); // Max 30 from index relative strength
    if (isSectorLeader) score += 20;

    return {
      metrics: {
        stockVsSectorReturnPct,
        sectorVsIndexReturnPct,
        outperformingSector,
        isSectorLeader,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
      evidence,
    };
  }
}
export const sectorDivergenceEngine = SectorDivergenceEngine.getInstance();
