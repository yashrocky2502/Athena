/**
 * ATHENA — PHASE 10P-9: CONTROLLED REAL-WORLD POSITION ALERT VALIDATION
 * Phase10P_9_RealPortfolioValidation.test.ts
 * 
 * Strict deterministic validation of the full personal position alert pipeline
 * against the user's real binary broker holdings (holdings-RKN570.xlsx).
 * 
 * Flow Tested:
 * REAL XLSX holdings (holdings-RKN570.xlsx)
 *     ↓
 * CsvXlsxPositionSource
 *     ↓
 * Authoritative Portfolio / Source-Health Validation
 *     ↓
 * NormalizedPortfolioState
 *     ↓
 * Structured News Core V2 Event
 *     ↓
 * PositionRelevanceEngine
 *     ↓
 * PositionAlertIntelligenceEngine
 *     ↓
 * PositionAlertEngine
 *     ↓
 * Persistent Deduplication
 *     ↓
 * Delivery Decision (Dry-Run / Mock Notifier with ZERO network calls)
 * 
 * Required Minimum Test Scenarios:
 * A. real XLSX parses successfully
 * B. real holdings become normalized positions
 * C. expected quantity preserved
 * D. expected average price preserved
 * E. expected previous closing price preserved
 * F. Mutual Fund/unrelated sheets do not become equity positions
 * G. malformed workbook fails closed
 * H. missing headers fail closed
 * I. VALID_EMPTY_PORTFOLIO produces zero alerts
 * J. SOURCE_ERROR produces zero alerts
 * K. INVALID_SOURCE produces zero alerts
 * L. UNAVAILABLE produces zero alerts
 * M. unrelated structured news produces zero alerts
 * N. exact structured news for held position produces alert candidate
 * O. invalid provenance produces zero alerts
 * P. closed position receives zero alerts
 * Q. duplicate event produces no duplicate
 * R. restart preserves deduplication
 * S. multiple holdings remain isolated
 * T. macro/index news produces zero alerts unless actually held
 * U. repeated News Core V2 event evaluation remains idempotent
 * V. zero Telegram network calls
 * W. ATHENA_POSITION_ALERTS_ENABLED=false remains safe
 * X. data/telegram_outbox.json unchanged
 * Y. protected production datasets unchanged
 * Z. no trading/order capability
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

describe('Phase 10P-9: Controlled Real-World Position Alert Validation', () => {
  let baselineChecksums: Map<string, string> = new Map();
  let testStorePath: string;
  let testStore: PositionAlertDeliveryStore;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockNotifier: PrivatePositionTelegramNotifier;
  let realXlsxBuffer: Buffer;
  let realXlsxPath: string;

  beforeEach(() => {
    // 1. Snapshot baseline checksums of protected files
    baselineChecksums.clear();
    for (const file of PROTECTED_DATA_FILES) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        baselineChecksums.set(file, hash);
      }
    }

    // 2. Set up isolated test delivery store in temp_test_stores
    const tempDir = path.resolve(process.cwd(), 'temp_test_stores');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    testStorePath = path.join(tempDir, `test_p9_store_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);

    // 3. Mock fetch that strictly forbids any real network transmission
    mockFetch = vi.fn().mockImplementation(async () => {
      throw new Error('SECURITY VIOLATION: Real Telegram network call attempted during dry-run validation!');
    });

    mockNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: testStorePath,
      fetchImpl: mockFetch as unknown as typeof fetch
    });
    testStore = mockNotifier.getDeliveryStore();

    // 4. Ensure real XLSX file exists and read binary buffer
    realXlsxPath = path.resolve(process.cwd(), 'holdings-RKN570.xlsx');
    expect(fs.existsSync(realXlsxPath)).toBe(true);
    realXlsxBuffer = fs.readFileSync(realXlsxPath);
    expect(Buffer.isBuffer(realXlsxBuffer)).toBe(true);
    expect(realXlsxBuffer.length).toBeGreaterThan(1000);

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
      portfolioId: 'PORTFOLIO_RKN570_REAL',
      presenceState: positions.length > 0 ? 'POSITION_EXISTS' : 'NO_POSITION',
      sourceStatus,
      sourceType: 'EXCEL',
      sourceId: 'SRC_RKN570_XLSX',
      timestamp: new Date().toISOString(),
      totalActivePositions: positions.length,
      totalActiveQuantity: totalQty,
      activePositions: activeMap,
      closedPositions
    };
  }

  // =========================================================================
  // SCENARIO A: Real XLSX parses successfully
  // =========================================================================
  it('Scenario A: Real XLSX parses successfully from binary buffer and discovers header dynamically', () => {
    const importEngine = PortfolioImportEngine.getInstance();
    const result = importEngine.parseExcelWorkbook(realXlsxBuffer);

    expect(result.errors).toEqual([]);
    expect(result.detectedSheet).toBe('Equity');
    expect(result.rows.length).toBe(8);
  });

  // =========================================================================
  // SCENARIO B: Real holdings become normalized positions
  // =========================================================================
  it('Scenario B: Real holdings become normalized positions through CsvXlsxPositionSource', async () => {
    const positionSource = new CsvXlsxPositionSource({
      sourceId: 'SRC_RKN570_TEST',
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer,
      sourceType: 'EXCEL'
    });

    const res = await positionSource.fetchPositions();
    expect(res.status).toBe('VALID_ACTIVE');
    expect(res.positions.length).toBe(8);

    const symbols = res.positions.map(p => p.symbol).sort();
    expect(symbols).toEqual([
      'HDFCBANK',
      'ICICIBANK',
      'INFY',
      'ITC',
      'LT',
      'RELIANCE',
      'TATAMOTORS',
      'TCS'
    ]);
  });

  // =========================================================================
  // SCENARIO C: Expected quantity preserved (no fabricated values)
  // =========================================================================
  it('Scenario C: Expected quantity preserved exactly without rounding or fabrication', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    const rel = positions.find(p => p.symbol === 'RELIANCE');
    expect(rel?.quantity).toBe(100);

    const tcs = positions.find(p => p.symbol === 'TCS');
    expect(tcs?.quantity).toBe(50);

    const infy = positions.find(p => p.symbol === 'INFY');
    expect(infy?.quantity).toBe(200);

    const itc = positions.find(p => p.symbol === 'ITC');
    expect(itc?.quantity).toBe(300);
  });

  // =========================================================================
  // SCENARIO D: Expected average price preserved
  // =========================================================================
  it('Scenario D: Expected average price preserved faithfully', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    const rel = positions.find(p => p.symbol === 'RELIANCE');
    expect(rel?.averagePrice).toBe(2450.50);

    const tcs = positions.find(p => p.symbol === 'TCS');
    expect(tcs?.averagePrice).toBe(3500.00);

    const hdfc = positions.find(p => p.symbol === 'HDFCBANK');
    expect(hdfc?.averagePrice).toBe(1480.20);
  });

  // =========================================================================
  // SCENARIO E: Expected previous closing price preserved
  // =========================================================================
  it('Scenario E: Expected previous closing price preserved faithfully as currentPrice', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    const rel = positions.find(p => p.symbol === 'RELIANCE');
    expect(rel?.currentPrice).toBe(2980.00);

    const tcs = positions.find(p => p.symbol === 'TCS');
    expect(tcs?.currentPrice).toBe(3850.25);

    const tata = positions.find(p => p.symbol === 'TATAMOTORS');
    expect(tata?.currentPrice).toBe(945.50);
  });

  // =========================================================================
  // SCENARIO F: Mutual Fund/unrelated sheets do not become equity positions
  // =========================================================================
  it('Scenario F: Mutual Fund and Combined sheets do not leak into active equity positions', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    // Mutual funds from Sheet 2
    const hdfcMf = positions.find(p => p.symbol.includes('TOP 100') || p.symbol.includes('FUND'));
    expect(hdfcMf).toBeUndefined();

    const sbiMf = positions.find(p => p.symbol.includes('BLUECHIP') || p.symbol.includes('SBI'));
    expect(sbiMf).toBeUndefined();

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
      headline: 'Reliance Industries signs $5B clean energy expansion contract',
      symbols: ['RELIANCE'],
      isin: 'INE002A01018',
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
      headline: 'TCS reports 18% YoY net profit growth for Q3',
      symbols: ['TCS'],
      isin: 'INE467B01029',
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
      headline: 'Infosys secures major AI transformation banking mandate',
      symbols: ['INFY'],
      isin: 'INE009A01021',
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
      headline: 'HDFC Bank increases fixed deposit interest rates',
      symbols: ['HDFCBANK'],
      isin: 'INE040A01034',
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // Unrelated company: Zomato (not in holdings-RKN570)
    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_UNRELATED_ZOMATO_1',
      headline: 'Zomato launches rapid 10-minute grocery service expansion',
      symbols: ['ZOMATO'],
      isin: 'INE758T01015',
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'CANONICAL_ARTICLE_RELIANCE_1001',
      headline: 'Reliance Industries board approves ₹20,000 cr strategic investment',
      symbols: ['RELIANCE'],
      isin: 'INE002A01018',
      exchange: 'NSE',
      provenance: { source: 'CNBC-TV18', verified: true, publishedAt: new Date().toISOString() }
    };

    const candidates = await intelEngine.processEvent(newsEvent);
    expect(candidates.length).toBe(1);

    const alert = candidates[0];
    expect(alert.symbol).toBe('RELIANCE');
    expect(alert.positionId).toContain('RELIANCE');
    expect(alert.reason).toContain('Reliance Industries');

    // Verify delivery store marked as delivered in dry-run
    expect(testStore.isDelivered(alert.dedupeKey)).toBe(true);
  });

  // =========================================================================
  // SCENARIO O: Invalid provenance produces zero alerts
  // =========================================================================
  it('Scenario O: News event with synthetic, test, or unverified provenance produces zero alerts', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // 1. Synthetic event
    const synthEvent: PositionNewsEventInput = {
      id: 'SYNTH_ARTICLE_999',
      headline: 'Synthetic mock: Reliance reports massive merger',
      symbols: ['RELIANCE'],
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
      headline: 'TCS signs billion dollar cloud deal',
      symbols: ['TCS'],
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
      headline: 'Infosys expands semiconductor design team',
      symbols: ['INFY']
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();

    // Reconcile and close RELIANCE
    const reliancePos = positions.find(p => p.symbol === 'RELIANCE')!;
    const remainingPositions = positions.filter(p => p.symbol !== 'RELIANCE');

    const closedMap = new Map<string, NormalizedPosition>();
    closedMap.set(reliancePos.positionId, {
      ...reliancePos,
      quantity: 0
    });

    const state = buildNormalizedStateFromPositions(remainingPositions, 'VALID_ACTIVE', closedMap);

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'CANONICAL_ARTICLE_RELIANCE_AFTER_CLOSE',
      headline: 'Reliance announces major quarterly dividend',
      symbols: ['RELIANCE'],
      isin: 'INE002A01018',
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'CANONICAL_ARTICLE_TCS_EARNINGS',
      headline: 'TCS reports double-digit growth in cloud and AI contracts',
      symbols: ['TCS'],
      isin: 'INE467B01029',
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    // Run first instance
    const engine1 = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'CANONICAL_ARTICLE_INFY_RESTART_TEST',
      headline: 'Infosys signs 5-year enterprise transformation partnership with European major',
      symbols: ['INFY'],
      isin: 'INE009A01021',
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // Event for HDFCBANK only
    const hdfcEvent: PositionNewsEventInput = {
      id: 'ARTICLE_HDFC_ISOLATION_TEST',
      headline: 'HDFC Bank net interest income rises 16% in latest quarter',
      symbols: ['HDFCBANK'],
      isin: 'INE040A01034',
      provenance: { source: 'Moneycontrol', verified: true }
    };

    const hdfcRes = await intelEngine.processEvent(hdfcEvent);
    expect(hdfcRes.length).toBe(1);
    expect(hdfcRes[0].symbol).toBe('HDFCBANK');

    // Event for ICICIBANK only
    const iciciEvent: PositionNewsEventInput = {
      id: 'ARTICLE_ICICI_ISOLATION_TEST',
      headline: 'ICICI Bank announces quarterly dividend of ₹10 per share',
      symbols: ['ICICIBANK'],
      isin: 'INE090A01021',
      provenance: { source: 'Economic Times', verified: true }
    };

    const iciciRes = await intelEngine.processEvent(iciciEvent);
    expect(iciciRes.length).toBe(1);
    expect(iciciRes[0].symbol).toBe('ICICIBANK');
  });

  // =========================================================================
  // SCENARIO T: Macro/index news produces zero alerts unless explicitly held
  // =========================================================================
  it('Scenario T: Macro and index news (NIFTY, SENSEX, CRUDE, BANKNIFTY) produce zero alerts', async () => {
    const positionSource = new CsvXlsxPositionSource({
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const runtime = new PositionAlertRuntime({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const canonicalArticle: NewsArticleV2 = {
      id: 'ARTICLE_LNT_DEFENSE_CONTRACT_2026',
      canonicalUrl: 'https://ptinews.com/story/101',
      headline: 'Larsen & Toubro wins 8,500 crore critical infrastructure contract',
      body: 'L&T heavy civil engineering business secures major commercial mandate.',
      source: {
        publisher: 'Press Trust of India',
        collectionMethod: 'RSS',
        url: 'https://ptinews.com/story/101'
      },
      symbols: ['LT'],
      isin: 'INE018A01030',
      exchange: 'NSE',
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      category: 'Corporate' as any,
      sentiment: 'BULLISH' as any,
      relevanceScore: 90,
      fno: { eligible: true, symbol: 'LT', confidence: 'HIGH', decision: 'INCLUDE', reason: 'FO' } as any,
      primaryCategory: 'CONTRACTS'
    } as any;

    // Cycle 1: creates alert
    const candidates1 = await runtime.onCanonicalArticle(canonicalArticle);
    expect(candidates1.length).toBe(1);
    expect(candidates1[0].symbol).toBe('LT');
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const newsEvent: PositionNewsEventInput = {
      id: 'ARTICLE_TATA_MOTORS_EV_2026',
      headline: 'Tata Motors unveils next-generation electric commercial platform',
      symbols: ['TATAMOTORS'],
      isin: 'INE155A01022',
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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const runtime = new PositionAlertRuntime({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    const canonicalArticle: NewsArticleV2 = {
      id: 'ARTICLE_FLAG_OFF_TEST',
      canonicalUrl: 'https://economictimes.indiatimes.com/story/102',
      headline: 'ITC reports solid expansion in FMCG segment operating margins',
      body: 'ITC announced expansion in operating margins across FMCG units.',
      symbols: ['ITC'],
      isin: 'INE154A01025',
      exchange: 'NSE',
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      category: 'Corporate' as any,
      sentiment: 'BULLISH' as any,
      relevanceScore: 85,
      fno: { eligible: true, symbol: 'ITC', confidence: 'HIGH', decision: 'INCLUDE', reason: 'FO' } as any,
      source: {
        publisher: 'Economic Times',
        collectionMethod: 'RSS',
        url: 'https://economictimes.indiatimes.com/story/102'
      }
    } as any;

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
      filename: 'holdings-RKN570.xlsx',
      content: realXlsxBuffer
    });
    const { positions } = await positionSource.fetchPositions();
    const state = buildNormalizedStateFromPositions(positions, 'VALID_ACTIVE');

    const intelEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    // Event impacting both RELIANCE and TCS
    const multiEvent: PositionNewsEventInput = {
      id: 'ARTICLE_MULTI_RELIANCE_TCS_CONSORTIUM',
      headline: 'Reliance and TCS form national consortium for hyperscale cloud deployment',
      symbols: ['RELIANCE', 'TCS'],
      provenance: { source: 'Financial Express', verified: true }
    };

    const res = await intelEngine.processEvent(multiEvent);
    expect(res.length).toBe(2);

    const candidateSymbols = res.map(c => c.symbol).sort();
    expect(candidateSymbols).toEqual(['RELIANCE', 'TCS']);
  });
});
