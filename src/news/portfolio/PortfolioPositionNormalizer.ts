/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioPositionNormalizer.ts
 * 
 * Position Normalization Engine.
 * Converts raw positions across Equity, Futures, Options, and Multi-leg Spreads
 * into a standardized, deterministic internal representation.
 * 
 * ZERO-AI COST CONTRACT: 100% mathematical normalization.
 */

import { RawPortfolioPosition, NormalizedPosition, PositionAssetClass } from './types.ts';

export class PortfolioPositionNormalizer {
  private static instance: PortfolioPositionNormalizer;

  private constructor() {}

  public static getInstance(): PortfolioPositionNormalizer {
    if (!this.instance) {
      this.instance = new PortfolioPositionNormalizer();
    }
    return this.instance;
  }

  /**
   * Normalizes a single raw portfolio position into canonical NormalizedPosition
   */
  public normalizePosition(raw: RawPortfolioPosition): NormalizedPosition {
    const qty = Math.abs(raw.quantity || 0);
    const isLong = raw.side === 'LONG';
    const netQuantity = isLong ? qty : -qty;
    const grossQuantity = qty;

    const currentPrice = raw.currentPrice > 0 ? raw.currentPrice : (raw.entryPrice > 0 ? raw.entryPrice : 100);
    const entryPrice = raw.entryPrice > 0 ? raw.entryPrice : currentPrice;

    const assetClass: PositionAssetClass = raw.assetClass || 'EQUITY';
    const leverage = raw.leverage && raw.leverage > 0 ? raw.leverage : (assetClass === 'FUTURES' ? 5 : 1);

    // Current Market Value
    let currentMarketValueINR = qty * currentPrice;

    // Notional Exposure
    let notionalExposureINR = 0;
    if (assetClass === 'EQUITY') {
      notionalExposureINR = qty * currentPrice;
    } else if (assetClass === 'FUTURES') {
      notionalExposureINR = qty * currentPrice * leverage;
    } else if (assetClass === 'OPTIONS') {
      const strike = raw.strikePrice || currentPrice;
      notionalExposureINR = qty * strike;
    } else {
      notionalExposureINR = qty * currentPrice;
    }

    // Directional Exposure
    let directionalExposureINR = 0;
    if (assetClass === 'EQUITY' || assetClass === 'FUTURES') {
      directionalExposureINR = netQuantity * currentPrice * leverage;
    } else if (assetClass === 'OPTIONS') {
      const delta = raw.delta !== undefined ? raw.delta : (raw.optionType === 'CALL' ? (isLong ? 0.5 : -0.5) : (isLong ? -0.5 : 0.5));
      const strike = raw.strikePrice || currentPrice;
      // Directional delta exposure in INR
      directionalExposureINR = (isLong ? qty : -qty) * delta * strike;
    }

    // Leveraged Exposure
    const leveragedExposureINR = notionalExposureINR * leverage;

    // Unrealized & Realized P&L
    let unrealizedPnLINR = raw.unrealizedPnLINR;
    if (unrealizedPnLINR === undefined || isNaN(unrealizedPnLINR)) {
      if (isLong) {
        unrealizedPnLINR = (currentPrice - entryPrice) * qty;
      } else {
        unrealizedPnLINR = (entryPrice - currentPrice) * qty;
      }
    }
    const realizedPnLINR = raw.realizedPnLINR || 0;

    // Sector & Index Defaults
    const sector = raw.sector || 'GENERAL';
    const indexSymbol = raw.indexSymbol || 'NIFTY';
    const beta = raw.beta !== undefined && !isNaN(raw.beta) ? raw.beta : 1.0;

    // Options Greeks
    let delta = raw.delta || 0;
    let gamma = raw.gamma || 0;
    let theta = raw.theta || 0;
    let vega = raw.vega || 0;

    if (assetClass === 'OPTIONS') {
      if (raw.delta === undefined) {
        const sign = raw.optionType === 'CALL' ? 1 : -1;
        delta = isLong ? sign * 0.5 : -sign * 0.5;
      }
      if (raw.gamma === undefined) gamma = 0.002 * (isLong ? 1 : -1);
      if (raw.theta === undefined) theta = -2.5 * (isLong ? 1 : -1);
      if (raw.vega === undefined) vega = 1.8 * (isLong ? 1 : -1);
    } else if (assetClass === 'EQUITY' || assetClass === 'FUTURES') {
      delta = isLong ? 1.0 : -1.0;
    }

    // Days to expiry calculation
    let daysToExpiry = undefined;
    if (raw.expiryDate) {
      const expDate = new Date(raw.expiryDate);
      const now = new Date();
      const diffTime = expDate.getTime() - now.getTime();
      daysToExpiry = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return {
      id: raw.id || `pos-${raw.symbol}-${Date.now()}`,
      symbol: raw.symbol,
      underlyingSymbol: raw.underlyingSymbol || raw.symbol,
      assetClass,
      side: raw.side,
      netQuantity,
      grossQuantity,
      entryPrice,
      currentPrice,
      currentMarketValueINR,
      notionalExposureINR,
      directionalExposureINR,
      leveragedExposureINR,
      unrealizedPnLINR,
      realizedPnLINR,
      sector,
      indexSymbol,
      beta,
      leverage,
      stopLossPrice: raw.stopLossPrice || (isLong ? currentPrice * 0.95 : currentPrice * 1.05),
      targetPrice: raw.targetPrice || (isLong ? currentPrice * 1.10 : currentPrice * 0.90),
      optionType: raw.optionType,
      strikePrice: raw.strikePrice,
      expiryDate: raw.expiryDate,
      daysToExpiry,
      greeks: {
        delta,
        gamma,
        theta,
        vega
      },
      strategyGroupTag: raw.strategyGroupTag
    };
  }

  /**
   * Normalizes an array of raw positions
   */
  public normalizePositions(rawList: RawPortfolioPosition[]): NormalizedPosition[] {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .filter(p => p && p.quantity && Math.abs(p.quantity) > 0)
      .map(p => this.normalizePosition(p));
  }
}

export const portfolioPositionNormalizer = PortfolioPositionNormalizer.getInstance();
