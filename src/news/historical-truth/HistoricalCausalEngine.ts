/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalCausalEngine.ts
 * 
 * Historical causal reasoning engine strictly bounded to information available at the historical query timestamp.
 */

import { HistoricalCausalAnalysis } from './types.ts';
import { historicalEventReconstructionEngine } from './HistoricalEventReconstructionEngine.ts';
import { historicalMarketTruthStore } from './HistoricalMarketTruthStore.ts';
import { historicalNewsTruthStore } from './HistoricalNewsTruthStore.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export class HistoricalCausalEngine {
  private static instance: HistoricalCausalEngine;

  private constructor() {}

  public static getInstance(): HistoricalCausalEngine {
    if (!HistoricalCausalEngine.instance) {
      HistoricalCausalEngine.instance = new HistoricalCausalEngine();
    }
    return HistoricalCausalEngine.instance;
  }

  /**
   * Evaluates a causal query at an exact historical timestamp
   */
  public explainHistoricalEvent(params: {
    query: string;
    symbol: string;
    replayTimestamp: string;
    includePostReplayFutureComparison?: boolean;
  }): HistoricalCausalAnalysis {
    const { query, symbol, replayTimestamp, includePostReplayFutureComparison = true } = params;

    // 1. Enforce Firewall
    historicalFutureFirewall.setReplayCursor(replayTimestamp);

    // 2. Reconstruct System State strictly <= replayTimestamp
    const state = historicalEventReconstructionEngine.reconstructAtTimestamp({
      symbol,
      replayTimestamp
    });

    const news = state.newsEvents;
    const ticks = state.recentTicks;
    const currentPrice = state.whatAthenaKnewSummary.price;
    const currentChangePct = state.whatAthenaKnewSummary.priceChangePct;

    // 3. Deterministic Causal Inference
    let primaryCause = 'Normal market liquidity and order flow dynamic';
    const contributingFactors: string[] = [];
    const correlations: string[] = [];
    let confirmationState: 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'UNCONFIRMED' = 'CONFIRMED';
    const contradictionFactors: string[] = [];
    const evidenceList: HistoricalCausalAnalysis['evidenceList'] = [];

    // Evaluate news drivers
    const relevantNews = news.filter(n => n.entities.includes(symbol) || n.entities.includes('NIFTY 50'));
    if (relevantNews.length > 0) {
      const topNews = relevantNews[0];
      primaryCause = `${topNews.catalystClassification}: "${topNews.headline}" (${topNews.source})`;
      evidenceList.push({
        type: 'NEWS',
        description: topNews.headline,
        timestamp: topNews.publishedAt,
        provenance: topNews.provenanceId
      });

      if (topNews.sentiment === 'BEARISH' && currentChangePct < 0) {
        contributingFactors.push('Negative news catalyst aligned with downward momentum');
      } else if (topNews.sentiment === 'BULLISH' && currentChangePct > 0) {
        contributingFactors.push('Positive corporate/macro disclosure driving institutional bidding');
      } else {
        contradictionFactors.push('Sentiment divergence between news tone and price action');
        confirmationState = 'PARTIALLY_CONFIRMED';
      }
    }

    // Macro Contagion / Crude Oil / Currency
    if (state.macroSnapshot.crudeOilBRENT > 80) {
      correlations.push(`Elevated Brent crude ($${state.macroSnapshot.crudeOilBRENT}/bbl) impacting import sentiment`);
      evidenceList.push({
        type: 'MACRO',
        description: `Crude benchmark at $${state.macroSnapshot.crudeOilBRENT}`,
        timestamp: replayTimestamp,
        provenance: state.macroSnapshot.provenanceId
      });
    }

    // Derivatives OI build up
    if (state.derivativeSnapshot.putCallRatioOI > 1.1) {
      contributingFactors.push(`Bullish options buildup: PCR OI at ${state.derivativeSnapshot.putCallRatioOI.toFixed(2)} with heavy call support`);
      evidenceList.push({
        type: 'OI',
        description: `PCR OI ${state.derivativeSnapshot.putCallRatioOI}`,
        timestamp: replayTimestamp,
        provenance: state.derivativeSnapshot.provenanceId
      });
    }

    // Surveillance Anomalies
    for (const s of state.surveillanceEvents) {
      evidenceList.push({
        type: 'SURVEILLANCE',
        description: s.description,
        timestamp: s.timestamp,
        provenance: s.provenanceId
      });
      if (s.anomalyType === 'PRICE_JUMP' || s.anomalyType === 'VOLUME_SPIKE') {
        contributingFactors.push(s.description);
      }
    }

    const confidenceScore = Math.min(98, 65 + (evidenceList.length * 7));

    // 4. Future Comparison (Strictly isolated in separate object for forensic audit)
    const whatHappenedAfterSeparated: HistoricalCausalAnalysis['whatHappenedAfterSeparated'] = {};
    if (includePostReplayFutureComparison) {
      const futureTime15m = new Date(new Date(replayTimestamp).getTime() + 15 * 60 * 1000).toISOString();
      const futureTime1h = new Date(new Date(replayTimestamp).getTime() + 60 * 60 * 1000).toISOString();
      
      const snap15m = historicalMarketTruthStore.getSnapshotAtTimestamp(futureTime15m);
      const snap1h = historicalMarketTruthStore.getSnapshotAtTimestamp(futureTime1h);

      whatHappenedAfterSeparated.priceAfter15m = snap15m.snapshot?.equities?.[symbol]?.latestTick?.lastPrice;
      whatHappenedAfterSeparated.priceAfter1h = snap1h.snapshot?.equities?.[symbol]?.latestTick?.lastPrice;
      whatHappenedAfterSeparated.outcomeVerdict = (whatHappenedAfterSeparated.priceAfter1h && whatHappenedAfterSeparated.priceAfter1h > currentPrice)
        ? 'Price continued upward trend in subsequent hour'
        : 'Price stabilized/mean-reverted in subsequent hour';
    }

    return {
      query,
      replayTimestamp,
      symbol,
      primaryCause,
      contributingFactors,
      correlations,
      confirmationState,
      contradictionFactors,
      evidenceList,
      confidenceScore,
      whatAthenaKnewAtTime: {
        activePrice: currentPrice,
        activeRegime: state.whatAthenaKnewSummary.regime,
        latestNewsHeadlines: news.slice(0, 3).map(n => n.headline),
        oiState: `PCR ${state.derivativeSnapshot.putCallRatioOI}, Basis +${state.derivativeSnapshot.futuresBasis}`,
        macroSummary: `Repo Rate ${state.macroSnapshot.rbiRepoRate}%, Crude $${state.macroSnapshot.crudeOilBRENT}`
      },
      whatHappenedAfterSeparated
    };
  }
}

export const historicalCausalEngine = HistoricalCausalEngine.getInstance();
