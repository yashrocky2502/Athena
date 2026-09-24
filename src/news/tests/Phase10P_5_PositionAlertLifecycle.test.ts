/**
 * ATHENA — PHASE 10P-5: POSITION ALERT END-TO-END LIFECYCLE & REAL-WORLD SIMULATION
 * Phase10P_5_PositionAlertLifecycle.test.ts
 * 
 * End-to-End lifecycle simulation testing for the personal-position-alert pipeline.
 * 
 * Comprehensive Verification Scenarios:
 * - TEST A: Empty Portfolio -> News Event -> No Alert
 * - TEST B: Position Appears -> PositionMonitor lifecycle event -> Candidate emitted
 * - TEST C: Unrelated News Event -> Fail closed -> No Alert
 * - TEST D: Related Structured News Event -> Position Alert generated with valid provenance
 * - TEST E: Duplicate Event Submission -> Suppressed, no duplicate delivery
 * - TEST F: Position Quantity Change -> POSITION_QUANTITY_CHANGED
 * - TEST G: Position Price Change -> POSITION_PRICE_CHANGED
 * - TEST H: Position Side Change -> POSITION_SIDE_CHANGED
 * - TEST I: Position Closure -> POSITION_CLOSED
 * - TEST J: Post-Close News -> Closed position does NOT receive alert
 * - TEST K: Multi-Position Portfolio -> Targeted alert to held instrument only
 * - TEST L: Restart / Delivery Persistence -> Preserves exact-once guarantee across restarts
 * - TEST M: Retryable Delivery Failure -> Bounded retry and status tracking
 * - TEST N: Permanent Delivery Failure -> Fail-closed without endless retries
 * - TEST O: Telegram Disabled -> Safe no-op without crashes or outbox writes
 * - TEST P: Telegram Config Missing -> Safe fail-closed without crashes or secret leakage
 * - TEST Q: Generic Market / F&O Event -> Strict rejection without active position match
 * - TEST R: Repeated Monitoring Cycles -> Idempotent state evaluation
 * - TEST S: Production Data Integrity -> Zero modification across all data/ files
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  PositionAlertSimulationHarness,
  SimulatedPositionSource,
  NormalizedPosition,
  PositionNewsEventInput,
  PrivatePositionTelegramNotifier,
  PositionAlertDeliveryStore
} from '../portfolio/alerts/index.ts';

describe('Phase 10P-5: Position Alert End-to-End Lifecycle & Real-World Simulation', () => {
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

  // =========================================================================
  // TEST A: EMPTY PORTFOLIO
  // =========================================================================
  it('TEST A: Empty portfolio produces NO_POSITION and rejects incoming news events', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: []
    });

    const cycleResult = await harness.runPositionCycle();
    expect(cycleResult.snapshot.presenceState).toBe('NO_POSITION');
    expect(cycleResult.snapshot.totalPositions).toBe(0);
    expect(cycleResult.alerts.length).toBe(0);

    const event: PositionNewsEventInput = {
      id: 'NEWS_MKT_001',
      headline: 'Reliance Industries Q2 Results Beat Estimates',
      source: 'Reuters',
      publisher: 'Reuters',
      symbols: ['RELIANCE']
    };

    const newsResult = await harness.evaluateNewsEvent(event);
    expect(newsResult).toBeNull();
    expect(harness.getGeneratedAlerts().length).toBe(0);
  });

  // =========================================================================
  // TEST B: POSITION APPEARS
  // =========================================================================
  it('TEST B: Position appearance triggers POSITION_APPEARED lifecycle event and valid candidate', async () => {
    const harness = new PositionAlertSimulationHarness({ initialPositions: [] });
    await harness.runPositionCycle(); // Baseline empty snapshot

    const reliancePos: NormalizedPosition = {
      positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
      symbol: 'RELIANCE',
      isin: 'INE002A01018',
      exchange: 'NSE',
      assetClass: 'EQUITY',
      quantity: 10,
      averagePrice: 1300,
      currentPrice: 1350,
      side: 'LONG',
      source: 'CSV',
      observedAt: '2026-09-24T10:00:00.000Z'
    };

    harness.addPosition(reliancePos);

    const { snapshot, events, alerts } = await harness.runPositionCycle();

    expect(snapshot.presenceState).toBe('POSITION_EXISTS');
    expect(snapshot.totalPositions).toBe(1);

    const appearedEvent = events.find(e => e.type === 'POSITION_APPEARED' && e.symbol === 'RELIANCE');
    expect(appearedEvent).toBeDefined();
    expect(appearedEvent?.positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
    expect(appearedEvent?.quantityDelta).toBe(10);

    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
    expect(alerts[0].symbol).toBe('RELIANCE');
    expect(alerts[0].alertType).toBe('LIFECYCLE');
    expect(alerts[0].dedupeKey).toContain('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
  });

  // =========================================================================
  // TEST C: UNRELATED NEWS EVENT
  // =========================================================================
  it('TEST C: News event for unowned asset (TCS) while holding RELIANCE is strictly rejected', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
          symbol: 'RELIANCE',
          isin: 'INE002A01018',
          assetClass: 'EQUITY',
          quantity: 10,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    const tcsEvent: PositionNewsEventInput = {
      id: 'NEWS_TCS_001',
      headline: 'TCS Signs Multi-Million Dollar Deal with Global Bank',
      source: 'Bloomberg',
      publisher: 'Bloomberg',
      symbols: ['TCS']
    };

    const candidate = await harness.evaluateNewsEvent(tcsEvent);
    expect(candidate).toBeNull();
  });

  // =========================================================================
  // TEST D: RELATED STRUCTURED NEWS EVENT
  // =========================================================================
  it('TEST D: Related structured news event generates position alert with verified provenance', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
          symbol: 'RELIANCE',
          isin: 'INE002A01018',
          exchange: 'NSE',
          assetClass: 'EQUITY',
          quantity: 25,
          averagePrice: 2850,
          currentPrice: 2950,
          side: 'LONG',
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    const relEvent: PositionNewsEventInput = {
      id: 'NEWS_REL_RESULTS_001',
      headline: 'Reliance Industries Q2 Results Beat Market Estimates with 15% Profit Growth',
      category: 'RESULTS',
      source: 'Reuters',
      publisher: 'Reuters',
      symbols: ['RELIANCE'],
      exchange: 'NSE',
      url: 'https://reuters.com/markets/reliance-results'
    };

    const candidate = await harness.evaluateNewsEvent(relEvent);

    expect(candidate).not.toBeNull();
    expect(candidate?.positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
    expect(candidate?.symbol).toBe('RELIANCE');
    expect(candidate?.alertType).toBe('RESULTS_EVENT');
    expect(candidate?.severity).toBe('WARNING');
    expect(candidate?.provenance.source).toBe('Reuters');
    expect(candidate?.provenance.url).toBe('https://reuters.com/markets/reliance-results');
  });

  // =========================================================================
  // TEST E: DUPLICATE EVENT
  // =========================================================================
  it('TEST E: Submitting the identical structured event twice suppresses duplicate alert', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
          symbol: 'INFY',
          assetClass: 'EQUITY',
          quantity: 50,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    const event: PositionNewsEventInput = {
      id: 'NEWS_INFY_DIV_001',
      headline: 'Infosys Declares Interim Dividend of Rs 20 per share',
      source: 'PTI',
      publisher: 'PTI',
      symbols: ['INFY']
    };

    const firstResult = await harness.evaluateNewsEvent(event);
    expect(firstResult).not.toBeNull();

    const secondResult = await harness.evaluateNewsEvent(event);
    expect(secondResult).toBeNull(); // Suppressed as duplicate

    expect(harness.getGeneratedAlerts().filter(a => a.symbol === 'INFY' && a.alertType === 'CORPORATE_ACTION').length).toBe(1);
  });

  // =========================================================================
  // TEST F: QUANTITY CHANGE
  // =========================================================================
  it('TEST F: Quantity changes (10 -> 15 shares) emit POSITION_QUANTITY_CHANGED event', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
          symbol: 'RELIANCE',
          assetClass: 'EQUITY',
          quantity: 10,
          averagePrice: 1300,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle(); // Cycle 1: Baseline

    // Update quantity: 10 -> 15
    harness.updateQuantity('RELIANCE', 15);

    const { events, alerts } = await harness.runPositionCycle(); // Cycle 2

    const qtyEvent = events.find(e => e.type === 'POSITION_QUANTITY_CHANGED');
    expect(qtyEvent).toBeDefined();
    expect(qtyEvent?.quantityDelta).toBe(5);
    expect(qtyEvent?.currentPosition?.quantity).toBe(15);
    expect(qtyEvent?.previousPosition?.quantity).toBe(10);

    const qtyAlert = alerts.find(a => a.alertType === 'QUANTITY_CHANGE');
    expect(qtyAlert).toBeDefined();
    expect(qtyAlert?.reason).toContain('quantity changed');
  });

  // =========================================================================
  // TEST G: PRICE CHANGE
  // =========================================================================
  it('TEST G: Entry/Average price changes emit POSITION_PRICE_CHANGED event', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
          symbol: 'TCS',
          assetClass: 'EQUITY',
          quantity: 20,
          averagePrice: 3500,
          currentPrice: 3550,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    harness.updatePrice('TCS', 3600, 3520); // Average price adjusted

    const { events } = await harness.runPositionCycle();
    const priceEvent = events.find(e => e.type === 'POSITION_PRICE_CHANGED');
    expect(priceEvent).toBeDefined();
    expect(priceEvent?.priceDelta).toBe(20);
    expect(priceEvent?.symbol).toBe('TCS');
  });

  // =========================================================================
  // TEST H: SIDE CHANGE
  // =========================================================================
  it('TEST H: Position side transition (LONG -> SHORT) emits POSITION_SIDE_CHANGED event', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_NIFTY_FUT_0_NA',
          symbol: 'NIFTY26OCTFUT',
          assetClass: 'FUTURES',
          quantity: 50,
          side: 'LONG',
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    harness.updateSide('NIFTY26OCTFUT', 'SHORT');

    const { events } = await harness.runPositionCycle();
    const sideEvent = events.find(e => e.type === 'POSITION_SIDE_CHANGED');
    expect(sideEvent).toBeDefined();
    expect(sideEvent?.previousPosition?.side).toBe('LONG');
    expect(sideEvent?.currentPosition?.side).toBe('SHORT');
  });

  // =========================================================================
  // TEST I: POSITION CLOSE
  // =========================================================================
  it('TEST I: Position closure emits POSITION_CLOSED event referencing previous position', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_WIPRO_EQUITY_SPOT_0_NA',
          symbol: 'WIPRO',
          assetClass: 'EQUITY',
          quantity: 100,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    // Close position
    harness.removePosition('WIPRO');

    const { snapshot, events } = await harness.runPositionCycle();
    expect(snapshot.presenceState).toBe('NO_POSITION');

    const closeEvent = events.find(e => e.type === 'POSITION_CLOSED' && e.symbol === 'WIPRO');
    expect(closeEvent).toBeDefined();
    expect(closeEvent?.previousPosition?.quantity).toBe(100);
    expect(closeEvent?.currentPosition).toBeNull();
  });

  // =========================================================================
  // TEST J: POST-CLOSE NEWS
  // =========================================================================
  it('TEST J: News arriving after position closure does NOT generate an alert', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_WIPRO_EQUITY_SPOT_0_NA',
          symbol: 'WIPRO',
          assetClass: 'EQUITY',
          quantity: 100,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    // Position is closed
    harness.removePosition('WIPRO');
    await harness.runPositionCycle();

    // News arrives for WIPRO
    const postCloseNews: PositionNewsEventInput = {
      id: 'NEWS_WIPRO_POST_001',
      headline: 'Wipro Announces Acquisition of Cloud Consultancy Firm',
      source: 'Economic Times',
      publisher: 'Economic Times',
      symbols: ['WIPRO']
    };

    const candidate = await harness.evaluateNewsEvent(postCloseNews);
    expect(candidate).toBeNull();
  });

  // =========================================================================
  // TEST K: MULTIPLE POSITIONS
  // =========================================================================
  it('TEST K: In multi-position portfolio (RELIANCE, INFY, TCS), event for INFY targets only INFY', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
          symbol: 'RELIANCE',
          assetClass: 'EQUITY',
          quantity: 10,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        },
        {
          positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
          symbol: 'INFY',
          assetClass: 'EQUITY',
          quantity: 5,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        },
        {
          positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
          symbol: 'TCS',
          assetClass: 'EQUITY',
          quantity: 15,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    const infyEvent: PositionNewsEventInput = {
      id: 'NEWS_INFY_TARGET_001',
      headline: 'Infosys Signs $1.5 Billion Strategic Digital Transformation Agreement',
      source: 'Mint',
      publisher: 'Mint',
      symbols: ['INFY']
    };

    const candidate = await harness.evaluateNewsEvent(infyEvent);

    expect(candidate).not.toBeNull();
    expect(candidate?.symbol).toBe('INFY');
    expect(candidate?.positionId).toBe('POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA');

    // Verify zero alerts generated for RELIANCE or TCS from this event
    const allAlerts = harness.getGeneratedAlerts();
    expect(allAlerts.some(a => a.provenance.eventId === 'NEWS_INFY_TARGET_001' && a.symbol !== 'INFY')).toBe(false);
  });

  // =========================================================================
  // TEST L: RESTART / DELIVERY PERSISTENCE
  // =========================================================================
  it('TEST L: Process restart reloads delivery store and suppresses previously sent alert', async () => {
    const tempStorePath = path.join(os.tmpdir(), `athena_lifecycle_restart_${Date.now()}.json`);

    try {
      // Step 1: Initial session
      const harness1 = new PositionAlertSimulationHarness({
        initialPositions: [
          {
            positionId: 'POS_CSV_NSE_HDFCBANK_EQUITY_SPOT_0_NA',
            symbol: 'HDFCBANK',
            assetClass: 'EQUITY',
            quantity: 40,
            source: 'CSV',
            observedAt: '2026-09-24T10:00:00.000Z'
          }
        ],
        storePath: tempStorePath
      });
      await harness1.runPositionCycle();

      const event: PositionNewsEventInput = {
        id: 'NEWS_HDFC_001',
        headline: 'HDFC Bank Declares Final Dividend for FY26',
        source: 'Reuters',
        publisher: 'Reuters',
        symbols: ['HDFCBANK']
      };

      const candidate1 = await harness1.evaluateNewsEvent(event);
      expect(candidate1).not.toBeNull();
      expect(harness1.getDeliveryStatus(candidate1!.dedupeKey)).toBe('SENT');

      // Step 2: Restart into a fresh instance referencing the same delivery storage
      const harness2 = await harness1.restart();
      await harness2.runPositionCycle();

      // Check delivery record reloaded
      expect(harness2.getDeliveryStatus(candidate1!.dedupeKey)).toBe('SENT');

      // Re-evaluating same event on restarted harness
      const candidate2 = await harness2.evaluateNewsEvent(event);
      expect(candidate2).toBeNull(); // Exactly suppressed
    } finally {
      if (fs.existsSync(tempStorePath)) {
        fs.unlinkSync(tempStorePath);
      }
    }
  });

  // =========================================================================
  // TEST M: RETRYABLE DELIVERY
  // =========================================================================
  it('TEST M: Retryable delivery failure records FAILED_RETRYABLE state without fake SENT', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 503,
      headers: new Headers()
    }));

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'TEST_TOKEN',
      chatId: '123456',
      maxRetries: 2,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const candidate = {
      alertId: 'ALT_RETRY_001',
      positionId: 'POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA',
      symbol: 'SBIN',
      alertType: 'RESULTS_EVENT' as const,
      severity: 'WARNING' as const,
      reason: 'SBI Q2 Results',
      timestamp: new Date().toISOString(),
      provenance: { source: 'Reuters', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::pos_rel::POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA::NEWS_SBI_001::RESULTS_EVENT::WARNING'
    };

    const res = await notifier.notify(candidate);
    expect(res).toBe(false);
    expect(notifier.getDeliveryStatus(candidate.dedupeKey)).toBe('FAILED_RETRYABLE');
    expect(notifier.getDeliveryStore().isDelivered(candidate.dedupeKey)).toBe(false);
  });

  // =========================================================================
  // TEST N: PERMANENT DELIVERY FAILURE
  // =========================================================================
  it('TEST N: Permanent delivery failure records FAILED_PERMANENT and halts retries', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 401,
      headers: new Headers()
    }));

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: 'BAD_TOKEN',
      chatId: '123456',
      maxRetries: 5,
      initialBackoffMs: 5,
      fetchImpl: mockFetch as any
    });

    const candidate = {
      alertId: 'ALT_PERM_001',
      positionId: 'POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA',
      symbol: 'SBIN',
      alertType: 'RESULTS_EVENT' as const,
      severity: 'WARNING' as const,
      reason: 'SBI Q2 Results',
      timestamp: new Date().toISOString(),
      provenance: { source: 'Reuters', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::pos_rel::POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA::NEWS_SBI_PERM::RESULTS_EVENT::WARNING'
    };

    const res = await notifier.notify(candidate);
    expect(res).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Fails fast on 401
    expect(notifier.getDeliveryStatus(candidate.dedupeKey)).toBe('FAILED_PERMANENT');
    expect(notifier.getDeliveryStore().isPermanentlyFailed(candidate.dedupeKey)).toBe(true);
  });

  // =========================================================================
  // TEST O: TELEGRAM DISABLED
  // =========================================================================
  it('TEST O: Disabled position alert setting produces DISABLED status and zero network calls', async () => {
    const mockFetch = vi.fn();

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: false,
      botToken: 'TOKEN',
      chatId: '12345',
      fetchImpl: mockFetch as any
    });

    const candidate = {
      alertId: 'ALT_DIS_001',
      positionId: 'POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA',
      symbol: 'SBIN',
      alertType: 'RESULTS_EVENT' as const,
      severity: 'WARNING' as const,
      reason: 'SBI Q2 Results',
      timestamp: new Date().toISOString(),
      provenance: { source: 'Reuters', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::pos_rel::POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA::NEWS_SBI_DIS::RESULTS_EVENT::WARNING'
    };

    const result = await notifier.notify(candidate);
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // =========================================================================
  // TEST P: TELEGRAM CONFIG MISSING
  // =========================================================================
  it('TEST P: Enabled setting with missing credentials fails closed safely without leaking secrets', async () => {
    const mockFetch = vi.fn();

    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: '',
      chatId: '',
      fetchImpl: mockFetch as any
    });

    const candidate = {
      alertId: 'ALT_CFG_001',
      positionId: 'POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA',
      symbol: 'SBIN',
      alertType: 'RESULTS_EVENT' as const,
      severity: 'WARNING' as const,
      reason: 'SBI Q2 Results',
      timestamp: new Date().toISOString(),
      provenance: { source: 'Reuters', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::pos_rel::POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA::NEWS_SBI_CFG::RESULTS_EVENT::WARNING'
    };

    const result = await notifier.notify(candidate);
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(notifier.getDeliveryStatus(candidate.dedupeKey)).toBe('FAILED_PERMANENT');
  });

  // =========================================================================
  // TEST Q: GENERIC MARKET / F&O EVENT
  // =========================================================================
  it('TEST Q: Generic macro market or F&O events without structured holding match produce NO_POSITION_IMPACT', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
          symbol: 'RELIANCE',
          assetClass: 'EQUITY',
          quantity: 10,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });
    await harness.runPositionCycle();

    const genericMarketEvent: PositionNewsEventInput = {
      id: 'NEWS_GENERIC_MACRO_001',
      headline: 'NIFTY 50 rallies 300 points as FIIs turn net buyers in Indian equities',
      source: 'Moneycontrol',
      publisher: 'Moneycontrol',
      symbols: ['NIFTY', 'BANKNIFTY'],
      category: 'Market'
    };

    const candidate = await harness.evaluateNewsEvent(genericMarketEvent);
    expect(candidate).toBeNull();
  });

  // =========================================================================
  // TEST R: REPEATED MONITORING CYCLES
  // =========================================================================
  it('TEST R: Repeated monitoring cycles with unchanged position state are idempotent and emit zero duplicate alerts', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_ITC_EQUITY_SPOT_0_NA',
          symbol: 'ITC',
          assetClass: 'EQUITY',
          quantity: 100,
          averagePrice: 420,
          currentPrice: 430,
          source: 'CSV',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });

    const cycle1 = await harness.runPositionCycle();
    expect(cycle1.alerts.length).toBe(1); // Initial appearance

    // Cycle 2: Same state
    const cycle2 = await harness.runPositionCycle();
    expect(cycle2.alerts.length).toBe(0); // 0 new alerts

    // Cycle 3: Same state
    const cycle3 = await harness.runPositionCycle();
    expect(cycle3.alerts.length).toBe(0); // 0 new alerts

    // Cycle 4: Same state
    const cycle4 = await harness.runPositionCycle();
    expect(cycle4.alerts.length).toBe(0); // 0 new alerts
  });

  // =========================================================================
  // TEST S: PRODUCTION DATA INTEGRITY
  // =========================================================================
  it('TEST S: End-to-End simulation executes with zero modifications to protected data stores', () => {
    for (const f of protectedFiles) {
      const content = getFileContent(f);
      expect(content).toBe(initialFileContents[f]);
    }
  });

  // =========================================================================
  // TEST T: READ-ONLY SAFETY CHECK
  // =========================================================================
  it('TEST T: Read-only safety verification across harness and simulated components', () => {
    const harness = new PositionAlertSimulationHarness();
    const source = new SimulatedPositionSource();

    expect((harness as any).placeOrder).toBeUndefined();
    expect((harness as any).buy).toBeUndefined();
    expect((harness as any).sell).toBeUndefined();
    expect((harness as any).modifyOrder).toBeUndefined();
    expect((harness as any).cancelOrder).toBeUndefined();

    expect((source as any).placeOrder).toBeUndefined();
    expect((source as any).buy).toBeUndefined();
    expect((source as any).sell).toBeUndefined();
  });
});
