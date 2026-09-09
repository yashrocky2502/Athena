/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * DerivativesMarketTruthEngine.ts
 * 
 * Deterministic derivatives market truth, options moneyness, intrinsic/extrinsic value,
 * PCR, Max Pain, and futures basis calculator.
 * ZERO-AI: 100% deterministic quantitative mathematics.
 */

import {
  CanonicalDerivativeState,
  OptionType,
  Moneyness
} from './types.ts';

export interface RawDerivativeInput {
  underlyingSymbol: string;
  underlyingPrice: number;
  instrumentType: 'FUTURES' | 'OPTIONS';
  expiry: string;
  strike?: number | null;
  optionType?: 'CALL' | 'PUT' | 'CE' | 'PE' | null;
  contractSize?: number;
  lastPrice: number;
  openInterest: number;
  previousOpenInterest?: number;
  impliedVolatility?: number | null;
  volume: number;
  bidPrice?: number | null;
  askPrice?: number | null;
}

export class DerivativesMarketTruthEngine {
  private static instance: DerivativesMarketTruthEngine;

  private defaultLotSizes: Record<string, number> = {
    'NIFTY 50': 25,
    'NIFTY BANK': 15,
    'SENSEX': 10,
    'RELIANCE': 250,
    'HDFCBANK': 550,
    'INFY': 400,
    'TCS': 175,
    'ICICIBANK': 700
  };

  private constructor() {}

  public static getInstance(): DerivativesMarketTruthEngine {
    if (!DerivativesMarketTruthEngine.instance) {
      DerivativesMarketTruthEngine.instance = new DerivativesMarketTruthEngine();
    }
    return DerivativesMarketTruthEngine.instance;
  }

  /**
   * Normalizes and calculates deterministic derivatives truth state.
   */
  public processDerivative(raw: RawDerivativeInput): CanonicalDerivativeState {
    const underlying = raw.underlyingSymbol.toUpperCase();
    const contractSize = raw.contractSize || this.defaultLotSizes[underlying] || 50;
    const ltp = raw.lastPrice > 0 ? Number(raw.lastPrice.toFixed(2)) : 0;
    const oi = Math.max(0, Math.floor(raw.openInterest));
    const prevOi = raw.previousOpenInterest !== undefined ? Math.max(0, Math.floor(raw.previousOpenInterest)) : oi;
    const oiChange = oi - prevOi;
    const oiChangePercent = prevOi > 0 ? Number(((oiChange / prevOi) * 100).toFixed(2)) : 0;

    const bidPrice = raw.bidPrice !== undefined && raw.bidPrice !== null ? Number(raw.bidPrice.toFixed(2)) : null;
    const askPrice = raw.askPrice !== undefined && raw.askPrice !== null ? Number(raw.askPrice.toFixed(2)) : null;
    const spread = (bidPrice !== null && askPrice !== null) ? Number((askPrice - bidPrice).toFixed(2)) : null;

    if (raw.instrumentType === 'FUTURES') {
      const basis = raw.underlyingPrice > 0 ? Number((ltp - raw.underlyingPrice).toFixed(2)) : null;
      const basisPercent = (basis !== null && raw.underlyingPrice > 0)
        ? Number(((basis / raw.underlyingPrice) * 100).toFixed(2))
        : null;

      return {
        underlyingSymbol: underlying,
        instrumentType: 'FUTURES',
        expiry: raw.expiry,
        strike: null,
        optionType: null,
        contractSize,
        lastPrice: ltp,
        openInterest: oi,
        openInterestChange: oiChange,
        openInterestChangePercent: oiChangePercent,
        impliedVolatility: null,
        volume: raw.volume,
        bidPrice,
        askPrice,
        spread,
        futuresBasis: basis,
        futuresBasisPercent: basisPercent,
        intrinsicValue: null,
        extrinsicValue: null,
        moneyness: null
      };
    }

    // Option Processing
    let optType: OptionType = 'CALL';
    if (raw.optionType === 'PUT' || raw.optionType === 'PE') {
      optType = 'PUT';
    }

    const strike = raw.strike ? Number(raw.strike.toFixed(2)) : raw.underlyingPrice;
    const spot = raw.underlyingPrice;

    // Intrinsic Value calculation (Deterministic)
    // CALL: max(0, Spot - Strike)
    // PUT:  max(0, Strike - Spot)
    let intrinsicValue = 0;
    if (optType === 'CALL') {
      intrinsicValue = Math.max(0, spot - strike);
    } else {
      intrinsicValue = Math.max(0, strike - spot);
    }
    intrinsicValue = Number(intrinsicValue.toFixed(2));

    // Extrinsic Value (Time Value): max(0, LTP - Intrinsic Value)
    const extrinsicValue = Math.max(0, Number((ltp - intrinsicValue).toFixed(2)));

    // Moneyness determination (Deterministic step)
    let moneyness: Moneyness = 'ATM';
    const distancePercent = spot > 0 ? ((strike - spot) / spot) * 100 : 0;

    if (optType === 'CALL') {
      if (distancePercent < -3.0) moneyness = 'DEEP_ITM';
      else if (distancePercent < -0.5) moneyness = 'ITM';
      else if (distancePercent >= -0.5 && distancePercent <= 0.5) moneyness = 'ATM';
      else if (distancePercent <= 3.0) moneyness = 'OTM';
      else moneyness = 'DEEP_OTM';
    } else {
      // PUT
      if (distancePercent > 3.0) moneyness = 'DEEP_ITM';
      else if (distancePercent > 0.5) moneyness = 'ITM';
      else if (distancePercent >= -0.5 && distancePercent <= 0.5) moneyness = 'ATM';
      else if (distancePercent >= -3.0) moneyness = 'OTM';
      else moneyness = 'DEEP_OTM';
    }

    return {
      underlyingSymbol: underlying,
      instrumentType: 'OPTIONS',
      expiry: raw.expiry,
      strike,
      optionType: optType,
      contractSize,
      lastPrice: ltp,
      openInterest: oi,
      openInterestChange: oiChange,
      openInterestChangePercent: oiChangePercent,
      impliedVolatility: raw.impliedVolatility ? Number(raw.impliedVolatility.toFixed(2)) : null,
      volume: raw.volume,
      bidPrice,
      askPrice,
      spread,
      futuresBasis: null,
      futuresBasisPercent: null,
      intrinsicValue,
      extrinsicValue,
      moneyness
    };
  }

  /**
   * Calculates Put-Call Ratio (PCR) from a list of option contracts.
   */
  public calculatePCR(options: CanonicalDerivativeState[]): number {
    let totalPutOI = 0;
    let totalCallOI = 0;

    for (const opt of options) {
      if (opt.optionType === 'PUT') totalPutOI += opt.openInterest;
      if (opt.optionType === 'CALL') totalCallOI += opt.openInterest;
    }

    if (totalCallOI === 0) return 1.0;
    return Number((totalPutOI / totalCallOI).toFixed(2));
  }

  /**
   * Calculates Max Pain strike from option chain.
   * Max Pain is the strike where option writers lose the least amount of money.
   */
  public calculateMaxPain(options: CanonicalDerivativeState[]): number | null {
    const strikes = Array.from(new Set(options.map(o => o.strike).filter((s): s is number => s !== null))).sort((a, b) => a - b);
    if (strikes.length === 0) return null;

    let minTotalLoss = Infinity;
    let maxPainStrike = strikes[0];

    for (const testStrike of strikes) {
      let totalLoss = 0;
      for (const opt of options) {
        if (opt.strike === null) continue;
        if (opt.optionType === 'CALL' && testStrike > opt.strike) {
          totalLoss += (testStrike - opt.strike) * opt.openInterest;
        } else if (opt.optionType === 'PUT' && testStrike < opt.strike) {
          totalLoss += (opt.strike - testStrike) * opt.openInterest;
        }
      }
      if (totalLoss < minTotalLoss) {
        minTotalLoss = totalLoss;
        maxPainStrike = testStrike;
      }
    }

    return maxPainStrike;
  }
}

export const derivativesMarketTruthEngine = DerivativesMarketTruthEngine.getInstance();
