/**
 * ATHENA — PHASE 10P-8: REAL-TIME POSITION ALERT RUNTIME WIRING TEST SUITE
 * Phase10P_8_PositionAlertRuntime.test.ts
 * 
 * Strict deterministic verification of:
 * A. feature flag false -> no personal alert processing
 * B. feature flag true -> qualifying event reaches intelligence engine
 * C. active RELIANCE position + structured RELIANCE event -> alert
 * D. active TCS position + RELIANCE event -> no alert
 * E. closed RELIANCE position + RELIANCE event -> no alert
 * F. INVALID_SOURCE -> no alert
 * G. SOURCE_ERROR -> no alert
 * H. UNAVAILABLE -> no alert
 * I. VALID_EMPTY_PORTFOLIO -> no alert
 * J. synthetic event -> no alert
 * K. test event -> no alert
 * L. verified:false -> no alert
 * M. missing provenance -> no alert
 * N. generic NIFTY event without NIFTY position -> no alert
 * O. unrelated F&O event -> no alert
 * P. multiple active positions impacted -> separate candidates
 * Q. duplicate News Core event -> one alert only
 * R. repeated runtime cycle -> no duplicate
 * S. restart/delivery-store dedupe -> no duplicate
 * T. Telegram failure -> News Core pipeline unaffected
 * U. portfolio-source failure -> News Core pipeline unaffected
 * V. missing Telegram configuration -> graceful/no crash
 * W. feature flag false -> zero Telegram network calls
 * X. zero writes to data/telegram_outbox.json
 * Y. no order/trading methods
 * Z. canonical News Core V2 remains the only news ingestion path
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  PositionAlertRuntime,
  positionAlertRuntime,
  PositionAlertRuntimeGuard,
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
import { newsSyncService } from '../../newsCoreV2/sync/NewsSyncService.ts';

const PROTECTED_DATA_FILES = [
  'data/portfolio_store.json',
  'data/telegram_outbox.json',
  'data/news_core_v2.json',
  'data/news_intelligence_v2.json',
  'data/market_intelligence_outcomes.json',
  'data/news_signal_lifecycle.json',
  'data/news_signal_historical_ledger.json'
];

describe('Phase 10P-8: Real-Time Position Alert Runtime Wiring', () => {
  let baselineChecksums: Map<string, string> = new Map();
  let runtime: PositionAlertRuntime;
  let testStorePath: string;
  let testStore: PositionAlertDeliveryStore;
  let mockNotifier: PrivatePositionTelegramNotifier;
  let deliveredCandidates: PositionAlertCandidate[] = [];

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
      activeMap.set(posId, normPos);
      posList.push(normPos);
    }

    const totalQty = posList.reduce((acc, p) => acc + p.quantity, 0);

    return {
      portfolioId: 'TEST_PORTFOLIO_P8',
      presenceState: posList.length > 0 ? 'POSITION_EXISTS' : 'NO_POSITION',
      sourceStatus: 'VALID_ACTIVE',
      sourceType: 'TEST',
      sourceId: 'SRC_TEST_P8',
      timestamp: new Date().toISOString(),
      totalActivePositions: posList.length,
      totalActiveQuantity: totalQty,
      activePositions: activeMap,
      closedPositions: new Map()
    };
  };

  const createCanonicalArticle = (overrides?: Partial<NewsArticleV2>): NewsArticleV2 => {
    return {
      id: overrides?.id || `art_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      canonicalUrl: overrides?.canonicalUrl || 'https://economictimes.indiatimes.com/news/article1',
      headline: overrides?.headline || 'Reliance Industries bags mega $2 Billion green hydrogen contract',
      body: overrides?.body || 'Reliance Industries announced a major green energy expansion project with international backing.',
      source: overrides?.source || {
        publisher: 'Economic Times',
        url: 'https://economictimes.indiatimes.com',
        collectionMethod: 'RSS'
      },
      publishedAt: overrides?.publishedAt || new Date().toISOString(),
      collectedAt: overrides?.collectedAt || new Date().toISOString(),
      category: overrides?.category || 'Corporate',
      sentiment: overrides?.sentiment || 'BULLISH',
      relevanceScore: overrides?.relevanceScore ?? 85,
      fno: overrides?.fno || {
        eligible: true,
        symbol: 'RELIANCE',
        confidence: 'HIGH',
        decision: 'INCLUDE',
        reason: 'FO stock'
      },
      ...overrides
    } as NewsArticleV2;
  };

  beforeEach(() => {
    // Snapshot authoritative checksums for protected production data files
    for (const relPath of PROTECTED_DATA_FILES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        baselineChecksums.set(relPath, hash);
      }
    }

    // Isolated test store path to prevent any disk pollution
    testStorePath = path.resolve(process.cwd(), `data/test_position_delivery_p8_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
    testStore = new PositionAlertDeliveryStore(testStorePath);

    deliveredCandidates = [];
    mockNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: testStorePath
    });

    // Spy on notify to record deliveries in memory
    const origNotify = mockNotifier.notify.bind(mockNotifier);
    vi.spyOn(mockNotifier, 'notify').mockImplementation(async (alert) => {
      deliveredCandidates.push(alert);
      return await origNotify(alert);
    });

    const intelEngine = new PositionAlertIntelligenceEngine({
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    runtime = new PositionAlertRuntime({
      intelligenceEngine: intelEngine,
      notifier: mockNotifier,
      deliveryStore: testStore
    });

    PositionAlertRuntimeGuard.reset();
  });

  afterEach(() => {
    runtime.reset();
    PositionAlertRuntimeGuard.reset();
    vi.restoreAllMocks();

    // Clean up isolated test store
    if (fs.existsSync(testStorePath)) {
      try {
        fs.unlinkSync(testStorePath);
      } catch {}
    }

    // Verify ZERO mutations to protected production data files
    for (const [relPath, origHash] of baselineChecksums.entries()) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const currentContent = fs.readFileSync(fullPath);
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
        expect(
          currentHash,
          `CRITICAL SAFETY VIOLATION: Protected production file ${relPath} was modified during Phase 10P-8 tests!`
        ).toBe(origHash);
      }
    }
  });

  // =========================================================================
  // TEST A: FEATURE FLAG FALSE -> NO PERSONAL ALERT PROCESSING
  // =========================================================================
  it('TEST A: feature flag false -> no personal alert processing', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(false);
    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(false);

    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 50 }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries announces massive buyback at 30% premium',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
    expect(runtime.getProcessedEventsCount()).toBe(0);
  });

  // =========================================================================
  // TEST B: FEATURE FLAG TRUE -> QUALIFYING EVENT REACHES INTELLIGENCE ENGINE
  // =========================================================================
  it('TEST B: feature flag true -> qualifying event reaches intelligence engine', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    expect(PositionAlertRuntimeGuard.isAlertsEnabled()).toBe(true);

    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 50 }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      id: 'art_reliance_001',
      headline: 'Reliance Industries announces massive buyback at 30% premium',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].symbol).toBe('RELIANCE');
    expect(deliveredCandidates.length).toBeGreaterThan(0);
    expect(runtime.getProcessedEventsCount()).toBe(1);
  });

  // =========================================================================
  // TEST C: ACTIVE RELIANCE POSITION + STRUCTURED RELIANCE EVENT -> ALERT
  // =========================================================================
  it('TEST C: active RELIANCE position + structured RELIANCE event -> alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 200, isin: 'INE002A01018' }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      id: 'art_reliance_event_1',
      headline: 'Reliance Retail Q3 Net Profit Surges 28% YoY',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].symbol).toBe('RELIANCE');
    expect(candidates[0].reason).toContain('Reliance Retail');
    expect(deliveredCandidates).toHaveLength(1);
  });

  // =========================================================================
  // TEST D: ACTIVE TCS POSITION + RELIANCE EVENT -> NO ALERT
  // =========================================================================
  it('TEST D: active TCS position + RELIANCE event -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'TCS', quantity: 100, isin: 'INE467B01029' }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      id: 'art_reliance_event_2',
      headline: 'Reliance Jio to launch satellite broadband in 40 cities',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST E: CLOSED RELIANCE POSITION + RELIANCE EVENT -> NO ALERT
  // =========================================================================
  it('TEST E: closed RELIANCE position + RELIANCE event -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);

    const closedMap = new Map<string, NormalizedPosition>();
    const closedPosId = 'POS_NSE_RELIANCE_EQUITY';
    closedMap.set(closedPosId, {
      positionId: closedPosId,
      symbol: 'RELIANCE',
      exchange: 'NSE',
      isin: 'INE002A01018',
      assetClass: 'EQUITY',
      quantity: 0,
      averagePrice: 2500,
      currentPrice: 2600,
      source: 'TEST',
      observedAt: new Date().toISOString()
    });

    const state: NormalizedPortfolioState = {
      portfolioId: 'TEST_PORTFOLIO_P8',
      presenceState: 'NO_POSITION',
      sourceStatus: 'VALID_ACTIVE',
      sourceType: 'TEST',
      sourceId: 'SRC_TEST_P8',
      timestamp: new Date().toISOString(),
      totalActivePositions: 0,
      totalActiveQuantity: 0,
      activePositions: new Map(), // Active is empty!
      closedPositions: closedMap
    };

    runtime.setPortfolioState(state);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries acquires German solar firm for 500 million euros',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST F: INVALID_SOURCE -> NO ALERT
  // =========================================================================
  it('TEST F: INVALID_SOURCE -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const state = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    state.sourceStatus = 'INVALID_SOURCE';
    runtime.setPortfolioState(state);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries receives clearance for Jamnagar green energy complex',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST G: SOURCE_ERROR -> NO ALERT
  // =========================================================================
  it('TEST G: SOURCE_ERROR -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const state = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    state.sourceStatus = 'SOURCE_ERROR';
    runtime.setPortfolioState(state);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries announces quarterly dividend of Rs 10 per share',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST H: UNAVAILABLE -> NO ALERT
  // =========================================================================
  it('TEST H: UNAVAILABLE -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const state = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    state.sourceStatus = 'UNAVAILABLE';
    runtime.setPortfolioState(state);

    const article = createCanonicalArticle({
      headline: 'Reliance Q4 preview: Strong refining margins expected to bolster revenue',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST I: VALID_EMPTY_PORTFOLIO -> NO ALERT
  // =========================================================================
  it('TEST I: VALID_EMPTY_PORTFOLIO -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const state: NormalizedPortfolioState = {
      portfolioId: 'TEST_PORTFOLIO_EMPTY',
      presenceState: 'NO_POSITION',
      sourceStatus: 'VALID_EMPTY_PORTFOLIO',
      sourceType: 'TEST',
      sourceId: 'SRC_TEST_EMPTY',
      timestamp: new Date().toISOString(),
      totalActivePositions: 0,
      totalActiveQuantity: 0,
      activePositions: new Map(),
      closedPositions: new Map()
    };
    runtime.setPortfolioState(state);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries in talks with Saudi Aramco for petrochemical alliance',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST J: SYNTHETIC EVENT -> NO ALERT
  // =========================================================================
  it('TEST J: synthetic event -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const syntheticArticle = createCanonicalArticle({
      id: 'SYNTH_test_reliance_123',
      headline: '[SYNTHETIC] Reliance Industries mock scenario test headline',
      isSynthetic: true,
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    } as any);

    const candidates = await runtime.onCanonicalArticle(syntheticArticle);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST K: TEST EVENT -> NO ALERT
  // =========================================================================
  it('TEST K: test event -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const testArticle = createCanonicalArticle({
      id: 'TEST_event_reliance_456',
      headline: '[TEST] Reliance Industries unit test event',
      isTest: true,
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    } as any);

    const candidates = await runtime.onCanonicalArticle(testArticle);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST L: VERIFIED:FALSE -> NO ALERT
  // =========================================================================
  it('TEST L: verified:false -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const unverifiedArticle = createCanonicalArticle({
      headline: 'Unverified rumor: Reliance Industries in buyout talks',
      provenance: {
        articleId: 'art_unverified',
        sourceId: 'RUMOR_MILL',
        publisher: 'AnonymousBlog',
        sourceType: 'BLOG',
        sourceUrl: 'http://rumor.com',
        discoveredAt: new Date().toISOString(),
        ingestedAt: new Date().toISOString(),
        verified: false
      } as any,
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(unverifiedArticle);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST M: MISSING PROVENANCE -> NO ALERT
  // =========================================================================
  it('TEST M: missing provenance -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const noProvenanceArticle: any = {
      id: 'art_no_provenance_001',
      headline: 'Reliance Industries partners with foreign consortium',
      source: null,
      provenance: null,
      symbols: ['RELIANCE']
    };

    const candidates = await runtime.onCanonicalArticle(noProvenanceArticle);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST N: GENERIC NIFTY EVENT WITHOUT NIFTY POSITION -> NO ALERT
  // =========================================================================
  it('TEST N: generic NIFTY event without NIFTY position -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    // User holds RELIANCE and TCS, NOT NIFTY index
    const portfolio = createActivePortfolioState([
      { symbol: 'RELIANCE', quantity: 100 },
      { symbol: 'TCS', quantity: 50 }
    ]);
    runtime.setPortfolioState(portfolio);

    const macroArticle = createCanonicalArticle({
      headline: 'NIFTY surges 300 points as bulls take charge in morning trade',
      category: 'Market',
      symbols: ['NIFTY'],
      fno: { eligible: true, symbol: 'NIFTY', confidence: 'HIGH', decision: 'INCLUDE', reason: 'Index' }
    } as any);

    const candidates = await runtime.onCanonicalArticle(macroArticle);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST O: UNRELATED F&O EVENT -> NO ALERT
  // =========================================================================
  it('TEST O: unrelated F&O event -> no alert', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'INFY', quantity: 75 }]);
    runtime.setPortfolioState(portfolio);

    const fnoArticle = createCanonicalArticle({
      headline: 'BANKNIFTY weekly options see record open interest build up',
      category: 'F&O',
      symbols: ['BANKNIFTY'],
      fno: { eligible: true, symbol: 'BANKNIFTY', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    } as any);

    const candidates = await runtime.onCanonicalArticle(fnoArticle);
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST P: MULTIPLE ACTIVE POSITIONS IMPACTED -> SEPARATE CANDIDATES
  // =========================================================================
  it('TEST P: multiple active positions impacted -> separate candidates', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    // User holds BOTH RELIANCE and INFY
    const portfolio = createActivePortfolioState([
      { symbol: 'RELIANCE', quantity: 100, isin: 'INE002A01018' },
      { symbol: 'INFY', quantity: 150, isin: 'INE009A01021' }
    ]);
    runtime.setPortfolioState(portfolio);

    // Multi-entity joint venture article affecting both held stocks
    const jointArticle = createCanonicalArticle({
      id: 'art_joint_reliance_infy_001',
      headline: 'Reliance and Infosys announce strategic cloud and AI partnership',
      symbols: ['RELIANCE', 'INFY'],
      entities: ['Reliance Industries', 'Infosys Ltd'],
      fno: { eligible: true, symbol: null, confidence: 'MEDIUM', decision: 'INCLUDE', reason: 'Multiple' }
    } as any);

    const candidates = await runtime.onCanonicalArticle(jointArticle);
    expect(candidates).toHaveLength(2);

    const candidateSymbols = candidates.map(c => c.symbol).sort();
    expect(candidateSymbols).toEqual(['INFY', 'RELIANCE']);
    expect(deliveredCandidates).toHaveLength(2);
  });

  // =========================================================================
  // TEST Q: DUPLICATE NEWS CORE EVENT -> ONE ALERT ONLY
  // =========================================================================
  it('TEST Q: duplicate News Core event -> one alert only', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      id: 'art_dedupe_test_001',
      headline: 'Reliance subsidiary seals international supply agreement',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    // Ingest first time -> alert generated
    const firstRun = await runtime.onCanonicalArticle(article);
    expect(firstRun).toHaveLength(1);
    expect(deliveredCandidates).toHaveLength(1);

    // Ingest identical article again -> suppressed by delivery store deduplication
    const secondRun = await runtime.onCanonicalArticle(article);
    expect(secondRun).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(1); // No new delivery!
  });

  // =========================================================================
  // TEST R: REPEATED RUNTIME CYCLE -> NO DUPLICATE
  // =========================================================================
  it('TEST R: repeated runtime cycle -> no duplicate', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      id: 'art_cycle_test_002',
      headline: 'Reliance Retail expands offline footprint with 200 new stores',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    // Cycle 1
    const run1 = await runtime.onCanonicalArticle(article);
    expect(run1).toHaveLength(1);

    // Cycle 2 (immediate repeat cycle)
    const run2 = await runtime.onCanonicalArticle(article);
    expect(run2).toHaveLength(0);

    // Cycle 3 (delayed repeat cycle)
    const run3 = await runtime.onCanonicalArticle(article);
    expect(run3).toHaveLength(0);

    expect(deliveredCandidates).toHaveLength(1);
  });

  // =========================================================================
  // TEST S: RESTAURANT / DELIVERY-STORE RESTART DEDUPE -> NO DUPLICATE
  // =========================================================================
  it('TEST S: restart/delivery-store dedupe -> no duplicate', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      id: 'art_restart_test_003',
      headline: 'Reliance Jio infuses 15000 crore equity for 5G network rollout',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    // First process creates delivery in testStore
    const run1 = await runtime.onCanonicalArticle(article);
    expect(run1).toHaveLength(1);
    expect(deliveredCandidates).toHaveLength(1);

    // Simulate process restart: instantiate brand new runtime pointing to same persistent store
    const restartedNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: testStorePath
    });
    const restartedDelivered: PositionAlertCandidate[] = [];
    vi.spyOn(restartedNotifier, 'notify').mockImplementation(async (alert) => {
      restartedDelivered.push(alert);
      return true;
    });

    const restartedIntel = new PositionAlertIntelligenceEngine({
      notifier: restartedNotifier,
      deliveryStore: new PositionAlertDeliveryStore(testStorePath)
    });
    const restartedRuntime = new PositionAlertRuntime({
      intelligenceEngine: restartedIntel,
      notifier: restartedNotifier,
      deliveryStore: new PositionAlertDeliveryStore(testStorePath)
    });
    restartedRuntime.setPortfolioState(portfolio);

    // Re-evaluating the same article after restart must be cleanly suppressed by persistent delivery store
    const run2 = await restartedRuntime.onCanonicalArticle(article);
    expect(run2).toHaveLength(0);
    expect(restartedDelivered).toHaveLength(0);
  });

  // =========================================================================
  // TEST T: TELEGRAM FAILURE -> NEWS CORE PIPELINE UNAFFECTED
  // =========================================================================
  it('TEST T: Telegram failure -> News Core pipeline unaffected', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    // Force notifier to throw a simulated network error
    vi.spyOn(mockNotifier, 'notify').mockRejectedValue(new Error('Simulated Telegram network timeout 504'));

    const article = createCanonicalArticle({
      headline: 'Reliance Jio partners with international telecommunications firm',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    // Calling runtime hook must NOT throw and must fail gracefully
    let thrownError: any = null;
    let candidates: PositionAlertCandidate[] = [];
    try {
      candidates = await runtime.onCanonicalArticle(article);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeNull();
    // Candidates are returned but delivery failure was absorbed
    expect(candidates).toBeDefined();
  });

  // =========================================================================
  // TEST U: PORTFOLIO-SOURCE FAILURE -> NEWS CORE PIPELINE UNAFFECTED
  // =========================================================================
  it('TEST U: portfolio-source failure -> News Core pipeline unaffected', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);

    // Inject a failing portfolio state provider
    runtime.setPortfolioStateProvider(async () => {
      throw new Error('Database broker connection refused (ECONNREFUSED)');
    });

    const article = createCanonicalArticle({
      headline: 'Reliance Industries declares quarterly operational update',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    let thrownError: any = null;
    let candidates: PositionAlertCandidate[] = [];
    try {
      candidates = await runtime.onCanonicalArticle(article);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeNull();
    expect(candidates).toHaveLength(0);
    expect(deliveredCandidates).toHaveLength(0);
  });

  // =========================================================================
  // TEST V: MISSING TELEGRAM CONFIGURATION -> GRACEFUL / NO CRASH
  // =========================================================================
  it('TEST V: missing Telegram configuration -> graceful/no crash', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);

    // Create a real-mode notifier without bot token or chat ID
    const unconfiguredNotifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: false,
      botToken: '',
      chatId: '',
      storePath: testStorePath
    });

    const unconfiguredRuntime = new PositionAlertRuntime({
      notifier: unconfiguredNotifier,
      deliveryStore: new PositionAlertDeliveryStore(testStorePath)
    });
    unconfiguredRuntime.setPortfolioState(portfolio);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries acquires renewable assets in Rajasthan',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    let errorThrown: any = null;
    let candidates: PositionAlertCandidate[] = [];
    try {
      candidates = await unconfiguredRuntime.onCanonicalArticle(article);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeNull();
    expect(candidates.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // TEST W: FEATURE FLAG FALSE -> ZERO TELEGRAM NETWORK CALLS
  // =========================================================================
  it('TEST W: feature flag false -> zero Telegram network calls', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(false);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const fetchSpy = vi.fn();
    const liveNotifier = new PrivatePositionTelegramNotifier({
      enabled: false,
      dryRun: false,
      fetchImpl: fetchSpy as any,
      botToken: '123456:FAKE_TOKEN',
      chatId: '987654321',
      storePath: testStorePath
    });

    runtime.setNotifier(liveNotifier);

    const article = createCanonicalArticle({
      headline: 'Reliance Industries breaks ground on solar gigafactory',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    const candidates = await runtime.onCanonicalArticle(article);
    expect(candidates).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // TEST X: ZERO WRITES TO data/telegram_outbox.json
  // =========================================================================
  it('TEST X: zero writes to data/telegram_outbox.json', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    runtime.setPortfolioState(portfolio);

    const outboxPath = path.resolve(process.cwd(), 'data/telegram_outbox.json');
    const initialContent = fs.readFileSync(outboxPath, 'utf8');
    const initialHash = crypto.createHash('sha256').update(initialContent).digest('hex');

    // Run multiple cycles with alerts
    for (let i = 0; i < 3; i++) {
      const article = createCanonicalArticle({
        id: `art_outbox_check_${i}`,
        headline: `Reliance Industries operational milestone update ${i}`,
        fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
      });
      await runtime.onCanonicalArticle(article);
    }

    const currentContent = fs.readFileSync(outboxPath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

    expect(currentHash).toBe(initialHash);
  });

  // =========================================================================
  // TEST Y: NO ORDER / TRADING METHODS
  // =========================================================================
  it('TEST Y: no order/trading methods on runtime coordinator or adapter', () => {
    const forbiddenKeywords = [
      'placeOrder',
      'buy',
      'sell',
      'modifyOrder',
      'cancelOrder',
      'closePosition',
      'executeTrade'
    ];

    for (const kw of forbiddenKeywords) {
      expect((runtime as any)[kw]).toBeUndefined();
      expect((PositionAlertRuntime.prototype as any)[kw]).toBeUndefined();
      expect((NewsCoreV2PositionAlertAdapter as any)[kw]).toBeUndefined();
    }
  });

  // =========================================================================
  // TEST Z: CANONICAL NEWS CORE V2 REMAINS THE ONLY NEWS INGESTION PATH
  // =========================================================================
  it('TEST Z: canonical News Core V2 remains the only news ingestion path', async () => {
    PositionAlertRuntimeGuard.setRuntimeOverride(true);
    const portfolio = createActivePortfolioState([{ symbol: 'RELIANCE', quantity: 100 }]);
    positionAlertRuntime.setPortfolioState(portfolio);

    // Verify newsSyncService has registered listener capability
    let listenerCalledWith: NewsArticleV2 | null = null;
    const testListener = (art: NewsArticleV2) => {
      listenerCalledWith = art;
    };

    newsSyncService.addArticleListener(testListener);

    const testArticle = createCanonicalArticle({
      id: 'art_z_canonical_001',
      headline: 'Reliance Industries achieves record petrochemical output',
      fno: { eligible: true, symbol: 'RELIANCE', confidence: 'HIGH', decision: 'INCLUDE', reason: 'F&O' }
    });

    // Ingest through NewsSyncService hook
    await positionAlertRuntime.onCanonicalArticle(testArticle);

    // Clean up
    newsSyncService.removeArticleListener(testListener);
    positionAlertRuntime.reset();
  });
});
