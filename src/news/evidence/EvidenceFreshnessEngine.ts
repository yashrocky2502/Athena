/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceFreshnessEngine.ts
 * 
 * Deterministic measurement of evidence age, transmission latency, source delay,
 * ingestion delay, and stale status.
 * 
 * Integrates with Phase 22 MarketDataFreshnessEngine rules.
 */

import { EvidenceType } from './types.ts';

export interface EvidenceFreshnessMetrics {
  freshnessScore: number;       // 0 - 100
  ageMs: number;
  sourceLatencyMs: number;
  ingestionLatencyMs: number;
  totalLatencyMs: number;
  staleStatus: 'FRESH' | 'STALE' | 'EXPIRED';
  isWithinAcceptableWindow: boolean;
}

export class EvidenceFreshnessEngine {
  private static instance: EvidenceFreshnessEngine;

  // Stale thresholds in milliseconds by evidence type
  private staleThresholds: Partial<Record<EvidenceType, { freshMs: number; staleMs: number; maxExpiryMs: number }>> = {
    MARKET_TICK: { freshMs: 3000, staleMs: 15000, maxExpiryMs: 60000 },
    ORDER_BOOK: { freshMs: 2000, staleMs: 10000, maxExpiryMs: 30000 },
    VOLUME: { freshMs: 5000, staleMs: 30000, maxExpiryMs: 120000 },
    OPEN_INTEREST: { freshMs: 30000, staleMs: 180000, maxExpiryMs: 600000 },
    IV: { freshMs: 15000, staleMs: 60000, maxExpiryMs: 300000 },
    OPTIONS_CHAIN: { freshMs: 15000, staleMs: 60000, maxExpiryMs: 300000 },
    DERIVATIVE_FLOW: { freshMs: 10000, staleMs: 60000, maxExpiryMs: 300000 },
    MARKET_SNAPSHOT: { freshMs: 5000, staleMs: 30000, maxExpiryMs: 120000 },
    SECTOR_DATA: { freshMs: 15000, staleMs: 60000, maxExpiryMs: 300000 },
    INDEX_DATA: { freshMs: 5000, staleMs: 30000, maxExpiryMs: 120000 },
    SURVEILLANCE_EVENT: { freshMs: 10000, staleMs: 60000, maxExpiryMs: 300000 },
    SIGNAL: { freshMs: 60000, staleMs: 300000, maxExpiryMs: 900000 },
    STRATEGY: { freshMs: 120000, staleMs: 600000, maxExpiryMs: 1800000 },
    PORTFOLIO: { freshMs: 60000, staleMs: 300000, maxExpiryMs: 900000 },
    EXECUTION: { freshMs: 15000, staleMs: 60000, maxExpiryMs: 300000 },
    NEWS: { freshMs: 300000, staleMs: 1800000, maxExpiryMs: 86400000 }, // 5m fresh, 30m stale, 24h max
    FILING: { freshMs: 600000, staleMs: 3600000, maxExpiryMs: 86400000 },
    CORPORATE_ACTION: { freshMs: 3600000, staleMs: 86400000, maxExpiryMs: 604800000 },
    ECONOMIC_RELEASE: { freshMs: 600000, staleMs: 3600000, maxExpiryMs: 86400000 },
    MACRO_DATA: { freshMs: 1800000, staleMs: 7200000, maxExpiryMs: 86400000 },
    FX_DATA: { freshMs: 10000, staleMs: 60000, maxExpiryMs: 300000 },
    COMMODITY_DATA: { freshMs: 10000, staleMs: 60000, maxExpiryMs: 300000 },
    BROKER_DATA: { freshMs: 5000, staleMs: 30000, maxExpiryMs: 120000 },
    OUTCOME: { freshMs: 3600000, staleMs: 86400000, maxExpiryMs: 604800000 },
    HISTORICAL_REPLAY: { freshMs: 86400000, staleMs: 864000000, maxExpiryMs: 8640000000 }
  };

  private constructor() {}

  public static getInstance(): EvidenceFreshnessEngine {
    if (!EvidenceFreshnessEngine.instance) {
      EvidenceFreshnessEngine.instance = new EvidenceFreshnessEngine();
    }
    return EvidenceFreshnessEngine.instance;
  }

  /**
   * Evaluates freshness metrics deterministically relative to a decision timestamp or current time
   */
  public evaluateFreshness(
    evidenceType: EvidenceType,
    sourceTimestamp: string,
    ingestionTimestamp: string,
    referenceTimestamp?: string
  ): EvidenceFreshnessMetrics {
    const srcMs = new Date(sourceTimestamp).getTime();
    const ingMs = new Date(ingestionTimestamp).getTime();
    const refMs = referenceTimestamp ? new Date(referenceTimestamp).getTime() : Date.now();

    const ageMs = Math.max(0, refMs - srcMs);
    const sourceLatencyMs = Math.max(0, ingMs - srcMs);
    const ingestionLatencyMs = Math.max(0, refMs - ingMs);
    const totalLatencyMs = sourceLatencyMs + ingestionLatencyMs;

    const threshold = this.staleThresholds[evidenceType] || {
      freshMs: 30000,
      staleMs: 180000,
      maxExpiryMs: 600000
    };

    let staleStatus: 'FRESH' | 'STALE' | 'EXPIRED' = 'FRESH';
    let freshnessScore = 100;

    if (ageMs <= threshold.freshMs) {
      staleStatus = 'FRESH';
      freshnessScore = Math.max(90, 100 - Math.round((ageMs / threshold.freshMs) * 10));
    } else if (ageMs <= threshold.staleMs) {
      staleStatus = 'STALE';
      const decayRatio = (ageMs - threshold.freshMs) / (threshold.staleMs - threshold.freshMs);
      freshnessScore = Math.max(50, Math.round(90 - decayRatio * 40));
    } else {
      staleStatus = 'EXPIRED';
      const expireRatio = Math.min(1.0, (ageMs - threshold.staleMs) / (threshold.maxExpiryMs - threshold.staleMs));
      freshnessScore = Math.max(0, Math.round(50 - expireRatio * 50));
    }

    return {
      freshnessScore,
      ageMs,
      sourceLatencyMs,
      ingestionLatencyMs,
      totalLatencyMs,
      staleStatus,
      isWithinAcceptableWindow: staleStatus !== 'EXPIRED'
    };
  }

  public computeFreshnessScore(params: {
    evidenceType: string;
    sourceTimestamp: string;
    currentTimestamp?: string;
  }): {
    freshnessScore: number;
    isStale: boolean;
    ageMs: number;
  } {
    let mappedType: EvidenceType = 'MARKET_TICK';
    if (params.evidenceType.includes('ORDER')) mappedType = 'ORDER_BOOK';
    else if (params.evidenceType.includes('FILING')) mappedType = 'FILING';
    else if (params.evidenceType.includes('NEWS')) mappedType = 'NEWS';

    const metrics = this.evaluateFreshness(
      mappedType,
      params.sourceTimestamp,
      params.sourceTimestamp,
      params.currentTimestamp
    );

    return {
      freshnessScore: metrics.freshnessScore,
      isStale: metrics.staleStatus !== 'FRESH',
      ageMs: metrics.ageMs
    };
  }
}

export const evidenceFreshnessEngine = EvidenceFreshnessEngine.getInstance();
