/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketDataFreshnessEngine.ts
 * 
 * Deterministic feed freshness, aging, latency, and heartbeat evaluator.
 * ZERO-AI: Deterministic time delta arithmetic.
 */

import { FreshnessStatus, AssetClass } from './types.ts';

export interface FreshnessEvaluation {
  ageMs: number;
  lastReceivedAt: string;
  expectedUpdateIntervalMs: number;
  staleThresholdMs: number;
  freshnessScore: number; // 0 to 100
  status: FreshnessStatus;
  isStale: boolean;
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
}

export class MarketDataFreshnessEngine {
  private static instance: MarketDataFreshnessEngine;

  // Expected intervals and stale thresholds per Asset Class (in ms)
  private assetThresholds: Record<AssetClass, { expectedMs: number; staleMs: number; disconnectMs: number }> = {
    INDEX: { expectedMs: 1000, staleMs: 4000, disconnectMs: 15000 },
    EQUITY: { expectedMs: 2000, staleMs: 8000, disconnectMs: 30000 },
    FUTURES: { expectedMs: 1000, staleMs: 5000, disconnectMs: 20000 },
    OPTIONS: { expectedMs: 1500, staleMs: 6000, disconnectMs: 25000 },
    ETF: { expectedMs: 3000, staleMs: 12000, disconnectMs: 45000 },
    COMMODITY: { expectedMs: 2000, staleMs: 8000, disconnectMs: 30000 },
    CRYPTO: { expectedMs: 1000, staleMs: 4000, disconnectMs: 15000 }
  };

  private constructor() {}

  public static getInstance(): MarketDataFreshnessEngine {
    if (!MarketDataFreshnessEngine.instance) {
      MarketDataFreshnessEngine.instance = new MarketDataFreshnessEngine();
    }
    return MarketDataFreshnessEngine.instance;
  }

  /**
   * Evaluates freshness of a given tick or feed observation against reference time.
   */
  public evaluateFreshness(
    receivedTimestamp: string,
    assetClass: AssetClass = 'EQUITY',
    referenceTimeMs: number = Date.now()
  ): FreshnessEvaluation {
    const receivedTimeMs = new Date(receivedTimestamp).getTime();
    if (isNaN(receivedTimeMs)) {
      return {
        ageMs: 999999,
        lastReceivedAt: receivedTimestamp,
        expectedUpdateIntervalMs: 2000,
        staleThresholdMs: 8000,
        freshnessScore: 0,
        status: 'UNKNOWN',
        isStale: true,
        connectionStatus: 'DISCONNECTED'
      };
    }

    const ageMs = Math.max(0, referenceTimeMs - receivedTimeMs);
    const thresholds = this.assetThresholds[assetClass] || this.assetThresholds.EQUITY;

    let status: FreshnessStatus = 'FRESH';
    let connectionStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' = 'CONNECTED';
    let freshnessScore = 100;

    if (ageMs <= thresholds.expectedMs) {
      status = 'FRESH';
      connectionStatus = 'CONNECTED';
      freshnessScore = 100;
    } else if (ageMs <= thresholds.staleMs) {
      status = 'AGING';
      connectionStatus = 'CONNECTED';
      const decayRatio = (ageMs - thresholds.expectedMs) / (thresholds.staleMs - thresholds.expectedMs);
      freshnessScore = Math.max(60, Math.round(100 - decayRatio * 40));
    } else if (ageMs <= thresholds.disconnectMs) {
      status = 'STALE';
      connectionStatus = 'DEGRADED';
      const decayRatio = (ageMs - thresholds.staleMs) / (thresholds.disconnectMs - thresholds.staleMs);
      freshnessScore = Math.max(10, Math.round(60 - decayRatio * 50));
    } else {
      status = 'DISCONNECTED';
      connectionStatus = 'DISCONNECTED';
      freshnessScore = 0;
    }

    return {
      ageMs,
      lastReceivedAt: receivedTimestamp,
      expectedUpdateIntervalMs: thresholds.expectedMs,
      staleThresholdMs: thresholds.staleMs,
      freshnessScore,
      status,
      isStale: status === 'STALE' || status === 'DISCONNECTED',
      connectionStatus
    };
  }
}

export const marketDataFreshnessEngine = MarketDataFreshnessEngine.getInstance();
