/**
 * ATHENA — PHASE 10P-13: POSITION-ALERT SUBSYSTEM FINAL FORENSIC & RELEASE-GATE AUDIT TEST SUITE
 * Phase10P_13_FinalForensicReleaseGateAudit.test.ts
 * 
 * Release-Gate Forensic Audit verifying:
 * 1. Entry Point & Controlled Activation Gate Safety: Production defaults remain strictly fail-closed.
 * 2. Configuration & Kill Switch Precedence: Dynamic kill switch overrides activation at the final delivery boundary.
 * 3. Telegram & Network Isolation: Zero real HTTP network calls; complete isolation from generic Telegram credentials.
 * 4. Persistence & Outbox Isolation: Zero writes to data/telegram_outbox.json or any protected dataset.
 * 5. Position Relevance, Source Health & Provenance: Fail-closed on bad source status, unverified provenance, macro noise, and fuzzy tickers.
 * 6. Alert Lifecycle & Restart Recovery: Exact-once deduplication persists across runtime re-instantiations.
 * 7. Trading & Order Capability Isolation: Zero trading, order placement, or brokerage execution capabilities exist.
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
  PositionRelevanceEngine,
  PositionAlertEngine,
  PositionMonitor,
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

describe('Phase 10P-13: Final Forensic & Release-Gate Audit Suite', () => {
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

    // Record baseline checksums
    baselineChecksums.clear();
    for (const relPath of PROTECTED_DATA_FILES) {
      baselineChecksums.set(relPath, computeFileHash(relPath));
    }

    // Isolated test delivery store path
    const tempDir = path.resolve(process.cwd(), 'temp_test_stores');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    testStorePath = path.resolve(tempDir, `test_delivery_store_13_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
    testStore = new PositionAlertDeliveryStore(testStorePath);

    // Clear environment variables
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
  // 1. PRODUCTION DEFAULTS & ENTRY POINT FORENSICS
  // =========================================================================

  it('Audit 1: Un-overridden production runtime defaults strictly to fail-closed state', async () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);

    const runtime = PositionAlertRuntime.getInstance();
    runtime.reset();
    runtime.setPortfolioState(createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]));

    const article = createSampleArticle('RELIANCE');
    const alerts = await runtime.evaluateArticle(article);

    expect(alerts).toHaveLength(0);
  });

  it('Audit 2: Incomplete activation configuration yields safe FAILED_PERMANENT record with zero network calls', async () => {
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
      alertId: 'ALT_AUDIT_13_CFG',
      positionId: 'POS_RELIANCE_1',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Contract announcement',
      timestamp: new Date().toISOString(),
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::audit13_cfg::1'
    };

    const delivered = await notifier.notify(candidate);
    expect(delivered).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(notifier.getDeliveryStatus(candidate.dedupeKey)).toBe('FAILED_PERMANENT');
  });

  // =========================================================================
  // 2. DYNAMIC KILL-SWITCH FORENSICS
  // =========================================================================

  it('Audit 3: Emergency kill switch takes absolute precedence at the final delivery boundary dynamically', async () => {
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

    // Event 1 delivers
    const alerts1 = await runtime.evaluateArticle(createSampleArticle('RELIANCE'));
    expect(alerts1).toHaveLength(1);

    // Dynamically activate kill switch
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    // Event 2 is blocked immediately
    const alerts2 = await runtime.evaluateArticle(createSampleArticle('TCS'));
    expect(alerts2).toHaveLength(0);

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  // =========================================================================
  // 3. TELEGRAM & OUTBOX ISOLATION FORENSICS
  // =========================================================================

  it('Audit 4: Personal alert evaluations perform zero writes to data/telegram_outbox.json', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const initialOutboxHash = computeFileHash('data/telegram_outbox.json');

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    await runtime.evaluateArticle(createSampleArticle('RELIANCE'));

    const finalOutboxHash = computeFileHash('data/telegram_outbox.json');
    expect(finalOutboxHash).toBe(initialOutboxHash);
  });

  it('Audit 5: Telegram credential isolation strictly rejects generic TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'generic_news_core_bot_token_13';
    process.env.TELEGRAM_CHAT_ID = 'generic_news_core_chat_id_13';
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID;
    delete process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;

    PositionAlertRuntimeGuard.reset();

    const config = PositionAlertRuntimeGuard.getConfigStatus();
    expect(config.hasBotToken).toBe(false);
    expect(config.hasChatId).toBe(false);

    const notifier = new PrivatePositionTelegramNotifier({ dryRun: false, storePath: testStorePath });
    expect((notifier as any).resolveBotToken()).toBeUndefined();
    expect((notifier as any).resolveChatId()).toBeUndefined();
  });

  // =========================================================================
  // 4. ENTITY MATCHING, SOURCE HEALTH & PROVENANCE FORENSICS
  // =========================================================================

  it('Audit 6: Source health fail-closed behavior on non-VALID_ACTIVE states', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

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

      const candidates = await runtime.evaluateArticle(createSampleArticle('RELIANCE'));
      expect(candidates).toHaveLength(0);
    }
  });

  it('Audit 7: Provenance gate rejects synthetic, test, unverified, or publisher-less events', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    // 1. Synthetic
    expect(await runtime.evaluateArticle(createSampleArticle('RELIANCE', { id: 'SYNTH_13_1' }))).toHaveLength(0);

    // 2. Test
    expect(await runtime.evaluateArticle(createSampleArticle('RELIANCE', { id: 'TEST_13_1' }))).toHaveLength(0);

    // 3. Publisher-less
    expect(await runtime.evaluateArticle(createSampleArticle('RELIANCE', {
      source: { publisher: '', collectionMethod: '' } as any
    }))).toHaveLength(0);

    // 4. Unverified
    expect(await runtime.evaluateArticle(createSampleArticle('RELIANCE', {
      provenance: { publisher: 'Blog', sourceId: 'BLOG', verified: false } as any
    }))).toHaveLength(0);
  });

  // =========================================================================
  // 5. ALERT LIFECYCLE & RECOVERY FORENSICS
  // =========================================================================

  it('Audit 8: Deduplication and state persistence across process restart', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const notifier1 = new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath });
    const runtime1 = new PositionAlertRuntime({
      notifier: notifier1,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const alerts1 = await runtime1.evaluateArticle(article);
    expect(alerts1).toHaveLength(1);
    const dedupeKey = alerts1[0].dedupeKey;
    expect(testStore.isDelivered(dedupeKey)).toBe(true);

    // Restart into clean instances referencing same delivery store file
    const store2 = new PositionAlertDeliveryStore(testStorePath);
    const notifier2 = new PrivatePositionTelegramNotifier({ dryRun: true, deliveryStore: store2, storePath: testStorePath });
    const runtime2 = new PositionAlertRuntime({
      notifier: notifier2,
      deliveryStore: store2,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const alerts2 = await runtime2.evaluateArticle(article);
    expect(alerts2).toHaveLength(0);
    expect(store2.isDelivered(dedupeKey)).toBe(true);
  });

  // =========================================================================
  // 6. TRADING & ORDER SUBSYSTEM ISOLATION FORENSICS
  // =========================================================================

  it('Audit 9: Zero trading, order placement, or brokerage execution capabilities across subsystem prototypes', () => {
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
      PositionRelevanceEngine.prototype,
      PositionAlertEngine.prototype,
      PositionMonitor.prototype,
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
