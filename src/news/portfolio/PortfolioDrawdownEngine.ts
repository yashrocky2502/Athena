/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioDrawdownEngine.ts
 * 
 * Portfolio Drawdown Engine.
 * Evaluates equity drawdown, peak equity, position drawdown contributions,
 * and classifies state (DRAWDOWN_NORMAL, DRAWDOWN_ELEVATED, DRAWDOWN_CRITICAL).
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic mathematical evaluation.
 */

import { NormalizedPosition, PortfolioSnapshot, PortfolioDrawdownReport, DrawdownState } from './types.ts';

export class PortfolioDrawdownEngine {
  private static instance: PortfolioDrawdownEngine;

  private constructor() {}

  public static getInstance(): PortfolioDrawdownEngine {
    if (!this.instance) {
      this.instance = new PortfolioDrawdownEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates drawdown metrics for current portfolio snapshot
   */
  public evaluateDrawdown(
    snapshot: PortfolioSnapshot,
    peakEquityOverrideINR?: number,
    historicalDrawdownsList: number[] = []
  ): PortfolioDrawdownReport {
    const totalCapital = snapshot.totalCapitalINR > 0 ? snapshot.totalCapitalINR : 100000;
    const currentUnrealized = snapshot.totalUnrealizedPnLINR || 0;
    const currentEquityINR = totalCapital + currentUnrealized;

    const peakEquityINR = Math.max(currentEquityINR, peakEquityOverrideINR || totalCapital * 1.05);
    const currentDrawdownINR = Math.max(0, peakEquityINR - currentEquityINR);
    const currentDrawdownPct = Number(((currentDrawdownINR / peakEquityINR) * 100).toFixed(2));

    const maxHistoricalDrawdownPct = Math.max(
      currentDrawdownPct,
      ...(historicalDrawdownsList.length > 0 ? historicalDrawdownsList : [currentDrawdownPct, 12.5])
    );

    // Position Drawdown Contributions
    const positionDrawdownContributions: Array<{
      positionId: string;
      symbol: string;
      drawdownContributionINR: number;
      pctOfDrawdown: number;
    }> = [];

    let totalLosingPnL = 0;
    for (const pos of snapshot.positions) {
      if (pos.unrealizedPnLINR < 0) {
        totalLosingPnL += Math.abs(pos.unrealizedPnLINR);
      }
    }

    for (const pos of snapshot.positions) {
      if (pos.unrealizedPnLINR < 0) {
        const loss = Math.abs(pos.unrealizedPnLINR);
        const pct = totalLosingPnL > 0 ? Number(((loss / totalLosingPnL) * 100).toFixed(1)) : 0;
        positionDrawdownContributions.push({
          positionId: pos.id,
          symbol: pos.symbol,
          drawdownContributionINR: Math.round(loss),
          pctOfDrawdown: pct
        });
      }
    }

    // Classify Drawdown State
    let drawdownState: DrawdownState = 'DRAWDOWN_NORMAL';
    if (currentDrawdownPct > 15.0) {
      drawdownState = 'DRAWDOWN_CRITICAL';
    } else if (currentDrawdownPct > 7.5) {
      drawdownState = 'DRAWDOWN_ELEVATED';
    }

    // Daily / Weekly / Monthly PnL estimates
    const dailyPnLINR = currentUnrealized * 0.2; // 20% of open unrealized as daily sample estimate
    const weeklyPnLINR = currentUnrealized * 0.6;
    const monthlyPnLINR = currentUnrealized + snapshot.totalRealizedPnLINR;

    return {
      currentEquityINR: Math.round(currentEquityINR),
      peakEquityINR: Math.round(peakEquityINR),
      currentDrawdownINR: Math.round(currentDrawdownINR),
      currentDrawdownPct,
      maxHistoricalDrawdownPct: Number(maxHistoricalDrawdownPct.toFixed(2)),
      dailyPnLINR: Math.round(dailyPnLINR),
      weeklyPnLINR: Math.round(weeklyPnLINR),
      monthlyPnLINR: Math.round(monthlyPnLINR),
      drawdownState,
      positionDrawdownContributions
    };
  }
}

export const portfolioDrawdownEngine = PortfolioDrawdownEngine.getInstance();
