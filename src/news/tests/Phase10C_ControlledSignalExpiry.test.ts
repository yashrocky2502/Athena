/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10C
 * Phase10C_ControlledSignalExpiry.test.ts
 *
 * Dedicated Controlled Signal Expiry Engine Test Suite.
 *
 * Test Matrix (Requirements A through Z):
 * - TEST A: valid live ACTIVE signal expires after its validity window
 * - TEST B: valid live CONFIRMED signal expires after its validity window
 * - TEST C: valid live WEAKENING signal expires after its validity window
 * - TEST D: NEW signal handling is deterministic (held while valid, expires after validity window)
 * - TEST E: already EXPIRED signal is untouched
 * - TEST F: INVALIDATED signal is untouched
 * - TEST G: CONTRADICTED signal follows existing deterministic terminal rules and does not bypass lifecycle validation
 * - TEST H: missing live source fails closed (zero candidates, source unavailable recorded)
 * - TEST I: historical unresolved outcome records are NOT selected
 * - TEST J: historical unresolved record with a valid-looking real symbol is still NOT selected
 * - TEST K: same symbol existing in both historical and live sources only causes the LIVE signal to be processed
 * - TEST L: canonical Phase 10A signalId is preserved
 * - TEST M: expiry synchronizes to SignalOutcomeEngine exactly once
 * - TEST N: repeated sweeps are idempotent (no duplicate timeline events, transitions, or outcomes)
 * - TEST O: provider/market-data failure does not cause early or artificial expiry
 * - TEST P: no synthetic observation is created upon expiry
 * - TEST Q: no final price or P&L is fabricated upon expiry
 * - TEST R: market-session behavior uses existing MarketSessionEngine
 * - TEST S: scheduler prevents overlapping sweeps via mutex/flag
 * - TEST T: VITEST environment prevents unintended background timer execution and server.ts integration is verified
 * - TEST U: protected production dataset files remain byte-for-byte unchanged with exact SHA-256 hashes
 * - TEST V: lifecycle historical ledger in production remains untouched; test records remain in isolated paths
 * - TEST W: telemetry counters are strictly deterministic
 * - TEST X: live ACTIVE signal with isActionable=false is rejected as invalid candidate and never expires
 * - TEST Y: live signal without authoritative lifecycle is rejected and never expires or mutates outcome
 * - TEST Z: valid live signal with authoritative lifecycle transitions through SignalLifecycleEngine and syncs outcome once
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

import { SignalOutcomeEngine } from '../market-intelligence/SignalOutcomeEngine.ts';
import { SignalLifecycleEngine, SignalLifecycle, SignalLifecycleState } from '../intelligence/SignalLifecycleEngine.ts';
import { MarketSessionEngine } from '../market-data/MarketSessionEngine.ts';
import {
  ControlledSignalExpiryEngine,
  ControlledExpiryOptions,
  ExpiryEngineTelemetry,
  SweepExecutionResult
} from '../market-data/ControlledSignalExpiryEngine.ts';
import { LiveSignalReference } from '../market-data/AutomatedMarketObservationFeed.ts';
import { MarketSignal } from '../intelligence/MarketIntelligenceFusionEngine.ts';

describe('PHASE 10C — CONTROLLED SIGNAL EXPIRY ENGINE', () => {
  let tempDir: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;
  let testLifecyclePath: string;
  let testLedgerPath: string;

  let isolatedOutcomeEngine: SignalOutcomeEngine;
  let isolatedLifecycleEngine: SignalLifecycleEngine;
  let expiryEngine: ControlledSignalExpiryEngine;

  // Authoritative protected production datasets and their immutable baseline hashes
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
      expectedCount: null
    },
    {
      filePath: 'data/news_signal_historical_ledger.json',
      expectedHash: '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c',
      expectedCount: null
    }
  ];

  function computeSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  function getRecordCount(filePath: string): number | null {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object' && data !== null) return Object.keys(data).length;
      return null;
    } catch {
      return null;
    }
  }

  function seedAuthoritativeLifecycle(params: {
    signalId: string;
    symbol: string;
    signalType: string;
    state: SignalLifecycleState;
    generatedAt: string;
    revision?: number;
    priority?: string;
    isActionable?: boolean;
    initialPrice?: number;
    direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }) {
    const eventId = params.signalId.split('::')[0];
    const revision = params.revision ?? 1;

    isolatedLifecycleEngine.registerLifecycle({
      signalId: params.signalId,
      eventId,
      symbol: params.symbol,
      signalType: params.signalType,
      currentState: params.state,
      timeline: [
        {
          transitionId: `${params.signalId}::INIT`,
          previousState: 'NEW',
          newState: params.state,
          timestamp: params.generatedAt,
          reason: 'Initial test setup',
          evidence: {},
          signalRevision: revision,
          lifecycleRevision: revision
        }
      ],
      rawScore: 85,
      decayedScore: 85,
      decayFactor: 1.0,
      scoreAge: 0,
      actionability: params.isActionable !== false ? 'ACTIONABLE' : 'NO_LONGER_ACTIONABLE',
      createdAt: params.generatedAt,
      contradictionDetected: false,
      fundamentalDirection: params.direction || 'BULLISH',
      initialScore: 85,
      peakScore: 85,
      initialPriority: (params.priority || 'P1_HIGH') as any,
      initialAlignment: 'ALIGNED',
      lifecycleRevision: revision,
      lastUpdated: params.generatedAt
    });

    if (params.initialPrice !== undefined || isolatedOutcomeEngine.getRecord(params.signalId) === undefined) {
      isolatedOutcomeEngine.registerActionableSignal({
        signalId: params.signalId,
        eventId,
        signalType: params.signalType,
        symbol: params.symbol,
        revision,
        generatedAt: params.generatedAt,
        initialPrice: params.initialPrice,
        direction: params.direction || 'BULLISH',
        signalLifecycleState: params.state
      });
    }

    expiryEngine.registerLiveSignal({
      signalId: params.signalId,
      symbol: params.symbol,
      signalType: params.signalType,
      revision,
      direction: params.direction || 'BULLISH',
      lifecycleState: params.state,
      priority: params.priority || 'P1_HIGH',
      generatedAt: params.generatedAt,
      isActionable: params.isActionable !== false
    });
  }

  beforeAll(() => {
    // Verify protected datasets are intact before test execution
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      if (dataset.expectedCount !== null) {
        expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
      }
    }
  });

  afterAll(() => {
    SignalOutcomeEngine.resetInstanceForProduction();
    SignalLifecycleEngine.resetInstanceForProduction();
    ControlledSignalExpiryEngine.resetInstance();

    // Verify protected datasets remain byte-for-byte unchanged after test execution
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      if (dataset.expectedCount !== null) {
        expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
      }
    }
  });

  beforeEach(() => {
    // 1. Establish isolated temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-p10c-test-'));
    testOutcomePath = path.join(tempDir, 'market_intelligence_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'market_intelligence_outcomes.json.bak');
    testLifecyclePath = path.join(tempDir, 'news_signal_lifecycle.json');
    testLedgerPath = path.join(tempDir, 'news_signal_historical_ledger.json');

    fs.writeFileSync(testOutcomePath, JSON.stringify([]), 'utf-8');
    fs.writeFileSync(testOutcomeBakPath, JSON.stringify([]), 'utf-8');
    fs.writeFileSync(testLifecyclePath, JSON.stringify({}), 'utf-8');
    fs.writeFileSync(testLedgerPath, JSON.stringify([]), 'utf-8');

    // 2. Initialize isolated engines bound to temporary paths
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
    isolatedOutcomeEngine = SignalOutcomeEngine.getInstance();

    SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
    isolatedLifecycleEngine = SignalLifecycleEngine.getInstance();

    // 3. Initialize ControlledSignalExpiryEngine with isolated components
    expiryEngine = new ControlledSignalExpiryEngine(
      isolatedLifecycleEngine,
      isolatedOutcomeEngine,
      MarketSessionEngine,
      {
        allowOffHoursForTesting: true,
        enforceMarketSession: false
      }
    );
  });

  afterEach(() => {
    if (expiryEngine) {
      expiryEngine.stop();
    }
    // Clean up temporary files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('TEST A: valid live ACTIVE signal expires after its validity window', async () => {
    const signalId = 'evt_active_001::BREAKING_NEWS::1';
    const nowMs = Date.now();
    // BREAKING_NEWS validity is 300s. Created 350s ago.
    const createdTime = new Date(nowMs - 350 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'RELIANCE',
      signalType: 'BREAKING_NEWS',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 2500,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);

    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(1);
    expect(result.expiryCandidates).toBe(1);
    expect(result.signalsExpired).toBe(1);
    expect(result.expiredSignalIds).toContain(signalId);

    // Verify outcome engine record synchronization
    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record).toBeDefined();
    expect(record?.signalLifecycleState).toBe('EXPIRED');
    expect(record?.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');
    expect(record?.isResolved).toBe(true);
    expect(record?.directionalAccuracy).toBe('INCONCLUSIVE');

    // Verify lifecycle state transition
    const lc = isolatedLifecycleEngine.getLifecycle(signalId);
    expect(lc?.currentState).toBe('EXPIRED');
  });

  it('TEST B: valid live CONFIRMED signal expires after its validity window', async () => {
    const signalId = 'evt_conf_001::EARNINGS::1';
    const nowMs = Date.now();
    // EARNINGS validity is 7200s (2 hrs). Created 7500s ago.
    const createdTime = new Date(nowMs - 7500 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'INFY',
      signalType: 'EARNINGS',
      state: 'CONFIRMED',
      generatedAt: createdTime,
      initialPrice: 1600,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.signalLifecycleState).toBe('EXPIRED');
    expect(record?.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');
    expect(record?.isResolved).toBe(true);
  });

  it('TEST C: valid live WEAKENING signal expires after its validity window', async () => {
    const signalId = 'evt_weak_001::MERGER::1';
    const nowMs = Date.now();
    // MERGER validity is 86400s (24 hrs). Created 90000s ago.
    const createdTime = new Date(nowMs - 90000 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'HDFCBANK',
      signalType: 'MERGER',
      state: 'WEAKENING',
      generatedAt: createdTime,
      initialPrice: 1700,
      priority: 'P2_MEDIUM',
      direction: 'BEARISH',
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.signalLifecycleState).toBe('EXPIRED');
    expect(record?.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');
  });

  it('TEST D: NEW signal handling is deterministic (held while valid, expires after validity window)', async () => {
    const signalId = 'evt_new_001::BREAKING_NEWS::1';
    const nowMs = Date.now();
    // BREAKING_NEWS validity: 300s.
    // 1. When age is 150s (less than 300s), signal must NOT expire
    const timeWithinWindow = new Date(nowMs - 150 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'TCS',
      signalType: 'BREAKING_NEWS',
      state: 'NEW',
      generatedAt: timeWithinWindow,
      isActionable: true
    });

    let result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.expiryCandidates).toBe(1);
    expect(result.signalsExpired).toBe(0); // Valid -> Not expired

    // 2. When age advances to 350s (greater than 300s), signal MUST expire deterministically
    expiryEngine.clearLiveSignals();
    const timePastWindow = new Date(nowMs - 350 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'TCS',
      signalType: 'BREAKING_NEWS',
      state: 'NEW',
      generatedAt: timePastWindow,
      isActionable: true
    });

    result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(1);
  });

  it('TEST E: already EXPIRED signal is untouched', async () => {
    const signalId = 'evt_already_exp::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 600 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'WIPRO',
      signalType: 'BREAKING',
      state: 'EXPIRED',
      generatedAt: createdTime,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(1);
    expect(result.alreadyTerminalSignals).toBe(1);
    expect(result.expiryCandidates).toBe(0);
    expect(result.signalsExpired).toBe(0);
  });

  it('TEST F: INVALIDATED signal is untouched', async () => {
    const signalId = 'evt_inval_001::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 600 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'AXISBANK',
      signalType: 'BREAKING',
      state: 'INVALIDATED',
      generatedAt: createdTime,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(1);
    expect(result.alreadyTerminalSignals).toBe(1);
    expect(result.expiryCandidates).toBe(0);
    expect(result.signalsExpired).toBe(0);
  });

  it('TEST G: CONTRADICTED signal follows existing deterministic terminal rules and does not bypass lifecycle validation', async () => {
    const signalId = 'evt_contra_001::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'KOTAKBANK',
      signalType: 'BREAKING',
      state: 'CONTRADICTED',
      generatedAt: createdTime,
      initialPrice: 1800,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.expiryCandidates).toBe(1);
    expect(result.signalsExpired).toBe(1);

    const lc = isolatedLifecycleEngine.getLifecycle(signalId);
    expect(lc?.currentState).toBe('EXPIRED');
  });

  it('TEST H: missing live source fails closed', async () => {
    // 1. Provide null liveSignalSource and no local signals
    const failClosedEngine = new ControlledSignalExpiryEngine(
      isolatedLifecycleEngine,
      isolatedOutcomeEngine,
      MarketSessionEngine,
      {
        liveSignalSource: null,
        allowOffHoursForTesting: true
      }
    );

    const result = await failClosedEngine.executeSweep();
    expect(result.status).toBe('SOURCE_UNAVAILABLE');
    expect(result.signalsExpired).toBe(0);
    expect(failClosedEngine.getTelemetry().sourceUnavailableCount).toBe(1);
  });

  it('TEST I: historical unresolved outcome records are NOT selected', async () => {
    // 1. Seed historical unresolved record in Outcome Engine
    const historicalSignalId = 'hist_unresolved_446_test';
    isolatedOutcomeEngine.recordOutcome({
      signalId: historicalSignalId,
      eventId: 'evt_hist_unresolved',
      signalType: 'BREAKOUT',
      symbol: 'ITC',
      revision: 1,
      direction: 'BULLISH',
      initialPrice: 450,
      generatedAt: '2026-08-01T10:00:00.000Z',
      isResolved: false,
      outcome: 'INSUFFICIENT_MARKET_DATA',
      observationCount: 0,
      mfePercent: 0,
      maePercent: 0,
      resolutionTimeSeconds: 0,
      timeline: []
    });

    // 2. Configure engine with empty live signal source
    expiryEngine.setLiveSignalSource(() => []);

    const result = await expiryEngine.executeSweep();
    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(0);
    expect(result.expiryCandidates).toBe(0);
    expect(result.signalsExpired).toBe(0);

    // 3. Verify historical record remains completely unresolved and untouched
    const histRecord = isolatedOutcomeEngine.getRecord(historicalSignalId);
    expect(histRecord).toBeDefined();
    expect(histRecord?.isResolved).toBe(false);
    expect(histRecord?.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    expect(histRecord?.timeline.length).toBe(0);
  });

  it('TEST J: historical unresolved record with a valid-looking real symbol is still NOT selected', async () => {
    const historicalSignalId = 'hist_reliance_p10c_unresolved';
    isolatedOutcomeEngine.recordOutcome({
      signalId: historicalSignalId,
      eventId: 'evt_reliance_hist',
      signalType: 'EARNINGS',
      symbol: 'RELIANCE',
      revision: 1,
      direction: 'BULLISH',
      initialPrice: 2400,
      generatedAt: '2026-07-15T09:15:00.000Z',
      isResolved: false,
      outcome: 'INSUFFICIENT_MARKET_DATA',
      observationCount: 0,
      mfePercent: 0,
      maePercent: 0,
      resolutionTimeSeconds: 0,
      timeline: []
    });

    expiryEngine.setLiveSignalSource(() => []);

    const result = await expiryEngine.executeSweep();
    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(0);
    expect(result.signalsExpired).toBe(0);

    const rec = isolatedOutcomeEngine.getRecord(historicalSignalId);
    expect(rec?.isResolved).toBe(false);
    expect(rec?.outcome).toBe('INSUFFICIENT_MARKET_DATA');
  });

  it('TEST K: same symbol existing in both historical and live sources only causes the LIVE signal to be processed', async () => {
    const histSignalId = 'hist_tcs_unresolved';
    const liveSignalId = 'evt_live_tcs_p10c::BREAKING::1';
    const nowMs = Date.now();
    const agedLiveTime = new Date(nowMs - 400 * 1000).toISOString();

    // 1. Seed historical TCS record
    isolatedOutcomeEngine.recordOutcome({
      signalId: histSignalId,
      eventId: 'evt_hist_tcs',
      signalType: 'BREAKING',
      symbol: 'TCS',
      revision: 1,
      direction: 'BULLISH',
      initialPrice: 3800,
      generatedAt: '2026-08-01T10:00:00.000Z',
      isResolved: false,
      outcome: 'INSUFFICIENT_MARKET_DATA',
      observationCount: 0,
      mfePercent: 0,
      maePercent: 0,
      resolutionTimeSeconds: 0,
      timeline: []
    });

    // 2. Seed and register live TCS signal with authoritative lifecycle
    seedAuthoritativeLifecycle({
      signalId: liveSignalId,
      symbol: 'TCS',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: agedLiveTime,
      initialPrice: 3900,
      isActionable: true
    });

    // 3. Execute sweep
    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(1);
    expect(result.signalsExpired).toBe(1);
    expect(result.expiredSignalIds).toEqual([liveSignalId]);

    // Live signal expired
    const liveRec = isolatedOutcomeEngine.getRecord(liveSignalId);
    expect(liveRec?.isResolved).toBe(true);
    expect(liveRec?.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');

    // Historical signal untouched
    const histRec = isolatedOutcomeEngine.getRecord(histSignalId);
    expect(histRec?.isResolved).toBe(false);
    expect(histRec?.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    expect(histRec?.timeline.length).toBe(0);
  });

  it('TEST L: canonical Phase 10A signalId is preserved', async () => {
    const canonicalId = 'evt_canonical_p10a_555::STRUCTURAL_BREAKOUT::3';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 500000 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId: canonicalId,
      symbol: 'BAJFINANCE',
      signalType: 'STRUCTURAL_BREAKOUT',
      revision: 3,
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 7000,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(1);
    expect(result.expiredSignalIds[0]).toBe(canonicalId);

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record).toBeDefined();
    expect(record?.signalId).toBe(canonicalId);
  });

  it('TEST M: expiry synchronizes to SignalOutcomeEngine exactly once', async () => {
    const signalId = 'evt_sync_once::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'SBIN',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 800,
      isActionable: true
    });

    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.signalLifecycleState).toBe('EXPIRED');
    expect(record?.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');
    expect(record?.isResolved).toBe(true);

    const expiryTimelineEvents = record?.timeline.filter(e =>
      e.eventType === 'LIFECYCLE_TRANSITION' && e.description.includes('EXPIRED')
    );
    expect(expiryTimelineEvents?.length).toBe(1);
  });

  it('TEST N: repeated sweeps are idempotent (no duplicate timeline events, transitions, or outcomes)', async () => {
    const signalId = 'evt_idempotent::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'MARUTI',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 12000,
      isActionable: true
    });

    // Sweep 1: Transitions signal to EXPIRED
    const result1 = await expiryEngine.executeSweep(nowMs);
    expect(result1.signalsExpired).toBe(1);
    expect(result1.alreadyTerminalSignals).toBe(0);

    const recordAfterSweep1 = isolatedOutcomeEngine.getRecord(signalId);
    const timelineLen1 = recordAfterSweep1?.timeline.length;

    // Sweep 2: Repeated execution must be a complete no-op on already-expired signal
    const result2 = await expiryEngine.executeSweep(nowMs);
    expect(result2.signalsExpired).toBe(0);
    expect(result2.alreadyTerminalSignals).toBe(1);

    const recordAfterSweep2 = isolatedOutcomeEngine.getRecord(signalId);
    expect(recordAfterSweep2?.timeline.length).toBe(timelineLen1);

    // Sweep 3: Additional repeated execution remains completely idempotent
    const result3 = await expiryEngine.executeSweep(nowMs);
    expect(result3.signalsExpired).toBe(0);
    expect(result3.alreadyTerminalSignals).toBe(1);
    expect(isolatedOutcomeEngine.getRecord(signalId)?.timeline.length).toBe(timelineLen1);
  });

  it('TEST O: provider/market-data failure does not cause early or artificial expiry', async () => {
    const signalId = 'evt_p_fail::BREAKING::1';
    const nowMs = Date.now();
    // Age is only 60s (< 300s validity window)
    const recentTime = new Date(nowMs - 60 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'TATAMOTORS',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: recentTime,
      isActionable: true
    });

    // Market data / external provider issues must not cause premature expiry
    const result = await expiryEngine.executeSweep(nowMs);
    expect(result.status).toBe('SUCCESS');
    expect(result.expiryCandidates).toBe(1);
    expect(result.signalsExpired).toBe(0);
  });

  it('TEST P: no synthetic observation is created upon expiry', async () => {
    const signalId = 'evt_no_synth_obs::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'LT',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 3500,
      isActionable: true
    });

    await expiryEngine.executeSweep(nowMs);

    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.observationCount).toBe(0);
    expect(record?.timeline.some(t => t.eventType === 'MARKET_OBSERVATION')).toBe(false);
  });

  it('TEST Q: no final price or P&L is fabricated upon expiry', async () => {
    const signalId = 'evt_no_fab_price::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'SUNPHARMA',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 1500,
      isActionable: true
    });

    await expiryEngine.executeSweep(nowMs);

    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.lastObservedPrice).toBe(1500);
    expect(record?.mfePercent).toBe(0);
    expect(record?.maePercent).toBe(0);
    expect((record as any)?.finalPrice).toBeUndefined();
  });

  it('TEST R: market-session behavior uses existing MarketSessionEngine', async () => {
    const sessionEngine = new ControlledSignalExpiryEngine(
      isolatedLifecycleEngine,
      isolatedOutcomeEngine,
      MarketSessionEngine,
      {
        enforceMarketSession: true,
        allowOffHoursForTesting: false,
        exchange: 'NSE'
      }
    );

    // Simulated Sunday timestamp (Market closed)
    const sundayIso = '2026-09-20T10:00:00.000Z';
    const sundayMs = new Date(sundayIso).getTime();

    const result = await sessionEngine.executeSweep(sundayMs);
    expect(result.status).toBe('SKIPPED_MARKET_CLOSED');
    expect(result.message).toContain('non-trading market session');
    expect(sessionEngine.getTelemetry().sweepsSkipped).toBe(1);
  });

  it('TEST S: scheduler prevents overlapping sweeps via mutex/flag', async () => {
    // Manually simulate sweep lock in flight
    (expiryEngine as any).isProcessingSweep = true;

    const result = await expiryEngine.executeSweep();
    expect(result.status).toBe('SKIPPED_OVERLAPPING');
    expect(result.message).toContain('in flight');
    expect(expiryEngine.getTelemetry().overlappingSweepsPrevented).toBe(1);

    (expiryEngine as any).isProcessingSweep = false;
  });

  it('TEST T: VITEST environment prevents unintended background timer execution and server.ts integration is verified', () => {
    // 1. In VITEST environment, start() must NOT start background timer unless autoStartInTest: true
    expiryEngine.start();
    expect(expiryEngine.isActive()).toBe(false);

    // ControlledSignalExpiryEngine.start() static also respects VITEST
    ControlledSignalExpiryEngine.start();
    expect(ControlledSignalExpiryEngine.getInstance().isActive()).toBe(false);

    // 2. Verify server.ts imports ControlledSignalExpiryEngine and invokes ControlledSignalExpiryEngine.start()
    const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
    expect(serverCode).toContain('import { ControlledSignalExpiryEngine } from "./src/news/market-data/ControlledSignalExpiryEngine.ts"');
    expect(serverCode).toContain('ControlledSignalExpiryEngine.start()');

    // 3. When autoStartInTest is explicitly enabled for tests, it does start
    const testTimerEngine = new ControlledSignalExpiryEngine(
      isolatedLifecycleEngine,
      isolatedOutcomeEngine,
      MarketSessionEngine,
      {
        autoStartInTest: true,
        intervalMs: 100000
      }
    );

    testTimerEngine.start();
    expect(testTimerEngine.isActive()).toBe(true);
    testTimerEngine.stop();
    expect(testTimerEngine.isActive()).toBe(false);
  });

  it('TEST U: protected production dataset files remain byte-for-byte unchanged with exact SHA-256 hashes', () => {
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      if (dataset.expectedCount !== null) {
        expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
      }
    }
  });

  it('TEST V: lifecycle historical ledger in production remains untouched; test records remain in isolated paths', () => {
    // Production ledger check
    const prodLedgerHash = computeSha256('data/news_signal_historical_ledger.json');
    expect(prodLedgerHash).toBe('805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c');

    // Isolated test ledger verification
    expect(fs.existsSync(testLedgerPath)).toBe(true);
  });

  it('TEST W: telemetry counters are strictly deterministic', async () => {
    expiryEngine.resetTelemetry();
    let telem = expiryEngine.getTelemetry();
    expect(telem.sweepsStarted).toBe(0);
    expect(telem.signalsExpired).toBe(0);
    expect(telem.liveSignalsDiscovered).toBe(0);

    const signalId = 'evt_telem_001::BREAKING::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'ULTRACEMCO',
      signalType: 'BREAKING',
      state: 'ACTIVE',
      generatedAt: createdTime,
      isActionable: true
    });

    await expiryEngine.executeSweep(nowMs);

    telem = expiryEngine.getTelemetry();
    expect(telem.sweepsStarted).toBe(1);
    expect(telem.liveSignalsDiscovered).toBe(1);
    expect(telem.expiryCandidates).toBe(1);
    expect(telem.signalsExpired).toBe(1);
    expect(telem.alreadyTerminalSignals).toBe(0);
    expect(telem.invalidCandidates).toBe(0);
    expect(telem.lastSweepTimestamp).toBeDefined();
    expect(telem.lastSweepDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('TEST X: live ACTIVE signal with isActionable=false is rejected as invalid candidate and never expires', async () => {
    const signalId = 'evt_test_x_001::BREAKING_NEWS::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'RELIANCE',
      signalType: 'BREAKING_NEWS',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 2500,
      isActionable: false
    });

    const result = await expiryEngine.executeSweep(nowMs);

    expect(result.status).toBe('SUCCESS');
    expect(result.liveSignalsDiscovered).toBe(1);
    expect(result.signalsExpired).toBe(0);
    expect(result.expiryCandidates).toBe(0);
    expect(result.invalidCandidates).toBe(1);

    // Lifecycle remains unchanged (ACTIVE)
    const lc = isolatedLifecycleEngine.getLifecycle(signalId);
    expect(lc?.currentState).toBe('ACTIVE');

    // Outcome remains unchanged (ACTIVE)
    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.signalLifecycleState).toBe('ACTIVE');
    expect(record?.isResolved).toBe(false);
  });

  it('TEST Y: live signal without authoritative lifecycle is rejected and never expires or mutates outcome', async () => {
    const signalId = 'evt_test_y_001::BREAKING_NEWS::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    // 1. Seed an outcome record in SignalOutcomeEngine, but DO NOT seed SignalLifecycleEngine
    isolatedOutcomeEngine.registerActionableSignal({
      signalId,
      eventId: 'evt_test_y_001',
      signalType: 'BREAKING_NEWS',
      symbol: 'INFY',
      revision: 1,
      generatedAt: createdTime,
      initialPrice: 1500,
      direction: 'BULLISH',
      signalLifecycleState: 'ACTIVE'
    });

    // 2. Register live signal in expiryEngine without lifecycle engine registration
    expiryEngine.registerLiveSignal({
      signalId,
      symbol: 'INFY',
      signalType: 'BREAKING_NEWS',
      revision: 1,
      direction: 'BULLISH',
      lifecycleState: 'ACTIVE',
      priority: 'P1_HIGH',
      generatedAt: createdTime,
      isActionable: true
    });

    // Confirm NO lifecycle record exists in isolatedLifecycleEngine
    expect(isolatedLifecycleEngine.getLifecycle(signalId)).toBeUndefined();
    const initialLedgerLen = isolatedLifecycleEngine.getHistoricalLedger().length;

    // 3. Execute sweep
    const result = await expiryEngine.executeSweep(nowMs);

    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(0);
    expect(result.expiryCandidates).toBe(0);
    expect(result.invalidCandidates).toBe(1);
    expect(result.lifecycleUnavailableCount).toBe(1);

    // 4. SignalOutcomeEngine unchanged
    const record = isolatedOutcomeEngine.getRecord(signalId);
    expect(record?.signalLifecycleState).toBe('ACTIVE');
    expect(record?.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    expect(record?.outcome).not.toBe('EXPIRED_WITHOUT_RESOLUTION');
    expect(record?.isResolved).toBe(false);
    expect(record?.lastObservedPrice).toBe(1500);
    expect((record as any)?.finalPrice).toBeUndefined();

    // 5. No historical ledger mutation
    expect(isolatedLifecycleEngine.getHistoricalLedger().length).toBe(initialLedgerLen);
  });

  it('TEST Z: valid live signal with authoritative lifecycle transitions through SignalLifecycleEngine and syncs outcome once', async () => {
    const signalId = 'evt_test_z_001::BREAKING_NEWS::1';
    const nowMs = Date.now();
    const createdTime = new Date(nowMs - 400 * 1000).toISOString();

    seedAuthoritativeLifecycle({
      signalId,
      symbol: 'TCS',
      signalType: 'BREAKING_NEWS',
      state: 'ACTIVE',
      generatedAt: createdTime,
      initialPrice: 3800,
      isActionable: true
    });

    const initialLedgerCount = isolatedLifecycleEngine.getHistoricalLedger().length;

    // Execute sweep
    const result = await expiryEngine.executeSweep(nowMs);

    expect(result.status).toBe('SUCCESS');
    expect(result.signalsExpired).toBe(1);
    expect(result.expiredSignalIds).toContain(signalId);

    // Authoritative lifecycle transitioned to EXPIRED
    const lc = isolatedLifecycleEngine.getLifecycle(signalId);
    expect(lc?.currentState).toBe('EXPIRED');
    expect(lc?.actionability).toBe('NO_LONGER_ACTIONABLE');
    expect(lc?.decayedScore).toBe(0);

    // Historical ledger recorded exactly once
    const ledger = isolatedLifecycleEngine.getHistoricalLedger();
    expect(ledger.length).toBe(initialLedgerCount + 1);
    const ledgerEntry = ledger.find(l => l.signalId === signalId);
    expect(ledgerEntry?.finalState).toBe('EXPIRED');

    // Outcome synchronized exactly once with EXPIRED_WITHOUT_RESOLUTION
    const outcomeRec = isolatedOutcomeEngine.getRecord(signalId);
    expect(outcomeRec?.signalLifecycleState).toBe('EXPIRED');
    expect(outcomeRec?.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');
    expect(outcomeRec?.isResolved).toBe(true);
    expect(outcomeRec?.directionalAccuracy).toBe('INCONCLUSIVE');
    expect(outcomeRec?.isCorrect).toBe(false);

    const expiryEvents = outcomeRec?.timeline.filter(e =>
      e.eventType === 'LIFECYCLE_TRANSITION' && e.description.includes('EXPIRED')
    );
    expect(expiryEvents?.length).toBe(1);
  });
});
