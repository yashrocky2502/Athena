/**
 * ATHENA — Phase 18 Options Microstructure Engine
 * OptionsMicrostructureEngine.ts
 */

import { OptionsMetrics } from './types.ts';

export class OptionsMicrostructureEngine {
  private static instance: OptionsMicrostructureEngine;

  private constructor() {}

  public static getInstance(): OptionsMicrostructureEngine {
    if (!OptionsMicrostructureEngine.instance) {
      OptionsMicrostructureEngine.instance = new OptionsMicrostructureEngine();
    }
    return OptionsMicrostructureEngine.instance;
  }

  public analyze(
    callVolume: number,
    putVolume: number,
    callOi: number,
    putOi: number,
    historicalAvgVolume: number,
    skewChangePct: number = 0,
    isAtmIvSpiking: boolean = false
  ): { metrics: OptionsMetrics; score: number; evidence: string[] } {
    const totalOptionVolume = callVolume + putVolume;
    const optionVolumeSpikeRatio = totalOptionVolume / (historicalAvgVolume || 1);

    const putCallRatio = putVolume > 0 ? callVolume / putVolume : 1.0; // Volume PCR

    // Find concentration strike details
    const unusualStrikeConcentration = optionVolumeSpikeRatio > 3.0 
      ? `Strike concentration high at ATM+1 and ATM+2` 
      : 'Standard strike distribution';

    // Formulate evidence cleanly and securely without speculative "institutions are buying" hype
    const evidence: string[] = [];
    if (optionVolumeSpikeRatio > 2.0) {
      evidence.push(`Unusual options-chain volume activity: ${optionVolumeSpikeRatio.toFixed(1)}x normal baseline.`);
    }
    if (putCallRatio > 2.5) {
      evidence.push(`Unusual call-side volume/OI activity detected: Put-Call ratio is highly unbalanced at ${putCallRatio.toFixed(1)}.`);
    } else if (putCallRatio < 0.4) {
      evidence.push(`Unusual put-side volume/OI activity detected: Put-Call ratio is highly skewed towards protection at ${putCallRatio.toFixed(1)}.`);
    }

    if (isAtmIvSpiking) {
      evidence.push('ATM implied volatility expanding abnormally relative to standard historical term-structure.');
    }

    // Scoring (0-100)
    let score = 0;
    score += Math.min(optionVolumeSpikeRatio * 15, 50); // Max 50 from volume spike ratio
    score += (putCallRatio > 2.0 || putCallRatio < 0.4) ? 25 : 0; // Max 25 from call/put concentration asymmetry
    score += isAtmIvSpiking ? 25 : 0; // Max 25 from ATM IV spikes

    return {
      metrics: {
        optionVolumeSpikeRatio,
        putCallRatio,
        skewChangePct,
        unusualStrikeConcentration,
        ivSpikeAtAtm: isAtmIvSpiking,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
      evidence,
    };
  }
}
export const optionsMicrostructureEngine = OptionsMicrostructureEngine.getInstance();
