/**
 * ATHENA NEWS & MARKET INTELLIGENCE SUBSYSTEM — PHASE 10B-1
 * Phase10B_1_TrustBoundary.test.ts
 * 
 * Market Observation Trust Boundary & Outcome Integrity Test Suite.
 * 
 * Verifies:
 * - TEST 1: Protected production datasets remain byte-for-byte unchanged
 * - TEST 2: Signals registered without initial market quote do NOT invent 100.0 fallback
 * - TEST 3: Observation tick validation strictly enforces schema, bounds, and symbol match
 * - TEST 4: Observations with future timestamp drift (> 60s) or invalid dates are rejected
 * - TEST 5: Observations missing provenance or with invalid provider types are rejected
 * - TEST 6: Ingestion deduplication is idempotent (no duplicate count or timeline events)
 * - TEST 7: SYNTHETIC_TEST observations cannot resolve outcomes in production mode
 * - TEST 8: Real market observations (REAL_EXCHANGE / BROKER_FEED / APPROVED_MARKET_PROVIDER) resolve outcomes
 * - TEST 9: Manual internal observations record provenance metadata and manual resolution type
 * - TEST 10: ObservationTrustBridge accurately maps EquityObservation to MarketObservationTick
 * - TEST 11: Market session classification accurately handles IST hours, minutes, and weekends
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  SignalOutcomeEngine,
  SignalOutcomeRecord,
  MarketObservationTick,
  ObservationProvenance
} from '../market-intelligence/SignalOutcomeEngine.ts';
import { ObservationTrustBridge } from '../market-data/ObservationTrustBridge.ts';
import { EquityObservation } from '../market-data/types.ts';

describe('PHASE 10B-1 — MARKET OBSERVATION TRUST BOUNDARY & OUTCOME INTEGRITY', () => {
  let tempDir: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;

  // Four protected production datasets
  const protectedDatasets = [
    {
      filePath: 'data/market_intelligence_outcomes.json',
      expectedHash: '47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd',
      expectedCount: 446
    },
    {
      filePath: 'data/market_intelligence_outcomes.json.bak',
      expectedHash: '33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764',
      expectedCount: 445
    },
    {
      filePath: 'data/news_signal_lifecycle.json',
      expectedHash: 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1',
      expectedCount: 498
    },
    {
      filePath: 'data/news_signal_historical_ledger.json',
      expectedHash: '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c',
      expectedCount: 1
    }
  ];

  const computeSha256 = (p: string): string => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), p));
    return crypto.createHash('sha256').update(raw).digest('hex');
  };

  const getRecordCount = (filePath: string): number => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
  };

  beforeAll(() => {
    // 1. Verify baseline hashes and counts for all four protected datasets
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }

    // 2. Initialize isolated test storage
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase10b1_trust_boundary_'));
    testOutcomePath = path.join(tempDir, 'test_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'test_outcomes.json.bak');

    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
  });

  afterAll(() => {
    // Restore production instance
    SignalOutcomeEngine.resetInstanceForProduction();

    // Clean up temporary files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }

    // 3. Post-run verification of all four protected datasets
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });

  beforeEach(() => {
    // Clean temporary storage before each test
    if (fs.existsSync(testOutcomePath)) {
      fs.writeFileSync(testOutcomePath, JSON.stringify([], null, 2), 'utf-8');
    }
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
  });

  // ==========================================
  // TEST 1: Protected Production Datasets
  // ==========================================
  it('TEST 1: Protected production datasets remain byte-for-byte unchanged', () => {
    for (const dataset of protectedDatasets) {
      const currentHash = computeSha256(dataset.filePath);
      const currentCount = getRecordCount(dataset.filePath);
      expect(currentHash).toBe(dataset.expectedHash);
      expect(currentCount).toBe(dataset.expectedCount);
    }
  });

  // ==========================================
  // TEST 2: Missing Initial Price Handling
  // ==========================================
  it('TEST 2: Signals registered without initial market quote do NOT invent 100.0 fallback', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_NO_PRICE_001',
      signalType: 'BREAKOUT_BULLISH',
      symbol: 'TCS',
      direction: 'BULLISH'
      // initialPrice deliberately omitted
    });

    expect(record.initialPrice).toBeUndefined();
    expect(record.targetPrice).toBeUndefined();
    expect(record.stopPrice).toBeUndefined();
    expect(record.isMissingInitialPrice).toBe(true);
    expect(record.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    expect(record.directionalAccuracy).toBe('UNRESOLVED');
    expect(record.isResolved).toBe(false);

    // Initial timeline confirms missing initial price status
    expect(record.timeline[0].details?.marketDataStatus).toBe('MISSING_INITIAL_PRICE');
    expect(record.timeline[0].price).toBeUndefined();

    // Attempting to ingest observations without an initial price cannot resolve the outcome
    const validObs: MarketObservationTick[] = [
      {
        symbol: 'TCS',
        price: 3500.0,
        timestamp: new Date().toISOString(),
        provenance: {
          sourceType: 'REAL_EXCHANGE',
          provider: 'NSE_FEED',
          feedTimestamp: new Date().toISOString()
        }
      }
    ];

    const updated = engine.ingestMarketObservations(record.signalId, validObs);
    expect(updated.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    expect(updated.isResolved).toBe(false);
    expect(updated.isMissingInitialPrice).toBe(true);
  });

  // ==========================================
  // TEST 3: Tick Validation & Bounds Checking
  // ==========================================
  it('TEST 3: Observation tick validation strictly enforces schema, positive price, and high/low bounds', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_VALIDATION_001',
      signalType: 'MOMENTUM_BULLISH',
      symbol: 'INFY',
      initialPrice: 1500.0,
      direction: 'BULLISH'
    });

    const now = new Date().toISOString();

    // 3a. Invalid prices (0, negative, NaN)
    const badPrice1: any = { symbol: 'INFY', price: 0, timestamp: now, provenance: 'REAL_EXCHANGE' };
    const res1 = engine.validateObservationTick(record.signalId, badPrice1);
    expect(res1.isValid).toBe(false);
    expect(res1.error?.code).toBe('INVALID_PRICE');

    const badPrice2: any = { symbol: 'INFY', price: -100, timestamp: now, provenance: 'REAL_EXCHANGE' };
    const res2 = engine.validateObservationTick(record.signalId, badPrice2);
    expect(res2.isValid).toBe(false);
    expect(res2.error?.code).toBe('INVALID_PRICE');

    // 3b. High/Low consistency violations (low > high)
    const badBounds1: any = {
      symbol: 'INFY',
      price: 1500,
      high: 1480,
      low: 1520,
      timestamp: now,
      provenance: 'REAL_EXCHANGE'
    };
    const res3 = engine.validateObservationTick(record.signalId, badBounds1);
    expect(res3.isValid).toBe(false);
    expect(res3.error?.code).toBe('INVALID_HIGH_LOW_BOUNDS');

    // 3c. Price outside high/low range
    const badBounds2: any = {
      symbol: 'INFY',
      price: 1550,
      high: 1540,
      low: 1490,
      timestamp: now,
      provenance: 'REAL_EXCHANGE'
    };
    const res4 = engine.validateObservationTick(record.signalId, badBounds2);
    expect(res4.isValid).toBe(false);
    expect(res4.error?.code).toBe('PRICE_EXCEEDS_HIGH_BOUND');

    // 3d. Symbol mismatch
    const badSymbol: any = {
      symbol: 'RELIANCE',
      price: 1510,
      timestamp: now,
      provenance: 'REAL_EXCHANGE'
    };
    const res5 = engine.validateObservationTick(record.signalId, badSymbol);
    expect(res5.isValid).toBe(false);
    expect(res5.error?.code).toBe('SYMBOL_MISMATCH');
  });

  // ==========================================
  // TEST 4: Timestamp Validation & Drift
  // ==========================================
  it('TEST 4: Observations with future timestamp drift (> 60s) or invalid dates are rejected', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_DRIFT_001',
      signalType: 'EARNINGS_DRIFT',
      symbol: 'HDFCBANK',
      initialPrice: 1600.0,
      direction: 'BULLISH'
    });

    // Invalid date string
    const invalidDate: any = {
      symbol: 'HDFCBANK',
      price: 1610.0,
      timestamp: 'NOT_A_VALID_DATE',
      provenance: 'REAL_EXCHANGE'
    };
    const res1 = engine.validateObservationTick(record.signalId, invalidDate);
    expect(res1.isValid).toBe(false);
    expect(res1.error?.code).toBe('INVALID_TIMESTAMP');

    // Future timestamp drift (5 minutes in future)
    const futureDate = new Date(Date.now() + 300000).toISOString();
    const futureTick: any = {
      symbol: 'HDFCBANK',
      price: 1610.0,
      timestamp: futureDate,
      provenance: 'REAL_EXCHANGE'
    };
    const res2 = engine.validateObservationTick(record.signalId, futureTick);
    expect(res2.isValid).toBe(false);
    expect(res2.error?.code).toBe('FUTURE_TIMESTAMP_DRIFT');

    // Valid recent timestamp passes
    const validPastTick: any = {
      symbol: 'HDFCBANK',
      price: 1610.0,
      timestamp: new Date().toISOString(),
      provenance: 'REAL_EXCHANGE'
    };
    const res3 = engine.validateObservationTick(record.signalId, validPastTick);
    expect(res3.isValid).toBe(true);
  });

  // ==========================================
  // TEST 5: Provenance & Provider Rejection
  // ==========================================
  it('TEST 5: Observations missing provenance or with invalid provider types are rejected', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_PROV_001',
      signalType: 'SENTIMENT_BULLISH',
      symbol: 'SBIN',
      initialPrice: 750.0,
      direction: 'BULLISH'
    });

    const now = new Date().toISOString();

    // 5a. Missing provenance completely
    const noProvenance: any = {
      symbol: 'SBIN',
      price: 755.0,
      timestamp: now
    };
    const res1 = engine.validateObservationTick(record.signalId, noProvenance);
    expect(res1.isValid).toBe(false);
    expect(res1.error?.code).toBe('MISSING_PROVENANCE');

    // 5b. Invalid provenance source type
    const invalidSource: any = {
      symbol: 'SBIN',
      price: 755.0,
      timestamp: now,
      provenance: 'UNVERIFIED_SCRAPING'
    };
    const res2 = engine.validateObservationTick(record.signalId, invalidSource);
    expect(res2.isValid).toBe(false);
    expect(res2.error?.code).toBe('INVALID_PROVENANCE_SOURCE');

    // 5c. Valid structured provenance passes
    const validProv: any = {
      symbol: 'SBIN',
      price: 755.0,
      timestamp: now,
      provenance: {
        sourceType: 'BROKER_FEED',
        provider: 'ZERODHA_KITE',
        feedTimestamp: now,
        traceId: 'TRC_001'
      }
    };
    const res3 = engine.validateObservationTick(record.signalId, validProv);
    expect(res3.isValid).toBe(true);
  });

  // ==========================================
  // TEST 6: Idempotent Deduplication
  // ==========================================
  it('TEST 6: Ingestion deduplication is idempotent (no duplicate count or timeline events)', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_DEDUP_001',
      signalType: 'ORDER_FLOW_IMBALANCE',
      symbol: 'TATAMOTORS',
      initialPrice: 900.0,
      direction: 'BULLISH'
    });

    const now = new Date().toISOString();
    const tick: MarketObservationTick = {
      symbol: 'TATAMOTORS',
      price: 905.0,
      timestamp: now,
      provenance: {
        sourceType: 'REAL_EXCHANGE',
        provider: 'NSE_TICKS'
      }
    };

    // First ingestion
    const res1 = engine.ingestMarketObservations(record.signalId, [tick]);
    expect(res1.observationCount).toBe(1);
    expect(res1.lastObservedPrice).toBe(905.0);
    const initialTimelineLength = res1.timeline.length;

    // Second ingestion of exact identical tick
    const res2 = engine.ingestMarketObservations(record.signalId, [tick]);
    expect(res2.observationCount).toBe(1); // count NOT incremented
    expect(res2.timeline.length).toBe(initialTimelineLength); // no duplicate timeline events
  });

  // ==========================================
  // TEST 7: Provenance-Aware Resolution Rejection (SYNTHETIC_TEST)
  // ==========================================
  it('TEST 7: SYNTHETIC_TEST observations cannot resolve outcomes in production records', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_PROV_SYNTH_001',
      signalType: 'MACRO_BULLISH',
      symbol: 'LT',
      initialPrice: 3000.0,
      direction: 'BULLISH'
    });

    // Explicitly mark record as production record
    record.isProductionRecord = true;

    // Provide synthetic test ticks reaching the target (+3%)
    const now = new Date().toISOString();
    const syntheticTicks: MarketObservationTick[] = [
      {
        symbol: 'LT',
        price: 3095.0, // +3.16%
        timestamp: now,
        provenance: {
          sourceType: 'SYNTHETIC_TEST',
          provider: 'UNIT_TEST_HARNESS'
        }
      }
    ];

    const updated = engine.ingestMarketObservations(record.signalId, syntheticTicks, { allowLegacyFallback: true });

    // Excursion was tracked for testing telemetry
    expect(updated.peakPrice).toBe(3095.0);
    expect(updated.mfePercent).toBeGreaterThan(3.0);

    // BUT outcome MUST NOT be resolved by synthetic data!
    expect(updated.isResolved).toBe(false);
    expect(updated.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    expect(updated.directionalAccuracy).toBe('UNRESOLVED');
    expect(updated.invalidationReason).toBe('SYNTHETIC_OBSERVATIONS_CANNOT_RESOLVE_PRODUCTION_OUTCOME');
  });

  // ==========================================
  // TEST 8: Real Market Observations Resolution
  // ==========================================
  it('TEST 8: Real market observations (REAL_EXCHANGE) resolve outcomes accurately', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_REAL_001',
      signalType: 'BREAKOUT_BULLISH',
      symbol: 'WIPRO',
      initialPrice: 500.0,
      direction: 'BULLISH',
      targetPercent: 2.0 // target: 510.0
    });

    const now = new Date().toISOString();
    const realTicks: MarketObservationTick[] = [
      {
        symbol: 'WIPRO',
        price: 512.0,
        high: 512.0,
        low: 500.0,
        timestamp: now,
        provenance: {
          sourceType: 'REAL_EXCHANGE',
          provider: 'NSE_REALTIME',
          feedTimestamp: now
        }
      }
    ];

    const updated = engine.ingestMarketObservations(record.signalId, realTicks);

    expect(updated.isResolved).toBe(true);
    expect(updated.outcome).toBe('TARGET_REACHED');
    expect(updated.directionalAccuracy).toBe('CORRECT');
    expect(updated.isCorrect).toBe(true);
    expect(updated.resolutionType).toBe('REAL_MARKET_DATA');
  });

  // ==========================================
  // TEST 9: Manual Internal Observations
  // ==========================================
  it('TEST 9: Manual internal observations record provenance metadata and manual resolution type', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_MANUAL_001',
      signalType: 'DEAL_ANNOUNCEMENT',
      symbol: 'ITC',
      initialPrice: 400.0,
      direction: 'BULLISH',
      targetPercent: 2.0 // target: 408.0
    });

    const now = new Date().toISOString();
    const manualTick: MarketObservationTick = {
      symbol: 'ITC',
      price: 410.0,
      high: 410.0,
      low: 400.0,
      timestamp: now,
      provenance: {
        sourceType: 'MANUAL_INTERNAL',
        provider: 'TERMINAL_OPERATOR',
        operatorId: 'OP_SENIOR_TRADER_42',
        notes: 'Verified against Bloomberg terminal quote'
      }
    };

    const updated = engine.ingestMarketObservations(record.signalId, [manualTick]);

    expect(updated.isResolved).toBe(true);
    expect(updated.outcome).toBe('TARGET_REACHED');
    expect(updated.resolutionType).toBe('MANUAL_INTERNAL');
  });

  // ==========================================
  // TEST 10: ObservationTrustBridge Translation
  // ==========================================
  it('TEST 10: ObservationTrustBridge accurately maps EquityObservation to MarketObservationTick', () => {
    const engine = SignalOutcomeEngine.getInstance();

    const record = engine.registerActionableSignal({
      eventId: 'EVT_BRIDGE_001',
      signalType: 'TECHNICAL_CROSSOVER',
      symbol: 'BAJFINANCE',
      initialPrice: 6800.0,
      direction: 'BULLISH'
    });

    const bridge = new ObservationTrustBridge(engine, 'NSE_BROKER_FEED');

    const equityObs: EquityObservation = {
      symbol: 'BAJFINANCE',
      exchange: 'NSE',
      ltp: 6850.0,
      open: 6800.0,
      high: 6860.0,
      low: 6790.0,
      previousClose: 6780.0,
      volume: 12000,
      timestamp: new Date().toISOString(),
      tradingStatus: 'ACTIVE',
      provenance: {
        provider: 'ZERODHA_KITE',
        providerType: 'AUTHORIZED_PROVIDER',
        exchange: 'NSE',
        observedAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        normalizedAt: new Date().toISOString(),
        requestId: 'REQ_001',
        dataStatus: 'AVAILABLE',
        freshness: 'REAL_TIME',
        sourceConfidence: 0.95
      }
    };

    const result = bridge.ingestTrustedEquityObservations(record.signalId, [equityObs], {
      sourceType: 'BROKER_FEED',
      provider: 'ZERODHA_KITE',
      operatorId: 'SYSTEM_DAEMON'
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBeDefined();
    expect(result.outcome?.observationCount).toBe(1);
    expect(result.outcome?.lastObservedPrice).toBe(6850.0);
    expect(result.outcome?.peakPrice).toBe(6860.0);
  });

  // ==========================================
  // TEST 11: Market Session Classification
  // ==========================================
  it('TEST 11: Market session classification accurately handles IST hours, minutes, and weekends', () => {
    const engine = SignalOutcomeEngine.getInstance();

    // 11a. Sunday -> CLOSED
    const sundayIso = '2026-03-29T10:00:00.000Z'; // March 29, 2026 is Sunday
    expect(engine.getMarketSession(sundayIso)).toBe('CLOSED');

    // 11b. Weekday regular market hours: 10:00 AM IST (4:30 AM UTC) on Tuesday
    const regularMarketIso = '2026-03-31T04:30:00.000Z'; // Tuesday 10:00 AM IST
    expect(engine.getMarketSession(regularMarketIso)).toBe('REGULAR_MARKET');

    // 11c. Pre-market hours: 9:05 AM IST (3:35 AM UTC) on Tuesday
    const preMarketIso = '2026-03-31T03:35:00.000Z'; // Tuesday 9:05 AM IST
    expect(engine.getMarketSession(preMarketIso)).toBe('PRE_MARKET');

    // 11d. Post-market hours: 3:45 PM IST (10:15 AM UTC) on Tuesday
    const postMarketIso = '2026-03-31T10:15:00.000Z'; // Tuesday 3:45 PM IST
    expect(engine.getMarketSession(postMarketIso)).toBe('POST_MARKET');

    // 11e. Night closed hours: 8:00 PM IST on Tuesday
    const closedNightIso = '2026-03-31T14:30:00.000Z'; // Tuesday 8:00 PM IST
    expect(engine.getMarketSession(closedNightIso)).toBe('CLOSED');

    // 11f. Invalid timestamp returns CLOSED gracefully
    expect(engine.getMarketSession('INVALID_TIMESTAMP')).toBe('CLOSED');
  });
});
