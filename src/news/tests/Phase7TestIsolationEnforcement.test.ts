/**
 * ATHENA FINANCIAL INTELLIGENCE ENGINE — PHASE 7
 * Phase7TestIsolationEnforcement.test.ts
 *
 * Dedicated Test Isolation & Production Dataset Protection Suite proving:
 * A. Parameterless SignalOutcomeEngine.resetInstance() cannot rebind tests to production storage.
 * B. Explicit temporary SignalOutcomeEngine paths work.
 * C. SignalLifecycleEngine.transition() executed from a test cannot change the production outcomes file.
 * D. Production outcomes SHA remains unchanged after the test.
 * E. Repeated test execution does not append records to production outcomes.
 * F. SignalLifecycleEngine tests do not mutate lifecycle production data.
 * G. PersistentNewsStore tests do not mutate news_core_v2.json.
 * H. No .tmp test artifacts remain in production data directories.
 * I. Tests may safely persist into temporary directories.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SignalOutcomeEngine, SignalOutcomeRecord } from '../market-intelligence/SignalOutcomeEngine.ts';
import { SignalLifecycleEngine } from '../intelligence/SignalLifecycleEngine.ts';
import { PersistentNewsStore } from '../../newsCoreV2/storage/PersistentNewsStore.ts';
import { MarketSignal } from '../intelligence/MarketIntelligenceFusionEngine.ts';

describe('PHASE 7 — COMPREHENSIVE TEST ISOLATION & PRODUCTION DATASET PROTECTION', () => {
  let tempDir: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;
  let testLifecyclePath: string;
  let testLedgerPath: string;
  let testNewsCorePath: string;

  const prodOutcomePath = path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json');
  const prodOutcomeBakPath = path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json.bak');
  const prodLifecyclePath = path.join(process.cwd(), 'data', 'news_signal_lifecycle.json');
  const prodLedgerPath = path.join(process.cwd(), 'data', 'news_signal_historical_ledger.json');
  const prodNewsCorePath = path.join(process.cwd(), 'data', 'news_core_v2.json');

  const EXPECTED_OUTCOME_SHA = '47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd';
  const EXPECTED_OUTCOME_COUNT = 446;
  const EXPECTED_OUTCOME_BAK_SHA = '33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764';
  const EXPECTED_OUTCOME_BAK_COUNT = 445;
  const EXPECTED_NEWS_CORE_SHA = 'eeaf6542fbe472aef999612d4ccced8623e37ba7d4c5ebc24653fe5340c9940b';
  const EXPECTED_NEWS_CORE_COUNT = 1212;
  const EXPECTED_LIFECYCLE_SHA = 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1';
  const EXPECTED_LIFECYCLE_COUNT = 498;
  const EXPECTED_LEDGER_SHA = '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c';

  function getFileSha(filePath: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  }

  function getRecordCount(filePath: string): number {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : (typeof parsed === 'object' ? Object.keys(parsed).length : 0);
  }

  beforeAll(() => {
    // Assert initial baseline validity before test suite runs
    expect(getFileSha(prodOutcomePath)).toBe(EXPECTED_OUTCOME_SHA);
    expect(getRecordCount(prodOutcomePath)).toBe(EXPECTED_OUTCOME_COUNT);
    expect(getFileSha(prodOutcomeBakPath)).toBe(EXPECTED_OUTCOME_BAK_SHA);
    expect(getRecordCount(prodOutcomeBakPath)).toBe(EXPECTED_OUTCOME_BAK_COUNT);
    expect(getFileSha(prodNewsCorePath)).toBe(EXPECTED_NEWS_CORE_SHA);
    expect(getRecordCount(prodNewsCorePath)).toBe(EXPECTED_NEWS_CORE_COUNT);
    expect(getFileSha(prodLifecyclePath)).toBe(EXPECTED_LIFECYCLE_SHA);
    expect(getRecordCount(prodLifecyclePath)).toBe(EXPECTED_LIFECYCLE_COUNT);
    expect(getFileSha(prodLedgerPath)).toBe(EXPECTED_LEDGER_SHA);
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase7_iso_test_'));
    testOutcomePath = path.join(tempDir, 'test_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'test_outcomes.json.bak');
    testLifecyclePath = path.join(tempDir, 'test_lifecycle.json');
    testLedgerPath = path.join(tempDir, 'test_ledger.json');
    testNewsCorePath = path.join(tempDir, 'test_news_core.json');

    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
    SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  afterAll(() => {
    // Restore production singletons
    try {
      SignalOutcomeEngine.resetInstanceForProduction();
      SignalLifecycleEngine.resetInstanceForProduction();
    } catch {}

    // Final baseline audit after complete suite
    expect(getFileSha(prodOutcomePath)).toBe(EXPECTED_OUTCOME_SHA);
    expect(getRecordCount(prodOutcomePath)).toBe(EXPECTED_OUTCOME_COUNT);
    expect(getFileSha(prodOutcomeBakPath)).toBe(EXPECTED_OUTCOME_BAK_SHA);
    expect(getRecordCount(prodOutcomeBakPath)).toBe(EXPECTED_OUTCOME_BAK_COUNT);
    expect(getFileSha(prodNewsCorePath)).toBe(EXPECTED_NEWS_CORE_SHA);
    expect(getRecordCount(prodNewsCorePath)).toBe(EXPECTED_NEWS_CORE_COUNT);
    expect(getFileSha(prodLifecyclePath)).toBe(EXPECTED_LIFECYCLE_SHA);
    expect(getRecordCount(prodLifecyclePath)).toBe(EXPECTED_LIFECYCLE_COUNT);
    expect(getFileSha(prodLedgerPath)).toBe(EXPECTED_LEDGER_SHA);
  });

  const createMockOutcomeRecord = (id: string): SignalOutcomeRecord => ({
    signalId: id,
    eventId: `evt_${id}`,
    signalType: 'EARNINGS_BEAT',
    symbol: 'TCS',
    revision: 1,
    generatedAt: new Date().toISOString(),
    eventCategory: 'EARNINGS',
    sector: 'IT',
    sourceTier: 'Tier 1',
    direction: 'BULLISH',
    initialPrice: 4000,
    initialMarketState: 'ACTIVE',
    initialCompositeScore: 88,
    initialPriority: 'P1_HIGH',
    priority: 'P1_HIGH',
    initialAlignment: 'ALIGNED',
    targetPrice: 4100,
    stopPrice: 3950,
    targetPercent: 2.5,
    stopPercent: -1.25,
    mfePercent: 0,
    maePercent: 0,
    outcome: 'NEUTRAL_REACTION',
    directionalAccuracy: 'INCONCLUSIVE',
    signalLifecycleState: 'ACTIVE',
    isResolved: false,
    priorityAccuracy: 'PENDING_EVALUATION',
    lifecyclePredictionAccuracy: 'PENDING_DATA',
    timeline: [],
    updatedAt: new Date().toISOString()
  });

  // =========================================================================
  // A. PARAMETERLESS RESET INSTANCE PROTECTION
  // =========================================================================
  it('A. Parameterless SignalOutcomeEngine.resetInstance() cannot rebind tests to production storage', () => {
    // 1. Parameterless call must throw
    expect(() => {
      (SignalOutcomeEngine as any).resetInstance();
    }).toThrow('[SignalOutcomeEngine] resetInstance() requires explicit customStoragePath and customBackupPath');

    // 2. Passing canonical production paths must throw in test environment
    expect(() => {
      SignalOutcomeEngine.resetInstance(prodOutcomePath, prodOutcomeBakPath);
    }).toThrow('[SignalOutcomeEngine] resetInstance() cannot bind test execution to canonical production storage path.');
  });

  // =========================================================================
  // B. EXPLICIT TEMPORARY PATHS WORK
  // =========================================================================
  it('B. Explicit temporary SignalOutcomeEngine paths work', () => {
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
    const engine = SignalOutcomeEngine.getInstance();
    engine.recordOutcome(createMockOutcomeRecord('sig_temp_test_1'));

    expect(fs.existsSync(testOutcomePath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(testOutcomePath, 'utf-8'));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved.some((r: any) => r.signalId === 'sig_temp_test_1')).toBe(true);
  });

  // =========================================================================
  // C. LIFECYCLE TRANSITION CANNOT CHANGE PRODUCTION OUTCOMES
  // =========================================================================
  it('C. SignalLifecycleEngine.transition() executed from a test cannot change the production outcomes file', () => {
    // Reinitialize SignalOutcomeEngine with production singleton
    SignalOutcomeEngine.resetInstanceForProduction();

    // Trigger signal evaluation in SignalLifecycleEngine which transitions state and calls registerActionableSignal
    const mockSignal: MarketSignal = {
      signalId: 'sig_trans_iso_1',
      eventId: 'evt_trans_iso_1',
      articleId: 'art_trans_iso_1',
      symbol: 'INFY',
      eventType: 'EARNINGS',
      signalType: 'EARNINGS',
      priority: 'P1_HIGH' as any,
      signalScore: 85,
      components: {
        eventMateriality: 85,
        marketReaction: 85,
        volumeConfirmation: 85,
        fnoConfirmation: 85,
        sourceAuthority: 85,
        freshness: 85,
        crossSignalAlignment: 85,
        dataQuality: 85,
        eventScore: 85
      } as any,
      alignment: 'ALIGNED' as any,
      lifecycleState: 'NEW' as any,
      explanation: 'Test signal explanation',
      timestamp: new Date().toISOString(),
      revision: 1,
      warnings: [],
      eventMateriality: 'HIGH',
      fundamentalDirection: 'BULLISH',
      overallConfirmation: 'INSUFFICIENT_EVIDENCE',
      sourceTier: 'TIER_1' as any,
      freshnessText: 'REAL_TIME',
      crossAssetImpacts: [],
      priceReactionText: 'STEEP_POSITIVE',
      volumeText: 'STRONG_VOLUME_CONFIRMED',
      fnoText: 'LONG_BUILDUP'
    };

    SignalLifecycleEngine.getInstance().evaluateSignal(mockSignal, { eventId: 'evt_trans_iso_1', category: 'EARNINGS' } as any);

    // Also test manualInvalidation which triggers another transitionState
    SignalLifecycleEngine.getInstance().manualInvalidation('sig_trans_iso_1', 'Test manual invalidation');

    // Production file must remain completely untouched
    expect(getFileSha(prodOutcomePath)).toBe(EXPECTED_OUTCOME_SHA);
    expect(getRecordCount(prodOutcomePath)).toBe(EXPECTED_OUTCOME_COUNT);
  });

  // =========================================================================
  // D. PRODUCTION OUTCOMES SHA REMAINS UNCHANGED
  // =========================================================================
  it('D. Production outcomes SHA remains unchanged after the test', () => {
    expect(getFileSha(prodOutcomePath)).toBe(EXPECTED_OUTCOME_SHA);
    expect(getFileSha(prodOutcomeBakPath)).toBe(EXPECTED_OUTCOME_BAK_SHA);
  });

  // =========================================================================
  // E. REPEATED TEST EXECUTION DOES NOT APPEND RECORDS
  // =========================================================================
  it('E. Repeated test execution does not append records to production outcomes', () => {
    SignalOutcomeEngine.resetInstanceForProduction();
    const engine = SignalOutcomeEngine.getInstance();

    for (let i = 0; i < 10; i++) {
      engine.registerActionableSignal({
        eventId: `evt_loop_${i}`,
        signalType: 'EARNINGS',
        symbol: 'WIPRO',
        revision: 1,
        initialPrice: 500,
        initialCompositeScore: 80,
        initialPriority: 'P1_HIGH',
        initialAlignment: 'ALIGNED',
        direction: 'BULLISH'
      });
    }

    expect(getFileSha(prodOutcomePath)).toBe(EXPECTED_OUTCOME_SHA);
    expect(getRecordCount(prodOutcomePath)).toBe(EXPECTED_OUTCOME_COUNT);
  });

  // =========================================================================
  // F. LIFECYCLE TESTS DO NOT MUTATE LIFECYCLE PRODUCTION DATA
  // =========================================================================
  it('F. SignalLifecycleEngine tests do not mutate lifecycle production data', () => {
    SignalLifecycleEngine.resetInstanceForProduction();
    const engine = SignalLifecycleEngine.getInstance();

    engine.persist();

    expect(getFileSha(prodLifecyclePath)).toBe(EXPECTED_LIFECYCLE_SHA);
    expect(getRecordCount(prodLifecyclePath)).toBe(EXPECTED_LIFECYCLE_COUNT);
    expect(getFileSha(prodLedgerPath)).toBe(EXPECTED_LEDGER_SHA);
  });

  // =========================================================================
  // G. PERSISTENT NEWS STORE TESTS DO NOT MUTATE NEWS_CORE_V2.JSON
  // =========================================================================
  it('G. PersistentNewsStore tests do not mutate news_core_v2.json', async () => {
    const store = new PersistentNewsStore();
    await store.upsertArticle({
      id: 'art_fake_test_123',
      headline: 'Test Article That Must Never Mutate Production',
      publishedAt: new Date().toISOString(),
      source: { publisher: 'Test Source', tier: 1 },
      category: 'MARKET',
      body: 'Test content',
      symbols: ['TEST']
    } as any);

    expect(getFileSha(prodNewsCorePath)).toBe(EXPECTED_NEWS_CORE_SHA);
    expect(getRecordCount(prodNewsCorePath)).toBe(EXPECTED_NEWS_CORE_COUNT);
  });

  // =========================================================================
  // H. NO .TMP TEST ARTIFACTS REMAIN IN PRODUCTION DATA DIRECTORIES
  // =========================================================================
  it('H. No .tmp test artifacts remain in production data directories', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const allFiles = fs.readdirSync(dataDir);
    const tmpArtifacts = allFiles.filter(f => f.endsWith('.tmp') || f.includes('.tmp.') || f.endsWith('.partial'));
    expect(tmpArtifacts).toEqual([]);
  });

  // =========================================================================
  // I. TESTS MAY SAFELY PERSIST INTO TEMPORARY DIRECTORIES
  // =========================================================================
  it('I. Tests may safely persist into temporary directories', async () => {
    // 1. SignalOutcomeEngine in tempDir
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    outcomeEngine.recordOutcome(createMockOutcomeRecord('sig_tmp_safe_1'));
    expect(fs.existsSync(testOutcomePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(testOutcomePath, 'utf-8')).length).toBe(1);

    // 2. SignalLifecycleEngine in tempDir
    SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
    const lifecycleEngine = SignalLifecycleEngine.getInstance();
    lifecycleEngine.persist();
    expect(fs.existsSync(testLifecyclePath)).toBe(true);
    expect(fs.existsSync(testLedgerPath)).toBe(true);

    // 3. PersistentNewsStore in tempDir
    const newsStore = new PersistentNewsStore(testNewsCorePath);
    await newsStore.upsertArticle({
      id: 'art_tmp_1',
      headline: 'Temporary article',
      publishedAt: new Date().toISOString(),
      source: { publisher: 'Temp Source', tier: 1 },
      category: 'MARKET',
      body: 'Temp content',
      symbols: ['TEMP']
    } as any);
    expect(fs.existsSync(testNewsCorePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(testNewsCorePath, 'utf-8')).length).toBe(1);
  });
});
