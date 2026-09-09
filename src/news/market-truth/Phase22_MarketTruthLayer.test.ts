/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * Comprehensive Automated Regression & Deterministic Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketDataNormalizationEngine } from './MarketDataNormalizationEngine.ts';
import { MarketSessionEngine } from './MarketSessionEngine.ts';
import { TickIntegrityEngine } from './TickIntegrityEngine.ts';
import { MarketDataFreshnessEngine } from './MarketDataFreshnessEngine.ts';
import { PriceDiscontinuityEngine } from './PriceDiscontinuityEngine.ts';
import { MarketSourceConsensusEngine } from './MarketSourceConsensusEngine.ts';
import { MarketTruthCircuitBreaker } from './MarketTruthCircuitBreaker.ts';
import { CanonicalMarketSnapshotEngine } from './CanonicalMarketSnapshotEngine.ts';
import { MarketTruthStateManager } from './MarketTruthStateManager.ts';
import { CanonicalMarketTick } from './types.ts';

describe('ATHENA Phase 22 — Real-Time Market Truth Layer', () => {
  let normalizationEngine: MarketDataNormalizationEngine;
  let sessionEngine: MarketSessionEngine;
  let integrityEngine: TickIntegrityEngine;
  let freshnessEngine: MarketDataFreshnessEngine;
  let discontinuityEngine: PriceDiscontinuityEngine;
  let consensusEngine: MarketSourceConsensusEngine;
  let circuitBreaker: MarketTruthCircuitBreaker;
  let snapshotEngine: CanonicalMarketSnapshotEngine;
  let stateManager: MarketTruthStateManager;

  const createSampleTick = (overrides: Partial<CanonicalMarketTick> = {}): CanonicalMarketTick => {
    const nowIso = new Date().toISOString();
    return {
      instrumentId: 'NSE:EQ:RELIANCE',
      symbol: 'RELIANCE',
      canonicalSymbol: 'RELIANCE',
      exchange: 'NSE',
      assetClass: 'EQUITY',
      timestamp: nowIso,
      exchangeTimestamp: nowIso,
      receivedTimestamp: nowIso,
      sequenceNumber: 1,
      lastPrice: 2950.0,
      previousClose: 2935.0,
      open: 2940.0,
      high: 2965.0,
      low: 2930.0,
      volume: 1500000,
      tradedValue: 4425000000,
      bidPrice: 2949.5,
      askPrice: 2950.5,
      bidQuantity: 500,
      askQuantity: 600,
      spread: 1.0,
      priceChange: 15.0,
      priceChangePercent: 0.51,
      VWAP: 2948.0,
      marketStatus: 'CONTINUOUS_TRADING',
      source: 'NSE_DIRECT',
      sourcePriority: 'P0_AUTHORITATIVE',
      qualityStatus: 'VALID',
      freshnessStatus: 'FRESH',
      validationStatus: 'VALID',
      provenance: {
        source: 'NSE_DIRECT',
        sourceTimestamp: nowIso,
        receivedTimestamp: nowIso,
        normalizationVersion: 'v22.1',
        validationVersion: 'v22.1',
        qualityVersion: 'v22.1',
        correlationId: 'corr_test_1',
        isModified: false
      },
      ...overrides
    };
  };

  beforeEach(() => {
    normalizationEngine = MarketDataNormalizationEngine.getInstance();
    sessionEngine = MarketSessionEngine.getInstance();
    integrityEngine = TickIntegrityEngine.getInstance();
    freshnessEngine = MarketDataFreshnessEngine.getInstance();
    discontinuityEngine = PriceDiscontinuityEngine.getInstance();
    consensusEngine = MarketSourceConsensusEngine.getInstance();
    circuitBreaker = MarketTruthCircuitBreaker.getInstance();
    snapshotEngine = CanonicalMarketSnapshotEngine.getInstance();
    stateManager = MarketTruthStateManager.getInstance();

    // Reset circuit breaker state before each test
    circuitBreaker.reset();
  });

  describe('1. Market Data Normalization Engine', () => {
    it('should normalize NSE cash ticks accurately', () => {
      const rawNSE = {
        symbol: 'RELIANCE.NS',
        lastPrice: 2950.5,
        volume: 1200000,
        open: 2935.0,
        high: 2965.0,
        low: 2930.0,
        previousClose: 2935.3,
        source: 'NSE_DIRECT',
        timestamp: Date.now()
      };

      const normalized = normalizationEngine.normalizeTick(rawNSE);
      expect(normalized).not.toBeNull();
      expect(normalized.tick.symbol).toBe('RELIANCE');
      expect(normalized.tick.canonicalSymbol).toBe('RELIANCE');
      expect(normalized.tick.exchange).toBe('NSE');
      expect(normalized.tick.lastPrice).toBe(2950.5);
      expect(normalized.tick.source).toBe('NSE_DIRECT');
    });

    it('should normalize BSE symbol formats', () => {
      const rawBSE = {
        symbol: '500325.BO',
        lastPrice: 2951.0,
        volume: 85000,
        source: 'BSE_DIRECT',
        timestamp: Date.now()
      };

      const normalized = normalizationEngine.normalizeTick(rawBSE);
      expect(normalized).not.toBeNull();
      expect(normalized.tick.exchange).toBe('BSE');
      expect(normalized.tick.lastPrice).toBe(2951.0);
    });

    it('should properly sanitize and round raw numbers', () => {
      const rawTick = {
        symbol: 'RELIANCE',
        lastPrice: 2950.5555,
        timestamp: Date.now()
      };
      const normalized = normalizationEngine.normalizeTick(rawTick);
      expect(normalized.tick.lastPrice).toBe(2950.56);
    });
  });

  describe('2. Market Session Engine', () => {
    it('should correctly evaluate market sessions deterministically', () => {
      const currentSession = sessionEngine.getSession(undefined, 'NSE');
      expect(currentSession).toBeDefined();
      expect(currentSession.exchange).toBe('NSE');
      expect(currentSession.state).toBeDefined();
      expect(['PRE_OPEN', 'CONTINUOUS_TRADING', 'POST_MARKET', 'CLOSED', 'AUCTION', 'HOLIDAY', 'OPEN', 'HALTED', 'UNKNOWN']).toContain(
        currentSession.state
      );
    });

    it('should identify Indian standard continuous trading hours', () => {
      // 10:30 AM IST (05:00 UTC) on a Monday
      const mondayIST = '2026-09-07T05:00:00.000Z';
      const session = sessionEngine.getSession(mondayIST, 'NSE');
      expect(session.state).toBe('CONTINUOUS_TRADING');
      expect(session.isHoliday).toBe(false);
      expect(session.isWeekend).toBe(false);
    });
  });

  describe('3. Tick Integrity Engine', () => {
    it('should validate pristine ticks', () => {
      const validTick = createSampleTick({
        symbol: 'INFY',
        canonicalSymbol: 'INFY',
        lastPrice: 1820.0,
        low: 1800.0,
        high: 1835.0,
        open: 1810.0,
        previousClose: 1805.0
      });

      const result = integrityEngine.validateTick(validTick);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('VALID');
    });

    it('should detect and reject Low > Price breaches', () => {
      const corruptTick = createSampleTick({
        symbol: 'INFY',
        canonicalSymbol: 'INFY',
        lastPrice: 1750.0, // Below low of 1800
        low: 1800.0,
        high: 1835.0
      });

      const result = integrityEngine.validateTick(corruptTick);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('INVALID_OHLC');
    });

    it('should detect crossed order books (Best Bid >= Best Ask)', () => {
      const crossedTick = createSampleTick({
        symbol: 'TCS',
        canonicalSymbol: 'TCS',
        lastPrice: 4200.0,
        bidPrice: 4205.0, // Bid higher than Ask
        askPrice: 4195.0
      });

      const result = integrityEngine.validateTick(crossedTick);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('CROSSED_MARKET');
    });
  });

  describe('4. Market Data Freshness Engine', () => {
    it('should accept fresh ticks within latency SLA', () => {
      const freshTimestamp = new Date(Date.now() - 200).toISOString();
      const evaluation = freshnessEngine.evaluateFreshness(freshTimestamp, 'EQUITY');
      expect(evaluation.isStale).toBe(false);
      expect(evaluation.status).toBe('FRESH');
      expect(evaluation.freshnessScore).toBeGreaterThanOrEqual(90);
    });

    it('should flag stale ticks older than threshold', () => {
      const staleTimestamp = new Date(Date.now() - 60000).toISOString();
      const evaluation = freshnessEngine.evaluateFreshness(staleTimestamp, 'EQUITY');
      expect(evaluation.isStale).toBe(true);
      expect(evaluation.status).toBe('DISCONNECTED');
    });
  });

  describe('5. Price Discontinuity Engine', () => {
    it('should pass normal smooth price movements', () => {
      const analysis = discontinuityEngine.analyzeDiscontinuity({
        currentPrice: 1101.5,
        previousPrice: 1100.0,
        historicalPrices: [1098, 1099, 1100],
        atr: 5.0,
        volume: 100000,
        averageVolume: 95000
      });
      expect(analysis.classification).toBe('NORMAL_MOVE');
    });

    it('should catch unverified instantaneous price spikes', () => {
      const analysis = discontinuityEngine.analyzeDiscontinuity({
        currentPrice: 920.0,
        previousPrice: 800.0, // 15% jump
        historicalPrices: [798, 800, 801],
        atr: 4.0,
        volume: 100, // No volume confirmation
        averageVolume: 50000
      });
      expect(['ANOMALOUS_MOVE', 'EXTREME_SHOCK']).toContain(analysis.classification);
      expect(analysis.isConfirmedByVolume).toBe(false);
    });
  });

  describe('6. Multi-Source Consensus Engine', () => {
    it('should arbitrate between primary and secondary feeds using authoritative weights', () => {
      const nseTick = createSampleTick({
        source: 'NSE_DIRECT',
        sourcePriority: 'P0_AUTHORITATIVE',
        lastPrice: 2950.0
      });

      const brokerTick = createSampleTick({
        source: 'BROKER_API',
        sourcePriority: 'P1_PRIMARY',
        lastPrice: 2950.2
      });

      const consensus = consensusEngine.arbitrate([nseTick, brokerTick]);
      expect(consensus).not.toBeNull();
      expect(consensus.canonicalTick.lastPrice).toBe(2950.0);
      expect(consensus.sourceAgreementScore).toBeGreaterThanOrEqual(90);
    });

    it('should flag contradiction when feeds severely diverge', () => {
      const nseTick = createSampleTick({
        source: 'NSE_DIRECT',
        sourcePriority: 'P0_AUTHORITATIVE',
        lastPrice: 2950.0
      });

      const badFeedTick = createSampleTick({
        source: 'YAHOO_FALLBACK',
        sourcePriority: 'P3_FALLBACK',
        lastPrice: 3500.0 // Severe 18% divergence
      });

      const consensus = consensusEngine.arbitrate([nseTick, badFeedTick]);
      expect(consensus.disagreementSeverity).toBe('CRITICAL');
      expect(consensus.status).toBe('CONTRADICTED');
    });
  });

  describe('7. Market Truth Circuit Breaker & Safety Interlock', () => {
    it('should initially be in a closed (healthy) state', () => {
      expect(circuitBreaker.isTripped()).toBe(false);
      expect(circuitBreaker.getStatus().state).toBe('CLOSED');
      expect(circuitBreaker.canAuthorizeExecution()).toBe(true);
    });

    it('should trip on repeated critical integrity failures', () => {
      circuitBreaker.recordAnomaly({
        symbol: 'RELIANCE',
        type: 'PRICE_CONTRADICTION',
        severity: 'CRITICAL',
        message: 'Feeds out of consensus by 18%',
        timestamp: Date.now()
      });
      circuitBreaker.recordAnomaly({
        symbol: 'RELIANCE',
        type: 'PRICE_CONTRADICTION',
        severity: 'CRITICAL',
        message: 'Feeds out of consensus by 18%',
        timestamp: Date.now()
      });
      circuitBreaker.recordAnomaly({
        symbol: 'RELIANCE',
        type: 'PRICE_CONTRADICTION',
        severity: 'CRITICAL',
        message: 'Feeds out of consensus by 18%',
        timestamp: Date.now()
      });

      expect(circuitBreaker.isTripped()).toBe(true);
      expect(circuitBreaker.canAuthorizeExecution()).toBe(false);
    });

    it('should allow manual trip and manual reset', () => {
      circuitBreaker.trip('Manual safety override test');
      expect(circuitBreaker.isTripped()).toBe(true);
      expect(circuitBreaker.canAuthorizeExecution()).toBe(false);

      circuitBreaker.reset();
      expect(circuitBreaker.isTripped()).toBe(false);
      expect(circuitBreaker.canAuthorizeExecution()).toBe(true);
    });
  });

  describe('8. Canonical State Manager & Snapshot Pipeline', () => {
    it('should ingest, validate and produce complete canonical snapshots', () => {
      const rawIndexTick = {
        symbol: '^NSEI',
        lastPrice: 24350.0,
        open: 24250.0,
        high: 24400.0,
        low: 24200.0,
        previousClose: 24220.0,
        volume: 250000000,
        source: 'NSE_DIRECT',
        timestamp: Date.now()
      };

      const result = stateManager.ingestRawTick(rawIndexTick);
      expect(result.canonicalTick).toBeDefined();
      expect(result.canonicalTick.canonicalSymbol).toBe('NIFTY 50');
      expect(result.status).toBe('VALID');

      const snapshot = stateManager.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.indices['NIFTY 50']).toBeDefined();
      expect(snapshot.indices['NIFTY 50'].lastPrice).toBe(24350.0);
      expect(snapshot.breadth).toBeDefined();
      expect(snapshot.liquidityState).toBeDefined();
    });
  });
});
