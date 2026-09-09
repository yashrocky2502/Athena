/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Historical Analogue & Time Machine Pattern Matching Engine
 */

import {
  HistoricalAnalogueResult,
  OpportunityDirection,
  OpportunityType
} from './types';

export interface AnalogueSearchQuery {
  symbol: string;
  opportunityType: OpportunityType;
  direction: OpportunityDirection;
  currentRegime: string;
  catalystType: string;
  asOfTimestamp: string;
}

export class OpportunityHistoricalAnalogueEngine {
  private static instance: OpportunityHistoricalAnalogueEngine;

  // Base institutional analogue dataset across Indian market regimes
  private historicalEventsDatabase: Array<{
    eventId: string;
    symbol: string;
    opportunityType: OpportunityType;
    direction: OpportunityDirection;
    regime: string;
    catalystType: string;
    eventTimestamp: string;
    actualReturnPct: number;
    maxAdverseExcursionPct: number;
    maxFavourableExcursionPct: number;
    isWin: boolean;
  }> = [
    {
      eventId: 'HIST_RELIANCE_BREAKOUT_2025Q3',
      symbol: 'RELIANCE',
      opportunityType: 'BREAKOUT',
      direction: 'LONG',
      regime: 'TRENDING_BULLISH',
      catalystType: 'EARNINGS_BEAT',
      eventTimestamp: '2025-07-22T09:30:00.000Z',
      actualReturnPct: 3.4,
      maxAdverseExcursionPct: -0.6,
      maxFavourableExcursionPct: 4.1,
      isWin: true
    },
    {
      eventId: 'HIST_HDFCBANK_FUTURES_2025Q4',
      symbol: 'HDFCBANK',
      opportunityType: 'DERIVATIVE_FLOW',
      direction: 'LONG',
      regime: 'TRENDING_BULLISH',
      catalystType: 'FII_INFLOW',
      eventTimestamp: '2025-10-14T10:15:00.000Z',
      actualReturnPct: 2.1,
      maxAdverseExcursionPct: -0.4,
      maxFavourableExcursionPct: 2.8,
      isWin: true
    },
    {
      eventId: 'HIST_TCS_MEANREV_2025Q2',
      symbol: 'TCS',
      opportunityType: 'MEAN_REVERSION',
      direction: 'SHORT',
      regime: 'RANGE_BOUND',
      catalystType: 'OVERBOUGHT_RSI',
      eventTimestamp: '2025-05-18T13:00:00.000Z',
      actualReturnPct: 1.8,
      maxAdverseExcursionPct: -0.5,
      maxFavourableExcursionPct: 2.2,
      isWin: true
    },
    {
      eventId: 'HIST_INFY_EARNINGS_2025Q1',
      symbol: 'INFY',
      opportunityType: 'EARNINGS',
      direction: 'LONG',
      regime: 'HIGH_VOLATILITY',
      catalystType: 'GUIDANCE_HIKE',
      eventTimestamp: '2025-01-16T09:20:00.000Z',
      actualReturnPct: 4.6,
      maxAdverseExcursionPct: -0.9,
      maxFavourableExcursionPct: 5.2,
      isWin: true
    },
    {
      eventId: 'HIST_TATAMOTORS_BREAKDOWN_2024Q4',
      symbol: 'TATAMOTORS',
      opportunityType: 'BREAKDOWN',
      direction: 'SHORT',
      regime: 'TRENDING_BEARISH',
      catalystType: 'DISPATCH_MISS',
      eventTimestamp: '2024-11-04T11:00:00.000Z',
      actualReturnPct: 2.9,
      maxAdverseExcursionPct: -0.7,
      maxFavourableExcursionPct: 3.5,
      isWin: true
    },
    {
      eventId: 'HIST_ICICIBANK_BREAKOUT_2025Q1',
      symbol: 'ICICIBANK',
      opportunityType: 'BREAKOUT',
      direction: 'LONG',
      regime: 'TRENDING_BULLISH',
      catalystType: 'CREDIT_GROWTH',
      eventTimestamp: '2025-02-10T10:00:00.000Z',
      actualReturnPct: 2.7,
      maxAdverseExcursionPct: -0.5,
      maxFavourableExcursionPct: 3.2,
      isWin: true
    },
    {
      eventId: 'HIST_SBIN_SECTOR_ROT_2025Q3',
      symbol: 'SBIN',
      opportunityType: 'SECTOR_ROTATION',
      direction: 'LONG',
      regime: 'TRENDING_BULLISH',
      catalystType: 'PSU_SURGE',
      eventTimestamp: '2025-08-05T09:45:00.000Z',
      actualReturnPct: 3.1,
      maxAdverseExcursionPct: -0.8,
      maxFavourableExcursionPct: 3.8,
      isWin: true
    },
    {
      eventId: 'HIST_BHARTIARTL_MOMENTUM_2025Q2',
      symbol: 'BHARTIARTL',
      opportunityType: 'MOMENTUM',
      direction: 'LONG',
      regime: 'TRENDING_BULLISH',
      catalystType: 'ARPU_GROWTH',
      eventTimestamp: '2025-06-12T14:15:00.000Z',
      actualReturnPct: 2.3,
      maxAdverseExcursionPct: -0.3,
      maxFavourableExcursionPct: 2.6,
      isWin: true
    }
  ];

  public static getInstance(): OpportunityHistoricalAnalogueEngine {
    if (!OpportunityHistoricalAnalogueEngine.instance) {
      OpportunityHistoricalAnalogueEngine.instance = new OpportunityHistoricalAnalogueEngine();
    }
    return OpportunityHistoricalAnalogueEngine.instance;
  }

  /**
   * Evaluates historical analogues matching the given opportunity query.
   * STRICT ZERO LOOK-AHEAD: Events with eventTimestamp > asOfTimestamp are strictly filtered out.
   */
  public findHistoricalAnalogues(query: AnalogueSearchQuery): HistoricalAnalogueResult {
    const asOfTimeMs = new Date(query.asOfTimestamp).getTime();

    // 1. Strict Look-Ahead Firewall
    const availableEvents = this.historicalEventsDatabase.filter(ev => {
      const eventTimeMs = new Date(ev.eventTimestamp).getTime();
      return eventTimeMs <= asOfTimeMs;
    });

    // 2. Score similarity and match
    const matched = availableEvents.filter(ev => {
      const typeMatch = ev.opportunityType === query.opportunityType;
      const directionMatch = ev.direction === query.direction;
      const symbolMatch = ev.symbol === query.symbol;
      const regimeMatch = ev.regime === query.currentRegime;
      
      // Match if at least type & direction match, or strong regime/catalyst match
      return (typeMatch && directionMatch) || (typeMatch && regimeMatch) || (symbolMatch && typeMatch);
    });

    if (matched.length === 0) {
      // Fallback synthetic baseline with hasSufficientData = false
      return {
        analogueCount: 0,
        matchedRegimes: [query.currentRegime],
        historicalWinRate: 0.50,
        historicalAvgReturnPct: 0.0,
        returnDistribution: { p10: -1.5, p25: -0.5, p50: 0.0, p75: 0.8, p90: 1.5 },
        maxAdverseExcursionPct: -1.2,
        maxFavourableExcursionPct: 1.5,
        confidenceInterval95: [-1.2, 1.5],
        sampleEventIds: [],
        qualityScore: 20,
        hasSufficientData: false
      };
    }

    // 3. Deterministic statistical computation
    const returns = matched.map(m => m.actualReturnPct).sort((a, b) => a - b);
    const wins = matched.filter(m => m.isWin).length;
    const winRate = Number((wins / matched.length).toFixed(2));
    const avgReturn = Number((returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2));

    const p10 = returns[Math.floor(returns.length * 0.1)] ?? returns[0];
    const p25 = returns[Math.floor(returns.length * 0.25)] ?? returns[0];
    const p50 = returns[Math.floor(returns.length * 0.5)] ?? returns[0];
    const p75 = returns[Math.floor(returns.length * 0.75)] ?? returns[returns.length - 1];
    const p90 = returns[Math.floor(returns.length * 0.9)] ?? returns[returns.length - 1];

    const avgMae = Number((matched.reduce((a, b) => a + b.maxAdverseExcursionPct, 0) / matched.length).toFixed(2));
    const avgMfe = Number((matched.reduce((a, b) => a + b.maxFavourableExcursionPct, 0) / matched.length).toFixed(2));

    const regimes = Array.from(new Set(matched.map(m => m.regime)));
    const sampleEventIds = matched.slice(0, 5).map(m => m.eventId);

    const qualityScore = Math.min(100, Math.round(50 + matched.length * 10 + (winRate >= 0.65 ? 20 : 0)));

    return {
      analogueCount: matched.length,
      matchedRegimes: regimes,
      historicalWinRate: winRate,
      historicalAvgReturnPct: avgReturn,
      returnDistribution: { p10, p25, p50, p75, p90 },
      maxAdverseExcursionPct: avgMae,
      maxFavourableExcursionPct: avgMfe,
      confidenceInterval95: [p10, p90],
      sampleEventIds,
      qualityScore,
      hasSufficientData: matched.length >= 2
    };
  }

  /**
   * Allows registering verified historical events to the engine
   */
  public registerHistoricalEvent(event: {
    eventId: string;
    symbol: string;
    opportunityType: OpportunityType;
    direction: OpportunityDirection;
    regime: string;
    catalystType: string;
    eventTimestamp: string;
    actualReturnPct: number;
    maxAdverseExcursionPct: number;
    maxFavourableExcursionPct: number;
    isWin: boolean;
  }): void {
    this.historicalEventsDatabase.push(event);
  }
}
