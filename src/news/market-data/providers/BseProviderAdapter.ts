import { IMarketDataProvider } from '../MarketDataProvider.ts';
import { EquityObservation, FuturesObservation, OptionChainSnapshot } from '../types.ts';
import { MarketDataNormalizer } from '../MarketDataNormalizer.ts';
import { MarketDataCircuitBreaker } from '../MarketDataCircuitBreaker.ts';

export class BseProviderAdapter implements IMarketDataProvider {
  public readonly name = 'BSE';
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
        exchange: 'BSE',
        // BSE prices might have a very tiny spread compared to NSE, e.g. 0.05 paise difference
        ltp: symbol.toUpperCase() === 'NIFTY' ? 24502 : 2551,
        open: symbol.toUpperCase() === 'NIFTY' ? 24401 : 2531,
        high: symbol.toUpperCase() === 'NIFTY' ? 24601 : 2571,
        low: symbol.toUpperCase() === 'NIFTY' ? 24351 : 2521,
        previousClose: symbol.toUpperCase() === 'NIFTY' ? 24381 : 2516,
        volume: 800000,
        timestamp: new Date().toISOString()
      };
      const norm = MarketDataNormalizer.normalizeEquity(mockRaw, {
        provider: this.name,
        providerType: 'OFFICIAL_EXCHANGE',
        exchange: 'BSE'
      });
      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    }

    try {
      const resp = await fetch(`/api/market-data/bse/equity?symbol=${encodeURIComponent(symbol)}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'ATHENA-Market-Feed/9.3' },
        signal: AbortSignal.timeout(5000)
      });

      if (resp.status === 429) {
        MarketDataCircuitBreaker.recordFailure(this.name, 'TRANSIENT_RATE_LIMIT', true);
        throw new Error('BSE Provider rate limit hit (429)');
      }

      if (!resp.ok) {
        MarketDataCircuitBreaker.recordFailure(this.name, `HTTP_ERROR_${resp.status}`);
        throw new Error(`BSE Provider HTTP failure: ${resp.status}`);
      }

      const raw = await resp.json();
      const norm = MarketDataNormalizer.normalizeEquity(raw, {
        provider: this.name,
        providerType: 'OFFICIAL_EXCHANGE',
        exchange: 'BSE'
      });

      if (!norm) {
        MarketDataCircuitBreaker.recordMalformed(this.name);
        throw new Error('BSE Provider returned malformed or invalid OHLC payload');
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
        exchange: 'BSE',
        expiry: expDate,
        ltp: symbol.toUpperCase() === 'NIFTY' ? 24582 : 2566,
        open: symbol.toUpperCase() === 'NIFTY' ? 24452 : 2541,
        high: symbol.toUpperCase() === 'NIFTY' ? 24652 : 2581,
        low: symbol.toUpperCase() === 'NIFTY' ? 24402 : 2531,
        previousClose: symbol.toUpperCase() === 'NIFTY' ? 24432 : 2526,
        volume: 150000,
        openInterest: 5000000,
        openInterestChange: 50000,
        timestamp: new Date().toISOString()
      };
      const norm = MarketDataNormalizer.normalizeFutures(mockRaw, {
        provider: this.name,
        providerType: 'OFFICIAL_EXCHANGE',
        exchange: 'BSE'
      });
      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    }

    try {
      const resp = await fetch(`/api/market-data/bse/futures?symbol=${encodeURIComponent(symbol)}&expiry=${expDate}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (resp.status === 429) {
        MarketDataCircuitBreaker.recordFailure(this.name, 'TRANSIENT_RATE_LIMIT', true);
        throw new Error('BSE Provider rate limit hit (429)');
      }

      if (!resp.ok) {
        MarketDataCircuitBreaker.recordFailure(this.name, `HTTP_ERROR_${resp.status}`);
        throw new Error(`BSE Provider HTTP failure: ${resp.status}`);
      }

      const raw = await resp.json();
      const norm = MarketDataNormalizer.normalizeFutures(raw, {
        provider: this.name,
        providerType: 'OFFICIAL_EXCHANGE',
        exchange: 'BSE'
      });

      if (!norm) {
        MarketDataCircuitBreaker.recordMalformed(this.name);
        throw new Error('BSE Provider returned malformed or invalid Futures payload');
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
          ltp: Math.max(10, 151 - i * step * 0.8),
          volume: 20000,
          openInterest: 300000 - i * 15000,
          openInterestChange: 6000 + i * 1500,
          impliedVolatility: 15.8,
          timestamp: timeStr
        });

        rawContracts.push({
          underlying: symbol,
          expiry: expDate,
          strike,
          optionType: 'PUT',
          ltp: Math.max(10, 151 + i * step * 0.8),
          volume: 18000,
          openInterest: 270000 + i * 12000,
          openInterestChange: 5400 - i * 900,
          impliedVolatility: 16.5,
          timestamp: timeStr
        });
      }

      const norm = MarketDataNormalizer.normalizeOptionChain(symbol, rawContracts, {
        provider: this.name,
        providerType: 'OFFICIAL_EXCHANGE',
        exchange: 'BSE'
      });
      MarketDataCircuitBreaker.recordSuccess(this.name, Date.now() - startTime);
      return norm;
    }

    try {
      const resp = await fetch(`/api/market-data/bse/options?symbol=${encodeURIComponent(symbol)}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (resp.status === 429) {
        MarketDataCircuitBreaker.recordFailure(this.name, 'TRANSIENT_RATE_LIMIT', true);
        throw new Error('BSE Provider rate limit hit (429)');
      }

      if (!resp.ok) {
        MarketDataCircuitBreaker.recordFailure(this.name, `HTTP_ERROR_${resp.status}`);
        throw new Error(`BSE Provider HTTP failure: ${resp.status}`);
      }

      const raw = await resp.json();
      const norm = MarketDataNormalizer.normalizeOptionChain(symbol, raw.contracts || [], {
        provider: this.name,
        providerType: 'OFFICIAL_EXCHANGE',
        exchange: 'BSE'
      });

      if (!norm) {
        MarketDataCircuitBreaker.recordMalformed(this.name);
        throw new Error('BSE Provider returned malformed or invalid Option Chain payload');
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
export default BseProviderAdapter;
