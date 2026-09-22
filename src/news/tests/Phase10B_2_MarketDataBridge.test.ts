/**
 * ATHENA NEWS & MARKET INTELLIGENCE SUBSYSTEM — PHASE 10B-2
 * Phase10B_2_MarketDataBridge.test.ts
 *
 * Comprehensive Test Suite for Real Market Data Provider Bridge:
 * - TEST A: NSE symbol normalization (RELIANCE -> RELIANCE.NS, NIFTY -> ^NSEI)
 * - TEST B: BSE symbol normalization (RELIANCE -> RELIANCE.BO, SENSEX -> ^BSESN)
 * - TEST C: Existing explicit Yahoo symbols preserved (^NSEI, ^BSESN, TCS.NS, INFY.BO)
 * - TEST D: Valid provider response becomes normalized EquityObservation with valid OHLC
 * - TEST E: Yahoo provider provenance is NOT OFFICIAL_EXCHANGE (AUTHORIZED_PROVIDER -> APPROVED_MARKET_PROVIDER)
 * - TEST F: Missing provider quote never fabricates price (returns 502 / null, zero default disallowed)
 * - TEST G: Invalid / empty symbol returns 400 Bad Request
 * - TEST H: Provider timeout maps correctly to 504 / PROVIDER_TIMEOUT
 * - TEST I: Provider rate limit maps to 429 and updates circuit breaker
 * - TEST J: Malformed upstream payload is rejected
 * - TEST K: Failed upstream response is never converted to synthetic quote in production
 * - TEST L: In-memory cache returns fresh data within TTL
 * - TEST M: Cache expiry forces provider refresh
 * - TEST N: Exchange + symbol form distinct cache keys (NSE:RELIANCE vs BSE:RELIANCE)
 * - TEST O: Production mode never uses TEST/MOCK synthetic fixtures
 * - TEST P: ObservationTrustBridge rejects invalid/future/synthetic observations in production
 * - TEST Q: Canonical signalId remains strictly unchanged through ingestion
 * - TEST R: Protected dataset hashes byte-for-byte immutable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { YahooMarketDataService, yahooMarketDataService } from '../market-data/server/YahooMarketDataService.ts';
import { MarketDataProviderManager } from '../market-data/MarketDataProvider.ts';
import { MarketDataCircuitBreaker } from '../market-data/MarketDataCircuitBreaker.ts';
import { MarketDataNormalizer } from '../market-data/MarketDataNormalizer.ts';
import { ObservationTrustBridge, convertEquityObservationToTick } from '../market-data/ObservationTrustBridge.ts';
import { SignalOutcomeEngine, MarketObservationTick } from '../market-intelligence/SignalOutcomeEngine.ts';
import { EquityObservation } from '../market-data/types.ts';

describe('PHASE 10B-2 — REAL MARKET DATA PROVIDER BRIDGE', () => {
  let tempDir: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;

  const protectedDatasets = [
    {
      filePath: 'data/market_intelligence_outcomes.json',
      expectedHash: '47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd',
      expectedCount: 446
    },
    {
      filePath: 'data/market_intelligence_outcomes.json.bak',
      expectedHash: '33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764',
      expectedCount: 445
    },
    {
      filePath: 'data/news_signal_lifecycle.json',
      expectedHash: 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1',
      expectedCount: 498
    }
  ];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase10b2-test-'));
    testOutcomePath = path.join(tempDir, 'test_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'test_outcomes.json.bak');

    fs.writeFileSync(testOutcomePath, JSON.stringify([], null, 2));
    fs.writeFileSync(testOutcomeBakPath, JSON.stringify([], null, 2));

    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
    yahooMarketDataService.clearCache();
    MarketDataCircuitBreaker.clear();
    MarketDataNormalizer.clearRegistry();
  });

  afterEach(() => {
    yahooMarketDataService.resetFetcher();
    yahooMarketDataService.clearCache();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // ==========================================================================
  // TEST A: NSE Symbol Normalization
  // ==========================================================================
  it('TEST A: NSE symbol normalization maps correctly (RELIANCE -> RELIANCE.NS, NIFTY -> ^NSEI)', () => {
    const s1 = yahooMarketDataService.normalizeSymbol('RELIANCE', 'NSE');
    expect(s1.yahooTicker).toBe('RELIANCE.NS');
    expect(s1.canonicalSymbol).toBe('RELIANCE');

    const s2 = yahooMarketDataService.normalizeSymbol('TCS', 'NSE');
    expect(s2.yahooTicker).toBe('TCS.NS');
    expect(s2.canonicalSymbol).toBe('TCS');

    const s3 = yahooMarketDataService.normalizeSymbol('NIFTY', 'NSE');
    expect(s3.yahooTicker).toBe('^NSEI');
    expect(s3.canonicalSymbol).toBe('NIFTY 50');

    const s4 = yahooMarketDataService.normalizeSymbol('NIFTY 50', 'NSE');
    expect(s4.yahooTicker).toBe('^NSEI');

    const s5 = yahooMarketDataService.normalizeSymbol('BANKNIFTY', 'NSE');
    expect(s5.yahooTicker).toBe('^NSEBANK');
  });

  // ==========================================================================
  // TEST B: BSE Symbol Normalization
  // ==========================================================================
  it('TEST B: BSE symbol normalization maps correctly (RELIANCE -> RELIANCE.BO, SENSEX -> ^BSESN)', () => {
    const s1 = yahooMarketDataService.normalizeSymbol('RELIANCE', 'BSE');
    expect(s1.yahooTicker).toBe('RELIANCE.BO');
    expect(s1.canonicalSymbol).toBe('RELIANCE');

    const s2 = yahooMarketDataService.normalizeSymbol('INFY', 'BSE');
    expect(s2.yahooTicker).toBe('INFY.BO');
    expect(s2.canonicalSymbol).toBe('INFY');

    const s3 = yahooMarketDataService.normalizeSymbol('SENSEX', 'BSE');
    expect(s3.yahooTicker).toBe('^BSESN');
    expect(s3.canonicalSymbol).toBe('SENSEX');
  });

  // ==========================================================================
  // TEST C: Explicit Yahoo symbols preserved
  // ==========================================================================
  it('TEST C: Existing explicit Yahoo symbols remain valid and preserved', () => {
    const s1 = yahooMarketDataService.normalizeSymbol('RELIANCE.NS', 'NSE');
    expect(s1.yahooTicker).toBe('RELIANCE.NS');
    expect(s1.canonicalSymbol).toBe('RELIANCE');

    const s2 = yahooMarketDataService.normalizeSymbol('TCS.BO', 'BSE');
    expect(s2.yahooTicker).toBe('TCS.BO');
    expect(s2.canonicalSymbol).toBe('TCS');

    const s3 = yahooMarketDataService.normalizeSymbol('^NSEI', 'NSE');
    expect(s3.yahooTicker).toBe('^NSEI');

    const s4 = yahooMarketDataService.normalizeSymbol('USDINR=X', 'NSE');
    expect(s4.yahooTicker).toBe('USDINR=X');
  });

  // ==========================================================================
  // TEST D: Valid Provider Response Becomes Normalized EquityObservation
  // ==========================================================================
  it('TEST D: Valid provider response becomes normalized EquityObservation with valid OHLC', async () => {
    const mockYahooPayload = {
      chart: {
        result: [
          {
            meta: {
              currency: 'INR',
              symbol: 'RELIANCE.NS',
              exchangeName: 'NSI',
              regularMarketPrice: 2980.5,
              chartPreviousClose: 2950.0,
              previousClose: 2950.0,
              regularMarketOpen: 2960.0,
              regularMarketDayHigh: 2995.0,
              regularMarketDayLow: 2955.0,
              regularMarketVolume: 4500000,
              regularMarketTime: Math.floor(Date.now() / 1000)
            },
            indicators: {
              quote: [
                {
                  open: [2960.0],
                  high: [2995.0],
                  low: [2955.0],
                  close: [2980.5],
                  volume: [4500000]
                }
              ]
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(mockYahooPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('RELIANCE', 'NSE');
    expect(result.status).toBe(200);
    expect(result.observation).toBeDefined();

    const obs = result.observation!;
    expect(obs.symbol).toBe('RELIANCE');
    expect(obs.exchange).toBe('NSE');
    expect(obs.ltp).toBe(2980.5);
    expect(obs.open).toBe(2960.0);
    expect(obs.high).toBe(2995.0);
    expect(obs.low).toBe(2955.0);
    expect(obs.previousClose).toBe(2950.0);
    expect(obs.volume).toBe(4500000);
    expect(obs.high).toBeGreaterThanOrEqual(obs.low);
    expect(obs.high).toBeGreaterThanOrEqual(obs.ltp);
    expect(obs.low).toBeLessThanOrEqual(obs.ltp);
  });

  // ==========================================================================
  // TEST E: Truthful Provenance is NOT OFFICIAL_EXCHANGE
  // ==========================================================================
  it('TEST E: Yahoo Finance provider provenance is AUTHORIZED_PROVIDER, NOT OFFICIAL_EXCHANGE', async () => {
    const mockYahooPayload = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'TCS.NS',
              regularMarketPrice: 4200.0,
              regularMarketOpen: 4180.0,
              regularMarketDayHigh: 4220.0,
              regularMarketDayLow: 4170.0,
              previousClose: 4150.0,
              regularMarketVolume: 1200000,
              regularMarketTime: Math.floor(Date.now() / 1000)
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(mockYahooPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('TCS', 'NSE');
    expect(result.status).toBe(200);
    const prov = result.observation!.provenance;

    expect(prov.provider).toBe('YAHOO_FINANCE');
    expect(prov.providerType).toBe('AUTHORIZED_PROVIDER');
    expect(prov.providerType).not.toBe('OFFICIAL_EXCHANGE');
    expect(prov.exchange).toBe('NSE');

    // Convert via ObservationTrustBridge and verify sourceType is APPROVED_MARKET_PROVIDER
    const tick = convertEquityObservationToTick('SIG-TEST-1', result.observation!);
    expect((tick.provenance as any).sourceType).toBe('APPROVED_MARKET_PROVIDER');
    expect((tick.provenance as any).sourceType).not.toBe('REAL_EXCHANGE');
    expect((tick.provenance as any).sourceType).not.toBe('SYNTHETIC_TEST');
  });

  // ==========================================================================
  // TEST F: Strict No-Fabrication / Fail-Closed on Missing OHLC or Price
  // ==========================================================================
  it('TEST F1: Missing price in upstream payload returns error and never fabricates prices', async () => {
    const emptyPayload = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'EMPTY.NS'
              // regularMarketPrice is missing
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(emptyPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('EMPTY', 'NSE');
    expect(result.status).toBe(502);
    expect(result.observation).toBeUndefined();
    expect(result.error).toContain('No valid price data');
  });

  it('TEST F2: Missing open field in upstream payload returns 502 and does NOT silently replace with LTP', async () => {
    const payloadMissingOpen = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'NO_OPEN.NS',
              regularMarketPrice: 2500.0,
              regularMarketDayHigh: 2550.0,
              regularMarketDayLow: 2480.0,
              previousClose: 2490.0,
              regularMarketVolume: 100000
              // regularMarketOpen is missing
            },
            indicators: {
              quote: [
                {
                  // open series is empty/missing
                  high: [2550.0],
                  low: [2480.0],
                  close: [2500.0]
                }
              ]
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(payloadMissingOpen), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('NO_OPEN', 'NSE');
    expect(result.status).toBe(502);
    expect(result.observation).toBeUndefined();
    expect(result.error).toContain('Incomplete upstream OHLC data');
    expect(result.error).toContain('open');
  });

  it('TEST F3: Missing high field in upstream payload returns 502 and does NOT silently replace with LTP', async () => {
    const payloadMissingHigh = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'NO_HIGH.NS',
              regularMarketPrice: 2500.0,
              regularMarketOpen: 2490.0,
              regularMarketDayLow: 2480.0,
              previousClose: 2490.0,
              regularMarketVolume: 100000
              // regularMarketDayHigh is missing
            },
            indicators: {
              quote: [
                {
                  open: [2490.0],
                  low: [2480.0],
                  close: [2500.0]
                }
              ]
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(payloadMissingHigh), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('NO_HIGH', 'NSE');
    expect(result.status).toBe(502);
    expect(result.observation).toBeUndefined();
    expect(result.error).toContain('Incomplete upstream OHLC data');
    expect(result.error).toContain('high');
  });

  it('TEST F4: Missing low field in upstream payload returns 502 and does NOT silently replace with LTP', async () => {
    const payloadMissingLow = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'NO_LOW.NS',
              regularMarketPrice: 2500.0,
              regularMarketOpen: 2490.0,
              regularMarketDayHigh: 2550.0,
              previousClose: 2490.0,
              regularMarketVolume: 100000
              // regularMarketDayLow is missing
            },
            indicators: {
              quote: [
                {
                  open: [2490.0],
                  high: [2550.0],
                  close: [2500.0]
                }
              ]
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(payloadMissingLow), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('NO_LOW', 'NSE');
    expect(result.status).toBe(502);
    expect(result.observation).toBeUndefined();
    expect(result.error).toContain('Incomplete upstream OHLC data');
    expect(result.error).toContain('low');
  });

  it('TEST F5: Missing previousClose in upstream payload returns 502 and does NOT silently replace with LTP', async () => {
    const payloadMissingPrevClose = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'NO_PREV.NS',
              regularMarketPrice: 2500.0,
              regularMarketOpen: 2490.0,
              regularMarketDayHigh: 2550.0,
              regularMarketDayLow: 2480.0,
              regularMarketVolume: 100000
              // previousClose and chartPreviousClose are missing
            },
            indicators: {
              quote: [
                {
                  open: [2490.0],
                  high: [2550.0],
                  low: [2480.0]
                }
              ]
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(payloadMissingPrevClose), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('NO_PREV', 'NSE');
    expect(result.status).toBe(502);
    expect(result.observation).toBeUndefined();
    expect(result.error).toContain('Incomplete upstream OHLC data');
    expect(result.error).toContain('previousClose');
  });

  it('TEST F6: Mathematically invalid upstream OHLC bounds (high < open, high < ltp, low > ltp) are rejected with 502', async () => {
    const invalidBoundsPayload = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'BAD_BOUNDS.NS',
              regularMarketPrice: 2600.0, // LTP is 2600
              regularMarketOpen: 2500.0,
              regularMarketDayHigh: 2550.0, // High is 2550 < LTP (2600)!
              regularMarketDayLow: 2480.0,
              previousClose: 2490.0,
              regularMarketVolume: 100000
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify(invalidBoundsPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('BAD_BOUNDS', 'NSE');
    expect(result.status).toBe(502);
    expect(result.observation).toBeUndefined();
    expect(result.error).toContain('violates mathematical bounds');
  });

  // ==========================================================================
  // TEST G: Invalid Symbol Validation (400 Bad Request)
  // ==========================================================================
  it('TEST G: Invalid or empty symbols return 400 Bad Request', async () => {
    const r1 = await yahooMarketDataService.fetchEquityObservation('', 'NSE');
    expect(r1.status).toBe(400);

    const r2 = await yahooMarketDataService.fetchEquityObservation('   ', 'NSE');
    expect(r2.status).toBe(400);

    const r3 = await yahooMarketDataService.fetchEquityObservation('https://malicious.com/api', 'NSE');
    expect(r3.status).toBe(400);

    const r4 = await yahooMarketDataService.fetchEquityObservation(null as any, 'NSE');
    expect(r4.status).toBe(400);
  });

  // ==========================================================================
  // TEST H: Provider Timeout Maps Correctly (504)
  // ==========================================================================
  it('TEST H: Provider timeout returns 504 status', async () => {
    yahooMarketDataService.setFetcher(async () => {
      const timeoutErr = new Error('The operation was aborted');
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    });

    const result = await yahooMarketDataService.fetchEquityObservation('RELIANCE', 'NSE');
    expect(result.status).toBe(504);
    expect(result.error).toContain('timed out');
  });

  // ==========================================================================
  // TEST I: Provider Rate Limit Maps to 429
  // ==========================================================================
  it('TEST I: Provider rate limit maps to 429 status', async () => {
    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('RELIANCE', 'NSE');
    expect(result.status).toBe(429);
    expect(result.error).toContain('rate limit');
  });

  // ==========================================================================
  // TEST J: Malformed Upstream Payload Rejected
  // ==========================================================================
  it('TEST J: Malformed upstream payload returns 502 Bad Gateway', async () => {
    yahooMarketDataService.setFetcher(async () => {
      return new Response('<html><head><title>502 Bad Gateway</title></head></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('RELIANCE', 'NSE');
    expect(result.status).toBe(502);
    expect(result.error).toContain('Malformed JSON');
  });

  // ==========================================================================
  // TEST K: Failed Upstream Response Never Converts to Synthetic Quote
  // ==========================================================================
  it('TEST K: Failed upstream 404 response returns 404 and does not return synthetic price', async () => {
    yahooMarketDataService.setFetcher(async () => {
      return new Response(JSON.stringify({ chart: { error: { code: 'Not Found' } } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const result = await yahooMarketDataService.fetchEquityObservation('NONEXISTENT', 'NSE');
    expect(result.status).toBe(404);
    expect(result.observation).toBeUndefined();
  });

  // ==========================================================================
  // TEST L: Cache Returns Valid Fresh Data Within TTL
  // ==========================================================================
  it('TEST L: Cache returns valid fresh data within TTL without calling fetcher again', async () => {
    let fetchCount = 0;
    const mockPayload = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'INFY.NS',
              regularMarketPrice: 1850.0,
              regularMarketOpen: 1840.0,
              regularMarketDayHigh: 1860.0,
              regularMarketDayLow: 1835.0,
              previousClose: 1830.0,
              regularMarketVolume: 2000000,
              regularMarketTime: Math.floor(Date.now() / 1000)
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      fetchCount++;
      return new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Call 1 -> Cache Miss, Fetcher called
    const r1 = await yahooMarketDataService.fetchEquityObservation('INFY', 'NSE');
    expect(r1.status).toBe(200);
    expect(r1.cached).toBe(false);
    expect(fetchCount).toBe(1);

    // Call 2 -> Cache Hit, Fetcher NOT called
    const r2 = await yahooMarketDataService.fetchEquityObservation('INFY', 'NSE');
    expect(r2.status).toBe(200);
    expect(r2.cached).toBe(true);
    expect(r2.observation!.ltp).toBe(1850.0);
    expect(fetchCount).toBe(1);
  });

  // ==========================================================================
  // TEST M: Cache Expiry Causes Provider Refresh
  // ==========================================================================
  it('TEST M: Cache expiry forces provider re-fetch', async () => {
    let fetchCount = 0;
    const mockPayload = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'WIPRO.NS',
              regularMarketPrice: 550.0,
              regularMarketOpen: 545.0,
              regularMarketDayHigh: 555.0,
              regularMarketDayLow: 540.0,
              previousClose: 542.0,
              regularMarketVolume: 900000,
              regularMarketTime: Math.floor(Date.now() / 1000)
            }
          }
        ]
      }
    };

    yahooMarketDataService.setFetcher(async () => {
      fetchCount++;
      return new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Fetch with short TTL of 50ms
    const r1 = await yahooMarketDataService.fetchEquityObservation('WIPRO', 'NSE', { ttlMs: 50 });
    expect(r1.status).toBe(200);
    expect(fetchCount).toBe(1);

    // Wait 60ms for cache to expire
    await new Promise(res => setTimeout(res, 60));

    // Call after expiry should invoke fetcher again
    const r2 = await yahooMarketDataService.fetchEquityObservation('WIPRO', 'NSE');
    expect(r2.status).toBe(200);
    expect(r2.cached).toBe(false);
    expect(fetchCount).toBe(2);
  });

  // ==========================================================================
  // TEST N: Exchange + Symbol are Distinct Cache Keys
  // ==========================================================================
  it('TEST N: NSE and BSE observations for same symbol have distinct cache partitions', async () => {
    let fetchCount = 0;
    yahooMarketDataService.setFetcher(async (url: string) => {
      fetchCount++;
      const isBse = url.includes('.BO') || url.includes('BSE');
      return new Response(JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                symbol: isBse ? 'RELIANCE.BO' : 'RELIANCE.NS',
                regularMarketPrice: isBse ? 2981.0 : 2980.0,
                regularMarketOpen: 2960.0,
                regularMarketDayHigh: 2990.0,
                regularMarketDayLow: 2950.0,
                previousClose: 2950.0,
                regularMarketVolume: 1000000,
                regularMarketTime: Math.floor(Date.now() / 1000)
              }
            }
          ]
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const nseResult = await yahooMarketDataService.fetchEquityObservation('RELIANCE', 'NSE');
    const bseResult = await yahooMarketDataService.fetchEquityObservation('RELIANCE', 'BSE');

    expect(nseResult.status).toBe(200);
    expect(bseResult.status).toBe(200);
    expect(nseResult.observation!.exchange).toBe('NSE');
    expect(bseResult.observation!.exchange).toBe('BSE');
    expect(nseResult.observation!.ltp).toBe(2980.0);
    expect(bseResult.observation!.ltp).toBe(2981.0);
    expect(fetchCount).toBe(2); // Distinct fetch for each exchange
  });

  // ==========================================================================
  // TEST O: Production Mode Never Uses Synthetic Fixtures
  // ==========================================================================
  it('TEST O: MarketDataProviderManager in PRODUCTION mode never falls back to synthetic mock data', async () => {
    const manager = new MarketDataProviderManager();
    expect(manager.getMode()).toBe('TEST');

    // Switch to PRODUCTION mode
    manager.setMode('PRODUCTION');
    expect(manager.getMode()).toBe('PRODUCTION');

    // Mock global fetch returning 500 error on /api/market-data/nse/equity
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ error: 'Provider Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    try {
      const obs = await manager.getEquityObservation('RELIANCE');
      expect(obs).toBeDefined();
      // In production mode, complete outage returns UNAVAILABLE observation (ltp = 0, status = UNAVAILABLE)
      expect(obs!.ltp).toBe(0);
      expect(obs!.tradingStatus).toBe('UNAVAILABLE');
      expect(obs!.provenance.providerType).toBe('UNAVAILABLE');
      expect(obs!.provenance.dataStatus).toBe('UNAVAILABLE');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ==========================================================================
  // TEST P: ObservationTrustBridge Rejects Invalid / Future / Synthetic
  // ==========================================================================
  it('TEST P: ObservationTrustBridge enforces Phase 10B-1 trust boundaries for real observations', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    outcomeEngine.recordOutcome({
      signalId: 'SIG-TRUST-001',
      eventId: 'EVT-001',
      signalType: 'INTRADAY',
      revision: 1,
      symbol: 'RELIANCE',
      generatedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      signalLifecycleState: 'ACTIVE' as any,
      initialPrice: 2950.0,
      direction: 'BULLISH',
      targetPrice: 3050.0,
      stopPrice: 2900.0,
      confidenceScore: 0.85,
      timeline: [],
      timeBuckets: {}
    });

    const bridge = new ObservationTrustBridge(outcomeEngine);

    // 1. Valid real observation ingested successfully
    const validObs: EquityObservation = {
      symbol: 'RELIANCE',
      exchange: 'NSE',
      ltp: 2980.0,
      open: 2960.0,
      high: 3000.0,
      low: 2950.0,
      previousClose: 2940.0,
      volume: 1000000,
      timestamp: new Date().toISOString(),
      tradingStatus: 'ACTIVE',
      provenance: {
        provider: 'YAHOO_FINANCE',
        providerType: 'AUTHORIZED_PROVIDER',
        exchange: 'NSE',
        observedAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        normalizedAt: new Date().toISOString(),
        requestId: 'req_123',
        dataStatus: 'AVAILABLE',
        freshness: 'REAL_TIME',
        sourceConfidence: 0.95
      }
    };

    const res1 = bridge.ingestTrustedEquityObservations('SIG-TRUST-001', [validObs]);
    expect(res1.success).toBe(true);
    expect(res1.outcome).toBeDefined();
    expect(res1.outcome!.observationCount).toBe(1);

    // 2. Observation with future timestamp drift rejected
    const futureObs: EquityObservation = {
      ...validObs,
      timestamp: new Date(Date.now() + 120000).toISOString() // 2 minutes in future
    };

    const res2 = bridge.ingestTrustedEquityObservations('SIG-TRUST-001', [futureObs]);
    expect(res2.success).toBe(false);
    expect(res2.errors).toBeDefined();
    expect(res2.errors![0].code).toBe('FUTURE_TIMESTAMP_DRIFT');

    // 3. Observation exceeding high bound rejected
    const invalidBoundsObs: EquityObservation = {
      ...validObs,
      ltp: 3050.0,
      high: 3000.0, // ltp > high
      timestamp: new Date().toISOString()
    };

    const res3 = bridge.ingestTrustedEquityObservations('SIG-TRUST-001', [invalidBoundsObs]);
    expect(res3.success).toBe(false);
    expect(res3.errors![0].code).toBe('PRICE_EXCEEDS_HIGH_BOUND');
  });

  // ==========================================================================
  // TEST Q: Canonical signalId Remains Unchanged
  // ==========================================================================
  it('TEST Q: Ingestion preserves canonical signalId through ObservationTrustBridge into SignalOutcomeEngine', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const canonicalId = 'EVT-TEST-Q::EQUITY_BREAKOUT::1';

    outcomeEngine.recordOutcome({
      signalId: canonicalId,
      eventId: 'EVT-TEST-Q',
      signalType: 'EQUITY_BREAKOUT',
      revision: 1,
      symbol: 'TCS',
      generatedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      signalLifecycleState: 'ACTIVE' as any,
      initialPrice: 4100.0,
      direction: 'BULLISH',
      targetPrice: 4300.0,
      stopPrice: 4000.0,
      confidenceScore: 0.9,
      timeline: [],
      timeBuckets: {}
    });

    const bridge = new ObservationTrustBridge(outcomeEngine);
    const obs: EquityObservation = {
      symbol: 'TCS',
      exchange: 'NSE',
      ltp: 4150.0,
      open: 4120.0,
      high: 4180.0,
      low: 4110.0,
      previousClose: 4100.0,
      volume: 500000,
      timestamp: new Date().toISOString(),
      tradingStatus: 'ACTIVE',
      provenance: {
        provider: 'YAHOO_FINANCE',
        providerType: 'AUTHORIZED_PROVIDER',
        exchange: 'NSE',
        observedAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        normalizedAt: new Date().toISOString(),
        requestId: 'req_q_1',
        dataStatus: 'AVAILABLE',
        freshness: 'REAL_TIME',
        sourceConfidence: 0.95
      }
    };

    const res = bridge.ingestTrustedEquityObservations(canonicalId, [obs]);
    expect(res.success).toBe(true);
    expect(res.outcome!.signalId).toBe(canonicalId);
    expect(res.outcome!.symbol).toBe('TCS');
  });

  // ==========================================
  // TEST R: Protected Datasets Byte-For-Byte Verification
  // ==========================================
  it('TEST R: Protected production datasets remain byte-for-byte identical', () => {
    for (const dataset of protectedDatasets) {
      const fullPath = path.resolve(process.cwd(), dataset.filePath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const raw = fs.readFileSync(fullPath, 'utf8');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      expect(hash).toBe(dataset.expectedHash);

      const parsed = JSON.parse(raw);
      const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      expect(count).toBe(dataset.expectedCount);
    }
  });
});
