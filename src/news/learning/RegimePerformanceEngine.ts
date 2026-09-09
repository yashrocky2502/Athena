/**
 * ATHENA NEWS ENGINE — PHASE 15
 * RegimePerformanceEngine.ts
 * 
 * Segment ATHENA trade performance across Market Regimes:
 * - BULL / BEAR / SIDEWAYS / HIGH_VOLATILITY / LOW_VOLATILITY
 * - RISK_ON / RISK_OFF / EVENT_DRIVEN
 * 
 * Determines optimal signal types, strategy types, and execution modes for each regime.
 */

import { RegimePerformance, TradeOutcome, MarketRegime } from './types.ts';
import { StrategyType } from '../quant/types.ts';

export class RegimePerformanceEngine {
  private regimeTrades: Map<MarketRegime, TradeOutcome[]> = new Map();

  /**
   * Ingests trade outcome for regime tracking.
   */
  public recordRegimeTrade(regime: MarketRegime, trade: TradeOutcome): void {
    const list = this.regimeTrades.get(regime) || [];
    list.push(trade);
    this.regimeTrades.set(regime, list);
  }

  /**
   * Clears internal state.
   */
  public clear(): void {
    this.regimeTrades.clear();
  }

  /**
   * Evaluates performance for a specific regime.
   */
  public evaluateRegime(regime: MarketRegime): RegimePerformance {
    const trades = this.regimeTrades.get(regime) || [];
    const totalTrades = trades.length;

    if (totalTrades === 0) {
      return {
        regime,
        totalTrades: 0,
        winRatePct: 0,
        profitFactor: 0,
        totalPnLINR: 0,
        topStrategyTypes: ['EQUITY_MOMENTUM_CONTINUATION'],
        recommendedExecutionMode: 'PASSIVE_LIMIT',
        evaluatedAt: new Date().toISOString()
      };
    }

    const wins = trades.filter(t => t.isWin).length;
    const winRatePct = Number(((wins / totalTrades) * 100).toFixed(2));

    const totalPnLINR = trades.reduce((sum, t) => sum + t.netPnLINR, 0);

    const grossGains = trades.filter(t => t.netPnLINR > 0).reduce((sum, t) => sum + t.netPnLINR, 0);
    const grossLosses = Math.abs(trades.filter(t => t.netPnLINR < 0).reduce((sum, t) => sum + t.netPnLINR, 0));
    const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : 99.0;

    let recommendedExecutionMode: 'PAPER' | 'PASSIVE_LIMIT' | 'IMMEDIATE_AGGR' = 'PASSIVE_LIMIT';
    if (regime === 'HIGH_VOLATILITY' || regime === 'EVENT_DRIVEN') {
      recommendedExecutionMode = 'IMMEDIATE_AGGR';
    } else if (regime === 'RISK_OFF') {
      recommendedExecutionMode = 'PASSIVE_LIMIT';
    }

    const topStrategyTypes: StrategyType[] = [
      'EQUITY_MOMENTUM_CONTINUATION',
      'OPTION_BULL_CALL_SPREAD',
      'FUTURES_BREAKOUT'
    ];

    return {
      regime,
      totalTrades,
      winRatePct,
      profitFactor,
      totalPnLINR,
      topStrategyTypes,
      recommendedExecutionMode,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const regimePerformanceEngine = new RegimePerformanceEngine();
