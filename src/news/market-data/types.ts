export type MarketDataMode = 'PRODUCTION' | 'DEGRADED' | 'TEST' | 'MOCK';

export type ProviderType = 'OFFICIAL_EXCHANGE' | 'AUTHORIZED_PROVIDER' | 'FALLBACK_PROVIDER' | 'TEST_PROVIDER' | 'UNAVAILABLE';

export type DataStatus = 'AVAILABLE' | 'PARTIAL' | 'STALE' | 'EXPIRED' | 'UNAVAILABLE' | 'INVALID' | 'PROVIDER_CONFLICT';

export type DataFreshness = 'REAL_TIME' | 'FRESH' | 'STALE' | 'EXPIRED' | 'UNAVAILABLE' | 'NOT_AVAILABLE';

export interface MarketDataProvenance {
  provider: string;
  providerType: ProviderType;
  exchange: string;
  observedAt: string;     // UTC ISO string
  receivedAt: string;     // UTC ISO string
  normalizedAt: string;   // UTC ISO string
  requestId: string;
  dataStatus: DataStatus;
  freshness: DataFreshness;
  sourceConfidence: number; // 0.0 to 1.0
}

export interface EquityObservation {
  symbol: string;
  exchange: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  timestamp: string;      // UTC ISO string
  tradingStatus: string;  // e.g. "ACTIVE", "SUSPENDED"
  provenance: MarketDataProvenance;
}

export interface FuturesObservation {
  symbol: string;
  expiry: string;         // YYYY-MM-DD
  ltp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  openInterest: number;
  openInterestChange: number;
  timestamp: string;      // UTC ISO string
  provenance: MarketDataProvenance;
}

export interface OptionObservation {
  underlying: string;
  expiry: string;         // YYYY-MM-DD
  strike: number;
  optionType: 'CALL' | 'PUT';
  ltp: number;
  volume: number;
  openInterest: number;
  openInterestChange: number;
  impliedVolatility: number;
  timestamp: string;      // UTC ISO string
  provenance: MarketDataProvenance;
}

export interface OptionChainSnapshot {
  underlying: string;
  timestamp: string;      // UTC ISO string
  contracts: OptionObservation[];
  provenance: MarketDataProvenance;
}

// Normalized Strike Concentration metrics (Section 13)
export type ConcentrationType = 'CALL_RESISTANCE' | 'PUT_SUPPORT' | 'CALL_BUILDUP' | 'PUT_BUILDUP' | 'MIXED';

export interface StrikeConcentrationItem {
  strike: number;
  callOI: number;
  putOI: number;
  callOIChange: number;
  putOIChange: number;
  rank: number;
  concentrationType: ConcentrationType;
}

// Error classification as requested (Section 15)
export type MarketDataErrorType = 
  | 'TRANSIENT_RATE_LIMIT'
  | 'TRANSIENT_PROVIDER_FAILURE'
  | 'PROVIDER_ACCESS_DENIED'
  | 'RESOURCE_NOT_FOUND'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_PAYLOAD'
  | 'PROVIDER_CONFLICT'
  | 'UNKNOWN_ERROR';

export interface MarketDataTelemetry {
  providerRequests: Record<string, number>;
  providerSuccesses: Record<string, number>;
  providerFailures: Record<string, number>;
  providerLatencies: Record<string, number[]>; // Array of latencies for avg/p95 calculations
  errorCounts: Record<MarketDataErrorType, number>;
  circuitBreakerTransitions: number;
  staleCount: number;
  expiredCount: number;
  unavailableCount: number;
  malformedCount: number;
  fallbackCount: number;
  zeroAiCalculations: number;
  providerConflictCount: number;
}
