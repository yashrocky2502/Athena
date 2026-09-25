/**
 * ATHENA — PHASE 10P-9: CONTROLLED REAL-WORLD POSITION ALERT VALIDATION
 * Phase10P_9_RealPortfolioValidation.test.ts
 * 
 * Strict deterministic validation of the full personal position alert pipeline.
 * Supports externally supplied binary broker workbooks via ATHENA_P9_REAL_XLSX_PATH
 * and deterministic sanitized binary XLSX fixtures when running in repository / CI environments.
 * 
 * Guarantees:
 * - Zero personal broker data hardcoded in source code
 * - Zero network calls to Telegram
 * - Zero mutations to data/telegram_outbox.json or protected datasets
 * - Zero trading or order placement methods
 * - Complete fail-closed source health and provenance behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

import {
  CsvXlsxPositionSource,
  PositionMonitor,
  PositionRelevanceEngine,
  PositionAlertEngine,
  PositionAlertIntelligenceEngine,
  PositionAlertDeliveryStore,
  PrivatePositionTelegramNotifier,
  PositionAlertRuntime,
  PositionAlertRuntimeGuard,
  NewsCoreV2PositionAlertAdapter,
  NormalizedPortfolioState,
  NormalizedPosition,
  PositionNewsEventInput,
  PositionAlertCandidate
} from '../portfolio/alerts/index.ts';

import { PortfolioImportEngine } from '../portfolio/broker/PortfolioImportEngine.ts';
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

/**
 * Creates a sanitized, deterministic in-memory binary XLSX workbook.
 * This fixture is explicitly marked as test-only synthetic data.
 * Does NOT contain any user personal broker data.
 */
function createSanitizedTestWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  // Synthetic Equity sheet with pre-header metadata rows mimicking broker console export structure
  const equityRows: any[][] = [];
  for (let i = 1; i <= 22; i++) {
    equityRows.push([`Synthetic Test Broker Statement - Metadata Line ${i}`, '', '', '', '', '', '']);
  }
  // Row 23: Header row
  equityRows.push([
    'Symbol',
    'ISIN',
    'Sector',
    'Quantity Available',
    'Quantity Discrepant',
    'Average Price',
    'Previous Closing Price'
  ]);
  // Row 24+: Clearly synthetic test holdings (explicitly TEST_ prefixed or synthetic symbols)
  equityRows.push(['SYN_ALPHA', 'INTEST000001', 'Technology', 100, 0, 1500.0, 1650.0]);
  equityRows.push(['SYN_BETA', 'INTEST000002', 'Financial Services', 50, 0, 2500.0, 2750.0]);
  equityRows.push(['SYN_GAMMA', 'INTEST000003', 'Energy', 200, 0, 800.0, 880.0]);
  equityRows.push(['SYN_DELTA', 'INTEST000004', 'Healthcare', 75, 0, 1200.0, 1320.0]);

  const equitySheet = XLSX.utils.aoa_to_sheet(equityRows);
  XLSX.utils.book_append_sheet(wb, equitySheet, 'Equity');

  // Mutual Funds sheet (must not be treated as equity)
  const mfRows = [
    ['Scheme Name', 'Folio No', 'Units Available', 'NAV', 'Current Value'],
    ['Test Growth Mutual Fund', '11111/22', 1000, 75.5, 75500],
    ['Test Liquid Fund', '33333/44', 500, 100.0, 50000]
  ];
  const mfSheet = XLSX.utils.aoa_to_sheet(mfRows);
  XLSX.utils.book_append_sheet(wb, mfSheet, 'Mutual Funds');

  // Combined sheet (must not leak into active equity)
  const combinedRows = [
    ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
    ['SYN_ALPHA', 100, 1500.0, 1650.0],
    ['SYN_BETA', 50, 2500.0, 2750.0]
  ];
  const combinedSheet = XLSX.utils.aoa_to_sheet(combinedRows);
  XLSX.utils.book_append_sheet(wb, combinedSheet, 'Combined');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Phase 10P-9: Controlled Real-World Position Alert Validation', () => {
  let baselineChecksums: Map<string, string> = new Map();
  let testStorePath: string;
  let testStore: PositionAlertDeliveryStore;
  let mockNotifier: PrivatePositionTelegramNotifier;
  let mockFetch: ReturnType<typeof vi.fn>;

  let activeWorkbookBuffer: Buffer;
  let activeFilename: string;
  let isRealWorkbook: boolean;

  beforeEach(() => {
    process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH = 'false';
    PositionAlertRuntimeGuard.reset();
    // 1. Snapshot protected datasets
    baselineChecksums.clear();
    for (const file of PROTECTED_DATA_FILES) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        baselineChecksums.set(file, hash);
      }
    }

    // 2. Isolated delivery store
    testStorePath = path.resolve(process.cwd(), `data/test_position_delivery_store_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);

    // 3. Mock fetch that throws if called
    mockFetch = vi.fn().mockImplementation(async () => {
      throw new Error('FATAL: Telegram network call attempted during dry-run validation!');
    });

    mockNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: testStorePath,
      fetchImpl: mockFetch as unknown as typeof fetch
    });
    testStore = mockNotifier.getDeliveryStore();

    // 4. Resolve binary workbook source (support optional external real path via env)
    const externalXlsxPath = process.env.ATHENA_P9_REAL_XLSX_PATH;
    if (externalXlsxPath && fs.existsSync(externalXlsxPath)) {
      activeWorkbookBuffer = fs.readFileSync(externalXlsxPath);
      activeFilename = path.basename(externalXlsxPath);
      isRealWorkbook = true;
    } else {
      activeWorkbookBuffer = createSanitizedTestWorkbook();
      activeFilename = 'synthetic-test-holdings.xlsx';
      isRealWorkbook = false;
    }

    expect(Buffer.isBuffer(activeWorkbookBuffer)).toBe(true);
    expect(activeWorkbookBuffer.length).toBeGreaterThan(100);

    // 5. Default runtime guard to test override
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
  });

  afterEach(() => {
    PositionAlertRuntimeGuard.reset();

    // Verify protected dataset integrity after every single test
    for (const file of PROTECTED_DATA_FILES) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const currentContent = fs.readFileSync(fullPath);
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
        const expectedHash = baselineChecksums.get(file);
        expect(currentHash).toBe(expectedHash);
      }
    }

    // Clean up temporary test store file if it exists
    if (testStorePath && fs.existsSync(testStorePath)) {
      try {
        fs.unlinkSync(testStorePath);
      } catch {
        // Safe ignore
      }
    }
  });

  /**
   * Helper to construct a canonical NormalizedPortfolioState from NormalizedPosition array.
   */
  function buildNormalizedStateFromPositions(
    positions: NormalizedPosition[],
    sourceStatus: 'VALID_ACTIVE' | 'VALID_EMPTY_PORTFOLIO' | 'INVALID_SOURCE' | 'SOURCE_ERROR' | 'UNAVAILABLE' = 'VALID_ACTIVE',
    closedPositions: Map<string, NormalizedPosition> = new Map()
  ): NormalizedPortfolioState {
    const activeMap = new Map<string, NormalizedPosition>();
    for (const pos of positions) {
      activeMap.set(pos.positionId, pos);
    }
    const totalQty = positions.reduce((acc, p) => acc + (p.quantity || 0), 0);

    return {
      portfolioId: 'PORTFOLIO_P9_VALIDATION',
      presenceState: positions.length > 0 ? 'POSITION_EXISTS' : 'NO_POSITION',
      sourceStatus,
      sourceType: 'EXCEL',
      sourceId: 'SRC_P9_XLSX',
      timestamp: new Date().toISOString(),
      totalActivePositions: positions.length,
      totalActiveQuantity: totalQty,
      activePositions: activeMap,
      closedPositions
    };
  }

  // =========================================================================
  // SCENARIO A: Binary XLSX parses successfully
  // =========================================================================
  it('Scenario A: Binary XLSX parses successfully from buffer and discovers header dynamically', () => {
    const importEngine = PortfolioImportEngine.getInstance();
    const result = importEngine.parseExcelWorkbook(activeWorkbookBuffer);

    expect(result.errors).toEqual([]);
    expect(result.detectedSheet).toBe('Equity');
    expect(result.rows.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // SCENARIO B: Holdings become normalized positions
  // =========================================================================
  it('Scenario B: Holdings become normalized positions through CsvXlsxPositionSource', async () => {
    const positionSource = new CsvXlsxPositionSource({
      sourceId: 'SRC_P9_TEST',
      filename: activeFilename,
      content: activeWorkbookBuffer,
      sourceType: 'EXCEL'
    });

    const res = await positionSource.fetchPositions();
    expect(res.status).toBe('VALID_ACTIVE');
    expect(res.positions.length).toBeGreaterThan(0);

    for (const pos of res.positions) {
      expect(typeof pos.symbol).toBe('string');
      expect(pos.symbol.length).toBeGreaterThan(0);
      expect(pos.assetClass).toBe('EQUITY');
      expect(typeof pos.quantity).toBe('number');
      expect(pos.quantity).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // SCENARIO C: Expected quantity preserved (no fabricated values)
  // =========================================================================
  it('Scenario C: Expected quantity preserved exactly without rounding or fabrication', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    expect(positions.length).toBeGreaterThan(0);

    const firstPos = positions[0];
    expect(firstPos.quantity).toBeGreaterThan(0);
    expect(Number.isFinite(firstPos.quantity)).toBe(true);

    if (!isRealWorkbook) {
      const alpha = positions.find(p => p.symbol === 'SYN_ALPHA');
      expect(alpha?.quantity).toBe(100);
      const beta = positions.find(p => p.symbol === 'SYN_BETA');
      expect(beta?.quantity).toBe(50);
    }
  });

  // =========================================================================
  // SCENARIO D: Expected average price preserved
  // =========================================================================
  it('Scenario D: Expected average price preserved faithfully', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    expect(positions.length).toBeGreaterThan(0);

    for (const p of positions) {
      expect(p.averagePrice).toBeDefined();
      expect(p.averagePrice).toBeGreaterThan(0);
    }

    if (!isRealWorkbook) {
      const alpha = positions.find(p => p.symbol === 'SYN_ALPHA');
      expect(alpha?.averagePrice).toBe(1500.00);
      const beta = positions.find(p => p.symbol === 'SYN_BETA');
      expect(beta?.averagePrice).toBe(2500.00);
    }
  });

  // =========================================================================
  // SCENARIO E: Expected previous closing price preserved
  // =========================================================================
  it('Scenario E: Expected previous closing price preserved faithfully as currentPrice', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    expect(positions.length).toBeGreaterThan(0);

    for (const p of positions) {
      expect(p.currentPrice).toBeDefined();
      expect(p.currentPrice).toBeGreaterThan(0);
    }

    if (!isRealWorkbook) {
      const alpha = positions.find(p => p.symbol === 'SYN_ALPHA');
      expect(alpha?.currentPrice).toBe(1650.00);
      const beta = positions.find(p => p.symbol === 'SYN_BETA');
      expect(beta?.currentPrice).toBe(2750.00);
    }
  });

  // =========================================================================
  // SCENARIO F: Mutual Fund/unrelated sheets do not become equity positions
  // =========================================================================
  it('Scenario F: Mutual Fund and Combined sheets do not leak into active equity positions', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    // Mutual funds from Sheet 2
    const mfPos = positions.find(p => p.symbol.includes('FUND') || p.symbol.includes('BLUECHIP') || p.symbol.includes('GROWTH'));
    expect(mfPos).toBeUndefined();

    // Verify all positions are strictly EQUITY
    for (const pos of positions) {
      expect(pos.assetClass).toBe('EQUITY');
    }
  });

  // =========================================================================
  // SCENARIO G: Malformed workbook fails closed
  // =========================================================================
  it('Scenario G: Malformed/corrupted workbook fails closed to SOURCE_ERROR with zero positions', async () => {
    // Truncated / malformed ZIP stream format
    const corruptBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]);
    const positionSource = new CsvXlsxPositionSource({
      filename: 'corrupted-holdings.xlsx',
      content: corruptBuffer
    });

    const res = await positionSource.fetchPositions();
    expect(res.status).toBe('SOURCE_ERROR');
    expect(res.positions).toEqual([]);
    expect(res.error).toBeDefined();
  });

  // =========================================================================
  // SCENARIO H: Missing headers fail closed
  // =========================================================================
  it('Scenario H: Workbook missing symbol/holdings headers fails closed with zero positions', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Some Random Title', 'No Standard Headers'],
      ['FieldA', 'FieldB', 'FieldC'],
      ['123', '456', '789']
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const positionSource = new CsvXlsxPositionSource({
      filename: 'missing-headers.xlsx',
      content: buffer
    });

    const res = await positionSource.fetchPositions();
    expect(res.status).toBe('INVALID_SOURCE');
    expect(res.positions).toEqual([]);
  });

  // =========================================================================
  // SCENARIO I: VALID_EMPTY_PORTFOLIO produces zero alerts
  // =========================================================================
  it('Scenario I: VALID_EMPTY_PORTFOLIO produces zero alerts', async () => {
    const state = buildNormalizedStateFromPositions([], 'VALID_EMPTY_PORTFOLIO');
    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_VALID_EMPTY_TEST_1',
      headline: 'Commercial enterprise signs expansion agreement',
      symbols: ['SOME_HELD_SYMBOL'],
      isin: 'INTEST000001',
      exchange: 'NSE',
      provenance: { source: 'Reuters', verified: true }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(0);

    const relRes = intelEngine.getRelevanceEngine().evaluateEvent(newsEvent, state);
    expect(relRes.decision).toBe('NO_POSITION_IMPACT');
  });

  // =========================================================================
  // SCENARIO J: SOURCE_ERROR produces zero alerts
  // =========================================================================
  it('Scenario J: SOURCE_ERROR produces zero alerts and fails closed', async () => {
    const state = buildNormalizedStateFromPositions([], 'SOURCE_ERROR');
    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_SOURCE_ERR_TEST_1',
      headline: 'Major enterprise reports net profit growth for quarter',
      symbols: ['SOME_HELD_SYMBOL'],
      isin: 'INTEST000001',
      provenance: { source: 'Bloomberg', verified: true }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(0);

    const relRes = intelEngine.getRelevanceEngine().evaluateEvent(newsEvent, state);
    expect(relRes.decision).toBe('NO_POSITION_IMPACT');
  });

  // =========================================================================
  // SCENARIO K: INVALID_SOURCE produces zero alerts
  // =========================================================================
  it('Scenario K: INVALID_SOURCE produces zero alerts and fails closed', async () => {
    const state = buildNormalizedStateFromPositions([], 'INVALID_SOURCE');
    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_INVALID_SRC_TEST_1',
      headline: 'Enterprise secures major transformation banking mandate',
      symbols: ['SOME_HELD_SYMBOL'],
      isin: 'INTEST000001',
      provenance: { source: 'Mint', verified: true }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(0);

    const relRes = intelEngine.getRelevanceEngine().evaluateEvent(newsEvent, state);
    expect(relRes.decision).toBe('NO_POSITION_IMPACT');
  });

  // =========================================================================
  // SCENARIO L: UNAVAILABLE produces zero alerts
  // =========================================================================
  it('Scenario L: UNAVAILABLE status produces zero alerts and fails closed', async () => {
    const state = buildNormalizedStateFromPositions([], 'UNAVAILABLE');
    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_UNAVAILABLE_TEST_1',
      headline: 'Financial institution increases fixed deposit interest rates',
      symbols: ['SOME_HELD_SYMBOL'],
      isin: 'INTEST000001',
      provenance: { source: 'Economic Times', verified: true }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(0);

    const relRes = intelEngine.getRelevanceEngine().evaluateEvent(newsEvent, state);
    expect(relRes.decision).toBe('NO_POSITION_IMPACT');
  });

  // =========================================================================
  // SCENARIO M: Unrelated structured news produces zero alerts
  // =========================================================================
  it('Scenario M: Unrelated structured news produces zero alerts with NO_MATCHING_ACTIVE_POSITION', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // Unrelated company guaranteed not in held positions
    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_UNRELATED_EXTERNAL_CORP_1',
      headline: 'Unrelated enterprise launches rapid grocery logistics expansion',
      symbols: ['GUARANTEED_UNRELATED_NONHELD_TICKER'],
      isin: 'INE999Z99999',
      provenance: { source: 'TechCrunch', verified: true }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(0);

    const relRes = intelEngine.getRelevanceEngine().evaluateEvent(newsEvent, state);
    expect(relRes.decision).toBe('NO_POSITION_IMPACT');
    expect(relRes.rejectionReason).toBe('NO_MATCHING_ACTIVE_POSITION');
  });

  // =========================================================================
  // SCENARIO N: Exact structured news for held position produces alert candidate
  // =========================================================================
  it('Scenario N: Exact structured news matching held position produces alert candidate', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: `CANONICAL_ARTICLE_HELD_${held.symbol}_1001`,
      headline: `${held.symbol} board approves major strategic commercial expansion`,
      symbols: [held.symbol],
      isin: held.isin,
      exchange: 'NSE',
      provenance: { source: 'CNBC-TV18', verified: true, publishedAt: new Date().toISOString() }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(1);

    const alert = candidates[0];
    expect(alert.symbol).toBe(held.symbol);
    expect(alert.positionId).toContain(held.symbol);
    expect(alert.reason).toContain(held.symbol);

    // Verify delivery store marked as delivered in dry-run
    expect(testStore.isDelivered(alert.dedupeKey)).toBe(true);
  });

  // =========================================================================
  // SCENARIO O: Invalid provenance produces zero alerts
  // =========================================================================
  it('Scenario O: News event with synthetic, test, or unverified provenance produces zero alerts', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // 1. Synthetic event
    const synthEvent: PositionNewsEventInput = {
      id: 'SYNTH_ARTICLE_999',
      headline: `Synthetic mock: ${held.symbol} reports massive merger`,
      symbols: [held.symbol],
      isSynthetic: true,
      provenance: { source: 'MockPublisher', verified: true }
    };
    const synthCandidates = await intelEngine.processEvent(synthEvent);
    expect(synthCandidates.length).toBe(0);

    const synthRel = intelEngine.getRelevanceEngine().evaluateEvent(synthEvent, state);
    expect(synthRel.decision).toBe('NO_POSITION_IMPACT');
    expect(synthRel.rejectionReason).toBe('SYNTHETIC_OR_TEST_EVENT_REJECTED');

    // 2. Unverified provenance
    const unverifiedEvent: PositionNewsEventInput = {
      id: 'UNVERIFIED_ARTICLE_888',
      headline: `${held.symbol} signs enterprise contract`,
      symbols: [held.symbol],
      provenance: { source: 'AnonymousBlog', verified: false }
    };
    const unverifiedCandidates = await intelEngine.processEvent(unverifiedEvent);
    expect(unverifiedCandidates.length).toBe(0);

    const unverifiedRel = intelEngine.getRelevanceEngine().evaluateEvent(unverifiedEvent, state);
    expect(unverifiedRel.decision).toBe('NO_POSITION_IMPACT');
    expect(unverifiedRel.rejectionReason).toBe('UNVERIFIED_PROVENANCE_REJECTED');

    // 3. Missing publisher/source
    const missingSourceEvent: PositionNewsEventInput = {
      id: 'NO_PUB_ARTICLE_777',
      headline: `${held.symbol} expands semiconductor design team`,
      symbols: [held.symbol]
    };
    const missingCandidates = await intelEngine.processEvent(missingSourceEvent);
    expect(missingCandidates.length).toBe(0);

    const missingRel = intelEngine.getRelevanceEngine().evaluateEvent(missingSourceEvent, state);
    expect(missingRel.decision).toBe('NO_POSITION_IMPACT');
    expect(missingRel.rejectionReason).toBe('MISSING_PROVENANCE_SOURCE');
  });

  // =========================================================================
  // SCENARIO P: Closed position receives zero alerts
  // =========================================================================
  it('Scenario P: Position closed via reconciliation flow receives zero alerts', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    const held = positions[0];
    const remainingPositions = positions.slice(1);

    const closedMap = new Map<string, NormalizedPosition>();
    closedMap.set(held.positionId, {
      ...held,
      quantity: 0
    });

    const state = buildNormalizedStateFromPositions(remainingPositions, 'VALID_ACTIVE', closedMap);

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: `CANONICAL_ARTICLE_${held.symbol}_AFTER_CLOSE`,
      headline: `${held.symbol} announces major quarterly dividend`,
      symbols: [held.symbol],
      isin: held.isin,
      provenance: { source: 'LiveMint', verified: true }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(0);

    const relRes = intelEngine.getRelevanceEngine().evaluateEvent(newsEvent, state);
    expect(relRes.decision).toBe('NO_POSITION_IMPACT');
    expect(relRes.rejectionReason).toBe('NO_MATCHING_ACTIVE_POSITION');
  });

  // =========================================================================
  // SCENARIO Q: Duplicate event produces no duplicate alert
  // =========================================================================
  it('Scenario Q: Duplicate evaluation of identical canonical event produces exactly one alert', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: `CANONICAL_ARTICLE_${held.symbol}_EARNINGS`,
      headline: `${held.symbol} reports double-digit revenue growth in latest quarterly audit`,
      symbols: [held.symbol],
      isin: held.isin,
      provenance: { source: 'Business Standard', verified: true }
    };

    // First evaluation: should trigger alert
    const firstRes = await intelEngine.processEvent(newsEvent);
    expect(firstRes.length).toBe(1);

    // Second evaluation: suppressed duplicate
    const secondRes = await intelEngine.processEvent(newsEvent);
    expect(secondRes.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO R: Restart preserves deduplication
  // =========================================================================
  it('Scenario R: Restarting the alert engine with reloaded delivery store preserves deduplication', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    // Run first instance
    const engine1 = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: `CANONICAL_ARTICLE_${held.symbol}_RESTART_TEST`,
      headline: `${held.symbol} signs 5-year enterprise transformation partnership with European major`,
      symbols: [held.symbol],
      isin: held.isin,
      provenance: { source: 'Reuters', verified: true }
    };

    const res1 = await engine1.processEvent(newsEvent);
    expect(res1.length).toBe(1);

    // Reload delivery store from disk (simulating restart)
    const reloadedStore = new PositionAlertDeliveryStore(testStorePath);
    expect(reloadedStore.isDelivered(res1[0].dedupeKey)).toBe(true);

    const reloadedNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: testStorePath,
      fetchImpl: mockFetch as unknown as typeof fetch
    });

    const engine2 = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: reloadedNotifier,
      deliveryStore: reloadedStore
    });

    // Evaluate same event post-restart: must be suppressed
    const res2 = await engine2.processEvent(newsEvent);
    expect(res2.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO S: Multiple holdings remain strictly isolated
  // =========================================================================
  it('Scenario S: Multiple holdings remain strictly isolated to their respective events', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const pos1 = positions[0];
    const pos2 = positions.length > 1 ? positions[1] : positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // Event for pos1 only
    const event1: PositionNewsEventInput = {
      id: `ARTICLE_${pos1.symbol}_ISOLATION_TEST`,
      headline: `${pos1.symbol} net interest income rises 16% in latest reporting quarter`,
      symbols: [pos1.symbol],
      isin: pos1.isin,
      provenance: { source: 'Moneycontrol', verified: true }
    };

    const res1 = await intelEngine.processEvent(event1);
    expect(res1.length).toBe(1);
    expect(res1[0].symbol).toBe(pos1.symbol);

    // Event for pos2 only (if multiple positions present)
    if (pos2.symbol !== pos1.symbol) {
      const event2: PositionNewsEventInput = {
        id: `ARTICLE_${pos2.symbol}_ISOLATION_TEST`,
        headline: `${pos2.symbol} announces quarterly dividend payout per share`,
        symbols: [pos2.symbol],
        isin: pos2.isin,
        provenance: { source: 'Economic Times', verified: true }
      };

      const res2 = await intelEngine.processEvent(event2);
      expect(res2.length).toBe(1);
      expect(res2[0].symbol).toBe(pos2.symbol);
    }
  });

  // =========================================================================
  // SCENARIO T: Macro/index news produces zero alerts unless explicitly held
  // =========================================================================
  it('Scenario T: Macro and index news (NIFTY, SENSEX, CRUDE, BANKNIFTY) produce zero alerts', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const macroEvents: PositionNewsEventInput[] = [
      {
        id: 'MACRO_NIFTY_1',
        headline: 'NIFTY 50 surges 350 points past new all-time peak',
        symbols: ['NIFTY', 'NIFTY50'],
        provenance: { source: 'NSE India', verified: true }
      },
      {
        id: 'MACRO_SENSEX_1',
        headline: 'Sensex gains 1,100 points led by institutional inflows',
        symbols: ['SENSEX'],
        provenance: { source: 'BSE India', verified: true }
      },
      {
        id: 'MACRO_BANKNIFTY_1',
        headline: 'Bank Nifty breaches 54,000 level on rate cut expectations',
        symbols: ['BANKNIFTY'],
        provenance: { source: 'Mint', verified: true }
      },
      {
        id: 'MACRO_CRUDE_1',
        headline: 'Brent Crude drops 3% following OPEC supply forecast',
        symbols: ['CRUDE', 'CRUDEOIL'],
        provenance: { source: 'Reuters', verified: true }
      }
    ];

    for (const event of macroEvents) {
      const res = await intelEngine.processEvent(event);
      expect(res.length).toBe(0);
    }
  });

  // =========================================================================
  // SCENARIO U: Repeated News Core V2 event evaluation remains idempotent
  // =========================================================================
  it('Scenario U: Repeated evaluation via PositionAlertRuntime is strictly idempotent', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const runtime = new PositionAlertRuntime({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const canonicalArticle = {
      id: `ARTICLE_${held.symbol}_CONTRACT_2026`,
      canonicalUrl: 'https://ptinews.com/story/101',
      headline: `${held.symbol} wins critical infrastructure expansion contract`,
      body: 'Heavy civil engineering business secures major commercial mandate.',
      source: {
        publisher: 'Press Trust of India',
        collectionMethod: 'RSS',
        url: 'https://ptinews.com/story/101'
      },
      symbols: [held.symbol],
      isin: held.isin,
      exchange: 'NSE',
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      category: 'Corporate' as any,
      sentiment: 'BULLISH' as any,
      relevanceScore: 90,
      fno: { eligible: true, symbol: held.symbol, confidence: 'HIGH', decision: 'INCLUDE', reason: 'FO' } as any,
      primaryCategory: 'CONTRACTS'
    } as any as NewsArticleV2;

    // Cycle 1: creates alert
    const candidates1 = await runtime.onCanonicalArticle(canonicalArticle);
    expect(candidates1.length).toBe(1);
    expect(candidates1[0].symbol).toBe(held.symbol);
    expect(testStore.isDelivered(candidates1[0].dedupeKey)).toBe(true);

    // Cycle 2: identical article, no additional alerts
    const candidates2 = await runtime.onCanonicalArticle(canonicalArticle);
    expect(candidates2.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO V: Zero Telegram network calls
  // =========================================================================
  it('Scenario V: Mock notifier records dry-run delivery with exactly ZERO Telegram network calls', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: `ARTICLE_${held.symbol}_COMMERCIAL_2026`,
      headline: `${held.symbol} unveils next-generation electric commercial platform`,
      symbols: [held.symbol],
      isin: held.isin,
      provenance: { source: 'Autocar India', verified: true }
    };

    const res = await intelEngine.processEvent(newsEvent);
    expect(res.length).toBe(1);

    // Mock fetch MUST NOT have been called even once!
    expect(mockFetch).toHaveBeenCalledTimes(0);
  });

  // =========================================================================
  // SCENARIO W: ATHENA_POSITION_ALERTS_ENABLED=false remains safe
  // =========================================================================
  it('Scenario W: ATHENA_POSITION_ALERTS_ENABLED=false stops pipeline safely without throwing', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(false);

    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const held = positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const runtime = new PositionAlertRuntime({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const canonicalArticle = {
      id: `ARTICLE_FLAG_OFF_${held.symbol}`,
      canonicalUrl: 'https://economictimes.indiatimes.com/story/102',
      headline: `${held.symbol} reports solid expansion in operating margins`,
      body: 'Operating margins across units expanded in latest period.',
      symbols: [held.symbol],
      isin: held.isin,
      exchange: 'NSE',
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      category: 'Corporate' as any,
      sentiment: 'BULLISH' as any,
      relevanceScore: 85,
      fno: { eligible: true, symbol: held.symbol, confidence: 'HIGH', decision: 'INCLUDE', reason: 'FO' } as any,
      source: {
        publisher: 'Economic Times',
        collectionMethod: 'RSS',
        url: 'https://economictimes.indiatimes.com/story/102'
      }
    } as any as NewsArticleV2;

    // Should return safely without processing
    const candidates = await runtime.onCanonicalArticle(canonicalArticle);
    expect(candidates.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO X: data/telegram_outbox.json unchanged
  // =========================================================================
  it('Scenario X: data/telegram_outbox.json remains byte-identical throughout testing', () => {
    const outboxPath = path.resolve(process.cwd(), 'data/telegram_outbox.json');
    if (fs.existsSync(outboxPath)) {
      const currentContent = fs.readFileSync(outboxPath);
      const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
      expect(currentHash).toBe(baselineChecksums.get('data/telegram_outbox.json'));
    }
  });

  // =========================================================================
  // SCENARIO Y: Protected production datasets unchanged
  // =========================================================================
  it('Scenario Y: All 7 protected production datasets remain byte-identical', () => {
    for (const file of PROTECTED_DATA_FILES) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const currentContent = fs.readFileSync(fullPath);
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
        expect(currentHash).toBe(baselineChecksums.get(file));
      }
    }
  });

  // =========================================================================
  // SCENARIO Z: Strictly Read-Only (no trading / order placement methods)
  // =========================================================================
  it('Scenario Z: Alerts codebase contains zero trading or order placement methods', () => {
    const alertsDir = path.resolve(process.cwd(), 'src/news/portfolio/alerts');
    const files = fs.readdirSync(alertsDir).filter(f => f.endsWith('.ts'));

    const forbiddenMethods = [
      'placeOrder',
      'buy',
      'sell',
      'modifyOrder',
      'cancelOrder',
      'closePosition',
      'executeOrder'
    ];

    for (const file of files) {
      const filePath = path.join(alertsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      for (const method of forbiddenMethods) {
        // Regex looks for actual method declarations e.g. "public placeOrder(" or "placeOrder("
        const methodRegex = new RegExp(`(public|async|private|protected)?\\s+${method}\\s*\\(`, 'g');
        const matches = content.match(methodRegex);
        expect(matches).toBeNull();
      }
    }
  });

  // =========================================================================
  // ADDITIONAL SCENARIO: Multi-entity event impacting multiple held positions
  // =========================================================================
  it('Additional Scenario: Event mentioning multiple held holdings produces one candidate per held position', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: activeFilename,
      content: activeWorkbookBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const pos1 = positions[0];
    const pos2 = positions.length > 1 ? positions[1] : positions[0];
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    if (pos1.symbol !== pos2.symbol) {
      const multiEvent: PositionNewsEventInput = {
        id: `ARTICLE_MULTI_${pos1.symbol}_${pos2.symbol}_CONSORTIUM`,
        headline: `${pos1.symbol} and ${pos2.symbol} form national consortium for enterprise expansion`,
        symbols: [pos1.symbol, pos2.symbol],
        provenance: { source: 'Financial Express', verified: true }
      };

      const res = await intelEngine.processEvent(multiEvent);
      expect(res.length).toBe(2);

      const candidateSymbols = res.map(c => c.symbol).sort();
      expect(candidateSymbols).toEqual([pos1.symbol, pos2.symbol].sort());
    } else {
      const singleEvent: PositionNewsEventInput = {
        id: `ARTICLE_SINGLE_${pos1.symbol}_EXPANSION`,
        headline: `${pos1.symbol} announces expansion plan`,
        symbols: [pos1.symbol],
        provenance: { source: 'Financial Express', verified: true }
      };

      const res = await intelEngine.processEvent(singleEvent);
      expect(res.length).toBe(1);
    }
  });
});
