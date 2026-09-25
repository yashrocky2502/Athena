/**
 * ATHENA — PHASE 10P-12: END-TO-END CONTROLLED POSITION-ALERT AUDIT TEST SUITE
 * Phase10P_12_EndToEndControlledPositionAlertAudit.test.ts
 * 
 * Comprehensive End-to-End Audit Suite validating:
 * SECTION A — Default Fail-Closed State & Incomplete Activation Safety
 * SECTION B — Complete Controlled Activation Path (Dry-Run Only)
 * SECTION C — Dynamic Kill-Switch Precedence & Restart Bypass Protection
 * SECTION D — End-to-End Alert Lifecycle & Deduplication Recovery
 * SECTION E — Source-Health Fail-Closed Behavior
 * SECTION F — Strict Entity Matching & Macro Noise Suppression
 * SECTION G — Provenance & Event Trust Gates
 * SECTION H — Telegram Safety Boundary, Outbox Isolation & Credential Isolation
 * SECTION I — Restart & Recovery Safety
 * SECTION J — Trading / Order Subsystem Isolation (Zero Execution Capabilities)
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

describe('Phase 10P-12: End-to-End Controlled Position-Alert Pipeline Audit', () => {
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

    // Snapshot hashes of protected production datasets
    baselineChecksums.clear();
    for (const relPath of PROTECTED_DATA_FILES) {
      baselineChecksums.set(relPath, computeFileHash(relPath));
    }

    // Isolate test delivery store file
    const tempDir = path.resolve(process.cwd(), 'temp_test_stores');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    testStorePath = path.resolve(tempDir, `test_delivery_store_12_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
    testStore = new PositionAlertDeliveryStore(testStorePath);

    // Reset runtime guard & clear environment variables
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

    // Audit protected dataset immutability
    for (const relPath of PROTECTED_DATA_FILES) {
      const currentHash = computeFileHash(relPath);
      const expectedHash = baselineChecksums.get(relPath);
      expect(currentHash).toBe(expectedHash);
    }
  });

  // =========================================================================
  // SECTION A — DEFAULT FAIL-CLOSED STATE & INCOMPLETE ACTIVATION SAFETY
  // =========================================================================

  it('Section A1: Production defaults (missing/unset env) resolve strictly to fail-closed', async () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);

    const runtime = new PositionAlertRuntime({
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const candidates = await runtime.evaluateArticle(article);
    expect(candidates).toHaveLength(0);
  });

  it('Section A2: Explicit false feature flag and active kill switch remain fail-closed', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'false';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Section A3: Incomplete activation configuration fails safely without network calls or process crashes', async () => {
    // Enabled with kill switch off, BUT missing Telegram credentials in non-dryRun mode
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn();
    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: false,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath
    });

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_TEST_MISSING_CFG',
      positionId: 'POS_RELIANCE_1',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Contract announcement',
      timestamp: new Date().toISOString(),
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::missing_cfg::1'
    };

    const delivered = await notifier.notify(candidate);
    expect(delivered).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(notifier.getDeliveryStatus(candidate.dedupeKey)).toBe('FAILED_PERMANENT');
  });

  // =========================================================================
  // SECTION B — COMPLETE CONTROLLED ACTIVATION PATH (DRY-RUN ONLY)
  // =========================================================================

  it('Section B: Controlled activation evaluates valid article and executes dry-run delivery with zero real network calls', async () => {
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
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const candidates = await runtime.evaluateArticle(article);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].symbol).toBe('RELIANCE');
    expect(testStore.isDelivered(candidates[0].dedupeKey)).toBe(true);

    // Network safety boundary: Zero fetch calls executed
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  // =========================================================================
  // SECTION C — DYNAMIC KILL-SWITCH PRECEDENCE & RESTART PROTECTION
  // =========================================================================

  it('Section C1: Emergency kill switch immediately blocks subsequent alerts dynamically without service restart', async () => {
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

    // 1. First event passes
    const article1 = createSampleArticle('RELIANCE');
    const candidates1 = await runtime.evaluateArticle(article1);
    expect(candidates1).toHaveLength(1);

    // 2. Activate kill switch dynamically
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    // 3. Second event is blocked immediately
    const article2 = createSampleArticle('TCS');
    const candidates2 = await runtime.evaluateArticle(article2);
    expect(candidates2).toHaveLength(0);

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('Section C2: Re-instantiating runtime while kill switch is active cannot bypass the kill switch', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true'; // Active
    PositionAlertRuntimeGuard.reset();

    const freshNotifier = new PrivatePositionTelegramNotifier({
      dryRun: true,
      storePath: testStorePath
    });

    const freshRuntime = new PositionAlertRuntime({
      notifier: freshNotifier,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const candidates = await freshRuntime.evaluateArticle(article);
    expect(candidates).toHaveLength(0);
  });

  // =========================================================================
  // SECTION D — END-TO-END ALERT LIFECYCLE & DEDUPLICATION RECOVERY
  // =========================================================================

  it('Section D: End-to-end alert lifecycle executes deduplication and prevents repeat delivery across restarts', async () => {
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

    // 1. Initial delivery
    const alerts1 = await runtime1.evaluateArticle(article);
    expect(alerts1).toHaveLength(1);
    const dedupeKey = alerts1[0].dedupeKey;
    expect(testStore.isDelivered(dedupeKey)).toBe(true);

    // 2. Duplicate submission in same runtime
    const alertsDup = await runtime1.evaluateArticle(article);
    expect(alertsDup).toHaveLength(0);

    // 3. Re-instantiate runtime and delivery store pointing to same persistent test file
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

    // 4. Repeated submission after restart -> Suppressed
    const alertsRestart = await runtime2.evaluateArticle(article);
    expect(alertsRestart).toHaveLength(0);
    expect(store2.isDelivered(dedupeKey)).toBe(true);
  });

  // =========================================================================
  // SECTION E — SOURCE-HEALTH FAIL-CLOSED BEHAVIOR
  // =========================================================================

  it('Section E: Non-VALID_ACTIVE source health states produce zero position alerts', async () => {
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
      const portfolioState = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
      portfolioState.sourceStatus = status;

      const runtime = new PositionAlertRuntime({
        notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
        deliveryStore: testStore,
        portfolioState
      });

      const candidates = await runtime.evaluateArticle(article);
      expect(candidates).toHaveLength(0);
    }
  });

  // =========================================================================
  // SECTION F — EXACT ENTITY MATCHING & NOISE SUPPRESSION
  // =========================================================================

  it('Section F1: Exact ISIN and exact symbol match trigger position alerts', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const targetIsin = 'INE002A01018';
    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', isin: targetIsin, quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE', { isin: targetIsin });
    const candidates = await runtime.evaluateArticle(article);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].symbol).toBe('RELIANCE');
  });

  it('Section F2: Fuzzy tickers, closed positions, generic headlines, and macro events yield zero alerts', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([
        { symbol: 'RELIANCE', quantity: 100 },
        { symbol: 'WIPRO', quantity: 0 } // Closed position
      ])
    });

    // 1. Fuzzy ticker (RELIANCE_CAPITAL vs RELIANCE)
    const fuzzyArticle = createSampleArticle('RELIANCE_CAPITAL');
    expect(await runtime.evaluateArticle(fuzzyArticle)).toHaveLength(0);

    // 2. Closed position (WIPRO)
    const closedArticle = createSampleArticle('WIPRO');
    expect(await runtime.evaluateArticle(closedArticle)).toHaveLength(0);

    // 3. Macro event (NIFTY50) without index holding
    const macroArticle = createSampleArticle('NIFTY', {
      headline: 'NIFTY50 surges 250 points in benchmark rally',
      symbols: ['NIFTY'],
      categories: ['MACRO']
    });
    expect(await runtime.evaluateArticle(macroArticle)).toHaveLength(0);

    // 4. Unrelated company (TCS)
    const unrelatedArticle = createSampleArticle('TCS');
    expect(await runtime.evaluateArticle(unrelatedArticle)).toHaveLength(0);
  });

  // =========================================================================
  // SECTION G — PROVENANCE & EVENT TRUST GATES
  // =========================================================================

  it('Section G: Rejects synthetic, test, publisher-less, or unverified event provenance', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    // 1. Synthetic article
    const synthArticle = createSampleArticle('RELIANCE', { id: 'SYNTH_ARTICLE_999' });
    expect(await runtime.evaluateArticle(synthArticle)).toHaveLength(0);

    // 2. Test article
    const testArticle = createSampleArticle('RELIANCE', { id: 'TEST_ARTICLE_888' });
    expect(await runtime.evaluateArticle(testArticle)).toHaveLength(0);

    // 3. Publisher-less article
    const noPubArticle = createSampleArticle('RELIANCE', {
      source: { publisher: '', collectionMethod: '' } as any
    });
    expect(await runtime.evaluateArticle(noPubArticle)).toHaveLength(0);

    // 4. Unverified provenance article
    const unverifiedArticle = createSampleArticle('RELIANCE', {
      provenance: { publisher: 'Unverified Forum', sourceId: 'FORUM', verified: false } as any
    });
    expect(await runtime.evaluateArticle(unverifiedArticle)).toHaveLength(0);
  });

  // =========================================================================
  // SECTION H — TELEGRAM SAFETY BOUNDARY, OUTBOX ISOLATION & CREDENTIAL ISOLATION
  // =========================================================================

  it('Section H1: Position alert processing causes zero writes to data/telegram_outbox.json', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const outboxHashBefore = computeFileHash('data/telegram_outbox.json');

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    await runtime.evaluateArticle(article);

    const outboxHashAfter = computeFileHash('data/telegram_outbox.json');
    expect(outboxHashAfter).toBe(outboxHashBefore);
  });

  it('Section H2: Credential Isolation - Notifier strictly ignores generic TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'generic_news_core_bot_token_999';
    process.env.TELEGRAM_CHAT_ID = 'generic_news_core_chat_id_999';
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID;
    delete process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;

    PositionAlertRuntimeGuard.reset();

    const status = PositionAlertRuntimeGuard.getConfigStatus();
    expect(status.hasBotToken).toBe(false);
    expect(status.hasChatId).toBe(false);

    const notifier = new PrivatePositionTelegramNotifier({ dryRun: false, storePath: testStorePath });
    expect((notifier as any).resolveBotToken()).toBeUndefined();
    expect((notifier as any).resolveChatId()).toBeUndefined();
  });

  // =========================================================================
  // SECTION I — RESTART & RECOVERY SAFETY
  // =========================================================================

  it('Section I: Process restart without explicit overrides reverts strictly to fail-closed state', () => {
    // 1. Simulate active session
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(true);

    // 2. Simulate process exit & restart with pristine environment
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  // =========================================================================
  // SECTION J — TRADING / ORDER SUBSYSTEM ISOLATION
  // =========================================================================

  it('Section J: Zero trading or order placement methods exist across the alert runtime subsystem', () => {
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
      PositionAlertDeliveryStore.prototype,
      NewsCoreV2PositionAlertAdapter.prototype
    ];

    for (const proto of prototypes) {
      for (const name of forbiddenMethodNames) {
        expect((proto as any)[name]).toBeUndefined();
      }
    }
  });
});
