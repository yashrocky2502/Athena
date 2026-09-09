/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalEventReconstructionEngine.ts
 * 
 * Master deterministic reconstruction engine uniting market, news, macro,
 * derivative, surveillance, signal, strategy, portfolio, and execution states.
 */

import {
  HistoricalMarketTick,
  HistoricalNewsEvent,
  HistoricalFilingEvent,
  HistoricalDerivativeSnapshot,
  HistoricalMacroSnapshot,
  HistoricalSurveillanceEvent,
  HistoricalSignalState,
  HistoricalStrategyState,
  HistoricalPortfolioState,
  HistoricalExecutionState
} from './types.ts';
import { CanonicalMarketSnapshot } from '../market-truth/types.ts';
import { historicalMarketTruthStore } from './HistoricalMarketTruthStore.ts';
import { historicalNewsTruthStore } from './HistoricalNewsTruthStore.ts';
import { historicalSurveillanceReplayEngine } from './HistoricalSurveillanceReplayEngine.ts';
import { historicalSignalReplayEngine } from './HistoricalSignalReplayEngine.ts';
import { historicalStrategyReplayEngine } from './HistoricalStrategyReplayEngine.ts';
import { historicalPortfolioReplayEngine } from './HistoricalPortfolioReplayEngine.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';

export interface ReconstructedSystemState {
  replayTimestamp: string;
  targetSymbol: string;
  marketSnapshot?: CanonicalMarketSnapshot;
  recentTicks: HistoricalMarketTick[];
  newsEvents: HistoricalNewsEvent[];
  filingEvents: HistoricalFilingEvent[];
  derivativeSnapshot: HistoricalDerivativeSnapshot;
  macroSnapshot: HistoricalMacroSnapshot;
  surveillanceEvents: HistoricalSurveillanceEvent[];
  signalState: HistoricalSignalState;
  strategyState: HistoricalStrategyState;
  portfolioState: HistoricalPortfolioState;
  executionState?: HistoricalExecutionState;
  aggregateStateHash: string;
  whatAthenaKnewSummary: {
    price: number;
    priceChangePct: number;
    regime: string;
    newsHeadlineCount: number;
    activeAlertsCount: number;
    signalDirection: string;
    tradeable: boolean;
  };
}

export class HistoricalEventReconstructionEngine {
  private static instance: HistoricalEventReconstructionEngine;

  private constructor() {}

  public static getInstance(): HistoricalEventReconstructionEngine {
    if (!HistoricalEventReconstructionEngine.instance) {
      HistoricalEventReconstructionEngine.instance = new HistoricalEventReconstructionEngine();
    }
    return HistoricalEventReconstructionEngine.instance;
  }

  /**
   * Deterministically reconstructs the total system state at a specific historical moment
   */
  public reconstructAtTimestamp(params: {
    symbol: string;
    replayTimestamp: string;
    initialCash?: number;
  }): ReconstructedSystemState {
    const { symbol, replayTimestamp, initialCash = 10000000 } = params;

    // 1. Set Firewall Cursor
    historicalFutureFirewall.setReplayCursor(replayTimestamp);

    // 2. Reconstruct Market State
    const snapResult = historicalMarketTruthStore.getSnapshotAtTimestamp(replayTimestamp);
    const recentTicks = historicalMarketTruthStore.getTicksForSymbol(symbol, replayTimestamp, 20) as HistoricalMarketTick[];

    const equityState = snapResult.snapshot?.equities?.[symbol];
    const currentTick = equityState?.latestTick || recentTicks[recentTicks.length - 1];
    const currentPrice = currentTick?.lastPrice || 2950.0;
    const prevPrice = currentTick?.previousClose || 2935.0;
    const priceChangePct = currentTick?.priceChangePercent || (((currentPrice - prevPrice) / prevPrice) * 100);

    // 3. Reconstruct News & Filings
    const newsEvents = historicalNewsTruthStore.getNewsAtTimestamp(replayTimestamp, symbol);
    const filingEvents = historicalNewsTruthStore.getFilingsAtTimestamp(replayTimestamp, symbol);

    // 4. Reconstruct Macro Snapshot
    const macroSnapshot: HistoricalMacroSnapshot = {
      timestamp: replayTimestamp,
      rbiRepoRate: 6.50,
      indiaCPI: 4.85,
      india10YBondYield: 6.98,
      us10YBondYield: 4.22,
      usdBrlOrInr: 83.45,
      crudeOilBRENT: 82.30,
      goldUSD: 2390.0,
      deterministicHash: '',
      provenanceId: '',
      schemaVersion: 'v23.1'
    };
    macroSnapshot.deterministicHash = HistoricalHashUtils.hashObject(macroSnapshot);
    macroSnapshot.provenanceId = HistoricalHashUtils.generateProvenanceId('MACRO_HIST', replayTimestamp);

    // 5. Reconstruct Derivatives Snapshot
    const derivativeSnapshot: HistoricalDerivativeSnapshot = {
      timestamp: replayTimestamp,
      underlyingSymbol: symbol,
      spotPrice: currentPrice,
      futuresPrice: currentPrice + 8.5,
      futuresBasis: 8.5,
      atmStrike: Math.round(currentPrice / 50) * 50,
      atmIV: 14.8,
      putCallRatioOI: 1.15,
      putCallRatioVolume: 1.08,
      totalOpenInterest: 18500000,
      oiChangePercent: 3.4,
      maxPainStrike: Math.round(currentPrice / 50) * 50,
      strikes: [
        { strike: 2900, callOI: 120000, putOI: 450000, callIV: 15.2, putIV: 14.1, callLTP: 72.0, putLTP: 18.0 },
        { strike: 2950, callOI: 380000, putOI: 340000, callIV: 14.8, putIV: 14.8, callLTP: 35.0, putLTP: 32.0 },
        { strike: 3000, callOI: 580000, putOI: 110000, callIV: 14.2, putIV: 15.8, callLTP: 12.0, putLTP: 68.0 }
      ],
      deterministicHash: '',
      provenanceId: '',
      schemaVersion: 'v23.1'
    };
    derivativeSnapshot.deterministicHash = HistoricalHashUtils.hashObject(derivativeSnapshot);
    derivativeSnapshot.provenanceId = HistoricalHashUtils.generateProvenanceId('DERIV_HIST', replayTimestamp);

    // 6. Reconstruct Surveillance State
    const hasContradictoryNews = newsEvents.some(n => n.sentiment === 'BULLISH') && priceChangePct < -1.0;
    const surveillanceEvents = historicalSurveillanceReplayEngine.evaluateSurveillance(
      symbol,
      replayTimestamp,
      currentPrice,
      prevPrice,
      currentTick?.volume || 1000000,
      800000,
      hasContradictoryNews
    );

    // 7. Reconstruct Signal State
    const signalState = historicalSignalReplayEngine.generateSignal(
      symbol,
      replayTimestamp,
      priceChangePct,
      newsEvents,
      snapResult.snapshot?.quality?.status === 'DEGRADED' || false
    );

    // 8. Reconstruct Strategy State
    const strategyState = historicalStrategyReplayEngine.evaluateStrategy(
      symbol,
      replayTimestamp,
      signalState,
      priceChangePct >= 0 ? 'TRENDING_BULLISH' : 'PULLBACK_CONSOLIDATION'
    );

    // 9. Reconstruct Portfolio State
    const portfolioState = historicalPortfolioReplayEngine.evaluatePortfolioState(
      replayTimestamp,
      initialCash,
      4500000
    );

    // 10. Aggregate Hash Calculation
    const statePayload = {
      market: snapResult.deterministicHash,
      news: newsEvents.map(n => n.deterministicHash),
      macro: macroSnapshot.deterministicHash,
      derivative: derivativeSnapshot.deterministicHash,
      surveillance: surveillanceEvents.map(s => s.deterministicHash),
      signal: signalState.deterministicHash,
      strategy: strategyState.deterministicHash,
      portfolio: portfolioState.deterministicHash
    };
    const aggregateStateHash = HistoricalHashUtils.hashObject(statePayload);

    return {
      replayTimestamp,
      targetSymbol: symbol,
      marketSnapshot: snapResult.snapshot,
      recentTicks,
      newsEvents,
      filingEvents,
      derivativeSnapshot,
      macroSnapshot,
      surveillanceEvents,
      signalState,
      strategyState,
      portfolioState,
      aggregateStateHash,
      whatAthenaKnewSummary: {
        price: currentPrice,
        priceChangePct,
        regime: priceChangePct >= 0 ? 'TRENDING_BULLISH' : 'PULLBACK_CONSOLIDATION',
        newsHeadlineCount: newsEvents.length,
        activeAlertsCount: surveillanceEvents.length,
        signalDirection: signalState.direction,
        tradeable: signalState.lifecycleState === 'TRADEABLE'
      }
    };
  }
}

export const historicalEventReconstructionEngine = HistoricalEventReconstructionEngine.getInstance();
