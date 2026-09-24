/**
 * ATHENA — PHASE 10P-3: PERSONAL POSITION ALERT INTELLIGENCE
 * Phase10P_3_PositionRelevance.test.ts
 * 
 * Comprehensive Test Suite covering Scenarios A through Q:
 * - Scenario A: Held stock + matching company event → alert.
 * - Scenario B: Unheld stock + same event → no alert.
 * - Scenario C: Exact ISIN match → alert.
 * - Scenario D: Exact symbol/exchange match → alert.
 * - Scenario E: Ambiguous/fuzzy company match → no alert.
 * - Scenario F: Generic NIFTY/Sensex event → no position alert.
 * - Scenario G: Unrelated company event → no alert.
 * - Scenario H: Missing/invalid provenance → no alert.
 * - Scenario I: Synthetic/test event → no alert.
 * - Scenario J: Closed position → no alert.
 * - Scenario K: Duplicate event → one alert only.
 * - Scenario L: Different event IDs → separate alerts.
 * - Scenario M: Correct positionId is attached to every emitted alert.
 * - Scenario N: Severity follows deterministic event rules.
 * - Scenario O: No Telegram network call during tests (dry-run mode).
 * - Scenario P: No production data mutation (100% byte-identical data/ files).
 * - Scenario Q: No trading/order method is invoked (read-only safety).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  NormalizedPosition,
  PositionNewsEventInput,
  PositionRelevanceEngine,
  PositionAlertEngine,
  PositionMonitor,
  PositionSource,
  PrivatePositionTelegramNotifier,
  MockPositionAlertNotifier
} from '../portfolio/alerts/index.ts';

describe('Phase 10P-3: Personal Position Alert Intelligence', () => {
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
    // Verify zero data mutation on all protected stores
    for (const f of protectedFiles) {
      const current = getFileContent(f);
      expect(current).toBe(initialFileContents[f]);
    }
  });

  const samplePositions: NormalizedPosition[] = [
    {
      positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      assetClass: 'EQUITY',
      quantity: 100,
      averagePrice: 2450.00,
      currentPrice: 2980.00,
      isin: 'INE002A01018',
      sector: 'Energy',
      source: 'CSV',
      observedAt: '2026-09-24T00:00:00.000Z'
    },
    {
      positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
      symbol: 'TCS',
      exchange: 'NSE',
      assetClass: 'EQUITY',
      quantity: 50,
      averagePrice: 3500.00,
      currentPrice: 3900.00,
      isin: 'INE467B01029',
      sector: 'Technology',
      source: 'CSV',
      observedAt: '2026-09-24T00:00:00.000Z'
    }
  ];

  class StaticMockPositionSource implements PositionSource {
    public readonly sourceId = 'STATIC_MOCK';
    public readonly sourceType = 'MOCK' as const;
    constructor(private items: NormalizedPosition[]) {}
    async getPositions(): Promise<NormalizedPosition[]> {
      return this.items;
    }
    public setPositions(items: NormalizedPosition[]) {
      this.items = items;
    }
  }

  // =========================================================================
  // SCENARIO A: Held stock + matching company event → alert
  // =========================================================================
  it('Scenario A: Held stock with matching material company event triggers a position alert', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_Q2_001',
      headline: 'Reliance Industries Reports 15% Jump in Q2 Net Profit, EBITDA Surges',
      source: 'Reuters',
      publisher: 'Reuters',
      category: 'Results',
      symbols: ['RELIANCE'],
      publishedAt: '2026-09-24T08:00:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);

    expect(result.decision).toBe('POSITION_IMPACT');
    expect(result.positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
    expect(result.symbol).toBe('RELIANCE');
    expect(result.impactType).toBe('RESULTS_EVENT');
    expect(result.severity).toBe('WARNING');
    expect(result.candidate).toBeDefined();
    expect(result.candidate?.positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
  });

  // =========================================================================
  // SCENARIO B: Unheld stock + same event → no alert
  // =========================================================================
  it('Scenario B: Unheld stock event produces NO_POSITION_IMPACT and NO alert', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_INFY_001',
      headline: 'Infosys Reports 12% Rise in Q2 Net Profit, Raises Revenue Guidance',
      source: 'Bloomberg',
      publisher: 'Bloomberg',
      category: 'Results',
      symbols: ['INFY'],
      publishedAt: '2026-09-24T08:00:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);

    expect(result.decision).toBe('NO_POSITION_IMPACT');
    expect(result.candidate).toBeUndefined();
    expect(result.rejectionReason).toBe('NO_MATCHING_ACTIVE_POSITION');
  });

  // =========================================================================
  // SCENARIO C: Exact ISIN match → alert
  // =========================================================================
  it('Scenario C: Event matching by exact ISIN triggers alert for the held position', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_ISIN_001',
      headline: 'Corporate Action Notice Issued for ISIN INE467B01029: Dividend of Rs 28/Share',
      source: 'BSE India',
      publisher: 'BSE',
      category: 'Corporate',
      isin: 'INE467B01029',
      publishedAt: '2026-09-24T09:00:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);

    expect(result.decision).toBe('POSITION_IMPACT');
    expect(result.positionId).toBe('POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA');
    expect(result.symbol).toBe('TCS');
    expect(result.impactType).toBe('CORPORATE_ACTION');
    expect(result.severity).toBe('WARNING');
  });

  // =========================================================================
  // SCENARIO D: Exact symbol/exchange match → alert
  // =========================================================================
  it('Scenario D: Exact exchange and symbol match triggers alert', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_EX_SYM_001',
      headline: 'TCS Bags $1 Billion Strategic Transformation Deal from European Bank',
      source: 'LiveMint',
      publisher: 'LiveMint',
      exchange: 'NSE',
      symbols: ['TCS'],
      publishedAt: '2026-09-24T09:30:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);

    expect(result.decision).toBe('POSITION_IMPACT');
    expect(result.positionId).toBe('POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA');
    expect(result.symbol).toBe('TCS');
    expect(result.impactType).toBe('MATERIAL_COMPANY_EVENT');
  });

  // =========================================================================
  // SCENARIO D2: Exact structured entity identifier match → alert
  // =========================================================================
  it('Scenario D2: Exact structured entity identifier (e.g. NSE:RELIANCE or RELIANCE) triggers alert', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_ENT_001',
      headline: 'Reliance Signs Strategic Agreement with Green Hydrogen Partner',
      source: 'PTI',
      publisher: 'PTI',
      category: 'Corporate',
      entities: ['NSE:RELIANCE'],
      publishedAt: '2026-09-24T09:45:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);

    expect(result.decision).toBe('POSITION_IMPACT');
    expect(result.positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
    expect(result.symbol).toBe('RELIANCE');
  });

  // =========================================================================
  // SCENARIO E: Ambiguous/fuzzy company match → no alert
  // =========================================================================
  it('Scenario E: Ambiguous, partial, or fuzzy name match is strictly rejected', () => {
    const engine = new PositionRelevanceEngine();

    // "RELIANT" or "TCS TECHNOLOGIES UK" without exact ticker
    const event: PositionNewsEventInput = {
      id: 'NEWS_FUZZY_001',
      headline: 'Reliant Energy Signs Solar Deal in North America',
      source: 'GlobalPowerNews',
      publisher: 'GlobalPowerNews',
      entities: ['RELIANT'],
      symbols: ['RELIANT'],
      publishedAt: '2026-09-24T10:00:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);
    expect(result.decision).toBe('NO_POSITION_IMPACT');
    expect(result.candidate).toBeUndefined();
  });

  // =========================================================================
  // SCENARIO E2: Headline-only mention without structured identifiers → NO_POSITION_IMPACT
  // =========================================================================
  it('Scenario E2: Headline-only symbol mention with NO structured symbol/ISIN/entity match produces NO_POSITION_IMPACT', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_COMMENTARY_001',
      headline: 'Reliance mentioned in broader market commentary regarding oil & gas sector',
      source: 'Reuters',
      publisher: 'Reuters',
      symbols: [],
      entities: [],
      publishedAt: '2026-09-24T10:15:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);
    expect(result.decision).toBe('NO_POSITION_IMPACT');
    expect(result.candidate).toBeUndefined();
    expect(result.rejectionReason).toBe('NO_MATCHING_ACTIVE_POSITION');
  });

  // =========================================================================
  // SCENARIO F: Generic NIFTY/Sensex event → no position alert
  // =========================================================================
  it('Scenario F: Generic macro index events (NIFTY/Sensex) do not trigger position alerts', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_MACRO_001',
      headline: 'NIFTY 50 Rallies 1.2% Past 25,000 Amid Strong Global Cues, Sensex up 800 pts',
      source: 'CNBC-TV18',
      publisher: 'CNBC-TV18',
      category: 'Market',
      symbols: ['NIFTY'],
      publishedAt: '2026-09-24T10:30:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);

    expect(result.decision).toBe('NO_POSITION_IMPACT');
    expect(result.rejectionReason).toBe('GENERIC_MACRO_BENCHMARK_EVENT');
  });

  // =========================================================================
  // SCENARIO G: Unrelated company event → no alert
  // =========================================================================
  it('Scenario G: Material event for completely unowned company produces zero position impact', () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_ZOMATO_001',
      headline: 'Zomato Acquires Paytm Movie and Events Ticketing Business for Rs 2,048 Crore',
      source: 'Economic Times',
      publisher: 'Economic Times',
      category: 'M&A',
      symbols: ['ZOMATO'],
      publishedAt: '2026-09-24T11:00:00.000Z'
    };

    const result = engine.evaluateEvent(event, samplePositions);
    expect(result.decision).toBe('NO_POSITION_IMPACT');
    expect(result.candidate).toBeUndefined();
  });

  // =========================================================================
  // SCENARIO H: Missing/invalid provenance → no alert (fail-closed)
  // =========================================================================
  it('Scenario H: Events missing source/publisher or headline fail-closed with zero alert', () => {
    const engine = new PositionRelevanceEngine();

    const eventWithoutSource: PositionNewsEventInput = {
      id: 'NEWS_NO_SRC_001',
      headline: 'Reliance Announces Bonus Issue 1:1',
      source: '',
      publisher: '',
      symbols: ['RELIANCE']
    };

    const res1 = engine.evaluateEvent(eventWithoutSource, samplePositions);
    expect(res1.decision).toBe('NO_POSITION_IMPACT');
    expect(res1.rejectionReason).toBe('MISSING_PROVENANCE_SOURCE');

    const eventWithoutId: PositionNewsEventInput = {
      id: '',
      headline: 'Reliance Announces Bonus Issue 1:1',
      source: 'Reuters',
      symbols: ['RELIANCE']
    };

    const res2 = engine.evaluateEvent(eventWithoutId, samplePositions);
    expect(res2.decision).toBe('NO_POSITION_IMPACT');
    expect(res2.rejectionReason).toBe('INVALID_EVENT_ID');
  });

  // =========================================================================
  // SCENARIO I: Synthetic/test event → no alert
  // =========================================================================
  it('Scenario I: Synthetic or test-flagged events are explicitly rejected', () => {
    const engine = new PositionRelevanceEngine();

    const testEvent: PositionNewsEventInput = {
      id: 'SYNTH_RELIANCE_TEST_001',
      headline: 'Synthetic Test: Reliance Q3 Net Profit surges 500%',
      source: 'TEST_GENERATOR',
      isSynthetic: true,
      symbols: ['RELIANCE']
    };

    const res = engine.evaluateEvent(testEvent, samplePositions);
    expect(res.decision).toBe('NO_POSITION_IMPACT');
    expect(res.rejectionReason).toBe('SYNTHETIC_OR_TEST_EVENT_REJECTED');
  });

  // =========================================================================
  // SCENARIO J: Closed position → no alert
  // =========================================================================
  it('Scenario J: Closed or zero-quantity positions no longer receive position alerts', async () => {
    const mockSource = new StaticMockPositionSource([...samplePositions]);
    const monitor = new PositionMonitor(mockSource);
    const alertEngine = new PositionAlertEngine({ monitor });
    await alertEngine.evaluate(); // initial snapshot with RELIANCE and TCS

    // Close RELIANCE position (only TCS remains)
    mockSource.setPositions([samplePositions[1]]);
    await alertEngine.evaluate(); // monitor updates snapshot

    const relianceEvent: PositionNewsEventInput = {
      id: 'NEWS_REL_LATE_001',
      headline: 'Reliance Board Approves 1:1 Bonus Shares Issue',
      source: 'NSE Corporate',
      publisher: 'NSE',
      category: 'Corporate',
      symbols: ['RELIANCE'],
      publishedAt: '2026-09-24T12:00:00.000Z'
    };

    const alert = await alertEngine.evaluateNewsEvent(relianceEvent);
    expect(alert).toBeNull();
  });

  // =========================================================================
  // SCENARIO K: Duplicate event → one alert only
  // =========================================================================
  it('Scenario K: Duplicate evaluations of the identical news event emit only ONE alert', async () => {
    const mockSource = new StaticMockPositionSource(samplePositions);
    const monitor = new PositionMonitor(mockSource);
    const mockNotifier = new MockPositionAlertNotifier();
    const alertEngine = new PositionAlertEngine({ monitor, notifier: mockNotifier });
    await alertEngine.evaluate();
    mockNotifier.clear(); // Clear initial lifecycle alerts to isolate news event assertions

    const event: PositionNewsEventInput = {
      id: 'NEWS_TCS_DIV_001',
      headline: 'TCS Declares Interim Dividend of Rs 10 per share',
      source: 'BSE',
      publisher: 'BSE',
      category: 'Corporate',
      symbols: ['TCS'],
      publishedAt: '2026-09-24T12:30:00.000Z'
    };

    const firstRun = await alertEngine.evaluateNewsEvent(event);
    expect(firstRun).not.toBeNull();
    expect(mockNotifier.dispatchedAlerts.length).toBe(1);

    // Second evaluation of identical event
    const secondRun = await alertEngine.evaluateNewsEvent(event);
    expect(secondRun).toBeNull();
    expect(mockNotifier.dispatchedAlerts.length).toBe(1);
  });

  // =========================================================================
  // SCENARIO L: Different event IDs → separate alerts
  // =========================================================================
  it('Scenario L: Distinct events for the same held stock emit separate deduplicated alerts', async () => {
    const mockSource = new StaticMockPositionSource(samplePositions);
    const monitor = new PositionMonitor(mockSource);
    const mockNotifier = new MockPositionAlertNotifier();
    const alertEngine = new PositionAlertEngine({ monitor, notifier: mockNotifier });
    await alertEngine.evaluate();
    mockNotifier.clear(); // Clear initial lifecycle alerts to isolate news event assertions

    const event1: PositionNewsEventInput = {
      id: 'EVENT_TCS_001',
      headline: 'TCS Q2 Net Profit Rises 6% YoY',
      source: 'Reuters',
      publisher: 'Reuters',
      category: 'Results',
      symbols: ['TCS']
    };

    const event2: PositionNewsEventInput = {
      id: 'EVENT_TCS_002',
      headline: 'TCS Approves Rs 17,000 Crore Share Buyback at Rs 4,150/share',
      source: 'Bloomberg',
      publisher: 'Bloomberg',
      category: 'Corporate',
      symbols: ['TCS']
    };

    const alert1 = await alertEngine.evaluateNewsEvent(event1);
    const alert2 = await alertEngine.evaluateNewsEvent(event2);

    expect(alert1).not.toBeNull();
    expect(alert2).not.toBeNull();
    expect(mockNotifier.dispatchedAlerts.length).toBe(2);
    expect(mockNotifier.dispatchedAlerts[0].provenance.eventId).toBe('EVENT_TCS_001');
    expect(mockNotifier.dispatchedAlerts[1].provenance.eventId).toBe('EVENT_TCS_002');
  });

  // =========================================================================
  // SCENARIO M: Correct positionId is attached to every emitted alert
  // =========================================================================
  it('Scenario M: Emitted alerts strictly contain the exact normalized positionId of the user holding', async () => {
    const engine = new PositionRelevanceEngine();

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_MD_001',
      headline: 'Reliance AGM: Board Approves Key New Energy Investments',
      source: 'Mint',
      publisher: 'Mint',
      symbols: ['RELIANCE']
    };

    const result = engine.evaluateEvent(event, samplePositions);
    expect(result.decision).toBe('POSITION_IMPACT');
    expect(result.candidate?.positionId).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');
    expect(result.candidate?.symbol).toBe('RELIANCE');
  });

  // =========================================================================
  // SCENARIO N: Severity follows deterministic event rules
  // =========================================================================
  it('Scenario N: Severity follows deterministic rules (CRITICAL for suspensions/defaults, WARNING for results/dividends, INFO for standard)', () => {
    const engine = new PositionRelevanceEngine();

    // Critical: Trading suspension / halt
    const haltEvent: PositionNewsEventInput = {
      id: 'EVT_HALT_001',
      headline: 'Trading Suspended in RELIANCE by Exchange Pending Investigation',
      source: 'Exchange Notice',
      publisher: 'NSE',
      symbols: ['RELIANCE']
    };
    const resHalt = engine.evaluateEvent(haltEvent, samplePositions);
    expect(resHalt.severity).toBe('CRITICAL');
    expect(resHalt.impactType).toBe('REGULATORY_EVENT');

    // Warning: Quarterly Results
    const resEvent: PositionNewsEventInput = {
      id: 'EVT_RES_001',
      headline: 'Reliance Q2 Results: Net Profit Jumps 12%',
      source: 'Reuters',
      publisher: 'Reuters',
      symbols: ['RELIANCE']
    };
    const resResults = engine.evaluateEvent(resEvent, samplePositions);
    expect(resResults.severity).toBe('WARNING');
    expect(resResults.impactType).toBe('RESULTS_EVENT');

    // Info: Standard Company Update
    const infoEvent: PositionNewsEventInput = {
      id: 'EVT_INFO_001',
      headline: 'Reliance Signs MoU with State Government for Solar Infrastructure',
      source: 'PTI',
      publisher: 'PTI',
      symbols: ['RELIANCE']
    };
    const resInfo = engine.evaluateEvent(infoEvent, samplePositions);
    expect(resInfo.severity).toBe('INFO');
    expect(resInfo.impactType).toBe('POSITION_NEWS_EVENT');
  });

  // =========================================================================
  // SCENARIO O: No Telegram network call during tests
  // =========================================================================
  it('Scenario O: Private Position Telegram Notifier operates in dry-run mode without external HTTP requests', async () => {
    const notifier = new PrivatePositionTelegramNotifier({
      botToken: 'DUMMY_TOKEN',
      chatId: 'DUMMY_CHAT',
      dryRun: true
    });

    const engine = new PositionRelevanceEngine();
    const event: PositionNewsEventInput = {
      id: 'EVT_O_001',
      headline: 'TCS Q2 Net Profit Beats Estimates',
      source: 'Reuters',
      publisher: 'Reuters',
      symbols: ['TCS']
    };

    const res = engine.evaluateEvent(event, samplePositions);
    expect(res.candidate).toBeDefined();

    const success = await notifier.notify(res.candidate!);
    expect(success).toBe(true);

    const logs = notifier.getSentAlertsLog();
    expect(logs.length).toBe(1);
    expect(logs[0].positionId).toBe('POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA');
  });

  // =========================================================================
  // SCENARIO P: No production data mutation
  // =========================================================================
  it('Scenario P: Executing batch relevance evaluations causes zero mutations across all protected data files', async () => {
    const mockSource = new StaticMockPositionSource(samplePositions);
    const monitor = new PositionMonitor(mockSource);
    const alertEngine = new PositionAlertEngine({ monitor, notifier: new MockPositionAlertNotifier() });
    await alertEngine.evaluate();

    const batchEvents: PositionNewsEventInput[] = [
      {
        id: 'B1',
        headline: 'Reliance Q2 Revenue Surges 18%',
        source: 'Reuters',
        publisher: 'Reuters',
        symbols: ['RELIANCE']
      },
      {
        id: 'B2',
        headline: 'TCS Wins $500M Cloud Migration Mandate',
        source: 'Bloomberg',
        publisher: 'Bloomberg',
        symbols: ['TCS']
      },
      {
        id: 'B3',
        headline: 'Wipro Appoints New CFO',
        source: 'ET',
        publisher: 'ET',
        symbols: ['WIPRO']
      }
    ];

    const alerts = await alertEngine.evaluateNewsEvents(batchEvents);
    expect(alerts.length).toBe(2); // Only RELIANCE and TCS, WIPRO is unheld

    for (const f of protectedFiles) {
      expect(getFileContent(f)).toBe(initialFileContents[f]);
    }
  });

  // =========================================================================
  // SCENARIO Q: No trading/order method is invoked (read-only safety)
  // =========================================================================
  it('Scenario Q: Read-only safety boundary - zero trading or order placement methods exist on relevance or alert classes', () => {
    const relevanceEngine = new PositionRelevanceEngine();
    const monitor = new PositionMonitor(new StaticMockPositionSource([]));
    const alertEngine = new PositionAlertEngine({ monitor });

    expect((relevanceEngine as any).placeOrder).toBeUndefined();
    expect((relevanceEngine as any).buy).toBeUndefined();
    expect((relevanceEngine as any).sell).toBeUndefined();
    expect((relevanceEngine as any).executeTrade).toBeUndefined();
    expect((relevanceEngine as any).cancelOrder).toBeUndefined();

    expect((alertEngine as any).placeOrder).toBeUndefined();
    expect((alertEngine as any).buy).toBeUndefined();
    expect((alertEngine as any).sell).toBeUndefined();
    expect((alertEngine as any).executeTrade).toBeUndefined();
  });
});
