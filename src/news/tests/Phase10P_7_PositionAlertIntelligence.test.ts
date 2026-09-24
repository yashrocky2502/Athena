/**
 * ATHENA — PHASE 10P-7: REAL POSITION-ALERT INTELLIGENCE INTEGRATION TEST SUITE
 * Phase10P_7_PositionAlertIntelligence.test.ts
 * 
 * Strict deterministic verification of:
 * A. no active positions -> no alert
 * B. valid active position + unrelated news -> no alert
 * C. valid active position + exact symbol event -> alert candidate
 * D. valid active position + exact ISIN event -> alert candidate
 * E. valid active position + exact exchange/symbol -> alert candidate
 * F. valid active position + canonical underlying -> alert candidate
 * G. valid active position + structured entity -> alert candidate
 * H. closed position + matching event -> no alert
 * I. invalid portfolio source -> no alert
 * J. source error -> no alert
 * K. unavailable source -> no alert
 * L. authoritative empty portfolio -> no alert
 * M. invalid provenance -> no alert
 * N. synthetic event -> no alert
 * O. test event -> no alert
 * P. verified:false -> no alert
 * Q. generic NIFTY/SENSEX/macro event with no held instrument -> no alert
 * R. unrelated F&O movement -> no alert
 * S. event affecting multiple active positions -> correct candidates only
 * T. duplicate event -> suppressed
 * U. repeated monitoring cycle -> no duplicate
 * V. restart -> existing delivery dedupe prevents duplicate
 * W. closed position cannot be reactivated by news
 * X. no mutation of data/telegram_outbox.json
 * Y. no trading/order execution capability
 * Z. candidate contains valid positionId + provenance + deterministic dedupeKey
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  NormalizedPosition,
  NormalizedPortfolioState,
  PositionNewsEventInput,
  PositionAlertCandidate
} from '../portfolio/alerts/types.ts';
import {
  PositionAlertIntelligenceEngine,
  PositionRelevanceEngine,
  PositionAlertEngine,
  PositionAlertDeliveryStore,
  PrivatePositionTelegramNotifier,
  MockPositionAlertNotifier,
  PositionMonitor,
  PortfolioReconciliationEngine,
  resolveDeterministicPositionId
} from '../portfolio/alerts/index.ts';

const PROTECTED_DATA_FILES = [
  'data/portfolio_store.json',
  'data/telegram_outbox.json',
  'data/news_core_v2.json',
  'data/news_intelligence_v2.json',
  'data/market_intelligence_outcomes.json',
  'data/news_signal_lifecycle.json',
  'data/news_signal_historical_ledger.json'
];

function computeFileHash(filePath: string): string | null {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Phase 10P-7: Real Position-Alert Intelligence Integration', () => {
  let fileHashesBefore: Record<string, string | null> = {};
  let tempStoreDir: string;
  let tempStorePath: string;
  let reconciliationEngine: PortfolioReconciliationEngine;

  beforeEach(() => {
    // 1. Audit hashes of protected data files before each test
    fileHashesBefore = {};
    for (const file of PROTECTED_DATA_FILES) {
      fileHashesBefore[file] = computeFileHash(file);
    }

    // 2. Set up isolated test storage
    tempStoreDir = path.join(process.cwd(), 'temp_test_stores', `test_p10p7_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    fs.mkdirSync(tempStoreDir, { recursive: true });
    tempStorePath = path.join(tempStoreDir, 'position_alerts_delivery.json');

    reconciliationEngine = PortfolioReconciliationEngine.getInstance();
  });

  afterEach(() => {
    // 1. Verify zero mutation to protected files
    for (const file of PROTECTED_DATA_FILES) {
      const hashAfter = computeFileHash(file);
      expect(hashAfter, `Protected file ${file} was unexpectedly mutated`).toBe(fileHashesBefore[file]);
    }

    // 2. Clean up temporary test directory
    try {
      if (fs.existsSync(tempStoreDir)) {
        fs.rmSync(tempStoreDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Safe cleanup
    }
  });

  // Helper to build a clean active state
  function createActiveState(positions: NormalizedPosition[]): NormalizedPortfolioState {
    const activeMap = new Map<string, NormalizedPosition>();
    let totalQty = 0;
    for (const p of positions) {
      activeMap.set(p.positionId, p);
      totalQty += p.quantity;
    }
    return {
      portfolioId: 'TEST_PORTFOLIO',
      sourceId: 'TEST_SOURCE',
      sourceType: 'CSV',
      sourceStatus: 'VALID_ACTIVE',
      presenceState: positions.length > 0 ? 'POSITION_EXISTS' : 'NO_POSITION',
      timestamp: '2026-09-24T10:00:00.000Z',
      activePositions: activeMap,
      closedPositions: new Map(),
      totalActivePositions: positions.length,
      totalActiveQuantity: totalQty
    };
  }

  // =========================================================================
  // TEST A: NO ACTIVE POSITIONS -> NO ALERT
  // =========================================================================
  it('TEST A: Returns zero alerts when there are no active positions', async () => {
    const emptyState = reconciliationEngine.createInitialState();
    const intelligenceEngine = new PositionAlertIntelligenceEngine({
      portfolioState: emptyState
    });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_101',
      headline: 'Reliance Industries announces major green hydrogen project',
      symbols: ['RELIANCE'],
      source: 'REUTERS',
      publisher: 'Reuters Finance',
      publishedAt: '2026-09-24T10:00:00.000Z',
      category: 'BUSINESS'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST B: VALID ACTIVE POSITION + UNRELATED NEWS -> NO ALERT
  // =========================================================================
  it('TEST B: Valid active position with completely unrelated news emits zero alerts', async () => {
    const activePos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([activePos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_TCS_201',
      headline: 'Tata Consultancy Services Q2 profit beats estimates by 8%',
      symbols: ['TCS'],
      source: 'BLOOMBERG',
      publisher: 'Bloomberg Quint',
      publishedAt: '2026-09-24T10:00:00.000Z',
      category: 'EARNINGS'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST C: VALID ACTIVE POSITION + EXACT SYMBOL EVENT -> ALERT CANDIDATE
  // =========================================================================
  it('TEST C: Valid active position with exact symbol match produces alert candidate', async () => {
    const activePos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 100,
      averagePrice: 1550,
      currentPrice: 1620,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([activePos]);
    const mockNotifier = new MockPositionAlertNotifier();
    const intelligenceEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier
    });

    const event: PositionNewsEventInput = {
      id: 'NEWS_INFY_301',
      headline: 'Infosys board approves INR 9,300 crore share buyback and special dividend',
      symbols: ['INFY'],
      source: 'MONEYCONTROL',
      publisher: 'Moneycontrol News',
      publishedAt: '2026-09-24T10:15:00.000Z',
      category: 'CORPORATE_ACTION'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBe('POS_NSE_INFY_EQUITY');
    expect(alerts[0].symbol).toBe('INFY');
    expect(alerts[0].alertType).toBe('CORPORATE_ACTION');
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(alerts[0].reason).toContain('share buyback');
    expect(mockNotifier.dispatchedAlerts.length).toBe(1);
    expect(mockNotifier.dispatchedAlerts[0].positionId).toBe('POS_NSE_INFY_EQUITY');
  });

  // =========================================================================
  // TEST D: VALID ACTIVE POSITION + EXACT ISIN EVENT -> ALERT CANDIDATE
  // =========================================================================
  it('TEST D: Valid active position with exact ISIN match produces alert candidate', async () => {
    const activePos: NormalizedPosition = {
      positionId: 'POS_ISIN_INE002A01018',
      symbol: 'RELIANCE',
      isin: 'INE002A01018',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([activePos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_ISIN_401',
      headline: 'SEBI issues regulatory ruling on entity securities',
      isin: 'INE002A01018',
      source: 'CNBC_TV18',
      publisher: 'CNBC TV18',
      publishedAt: '2026-09-24T10:20:00.000Z',
      category: 'REGULATORY'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBe('POS_ISIN_INE002A01018');
    expect(alerts[0].symbol).toBe('RELIANCE');
    expect(alerts[0].alertType).toBe('REGULATORY_EVENT');
    expect(alerts[0].severity).toBe('CRITICAL');
  });

  // =========================================================================
  // TEST E: VALID ACTIVE POSITION + EXACT EXCHANGE/SYMBOL -> ALERT CANDIDATE
  // =========================================================================
  it('TEST E: Valid active position with exact exchange + symbol match produces alert candidate', async () => {
    const activePos: NormalizedPosition = {
      positionId: 'POS_NSE_HDFCBANK_EQUITY',
      symbol: 'HDFCBANK',
      exchange: 'NSE',
      quantity: 200,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([activePos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_EXCH_501',
      headline: 'HDFC Bank reports 19% YoY growth in net profit for Q1',
      exchange: 'NSE',
      symbols: ['HDFCBANK'],
      source: 'LIVE_MINT',
      publisher: 'LiveMint',
      publishedAt: '2026-09-24T10:30:00.000Z',
      category: 'EARNINGS'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBe('POS_NSE_HDFCBANK_EQUITY');
    expect(alerts[0].symbol).toBe('HDFCBANK');
    expect(alerts[0].alertType).toBe('RESULTS_EVENT');
  });

  // =========================================================================
  // TEST F: VALID ACTIVE POSITION + CANONICAL UNDERLYING -> ALERT CANDIDATE
  // =========================================================================
  it('TEST F: Derivative position matching canonical underlying symbol produces alert candidate', async () => {
    const activeDerivativePos: NormalizedPosition = {
      positionId: 'POS_NFO_TCS_FUT',
      symbol: 'TCS26OCTFUT',
      underlyingSymbol: 'TCS',
      assetClass: 'FUTURES',
      quantity: 175,
      source: 'CSV',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([activeDerivativePos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_TCS_601',
      headline: 'TCS wins landmark 1 Billion USD digital transformation deal in UK',
      symbols: ['TCS'],
      source: 'ECONOMIC_TIMES',
      publisher: 'The Economic Times',
      publishedAt: '2026-09-24T10:35:00.000Z',
      category: 'BUSINESS'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBe('POS_NFO_TCS_FUT');
    expect(alerts[0].symbol).toBe('TCS26OCTFUT');
  });

  // =========================================================================
  // TEST G: VALID ACTIVE POSITION + STRUCTURED ENTITY -> ALERT CANDIDATE
  // =========================================================================
  it('TEST G: Valid active position matching structured entity identifier produces alert candidate', async () => {
    const activePos: NormalizedPosition = {
      positionId: 'POS_NSE_WIPRO_EQUITY',
      symbol: 'WIPRO',
      quantity: 150,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([activePos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_WIPRO_701',
      headline: 'Wipro CEO resigns, board appoints new chief executive officer',
      entities: ['NSE:WIPRO'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T10:40:00.000Z',
      category: 'MANAGEMENT_CHANGE'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(1);
    expect(alerts[0].positionId).toBe('POS_NSE_WIPRO_EQUITY');
    expect(alerts[0].symbol).toBe('WIPRO');
    expect(alerts[0].alertType).toBe('MATERIAL_COMPANY_EVENT');
    expect(alerts[0].severity).toBe('CRITICAL');
  });

  // =========================================================================
  // TEST H: CLOSED POSITION + MATCHING EVENT -> NO ALERT
  // =========================================================================
  it('TEST H: Reconciled closed position never receives news alerts', async () => {
    const closedPos: NormalizedPosition = {
      positionId: 'POS_NSE_SBIN_EQUITY',
      symbol: 'SBIN',
      quantity: 0,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T09:00:00.000Z'
    };
    const closedMap = new Map<string, NormalizedPosition>();
    closedMap.set(closedPos.positionId, closedPos);

    const state: NormalizedPortfolioState = {
      portfolioId: 'TEST_PORTFOLIO',
      sourceId: 'TEST_SOURCE',
      sourceType: 'CSV',
      sourceStatus: 'VALID_ACTIVE',
      presenceState: 'POSITION_EXISTS',
      timestamp: '2026-09-24T10:00:00.000Z',
      activePositions: new Map(), // ZERO active positions
      closedPositions: closedMap,
      totalActivePositions: 0,
      totalActiveQuantity: 0
    };

    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_SBIN_801',
      headline: 'State Bank of India declares record quarterly profit and dividend',
      symbols: ['SBIN'],
      source: 'BLOOMBERG',
      publisher: 'Bloomberg',
      publishedAt: '2026-09-24T10:45:00.000Z',
      category: 'EARNINGS'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST I: INVALID PORTFOLIO SOURCE -> NO ALERT
  // =========================================================================
  it('TEST I: Source status INVALID_SOURCE fails closed with zero alerts', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 100,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    state.sourceStatus = 'INVALID_SOURCE';

    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_901',
      headline: 'Reliance announces major quarterly results',
      symbols: ['RELIANCE'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T10:50:00.000Z'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST J: SOURCE ERROR -> NO ALERT
  // =========================================================================
  it('TEST J: Source status SOURCE_ERROR fails closed with zero alerts', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 100,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    state.sourceStatus = 'SOURCE_ERROR';

    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_902',
      headline: 'Reliance announces material development',
      symbols: ['RELIANCE'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T10:50:00.000Z'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST K: UNAVAILABLE SOURCE -> NO ALERT
  // =========================================================================
  it('TEST K: Source status UNAVAILABLE fails closed with zero alerts', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 100,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    state.sourceStatus = 'UNAVAILABLE';

    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_903',
      headline: 'Reliance announces material development',
      symbols: ['RELIANCE'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T10:50:00.000Z'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST L: AUTHORITATIVE EMPTY PORTFOLIO -> NO ALERT
  // =========================================================================
  it('TEST L: Source status VALID_EMPTY_PORTFOLIO emits zero alerts', async () => {
    const state: NormalizedPortfolioState = {
      portfolioId: 'TEST_PORTFOLIO',
      sourceId: 'TEST_SOURCE',
      sourceType: 'CSV',
      sourceStatus: 'VALID_EMPTY_PORTFOLIO',
      presenceState: 'NO_POSITION',
      timestamp: '2026-09-24T10:00:00.000Z',
      activePositions: new Map(),
      closedPositions: new Map(),
      totalActivePositions: 0,
      totalActiveQuantity: 0
    };

    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_904',
      headline: 'Reliance announces material development',
      symbols: ['RELIANCE'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T10:50:00.000Z'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST M: INVALID PROVENANCE -> NO ALERT
  // =========================================================================
  it('TEST M: Event with missing publisher/source provenance fails closed', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_INFY_UNTRUSTED',
      headline: 'Infosys wins new contract',
      symbols: ['INFY']
      // missing publisher, source, and provenance source
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST N: SYNTHETIC EVENT -> NO ALERT
  // =========================================================================
  it('TEST N: Synthetic event is rejected by fail-closed provenance gate', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'SYNTH_INFY_123',
      headline: 'Synthetic mock alert for INFY',
      symbols: ['INFY'],
      source: 'MOCK',
      isSynthetic: true
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST O: TEST EVENT -> NO ALERT
  // =========================================================================
  it('TEST O: Test event prefix or flag is rejected by fail-closed provenance gate', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'TEST_INFY_999',
      headline: 'Test alert headline',
      symbols: ['INFY'],
      source: 'TEST_SOURCE',
      isTest: true
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST P: VERIFIED:FALSE -> NO ALERT
  // =========================================================================
  it('TEST P: Event with provenance verified: false is rejected', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_INFY_UNVERIFIED',
      headline: 'Unverified rumor regarding Infosys',
      symbols: ['INFY'],
      source: 'TWITTER',
      provenance: {
        source: 'TWITTER',
        verified: false
      }
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST Q: GENERIC NIFTY/SENSEX/MACRO EVENT WITH NO HELD INSTRUMENT -> NO ALERT
  // =========================================================================
  it('TEST Q: Generic benchmark/macro event (NIFTY/SENSEX/CRUDE) emits zero alerts when not held', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_TCS_EQUITY',
      symbol: 'TCS',
      quantity: 100,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const macroEvents: PositionNewsEventInput[] = [
      {
        id: 'NEWS_MACRO_1',
        headline: 'NIFTY plunges 350 points amid global risk-off sentiment',
        symbols: ['NIFTY'],
        source: 'BLOOMBERG',
        publisher: 'Bloomberg Quint',
        publishedAt: '2026-09-24T11:00:00.000Z'
      },
      {
        id: 'NEWS_MACRO_2',
        headline: 'Sensex gains 500 points in early morning trade',
        symbols: ['SENSEX'],
        source: 'REUTERS',
        publisher: 'Reuters',
        publishedAt: '2026-09-24T11:05:00.000Z'
      },
      {
        id: 'NEWS_MACRO_3',
        headline: 'Brent Crude spikes 4% following supply disruption',
        symbols: ['CRUDEOIL'],
        source: 'CNBC',
        publisher: 'CNBC',
        publishedAt: '2026-09-24T11:10:00.000Z'
      }
    ];

    for (const ev of macroEvents) {
      const alerts = await intelligenceEngine.processEvent(ev);
      expect(alerts.length).toBe(0);
    }
  });

  // =========================================================================
  // TEST R: UNRELATED F&O MOVEMENT -> NO ALERT
  // =========================================================================
  it('TEST R: Unrelated F&O instrument movement emits zero alerts', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const foEvent: PositionNewsEventInput = {
      id: 'NEWS_FO_1',
      headline: 'BANKNIFTY 48000 Call options spike 200% on massive volume',
      symbols: ['BANKNIFTY'],
      source: 'MONEYCONTROL',
      publisher: 'Moneycontrol',
      publishedAt: '2026-09-24T11:15:00.000Z'
    };

    const alerts = await intelligenceEngine.processEvent(foEvent);
    expect(alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST S: EVENT AFFECTING MULTIPLE ACTIVE POSITIONS -> CORRECT CANDIDATES ONLY
  // =========================================================================
  it('TEST S: Event affecting multiple active positions produces candidates for each impacted position', async () => {
    const pos1: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const pos2: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 100,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const pos3: NormalizedPosition = {
      positionId: 'POS_NSE_TCS_EQUITY',
      symbol: 'TCS',
      quantity: 25,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };

    const state = createActiveState([pos1, pos2, pos3]);
    const mockNotifier = new MockPositionAlertNotifier();
    const intelligenceEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier
    });

    // Event affecting RELIANCE and INFY, but NOT TCS
    const multiEvent: PositionNewsEventInput = {
      id: 'NEWS_MULTI_1001',
      headline: 'SEBI issues direct compliance directive to Reliance and Infosys',
      symbols: ['RELIANCE', 'INFY'],
      source: 'ECONOMIC_TIMES',
      publisher: 'Economic Times',
      publishedAt: '2026-09-24T11:30:00.000Z',
      category: 'REGULATORY'
    };

    const alerts = await intelligenceEngine.processEvent(multiEvent);
    expect(alerts.length).toBe(2);

    const alertPosIds = alerts.map(a => a.positionId);
    expect(alertPosIds).toContain('POS_NSE_RELIANCE_EQUITY');
    expect(alertPosIds).toContain('POS_NSE_INFY_EQUITY');
    expect(alertPosIds).not.toContain('POS_NSE_TCS_EQUITY');
  });

  // =========================================================================
  // TEST T: DUPLICATE EVENT -> SUPPRESSED
  // =========================================================================
  it('TEST T: Duplicate news event is cleanly suppressed', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const mockNotifier = new MockPositionAlertNotifier();
    const intelligenceEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier
    });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_DUP_1',
      headline: 'Reliance announces major dividend distribution',
      symbols: ['RELIANCE'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T11:40:00.000Z',
      category: 'DIVIDEND'
    };

    const firstRun = await intelligenceEngine.processEvent(event);
    expect(firstRun.length).toBe(1);
    expect(mockNotifier.dispatchedAlerts.length).toBe(1);

    // Second evaluation of exact same event
    const secondRun = await intelligenceEngine.processEvent(event);
    expect(secondRun.length).toBe(0);
    expect(mockNotifier.dispatchedAlerts.length).toBe(1); // Not delivered again
  });

  // =========================================================================
  // TEST U: REPEATED MONITORING CYCLE -> NO DUPLICATE
  // =========================================================================
  it('TEST U: Repeated batch processing cycles emit zero duplicate alerts', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const mockNotifier = new MockPositionAlertNotifier();
    const intelligenceEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier: mockNotifier
    });

    const events: PositionNewsEventInput[] = [
      {
        id: 'NEWS_INFY_CYCLE_1',
        headline: 'Infosys board declares special dividend of INR 28 per share',
        symbols: ['INFY'],
        source: 'BLOOMBERG',
        publisher: 'Bloomberg Quint',
        publishedAt: '2026-09-24T11:50:00.000Z',
        category: 'DIVIDEND'
      }
    ];

    const cycle1 = await intelligenceEngine.processEvents(events);
    expect(cycle1.length).toBe(1);

    const cycle2 = await intelligenceEngine.processEvents(events);
    expect(cycle2.length).toBe(0);
  });

  // =========================================================================
  // TEST V: RESTART -> EXISTING DELIVERY DEDUPE PREVENTS DUPLICATE
  // =========================================================================
  it('TEST V: Process restart preserves delivery deduplication from persistent store', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_TCS_EQUITY',
      symbol: 'TCS',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);

    const deliveryStore1 = new PositionAlertDeliveryStore(tempStorePath);
    const notifier1 = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: tempStorePath
    });

    const engine1 = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      deliveryStore: deliveryStore1,
      notifier: notifier1
    });

    const event: PositionNewsEventInput = {
      id: 'NEWS_TCS_RESTART_1',
      headline: 'TCS announces strategic acquisition of European cloud consultancy',
      symbols: ['TCS'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T12:00:00.000Z',
      category: 'M&A'
    };

    const run1 = await engine1.processEvent(event);
    expect(run1.length).toBe(1);

    // Simulate process restart with brand new engine instance reading same store
    const deliveryStore2 = new PositionAlertDeliveryStore(tempStorePath);
    const notifier2 = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: tempStorePath
    });

    const engine2 = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      deliveryStore: deliveryStore2,
      notifier: notifier2
    });

    const run2 = await engine2.processEvent(event);
    expect(run2.length).toBe(0); // Suppressed by persistent store
  });

  // =========================================================================
  // TEST W: CLOSED POSITION CANNOT BE REACTIVATED BY NEWS
  // =========================================================================
  it('TEST W: Closed position is never reactivated or alerted by news', async () => {
    const closedPos: NormalizedPosition = {
      positionId: 'POS_NSE_WIPRO_EQUITY',
      symbol: 'WIPRO',
      quantity: 0,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T09:00:00.000Z'
    };
    const closedMap = new Map<string, NormalizedPosition>();
    closedMap.set(closedPos.positionId, closedPos);

    const state: NormalizedPortfolioState = {
      portfolioId: 'TEST_PORTFOLIO',
      sourceId: 'TEST_SOURCE',
      sourceType: 'CSV',
      sourceStatus: 'VALID_ACTIVE',
      presenceState: 'POSITION_EXISTS',
      timestamp: '2026-09-24T10:00:00.000Z',
      activePositions: new Map(),
      closedPositions: closedMap,
      totalActivePositions: 0,
      totalActiveQuantity: 0
    };

    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_WIPRO_REACTIVATE',
      headline: 'Wipro signs multi-year deal with global retail giant',
      symbols: ['WIPRO'],
      source: 'REUTERS',
      publisher: 'Reuters',
      publishedAt: '2026-09-24T12:10:00.000Z'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(0);

    // State remains completely intact (closed position is not altered)
    const currentState = intelligenceEngine.getPortfolioState();
    expect(currentState.activePositions.size).toBe(0);
    expect(currentState.closedPositions.has('POS_NSE_WIPRO_EQUITY')).toBe(true);
  });

  // =========================================================================
  // TEST X: NO MUTATION OF DATA/TELEGRAM_OUTBOX.JSON
  // =========================================================================
  it('TEST X: Complete pipeline execution causes ZERO mutations to data/telegram_outbox.json', async () => {
    const outboxPath = path.join(process.cwd(), 'data', 'telegram_outbox.json');
    const outboxHashBefore = computeFileHash('data/telegram_outbox.json');

    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_INFY_EQUITY',
      symbol: 'INFY',
      quantity: 50,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const notifier = new PrivatePositionTelegramNotifier({
      enabled: true,
      dryRun: true,
      storePath: tempStorePath
    });

    const intelligenceEngine = new PositionAlertIntelligenceEngine({
      portfolioState: state,
      notifier
    });

    const event: PositionNewsEventInput = {
      id: 'NEWS_INFY_OUTBOX_SAFE',
      headline: 'Infosys board meeting scheduled for quarterly financial results',
      symbols: ['INFY'],
      source: 'MONEYCONTROL',
      publisher: 'Moneycontrol',
      publishedAt: '2026-09-24T12:20:00.000Z',
      category: 'EARNINGS'
    };

    await intelligenceEngine.processEvent(event);

    const outboxHashAfter = computeFileHash('data/telegram_outbox.json');
    expect(outboxHashAfter).toBe(outboxHashBefore);
  });

  // =========================================================================
  // TEST Y: NO TRADING / ORDER EXECUTION CAPABILITY
  // =========================================================================
  it('TEST Y: Strictly read-only; zero trading/order execution methods exist', () => {
    const engine = new PositionAlertIntelligenceEngine();
    const forbiddenMethods = [
      'placeOrder',
      'buy',
      'sell',
      'modifyOrder',
      'cancelOrder',
      'closePosition',
      'executeTrade'
    ];

    for (const method of forbiddenMethods) {
      expect((engine as any)[method], `Forbidden trading method ${method} must not exist`).toBeUndefined();
    }
  });

  // =========================================================================
  // TEST Z: CANDIDATE CONTAINS VALID POSITIONID + PROVENANCE + DETERMINISTIC DEDUPEKEY
  // =========================================================================
  it('TEST Z: Candidate strictly contains valid positionId, provenance, and deterministic dedupeKey', async () => {
    const pos: NormalizedPosition = {
      positionId: 'POS_NSE_RELIANCE_EQUITY',
      symbol: 'RELIANCE',
      quantity: 100,
      averagePrice: 2800,
      currentPrice: 2950,
      source: 'CSV',
      assetClass: 'EQUITY',
      observedAt: '2026-09-24T10:00:00.000Z'
    };
    const state = createActiveState([pos]);
    const intelligenceEngine = new PositionAlertIntelligenceEngine({ portfolioState: state });

    const event: PositionNewsEventInput = {
      id: 'NEWS_REL_AUDIT_1',
      headline: 'Reliance announces strategic merger of retail division',
      symbols: ['RELIANCE'],
      source: 'BLOOMBERG',
      publisher: 'Bloomberg News',
      publishedAt: '2026-09-24T12:30:00.000Z',
      url: 'https://bloomberg.com/news/reliance-merger',
      category: 'M&A'
    };

    const alerts = await intelligenceEngine.processEvent(event);
    expect(alerts.length).toBe(1);

    const candidate = alerts[0];
    // Invariants
    expect(candidate.positionId).toBe('POS_NSE_RELIANCE_EQUITY');
    expect(candidate.symbol).toBe('RELIANCE');
    expect(candidate.alertType).toBe('MATERIAL_COMPANY_EVENT');
    expect(candidate.severity).toBe('CRITICAL');
    expect(candidate.reason).toContain('strategic merger');
    expect(candidate.timestamp).toBe('2026-09-24T12:30:00.000Z');
    expect(candidate.dedupeKey).toContain('dedupe::pos_rel::POS_NSE_RELIANCE_EQUITY::NEWS_REL_AUDIT_1');
    expect(candidate.provenance.source).toBe('BLOOMBERG');
    expect(candidate.provenance.publisher).toBe('Bloomberg News');
    expect(candidate.provenance.eventId).toBe('NEWS_REL_AUDIT_1');
    expect(candidate.provenance.url).toBe('https://bloomberg.com/news/reliance-merger');
  });
});
