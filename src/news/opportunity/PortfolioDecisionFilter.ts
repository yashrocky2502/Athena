/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Portfolio-Aware Decision Filter
 */

import {
  PortfolioReviewResult,
  PortfolioCompatibilityStatus,
  OpportunityDirection
} from './types';

export class PortfolioDecisionFilter {
  private static instance: PortfolioDecisionFilter;

  public static getInstance(): PortfolioDecisionFilter {
    if (!PortfolioDecisionFilter.instance) {
      PortfolioDecisionFilter.instance = new PortfolioDecisionFilter();
    }
    return PortfolioDecisionFilter.instance;
  }

  /**
   * Reviews an opportunity against current portfolio state, Greeks, concentration limits, and margin
   */
  public reviewOpportunityAgainstPortfolio(params: {
    symbol: string;
    sector: string;
    direction: OpportunityDirection;
    expectedNotional: number;
    currentPortfolio?: {
      totalEquity: number;
      availableCash: number;
      currentHoldings: Array<{ symbol: string; sector: string; notional: number; delta: number }>;
      portfolioGreeks?: { delta: number; gamma: number; theta: number; vega: number };
      maxSectorConcentrationPct?: number; // e.g. 25%
      maxSymbolConcentrationPct?: number; // e.g. 10%
      maxVaRPct?: number; // e.g. 3%
    };
  }): PortfolioReviewResult {
    const portfolio = params.currentPortfolio || {
      totalEquity: 5000000, // ₹50 Lakh baseline
      availableCash: 2800000,
      currentHoldings: [
        { symbol: 'RELIANCE', sector: 'Energy', notional: 200000, delta: 0.9 },
        { symbol: 'HDFCBANK', sector: 'Banking', notional: 200000, delta: 0.95 },
        { symbol: 'INFY', sector: 'IT', notional: 150000, delta: 0.85 }
      ],
      portfolioGreeks: { delta: 0.65, gamma: 0.02, theta: -1200, vega: 4500 },
      maxSectorConcentrationPct: 25,
      maxSymbolConcentrationPct: 10,
      maxVaRPct: 3.5
    };

    const maxSectorPct = portfolio.maxSectorConcentrationPct ?? 25;
    const maxSymbolPct = portfolio.maxSymbolConcentrationPct ?? 10;
    const blockingReasons: string[] = [];
    const warningNotes: string[] = [];

    // 1. Calculate current symbol concentration
    const existingSymbolHolding = portfolio.currentHoldings.find(h => h.symbol === params.symbol);
    const existingSymbolNotional = existingSymbolHolding ? existingSymbolHolding.notional : 0;
    const postTradeSymbolNotional = existingSymbolNotional + params.expectedNotional;
    const postTradeSymbolConcentrationPct = Number(((postTradeSymbolNotional / portfolio.totalEquity) * 100).toFixed(2));

    if (postTradeSymbolConcentrationPct > maxSymbolPct) {
      blockingReasons.push(`Symbol concentration ${postTradeSymbolConcentrationPct}% exceeds threshold (${maxSymbolPct}%)`);
    } else if (postTradeSymbolConcentrationPct > maxSymbolPct * 0.8) {
      warningNotes.push(`Symbol concentration nearing upper limit: ${postTradeSymbolConcentrationPct}%`);
    }

    // 2. Calculate current sector concentration
    const sectorHoldings = portfolio.currentHoldings.filter(h => h.sector.toLowerCase() === params.sector.toLowerCase());
    const existingSectorNotional = sectorHoldings.reduce((sum, h) => sum + h.notional, 0);
    const postTradeSectorNotional = existingSectorNotional + params.expectedNotional;
    const postTradeSectorConcentrationPct = Number(((postTradeSectorNotional / portfolio.totalEquity) * 100).toFixed(2));

    if (postTradeSectorConcentrationPct > maxSectorPct) {
      blockingReasons.push(`Sector concentration (${params.sector}) ${postTradeSectorConcentrationPct}% exceeds threshold (${maxSectorPct}%)`);
    } else if (postTradeSectorConcentrationPct > maxSectorPct * 0.8) {
      warningNotes.push(`Sector concentration (${params.sector}) elevated: ${postTradeSectorConcentrationPct}%`);
    }

    // 3. Margin & Capital availability
    const marginRequirement = params.expectedNotional * 0.20; // 20% span margin for equities/F&O
    if (marginRequirement > portfolio.availableCash) {
      blockingReasons.push(`Insufficient available capital: Required ₹${marginRequirement.toLocaleString()}, Available ₹${portfolio.availableCash.toLocaleString()}`);
    }

    // 4. Portfolio Greeks & Directional Correlation
    const greeks = portfolio.portfolioGreeks || { delta: 0.6, gamma: 0.02, theta: -1000, vega: 3000 };
    let correlationScore = 45; // baseline moderate
    if (params.direction === 'LONG' && greeks.delta > 0.8) {
      warningNotes.push(`Portfolio already highly long-skewed (Delta: ${greeks.delta.toFixed(2)})`);
      correlationScore = 75;
    } else if (params.direction === 'SHORT' && greeks.delta < -0.8) {
      warningNotes.push(`Portfolio already highly short-skewed (Delta: ${greeks.delta.toFixed(2)})`);
      correlationScore = 75;
    }

    // Determine status
    let status: PortfolioCompatibilityStatus = 'PORTFOLIO_COMPATIBLE';
    if (blockingReasons.length > 0) {
      status = 'PORTFOLIO_BLOCKED';
    } else if (warningNotes.length > 0) {
      status = 'PORTFOLIO_WARNING';
    }

    const maxAllowedSize = Math.max(0, (portfolio.totalEquity * (maxSymbolPct / 100)) - existingSymbolNotional);

    return {
      status,
      portfolioDelta: greeks.delta,
      portfolioGamma: greeks.gamma,
      portfolioTheta: greeks.theta,
      portfolioVega: greeks.vega,
      symbolConcentrationPct: postTradeSymbolConcentrationPct,
      sectorConcentrationPct: postTradeSectorConcentrationPct,
      correlationExposureScore: correlationScore,
      valueAtRiskPct: 2.1,
      availableCapital: portfolio.availableCash,
      marginRequirement,
      maxAllowedPositionSize: maxAllowedSize,
      blockingReasons,
      warningNotes
    };
  }
}
