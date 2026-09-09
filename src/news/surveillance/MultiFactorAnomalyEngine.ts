/**
 * ATHENA — Phase 18 Multi-Factor Anomaly Engine
 * MultiFactorAnomalyEngine.ts
 */

import { priceAnomalyEngine } from './PriceAnomalyEngine.ts';
import { volumeAnomalyEngine } from './VolumeAnomalyEngine.ts';
import { volatilitySurveillanceEngine } from './VolatilitySurveillanceEngine.ts';
import { fnoAnomalyEngine } from './FnoAnomalyEngine.ts';
import { sectorDivergenceEngine } from './SectorDivergenceEngine.ts';
import { newsCorrelationEngine } from './NewsCorrelationEngine.ts';
import { surveillanceScoringEngine } from './SurveillanceScoringEngine.ts';
import { ComponentAnomalyScores } from './types.ts';

export class MultiFactorAnomalyEngine {
  private static instance: MultiFactorAnomalyEngine;

  private constructor() {}

  public static getInstance(): MultiFactorAnomalyEngine {
    if (!MultiFactorAnomalyEngine.instance) {
      MultiFactorAnomalyEngine.instance = new MultiFactorAnomalyEngine();
    }
    return MultiFactorAnomalyEngine.instance;
  }

  /**
   * Synthesizes multiple data vectors into a unified composite metric.
   */
  public evaluate(inputs: {
    symbol: string;
    prices: number[];
    openPrice: number;
    prevClose: number;
    atr: number;
    volumes: number[];
    recentAtrs: number[];
    impliedVolPct?: number;
    historicalIvs?: number[];
    currentOi?: number;
    prevOi?: number;
    futuresBasis?: number;
    stockReturn: number;
    sectorReturn: number;
    indexReturn: number;
    newsSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }): {
    scores: ComponentAnomalyScores;
    evidence: string[];
  } {
    const evidence: string[] = [];

    // 1. Price evaluation
    const priceRes = priceAnomalyEngine.analyze(inputs.prices, inputs.openPrice, inputs.prevClose, inputs.atr);
    if (priceRes.score > 40) {
      evidence.push(`Price anomaly detected: displacement standard deviation is substantial (${priceRes.metrics.zScore.toFixed(2)} SD).`);
    }

    // 2. Volume evaluation
    const volumeRes = volumeAnomalyEngine.analyze(inputs.volumes, inputs.prices);
    if (volumeRes.score > 40) {
      evidence.push(`Volume anomaly detected: RVOL is ${volumeRes.metrics.relativeVolume.toFixed(1)}x above rolling baseline.`);
    }

    // 3. Volatility evaluation
    const volRes = volatilitySurveillanceEngine.analyze(inputs.prices, inputs.recentAtrs, inputs.impliedVolPct, inputs.historicalIvs);

    // 4. OI evaluation
    let oiScore = 0;
    if (inputs.currentOi !== undefined && inputs.prevOi !== undefined && inputs.futuresBasis !== undefined) {
      const oiRes = fnoAnomalyEngine.analyze(priceRes.metrics.percentageChange, inputs.currentOi, inputs.prevOi, inputs.futuresBasis);
      oiScore = oiRes.score;
      if (oiRes.metrics.longShortClassification !== 'NEUTRAL') {
        evidence.push(`F&O positioning state resolved: ${oiRes.metrics.longShortClassification} is active with OI delta of ${oiRes.metrics.oiChangePct.toFixed(1)}%.`);
      }
    }

    // 5. Sector evaluation
    const sectorRes = sectorDivergenceEngine.analyze(inputs.symbol, inputs.stockReturn, inputs.sectorReturn, inputs.indexReturn);
    evidence.push(sectorRes.evidence);

    // 6. News correlation
    const newsRes = newsCorrelationEngine.correlate(inputs.symbol, inputs.symbol === 'RELIANCE' ? 'Energy' : 'Banking', ['NIFTY 50'], new Date().toISOString(), 'PRICE_ANOMALY');
    const newsScore = newsRes.catalystStatus === 'NEWS_CONFIRMED' ? 90 : newsRes.catalystStatus === 'NEWS_POSSIBLE' ? 50 : 10;

    // Compile composite
    const scores = surveillanceScoringEngine.computeComposite(
      priceRes.score,
      volumeRes.score,
      oiScore,
      volRes.score,
      sectorRes.score,
      newsScore
    );

    return {
      scores,
      evidence,
    };
  }
}
export const multiFactorAnomalyEngine = MultiFactorAnomalyEngine.getInstance();
