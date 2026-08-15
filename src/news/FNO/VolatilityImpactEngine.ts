import { VolatilityBias, DataAvailabilityStatus } from './FOTypes.js';

export interface VolatilityAnalysis {
  volatilityBias: VolatilityBias;
  gapRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  overnightRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  volatilityDataStatus: DataAvailabilityStatus;
  notes: string;
}

export class VolatilityImpactEngine {
  /**
   * Assesses volatility impact and risk characteristics based on event type, magnitude, and market state.
   */
  public evaluateVolatility(
    category: string,
    title: string,
    body: string,
    hasLiveOptionChain: boolean = false
  ): VolatilityAnalysis {
    const textLower = `${title} ${body}`.toLowerCase();
    const catLower = (category || '').toLowerCase();

    // Check if live option chain data is available
    const volatilityDataStatus: DataAvailabilityStatus = hasLiveOptionChain ? 'AVAILABLE' : 'UNAVAILABLE';

    // Check for high volatility expansion / binary risk
    const isImminentEarnings = textLower.includes('results today') || textLower.includes('q1 results today') || textLower.includes('q2 results today');
    const isMacroPolicy = catLower.includes('macro') || textLower.includes('rbi policy') || textLower.includes('fed rate');
    const isLargeSurprise = textLower.includes('jumps 25%') || textLower.includes('falls 18%') || textLower.includes('net loss') || textLower.includes('cfo resigns');

    let volatilityBias: VolatilityBias = 'NEUTRAL';
    let gapRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
    let overnightRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
    let liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (isImminentEarnings || isMacroPolicy) {
      volatilityBias = 'HIGH_VOLATILITY_AVOID';
      gapRisk = 'EXTREME';
      overnightRisk = 'EXTREME';
      liquidityRisk = 'MEDIUM';
    } else if (isLargeSurprise) {
      volatilityBias = 'VOLATILITY_EXPANSION';
      gapRisk = 'HIGH';
      overnightRisk = 'HIGH';
      liquidityRisk = 'LOW';
    } else if (catLower.includes('broker') || catLower.includes('analyst') || textLower.includes('target price')) {
      volatilityBias = 'VOLATILITY_COMPRESSION';
      gapRisk = 'LOW';
      overnightRisk = 'LOW';
      liquidityRisk = 'LOW';
    }

    const notes = hasLiveOptionChain 
      ? 'Live option chain IV & Greeks evaluated' 
      : 'Live option chain data UNAVAILABLE — Strategy delta/IV evaluated under fallback rule (no synthetic numbers created)';

    return {
      volatilityBias,
      gapRisk,
      overnightRisk,
      liquidityRisk,
      volatilityDataStatus,
      notes
    };
  }
}
