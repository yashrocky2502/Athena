import { EquityObservation, FuturesObservation, OptionChainSnapshot, MarketDataMode } from './types.ts';
import { MarketDataCircuitBreaker } from './MarketDataCircuitBreaker.ts';
import { NseProviderAdapter } from './providers/NseProviderAdapter.ts';
import { BseProviderAdapter } from './providers/BseProviderAdapter.ts';
import { FallbackProviderAdapter } from './providers/FallbackProviderAdapter.ts';

export interface IMarketDataProvider {
  readonly name: string;
  getEquityObservation(symbol: string): Promise<EquityObservation | null>;
  getFuturesObservation(symbol: string, expiry?: string): Promise<FuturesObservation | null>;
  getOptionChain(symbol: string): Promise<OptionChainSnapshot | null>;
  getProviderStatus(): { name: string; mode: string; health: string; telemetry: any };
}

export class MarketDataProviderManager implements IMarketDataProvider {
  public readonly name = 'ORCHESTRATOR';
  private mode: MarketDataMode = 'PRODUCTION';
  
  private nseAdapter: NseProviderAdapter;
  private bseAdapter: BseProviderAdapter;
  private fallbackAdapter: FallbackProviderAdapter;

  constructor() {
    // Detect environment from Node process.env (or default to PRODUCTION)
    const env = process.env.NODE_ENV || 'development';
    this.mode = env === 'production' ? 'PRODUCTION' : 'TEST';
    
    this.nseAdapter = new NseProviderAdapter(this.mode);
    this.bseAdapter = new BseProviderAdapter(this.mode);
    this.fallbackAdapter = new FallbackProviderAdapter(this.mode);
  }

  /**
   * Set and enforce mode with production safety assertion (Section 23)
   */
  public setMode(newMode: MarketDataMode): void {
    const isProductionEnv = process.env.NODE_ENV === 'production';
    
    // Hard Safety Assertion (Section 23)
    if (isProductionEnv && (newMode === 'MOCK' || newMode === 'TEST')) {
      throw new Error('[CRITICAL_SECURITY_VIOLATION] Attempted to enable MOCK/TEST mode in a PRODUCTION environment.');
    }

    this.mode = newMode;
    this.nseAdapter.setMode(newMode);
    this.bseAdapter.setMode(newMode);
    this.fallbackAdapter.setMode(newMode);
    console.log(`[MarketDataProviderManager] Mode successfully set to ${newMode}`);
  }

  public getMode(): MarketDataMode {
    return this.mode;
  }

  /**
   * Orchestrated Equity observation fetch with dynamic circuit-breaker fallbacks (Section 15, 16)
   */
  public async getEquityObservation(symbol: string): Promise<EquityObservation | null> {
    const adapters = [this.nseAdapter, this.bseAdapter, this.fallbackAdapter];
    let lastError: Error | null = null;

    for (const adapter of adapters) {
      // Skip adapter if not allowed to call according to circuit breaker (quarantined/disabled)
      if (!MarketDataCircuitBreaker.isAllowedToCall(adapter.name)) {
        console.warn(`[MarketDataProviderManager] skipping ${adapter.name} due to active quarantine/degradation`);
        continue;
      }

      try {
        const observation = await adapter.getEquityObservation(symbol);
        if (observation) {
          return observation;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`[MarketDataProviderManager] Adapter ${adapter.name} failed for symbol ${symbol}: ${err.message}`);
        // Fall back to next adapter in chain
      }
    }

    // Hard fail in production if no adapters succeeded (Section 15)
    if (this.mode === 'PRODUCTION') {
      if (lastError) {
        throw new Error(`[MarketDataProviderManager] All market-data providers failed in PRODUCTION. Last error: ${lastError.message}`);
      }
      return null;
    }

    // In non-production, return a last-resort mock fallback to let the system work smoothly during tests
    return this.nseAdapter.getEquityObservation(symbol);
  }

  /**
   * Orchestrated Futures observation fetch with dynamic circuit-breaker fallbacks
   */
  public async getFuturesObservation(symbol: string, expiry?: string): Promise<FuturesObservation | null> {
    const adapters = [this.nseAdapter, this.bseAdapter, this.fallbackAdapter];
    let lastError: Error | null = null;

    for (const adapter of adapters) {
      if (!MarketDataCircuitBreaker.isAllowedToCall(adapter.name)) {
        continue;
      }

      try {
        const observation = await adapter.getFuturesObservation(symbol, expiry);
        if (observation) {
          return observation;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`[MarketDataProviderManager] Adapter ${adapter.name} failed for futures ${symbol}: ${err.message}`);
      }
    }

    if (this.mode === 'PRODUCTION') {
      if (lastError) {
        throw new Error(`[MarketDataProviderManager] All market-data providers failed in PRODUCTION. Last error: ${lastError.message}`);
      }
      return null;
    }

    return this.nseAdapter.getFuturesObservation(symbol, expiry);
  }

  /**
   * Orchestrated Option Chain fetch with dynamic circuit-breaker fallbacks
   */
  public async getOptionChain(symbol: string): Promise<OptionChainSnapshot | null> {
    const adapters = [this.nseAdapter, this.bseAdapter, this.fallbackAdapter];
    let lastError: Error | null = null;

    for (const adapter of adapters) {
      if (!MarketDataCircuitBreaker.isAllowedToCall(adapter.name)) {
        continue;
      }

      try {
        const chain = await adapter.getOptionChain(symbol);
        if (chain) {
          return chain;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`[MarketDataProviderManager] Adapter ${adapter.name} failed for option chain ${symbol}: ${err.message}`);
      }
    }

    if (this.mode === 'PRODUCTION') {
      if (lastError) {
        throw new Error(`[MarketDataProviderManager] All market-data providers failed in PRODUCTION. Last error: ${lastError.message}`);
      }
      return null;
    }

    return this.nseAdapter.getOptionChain(symbol);
  }

  public getProviderStatus() {
    return {
      name: this.name,
      mode: this.mode,
      health: this.nseAdapter.getProviderStatus().health === 'ACTIVE' ? 'ACTIVE' : 'DEGRADED',
      telemetry: {
        nse: this.nseAdapter.getProviderStatus(),
        bse: this.bseAdapter.getProviderStatus(),
        fallback: this.fallbackAdapter.getProviderStatus()
      }
    };
  }
}

// Global Orchestrator Singleton
export const marketDataProviderManager = new MarketDataProviderManager();
export default marketDataProviderManager;
