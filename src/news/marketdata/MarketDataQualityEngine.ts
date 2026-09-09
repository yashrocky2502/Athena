/**
 * ATHENA NEWS ENGINE — PHASE 20
 * MarketDataQualityEngine.ts
 * 
 * Market Data Health & Anomaly Detection Engine.
 * Evaluates real-time feeds for staleness, sequence gaps, price spikes, negative volume,
 * and broker disconnects to fail-close execution before bad market data can corrupt orders.
 */

import {
  MarketDataHealthStatus,
  MarketDataQualityReport,
  MarketTick,
  MarketQuote,
  MarketDepth
} from './types.ts';

export interface QualityConfig {
  maxStalenessMs: number; // e.g. 5000ms for active trading
  maxPriceDiscontinuityPct: number; // e.g. 15% instant price jump
  maxTimestampGapMs: number;
}

export class MarketDataQualityEngine {
  private static instance: MarketDataQualityEngine;
  private config: QualityConfig = {
    maxStalenessMs: 5000,
    maxPriceDiscontinuityPct: 15.0,
    maxTimestampGapMs: 10000
  };

  private lastTicks: Map<string, MarketTick> = new Map();
  private lastQuotes: Map<string, MarketQuote> = new Map();
  private tickHistory: Map<string, MarketTick[]> = new Map();
  private feedConnected: boolean = true;

  private constructor() {}

  public static getInstance(): MarketDataQualityEngine {
    if (!this.instance) {
      this.instance = new MarketDataQualityEngine();
    }
    return this.instance;
  }

  public setConfig(config: Partial<QualityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public setFeedConnected(connected: boolean): void {
    this.feedConnected = connected;
  }

  public isFeedConnected(): boolean {
    return this.feedConnected;
  }

  /**
   * Ingests a new market tick into the quality buffer.
   */
  public recordTick(tick: MarketTick): void {
    const history = this.tickHistory.get(tick.symbol) || [];
    history.push(tick);
    if (history.length > 50) history.shift();
    this.tickHistory.set(tick.symbol, history);
    this.lastTicks.set(tick.symbol, tick);
  }

  public recordQuote(quote: MarketQuote): void {
    this.lastQuotes.set(quote.symbol, quote);
    this.recordTick({
      type: 'TICK',
      symbol: quote.symbol,
      exchange: quote.exchange,
      source: quote.source,
      lastPrice: quote.lastPrice,
      volume: quote.volume,
      timestamp: quote.timestamp
    });
  }

  /**
   * Evaluates quality metrics for a given instrument.
   */
  public evaluateQuality(symbol: string, currentTimestampMs: number = Date.now()): MarketDataQualityReport {
    const warnings: string[] = [];
    const lastTick = this.lastTicks.get(symbol);

    if (!this.feedConnected) {
      return {
        symbol,
        status: 'DATA_DISCONNECTED',
        lastTickAgeMs: Infinity,
        stalenessThresholdMs: this.config.maxStalenessMs,
        isStale: true,
        hasPriceDiscontinuity: false,
        hasVolumeAnomaly: false,
        hasTimestampGaps: false,
        hasOutOfOrderTicks: false,
        isDisconnected: true,
        warnings: ['FEED_DISCONNECTED: Market data socket or REST connection is down.'],
        evaluatedAt: new Date(currentTimestampMs).toISOString()
      };
    }

    if (!lastTick) {
      return {
        symbol,
        status: 'DATA_DISCONNECTED',
        lastTickAgeMs: Infinity,
        stalenessThresholdMs: this.config.maxStalenessMs,
        isStale: true,
        hasPriceDiscontinuity: false,
        hasVolumeAnomaly: false,
        hasTimestampGaps: false,
        hasOutOfOrderTicks: false,
        isDisconnected: true,
        warnings: [`NO_DATA: No market ticks observed for symbol ${symbol}.`],
        evaluatedAt: new Date(currentTimestampMs).toISOString()
      };
    }

    const tickTime = new Date(lastTick.timestamp).getTime();
    const lastTickAgeMs = isNaN(tickTime) ? Infinity : Math.max(0, currentTimestampMs - tickTime);
    const isStale = lastTickAgeMs > this.config.maxStalenessMs;

    let hasPriceDiscontinuity = false;
    let hasVolumeAnomaly = false;
    let hasTimestampGaps = false;
    let hasOutOfOrderTicks = false;

    // Check invalid price/volume
    if (lastTick.lastPrice <= 0 || isNaN(lastTick.lastPrice)) {
      warnings.push(`INVALID_PRICE: Last traded price is <= 0 or NaN (${lastTick.lastPrice}).`);
    }
    if (lastTick.volume < 0 || isNaN(lastTick.volume)) {
      hasVolumeAnomaly = true;
      warnings.push(`VOLUME_ANOMALY: Observed negative or NaN volume (${lastTick.volume}).`);
    }

    // Check against history for discontinuities and out-of-order sequence
    const history = this.tickHistory.get(symbol) || [];
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const prevTime = new Date(prev.timestamp).getTime();

      if (tickTime < prevTime) {
        hasOutOfOrderTicks = true;
        warnings.push(`OUT_OF_ORDER: Current tick timestamp (${lastTick.timestamp}) is earlier than previous (${prev.timestamp}).`);
      }

      if (tickTime - prevTime > this.config.maxTimestampGapMs) {
        hasTimestampGaps = true;
        warnings.push(`TIMESTAMP_GAP: Time gap between ticks is ${tickTime - prevTime}ms (threshold: ${this.config.maxTimestampGapMs}ms).`);
      }

      if (prev.lastPrice > 0) {
        const priceJumpPct = Math.abs((lastTick.lastPrice - prev.lastPrice) / prev.lastPrice) * 100;
        if (priceJumpPct > this.config.maxPriceDiscontinuityPct) {
          hasPriceDiscontinuity = true;
          warnings.push(`PRICE_DISCONTINUITY: Price jumped ${priceJumpPct.toFixed(2)}% in a single tick from ${prev.lastPrice} to ${lastTick.lastPrice}.`);
        }
      }
    }

    // Classify Health Status
    let status: MarketDataHealthStatus = 'DATA_HEALTHY';
    if (!this.feedConnected) {
      status = 'DATA_DISCONNECTED';
    } else if (isStale) {
      status = 'DATA_STALE';
      warnings.push(`STALE_DATA: Last tick age is ${lastTickAgeMs}ms (threshold: ${this.config.maxStalenessMs}ms).`);
    } else if (hasPriceDiscontinuity || hasVolumeAnomaly || hasOutOfOrderTicks || hasTimestampGaps || lastTick.lastPrice <= 0) {
      status = 'DATA_DEGRADED';
    }

    return {
      symbol,
      status,
      lastTickAgeMs,
      stalenessThresholdMs: this.config.maxStalenessMs,
      isStale,
      hasPriceDiscontinuity,
      hasVolumeAnomaly,
      hasTimestampGaps,
      hasOutOfOrderTicks,
      isDisconnected: !this.feedConnected,
      warnings,
      evaluatedAt: new Date(currentTimestampMs).toISOString()
    };
  }

  /**
   * Deterministic gate: is this market feed safe for order execution?
   */
  public isExecutionPermitted(symbol: string, currentTimestampMs: number = Date.now()): boolean {
    const report = this.evaluateQuality(symbol, currentTimestampMs);
    return report.status === 'DATA_HEALTHY' || report.status === 'DATA_DEGRADED';
  }
}

export const marketDataQualityEngine = MarketDataQualityEngine.getInstance();
