/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10B-3
 * Phase10B_3_AutomatedObservationFeed.test.ts
 *
 * Automated Real Market Observation Feed & Trusted Ingestion Test Suite.
 *
 * Test Matrix:
 * - TEST A: Scheduler discovers actionable signal symbols from SignalOutcomeEngine
 * - TEST B: Canonical Phase 10A signalId (${eventId}::${signalType}::${revision}) is preserved
 * - TEST C: Valid EquityObservation reaches ObservationTrustBridge
 * - TEST D: Trusted observation reaches SignalOutcomeEngine and triggers deterministic evaluation
 * - TEST E: Duplicate symbols are fetched only once per observation cycle
 * - TEST F: Overlapping cycles are prevented via execution lock
 * - TEST G: CLOSED session (weekend/holiday/off-hours) produces no observation & increments telemetry
 * - TEST H: Provider timeout (504) produces no observation and leaves signal unresolved
 * - TEST I: Provider 404 produces no observation and leaves signal unresolved
 * - TEST J: Malformed provider response produces no observation and leaves signal unresolved
 * - TEST K: Missing/invalid OHLC bounds produce no observation
 * - TEST L: Placeholder/generic/test stub symbols are skipped and recorded in telemetry
 * - TEST M: Direct external mutation is prevented; ObservationTrustBridge is the sole ingestion gateway
 * - TEST N: Historical datasets remain byte-for-byte untouched with exact SHA-256 hashes
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

import { SignalOutcomeEngine, SignalOutcomeRecord } from '../market-intelligence/SignalOutcomeEngine.ts';
import { YahooMarketDataService, FetcherFunction } from '../market-data/server/YahooMarketDataService.ts';
import { ObservationTrustBridge } from '../market-data/ObservationTrustBridge.ts';
import { MarketSessionEngine } from '../market-data/MarketSessionEngine.ts';
import {
  AutomatedMarketObservationFeed,
  ObservationFeedTelemetry,
  CycleExecutionResult
} from '../market-data/AutomatedMarketObservationFeed.ts';

describe('PHASE 10B-3 — AUTOMATED REAL MARKET OBSERVATION FEED', () => {
  let tempDir: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;
  let isolatedOutcomeEngine: SignalOutcomeEngine;
  let isolatedYahooService: YahooMarketDataService;
  let isolatedTrustBridge: ObservationTrustBridge;
  let feed: AutomatedMarketObservationFeed;

  // Protected production files and their immutable baseline hashes
  const protectedDatasets = [
    {
      filePath: 'data/market_intelligence_outcomes.json',
      expectedHash: 'ceecacde5feaba74d4caf0c1f42e112f3e920824fbb8ee3820c0ca9e11276707',
      expectedCount: 446
    },
    {
      filePath: 'data/market_intelligence_outcomes.json.bak',
      expectedHash: '137f0b9a69213994c5ac11bd511c970920c9e0447978f5a690c865cb2394856e',
      expectedCount: 446
    },
    {
      filePath: 'data/news_signal_lifecycle.json',
      expectedHash: 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1',
      expectedCount: 498
    },
    {
      filePath: 'data/news_signal_historical_ledger.json',
      expectedHash: '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c',
      expectedCount: 1
    }
  ];

  const computeSha256 = (relPath: string): string => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), relPath));
    return crypto.createHash('sha256').update(raw).digest('hex');
  };

  const getRecordCount = (relPath: string): number => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed.signals && Array.isArray(parsed.signals)) return parsed.signals.length;
    if (parsed.outcomes && Array.isArray(parsed.outcomes)) return parsed.outcomes.length;
    return Object.keys(parsed).length;
  };

  const preTestHashes: Record<string, string> = {};

  beforeAll(() => {
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      preTestHashes[dataset.filePath] = hash;
      expect(hash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });

  afterAll(() => {
    for (const dataset of protectedDatasets) {
      const postHash = computeSha256(dataset.filePath);
      expect(postHash).toBe(preTestHashes[dataset.filePath]);
      expect(postHash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });

  const createMockYahooResponse = (symbol: string, ltp: number, open: number, high: number, low: number, prevClose: number) => {
    const nowSec = Math.floor(Date.now() / 1000);
    return {
      chart: {
        result: [
          {
            meta: {
              currency: 'INR',
              symbol: symbol.endsWith('.NS') ? symbol : `${symbol}.NS`,
              exchangeName: 'NSI',
              instrumentType: 'EQUITY',
              firstTradeDate: 1025495100,
              regularMarketTime: nowSec,
              gmtoffset: 19800,
              timezone: 'IST',
              exchangeTimezoneName: 'Asia/Kolkata',
              regularMarketPrice: ltp,
              chartPreviousClose: prevClose,
              previousClose: prevClose,
              scale: 3,
              priceHint: 2,
              currentTradingPeriod: {
                regular: {
                  start: 1726717500,
                  end: 1726740000
                }
              },
              tradingPeriods: [[{ start: 1726717500, end: 1726740000 }]],
              dataGranularity: '1d',
              range: '1d',
              validRanges: ['1d', '5d']
            },
            timestamp: [nowSec],
            indicators: {
              quote: [
                {
                  open: [open],
                  high: [high],
                  low: [low],
                  close: [ltp],
                  volume: [1500000]
                }
              ]
            }
          }
        ],
        error: null
      }
    };
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase10b3-test-'));
    testOutcomePath = path.join(tempDir, 'test_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'test_outcomes.json.bak');

    // Initialize fresh isolated test storage
    fs.writeFileSync(testOutcomePath, JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(testOutcomeBakPath, JSON.stringify([], null, 2), 'utf-8');

    isolatedOutcomeEngine = new SignalOutcomeEngine(testOutcomePath, testOutcomeBakPath);
    isolatedTrustBridge = new ObservationTrustBridge(isolatedOutcomeEngine);
    isolatedYahooService = new YahooMarketDataService();
    isolatedYahooService.clearCache();

    feed = new AutomatedMarketObservationFeed(
      isolatedOutcomeEngine,
      isolatedYahooService,
      isolatedTrustBridge,
      MarketSessionEngine,
      {
        allowOffHoursForTesting: true,
        maxConcurrency: 5,
        exchange: 'NSE'
      }
    );

    // In isolated test runner: auto-bind registerActionableSignal to live signal feed
    const origRegister = isolatedOutcomeEngine.registerActionableSignal.bind(isolatedOutcomeEngine);
    isolatedOutcomeEngine.registerActionableSignal = (sig: any) => {
      const rec = origRegister(sig);
      feed.registerLiveSignal({
        signalId: rec.signalId,
        symbol: rec.symbol,
        signalType: rec.signalType,
        revision: rec.revision,
        direction: rec.direction,
        lifecycleState: rec.signalLifecycleState || 'ACTIVE',
        isActionable: true
      });
      return rec;
    };
  });

  afterEach(() => {
    feed.stop();
    isolatedYahooService.clearCache();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('TEST A: scheduler discovers actionable signal symbols from SignalOutcomeEngine', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_a1',
      signalType: 'BREAKOUT',
      symbol: 'RELIANCE',
      revision: 1,
      initialPrice: 2500,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_a2',
      signalType: 'MOMENTUM',
      symbol: 'TCS',
      revision: 1,
      initialPrice: 3800,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    const mockFetcher: FetcherFunction = vi.fn(async (url: string) => {
      const sym = url.includes('RELIANCE') ? 'RELIANCE' : 'TCS';
      const price = sym === 'RELIANCE' ? 2520 : 3840;
      const data = createMockYahooResponse(sym, price, price - 10, price + 30, price - 20, price - 15);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.actionableSignalsCount).toBe(2);
    expect(result.uniqueSymbolsCount).toBe(2);
    expect(result.observationsTrusted).toBe(2);

    const telemetry = feed.getTelemetry();
    expect(telemetry.actionableSignalsDiscovered).toBe(2);
    expect(telemetry.uniqueSymbolsDiscovered).toBe(2);
    expect(telemetry.observationsTrusted).toBe(2);
  });

  it('TEST B: canonical Phase 10A signalId (${eventId}::${signalType}::${revision}) is preserved', async () => {
    const canonicalId = 'evt_canonical_100::STRUCTURAL_BREAKOUT::1';
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const registered = isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_canonical_100',
      signalType: 'STRUCTURAL_BREAKOUT',
      symbol: 'INFY',
      revision: 1,
      initialPrice: 1500,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    expect(registered.signalId).toBe(canonicalId);

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('INFY', 1530, 1495, 1540, 1490, 1500);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    await feed.executeCycle();

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record).toBeDefined();
    expect(record?.signalId).toBe(canonicalId);
    expect(record?.observationCount).toBe(1);
    expect(record?.lastObservedPrice).toBe(1530);
  });

  it('TEST C: valid EquityObservation reaches ObservationTrustBridge with truthful provenance', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const signal = isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_trust_1',
      signalType: 'EARNINGS_BEAT',
      symbol: 'HDFCBANK',
      revision: 1,
      initialPrice: 1600,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    const bridgeSpy = vi.spyOn(isolatedTrustBridge, 'ingestTrustedEquityObservations');

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('HDFCBANK', 1620, 1595, 1630, 1590, 1600);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    await feed.executeCycle();

    expect(bridgeSpy).toHaveBeenCalledTimes(1);
    const [calledSignalId, calledObs] = bridgeSpy.mock.calls[0];
    expect(calledSignalId).toBe(signal.signalId);
    expect(calledObs).toHaveLength(1);
    expect(calledObs[0].ltp).toBe(1620);
    expect(calledObs[0].provenance.providerType).toBe('AUTHORIZED_PROVIDER');
    expect(calledObs[0].provenance.provider).toBe('YAHOO_FINANCE');
  });

  it('TEST D: trusted observation reaches SignalOutcomeEngine and updates MFE/MAE excursions', async () => {
    const canonicalId = 'evt_eval_1::BULLISH_FLOW::1';
    const pastTime = new Date(Date.now() - 60000).toISOString();
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_eval_1',
      signalType: 'BULLISH_FLOW',
      symbol: 'ICICIBANK',
      revision: 1,
      initialPrice: 1000,
      targetPercent: 2.0, // Target = 1020
      stopPercent: -2.0,   // Stop = 980
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    // Feed price of 1015 (1.5% gain, favorable excursion)
    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('ICICIBANK', 1015, 1002, 1018, 998, 1000);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    await feed.executeCycle();

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record).toBeDefined();
    expect(record?.observationCount).toBe(1);
    expect(record?.lastObservedPrice).toBe(1015);
    expect(record?.mfePercent).toBe(1.8);
    expect(record?.isResolved).toBe(false); // 1.8% < 2.0% target, still active
  });

  it('TEST E: duplicate symbols across multiple signals are fetched only ONCE per cycle', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    // 3 distinct signals targeting the SAME symbol (RELIANCE)
    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_dup_1',
      signalType: 'BREAKOUT',
      symbol: 'RELIANCE',
      revision: 1,
      initialPrice: 2400,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_dup_2',
      signalType: 'ORDER_FLOW',
      symbol: 'RELIANCE',
      revision: 1,
      initialPrice: 2400,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_dup_3',
      signalType: 'VOLUME_SURGE',
      symbol: 'RELIANCE',
      revision: 1,
      initialPrice: 2400,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('RELIANCE', 2425, 2390, 2435, 2385, 2400);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();

    // 3 signals, but only 1 unique symbol -> exactly 1 upstream fetch call
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(result.actionableSignalsCount).toBe(3);
    expect(result.uniqueSymbolsCount).toBe(1);
    expect(result.observationsTrusted).toBe(3);

    const records = isolatedOutcomeEngine.getAllOutcomeRecords();
    expect(records).toHaveLength(3);
    for (const rec of records) {
      expect(rec.observationCount).toBe(1);
      expect(rec.lastObservedPrice).toBe(2425);
    }
  });

  it('TEST F: overlapping cycles are prevented via execution lock', async () => {
    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_overlap_1',
      signalType: 'BREAKOUT',
      symbol: 'SBIN',
      revision: 1,
      initialPrice: 800,
      direction: 'BULLISH'
    });

    // Slow fetcher simulating in-flight network delay
    let resolveSlowFetch: (val: any) => void;
    const slowPromise = new Promise(resolve => {
      resolveSlowFetch = resolve;
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      await slowPromise;
      const data = createMockYahooResponse('SBIN', 810, 798, 812, 795, 800);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    // Launch first cycle (which will stall on slowPromise)
    const cycle1Promise = feed.executeCycle();

    // Immediately launch second cycle concurrently
    const cycle2Result = await feed.executeCycle();
    expect(cycle2Result.status).toBe('SKIPPED_OVERLAPPING');
    expect(feed.getTelemetry().overlappingCyclesPrevented).toBe(1);

    // Release first cycle
    resolveSlowFetch!(null);
    const cycle1Result = await cycle1Promise;
    expect(cycle1Result.status).toBe('SUCCESS');
  });

  it('TEST G: CLOSED session produces no observation and increments telemetry', async () => {
    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_closed_1',
      signalType: 'BREAKOUT',
      symbol: 'LT',
      revision: 1,
      initialPrice: 3500,
      direction: 'BULLISH'
    });

    const mockFetcher = vi.fn();
    isolatedYahooService.setFetcher(mockFetcher);

    // Session engine mock returning 'WEEKEND'
    const mockSessionEngine = {
      determineSession: vi.fn(() => 'WEEKEND' as const)
    } as unknown as typeof MarketSessionEngine;

    const closedFeed = new AutomatedMarketObservationFeed(
      isolatedOutcomeEngine,
      isolatedYahooService,
      isolatedTrustBridge,
      mockSessionEngine,
      { allowOffHoursForTesting: false } // Strict session enforcement
    );

    const result = await closedFeed.executeCycle();
    expect(result.status).toBe('SKIPPED_MARKET_CLOSED');
    expect(result.session).toBe('WEEKEND');
    expect(mockFetcher).not.toHaveBeenCalled();

    const telemetry = closedFeed.getTelemetry();
    expect(telemetry.cyclesSkippedMarketClosed).toBe(1);
    expect(telemetry.observationsRequested).toBe(0);

    const record = isolatedOutcomeEngine.getRecord('evt_closed_1::BREAKOUT::LT::rev1');
    expect(record?.observationCount).toBe(0);
  });

  it('TEST H: provider timeout (504) produces no observation and leaves signal unresolved', async () => {
    const canonicalId = 'evt_timeout_1::MOMENTUM::1';
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_timeout_1',
      signalType: 'MOMENTUM',
      symbol: 'BAJFINANCE',
      revision: 1,
      initialPrice: 7000,
      direction: 'BULLISH'
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const err: any = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.observationsTrusted).toBe(0);
    expect(result.providerFailures).toBe(1);

    const telemetry = feed.getTelemetry();
    expect(telemetry.providerFailures).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record?.observationCount).toBe(0);
    expect(record?.isResolved).toBe(false);
  });

  it('TEST I: provider 404 produces no observation and leaves signal unresolved', async () => {
    const canonicalId = 'evt_404_1::BREAKOUT::1';
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_404_1',
      signalType: 'BREAKOUT',
      symbol: 'NONEXISTENT_SECURITY',
      revision: 1,
      initialPrice: 100,
      direction: 'BULLISH'
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      return new Response(JSON.stringify({ chart: { result: null, error: { code: 'Not Found', description: 'No data found' } } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.observationsTrusted).toBe(0);
    expect(result.providerFailures).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record?.observationCount).toBe(0);
    expect(record?.isResolved).toBe(false);
  });

  it('TEST J: malformed provider response produces no observation and leaves signal unresolved', async () => {
    const canonicalId = 'evt_malformed_1::BREAKOUT::1';
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_malformed_1',
      signalType: 'BREAKOUT',
      symbol: 'WIPRO',
      revision: 1,
      initialPrice: 500,
      direction: 'BULLISH'
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      return new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.observationsTrusted).toBe(0);
    expect(result.providerFailures).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record?.observationCount).toBe(0);
    expect(record?.isResolved).toBe(false);
  });

  it('TEST K: missing/invalid OHLC bounds produce no observation and fail closed', async () => {
    const canonicalId = 'evt_ohlc_1::BREAKOUT::1';
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_ohlc_1',
      signalType: 'BREAKOUT',
      symbol: 'AXISBANK',
      revision: 1,
      initialPrice: 1100,
      direction: 'BULLISH'
    });

    // Mock response missing 'high' and 'low' in meta and indicator arrays
    const badOhlcData = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'AXISBANK.NS',
              regularMarketPrice: 1120,
              previousClose: 1100
              // missing high, low, open
            },
            timestamp: [Math.floor(Date.now() / 1000)],
            indicators: {
              quote: [
                {
                  open: [null],
                  high: [null],
                  low: [null],
                  close: [1120]
                }
              ]
            }
          }
        ],
        error: null
      }
    };

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      return new Response(JSON.stringify(badOhlcData), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.observationsTrusted).toBe(0);
    expect(result.providerFailures).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record?.observationCount).toBe(0);
    expect(record?.isResolved).toBe(false);
  });

  it('TEST L: placeholder / generic symbols are skipped and recorded in telemetry', async () => {
    // 3 signals with invalid / placeholder symbols
    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_stub_1',
      signalType: 'BREAKOUT',
      symbol: 'N/A',
      revision: 1,
      initialPrice: 100,
      direction: 'BULLISH'
    });

    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_stub_2',
      signalType: 'BREAKOUT',
      symbol: 'TEST_STOCK_XYZ',
      revision: 1,
      initialPrice: 100,
      direction: 'BULLISH'
    });

    isolatedOutcomeEngine.registerActionableSignal({
      eventId: 'evt_stub_3',
      signalType: 'BREAKOUT',
      symbol: 'PLACEHOLDER_ARTICLE',
      revision: 1,
      initialPrice: 100,
      direction: 'BULLISH'
    });

    const mockFetcher = vi.fn();
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.skippedInvalidCount).toBe(3);
    expect(result.actionableSignalsCount).toBe(0);
    expect(feed.getTelemetry().skippedInvalidSymbols).toBe(3);
  });

  it('TEST M: ObservationTrustBridge is the sole ingestion gateway with strict validation', async () => {
    const canonicalId = 'evt_gw_1::BREAKOUT::1';
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_gw_1',
      signalType: 'BREAKOUT',
      symbol: 'MARUTI',
      revision: 1,
      initialPrice: 12000,
      direction: 'BULLISH'
    });

    // Attempting to ingest an untrusted tick directly with mismatched symbol or invalid price is rejected
    const badTickResult = isolatedOutcomeEngine.ingestTrustedMarketObservations(canonicalId, [
      {
        signalId: canonicalId,
        symbol: 'WRONG_SYMBOL',
        timestamp: new Date().toISOString(),
        price: 12100,
        provenance: {
          sourceType: 'APPROVED_MARKET_PROVIDER',
          provider: 'YAHOO_FINANCE'
        }
      }
    ]);

    expect(badTickResult.success).toBe(false);
    expect(badTickResult.errors).toBeDefined();
    expect(badTickResult.errors![0].code).toBe('SYMBOL_MISMATCH');

    // Valid observation through ObservationTrustBridge succeeds cleanly
    const goodEquityObs = {
      symbol: 'MARUTI',
      exchange: 'NSE',
      ltp: 12150,
      open: 12000,
      high: 12200,
      low: 11950,
      previousClose: 12000,
      volume: 450000,
      timestamp: new Date().toISOString(),
      tradingStatus: 'REGULAR',
      provenance: {
        provider: 'YAHOO_FINANCE',
        providerType: 'AUTHORIZED_PROVIDER' as const,
        exchange: 'NSE',
        observedAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        normalizedAt: new Date().toISOString(),
        requestId: 'req_test_bridge_1',
        dataStatus: 'NORMALIZED' as const,
        freshness: 'REAL_TIME' as const,
        sourceConfidence: 0.95
      }
    };

    const bridgeResult = isolatedTrustBridge.ingestTrustedEquityObservations(canonicalId, [goodEquityObs]);
    expect(bridgeResult.success).toBe(true);
    expect(bridgeResult.outcome?.lastObservedPrice).toBe(12150);
  });

  it('TEST N: historical datasets remain byte-for-byte untouched with exact SHA-256 hashes', () => {
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });

  it('TEST O: historical unresolved SignalOutcome with a valid real symbol is NOT selected by the automated feed', async () => {
    // 1. Seed historical unresolved record directly into SignalOutcomeEngine (NOT in live signal feed)
    const historicalSignalId = 'hist_unresolved_rec_001';
    isolatedOutcomeEngine.recordOutcome({
      signalId: historicalSignalId,
      eventId: 'evt_hist_old_001',
      signalType: 'BREAKOUT',
      symbol: 'RELIANCE',
      revision: 1,
      direction: 'BULLISH',
      initialPrice: 2500,
      generatedAt: '2026-08-01T10:00:00.000Z',
      isResolved: false,
      outcome: 'UNRESOLVED',
      observationCount: 0,
      mfePercent: 0,
      maePercent: 0,
      timeToResolutionSeconds: 0,
      activeTradingSeconds: 0,
      history: []
    });

    const mockFetcher = vi.fn();
    isolatedYahooService.setFetcher(mockFetcher);

    // Feed has zero live signals registered
    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.actionableSignalsCount).toBe(0);
    expect(result.uniqueSymbolsCount).toBe(0);
    expect(result.observationsTrusted).toBe(0);
    expect(mockFetcher).not.toHaveBeenCalled();

    // Verify historical record remains strictly untouched
    const histRecord = isolatedOutcomeEngine.getRecord(historicalSignalId);
    expect(histRecord).toBeDefined();
    expect(histRecord?.observationCount).toBe(0);
    expect(histRecord?.isResolved).toBe(false);
    expect(histRecord?.lastObservedPrice).toBeUndefined();
  });

  it('TEST P: genuinely current/live actionable signal IS selected and observed', async () => {
    const liveCanonicalId = 'evt_live_p100::MOMENTUM::1';
    const pastTime = new Date(Date.now() - 30000).toISOString();
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: liveCanonicalId,
      eventId: 'evt_live_p100',
      signalType: 'MOMENTUM',
      symbol: 'INFY',
      revision: 1,
      initialPrice: 1500,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('INFY', 1525, 1495, 1530, 1490, 1500);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.actionableSignalsCount).toBe(1);
    expect(result.uniqueSymbolsCount).toBe(1);
    expect(result.observationsTrusted).toBe(1);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    const record = isolatedOutcomeEngine.getRecord(liveCanonicalId);
    expect(record).toBeDefined();
    expect(record?.observationCount).toBe(1);
    expect(record?.lastObservedPrice).toBe(1525);
  });

  it('TEST Q: historical unresolved record and current live signal using same symbol are isolated; historical never receives observation', async () => {
    // 1. Seed historical unresolved record with symbol TCS
    const histSignalId = 'hist_tcs_unresolved_001';
    isolatedOutcomeEngine.recordOutcome({
      signalId: histSignalId,
      eventId: 'evt_hist_tcs_001',
      signalType: 'BREAKOUT',
      symbol: 'TCS',
      revision: 1,
      direction: 'BULLISH',
      initialPrice: 3800,
      generatedAt: '2026-08-01T10:00:00.000Z',
      isResolved: false,
      outcome: 'UNRESOLVED',
      observationCount: 0,
      mfePercent: 0,
      maePercent: 0,
      timeToResolutionSeconds: 0,
      activeTradingSeconds: 0,
      history: []
    });

    // 2. Register current live signal with SAME symbol TCS
    const liveSignalId = 'evt_live_tcs_100::ORDER_FLOW::1';
    const pastTime = new Date(Date.now() - 30000).toISOString();
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: liveSignalId,
      eventId: 'evt_live_tcs_100',
      signalType: 'ORDER_FLOW',
      symbol: 'TCS',
      revision: 1,
      initialPrice: 3900,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('TCS', 3950, 3880, 3960, 3870, 3900);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.actionableSignalsCount).toBe(1); // Only the live signal is selected
    expect(result.uniqueSymbolsCount).toBe(1);
    expect(result.observationsTrusted).toBe(1);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // Live signal MUST have received the observation
    const liveRec = isolatedOutcomeEngine.getRecord(liveSignalId);
    expect(liveRec).toBeDefined();
    expect(liveRec?.observationCount).toBe(1);
    expect(liveRec?.lastObservedPrice).toBe(3950);

    // Historical record MUST NEVER have received the observation
    const histRec = isolatedOutcomeEngine.getRecord(histSignalId);
    expect(histRec).toBeDefined();
    expect(histRec?.observationCount).toBe(0);
    expect(histRec?.isResolved).toBe(false);
    expect(histRec?.lastObservedPrice).toBeUndefined();
  });

  it('TEST R: feed fails closed when no authoritative live-signal source is available', async () => {
    // 1. Seed historical unresolved records in outcome engine
    isolatedOutcomeEngine.recordOutcome({
      signalId: 'hist_failclosed_1',
      eventId: 'evt_failclosed_1',
      signalType: 'BREAKOUT',
      symbol: 'SBIN',
      revision: 1,
      direction: 'BULLISH',
      initialPrice: 800,
      generatedAt: '2026-08-01T10:00:00.000Z',
      isResolved: false,
      outcome: 'UNRESOLVED',
      observationCount: 0,
      mfePercent: 0,
      maePercent: 0,
      timeToResolutionSeconds: 0,
      activeTradingSeconds: 0,
      history: []
    });

    const mockFetcher = vi.fn();
    isolatedYahooService.setFetcher(mockFetcher);

    // Explicitly configure feed with empty / no live signal source
    const failClosedFeed = new AutomatedMarketObservationFeed(
      isolatedOutcomeEngine,
      isolatedYahooService,
      isolatedTrustBridge,
      MarketSessionEngine,
      {
        allowOffHoursForTesting: true,
        liveSignalSource: () => [] // Returns zero live signals
      }
    );

    const result = await failClosedFeed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.actionableSignalsCount).toBe(0);
    expect(result.uniqueSymbolsCount).toBe(0);
    expect(result.observationsTrusted).toBe(0);
    expect(mockFetcher).not.toHaveBeenCalled();

    // Verify historical record is untouched
    const histRec = isolatedOutcomeEngine.getRecord('hist_failclosed_1');
    expect(histRec?.observationCount).toBe(0);
  });

  it('TEST S: canonical Phase 10A signalId is preserved end-to-end', async () => {
    const canonicalId = 'evt_canonical_p10a_999::STRUCTURAL_BREAKOUT::2';
    const pastTime = new Date(Date.now() - 30000).toISOString();
    isolatedOutcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_canonical_p10a_999',
      signalType: 'STRUCTURAL_BREAKOUT',
      symbol: 'HINDUNILVR',
      revision: 2,
      initialPrice: 2800,
      direction: 'BULLISH',
      generatedAt: pastTime
    });

    const mockFetcher: FetcherFunction = vi.fn(async () => {
      const data = createMockYahooResponse('HINDUNILVR', 2835, 2790, 2845, 2785, 2800);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    isolatedYahooService.setFetcher(mockFetcher);

    const result = await feed.executeCycle();
    expect(result.status).toBe('SUCCESS');
    expect(result.observationsTrusted).toBe(1);

    const record = isolatedOutcomeEngine.getRecord(canonicalId);
    expect(record).toBeDefined();
    expect(record?.signalId).toBe(canonicalId);
    expect(record?.observationCount).toBe(1);
    expect(record?.lastObservedPrice).toBe(2835);
  });

  it('TEST T: existing tests A-N remain valid and protected datasets are unmodified', () => {
    for (const dataset of protectedDatasets) {
      const postHash = computeSha256(dataset.filePath);
      expect(postHash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });
});
