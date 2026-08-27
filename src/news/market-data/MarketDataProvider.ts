import { 
  EquityObservation, 
  FuturesObservation, 
  OptionChainSnapshot, 
  MarketDataMode, 
  MarketDataTelemetry,
  MarketDataErrorType,
  MarketDataProvenance
} from './types.ts';
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

  // Centralized telemetry as requested in Phase 10.5
  public static telemetry: MarketDataTelemetry = {
    providerRequests: { NSE: 0, BSE: 0, FALLBACK: 0 },
    providerSuccesses: { NSE: 0, BSE: 0, FALLBACK: 0 },
    providerFailures: { NSE: 0, BSE: 0, FALLBACK: 0 },
    providerLatencies: { NSE: [], BSE: [], FALLBACK: [] },
    errorCounts: {
      TRANSIENT_RATE_LIMIT: 0,
      TRANSIENT_PROVIDER_FAILURE: 0,
      PROVIDER_ACCESS_DENIED: 0,
      RESOURCE_NOT_FOUND: 0,
      PROVIDER_TIMEOUT: 0,
      INVALID_PROVIDER_PAYLOAD: 0,
      PROVIDER_CONFLICT: 0,
      UNKNOWN_ERROR: 0
    },
    circuitBreakerTransitions: 0,
    staleCount: 0,
    expiredCount: 0,
    unavailableCount: 0,
    malformedCount: 0,
    fallbackCount: 0,
    zeroAiCalculations: 0,
    providerConflictCount: 0
  };

  constructor() {
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
   * Deterministic spread verification to detect provider conflict (Phase 10.5)
   */
  public static detectConflict(symbol: string, obs1: EquityObservation | null, obs2: EquityObservation | null): boolean {
    if (!obs1 || !obs2) return false;
    const p1 = obs1.ltp;
    const p2 = obs2.ltp;
    if (p1 <= 0 || p2 <= 0) return false;

    const smaller = Math.min(p1, p2);
    const diff = Math.abs(p1 - p2);
    const spreadPct = (diff / smaller) * 100;

    const cleanSym = symbol.toUpperCase();
    const isIndex = ['NIFTY', 'NIFTY 50', 'SENSEX', 'NIFTY BANK', 'BANKNIFTY', 'INDIAVIX', 'INDIA VIX'].includes(cleanSym) || cleanSym.includes('INDEX');
    const limit = isIndex ? 1.5 : 3.0;

    return spreadPct > limit;
  }

  /**
   * Helper to map error to strict classification and track telemetry
   */
  private recordTelemetryError(provider: string, err: any): void {
    let errType: MarketDataErrorType = 'UNKNOWN_ERROR';
    const msg = (err.message || '').toUpperCase();

    if (msg.includes('429') || msg.includes('RATE LIMIT')) {
      errType = 'TRANSIENT_RATE_LIMIT';
    } else if (msg.includes('TIMEOUT')) {
      errType = 'PROVIDER_TIMEOUT';
    } else if (msg.includes('403') || msg.includes('ACCESS DENIED')) {
      errType = 'PROVIDER_ACCESS_DENIED';
    } else if (msg.includes('404') || msg.includes('NOT FOUND')) {
      errType = 'RESOURCE_NOT_FOUND';
    } else if (msg.includes('MALFORMED') || msg.includes('INVALID_PROVIDER_PAYLOAD')) {
      errType = 'INVALID_PROVIDER_PAYLOAD';
    } else if (msg.includes('HTTP_ERROR') || msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      errType = 'TRANSIENT_PROVIDER_FAILURE';
    }

    MarketDataProviderManager.telemetry.errorCounts[errType]++;
    MarketDataProviderManager.telemetry.providerFailures[provider] = (MarketDataProviderManager.telemetry.providerFailures[provider] || 0) + 1;
  }

  /**
   * Helper to track latency and successes
   */
  private recordTelemetrySuccess(provider: string, latencyMs: number): void {
    MarketDataProviderManager.telemetry.providerSuccesses[provider] = (MarketDataProviderManager.telemetry.providerSuccesses[provider] || 0) + 1;
    if (!MarketDataProviderManager.telemetry.providerLatencies[provider]) {
      MarketDataProviderManager.telemetry.providerLatencies[provider] = [];
    }
    MarketDataProviderManager.telemetry.providerLatencies[provider].push(latencyMs);
    // cap at 100 entries to prevent memory leak
    if (MarketDataProviderManager.telemetry.providerLatencies[provider].length > 100) {
      MarketDataProviderManager.telemetry.providerLatencies[provider].shift();
    }
  }

  /**
   * Orchestrated Equity observation fetch with dynamic circuit-breaker fallbacks and conflict detection
   */
  public async getEquityObservation(symbol: string): Promise<EquityObservation | null> {
    const adapters = [this.nseAdapter, this.bseAdapter, this.fallbackAdapter];
    let lastError: Error | null = null;
    let successfulObservation: EquityObservation | null = null;

    for (const adapter of adapters) {
      if (!MarketDataCircuitBreaker.isAllowedToCall(adapter.name)) {
        console.warn(`[MarketDataProviderManager] skipping ${adapter.name} due to active quarantine/degradation`);
        continue;
      }

      const startTime = Date.now();
      MarketDataProviderManager.telemetry.providerRequests[adapter.name] = (MarketDataProviderManager.telemetry.providerRequests[adapter.name] || 0) + 1;

      try {
        const observation = await adapter.getEquityObservation(symbol);
        if (observation) {
          this.recordTelemetrySuccess(adapter.name, Date.now() - startTime);
          successfulObservation = observation;
          
          // If we fetched NSE, try to also query BSE in a non-blocking way to check for disagreement/conflict
          if (adapter.name === 'NSE' && MarketDataCircuitBreaker.isAllowedToCall('BSE')) {
            try {
              const bseObs = await this.bseAdapter.getEquityObservation(symbol);
              if (bseObs && MarketDataProviderManager.detectConflict(symbol, observation, bseObs)) {
                MarketDataProviderManager.telemetry.providerConflictCount++;
                MarketDataProviderManager.telemetry.errorCounts.PROVIDER_CONFLICT++;
                observation.provenance.dataStatus = 'PROVIDER_CONFLICT';
                observation.provenance.sourceConfidence = 0.5;
                console.warn(`[MarketDataProviderManager] PROVIDER_CONFLICT detected for ${symbol} between NSE and BSE!`);
              }
            } catch (confErr) {
              // Ignore conf fetch failures to keep main flow non-blocking
            }
          }
          return observation;
        }
      } catch (err: any) {
        lastError = err;
        this.recordTelemetryError(adapter.name, err);
        console.error(`[MarketDataProviderManager] Adapter ${adapter.name} failed for symbol ${symbol}: ${err.message}`);
      }
    }

    // When all providers fail in PRODUCTION, return a compliant UNAVAILABLE observation contract
    if (this.mode === 'PRODUCTION') {
      MarketDataProviderManager.telemetry.unavailableCount++;
      return {
        symbol: symbol.toUpperCase(),
        exchange: 'UNAVAILABLE',
        ltp: 0,
        open: 0,
        high: 0,
        low: 0,
        previousClose: 0,
        volume: 0,
        timestamp: new Date().toISOString(),
        tradingStatus: 'UNAVAILABLE',
        provenance: {
          provider: 'ORCHESTRATOR',
          providerType: 'UNAVAILABLE',
          exchange: 'UNAVAILABLE',
          observedAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          normalizedAt: new Date().toISOString(),
          requestId: `req_unavail_${Math.random().toString(36).substr(2, 9)}`,
          dataStatus: 'UNAVAILABLE',
          freshness: 'UNAVAILABLE',
          sourceConfidence: 0.0
        }
      };
    }

    // In non-production, return the mock fallback
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

      const startTime = Date.now();
      MarketDataProviderManager.telemetry.providerRequests[adapter.name] = (MarketDataProviderManager.telemetry.providerRequests[adapter.name] || 0) + 1;

      try {
        const observation = await adapter.getFuturesObservation(symbol, expiry);
        if (observation) {
          this.recordTelemetrySuccess(adapter.name, Date.now() - startTime);
          return observation;
        }
      } catch (err: any) {
        lastError = err;
        this.recordTelemetryError(adapter.name, err);
        console.error(`[MarketDataProviderManager] Adapter ${adapter.name} failed for futures ${symbol}: ${err.message}`);
      }
    }

    if (this.mode === 'PRODUCTION') {
      MarketDataProviderManager.telemetry.unavailableCount++;
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

      const startTime = Date.now();
      MarketDataProviderManager.telemetry.providerRequests[adapter.name] = (MarketDataProviderManager.telemetry.providerRequests[adapter.name] || 0) + 1;

      try {
        const chain = await adapter.getOptionChain(symbol);
        if (chain) {
          this.recordTelemetrySuccess(adapter.name, Date.now() - startTime);
          return chain;
        }
      } catch (err: any) {
        lastError = err;
        this.recordTelemetryError(adapter.name, err);
        console.error(`[MarketDataProviderManager] Adapter ${adapter.name} failed for option chain ${symbol}: ${err.message}`);
      }
    }

    if (this.mode === 'PRODUCTION') {
      MarketDataProviderManager.telemetry.unavailableCount++;
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
        fallback: this.fallbackAdapter.getProviderStatus(),
        orchestrator: MarketDataProviderManager.telemetry
      }
    };
  }
}

// Global Orchestrator Singleton
export const marketDataProviderManager = new MarketDataProviderManager();
export default marketDataProviderManager;
