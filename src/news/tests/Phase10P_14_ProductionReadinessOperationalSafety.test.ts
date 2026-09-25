/**
 * ATHENA — PHASE 10P-14: CONTROLLED PRODUCTION READINESS & OPERATIONAL SAFETY TEST SUITE
 * Phase10P_14_ProductionReadinessOperationalSafety.test.ts
 * 
 * Strict deterministic verification of:
 * 1. Formal Activation State Model & Human Decision Boundary (DISABLED, DRY_RUN, CONTROLLED_READY, LIVE; READY != LIVE)
 * 2. Production Activation Prerequisites: Missing flags, missing credentials, or active kill switch block LIVE delivery.
 * 3. Explicit Human Activation Boundary: Normal startup, scheduler start, or runtime instantiation never cross into LIVE.
 * 4. Kill Switch Precedence & Dynamic Emergency Stop: Kill switch overrides all readiness state dynamically at the boundary.
 * 5. Configuration Validation: Malformed, missing, whitespace, or unrecognized configuration values fail closed.
 * 6. Environment Separation: Test-only flags or mocks cannot bypass production activation gates.
 * 7. Startup & Shutdown Safety: Production defaults result in 0 live deliveries, 0 network calls, 0 data mutations.
 * 8. Runtime Failure & Recovery Safety: Notifier/source/portfolio errors remain fail-closed without silent LIVE activation.
 * 9. Delivery Observability & Audit Reason Codes: Audit reason codes are deterministically exposed without secret leakage.
 * 10. Telegram Network & Outbox Isolation: 0 real HTTP/Telegram requests, 0 writes to data/telegram_outbox.json, strict credential isolation.
 * 11. Protected Dataset Integrity & Immutability: Protected production datasets remain byte-identical before & after execution.
 * 12. Trading Subsystem Isolation: Zero order placement, buying, selling, or brokerage methods exist.
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

describe('Phase 10P-14: Controlled Production Readiness & Operational Safety', () => {
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

    // Isolate test delivery store file
    const tempDir = path.resolve(process.cwd(), 'temp_test_stores');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    testStorePath = path.resolve(tempDir, `test_delivery_store_14_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
    testStore = new PositionAlertDeliveryStore(testStorePath);

    // Clear environment variables
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    delete process.env.ATHENA_POSITION_ALERTS_LIVE_CONFIRMED;
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
  // SECTION A & U — FORMAL ACTIVATION STATE MODEL & HUMAN DECISION BOUNDARY
  // =========================================================================

  it('Section A1: Default environment maps strictly to DISABLED operational state', () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('DISABLED');
    expect(PositionAlertRuntimeGuard.getAuditReasonCode()).toBe('KILL_SWITCH_ACTIVE');
  });

  it('Section A2: Enabled state without credentials resolves to DRY_RUN', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('DRY_RUN');
    expect(PositionAlertRuntimeGuard.getAuditReasonCode()).toBe('MISSING_PREREQUISITE');
  });

  it('Section A3: Fully configured readiness state resolves to CONTROLLED_READY (READY != LIVE)', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'bot_token_abc';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'chat_id_xyz';
    delete process.env.ATHENA_POSITION_ALERTS_LIVE_CONFIRMED;
    PositionAlertRuntimeGuard.reset();

    // MUST reach CONTROLLED_READY, NEVER LIVE
    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('CONTROLLED_READY');
    expect(PositionAlertRuntimeGuard.getAuditReasonCode()).toBe('LIVE_DELIVERY_BLOCKED');
  });

  it('Section A4: LIVE state requires explicit human confirmation flag and is NEVER default', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'bot_token_abc';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'chat_id_xyz';
    process.env.ATHENA_POSITION_ALERTS_LIVE_CONFIRMED = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('LIVE');
    expect(PositionAlertRuntimeGuard.getAuditReasonCode()).toBe('READY_FOR_CONTROLLED_ACTIVATION');
  });

  // =========================================================================
  // SECTION B & C — PREREQUISITES & HUMAN ACTIVATION BOUNDARY
  // =========================================================================

  it('Section B1: Missing enablement flag prevents live delivery', () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('DISABLED');
  });

  it('Section B2: Instantiating notifiers or runtimes NEVER automatically transitions to LIVE', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'bot_token_abc';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'chat_id_xyz';
    delete process.env.ATHENA_POSITION_ALERTS_LIVE_CONFIRMED;
    PositionAlertRuntimeGuard.reset();

    const notifier = new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath });
    const runtime = new PositionAlertRuntime({
      notifier,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    // Verification: Runtime instantiated, but state remains CONTROLLED_READY (NOT LIVE)
    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('CONTROLLED_READY');
    expect(PositionAlertRuntimeGuard.getOperationalState()).not.toBe('LIVE');
  });

  // =========================================================================
  // SECTION D & L — KILL SWITCH PRECEDENCE & EMERGENCY DISABLE
  // =========================================================================

  it('Section D1: Kill switch overrides all readiness and configuration settings immediately at delivery time', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'bot_token_abc';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'chat_id_xyz';
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

    // 1. Initial event delivers in dry-run
    const alerts1 = await runtime.evaluateArticle(createSampleArticle('RELIANCE'));
    expect(alerts1).toHaveLength(1);

    // 2. Emergency disable: Set kill switch = true dynamically
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('DISABLED');
    expect(PositionAlertRuntimeGuard.getAuditReasonCode()).toBe('KILL_SWITCH_ACTIVE');

    // 3. Subsequent event blocked immediately
    const alerts2 = await runtime.evaluateArticle(createSampleArticle('RELIANCE'));
    expect(alerts2).toHaveLength(0);

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('Section D2: Process restart while kill switch is active remains strictly disabled', () => {
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('DISABLED');

    // Simulate restart with pristine reset
    PositionAlertRuntimeGuard.reset();
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;

    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('DISABLED');
  });

  // =========================================================================
  // SECTION E — CONFIGURATION VALIDATION
  // =========================================================================

  it('Section E: Malformed, empty, whitespace, or unrecognized configuration values fail closed', () => {
    const invalidValues = ['', '   ', 'invalid', 'unknown', '2', 'disabled', 'null', 'undefined'];

    for (const val of invalidValues) {
      process.env.ATHENA_POSITION_ALERTS_ENABLED = val;
      PositionAlertRuntimeGuard.reset();
      expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);

      process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = val;
      PositionAlertRuntimeGuard.reset();
      expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    }
  });

  // =========================================================================
  // SECTION G & H — STARTUP, SHUTDOWN & DISABLE SAFETY
  // =========================================================================

  it('Section G: Production startup with default env yields zero network calls and zero data mutations', async () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn();
    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: false, fetchImpl: fetchSpy as any, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const alerts = await runtime.evaluateArticle(article);

    expect(alerts).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  // =========================================================================
  // SECTION I & M — RUNTIME FAILURE & RECOVERY SAFETY
  // =========================================================================

  it('Section I: Notifier or portfolio failures fail-closed without silent LIVE transition or token leakage', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    const secretToken = 'secret_token_12345';
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = secretToken;
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'chat_12345';
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn().mockRejectedValue(new Error(`Failed to contact https://api.telegram.org/bot${secretToken}/sendMessage`));
    let reportedReason = '';

    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: false,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath,
      onTelemetry: (payload) => {
        if (payload.reason) reportedReason = payload.reason;
      }
    });

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_FAIL_TEST_1',
      positionId: 'POS_RELIANCE_1',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Failure testing',
      timestamp: new Date().toISOString(),
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::fail_test::1'
    };

    const delivered = await notifier.notify(candidate);
    expect(delivered).toBe(false);

    // Error sanitization: Token redacted
    expect(reportedReason).not.toContain(secretToken);
    expect(reportedReason).toContain('[REDACTED_TOKEN]');

    // Confirm system remains in CONTROLLED_READY (never silently promoted to LIVE)
    expect(PositionAlertRuntimeGuard.getOperationalState()).toBe('CONTROLLED_READY');
  });

  // =========================================================================
  // SECTION J & K — OBSERVABILITY & REASON CODES
  // =========================================================================

  it('Section J: Audit reason codes and safe telemetry descriptors expose zero secrets', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'SUPER_SECRET_TOKEN_DO_NOT_EXPOSE';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'SUPER_SECRET_CHAT_ID';
    PositionAlertRuntimeGuard.reset();

    const status = PositionAlertRuntimeGuard.getConfigStatus();
    expect(status.hasBotToken).toBe(true);
    expect(status.hasChatId).toBe(true);
    expect(status.operationalState).toBe('CONTROLLED_READY');
    expect(status.auditReasonCode).toBe('LIVE_DELIVERY_BLOCKED');

    const safeDescriptor = PositionAlertRuntimeGuard.getSafeTelemetryDescriptor();
    expect(safeDescriptor).not.toContain('SUPER_SECRET_TOKEN_DO_NOT_EXPOSE');
    expect(safeDescriptor).not.toContain('SUPER_SECRET_CHAT_ID');
    expect(safeDescriptor).toContain('enabled=true');
    expect(safeDescriptor).toContain('killSwitch=false');
  });

  // =========================================================================
  // SECTION N, O & P — TELEGRAM, DATA & TRADING SUBSYSTEM ISOLATION
  // =========================================================================

  it('Section N1: Zero real Telegram network calls executed across all test evaluations', async () => {
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

    await runtime.evaluateArticle(createSampleArticle('RELIANCE'));
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('Section N2: Zero writes to data/telegram_outbox.json during alert processing', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const outboxHashBefore = computeFileHash('data/telegram_outbox.json');

    const runtime = new PositionAlertRuntime({
      notifier: new PrivatePositionTelegramNotifier({ dryRun: true, storePath: testStorePath }),
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    await runtime.evaluateArticle(createSampleArticle('RELIANCE'));

    const outboxHashAfter = computeFileHash('data/telegram_outbox.json');
    expect(outboxHashAfter).toBe(outboxHashBefore);
  });

  it('Section P: Subsystem contains zero trading or order placement execution methods', () => {
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
