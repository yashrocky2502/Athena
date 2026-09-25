/**
 * ATHENA — PHASE 10P-10: CONTROLLED POSITION-ALERT ACTIVATION READINESS TEST SUITE
 * Phase10P_10_ControlledActivationReadiness.test.ts
 * 
 * Strict deterministic verification of:
 * 1. Feature Flag Fail-Closed: Unset, empty, "false", "0", or arbitrary values resolve to DISABLED.
 * 2. Feature Flag Dynamic Evaluation: Env var evaluated dynamically at runtime, not locked at module load.
 * 3. Hard Kill Switch Precedence: ATHENA_POSITION_ALERTS_KILL_SWITCH=true unconditionally blocks delivery,
 *    even when ATHENA_POSITION_ALERTS_ENABLED=true.
 * 4. Stale Instance Protection: Pre-initialized notifiers check kill switch at delivery time and block.
 * 5. Destination Isolation: Notifier strictly ignores generic TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
 * 6. Outbox Isolation: Personal alert execution causes zero writes to data/telegram_outbox.json.
 * 7. Delivery Safety & Missing Credentials: Missing credentials fail safely with 0 network calls and zero crash.
 * 8. Zero Network Calls on Disabled / Kill Switch: Exactly zero fetch/network calls executed.
 * 9. Safe Telemetry & Credential Redaction: Telemetry descriptor exposes zero secrets; errors are sanitized.
 * 10. Protected Datasets Immutability: All 7 protected production datasets remain byte-identical before & after.
 * 11. Read-Only Safety: No order placement or trading methods exist across the alert runtime subsystem.
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

describe('Phase 10P-10: Controlled Position-Alert Activation Readiness', () => {
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

  const createSampleArticle = (symbol: string = 'RELIANCE'): NewsArticleV2 => ({
    id: `ART_${symbol}_${Date.now()}`,
    headline: `${symbol} signs landmark commercial joint venture contract`,
    body: `${symbol} today announced execution of a definitive binding agreement.`,
    canonicalUrl: `https://exchange-filings.com/announcements/${symbol.toLowerCase()}-filing.pdf`,
    source: {
      publisher: 'NSE Corporate Announcements',
      url: `https://exchange-filings.com/announcements/${symbol.toLowerCase()}-filing.pdf`,
      collectionMethod: 'RSS'
    },
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    category: 'CORPORATE_ACTION',
    sentiment: 'BULLISH',
    relevanceScore: 95,
    fno: {
      eligible: true,
      symbol,
      confidence: 'HIGH',
      decision: 'INCLUDE',
      reason: 'Valid FO security'
    },
    primaryCategory: 'CORPORATE_ACTION',
    eventType: 'EXPANSION',
    categoryConfidence: 'HIGH'
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear dedicated position alert env vars
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    delete process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN;
    delete process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.ATHENA_POSITION_ALERTS_CHAT_ID;
    delete process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID;
    delete process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;

    PositionAlertRuntimeGuard.reset();

    // Record baseline checksums
    baselineChecksums.clear();
    for (const f of PROTECTED_DATA_FILES) {
      baselineChecksums.set(f, computeFileHash(f));
    }

    testStorePath = path.resolve(process.cwd(), `test_p10_delivery_store_${Date.now()}.json`);
    testStore = new PositionAlertDeliveryStore(testStorePath);
  });

  afterEach(() => {
    process.env = originalEnv;
    PositionAlertRuntimeGuard.reset();

    if (fs.existsSync(testStorePath)) {
      try {
        fs.unlinkSync(testStorePath);
      } catch {}
    }

    // Verify protected dataset integrity after every test
    for (const f of PROTECTED_DATA_FILES) {
      const currentHash = computeFileHash(f);
      const expectedHash = baselineChecksums.get(f);
      expect(currentHash).toBe(expectedHash);
    }
  });

  // =========================================================================
  // 1. FEATURE FLAG — FAIL CLOSED
  // =========================================================================

  it('Requirement 1A: Feature flag defaults to DISABLED when env var is missing', () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    PositionAlertRuntimeGuard.reset();
    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Requirement 1B: Empty, false, 0, or arbitrary values resolve to DISABLED', () => {
    const disabledValues = ['', '   ', 'false', 'FALSE', '0', 'no', 'disabled', 'off', 'null', 'undefined', '2'];
    for (const val of disabledValues) {
      process.env.ATHENA_POSITION_ALERTS_ENABLED = val;
      PositionAlertRuntimeGuard.reset();
      expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
      expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
    }
  });

  it('Requirement 1C: Only explicit "true" or "1" (trimmed, case-insensitive) enables feature flag', () => {
    const trueValues = ['true', 'TRUE', 'True', '  true  ', '1', ' 1 '];
    for (const val of trueValues) {
      process.env.ATHENA_POSITION_ALERTS_ENABLED = val;
      PositionAlertRuntimeGuard.reset();
      expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);
    }
  });

  it('Requirement 1D: Feature flag is evaluated dynamically at runtime, not cached from module load', () => {
    delete process.env.ATHENA_POSITION_ALERTS_ENABLED;
    PositionAlertRuntimeGuard.reset();
    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);

    // Dynamically change env var
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);

    // Dynamically disable
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'false';
    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);
  });

  it('Requirement 1E: Disabled runtime performs zero Telegram calls, zero evaluation, zero outbox writes', async () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'false';
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn();
    const notifier = new PrivatePositionTelegramNotifier({ fetchImpl: fetchSpy as any, dryRun: false });
    const runtime = new PositionAlertRuntime({
      notifier,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const result = await runtime.onCanonicalArticle(article);

    expect(result).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.getProcessedEventsCount()).toBe(0);
  });

  // =========================================================================
  // 2. HARD KILL SWITCH
  // =========================================================================

  it('Requirement 2A: Kill switch defaults to ACTIVE / BLOCKED when env var is missing', () => {
    delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    PositionAlertRuntimeGuard.reset();
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
  });

  it('Requirement 2B: Kill switch remains ACTIVE / BLOCKED on missing, empty, whitespace, "true", "1", or arbitrary invalid values', () => {
    const activeValues = [undefined, '', '   ', 'true', 'TRUE', 'True', '  true  ', '1', ' 1 ', 'invalid', 'unknown', 'disabled', '2'];
    for (const val of activeValues) {
      if (val === undefined) {
        delete process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
      } else {
        process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = val;
      }
      PositionAlertRuntimeGuard.reset();
      expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    }
  });

  it('Requirement 2B-2: Kill switch becomes INACTIVE only on explicit recognized false values ("false", "0")', () => {
    const inactiveValues = ['false', 'FALSE', 'False', '  false  ', '0', ' 0 '];
    for (const val of inactiveValues) {
      process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = val;
      PositionAlertRuntimeGuard.reset();
      expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(false);
    }
  });

  it('Requirement 2C: Kill switch takes absolute precedence over enabled feature flag', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);
  });

  it('Requirement 2C-2: Delivery is permitted when feature flag is enabled and kill switch is explicitly "false"', () => {
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(false);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(true);
  });

  it('Requirement 2D: Kill switch override works cleanly for test isolation', () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(true);

    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);
    expect(PositionAlertRuntimeGuard.isKillSwitchActive()).toBe(true);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(false);

    PositionAlertRuntimeGuard.setKillSwitchOverride(false);
    expect(PositionAlertRuntimeGuard.isDeliveryPermitted()).toBe(true);
  });

  it('Requirement 2E: Stale notifier instance cannot bypass kill switch (checked at delivery time)', async () => {
    // 1. Initialize notifier while enabled and kill switch explicitly false
    process.env.ATHENA_POSITION_ALERTS_ENABLED = 'true';
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();

    const fetchSpy = vi.fn();
    let telemetryEvent: string | undefined;

    const staleNotifier = new PrivatePositionTelegramNotifier({
      botToken: 'stale_token_123',
      chatId: 'stale_chat_456',
      dryRun: false,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath,
      onTelemetry: (payload) => {
        telemetryEvent = payload.event;
      }
    });

    // 2. Now activate kill switch before delivery occurs
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'true';

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_TEST_STALE_1',
      dedupeKey: 'DEDUP_TEST_STALE_1',
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Binding Joint Venture Agreement Announced',
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    const delivered = await staleNotifier.notify(candidate);

    expect(delivered).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(telemetryEvent).toBe('KILL_SWITCH_BLOCKED');
  });

  it('Requirement 2F: Runtime blocks article evaluation completely when kill switch is active', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(true);

    const fetchSpy = vi.fn();
    const notifier = new PrivatePositionTelegramNotifier({ fetchImpl: fetchSpy as any });
    const runtime = new PositionAlertRuntime({
      notifier,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const result = await runtime.onCanonicalArticle(article);

    expect(result).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.getProcessedEventsCount()).toBe(0);
  });

  // =========================================================================
  // 3. TELEGRAM DESTINATION ISOLATION
  // =========================================================================

  it('Requirement 3A: Position-alert notifier uses dedicated credentials and ignores generic News Core Telegram config', async () => {
    // Set ONLY generic Telegram variables (News Core V2)
    process.env.TELEGRAM_BOT_TOKEN = 'generic_news_core_bot_token';
    process.env.TELEGRAM_CHAT_ID = 'generic_news_core_chat_id';
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(false);

    let telemetryEvent: string | undefined;
    const fetchSpy = vi.fn();

    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: false,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath,
      onTelemetry: (p) => {
        telemetryEvent = p.event;
      }
    });

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_TEST_ISOLATION_1',
      dedupeKey: 'DEDUP_TEST_ISOLATION_1',
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Binding Joint Venture Agreement Announced',
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    const delivered = await notifier.notify(candidate);

    // Fails safely: Notifier refused to pick up generic TELEGRAM_BOT_TOKEN
    expect(delivered).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(telemetryEvent).toBe('CONFIGURATION_UNAVAILABLE');

    const record = testStore.getRecord('DEDUP_TEST_ISOLATION_1');
    expect(record?.status).toBe('FAILED_PERMANENT');
    expect(record?.lastError).toBe('MISSING_TELEGRAM_CONFIGURATION');
  });

  it('Requirement 3B: Position-alert notifier accepts dedicated credential variables', async () => {
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'dedicated_bot_token_abc';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'dedicated_chat_id_xyz';
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(false);

    const configStatus = PositionAlertRuntimeGuard.getConfigStatus();
    expect(configStatus.hasBotToken).toBe(true);
    expect(configStatus.hasChatId).toBe(true);
    expect(configStatus.isConfigured).toBe(true);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} })
    });

    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: false,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath
    });

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_TEST_DEDICATED_1',
      dedupeKey: 'DEDUP_TEST_DEDICATED_1',
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Contract announcement',
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    const delivered = await notifier.notify(candidate);
    expect(delivered).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Verify request URL uses the dedicated bot token
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe('https://api.telegram.org/botdedicated_bot_token_abc/sendMessage');
    const calledBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(calledBody.chat_id).toBe('dedicated_chat_id_xyz');
  });

  // =========================================================================
  // 4. OUTBOX ISOLATION & DATASET IMMUTABILITY
  // =========================================================================

  it('Requirement 4A: Position alert evaluation causes exactly zero writes to data/telegram_outbox.json', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(false);

    const initialOutboxContent = fs.readFileSync(path.resolve(process.cwd(), 'data/telegram_outbox.json'), 'utf-8');

    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: true,
      storePath: testStorePath
    });

    const runtime = new PositionAlertRuntime({
      notifier,
      deliveryStore: testStore,
      portfolioState: createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }])
    });

    const article = createSampleArticle('RELIANCE');
    const alerts = await runtime.onCanonicalArticle(article);

    expect(alerts.length).toBeGreaterThan(0);

    const finalOutboxContent = fs.readFileSync(path.resolve(process.cwd(), 'data/telegram_outbox.json'), 'utf-8');
    expect(finalOutboxContent).toBe(initialOutboxContent);
  });

  // =========================================================================
  // 5. DELIVERY SAFETY & CONFIGURATION TELEMETRY
  // =========================================================================

  it('Requirement 5A: Telemetry descriptor safely describes status with zero leaked secrets', () => {
    process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN = 'SUPER_SECRET_TOKEN_DO_NOT_LEAK';
    process.env.ATHENA_POSITION_ALERTS_CHAT_ID = 'SUPER_SECRET_CHAT_ID';
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(false);

    const descriptor = PositionAlertRuntimeGuard.getSafeTelemetryDescriptor();
    expect(descriptor).toContain('enabled=true');
    expect(descriptor).toContain('killSwitch=false');
    expect(descriptor).toContain('deliveryPermitted=true');
    expect(descriptor).toContain('hasBotToken=true');
    expect(descriptor).toContain('hasChatId=true');
    expect(descriptor).toContain('isConfigured=true');

    // STRICT: Must not leak the secret token or chat ID string
    expect(descriptor).not.toContain('SUPER_SECRET_TOKEN_DO_NOT_LEAK');
    expect(descriptor).not.toContain('SUPER_SECRET_CHAT_ID');
  });

  it('Requirement 5B: Error sanitization in notifier replaces token with [REDACTED_TOKEN]', async () => {
    const secretToken = 'bot_secret_token_12345';
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(false);

    const fetchSpy = vi.fn().mockRejectedValue(new Error(`Network failure at https://api.telegram.org/bot${secretToken}/sendMessage`));
    let reportedReason: string | undefined;

    const notifier = new PrivatePositionTelegramNotifier({
      botToken: secretToken,
      chatId: '12345678',
      dryRun: false,
      maxRetries: 1,
      fetchImpl: fetchSpy as any,
      storePath: testStorePath,
      onTelemetry: (payload) => {
        if (payload.reason) reportedReason = payload.reason;
      }
    });

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_TEST_ERR_1',
      dedupeKey: 'DEDUP_TEST_ERR_1',
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      alertType: 'CORPORATE_ACTION',
      severity: 'WARNING',
      reason: 'Sanitization verification',
      provenance: { source: 'NSE', observedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    await notifier.notify(candidate);

    expect(reportedReason).toBeDefined();
    expect(reportedReason).not.toContain(secretToken);
    expect(reportedReason).toContain('[REDACTED_TOKEN]');
  });

  // =========================================================================
  // 6. READ-ONLY ARCHITECTURE SAFETY
  // =========================================================================

  it('Requirement 6A: Alert runtime subsystem contains zero order placement or trading methods', () => {
    const forbiddenMethodNames = [
      'placeOrder',
      'executeOrder',
      'buy',
      'sell',
      'transact',
      'submitOrder',
      'cancelOrder',
      'modifyOrder',
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

  // =========================================================================
  // 7. END-TO-END CONTROLLED SIMULATION READINESS
  // =========================================================================

  it('Requirement 7A: End-to-end controlled activation readiness in dryRun mode executes reliably', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    PositionAlertRuntimeGuard.setKillSwitchOverride(false);

    const notifier = new PrivatePositionTelegramNotifier({
      dryRun: true,
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

    // 1. Qualifying active event for RELIANCE
    const relianceArticle = createSampleArticle('RELIANCE');
    const alerts1 = await runtime.onCanonicalArticle(relianceArticle);
    expect(alerts1).toHaveLength(1);
    expect(alerts1[0].symbol).toBe('RELIANCE');
    expect(testStore.isDelivered(alerts1[0].dedupeKey)).toBe(true);

    // 2. Duplicate article produces zero new delivery
    const alertsDuplicate = await runtime.onCanonicalArticle(relianceArticle);
    expect(alertsDuplicate).toHaveLength(0);

    // 3. Unheld symbol INFOSYS produces zero delivery
    const infosysArticle = createSampleArticle('INFOSYS');
    const alertsUnheld = await runtime.onCanonicalArticle(infosysArticle);
    expect(alertsUnheld).toHaveLength(0);

    // 4. Activating kill switch mid-stream immediately blocks further alerts
    PositionAlertRuntimeGuard.setKillSwitchOverride(true);
    const tcsArticle = createSampleArticle('TCS');
    const alertsKilled = await runtime.onCanonicalArticle(tcsArticle);
    expect(alertsKilled).toHaveLength(0);
  });
});
