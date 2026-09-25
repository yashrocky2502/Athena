/**
 * ATHENA — PHASE 10P-11: CONTROLLED POSITION-ALERT ACTIVATION READINESS TEST SUITE
 * Phase10P_11_ControlledActivationTransition.test.ts
 * 
 * Strict deterministic verification of:
 * A. Default Safety Matrix: Missing, explicit false, and kill-switch active states remain fail-closed.
 * B. Controlled Activation Transition: Dry-run activation mode evaluates & delivers candidates without real Telegram calls.
 * C. Dynamic Emergency Stop: Kill switch activation mid-stream immediately halts processing without service restart.
 * D. Restart / Deduplication Recovery: Deduplication key persists across notifier and runtime reinstantiations.
 * E. Source-Health Safety: Fail-closed on INVALID_SOURCE, SOURCE_ERROR, UNAVAILABLE, and VALID_EMPTY_PORTFOLIO.
 * F. Entity Matching Safety: Exact ISIN/symbol matches work; generic headlines, fuzzy tickers, closed positions, and macro noise yield zero alerts.
 * G. Provenance Safety: Rejects synthetic, test, unverified, or publisher-less events.
 * H. Subsystem Isolation & Production Safety Defaults: Zero writes to data/telegram_outbox.json, zero mutations to protected datasets, zero trading methods, and strict credential isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  PositionAlertRuntime,
  positionAlertRuntime,
  PositionAlertRuntimeGuard,
  PositionAlertConfigStatus,
  NewsCoreV2PositionAlertAdapter,
  PositionAlertIntelligenceEngine,
  PrivatePositionTelegramNotifier,
  PositionAlertDeliveryStore,
  NormalizedPortfolioState,
  NormalizedPosition,
  PositionNewsEventInput,
  PositionAlertCandidate
} from '../portfolio/alerts/index.ts';
import {
  PortfolioReconciliationEngine,
  resolveDeterministicPositionId
} from '../portfolio/broker/PortfolioReconciliationEngine.ts';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle.ts';

const PROTECTED_DATA_FILES = [
  'data/portfolio_store.json',
  'data/telegram_outbox.json',
  'data/news_core_v2.json',
  'data/news_intelligence_v2.json',
  'data/market_intelligence_outcomes.json',
  'data/news_signal_lifecycle.json',
  'data/news_signal_historical_ledger.json'
];

describe('Phase 10P-11: Controlled Position-Alert Activation Readiness & Transition', () => {
  let baselineChecksums: Map<string, string> = new Map();
  let originalEnv: NodeJS.ProcessEnv;
  let testStorePath: string;
  let testStore: PositionAlertDeliveryStore;

  const computeFileHash = (filePath: string): string => {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return 'MISSING';
    const content = fs.readFileSync(fullPath);
    return crypto.createHash('sha256').update(content).digest('hex');
  };

  const createActivePortfolioState = (positions: Partial<NormalizedPosition>[]): NormalizedPortfolioState => {
    const activeMap = new Map<string, NormalizedPosition>();
    const posList: NormalizedPosition[] = [];

    for (const p of positions) {
      const symbol = (p.symbol || 'RELIANCE').toUpperCase();
      const exchange = p.exchange || 'NSE';
      const isin = p.isin || `IN_${symbol}_12345`;
      const assetClass = p.assetClass || 'EQUITY';
      const source = p.source || 'TEST';
      const posId = p.positionId || resolveDeterministicPositionId({ symbol, exchange, isin, assetClass, source });
      const normPos: NormalizedPosition = {
        positionId: posId,
        symbol,
        exchange,
        isin,
        assetClass,
        quantity: p.quantity !== undefined ? p.quantity : 100,
        averagePrice: p.averagePrice ?? 2500,
        currentPrice: p.currentPrice ?? 2550,
        sector: p.sector || 'ENERGY',
        source,
        observedAt: p.observedAt || new Date().toISOString()
      };
      posList.push(normPos);
      if (normPos.quantity > 0) {
        activeMap.set(normPos.positionId, normPos);
      }
    }

    const totalQty = posList.reduce((acc, p) => acc + p.quantity, 0);

    return {
      portfolioId: 'TEST_PORTFOLIO',
      sourceId: 'TEST_SRC',
      sourceType: 'TEST',
      timestamp: new Date().toISOString(),
      sourceStatus: 'VALID_ACTIVE',
      presenceState: activeMap.size > 0 ? 'POSITION_EXISTS' : 'NO_POSITION',
      totalActivePositions: activeMap.size,
      totalActiveQuantity: totalQty,
      activePositions: activeMap,
      closedPositions: new Map()
    };
  };

  const createSampleArticle = (symbol: string = 'RELIANCE', overrides?: Record<string, any>): NewsArticleV2 => ({
    id: `ART_${symbol}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    headline: `${symbol} signs landmark commercial joint venture contract`,
    body: `${symbol} today announced execution of a definitive binding agreement.`,
    canonicalUrl: `https://exchange-filings.com/announcements/${symbol.toLowerCase()}-filing.pdf`,
    source: {
      publisher: 'NSE Corporate Announcements',
      collectionMethod: 'NSE'
    } as any,
    publishedAt: new Date().toISOString(),
    symbols: [symbol],
    categories: ['CORPORATE_ACTION'],
    ...overrides
  } as unknown as NewsArticleV2);

  beforeEach(() => {
    originalEnv = { ...process.env };

    // Record baseline checksums for protected dataset immutability audit
    baselineChecksums.clear();
    for (const relPath of PROTECTED_DATA_FILES) {
      baselineChecksums.set(relPath, computeFileHash(relPath));
    }

    // Isolate test delivery store file
    const tempDir = path.resolve(process.cwd(), 'temp_test_stores');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    testStorePath = path.resolve(tempDir, `test_delivery_store_11_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
    testStore = new PositionAlertDeliveryStore(testStorePath);

    // Reset runtime guard & environment
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID;
    delete process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    PositionAlertRuntimeGuard.reset();
  });

  afterEach(() => {
    process.env = originalEnv;
    PositionAlertRuntimeGuard.reset();

    if (testStorePath && fs.existsSync(testStorePath)) {
      try {
        fs.unlinkSync(testStorePath);
      } catch {}
    }

    // Verify protected dataset immutability
    for (const relPath of PROTECTED_DATA_FILES) {
      const currentHash = computeFileHash(relPath);
      const expectedHash = baselineChecksums.get(relPath);
      expect(currentHash).toBe(expectedHash);
    }
  });

  // =========================================================================
  // SECTION A: DEFAULT SAFETY MATRIX
  // =========================================================================

  it('Section A1: Missing feature flag + missing kill switch => Fail-Closed Blocked', () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Section A2: Feature flag "false" + kill switch active => Blocked', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'false';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Section A3: Feature flag "false" + kill switch inactive ("false") => Blocked (Feature flag disabled)', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'false';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(false);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Section A4: Feature flag "true" + kill switch active ("true") => Blocked (Kill switch takes precedence)', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  // =========================================================================
  // SECTION B: CONTROLLED ACTIVATION TRANSITION (State C - Dry Run Transport)
  // =========================================================================

  it('Section B: Controlled Activation Transition evaluates article and delivers candidate in dry-run with zero real network calls', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn();
    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: true,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath
    });

    const portfolioState = createActivePortfolioState([
      { symbol: 'RELIANCE', quantity: 100 },
      { symbol: 'TCS', quantity: 50 }
    ]);

    const runtime = new PositionAlertRuntime({
      notifier,
      deliveryStore: testStore,
      portfolioState
    });

    const article = createSampleArticle('RELIANCE');
    const candidates = await runtime.evaluateArticle(article);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].symbol).toBe('RELIANCE');
    expect(candidates[0].positionId).toBeDefined();
    expect(candidates[0].dedupeKey).toBeDefined();

    // Verify dry-run delivery recorded in store
    expect(testStore.isDelivered(candidates[0].dedupeKey)).toBe(true);

    // CRITICAL: Zero real Telegram network calls executed
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  // =========================================================================
  // SECTION C: DYNAMIC EMERGENCY STOP
  // =========================================================================

  it('Section C: Turning kill switch ON mid-stream immediately blocks subsequent alerts without service restart', async () => {
    // 1. Start in enabled + kill switch off state
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn();
    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: true,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath
    });

    const runtime = new PositionAlertRuntime({
      notifier,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([
        { symbol: 'RELIANCE', quantity: 100 },
        { symbol: 'TCS', quantity: 50 }
      ])
    });

    // 2. Process 1st event -> Successful evaluation & dry-run delivery
    const relianceArticle = createSampleArticle('RELIANCE');
    const firstAlerts = await runtime.evaluateArticle(relianceArticle);
    expect(firstAlerts).toHaveLength(1);
    expect(firstAlerts[0].symbol).toBe('RELIANCE');

    // 3. Dynamically set kill switch to TRUE
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    // 4. Process 2nd event -> Immediately blocked by kill switch
    const tcsArticle = createSampleArticle('TCS');
    const secondAlerts = await runtime.evaluateArticle(tcsArticle);
    expect(secondAlerts).toHaveLength(0);

    // Confirm delivery store was not mutated for TCS
    const records = testStore.getAllRecords();
    const tcsRecord = records.find(r => r.symbol === 'TCS');
    expect(tcsRecord).toBeUndefined();
  });

  // =========================================================================
  // SECTION D: RESTART / DEDUPLICATION RECOVERY
  // =========================================================================

  it('Section D: Previously delivered alert remains suppressed after runtime re-instantiation with same delivery store file', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const notifier1 = new PrivatePositionTelegramNotifier({
      dryRun: true,
      storePath: testStorePath
    });

    const runtime1 = new PositionAlertRuntime({
      notifier: notifier1,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const firstAlerts = await runtime1.evaluateArticle(article);
    expect(firstAlerts).toHaveLength(1);
    const dedupeKey = firstAlerts[0].dedupeKey;
    expect(testStore.isDelivered(dedupeKey)).toBe(true);

    // 2. Re-evaluate same article with same runtime -> Suppressed duplicate
    const repeatAlerts = await runtime1.evaluateArticle(article);
    expect(repeatAlerts).toHaveLength(0);

    // 3. Re-instantiate a fresh store, notifier, and runtime using the same persistent store file
    const store2 = new PositionAlertDeliveryStore(testStorePath);
    const notifier2 = new PrivatePositionTelegramNotifier({
      dryRun: true,
      deliveryStore: store2,
      storePath: testStorePath
    });

    const runtime2 = new PositionAlertRuntime({
      notifier: notifier2,
      deliveryStore: store2,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    // 4. Evaluate article on reconstructed runtime -> Dedupe key remains suppressed
    const restartedAlerts = await runtime2.evaluateArticle(article);
    expect(restartedAlerts).toHaveLength(0);
    expect(store2.isDelivered(dedupeKey)).toBe(true);
  });

  // =========================================================================
  // SECTION E: SOURCE-HEALTH SAFETY (Fail-Closed)
  // =========================================================================

  it('Section E: Fail-closed behavior on non-VALID_ACTIVE portfolio source status', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const article = createSampleArticle('RELIANCE');

    const invalidStatuses: Array<NormalizedPortfolioState['sourceStatus']> = [
      'INVALID_SOURCE',
      'SOURCE_ERROR',
      'UNAVAILABLE',
      'VALID_EMPTY_PORTFOLIO'
    ];

    for (const status of invalidStatuses) {
      const state = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
      state.sourceStatus = status;

      const runtime = new PositionAlertRuntime({
        notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
        deliveryStore: testStore,
        portfolioState: state
      });

      const alerts = await runtime.evaluateArticle(article);
      expect(alerts).toHaveLength(0);
    }
  });

  // =========================================================================
  // SECTION F: ENTITY MATCHING & NOISE SUPPRESSION SAFETY
  // =========================================================================

  it('Section F1: Exact ISIN match triggers position alert candidate', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const targetIsin = 'INE002A01018';
    const portfolioState = createActivePortfolioState([
      { symbol: 'RELIANCE', isin: targetIsin, quantity: 100 }
    ]);

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState
    });

    const article = createSampleArticle('RELIANCE', {
      isin: targetIsin,
      headline: 'Company executes major ISIN-tracked corporate action'
    });

    const alerts = await runtime.evaluateArticle(article);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].symbol).toBe('RELIANCE');
  });

  it('Section F2: Unrelated headline with generic word without symbol/ISIN lists yields NO alert', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const portfolioState = createActivePortfolioState([
      { symbol: 'RELIANCE', isin: 'INE002A01018', quantity: 100 }
    ]);

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState
    });

    // Article contains the word "reliance" in general text, but target symbol is UNRELATED_TICKER
    const article: NewsArticleV2 = {
      id: `ART_GENERIC_${Date.now()}`,
      headline: "Country's reliance on imported crude oil surges this quarter",
      body: "An overview of macroeconomic imports and foreign exchange reserves.",
      canonicalUrl: 'https://news.com/macro-oil',
      source: { publisher: 'Financial Express', collectionMethod: 'FE' } as any,
      publishedAt: new Date().toISOString(),
      symbols: ['CRUDE_OIL'],
      categories: ['MACRO']
    } as unknown as NewsArticleV2;

    const alerts = await runtime.evaluateArticle(article);
    expect(alerts).toHaveLength(0);
  });

  it('Section F3: Fuzzy/substring ticker matches yield NO alert (e.g. RELIANCE_CAPITAL vs RELIANCE)', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const portfolioState = createActivePortfolioState([
      { symbol: 'RELIANCE', isin: 'INE002A01018', quantity: 100 }
    ]);

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState
    });

    const article = createSampleArticle('RELIANCE_CAPITAL');
    const alerts = await runtime.evaluateArticle(article);
    expect(alerts).toHaveLength(0);
  });

  it('Section F4: Closed/zero-quantity positions receive NO alert', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const portfolioState = createActivePortfolioState([
      { symbol: 'RELIANCE', quantity: 0 } // Quantity = 0 -> Closed position
    ]);

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState
    });

    const article = createSampleArticle('RELIANCE');
    const alerts = await runtime.evaluateArticle(article);
    expect(alerts).toHaveLength(0);
  });

  it('Section F5: Macro/index event without explicit position holding yields NO alert', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    // User holds RELIANCE (stock), does NOT hold NIFTY50 index position
    const portfolioState = createActivePortfolioState([
      { symbol: 'RELIANCE', quantity: 100 }
    ]);

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState
    });

    const macroArticle = createSampleArticle('NIFTY', {
      headline: 'NIFTY50 surges 300 points in benchmark rally',
      symbols: ['NIFTY'],
      categories: ['MACRO']
    });

    const alerts = await runtime.evaluateArticle(macroArticle);
    expect(alerts).toHaveLength(0);
  });

  // =========================================================================
  // SECTION G: PROVENANCE SAFETY
  // =========================================================================

  it('Section G: Rejects missing, synthetic, test, or unverified event provenance', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const portfolioState = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState
    });

    // 1. Synthetic event ID
    const synthArticle = createSampleArticle('RELIANCE', { id: 'SYNTH_ARTICLE_123' });
    expect(await runtime.evaluateArticle(synthArticle)).toHaveLength(0);

    // 2. Test event ID
    const testArticle = createSampleArticle('RELIANCE', { id: 'TEST_ARTICLE_456' });
    expect(await runtime.evaluateArticle(testArticle)).toHaveLength(0);

    // 3. Missing publisher & source
    const noPubArticle = createSampleArticle('RELIANCE', {
      source: { publisher: '', collectionMethod: '' } as any
    });
    expect(await runtime.evaluateArticle(noPubArticle)).toHaveLength(0);

    // 4. Unverified provenance
    const unverifiedArticle = createSampleArticle('RELIANCE', {
      provenance: { publisher: 'Unknown Blog', sourceId: 'BLOG', verified: false } as any
    });
    expect(await runtime.evaluateArticle(unverifiedArticle)).toHaveLength(0);
  });

  // =========================================================================
  // SECTION H: ISOLATION & PRODUCTION SAFETY DEFAULTS
  // =========================================================================

  it('Section H1: Personal alert processing causes zero writes to data/telegram_outbox.json', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const outboxPath = path.resolve(process.cwd(), 'data/telegram_outbox.json');
    const initialHash = computeFileHash('data/telegram_outbox.json');

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    await runtime.evaluateArticle(article);

    const finalHash = computeFileHash('data/telegram_outbox.json');
    expect(finalHash).toBe(initialHash);
  });

  it('Section H2: Subsystem contains zero order placement or trading methods across all prototypes', () => {
    const forbiddenMethodNames = [
      'placeOrder',
      'executeOrder',
      'buy',
      'sell',
      'modifyOrder',
      'cancelOrder',
      'closePosition',
      'transact',
      'submitOrder',
      'trade'
    ];

    const prototypes = [
      PositionAlertRuntime.prototype,
      PrivatePositionTelegramNotifier.prototype,
      PositionAlertIntelligenceEngine.prototype,
      PositionAlertDeliveryStore.prototype
    ];

    for (const proto of prototypes) {
      for (const name of forbiddenMethodNames) {
        expect((proto as any)[name]).toBeUndefined();
      }
    }
  });

  it('Section H3: Production Safety Assertion - Default un-overridden runtime resolves strictly to fail-closed', () => {
    // Completely un-overridden process.env
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Section H4: Telegram Credential Isolation - Notifier strictly ignores generic TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID', () => {
    // Provide generic News Core V2 Telegram credentials ONLY
    process.env.TELEGRAM_BOT_TOKEN = 'generic_news_core_bot_token_123';
    process.env.TELEGRAM_CHAT_ID = 'generic_news_core_chat_id_456';
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID;
    delete process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;

    PositionAlertRuntimeGuard.reset();

    const configStatus = PositionAlertRuntimeGuard.getConfigStatus();
    expect(configStatus.hasBotToken).toBe(false);
    expect(configStatus.hasChatId).toBe(false);

    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: false,
      storePath: testStorePath
    });

    // Resolves token & chat ID internally -> Must return undefined
    expect((notifier as any).resolveBotToken()).toBeUndefined();
    expect((notifier as any).resolveChatId()).toBeUndefined();
  });
});
