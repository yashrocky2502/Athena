/**
 * ATHENA — PHASE 10P-4: POSITION ALERT DELIVERY & OPERATIONAL HARDENING
 * Phase10P_4_PositionAlertDelivery.test.ts
 * 
 * Comprehensive Test Suite covering Scenarios A through S:
 * - Scenario A: Alerts disabled → no Telegram request.
 * - Scenario B: Missing configuration → no crash and no request.
 * - Scenario C: Valid configuration → one successful delivery.
 * - Scenario D: Telegram success → state becomes SENT.
 * - Scenario E: Telegram failure → state is not SENT.
 * - Scenario F: HTTP 429 → bounded retry/backoff.
 * - Scenario G: HTTP 5xx → bounded retry.
 * - Scenario H: Authentication/configuration failure → no infinite retry.
 * - Scenario I: Same dedupe key submitted twice → one delivery.
 * - Scenario J: Same event after simulated process restart → no duplicate delivery.
 * - Scenario K: Concurrent duplicate delivery attempts → one authoritative send.
 * - Scenario L: Retryable failure followed by success → exactly one successful message.
 * - Scenario M: Permanent failure → no infinite retry.
 * - Scenario N: Telegram failure does not throw into News Core scheduler.
 * - Scenario O: Telegram failure does not stop PositionMonitor.
 * - Scenario P: News Telegram outbox remains untouched (zero diff on data/telegram_outbox.json).
 * - Scenario Q: Real Telegram network is never contacted during tests.
 * - Scenario R: Bot token never appears in logs/telemetry.
 * - Scenario S: No trading/order execution method is reachable.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  PositionAlertCandidate,
  PositionAlertTelemetryPayload,
  PrivatePositionTelegramNotifier,
  PositionAlertDeliveryStore,
  PositionAlertEngine,
  PositionMonitor,
  PositionSource,
  NormalizedPosition,
  PositionAlertRuntimeGuard
} from '../portfolio/alerts/index.ts';

describe('Phase 10P-4: Position Alert Delivery & Operational Hardening', () => {
  const protectedFiles = [
    'data/portfolio_store.json',
    'data/telegram_outbox.json',
    'data/news_core_v2.json',
    'data/news_intelligence_v2.json',
    'data/market_intelligence_outcomes.json',
    'data/news_signal_lifecycle.json',
    'data/news_signal_historical_ledger.json'
  ];

  const initialFileContents: Record<string, string> = {};

  function getFileContent(filePath: string): string {
    const fullPath = path.join(process.cwd(), filePath);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
  }

  beforeEach(() => {
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();
    for (const f of protectedFiles) {
      initialFileContents[f] = getFileContent(f);
    }
  });

  afterEach(() => {
    for (const f of protectedFiles) {
      const current = getFileContent(f);
      expect(current).toBe(initialFileContents[f]);
    }
  });

  const sampleAlert: PositionAlertCandidate = {
    alertId: 'ALT_TEST_001',
    positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
    symbol: 'RELIANCE',
    alertType: 'RESULTS_EVENT',
    severity: 'WARNING',
    reason: 'Position Intelligence [RELIANCE]: Reliance Q2 Net Profit jumps 15%',
    timestamp: '2026-09-24T12:00:00.000Z',
    marketData: {
      currentPrice: 2980.00,
      previousPrice: 2450.00
    },
    provenance: {
      source: 'Reuters',
      observedAt: '2026-09-24T12:00:00.000Z',
      eventId: 'NEWS_REL_Q2_001',
      publisher: 'Reuters',
      url: 'https://reuters.com/article/reliance-q2'
    },
    dedupeKey: 'dedupe::pos_rel::POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA::NEWS_REL_Q2_001::RESULTS_EVENT::WARNING'
  };

  // =========================================================================
  // SCENARIO A: Alerts disabled → no Telegram request
  // =========================================================================
  it('Scenario A: When disabled, no Telegram network requests are dispatched', async () => {
    const mockFetch = vi.fn();
    const telemetryEvents: PositionAlertTelemetryPayload[] = [];

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      fetchImpl: mockFetch as any,
      onTelemetry: (t) => telemetryEvents.push(t)
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(telemetryEvents.some(e => e.event === 'DELIVERY_DISABLED')).toBe(true);
  });

  // =========================================================================
  // SCENARIO B: Missing configuration → no crash and no request
  // =========================================================================
  it('Scenario B: Missing configuration fails safely without throwing exceptions or making network calls', async () => {
    const mockFetch = vi.fn();
    const telemetryEvents: PositionAlertTelemetryPayload[] = [];

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      botToken: '', // missing token
      chatId: '', // missing chat id
      fetchImpl: mockFetch as any,
      onTelemetry: (t) => telemetryEvents.push(t)
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(telemetryEvents.some(e => e.event === 'CONFIGURATION_UNAVAILABLE')).toBe(true);
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('FAILED_PERMANENT');
  });

  // =========================================================================
  // SCENARIO C & D: Valid configuration & Telegram success → state becomes SENT
  // =========================================================================
  it('Scenario C & D: Valid configuration dispatches request and Telegram success marks state as SENT', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 101 } })
    });
    const telemetryEvents: PositionAlertTelemetryPayload[] = [];

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      fetchImpl: mockFetch as any,
      onTelemetry: (t) => telemetryEvents.push(t)
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('SENT');
    expect(telemetryEvents.some(e => e.event === 'DELIVERY_SUCCEEDED')).toBe(true);
  });

  // =========================================================================
  // SCENARIO E: Telegram failure → state is not SENT
  // =========================================================================
  it('Scenario E: Telegram failure marks status as failed rather than SENT', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers()
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      maxRetries: 2,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(false);
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).not.toBe('SENT');
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('FAILED_RETRYABLE');
  });

  // =========================================================================
  // SCENARIO F: HTTP 429 → bounded retry/backoff
  // =========================================================================
  it('Scenario F: HTTP 429 invokes bounded retry respecting Retry-After header and succeeds', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const headers = new Headers();
        headers.set('Retry-After', '0'); // 0s for instantaneous test backoff
        return {
          ok: false,
          status: 429,
          headers
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ok: true })
      };
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      maxRetries: 3,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(true);
    expect(callCount).toBe(2);
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('SENT');
  });

  // =========================================================================
  // SCENARIO G: HTTP 5xx → bounded retry
  // =========================================================================
  it('Scenario G: HTTP 503 triggers bounded retries up to maxRetries without infinite loops', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 503,
        headers: new Headers()
      };
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      maxRetries: 3,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(false);
    expect(callCount).toBe(3); // Exactly maxRetries, no infinite loop
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('FAILED_RETRYABLE');
  });

  // =========================================================================
  // SCENARIO H & M: Authentication/Permanent failure → no infinite retry
  // =========================================================================
  it('Scenario H & M: Permanent HTTP 401/403/400 errors fail immediately without retry loops', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 401, // Unauthorized / Invalid Token
        headers: new Headers()
      };
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'INVALID_TOKEN',
      chatId: '123456789',
      maxRetries: 5,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(false);
    expect(callCount).toBe(1); // Fails immediately, zero retries
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('FAILED_PERMANENT');

    // Subsequent notify with same key is suppressed from making network calls
    const retryAttempt = await notifier.notify(sampleAlert);
    expect(retryAttempt).toBe(false);
    expect(callCount).toBe(1); // Still 1 call, permanent failure suppressed
  });

  // =========================================================================
  // SCENARIO I: Same dedupe key submitted twice → one delivery
  // =========================================================================
  it('Scenario I: Submitting the identical alert twice dispatches exactly one Telegram request', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ok: true })
      };
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      fetchImpl: mockFetch as any
    });

    const run1 = await notifier.notify(sampleAlert);
    expect(run1).toBe(true);
    expect(callCount).toBe(1);

    // Second call with same dedupeKey
    const run2 = await notifier.notify(sampleAlert);
    expect(run2).toBe(true);
    expect(callCount).toBe(1); // No second HTTP request
  });

  // =========================================================================
  // SCENARIO J: Same event after simulated process restart → no duplicate delivery
  // =========================================================================
  it('Scenario J: Simulated process restart reloads persisted state and suppresses duplicate delivery', async () => {
    const tempStorePath = path.join(os.tmpdir(), `athena_delivery_test_${Date.now()}.json`);
    let callCount = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ok: true })
      };
    });

    try {
      // Process 1: First instance sends alert
      const notifier1 = new PrivatePositionTelegramNotifier({
        enabled: true,
        dryRun: false,
        botToken: 'SECRET_BOT_TOKEN_12345',
        chatId: '123456789',
        storePath: tempStorePath,
        fetchImpl: mockFetch as any
      });

      const res1 = await notifier1.notify(sampleAlert);
      expect(res1).toBe(true);
      expect(callCount).toBe(1);

      // Process 2: Simulated restart creates a new notifier instance pointing to persisted state
      const notifier2 = new PrivatePositionTelegramNotifier({
        enabled: true,
        dryRun: false,
        botToken: 'SECRET_BOT_TOKEN_12345',
        chatId: '123456789',
        storePath: tempStorePath,
        fetchImpl: mockFetch as any
      });

      const res2 = await notifier2.notify(sampleAlert);
      expect(res2).toBe(true);
      expect(callCount).toBe(1); // Exactly 1 total call across restarts!
    } finally {
      if (fs.existsSync(tempStorePath)) {
        fs.unlinkSync(tempStorePath);
      }
    }
  });

  // =========================================================================
  // SCENARIO K: Concurrent duplicate delivery attempts → one authoritative send
  // =========================================================================
  it('Scenario K: Concurrent calls with the same dedupe key coalesce into one authoritative network dispatch', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      // Simulate network latency
      await new Promise(r => setTimeout(r, 20));
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ok: true })
      };
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      fetchImpl: mockFetch as any
    });

    // Dispatch 5 concurrent notifications for the same alert
    const promises = [
      notifier.notify(sampleAlert),
      notifier.notify(sampleAlert),
      notifier.notify(sampleAlert),
      notifier.notify(sampleAlert),
      notifier.notify(sampleAlert)
    ];

    const results = await Promise.all(promises);

    expect(results.every(r => r === true)).toBe(true);
    expect(callCount).toBe(1); // Single authoritative send
  });

  // =========================================================================
  // SCENARIO L: Retryable failure followed by success → exactly one successful message
  // =========================================================================
  it('Scenario L: Transient 500 error followed by success delivers exactly once', async () => {
    let attempts = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return { ok: false, status: 500, headers: new Headers() };
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ ok: true }) };
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      maxRetries: 3,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const result = await notifier.notify(sampleAlert);

    expect(result).toBe(true);
    expect(attempts).toBe(2);
    expect(notifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('SENT');
  });

  // =========================================================================
  // SCENARIO N & O: Failure isolation (does not throw into caller/monitor)
  // =========================================================================
  it('Scenario N & O: Network crashes inside Telegram transport do not throw into PositionMonitor or caller', async () => {
    const throwingFetch = vi.fn().mockRejectedValue(new Error('Fatal Network Socket Disconnect'));

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      maxRetries: 2,
      initialBackoffMs: 5,
      fetchImpl: throwingFetch as any
    });

    class DummySource implements PositionSource {
      public readonly sourceId = 'DUMMY';
      public readonly sourceType = 'MOCK' as const;
      async getPositions(): Promise<NormalizedPosition[]> {
        return [
          {
            positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
            symbol: 'RELIANCE',
            assetClass: 'EQUITY',
            quantity: 100,
            source: 'CSV',
            observedAt: new Date().toISOString()
          }
        ];
      }
    }

    const monitor = new PositionMonitor(new DummySource());
    const alertEngine = new PositionAlertEngine({ monitor, notifier });

    // Should complete cleanly without throwing an unhandled exception
    await expect(alertEngine.evaluate()).resolves.toBeDefined();
    await expect(
      alertEngine.evaluateNewsEvent({
        id: 'NEWS_REL_TEST_001',
        headline: 'Reliance Board Approves Dividend',
        source: 'Reuters',
        publisher: 'Reuters',
        symbols: ['RELIANCE']
      })
    ).resolves.not.toThrow();
  });

  // =========================================================================
  // SCENARIO P: News Telegram outbox remains untouched
  // =========================================================================
  it('Scenario P: Dispatching position alerts does not write to data/telegram_outbox.json', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ ok: true })
    });

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'SECRET_BOT_TOKEN_12345',
      chatId: '123456789',
      fetchImpl: mockFetch as any
    });

    await notifier.notify(sampleAlert);

    const outboxContent = getFileContent('data/telegram_outbox.json');
    expect(outboxContent).toBe(initialFileContents['data/telegram_outbox.json']);
  });

  // =========================================================================
  // SCENARIO Q: Real Telegram network is never contacted during tests
  // =========================================================================
  it('Scenario Q: Notifier dryRun ensures real Telegram network is never contacted in test env', async () => {
    const defaultNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true
    });

    const result = await defaultNotifier.notify(sampleAlert);
    expect(result).toBe(true);
    expect(defaultNotifier.getDeliveryStatus(sampleAlert.dedupeKey)).toBe('SENT');
  });

  // =========================================================================
  // SCENARIO R: Bot token never appears in logs/telemetry
  // =========================================================================
  it('Scenario R: Bot token is strictly scrubbed and never appears in telemetry or error messages', async () => {
    const secretToken = 'TOP_SECRET_BOT_TOKEN_98765';
    const telemetryLogs: PositionAlertTelemetryPayload[] = [];

    const mockFetch = vi.fn().mockRejectedValue(new Error(`Failed request to https://api.telegram.org/bot${secretToken}/sendMessage`));

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: secretToken,
      chatId: '123456789',
      maxRetries: 1,
      fetchImpl: mockFetch as any,
      onTelemetry: (t) => telemetryLogs.push(t)
    });

    await notifier.notify(sampleAlert);

    for (const entry of telemetryLogs) {
      const json = JSON.stringify(entry);
      expect(json).not.toContain(secretToken);
    }
  });

  // =========================================================================
  // SCENARIO S: No trading/order execution method is reachable
  // =========================================================================
  it('Scenario S: Read-only safety verification - zero trading or order execution methods exist', () => {
    const notifier = new PrivatePositionTelegramNotifier();
    const store = new PositionAlertDeliveryStore();

    expect((notifier as any).buy).toBeUndefined();
    expect((notifier as any).sell).toBeUndefined();
    expect((notifier as any).placeOrder).toBeUndefined();
    expect((notifier as any).modifyOrder).toBeUndefined();
    expect((notifier as any).cancelOrder).toBeUndefined();
    expect((notifier as any).modifyPosition).toBeUndefined();

    expect((store as any).buy).toBeUndefined();
    expect((store as any).sell).toBeUndefined();
    expect((store as any).placeOrder).toBeUndefined();
  });
});
