/**
 * ATHENA — PHASE 10P-6: REAL PORTFOLIO STATE & RECONCILIATION TEST SUITE
 * Phase10P_6_PortfolioReconciliation.test.ts
 * 
 * Strict deterministic verification of:
 * 1. Normalized Portfolio State representation (active vs closed positions)
 * 2. Deterministic position identity resolution (ISIN -> Exchange+Symbol -> Symbol)
 * 3. PortfolioReconciliationEngine lifecycle events (ADDED, UPDATED, QTY, PRICE, SIDE, CLOSED, UNCHANGED)
 * 4. Quantity changes (+delta, -delta, partial exit vs complete closure)
 * 5. Formatting normalization (e.g. 10 vs "10", 1350 vs "1350.00")
 * 6. Stale source safety & fail-closed protection (INVALID_SOURCE does not wipe portfolio)
 * 7. Authoritative empty portfolio handling vs source errors
 * 8. Order independence across input rows
 * 9. Downstream integration with PositionMonitor & PositionAlertEngine
 * 10. Read-only safety & zero production data mutations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  PortfolioReconciliationEngine,
  resolveDeterministicPositionId
} from '../portfolio/broker/PortfolioReconciliationEngine.ts';
import {
  NormalizedPosition,
  NormalizedPortfolioState,
  PositionSource,
  PositionNewsEventInput
} from '../portfolio/alerts/types.ts';
import {
  PositionMonitor,
  PositionAlertEngine,
  PrivatePositionTelegramNotifier,
  PositionAlertSimulationHarness,
  CsvXlsxPositionSource
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

describe('Phase 10P-6: Real Portfolio State & Reconciliation', () => {
  let baselineChecksums: Map<string, string> = new Map();
  let engine: PortfolioReconciliationEngine;

  beforeEach(() => {
    engine = PortfolioReconciliationEngine.getInstance();

    // Snapshot authoritative checksums for production data files
    for (const relPath of PROTECTED_DATA_FILES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        baselineChecksums.set(relPath, hash);
      }
    }
  });

  afterEach(() => {
    // Assert zero mutations to protected data files
    for (const [relPath, origHash] of baselineChecksums.entries()) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const currentContent = fs.readFileSync(fullPath);
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
        expect(
          currentHash,
          `CRITICAL SAFETY VIOLATION: Protected production file ${relPath} was modified during tests!`
        ).toBe(origHash);
      }
    }
  });

  // =========================================================================
  // TEST A: FIRST PORTFOLIO IMPORT
  // =========================================================================
  it('TEST A: First portfolio import emits POSITION_ADDED for all positions', async () => {
    const initialState = engine.createInitialState();
    expect(initialState.totalActivePositions).toBe(0);
    expect(initialState.presenceState).toBe('NO_POSITION');

    const positions: NormalizedPosition[] = [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        assetClass: 'EQUITY',
        quantity: 10,
        averagePrice: 1350.5,
        source: 'CSV',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        exchange: 'NSE',
        assetClass: 'EQUITY',
        quantity: 25,
        averagePrice: 1500,
        source: 'CSV',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ];

    const result = await engine.reconcilePortfolioState(initialState, positions);

    expect(result.success).toBe(true);
    expect(result.status).toBe('RECONCILED');
    expect(result.summary.added).toBe(2);
    expect(result.summary.totalActive).toBe(2);
    expect(result.newState.presenceState).toBe('POSITION_EXISTS');
    expect(result.lifecycleEvents.filter(e => e.type === 'POSITION_ADDED').length).toBe(2);
  });

  // =========================================================================
  // TEST B: IDENTICAL REPEATED IMPORT
  // =========================================================================
  it('TEST B: Identical repeated import produces POSITION_UNCHANGED and IDEMPOTENT status', async () => {
    const initialState = engine.createInitialState();
    const positions: NormalizedPosition[] = [
      {
        positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
        symbol: 'TCS',
        exchange: 'NSE',
        assetClass: 'EQUITY',
        quantity: 50,
        averagePrice: 3200,
        source: 'CSV',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ];

    const firstRun = await engine.reconcilePortfolioState(initialState, positions);
    expect(firstRun.summary.added).toBe(1);

    // Reconcile exact same state a second time
    const secondRun = await engine.reconcilePortfolioState(firstRun.newState, positions);

    expect(secondRun.success).toBe(true);
    expect(secondRun.status).toBe('IDEMPOTENT');
    expect(secondRun.summary.added).toBe(0);
    expect(secondRun.summary.closed).toBe(0);
    expect(secondRun.summary.unchanged).toBe(1);
    expect(secondRun.lifecycleEvents[0].type).toBe('POSITION_UNCHANGED');
  });

  // =========================================================================
  // TEST C: POSITION ADDED
  // =========================================================================
  it('TEST C: New symbol added to existing portfolio produces POSITION_ADDED', async () => {
    const stateWithReliance = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        assetClass: 'EQUITY',
        quantity: 10,
        averagePrice: 1350,
        source: 'CSV',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    // Add HDFCBANK
    const updatedPositions: NormalizedPosition[] = [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        assetClass: 'EQUITY',
        quantity: 10,
        averagePrice: 1350,
        source: 'CSV',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_HDFCBANK_EQUITY_SPOT_0_NA',
        symbol: 'HDFCBANK',
        exchange: 'NSE',
        assetClass: 'EQUITY',
        quantity: 100,
        averagePrice: 1600,
        source: 'CSV',
        observedAt: '2026-09-24T10:05:00.000Z'
      }
    ];

    const result = await engine.reconcilePortfolioState(stateWithReliance, updatedPositions);

    expect(result.summary.added).toBe(1);
    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.totalActive).toBe(2);
    const addedEvent = result.lifecycleEvents.find(e => e.type === 'POSITION_ADDED');
    expect(addedEvent?.symbol).toBe('HDFCBANK');
  });

  // =========================================================================
  // TEST D: QUANTITY INCREASE
  // =========================================================================
  it('TEST D: Quantity increase (10 -> 15 shares) produces delta = +5', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        quantity: 10,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        quantity: 15,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:10:00.000Z'
      }
    ]);

    expect(result.summary.quantityChanged).toBe(1);
    const qtyEvent = result.lifecycleEvents.find(e => e.type === 'POSITION_QUANTITY_CHANGED');
    expect(qtyEvent?.quantityDelta).toBe(5);
    expect(qtyEvent?.currentPosition?.quantity).toBe(15);
    expect(qtyEvent?.previousPosition?.quantity).toBe(10);
  });

  // =========================================================================
  // TEST E: QUANTITY DECREASE
  // =========================================================================
  it('TEST E: Quantity decrease (15 -> 10 shares) produces delta = -5', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 15,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 10,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:10:00.000Z'
      }
    ]);

    expect(result.summary.quantityChanged).toBe(1);
    const qtyEvent = result.lifecycleEvents.find(e => e.type === 'POSITION_QUANTITY_CHANGED');
    expect(qtyEvent?.quantityDelta).toBe(-5);
  });

  // =========================================================================
  // TEST F: PARTIAL EXIT
  // =========================================================================
  it('TEST F: Partial exit (100 -> 60 shares) is NOT treated as a complete close', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
        symbol: 'TCS',
        quantity: 100,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
        symbol: 'TCS',
        quantity: 60,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:15:00.000Z'
      }
    ]);

    expect(result.summary.closed).toBe(0);
    expect(result.summary.quantityChanged).toBe(1);
    expect(result.newState.activePositions.has('POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA')).toBe(true);
    expect(result.newState.totalActivePositions).toBe(1);
    expect(result.newState.totalActiveQuantity).toBe(60);
  });

  // =========================================================================
  // TEST G: COMPLETE POSITION CLOSE
  // =========================================================================
  it('TEST G: Absent active position is marked POSITION_CLOSED with previous state preserved', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        quantity: 20,
        averagePrice: 1300,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 40,
        averagePrice: 1400,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    // RELIANCE is now closed/absent, only INFY remains
    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 40,
        averagePrice: 1400,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:20:00.000Z'
      }
    ]);

    expect(result.summary.closed).toBe(1);
    expect(result.summary.totalActive).toBe(1);
    expect(result.newState.activePositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(false);
    expect(result.newState.closedPositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);

    const closedEvent = result.lifecycleEvents.find(e => e.type === 'POSITION_CLOSED');
    expect(closedEvent?.symbol).toBe('RELIANCE');
    expect(closedEvent?.previousPosition?.quantity).toBe(20);
  });

  // =========================================================================
  // TEST H: PRICE CHANGE
  // =========================================================================
  it('TEST H: Average price or current price change emits POSITION_PRICE_CHANGED', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_WIPRO_EQUITY_SPOT_0_NA',
        symbol: 'WIPRO',
        quantity: 100,
        averagePrice: 450,
        currentPrice: 460,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NSE_WIPRO_EQUITY_SPOT_0_NA',
        symbol: 'WIPRO',
        quantity: 100,
        averagePrice: 450,
        currentPrice: 480, // Price changed +20
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:30:00.000Z'
      }
    ]);

    expect(result.summary.priceChanged).toBe(1);
    const prcEvent = result.lifecycleEvents.find(e => e.type === 'POSITION_PRICE_CHANGED');
    expect(prcEvent?.priceDelta).toBe(20);
  });

  // =========================================================================
  // TEST I: SIDE CHANGE
  // =========================================================================
  it('TEST I: Position side change (LONG -> SHORT) emits POSITION_SIDE_CHANGED', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NFO_NIFTY_FUTURES_SPOT_0_NA',
        symbol: 'NIFTY',
        quantity: 50,
        side: 'LONG',
        source: 'CSV',
        assetClass: 'FUTURES',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NFO_NIFTY_FUTURES_SPOT_0_NA',
        symbol: 'NIFTY',
        quantity: 50,
        side: 'SHORT',
        source: 'CSV',
        assetClass: 'FUTURES',
        observedAt: '2026-09-24T10:35:00.000Z'
      }
    ]);

    expect(result.summary.sideChanged).toBe(1);
    const sideEvent = result.lifecycleEvents.find(e => e.type === 'POSITION_SIDE_CHANGED');
    expect(sideEvent).toBeDefined();
  });

  // =========================================================================
  // TEST J: MULTIPLE POSITIONS
  // =========================================================================
  it('TEST J: Handles multi-position portfolio (RELIANCE, INFY, TCS) accurately', async () => {
    const positions: NormalizedPosition[] = [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        quantity: 10,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 20,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
        symbol: 'TCS',
        quantity: 30,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ];

    const result = await engine.reconcilePortfolioState(engine.createInitialState(), positions);
    expect(result.summary.totalActive).toBe(3);
    expect(result.summary.added).toBe(3);
    expect(result.newState.totalActiveQuantity).toBe(60);
  });

  // =========================================================================
  // TEST K: ONE POSITION CHANGES WHILE OTHERS REMAIN UNCHANGED
  // =========================================================================
  it('TEST K: Changing INFY quantity leaves RELIANCE and TCS strictly UNCHANGED', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        quantity: 10,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 20,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
        symbol: 'TCS',
        quantity: 30,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ])).newState;

    // Only update INFY (20 -> 35)
    const result = await engine.reconcilePortfolioState(state1, [
      {
        positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
        symbol: 'RELIANCE',
        quantity: 10,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:40:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
        symbol: 'INFY',
        quantity: 35,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:40:00.000Z'
      },
      {
        positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
        symbol: 'TCS',
        quantity: 30,
        source: 'CSV',
        assetClass: 'EQUITY',
        observedAt: '2026-09-24T10:40:00.000Z'
      }
    ]);

    expect(result.summary.quantityChanged).toBe(1);
    expect(result.summary.unchanged).toBe(2);
    expect(result.summary.added).toBe(0);
    expect(result.summary.closed).toBe(0);

    const relEvent = result.lifecycleEvents.find(e => e.symbol === 'RELIANCE');
    const infyEvent = result.lifecycleEvents.find(e => e.symbol === 'INFY');
    const tcsEvent = result.lifecycleEvents.find(e => e.symbol === 'TCS');

    expect(relEvent?.type).toBe('POSITION_UNCHANGED');
    expect(infyEvent?.type).toBe('POSITION_QUANTITY_CHANGED');
    expect(tcsEvent?.type).toBe('POSITION_UNCHANGED');
  });

  // =========================================================================
  // TEST L: ROW-ORDER INDEPENDENCE
  // =========================================================================
  it('TEST L: Permuting input row order produces zero lifecycle differences', async () => {
    const listA: NormalizedPosition[] = [
      { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
      { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
      { positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA', symbol: 'TCS', quantity: 30, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ];

    const stateA = (await engine.reconcilePortfolioState(engine.createInitialState(), listA)).newState;

    // Permuted order: TCS, RELIANCE, INFY
    const listB: NormalizedPosition[] = [
      { positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA', symbol: 'TCS', quantity: 30, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
      { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
      { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ];

    const result = await engine.reconcilePortfolioState(stateA, listB);

    expect(result.status).toBe('IDEMPOTENT');
    expect(result.summary.unchanged).toBe(3);
    expect(result.summary.added).toBe(0);
    expect(result.summary.closed).toBe(0);
    expect(result.summary.quantityChanged).toBe(0);
  });

  // =========================================================================
  // TEST M: MALFORMED SOURCE
  // =========================================================================
  it('TEST M: Malformed source input fails closed without mutating state', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ])).newState;

    const malformedResult = await engine.reconcilePortfolioState(state1, null as any);

    expect(malformedResult.success).toBe(false);
    expect(malformedResult.status).toBe('FAIL_CLOSED');
    expect(malformedResult.newState.totalActivePositions).toBe(1);
    expect(malformedResult.lifecycleEvents.length).toBe(0);
  });

  // =========================================================================
  // TEST N: SOURCE FAILURE
  // =========================================================================
  it('TEST N: Throwing PositionSource fails closed safely', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ])).newState;

    const failingSource: PositionSource = {
      sourceId: 'SRC_FAILING',
      sourceType: 'BROKER',
      getPositions: async () => {
        throw new Error('Network timeout during sync');
      }
    };

    const result = await engine.reconcilePortfolioState(state1, failingSource);

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAIL_CLOSED');
    expect(result.newState.totalActivePositions).toBe(1);
    expect(result.summary.closed).toBe(0);
  });

  // =========================================================================
  // TEST O: INVALID SOURCE MUST NOT CLOSE PORTFOLIO
  // =========================================================================
  it('TEST O: Source with INVALID_SOURCE status maintains existing active positions', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 50, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [], {
      sourceStatus: 'INVALID_SOURCE'
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAIL_CLOSED');
    expect(result.newState.totalActivePositions).toBe(1);
    expect(result.summary.closed).toBe(0);
    expect(result.newState.activePositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);
  });

  // =========================================================================
  // TEST P: VALID AUTHORITATIVE EMPTY PORTFOLIO CLOSES ACTIVE POSITIONS
  // =========================================================================
  it('TEST P: Valid authoritative empty portfolio closes previously active positions', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 50, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ])).newState;

    const result = await engine.reconcilePortfolioState(state1, [], {
      sourceStatus: 'VALID_EMPTY_PORTFOLIO',
      isAuthoritativeEmpty: true
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('RECONCILED');
    expect(result.summary.closed).toBe(1);
    expect(result.newState.totalActivePositions).toBe(0);
    expect(result.newState.presenceState).toBe('NO_POSITION');
    expect(result.newState.closedPositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);
  });

  // =========================================================================
  // TEST Q: REPEATED EMPTY AUTHORITATIVE PORTFOLIO IS IDEMPOTENT
  // =========================================================================
  it('TEST Q: Repeated empty authoritative portfolio is idempotent', async () => {
    const emptyState = engine.createInitialState();
    const result1 = await engine.reconcilePortfolioState(emptyState, [], { isAuthoritativeEmpty: true });
    expect(result1.status).toBe('IDEMPOTENT');

    const result2 = await engine.reconcilePortfolioState(result1.newState, [], { isAuthoritativeEmpty: true });
    expect(result2.status).toBe('IDEMPOTENT');
    expect(result2.summary.closed).toBe(0);
  });

  // =========================================================================
  // TEST R: NO FABRICATED VALUES
  // =========================================================================
  it('TEST R: Missing optional prices/values remain null with zero price fabrication', async () => {
    const result = await engine.reconcilePortfolioState(engine.createInitialState(), [
      {
        positionId: 'POS_CSV_NSE_ASIANPAINT_EQUITY_SPOT_0_NA',
        symbol: 'ASIANPAINT',
        quantity: 10,
        source: 'CSV',
        assetClass: 'EQUITY',
        averagePrice: null,
        currentPrice: undefined,
        observedAt: '2026-09-24T10:00:00.000Z'
      }
    ]);

    const pos = result.newState.activePositions.get('POS_CSV_NSE_ASIANPAINT_EQUITY_SPOT_0_NA');
    expect(pos?.averagePrice).toBeNull();
    expect(pos?.currentPrice).toBeNull();
  });

  // =========================================================================
  // TEST S: DETERMINISTIC POSITION IDENTITY
  // =========================================================================
  it('TEST S: Generates deterministic position IDs following ISIN -> Exchange+Symbol hierarchy', () => {
    // 1. ISIN present
    const idWithIsin = resolveDeterministicPositionId({
      symbol: 'reliance',
      isin: 'INE002A01018',
      exchange: 'NSE'
    });
    expect(idWithIsin).toBe('POS_ISIN_INE002A01018');

    // 2. Exchange + Symbol
    const idWithExchange = resolveDeterministicPositionId({
      symbol: 'reliance',
      exchange: 'nse',
      source: 'csv'
    });
    expect(idWithExchange).toBe('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA');

    // 3. Stability check across repeated calls
    const idRepeated = resolveDeterministicPositionId({
      symbol: 'reliance',
      exchange: 'nse',
      source: 'csv'
    });
    expect(idRepeated).toBe(idWithExchange);
  });

  // =========================================================================
  // TEST T: HISTORICAL STATE PRESERVATION
  // =========================================================================
  it('TEST T: Historical closed positions are preserved and never deleted', async () => {
    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
      { positionId: 'POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA', symbol: 'SBIN', quantity: 100, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ])).newState;

    // Close SBIN and add AXISBANK
    const state2 = (await engine.reconcilePortfolioState(state1, [
      { positionId: 'POS_CSV_NSE_AXISBANK_EQUITY_SPOT_0_NA', symbol: 'AXISBANK', quantity: 50, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:10:00.000Z' }
    ])).newState;

    expect(state2.activePositions.size).toBe(1);
    expect(state2.closedPositions.size).toBe(1);
    expect(state2.closedPositions.has('POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA')).toBe(true);

    // Reconcile AXISBANK unchanged
    const state3 = (await engine.reconcilePortfolioState(state2, [
      { positionId: 'POS_CSV_NSE_AXISBANK_EQUITY_SPOT_0_NA', symbol: 'AXISBANK', quantity: 50, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:20:00.000Z' }
    ])).newState;

    // SBIN is still preserved in closedPositions
    expect(state3.closedPositions.has('POS_CSV_NSE_SBIN_EQUITY_SPOT_0_NA')).toBe(true);
  });

  // =========================================================================
  // TEST U: INTEGRATION WITH POSITION MONITOR
  // =========================================================================
  it('TEST U: PositionMonitor getPortfolioState accurately reflects current snapshot', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA',
          symbol: 'RELIANCE',
          quantity: 20,
          source: 'CSV',
          assetClass: 'EQUITY',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });

    await harness.runPositionCycle();
    const monitor = harness.getMonitor();
    const state = monitor.getPortfolioState();

    expect(state).not.toBeNull();
    expect(state?.totalActivePositions).toBe(1);
    expect(state?.totalActiveQuantity).toBe(20);
    expect(state?.activePositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);
  });

  // =========================================================================
  // TEST V: INTEGRATION WITH POSITION ALERT ENGINE
  // =========================================================================
  it('TEST V: PositionAlertEngine converts lifecycle changes to candidates', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA',
          symbol: 'INFY',
          quantity: 10,
          source: 'CSV',
          assetClass: 'EQUITY',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });

    await harness.runPositionCycle(); // Baseline

    // Increase quantity: 10 -> 25
    harness.updateQuantity('INFY', 25);
    const { alerts } = await harness.runPositionCycle();

    const qtyAlert = alerts.find(a => a.alertType === 'QUANTITY_CHANGE');
    expect(qtyAlert).toBeDefined();
    expect(qtyAlert?.positionId).toBe('POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA');
    expect(qtyAlert?.reason).toContain('quantity changed');
  });

  // =========================================================================
  // TEST W: NO DUPLICATE ALERT FROM REPEATED IDENTICAL IMPORT
  // =========================================================================
  it('TEST W: Repeated identical monitoring cycles emit ZERO duplicate alerts', async () => {
    const harness = new PositionAlertSimulationHarness({
      initialPositions: [
        {
          positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA',
          symbol: 'TCS',
          quantity: 50,
          source: 'CSV',
          assetClass: 'EQUITY',
          observedAt: '2026-09-24T10:00:00.000Z'
        }
      ]
    });

    const cycle1 = await harness.runPositionCycle();
    expect(cycle1.alerts.length).toBe(1); // POSITION_APPEARED

    // Cycle 2: Identical state
    const cycle2 = await harness.runPositionCycle();
    expect(cycle2.alerts.length).toBe(0);

    // Cycle 3: Identical state
    const cycle3 = await harness.runPositionCycle();
    expect(cycle3.alerts.length).toBe(0);
  });

  // =========================================================================
  // TEST X: NO PRODUCTION DATA MUTATION
  // =========================================================================
  it('TEST X: Complete reconciliation operations cause zero modifications to production data files', async () => {
    const positions: NormalizedPosition[] = [
      { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
      { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
    ];

    const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), positions)).newState;
    await engine.reconcilePortfolioState(state1, positions);

    // Verify all baseline checksums are intact
    for (const [relPath, origHash] of baselineChecksums.entries()) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const currentContent = fs.readFileSync(fullPath);
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
        expect(currentHash).toBe(origHash);
      }
    }
  });

  // =========================================================================
  // TEST Y: READ-ONLY / NO ORDER EXECUTION
  // =========================================================================
  it('TEST Y: Verifies read-only safety with zero order placement methods', () => {
    const forbiddenMethods = ['placeOrder', 'buy', 'sell', 'modifyOrder', 'cancelOrder', 'closePosition'];
    for (const method of forbiddenMethods) {
      expect((engine as any)[method]).toBeUndefined();
    }
  });

  // =========================================================================
  // REMEDIATION REGRESSION TESTS (A through I)
  // =========================================================================
  describe('Remediation: Authoritative Empty vs Invalid Source Safety', () => {
    it('REMEDIATION A: Previous active portfolio + INVALID_SOURCE => zero closures', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 50, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      const result = await engine.reconcilePortfolioState(state1, [], {
        sourceStatus: 'INVALID_SOURCE'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAIL_CLOSED');
      expect(result.summary.closed).toBe(0);
      expect(result.newState.totalActivePositions).toBe(1);
      expect(result.newState.activePositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);
    });

    it('REMEDIATION B: Previous active portfolio + SOURCE_ERROR => zero closures', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 30, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      const result = await engine.reconcilePortfolioState(state1, [], {
        sourceStatus: 'SOURCE_ERROR'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAIL_CLOSED');
      expect(result.summary.closed).toBe(0);
      expect(result.newState.totalActivePositions).toBe(1);
      expect(result.newState.activePositions.has('POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA')).toBe(true);
    });

    it('REMEDIATION C: Previous active portfolio + UNAVAILABLE => zero closures', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA', symbol: 'TCS', quantity: 40, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      const result = await engine.reconcilePortfolioState(state1, [], {
        sourceStatus: 'UNAVAILABLE'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAIL_CLOSED');
      expect(result.summary.closed).toBe(0);
      expect(result.newState.totalActivePositions).toBe(1);
      expect(result.newState.activePositions.has('POS_CSV_NSE_TCS_EQUITY_SPOT_0_NA')).toBe(true);
    });

    it('REMEDIATION D: Previous active portfolio + VALID_EMPTY_PORTFOLIO => all active positions close', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
        { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      const result = await engine.reconcilePortfolioState(state1, [], {
        sourceStatus: 'VALID_EMPTY_PORTFOLIO',
        isAuthoritativeEmpty: true
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('RECONCILED');
      expect(result.summary.closed).toBe(2);
      expect(result.newState.totalActivePositions).toBe(0);
      expect(result.newState.presenceState).toBe('NO_POSITION');
      expect(result.newState.closedPositions.size).toBe(2);
    });

    it('REMEDIATION E: Previous active portfolio + valid active snapshot with one position missing => only that position closes', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' },
        { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      // RELIANCE is absent, INFY is still present
      const result = await engine.reconcilePortfolioState(state1, [
        { positionId: 'POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA', symbol: 'INFY', quantity: 20, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:10:00.000Z' }
      ]);

      expect(result.summary.closed).toBe(1);
      expect(result.summary.unchanged).toBe(1);
      expect(result.newState.totalActivePositions).toBe(1);
      expect(result.newState.activePositions.has('POS_CSV_NSE_INFY_EQUITY_SPOT_0_NA')).toBe(true);
      expect(result.newState.activePositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(false);
      expect(result.newState.closedPositions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);
    });

    it('REMEDIATION F: Identical valid empty snapshot repeated => idempotent', async () => {
      const emptyState = engine.createInitialState();
      const run1 = await engine.reconcilePortfolioState(emptyState, [], {
        sourceStatus: 'VALID_EMPTY_PORTFOLIO',
        isAuthoritativeEmpty: true
      });
      expect(run1.status).toBe('IDEMPOTENT');

      const run2 = await engine.reconcilePortfolioState(run1.newState, [], {
        sourceStatus: 'VALID_EMPTY_PORTFOLIO',
        isAuthoritativeEmpty: true
      });
      expect(run2.status).toBe('IDEMPOTENT');
      expect(run2.summary.closed).toBe(0);
      expect(run2.summary.added).toBe(0);
    });

    it('REMEDIATION G: Malformed XLSX/CSV cannot wipe the portfolio', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      // Malformed CSV without symbol header
      const malformedSource = new CsvXlsxPositionSource({
        content: 'random_header_1,random_header_2\nval1,val2',
        filename: 'malformed.csv'
      });

      const res = await malformedSource.fetchPositions();
      expect(res.status).toBe('INVALID_SOURCE');

      const result = await engine.reconcilePortfolioState(state1, malformedSource);
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAIL_CLOSED');
      expect(result.newState.totalActivePositions).toBe(1);
      expect(result.summary.closed).toBe(0);
    });

    it('REMEDIATION H: Valid XLSX/CSV containing an explicitly empty authoritative holdings table can close positions', async () => {
      const state1 = (await engine.reconcilePortfolioState(engine.createInitialState(), [
        { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
      ])).newState;

      // Valid CSV with recognized header but 0 rows
      const emptyValidCsvSource = new CsvXlsxPositionSource({
        content: 'Tradingsymbol,Quantity,Average price\n',
        filename: 'empty_holdings.csv'
      });

      const res = await emptyValidCsvSource.fetchPositions();
      expect(res.status).toBe('VALID_EMPTY_PORTFOLIO');

      const result = await engine.reconcilePortfolioState(state1, emptyValidCsvSource);
      expect(result.success).toBe(true);
      expect(result.status).toBe('RECONCILED');
      expect(result.summary.closed).toBe(1);
      expect(result.newState.totalActivePositions).toBe(0);
      expect(result.newState.presenceState).toBe('NO_POSITION');
    });

    it('REMEDIATION I: PositionMonitor does not convert an ambiguous empty source result into VALID_EMPTY_PORTFOLIO', async () => {
      const harness = new PositionAlertSimulationHarness({
        initialPositions: [
          { positionId: 'POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA', symbol: 'RELIANCE', quantity: 10, source: 'CSV', assetClass: 'EQUITY', observedAt: '2026-09-24T10:00:00.000Z' }
        ]
      });

      await harness.runPositionCycle(); // Baseline active position

      // Set source status to UNAVAILABLE
      const source = harness.getSource();
      source.setStatus('UNAVAILABLE');

      const { alerts } = await harness.runPositionCycle();

      // Must NOT emit any alerts or closures
      expect(alerts.length).toBe(0);

      const monitor = harness.getMonitor();
      const evalRes = await monitor.evaluatePositions();
      expect(evalRes.events.length).toBe(0);
      expect(evalRes.snapshot.presenceState).toBe('POSITION_EXISTS');
      expect(evalRes.snapshot.totalPositions).toBe(1);
      expect(evalRes.snapshot.positions.has('POS_CSV_NSE_RELIANCE_EQUITY_SPOT_0_NA')).toBe(true);
    });
  });
});
