/**
 * ATHENA — Phase 18 Liquidity Surveillance Engine
 * LiquiditySurveillanceEngine.ts
 */

import { LiquidityMetrics } from './types.ts';

export class LiquiditySurveillanceEngine {
  private static instance: LiquiditySurveillanceEngine;

  private constructor() {}

  public static getInstance(): LiquiditySurveillanceEngine {
    if (!LiquiditySurveillanceEngine.instance) {
      LiquiditySurveillanceEngine.instance = new LiquiditySurveillanceEngine();
    }
    return LiquiditySurveillanceEngine.instance;
  }

  public analyze(
    bidAskSpreadPct: number,
    depthVolumeRatio: number, // bid depth relative to ask depth
    slippagePct: number = 0
  ): { metrics: LiquidityMetrics; score: number } {
    let liquidityState: 'LIQUIDITY_NORMAL' | 'LIQUIDITY_DETERIORATING' | 'LIQUIDITY_SHOCK' = 'LIQUIDITY_NORMAL';

    const extremeSpread = bidAskSpreadPct > 0.5; // Spread > 50 bps
    const highSpread = bidAskSpreadPct > 0.15; // Spread > 15 bps

    if (extremeSpread || slippagePct > 0.8) {
      liquidityState = 'LIQUIDITY_SHOCK';
    } else if (highSpread || slippagePct > 0.3) {
      liquidityState = 'LIQUIDITY_DETERIORATING';
    }

    // Impact score 0 to 100
    let priceImpactScore = 0;
    priceImpactScore += Math.min(bidAskSpreadPct * 150, 40); // Max 40 from spread
    priceImpactScore += Math.min(slippagePct * 100, 30); // Max 30 from slippage
    priceImpactScore += (liquidityState === 'LIQUIDITY_SHOCK') ? 30 : (liquidityState === 'LIQUIDITY_DETERIORATING') ? 15 : 0;

    return {
      metrics: {
        bidAskSpreadPct,
        priceImpactScore: Math.min(Math.round(priceImpactScore), 100),
        liquidityState,
      },
      score: Math.min(Math.max(Math.round(priceImpactScore), 0), 100),
    };
  }
}
export const liquiditySurveillanceEngine = LiquiditySurveillanceEngine.getInstance();
