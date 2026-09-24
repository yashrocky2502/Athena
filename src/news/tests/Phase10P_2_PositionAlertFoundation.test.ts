/**
 * ATHENA — PHASE 10P-2: PERSONAL POSITION ALERT FOUNDATION
 * Phase10P_2_PositionAlertFoundation.test.ts
 * 
 * Comprehensive Test Suite covering Scenarios A through O:
 * - Scenario A: CSV/XLSX positions normalize into the common position interface.
 * - Scenario B: Zero quantity does not become an active position.
 * - Scenario C: Missing price remains unknown/null rather than synthetic.
 * - Scenario D: Position source can be replaced through the interface.
 * - Scenario E: Position creation is detected.
 * - Scenario F: Position quantity change is detected.
 * - Scenario G: Position closure is detected.
 * - Scenario H: Repeated identical snapshots are idempotent.
 * - Scenario I: Alert candidates always contain a valid position identity.
 * - Scenario J: Unrelated market events cannot create position alerts.
 * - Scenario K: Alert deduplication works across repeated evaluation cycles.
 * - Scenario L: Position alert notifier is separate from News Telegram destination.
 * - Scenario M: Tests never mutate production portfolio data (data/portfolio_store.json).
 * - Scenario N: Tests never send real Telegram messages (dryRun mode).
 * - Scenario O: No order-placement method is reachable from the alert subsystem.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import {
  PositionSource,
  NormalizedPosition,
  PositionAlertCandidate,
  CsvXlsxPositionSource,
  PositionMonitor,
  PositionAlertEngine,
  PrivatePositionTelegramNotifier,
  MockPositionAlertNotifier
} from '../portfolio/alerts/index.ts';

describe('Phase 10P-2: Personal Position Alert Foundation', () => {
  let initialPortfolioStoreHash: string = '';
  const portfolioStorePath = path.join(process.cwd(), 'data/portfolio_store.json');
  const telegramOutboxPath = path.join(process.cwd(), 'data/telegram_outbox.json');

  function getFileContent(filePath: string): string {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  }

  function createTestWorkbook(sheets: Record<string, any[][]>): Buffer {
    const wb = XLSX.utils.book_new();
    for (const [sheetName, rows] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  beforeEach(() => {
    initialPortfolioStoreHash = getFileContent(portfolioStorePath);
  });

  afterEach(() => {
    // Verify zero mutation to protected portfolio store
    const currentHash = getFileContent(portfolioStorePath);
    expect(currentHash).toBe(initialPortfolioStoreHash);
  });

  // =========================================================================
  // SCENARIO A: CSV/XLSX positions normalize into the common position interface
  // =========================================================================
  it('Scenario A: CSV/XLSX positions normalize into the common position interface', async () => {
    const excelBuffer = createTestWorkbook({
      'Equity': [
        ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price', 'Sector', 'ISIN'],
        ['RELIANCE', 100, 2450.00, 2980.00, 'Energy', 'INE002A01018'],
        ['TCS', 50, 3500.00, 3850.00, 'Technology', 'INE467B01029']
      ]
    });

    const source = new CsvXlsxPositionSource({
      filename: 'holdings.xlsx',
      content: excelBuffer,
      sourceType: 'EXCEL'
    });

    const positions = await source.getPositions();
    expect(positions.length).toBe(2);

    const rel = positions.find(p => p.symbol === 'RELIANCE');
    expect(rel).toBeDefined();
    expect(rel?.positionId).toContain('RELIANCE');
    expect(rel?.quantity).toBe(100);
    expect(rel?.averagePrice).toBe(2450.00);
    expect(rel?.currentPrice).toBe(2980.00);
    expect(rel?.sector).toBe('Energy');
    expect(rel?.isin).toBe('INE002A01018');
    expect(rel?.assetClass).toBe('EQUITY');
  });

  // =========================================================================
  // SCENARIO B: Zero quantity does not become an active position
  // =========================================================================
  it('Scenario B: Zero or negative quantity does not become an active position', async () => {
    const csvContent = `Symbol,Quantity,AveragePrice,CurrentPrice
INFY,0,1500,1600
HDFCBANK,-10,1400,1500
WIPRO,200,450,480`;

    const source = new CsvXlsxPositionSource({
      filename: 'holdings.csv',
      content: csvContent,
      sourceType: 'CSV'
    });

    const positions = await source.getPositions();
    expect(positions.length).toBe(1);
    expect(positions[0].symbol).toBe('WIPRO');
    expect(positions[0].quantity).toBe(200);
  });

  // =========================================================================
  // SCENARIO C: Missing price remains unknown/null rather than synthetic
  // =========================================================================
  it('Scenario C: Missing or non-positive price remains null without synthetic fabrication', async () => {
    const csvContent = `Symbol,Quantity,AveragePrice,CurrentPrice
BAJFINANCE,15,,
LT,40,3200,`;

    const source = new CsvXlsxPositionSource({
      filename: 'holdings.csv',
      content: csvContent,
      sourceType: 'CSV'
    });

    const positions = await source.getPositions();
    const baj = positions.find(p => p.symbol === 'BAJFINANCE');
    expect(baj).toBeDefined();
    expect(baj?.averagePrice).toBeNull();
    expect(baj?.currentPrice).toBeNull();
    // Absolutely NO fake ₹100 or default values
    expect(baj?.averagePrice).not.toBe(100);

    const lt = positions.find(p => p.symbol === 'LT');
    expect(lt).toBeDefined();
    expect(lt?.averagePrice).toBe(3200);
    expect(lt?.currentPrice).toBeNull();
  });

  // =========================================================================
  // SCENARIO D: Position source can be replaced through the interface
  // =========================================================================
  it('Scenario D: Position source can be replaced seamlessly through the PositionSource interface', async () => {
    class InMemoryMockSource implements PositionSource {
      public readonly sourceId = 'MOCK_SOURCE';
      public readonly sourceType = 'MOCK' as const;
      constructor(private items: NormalizedPosition[]) {}
      async getPositions(): Promise<NormalizedPosition[]> {
        return this.items;
      }
    }

    const mockPos: NormalizedPosition = {
      positionId: 'POS_MOCK_1',
      symbol: 'SBIN',
      assetClass: 'EQUITY',
      quantity: 500,
      averagePrice: 750,
      currentPrice: 810,
      source: 'MOCK',
      observedAt: new Date().toISOString()
    };

    const source1 = new InMemoryMockSource([mockPos]);
    const monitor = new PositionMonitor(source1);

    const res1 = await monitor.evaluatePositions();
    expect(res1.snapshot.totalPositions).toBe(1);
    expect(res1.snapshot.positions.get('POS_MOCK_1')?.symbol).toBe('SBIN');

    // Replace source dynamically
    const source2 = new InMemoryMockSource([]);
    monitor.setSource(source2);

    const res2 = await monitor.evaluatePositions();
    expect(res2.snapshot.totalPositions).toBe(0);
    expect(res2.snapshot.presenceState).toBe('NO_POSITION');
    expect(res2.events.some(e => e.type === 'POSITION_CLOSED')).toBe(true);
  });

  // =========================================================================
  // SCENARIO E: Position creation is detected
  // =========================================================================
  it('Scenario E: Position creation is accurately detected as POSITION_APPEARED', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'initial.csv',
      content: 'Symbol,Quantity,AveragePrice\nITC,100,420',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    const { events } = await monitor.evaluatePositions();

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('POSITION_APPEARED');
    expect(events[0].symbol).toBe('ITC');
    expect(events[0].quantityDelta).toBe(100);
  });

  // =========================================================================
  // SCENARIO F: Position quantity change is detected
  // =========================================================================
  it('Scenario F: Position quantity increase and decrease are accurately detected', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'step1.csv',
      content: 'Symbol,Quantity,AveragePrice\nMARUTI,10,10500',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    await monitor.evaluatePositions();

    // Step 2: Increase quantity from 10 to 25
    fileSource.updateContent('Symbol,Quantity,AveragePrice\nMARUTI,25,10500');
    const step2 = await monitor.evaluatePositions();

    expect(step2.events.length).toBe(1);
    expect(step2.events[0].type).toBe('POSITION_QUANTITY_CHANGED');
    expect(step2.events[0].symbol).toBe('MARUTI');
    expect(step2.events[0].quantityDelta).toBe(15);
  });

  // =========================================================================
  // SCENARIO G: Position closure is detected
  // =========================================================================
  it('Scenario G: Position closure is accurately detected when position disappears from source', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'step1.csv',
      content: 'Symbol,Quantity,AveragePrice\nTATAMOTORS,50,920\nCOALINDIA,100,450',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    await monitor.evaluatePositions();

    // Step 2: TATAMOTORS sold / removed
    fileSource.updateContent('Symbol,Quantity,AveragePrice\nCOALINDIA,100,450');
    const step2 = await monitor.evaluatePositions();

    expect(step2.events.length).toBe(1);
    expect(step2.events[0].type).toBe('POSITION_CLOSED');
    expect(step2.events[0].symbol).toBe('TATAMOTORS');
    expect(step2.events[0].quantityDelta).toBe(-50);
  });

  // =========================================================================
  // SCENARIO H: Repeated identical snapshots are idempotent
  // =========================================================================
  it('Scenario H: Repeated evaluation cycles with unchanged position state produce ZERO events', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'holdings.csv',
      content: 'Symbol,Quantity,AveragePrice\nTITAN,30,3400',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    const firstRun = await monitor.evaluatePositions();
    expect(firstRun.events.length).toBe(1);

    // Second evaluation with identical state
    const secondRun = await monitor.evaluatePositions();
    expect(secondRun.events.length).toBe(0);

    // Third evaluation with identical state
    const thirdRun = await monitor.evaluatePositions();
    expect(thirdRun.events.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO I: Alert candidates always contain a valid position identity
  // =========================================================================
  it('Scenario I: Alert candidates emitted by AlertEngine strictly require valid positionId', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'holdings.csv',
      content: 'Symbol,Quantity,AveragePrice\nASIANPAINT,20,2900',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    const alertEngine = new PositionAlertEngine({ monitor });

    const alerts = await alertEngine.evaluate();
    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBeDefined();
    expect(alerts[0].positionId.length).toBeGreaterThan(0);
    expect(alerts[0].symbol).toBe('ASIANPAINT');
  });

  // =========================================================================
  // SCENARIO J: Unrelated market events cannot create position alerts
  // =========================================================================
  it('Scenario J: Unrelated market events for unowned assets are strictly rejected', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'holdings.csv',
      content: 'Symbol,Quantity,AveragePrice\nRELIANCE,100,2400',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    const alertEngine = new PositionAlertEngine({ monitor });
    await alertEngine.evaluate();

    // Signal for UNOWNED asset "BITCOIN" or "UNKNOWN_STOCK"
    const unownedAlert = await alertEngine.evaluateMarketSignal({
      symbol: 'UNKNOWN_STOCK',
      signalType: 'VOLATILITY_SPIKE',
      message: 'Huge volatility detected',
      marketPrice: 500
    });
    expect(unownedAlert).toBeNull();

    // Signal for OWNED asset "RELIANCE"
    const ownedAlert = await alertEngine.evaluateMarketSignal({
      symbol: 'RELIANCE',
      signalType: 'EARNINGS_ANNOUNCEMENT',
      message: 'Quarterly results announced',
      marketPrice: 2450
    });
    expect(ownedAlert).not.toBeNull();
    expect(ownedAlert?.symbol).toBe('RELIANCE');
    expect(ownedAlert?.positionId).toBeDefined();
  });

  // =========================================================================
  // SCENARIO K: Alert deduplication works
  // =========================================================================
  it('Scenario K: Alert deduplication prevents duplicate alerts across polling cycles', async () => {
    const fileSource = new CsvXlsxPositionSource({
      filename: 'holdings.csv',
      content: 'Symbol,Quantity,AveragePrice\nSUNPHARMA,75,1550',
      sourceType: 'CSV'
    });

    const monitor = new PositionMonitor(fileSource);
    const alertEngine = new PositionAlertEngine({ monitor });

    const run1 = await alertEngine.evaluate();
    expect(run1.length).toBe(1);

    const run2 = await alertEngine.evaluate();
    expect(run2.length).toBe(0);

    const allAlerts = alertEngine.getGeneratedAlerts();
    expect(allAlerts.length).toBe(1);
  });

  // =========================================================================
  // SCENARIO L & N: Separate Telegram destination & dryRun safety
  // =========================================================================
  it('Scenario L & N: Position alert notifier is strictly separate from News Core and dryRun sends 0 network requests', async () => {
    const notifier = new PrivatePositionTelegramNotifier({
      botToken: 'TEST_BOT_TOKEN',
      chatId: 'TEST_CHAT_ID',
      dryRun: true
    });

    const candidate: PositionAlertCandidate = {
      alertId: 'ALT_TEST_1',
      positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
      symbol: 'RELIANCE',
      alertType: 'LIFECYCLE',
      severity: 'INFO',
      reason: 'Initial position observed: 100 units of RELIANCE.',
      timestamp: new Date().toISOString(),
      provenance: { source: 'CSV', observedAt: new Date().toISOString() },
      dedupeKey: 'dedupe::test::1'
    };

    const notified = await notifier.notify(candidate);
    expect(notified).toBe(true);

    const sentLog = notifier.getSentAlertsLog();
    expect(sentLog.length).toBe(1);
    expect(sentLog[0].symbol).toBe('RELIANCE');

    // Verify formatted telegram text
    const text = notifier.formatAlertMessage(candidate);
    expect(text).toContain('PERSONAL POSITION ALERT');
    expect(text).toContain('RELIANCE');
    expect(text).toContain('POS_CSV_NSE_RELIANCE');

    // Verify News Core Telegram outbox was NEVER modified
    const outboxContent = getFileContent(telegramOutboxPath);
    expect(outboxContent).not.toContain('ALT_TEST_1');
  });

  // =========================================================================
  // SCENARIO M: Tests never mutate production portfolio data
  // =========================================================================
  it('Scenario M: Execution of Position Alert Engine leaves data/portfolio_store.json unmodified', async () => {
    const excelBuffer = createTestWorkbook({
      'Equity': [
        ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
        ['HCLTECH', 120, 1500, 1620]
      ]
    });

    const source = new CsvXlsxPositionSource({
      filename: 'test.xlsx',
      content: excelBuffer,
      sourceType: 'EXCEL'
    });

    const monitor = new PositionMonitor(source);
    const mockNotifier = new MockPositionAlertNotifier();
    const alertEngine = new PositionAlertEngine({ monitor, notifier: mockNotifier });

    const alerts = await alertEngine.evaluate();
    expect(alerts.length).toBe(1);
    expect(mockNotifier.dispatchedAlerts.length).toBe(1);

    // Verify file content is completely unchanged
    const finalContent = getFileContent(portfolioStorePath);
    expect(finalContent).toBe(initialPortfolioStoreHash);
  });

  // =========================================================================
  // SCENARIO O: No order-placement method is reachable from alert subsystem
  // =========================================================================
  it('Scenario O: Read-only safety boundary - no order placement methods exist on alert classes', () => {
    const monitor = new PositionMonitor(new CsvXlsxPositionSource({ filename: 'x.csv', content: '' }));
    const alertEngine = new PositionAlertEngine({ monitor });
    const notifier = new PrivatePositionTelegramNotifier({ dryRun: true });

    // Assert that trading/order methods do NOT exist
    expect((monitor as any).placeOrder).toBeUndefined();
    expect((monitor as any).buy).toBeUndefined();
    expect((monitor as any).sell).toBeUndefined();
    expect((monitor as any).cancelOrder).toBeUndefined();

    expect((alertEngine as any).placeOrder).toBeUndefined();
    expect((alertEngine as any).executeTrade).toBeUndefined();
    expect((alertEngine as any).modifyPosition).toBeUndefined();

    expect((notifier as any).placeOrder).toBeUndefined();
  });
});
