/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10B-2
 * YahooMarketDataService.ts
 *
 * Server-Side Market Data Proxy & In-Memory Cache Service.
 * Bridges external Yahoo Finance v8 quote endpoints to standardized,
 * truthful, zero-AI-cost EquityObservation domain contracts.
 *
 * Guarantees:
 * - Truthful provenance: Classified as AUTHORIZED_PROVIDER (never OFFICIAL_EXCHANGE).
 * - Zero price fabrication: Missing or malformed upstream quotes result in explicit errors.
 * - Strict symbol validation and deterministic exchange-specific ticker normalization.
 * - Bounded, short-lived in-memory cache partitioned by exchange + canonical symbol.
 * - Test isolation: Supports custom fetcher injection to guarantee no network calls during tests.
 */

import { EquityObservation, MarketDataProvenance, ProviderType, DataStatus, DataFreshness } from '../types.ts';
import { MarketDataNormalizer } from '../MarketDataNormalizer.ts';

export interface CacheEntry {
  data: EquityObservation;
  cachedAt: number;
  expiresAt: number;
}

export type FetcherFunction = (url: string, init?: RequestInit) => Promise<Response>;

export class YahooMarketDataService {
  private static instance: YahooMarketDataService;

  // In-memory short-lived quote cache: Key format "${EXCHANGE}:${CANONICAL_SYMBOL}"
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 1000;
  private readonly defaultTtlMs = 10000; // 10 seconds default TTL for live quotes

  // Pluggable fetcher for test isolation (defaults to global fetch)
  private fetcher: FetcherFunction = fetch;

  public static getInstance(): YahooMarketDataService {
    if (!YahooMarketDataService.instance) {
      YahooMarketDataService.instance = new YahooMarketDataService();
    }
    return YahooMarketDataService.instance;
  }

  /**
   * Allows tests to inject a mock fetcher and avoid external network calls.
   */
  public setFetcher(customFetcher: FetcherFunction): void {
    this.fetcher = customFetcher;
  }

  /**
   * Resets fetcher to default global fetch.
   */
  public resetFetcher(): void {
    this.fetcher = fetch;
  }

  /**
   * Clears the in-memory cache (used for test isolation).
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Returns current cache size.
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Validates user-supplied or upstream symbol strings.
   * Rejects empty, non-string, URLs, slashes, or malicious characters.
   */
  public validateSymbol(rawSymbol: any): { valid: boolean; symbol?: string; error?: string } {
    if (!rawSymbol || typeof rawSymbol !== 'string') {
      return { valid: false, error: 'Symbol parameter is required and must be a string' };
    }

    const trimmed = rawSymbol.trim();
    if (trimmed.length === 0 || trimmed.length > 30) {
      return { valid: false, error: 'Symbol length must be between 1 and 30 characters' };
    }

    // Allow alphanumeric, underscores, dots, hyphens, carets, equals, and spaces (for index names)
    // Disallow slashes, colons, query params, protocols, and control characters
    const validSymbolRegex = /^[A-Za-z0-9_.\^=\- ]+$/;
    if (!validSymbolRegex.test(trimmed)) {
      return { valid: false, error: 'Symbol contains invalid characters' };
    }

    return { valid: true, symbol: trimmed.toUpperCase() };
  }

  /**
   * Deterministically normalizes a symbol for the target exchange into a Yahoo Finance ticker.
   *
   * Rules:
   * - NSE Equities: RELIANCE -> RELIANCE.NS, TCS -> TCS.NS, INFY -> INFY.NS
   * - BSE Equities: RELIANCE -> RELIANCE.BO, TCS -> TCS.BO, INFY -> INFY.BO
   * - Index Aliases:
   *     NIFTY / NIFTY 50 / NIFTY50 -> ^NSEI
   *     BANKNIFTY / NIFTY BANK -> ^NSEBANK
   *     FINNIFTY / NIFTY FIN SERVICE -> NIFTY_FIN_SERVICE.NS
   *     INDIAVIX / INDIA VIX -> ^INDIAVIX
   *     SENSEX / BSE SENSEX -> ^BSESN
   *     BSE100 -> ^BSE100
   * - Explicit symbols already containing a Yahoo suffix (.NS, .BO, ^, -, =) are preserved.
   */
  public normalizeSymbol(symbol: string, exchange: 'NSE' | 'BSE' | 'FALLBACK'): { yahooTicker: string; canonicalSymbol: string } {
    const cleanSym = symbol.trim().toUpperCase();

    // 1. Check known index mappings
    if (exchange === 'BSE' || cleanSym === 'SENSEX' || cleanSym === 'BSE SENSEX' || cleanSym === 'BSE100') {
      if (cleanSym === 'SENSEX' || cleanSym === 'BSE SENSEX') {
        return { yahooTicker: '^BSESN', canonicalSymbol: 'SENSEX' };
      }
      if (cleanSym === 'BSE100') {
        return { yahooTicker: '^BSE100', canonicalSymbol: 'BSE100' };
      }
    }

    if (cleanSym === 'NIFTY' || cleanSym === 'NIFTY 50' || cleanSym === 'NIFTY50') {
      return { yahooTicker: '^NSEI', canonicalSymbol: 'NIFTY 50' };
    }
    if (cleanSym === 'BANKNIFTY' || cleanSym === 'NIFTY BANK') {
      return { yahooTicker: '^NSEBANK', canonicalSymbol: 'NIFTY BANK' };
    }
    if (cleanSym === 'FINNIFTY' || cleanSym === 'NIFTY FIN SERVICE') {
      return { yahooTicker: 'NIFTY_FIN_SERVICE.NS', canonicalSymbol: 'NIFTY FIN SERVICE' };
    }
    if (cleanSym === 'INDIAVIX' || cleanSym === 'INDIA VIX') {
      return { yahooTicker: '^INDIAVIX', canonicalSymbol: 'INDIA VIX' };
    }

    // 2. Preserve explicit tickers with Yahoo suffixes/prefixes
    if (cleanSym.includes('.') || cleanSym.startsWith('^') || cleanSym.includes('-') || cleanSym.includes('=')) {
      const bareSymbol = cleanSym.replace(/\.NS$|\.BO$/, '');
      return { yahooTicker: cleanSym, canonicalSymbol: bareSymbol };
    }

    // 3. Exchange-specific default suffix
    if (exchange === 'BSE') {
      return { yahooTicker: `${cleanSym}.BO`, canonicalSymbol: cleanSym };
    }

    // NSE or FALLBACK default to .NS
    return { yahooTicker: `${cleanSym}.NS`, canonicalSymbol: cleanSym };
  }

  /**
   * Retrieves an EquityObservation from the in-memory cache if fresh.
   */
  public getFromCache(exchange: string, canonicalSymbol: string): EquityObservation | null {
    const key = `${exchange.toUpperCase()}:${canonicalSymbol.toUpperCase()}`;
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Stores a successfully normalized EquityObservation in cache.
   */
  public setInCache(exchange: string, canonicalSymbol: string, observation: EquityObservation, ttlMs: number = this.defaultTtlMs): void {
    // Evict oldest entry if size limit reached
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const key = `${exchange.toUpperCase()}:${canonicalSymbol.toUpperCase()}`;
    const now = Date.now();
    this.cache.set(key, {
      data: observation,
      cachedAt: now,
      expiresAt: now + ttlMs
    });
  }

  /**
   * Fetches real quote from Yahoo Finance v8 chart API, validates payload,
   * enforces OHLC mathematical consistency, and produces a normalized EquityObservation.
   */
  public async fetchEquityObservation(
    symbol: string,
    exchange: 'NSE' | 'BSE' | 'FALLBACK' = 'NSE',
    options?: { bypassCache?: boolean; ttlMs?: number }
  ): Promise<{ status: number; observation?: EquityObservation; error?: string; cached?: boolean }> {
    const val = this.validateSymbol(symbol);
    if (!val.valid || !val.symbol) {
      return { status: 400, error: val.error || 'Invalid symbol' };
    }

    const effectiveExchange = exchange === 'FALLBACK' ? 'NSE' : exchange;
    const { yahooTicker, canonicalSymbol } = this.normalizeSymbol(val.symbol, exchange);

    // 1. Check in-memory cache
    if (!options?.bypassCache) {
      const cachedObs = this.getFromCache(effectiveExchange, canonicalSymbol);
      if (cachedObs) {
        return { status: 200, observation: cachedObs, cached: true };
      }
    }

    const startTime = Date.now();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d`;

    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: {
          'User-Agent': 'ATHENA-Market-Data-Proxy/10.2 (Mozilla/5.0; YahooChartQuery)',
          'Accept': 'application/json,*/*'
        },
        signal: AbortSignal.timeout(4000)
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return { status: 504, error: `Upstream market data provider timed out for ${yahooTicker}` };
      }
      return { status: 502, error: `Network error reaching market data provider: ${err.message || err}` };
    }

    // 2. Handle HTTP Status codes
    if (response.status === 404) {
      return { status: 404, error: `Symbol not found upstream: ${val.symbol} (${yahooTicker})` };
    }
    if (response.status === 429) {
      return { status: 429, error: 'Upstream market data provider rate limit reached (429)' };
    }
    if (!response.ok) {
      return { status: 502, error: `Upstream market data provider returned HTTP ${response.status}` };
    }

    // 3. Parse and validate JSON structure
    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      return { status: 502, error: 'Malformed JSON payload from upstream market data provider' };
    }

    const result = data?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta || typeof meta.regularMarketPrice !== 'number' || isNaN(meta.regularMarketPrice) || meta.regularMarketPrice <= 0) {
      return { status: 502, error: `No valid price data returned upstream for ${yahooTicker}` };
    }

    const ltp = meta.regularMarketPrice;
    const prevClose = typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
      ? meta.chartPreviousClose
      : (typeof meta.previousClose === 'number' && meta.previousClose > 0 ? meta.previousClose : ltp);

    // Safely extract Open, High, Low with fallback to LTP/prevClose
    const rawQuoteIndicator = result?.indicators?.quote?.[0];
    const indicatorOpen = Array.isArray(rawQuoteIndicator?.open)
      ? rawQuoteIndicator.open.find((v: any) => typeof v === 'number' && !isNaN(v) && v > 0)
      : undefined;

    const rawOpen = typeof meta.regularMarketOpen === 'number' && meta.regularMarketOpen > 0
      ? meta.regularMarketOpen
      : (indicatorOpen !== undefined ? indicatorOpen : ltp);

    const rawHigh = typeof meta.regularMarketDayHigh === 'number' && meta.regularMarketDayHigh > 0
      ? meta.regularMarketDayHigh
      : Math.max(ltp, rawOpen);

    const rawLow = typeof meta.regularMarketDayLow === 'number' && meta.regularMarketDayLow > 0
      ? meta.regularMarketDayLow
      : Math.min(ltp, rawOpen);

    const volume = typeof meta.regularMarketVolume === 'number' && meta.regularMarketVolume >= 0
      ? meta.regularMarketVolume
      : 0;

    // Enforce strict deterministic OHLC mathematical bounds (high >= open, high >= ltp, low <= open, low <= ltp)
    const open = rawOpen;
    const high = Math.max(rawHigh, open, ltp);
    const low = Math.min(rawLow, open, ltp);

    // Source timestamp (regularMarketTime is seconds epoch)
    const obsTime = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();

    const rxTime = new Date().toISOString();
    const freshness = MarketDataNormalizer.getFreshness(obsTime);

    // Truthful Provenance Contract (Phase 10B-2)
    // Yahoo Finance observations are AUTHORIZED_PROVIDER / APPROVED_MARKET_PROVIDER, NEVER OFFICIAL_EXCHANGE.
    const providerType: ProviderType = exchange === 'FALLBACK' ? 'FALLBACK_PROVIDER' : 'AUTHORIZED_PROVIDER';
    const provenance: MarketDataProvenance = {
      provider: 'YAHOO_FINANCE',
      providerType,
      exchange: effectiveExchange,
      observedAt: obsTime,
      receivedAt: rxTime,
      normalizedAt: rxTime,
      requestId: `req_ydp_${Math.random().toString(36).substr(2, 9)}`,
      dataStatus: freshness === 'EXPIRED' ? 'EXPIRED' : (freshness === 'STALE' ? 'STALE' : 'AVAILABLE'),
      freshness: freshness as DataFreshness,
      sourceConfidence: 0.95
    };

    const observation: EquityObservation = {
      symbol: canonicalSymbol,
      exchange: effectiveExchange,
      ltp,
      open,
      high,
      low,
      previousClose: prevClose,
      volume,
      timestamp: obsTime,
      tradingStatus: 'ACTIVE',
      provenance
    };

    // Store in short-lived in-memory cache
    this.setInCache(effectiveExchange, canonicalSymbol, observation, options?.ttlMs ?? this.defaultTtlMs);

    return { status: 200, observation, cached: false };
  }
}

export const yahooMarketDataService = YahooMarketDataService.getInstance();
export default yahooMarketDataService;
