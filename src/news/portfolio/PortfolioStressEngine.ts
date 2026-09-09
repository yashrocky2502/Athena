/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioStressEngine.ts
 * 
 * Stress Test Engine.
 * Evaluates portfolio resilience across 11 deterministic market stress scenarios using
 * exact options payoff models and second-order Greeks.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic calculation.
 */

import { NormalizedPosition, PortfolioStressReport, StressScenarioResult } from './types.ts';

export class PortfolioStressEngine {
  private static instance: PortfolioStressEngine;

  private constructor() {}

  public static getInstance(): PortfolioStressEngine {
    if (!this.instance) {
      this.instance = new PortfolioStressEngine();
    }
    return this.instance;
  }

  /**
   * Executes 11 deterministic stress test scenarios on portfolio positions
   */
  public runStressTests(
    positions: NormalizedPosition[],
    totalCapitalINR: number
  ): PortfolioStressReport {
    const capital = totalCapitalINR > 0 ? totalCapitalINR : 100000;

    const scenariosConfig = [
      { name: 'Market -5%', marketReturn: -0.05, volChangePct: 0.05, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Broad market benchmark decline of 5%' },
      { name: 'Market -10%', marketReturn: -0.10, volChangePct: 0.15, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Severe market sell-off of 10% with IV spike' },
      { name: 'Market +5%', marketReturn: 0.05, volChangePct: -0.05, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Broad market rally of 5%' },
      { name: 'Volatility +20%', marketReturn: -0.02, volChangePct: 0.20, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Implied Volatility spike of +20 points' },
      { name: 'Volatility -20%', marketReturn: 0.01, volChangePct: -0.20, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Volatility crush of -20 points' },
      { name: 'Gap-Down Scenario', marketReturn: -0.035, volChangePct: 0.10, gapPct: -0.035, sectorShock: 0, stockShock: 0, desc: 'Overnight gap-down open of -3.5%' },
      { name: 'Gap-Up Scenario', marketReturn: 0.035, volChangePct: -0.05, gapPct: 0.035, sectorShock: 0, stockShock: 0, desc: 'Overnight gap-up open of +3.5%' },
      { name: 'Sector Shock (-8%)', marketReturn: -0.015, volChangePct: 0.08, gapPct: 0, sectorShock: -0.08, stockShock: 0, desc: '-8% sudden shock across major portfolio sector' },
      { name: 'Underlying Stock Shock (-12%)', marketReturn: -0.01, volChangePct: 0.10, gapPct: 0, sectorShock: 0, stockShock: -0.12, desc: '-12% adverse shock to top underlying position' },
      { name: 'Correlation Spike', marketReturn: -0.06, volChangePct: 0.12, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Correlation breakdown, all asset betas surge to 1.5' },
      { name: 'Liquidity Deterioration', marketReturn: -0.03, volChangePct: 0.05, gapPct: 0, sectorShock: 0, stockShock: 0, desc: 'Slippage expands to 1.5% with liquidity freeze' }
    ];

    const results: StressScenarioResult[] = [];
    let worstCaseLossINR = 0;
    let worstCaseLossPct = 0;
    let worstCaseScenarioName = 'Market -10%';

    for (const sc of scenariosConfig) {
      let scenarioPnLINR = 0;
      let scenarioMarginImpactINR = 0;

      for (const pos of positions) {
        const S = pos.currentPrice || 100;
        const qty = pos.netQuantity;
        const beta = sc.name === 'Correlation Spike' ? 1.5 : (pos.beta || 1.0);

        // Effective price change for this position
        let priceChangePct = sc.marketReturn * beta + sc.gapPct;
        if (sc.sectorShock !== 0 && pos.sector !== 'GENERAL') {
          priceChangePct += sc.sectorShock;
        }
        if (sc.stockShock !== 0 && pos === positions[0]) {
          priceChangePct += sc.stockShock;
        }

        const dS = S * priceChangePct;

        if (pos.assetClass === 'EQUITY' || pos.assetClass === 'FUTURES') {
          const mult = pos.assetClass === 'FUTURES' ? pos.leverage : 1.0;
          let pnl = qty * dS * mult;
          if (sc.name === 'Liquidity Deterioration') {
            pnl -= Math.abs(qty * S) * 0.015; // 1.5% slippage penalty
          }
          scenarioPnLINR += pnl;
        } else if (pos.assetClass === 'OPTIONS') {
          const g = pos.greeks || { delta: 0, gamma: 0, theta: 0, vega: 0 };
          const dIV = sc.volChangePct * 100; // vol change in points

          // Taylor expansion for options payoff: Delta*dS + 0.5*Gamma*dS^2 + Vega*dIV
          const deltaPnl = qty * g.delta * dS;
          const gammaPnl = 0.5 * Math.abs(qty) * g.gamma * (dS * dS);
          const vegaPnl = Math.abs(qty) * g.vega * dIV;

          let optionPnl = deltaPnl + gammaPnl + vegaPnl;
          if (sc.name === 'Liquidity Deterioration') {
            optionPnl -= Math.abs(qty * S) * 0.015;
          }
          scenarioPnLINR += optionPnl;
          scenarioMarginImpactINR += Math.abs(qty * S) * (sc.volChangePct * 0.2);
        }
      }

      const projectedPnLINR = Math.round(scenarioPnLINR);
      const projectedPnLPct = Number(((projectedPnLINR / capital) * 100).toFixed(2));
      const projectedDrawdownPct = projectedPnLPct < 0 ? Math.abs(projectedPnLPct) : 0;

      let riskClassification: 'SAFE' | 'MODERATE_LOSS' | 'SEVERE_LOSS' | 'CATASTROPIC_LOSS' = 'SAFE';
      if (projectedPnLPct < -15.0) riskClassification = 'CATASTROPIC_LOSS';
      else if (projectedPnLPct < -8.0) riskClassification = 'SEVERE_LOSS';
      else if (projectedPnLPct < -3.0) riskClassification = 'MODERATE_LOSS';

      if (projectedPnLINR < worstCaseLossINR) {
        worstCaseLossINR = projectedPnLINR;
        worstCaseLossPct = projectedPnLPct;
        worstCaseScenarioName = sc.name;
      }

      results.push({
        scenarioName: sc.name,
        description: sc.desc,
        projectedPnLINR,
        projectedPnLPct,
        projectedDrawdownPct,
        marginImpactINR: Math.round(scenarioMarginImpactINR),
        riskClassification
      });
    }

    // Overall Stress Score (0 = extreme vulnerability, 100 = safe)
    const worstLossPctAbs = Math.abs(worstCaseLossPct);
    const overallStressScore = Math.min(100, Math.max(0, Math.round(100 - worstLossPctAbs * 4)));

    return {
      overallStressScore,
      worstCaseLossINR,
      worstCaseLossPct,
      worstCaseScenarioName,
      scenarios: results
    };
  }
}

export const portfolioStressEngine = PortfolioStressEngine.getInstance();
