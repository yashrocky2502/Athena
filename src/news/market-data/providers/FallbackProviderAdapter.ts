import { IMarketDataProvider } from '../MarketDataProvider.ts';
import { EquityObservation, FuturesObservation, OptionChainSnapshot } from '../types.ts';
import { MarketDataNormalizer } from '../MarketDataNormalizer.ts';
import { MarketDataCircuitBreaker } from '../MarketDataCircuitBreaker.ts';

export class FallbackProviderAdapter implements IMarketDataProvider {
  public readonly name = 'FALLBACK';
  private mode: 'PRODUCTION' | 'DEGRADED' | 'TEST' | 'MOCK' = 'PRODUCTION';

  constructor(mode?: 'PRODUCTION' | 'DEGRADED' | 'TEST' | 'MOCK') {
    if (mode) this.mode = mode;
  }

  public setMode(mode: 'PRODUCTION' | 'DEGRADED' | 'TEST' | 'MOCK'): void {
    this.mode = mode;
  }

  public async getEquityObservation(symbol: string): Promise<EquityObservation | null> {
    const startTime = Date.now();
    if (!MarketDataCircuitBreaker.isAllowedToCall(this.name)) {
      throw new Error(`Provider ${this.name} is quarantined or rate limited.`);
    }

    if (this.mode === 'TEST' || this.mode === 'MOCK') {
      const mockRaw = {
        symbol: symbol.toUpperCase(),
        exchange: 'NSE',
        ltp: symbol.toUpperCase() === 'NIFTY' ? 24495 : 2548,
        open: symbol.toUpperCase() === 'NIFTY' ? 24400 : 2530,
        high: symbol.toUpperCase() === 'NIFTY' ? 24600 : 2570,
        low: symbol.toUpperCase() === 'NIFTY' ? 24350 : 2520,
        previousClose: symbol.toUpperCase() === 'NIFTY' ? 24380 : 2515,
        volume: 600000,
        timestamp: new Date().toISOString()
      };
      const norm = MarketDataNormalizer.normalizeEquity(mockRaw, {
        provider: this.name,
        providerType: 'FALLBACK_PROVIDER',
        exchange: 'NSE'
      });
      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    }

    try {
      const resp = await fetch(`/api/market-data/fallback/equity?symbol=${encodeURIComponent(symbol)}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'ATHENA-Market-Feed/9.3' },
        signal: AbortSignal.timeout(5000)
      });

      if (resp.status === 429) {
        MarketDataCircuitBreaker.recordFailure(this.name, 'TRANSIENT_RATE_LIMIT', true);
        throw new Error('FALLBACK Provider rate limit hit (429)');
      }

      if (!resp.ok) {
        MarketDataCircuitBreaker.recordFailure(this.name, `HTTP_ERROR_${resp.status}`);
        throw new Error(`FALLBACK Provider HTTP failure: ${resp.status}`);
      }

      const raw = await resp.json();
      const norm = MarketDataNormalizer.normalizeEquity(raw, {
        provider: this.name,
        providerType: 'FALLBACK_PROVIDER',
        exchange: 'NSE'
      });

      if (!norm) {
        MarketDataCircuitBreaker.recordMalformed(this.name);
        throw new Error('FALLBACK Provider returned malformed or invalid OHLC payload');
      }

      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    } catch (err: any) {
      MarketDataCircuitBreaker.recordFailure(this.name, err.message || 'UNKNOWN_ERROR');
      throw err;
    }
  }

  public async getFuturesObservation(symbol: string, expiry?: string): Promise<FuturesObservation | null> {
    const startTime = Date.now();
    if (!MarketDataCircuitBreaker.isAllowedToCall(this.name)) {
      throw new Error(`Provider ${this.name} is quarantined or rate limited.`);
    }

    const expDate = expiry || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

    if (this.mode === 'TEST' || this.mode === 'MOCK') {
      const mockRaw = {
        symbol: symbol.toUpperCase(),
        exchange: 'NSE',
        expiry: expDate,
        ltp: symbol.toUpperCase() === 'NIFTY' ? 24575 : 2562,
        open: symbol.toUpperCase() === 'NIFTY' ? 24450 : 2540,
        high: symbol.toUpperCase() === 'NIFTY' ? 24650 : 2580,
        low: symbol.toUpperCase() === 'NIFTY' ? 24400 : 2530,
        previousClose: symbol.toUpperCase() === 'NIFTY' ? 24430 : 2525,
        volume: 100000,
        openInterest: 3000000,
        openInterestChange: 30000,
        timestamp: new Date().toISOString()
      };
      const norm = MarketDataNormalizer.normalizeFutures(mockRaw, {
        provider: this.name,
        providerType: 'FALLBACK_PROVIDER',
        exchange: 'NSE'
      });
      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    }

    try {
      const resp = await fetch(`/api/market-data/fallback/futures?symbol=${encodeURIComponent(symbol)}&expiry=${expDate}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (resp.status === 429) {
        MarketDataCircuitBreaker.recordFailure(this.name, 'TRANSIENT_RATE_LIMIT', true);
        throw new Error('FALLBACK Provider rate limit hit (429)');
      }

      if (!resp.ok) {
        MarketDataCircuitBreaker.recordFailure(this.name, `HTTP_ERROR_${resp.status}`);
        throw new Error(`FALLBACK Provider HTTP failure: ${resp.status}`);
      }

      const raw = await resp.json();
      const norm = MarketDataNormalizer.normalizeFutures(raw, {
        provider: this.name,
        providerType: 'FALLBACK_PROVIDER',
        exchange: 'NSE'
      });

      if (!norm) {
        MarketDataCircuitBreaker.recordMalformed(this.name);
        throw new Error('FALLBACK Provider returned malformed or invalid Futures payload');
      }

      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    } catch (err: any) {
      MarketDataCircuitBreaker.recordFailure(this.name, err.message || 'UNKNOWN_ERROR');
      throw err;
    }
  }

  public async getOptionChain(symbol: string): Promise<OptionChainSnapshot | null> {
    const startTime = Date.now();
    if (!MarketDataCircuitBreaker.isAllowedToCall(this.name)) {
      throw new Error(`Provider ${this.name} is quarantined or rate limited.`);
    }

    const expDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0];

    if (this.mode === 'TEST' || this.mode === 'MOCK') {
      const centerStrike = symbol.toUpperCase() === 'NIFTY' ? 24500 : 2500;
      const step = symbol.toUpperCase() === 'NIFTY' ? 100 : 50;
      const rawContracts: any[] = [];

      for (let i = -5; i <= 5; i++) {
        const strike = centerStrike + i * step;
        const timeStr = new Date().toISOString();
        
        rawContracts.push({
          underlying: symbol,
          expiry: expDate,
          strike,
          optionType: 'CALL',
          ltp: Math.max(10, 149 - i * step * 0.8),
          volume: 10000,
          openInterest: 100000 - i * 5000,
          openInterestChange: 2000 + i * 500,
          impliedVolatility: 15.9,
          timestamp: timeStr
        });

        rawContracts.push({
          underlying: symbol,
          expiry: expDate,
          strike,
          optionType: 'PUT',
          ltp: Math.max(10, 149 + i * step * 0.8),
          volume: 9000,
          openInterest: 90000 + i * 4000,
          openInterestChange: 1800 - i * 300,
          impliedVolatility: 16.6,
          timestamp: timeStr
        });
      }

      const norm = MarketDataNormalizer.normalizeOptionChain(symbol, rawContracts, {
        provider: this.name,
        providerType: 'FALLBACK_PROVIDER',
        exchange: 'NSE'
      });
      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    }

    try {
      const resp = await fetch(`/api/market-data/fallback/options?symbol=${encodeURIComponent(symbol)}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (resp.status === 429) {
        MarketDataCircuitBreaker.recordFailure(this.name, 'TRANSIENT_RATE_LIMIT', true);
        throw new Error('FALLBACK Provider rate limit hit (429)');
      }

      if (!resp.ok) {
        MarketDataCircuitBreaker.recordFailure(this.name, `HTTP_ERROR_${resp.status}`);
        throw new Error(`FALLBACK Provider HTTP failure: ${resp.status}`);
      }

      const raw = await resp.json();
      const norm = MarketDataNormalizer.normalizeOptionChain(symbol, raw.contracts || [], {
        provider: this.name,
        providerType: 'FALLBACK_PROVIDER',
        exchange: 'NSE'
      });

      if (!norm) {
        MarketDataCircuitBreaker.recordMalformed(this.name);
        throw new Error('FALLBACK Provider returned malformed or invalid Option Chain payload');
      }

      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    } catch (err: any) {
      MarketDataCircuitBreaker.recordFailure(this.name, err.message || 'UNKNOWN_ERROR');
      throw err;
    }
  }

  public getProviderStatus() {
    const health = MarketDataCircuitBreaker.getOrCreateState(this.name);
    return {
      name: this.name,
      mode: this.mode,
      health: health.state,
      telemetry: health
    };
  }
}
export default FallbackProviderAdapter;
