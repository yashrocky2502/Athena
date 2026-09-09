/**
 * ATHENA NEWS ENGINE — PHASE 16
 * MarketMemoryEngine.ts
 * 
 * Historical Market Memory.
 * Stores structured historical analogues based on multidimensional markers (event type, sector, regime, volatility, F&O)
 * and retrieves matching precedents to construct probability distributions, bands, and typical reactions.
 */

import { DiscoveryRegimeType } from './MarketRegimeDiscoveryEngine.ts';

export interface MarketMemoryAnalogue {
  analogueId: string;
  eventType: string;               // e.g. "ORDER_WIN", "EARNINGS_BEAT", "MNA"
  entity: string;                  // e.g. "TCS", "RELIANCE"
  sector: string;                  // e.g. "IT", "ENERGY"
  regime: DiscoveryRegimeType;
  volatilityVix: number;
  priceReactionPct: number;        // Day 1 price change
  volumeRvol: number;              // Relative volume
  fAndOOpenInterestChangePct: number;
  strategyUsed: string;
  realizedPnLINR: number;
  maxExcursionMfePct: number;
  maxExcursionMaePct: number;
  timeToTargetMinutes: number;
  failureConditionTriggered: boolean;
  date: string;
}

export interface AnalogueAnalysis {
  analogueCount: number;
  medianReactionPct: number;
  averageReactionPct: number;
  distribution: number[];          // Sorted individual outcomes
  probabilityBands: {
    tenthPercentile: number;
    twentyFifthPercentile: number;
    fiftiethPercentile: number;
    seventyFifthPercentile: number;
    ninetiethPercentile: number;
  };
  mfeMeanPct: number;
  maeMeanPct: number;
  medianTimeToTargetMinutes: number;
  failureRatePct: number;
}

export class MarketMemoryEngine {
  private static analogues: MarketMemoryAnalogue[] = [];

  /**
   * Adds an analogue record to the memory store
   */
  public static addAnalogue(analogue: MarketMemoryAnalogue): void {
    this.analogues.push(analogue);
  }

  /**
   * Finds matching historical analogues based on structural parameters
   */
  public static findAnalogues(criteria: {
    eventType?: string;
    sector?: string;
    regime?: DiscoveryRegimeType;
  }): MarketMemoryAnalogue[] {
    return this.analogues.filter(item => {
      if (criteria.eventType && item.eventType !== criteria.eventType) return false;
      if (criteria.sector && item.sector !== criteria.sector) return false;
      if (criteria.regime && item.regime !== criteria.regime) return false;
      return true;
    });
  }

  /**
   * Performs distribution analysis and constructs probability bands on the matched outcomes
   */
  public static analyzePrecedents(matches: MarketMemoryAnalogue[]): AnalogueAnalysis {
    const count = matches.length;
    if (count === 0) {
      return {
        analogueCount: 0,
        medianReactionPct: 0,
        averageReactionPct: 0,
        distribution: [],
        probabilityBands: { tenthPercentile: 0, twentyFifthPercentile: 0, fiftiethPercentile: 0, seventyFifthPercentile: 0, ninetiethPercentile: 0 },
        mfeMeanPct: 0,
        maeMeanPct: 0,
        medianTimeToTargetMinutes: 0,
        failureRatePct: 0,
      };
    }

    const priceReactions = matches.map(m => m.priceReactionPct).sort((a, b) => a - b);
    const median = priceReactions[Math.floor(count / 2)];
    const average = priceReactions.reduce((acc, v) => acc + v, 0) / count;

    // Percentile bands
    const getPercentileValue = (sortedArray: number[], percentile: number) => {
      const idx = Math.round((sortedArray.length - 1) * (percentile / 100));
      return sortedArray[idx] || 0;
    };

    const tenthPercentile = getPercentileValue(priceReactions, 10);
    const twentyFifthPercentile = getPercentileValue(priceReactions, 25);
    const fiftiethPercentile = getPercentileValue(priceReactions, 50);
    const seventyFifthPercentile = getPercentileValue(priceReactions, 75);
    const ninetiethPercentile = getPercentileValue(priceReactions, 90);

    const mfeMean = matches.reduce((acc, m) => acc + m.maxExcursionMfePct, 0) / count;
    const maeMean = matches.reduce((acc, m) => acc + m.maxExcursionMaePct, 0) / count;
    const medianTimeToTarget = matches.map(m => m.timeToTargetMinutes).sort((a, b) => a - b)[Math.floor(count / 2)];
    const failuresCount = matches.filter(m => m.failureConditionTriggered).length;
    const failureRatePct = (failuresCount / count) * 100;

    return {
      analogueCount: count,
      medianReactionPct: Number(median.toFixed(2)),
      averageReactionPct: Number(average.toFixed(2)),
      distribution: priceReactions.map(v => Number(v.toFixed(2))),
      probabilityBands: {
        tenthPercentile: Number(tenthPercentile.toFixed(2)),
        twentyFifthPercentile: Number(twentyFifthPercentile.toFixed(2)),
        fiftiethPercentile: Number(fiftiethPercentile.toFixed(2)),
        seventyFifthPercentile: Number(seventyFifthPercentile.toFixed(2)),
        ninetiethPercentile: Number(ninetiethPercentile.toFixed(2)),
      },
      mfeMeanPct: Number(mfeMean.toFixed(2)),
      maeMeanPct: Number(maeMean.toFixed(2)),
      medianTimeToTargetMinutes: medianTimeToTarget,
      failureRatePct: Number(failureRatePct.toFixed(2)),
    };
  }

  public static clear(): void {
    this.analogues = [];
  }

  /**
   * Pre-seed mock memory store with high quality, specific financial records
   */
  public static seedMockMemory(): void {
    const mockEvents = [
      { id: '1', event: 'ORDER_WIN', entity: 'TCS', sector: 'IT', regime: 'TRENDING_BULL' as const, rx: 3.5, rvol: 2.1, oi: 15, mfe: 4.2, mae: -0.5, t: 30, fail: false },
      { id: '2', event: 'ORDER_WIN', entity: 'INFOSYS', sector: 'IT', regime: 'TRENDING_BULL' as const, rx: 2.1, rvol: 1.8, oi: 10, mfe: 2.8, mae: -0.2, t: 45, fail: false },
      { id: '3', event: 'ORDER_WIN', entity: 'L&T', sector: 'INFRASTRUCTURE', regime: 'TRENDING_BULL' as const, rx: 4.8, rvol: 2.5, oi: 22, mfe: 6.3, mae: -0.8, t: 15, fail: false },
      { id: '4', event: 'ORDER_WIN', entity: 'RELIANCE', sector: 'ENERGY', regime: 'RANGE_BOUND' as const, rx: 1.2, rvol: 1.1, oi: 5, mfe: 1.8, mae: -1.2, t: 90, fail: true },
      { id: '5', event: 'ORDER_WIN', entity: 'WIPRO', sector: 'IT', regime: 'TRENDING_BULL' as const, rx: -0.8, rvol: 1.5, oi: 8, mfe: 0.5, mae: -1.8, t: 120, fail: true },
    ];

    for (const ev of mockEvents) {
      this.addAnalogue({
        analogueId: `A_${ev.id}`,
        eventType: ev.event,
        entity: ev.entity,
        sector: ev.sector,
        regime: ev.regime,
        volatilityVix: 15.5,
        priceReactionPct: ev.rx,
        volumeRvol: ev.rvol,
        fAndOOpenInterestChangePct: ev.oi,
        strategyUsed: 'FUTURES_BREAKOUT',
        realizedPnLINR: ev.rx * 10000,
        maxExcursionMfePct: ev.mfe,
        maxExcursionMaePct: ev.mae,
        timeToTargetMinutes: ev.t,
        failureConditionTriggered: ev.fail,
        date: '2026-08-01',
      });
    }
  }
}
export const marketMemoryEngine = MarketMemoryEngine;
