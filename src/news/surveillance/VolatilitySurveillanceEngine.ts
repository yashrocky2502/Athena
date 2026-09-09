/**
 * ATHENA — Phase 18 Volatility Surveillance Engine
 * VolatilitySurveillanceEngine.ts
 */

import { VolatilityMetrics } from './types.ts';

export class VolatilitySurveillanceEngine {
  private static instance: VolatilitySurveillanceEngine;

  private constructor() {}

  public static getInstance(): VolatilitySurveillanceEngine {
    if (!VolatilitySurveillanceEngine.instance) {
      VolatilitySurveillanceEngine.instance = new VolatilitySurveillanceEngine();
    }
    return VolatilitySurveillanceEngine.instance;
  }

  public analyze(
    prices: number[],
    recentAtrs: number[],
    impliedVolPct?: number,
    historicalIvs: number[] = []
  ): { metrics: VolatilityMetrics; score: number } {
    const defaultVol: VolatilityMetrics = {
      realizedVolPct: 15.0,
      atr: 1.5,
      volPercentile: 50,
      volAccelerationPct: 0,
      volRegime: 'NORMAL',
    };

    if (prices.length < 5) {
      return { metrics: defaultVol, score: 20 };
    }

    // Realized Volatility % (Standard deviation of daily logs/percentage returns annualized)
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(((prices[i] - prices[i - 1]) / prices[i - 1]) * 100);
    }
    const meanReturn = returns.reduce((acc, r) => acc + r, 0) / returns.length;
    const returnVar = returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length;
    // Mock annualization factor of 252 trading sessions
    const realizedVolPct = Math.sqrt(returnVar) * Math.sqrt(252) || 12.0;

    const currentAtr = recentAtrs[recentAtrs.length - 1] || 1.5;
    const prevAtr = recentAtrs[recentAtrs.length - 2] || currentAtr;
    const volAccelerationPct = prevAtr > 0 ? ((currentAtr - prevAtr) / prevAtr) * 100 : 0;

    // IV statistics
    let ivRank: number | undefined;
    let ivPercentile: number | undefined;

    if (impliedVolPct !== undefined && historicalIvs.length > 0) {
      const minIv = Math.min(...historicalIvs);
      const maxIv = Math.max(...historicalIvs);
      ivRank = maxIv !== minIv ? ((impliedVolPct - minIv) / (maxIv - minIv)) * 100 : 50;

      const sortedIvs = [...historicalIvs].sort((a, b) => a - b);
      const ivIndex = sortedIvs.indexOf(impliedVolPct);
      ivPercentile = (ivIndex / historicalIvs.length) * 100;
    }

    // Determine Volatility Regime
    let volRegime: 'VOLATILITY_EXPANSION' | 'VOLATILITY_COMPRESSION' | 'NORMAL' = 'NORMAL';
    if (volAccelerationPct > 15 || (impliedVolPct && ivPercentile && ivPercentile > 80)) {
      volRegime = 'VOLATILITY_EXPANSION';
    } else if (volAccelerationPct < -10 || (impliedVolPct && ivPercentile && ivPercentile < 20)) {
      volRegime = 'VOLATILITY_COMPRESSION';
    }

    // Volatility percentile calculated across the ATR array
    const sortedAtrs = [...recentAtrs].sort((a, b) => a - b);
    const atrIdx = sortedAtrs.indexOf(currentAtr);
    const volPercentile = recentAtrs.length > 0 ? (atrIdx / recentAtrs.length) * 100 : 50;

    // Scoring (0-100)
    let score = 0;
    score += Math.min(Math.max(volAccelerationPct * 1.5, 0), 30); // Max 30 from expansion velocity
    score += Math.min(volPercentile * 0.4, 40); // Max 40 from Percentile Rank
    if (ivPercentile !== undefined) {
      score += Math.min(ivPercentile * 0.3, 30); // Max 30 from options implied volatility ranking
    } else {
      score += volRegime === 'VOLATILITY_EXPANSION' ? 20 : 0;
    }

    return {
      metrics: {
        realizedVolPct,
        atr: currentAtr,
        volPercentile,
        volAccelerationPct,
        impliedVolPct,
        ivRank,
        ivPercentile,
        volRegime,
      },
      score: Math.min(Math.max(Math.round(score), 0), 100),
    };
  }
}
export const volatilitySurveillanceEngine = VolatilitySurveillanceEngine.getInstance();
