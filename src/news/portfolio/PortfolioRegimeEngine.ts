/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioRegimeEngine.ts
 * 
 * Market Regime Exposure Engine.
 * Evaluates portfolio alignment under Bullish, Bearish, Sideways, High Volatility, and Low Volatility regimes.
 * Integrates with Phase 11/12 Market Regime classification.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, MarketRegimeExposureReport, PortfolioRegimeStatus } from './types.ts';

export class PortfolioRegimeEngine {
  private static instance: PortfolioRegimeEngine;

  private constructor() {}

  public static getInstance(): PortfolioRegimeEngine {
    if (!this.instance) {
      this.instance = new PortfolioRegimeEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates portfolio exposure under various market regimes
   */
  public evaluateRegimeExposure(
    positions: NormalizedPosition[],
    currentRegime: string = 'BALANCED'
  ): MarketRegimeExposureReport {
    let netDeltaINR = 0;
    let netVegaSum = 0;
    let riskOnExposureINR = 0;
    let riskOffExposureINR = 0;

    for (const pos of positions) {
      const dirExp = pos.directionalExposureINR || 0;
      netDeltaINR += dirExp;

      const g = pos.greeks || { vega: 0 };
      netVegaSum += g.vega * pos.netQuantity;

      if (dirExp > 0) {
        riskOnExposureINR += dirExp;
      } else if (dirExp < 0) {
        riskOffExposureINR += Math.abs(dirExp);
      }
    }

    // Stress PnL projections across regimes
    const bullishRegimeStressPnLINR = Math.round(netDeltaINR * 0.05 + netVegaSum * 50);
    const bearishRegimeStressPnLINR = Math.round(-netDeltaINR * 0.05 + netVegaSum * 100);
    const sidewaysRegimeStressPnLINR = Math.round(-Math.abs(netDeltaINR) * 0.02 - netVegaSum * 50);
    const highVolRegimeStressPnLINR = Math.round(netVegaSum * 200 - Math.abs(netDeltaINR) * 0.03);
    const lowVolRegimeStressPnLINR = Math.round(-netVegaSum * 150 + netDeltaINR * 0.02);

    // Classification
    let regimeStatus: PortfolioRegimeStatus = 'REGIME_NEUTRAL';
    let rationale = '';

    const normalizedRegime = (currentRegime || 'BALANCED').toUpperCase();

    if (normalizedRegime.includes('BULL') || normalizedRegime.includes('RISK_ON')) {
      if (netDeltaINR > 0) {
        regimeStatus = 'REGIME_ALIGNED';
        rationale = `Portfolio Net Long Delta (₹${Math.round(netDeltaINR)}) aligns with ${normalizedRegime} regime.`;
      } else if (netDeltaINR < -50000) {
        regimeStatus = 'REGIME_CONTRADICTED';
        rationale = `Portfolio Net Short Delta (₹${Math.round(netDeltaINR)}) CONTRADICTS ${normalizedRegime} regime.`;
      } else {
        regimeStatus = 'REGIME_VULNERABLE';
        rationale = `Portfolio lacks sufficient long exposure for ${normalizedRegime} regime.`;
      }
    } else if (normalizedRegime.includes('BEAR') || normalizedRegime.includes('RISK_OFF')) {
      if (netDeltaINR < 0) {
        regimeStatus = 'REGIME_ALIGNED';
        rationale = `Portfolio Net Short Delta (₹${Math.round(netDeltaINR)}) aligns with ${normalizedRegime} regime.`;
      } else if (netDeltaINR > 50000) {
        regimeStatus = 'REGIME_CONTRADICTED';
        rationale = `Portfolio Net Long Delta (₹${Math.round(netDeltaINR)}) CONTRADICTS ${normalizedRegime} regime.`;
      } else {
        regimeStatus = 'REGIME_VULNERABLE';
        rationale = `Portfolio lacks downside protection for ${normalizedRegime} regime.`;
      }
    } else if (normalizedRegime.includes('HIGH_VOL') || normalizedRegime.includes('VOLATILE')) {
      if (netVegaSum < -10) {
        regimeStatus = 'REGIME_VULNERABLE';
        rationale = `Net Short Vega (${netVegaSum.toFixed(1)}) is vulnerable to ${normalizedRegime} regime spikes.`;
      } else {
        regimeStatus = 'REGIME_NEUTRAL';
        rationale = `Portfolio vega profile is balanced for ${normalizedRegime} regime.`;
      }
    } else {
      regimeStatus = 'REGIME_NEUTRAL';
      rationale = `Portfolio exposure is balanced across market regimes.`;
    }

    return {
      currentRegime: normalizedRegime,
      regimeStatus,
      bullishRegimeStressPnLINR,
      bearishRegimeStressPnLINR,
      sidewaysRegimeStressPnLINR,
      highVolRegimeStressPnLINR,
      lowVolRegimeStressPnLINR,
      riskOnExposureINR: Math.round(riskOnExposureINR),
      riskOffExposureINR: Math.round(riskOffExposureINR),
      rationale
    };
  }
}

export const portfolioRegimeEngine = PortfolioRegimeEngine.getInstance();
