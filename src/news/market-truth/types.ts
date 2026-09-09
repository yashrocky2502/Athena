/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER & CANONICAL MARKET STATE ENGINE
 * types.ts
 * 
 * Canonical schemas, contracts, and type declarations for deterministic market truth.
 * ZERO-AI: All calculations and validation rules are deterministic.
 */

export type AssetClass = 'EQUITY' | 'FUTURES' | 'OPTIONS' | 'INDEX' | 'ETF' | 'COMMODITY' | 'CRYPTO';

export type MarketExchange = 'NSE' | 'BSE' | 'MCX' | 'GLOBAL' | 'UNKNOWN';

export type MarketSessionState = 
  | 'PRE_OPEN'
  | 'OPEN'
  | 'CONTINUOUS_TRADING'
  | 'AUCTION'
  | 'POST_MARKET'
  | 'CLOSED'
  | 'HOLIDAY'
  | 'HALTED'
  | 'UNKNOWN';

export type FreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'DISCONNECTED' | 'UNKNOWN';

export type TickValidationStatus = 
  | 'VALID'
  | 'ANOMALOUS'
  | 'DISCONTINUOUS'
  | 'OUT_OF_ORDER'
  | 'DUPLICATE'
  | 'INVALID_PRICE'
  | 'INVALID_OHLC'
  | 'INVALID_SPREAD'
  | 'CROSSED_MARKET'
  | 'REJECTED';

export type MarketTruthStatus = 
  | 'VALID'
  | 'DEGRADED'
  | 'STALE'
  | 'CONTRADICTED'
  | 'INVALID'
  | 'DISCONNECTED'
  | 'UNKNOWN';

export type DiscontinuityClassification = 
  | 'NORMAL_MOVE'
  | 'LARGE_MOVE'
  | 'ANOMALOUS_MOVE'
  | 'EXTREME_SHOCK'
  | 'INVALID_MOVE';

export type CorporateActionStatus = 
  | 'NONE'
  | 'ADJUSTED'
  | 'CORPORATE_ACTION_UNCERTAIN';

export type OptionType = 'CALL' | 'PUT';

export type Moneyness = 'DEEP_ITM' | 'ITM' | 'ATM' | 'OTM' | 'DEEP_OTM';

export type SourcePriorityLevel = 'P0_AUTHORITATIVE' | 'P1_PRIMARY' | 'P2_SECONDARY' | 'P3_FALLBACK';

export interface DataLineageProvenance {
  source: string;
  sourceTimestamp: string;
  receivedTimestamp: string;
  normalizationVersion: string;
  validationVersion: string;
  qualityVersion: string;
  correlationId: string;
  isModified: boolean;
  modificationReason?: string;
}

export interface CanonicalOrderBookLevel {
  price: number;
  quantity: number;
  ordersCount?: number;
}

export interface CanonicalOrderBook {
  symbol: string;
  timestamp: string;
  bids: CanonicalOrderBookLevel[];
  asks: CanonicalOrderBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  spreadPercent: number | null;
  topOfBookLiquidity: number;
  depthImbalance: number;
  weightedMidPrice: number | null;
  orderBookImbalance: number;
  isCrossed: boolean;
  isLocked: boolean;
  isStale: boolean;
  validationStatus: TickValidationStatus;
}

export interface CanonicalMarketTick {
  instrumentId: string;
  symbol: string;
  canonicalSymbol: string;
  exchange: MarketExchange;
  assetClass: AssetClass;
  timestamp: string;
  exchangeTimestamp: string;
  receivedTimestamp: string;
  sequenceNumber: number;
  lastPrice: number;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  tradedValue: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  bidQuantity: number | null;
  askQuantity: number | null;
  spread: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  VWAP: number | null;
  marketStatus: MarketSessionState;
  source: string;
  sourcePriority: SourcePriorityLevel;
  qualityStatus: MarketTruthStatus;
  freshnessStatus: FreshnessStatus;
  validationStatus: TickValidationStatus;
  discontinuityClassification?: DiscontinuityClassification;
  corporateActionStatus?: CorporateActionStatus;
  provenance: DataLineageProvenance;
}

export interface CanonicalDerivativeState {
  underlyingSymbol: string;
  instrumentType: 'FUTURES' | 'OPTIONS';
  expiry: string;
  strike: number | null;
  optionType: OptionType | null;
  contractSize: number;
  lastPrice: number;
  openInterest: number;
  openInterestChange: number;
  openInterestChangePercent: number;
  impliedVolatility: number | null;
  volume: number;
  bidPrice: number | null;
  askPrice: number | null;
  spread: number | null;
  futuresBasis: number | null;
  futuresBasisPercent: number | null;
  intrinsicValue: number | null;
  extrinsicValue: number | null;
  moneyness: Moneyness | null;
  oiConcentrationType?: 'CALL_RESISTANCE' | 'PUT_SUPPORT' | 'CALL_BUILDUP' | 'PUT_BUILDUP' | 'MIXED';
}

export interface CanonicalInstrumentState {
  symbol: string;
  canonicalSymbol: string;
  assetClass: AssetClass;
  exchange: MarketExchange;
  latestTick: CanonicalMarketTick;
  orderBook?: CanonicalOrderBook;
  derivativeState?: CanonicalDerivativeState;
  historicalPrices: number[];
  recentAtrs: number[];
  rollingVolatilities: number[];
  freshnessScore: number;
  qualityScore: number;
  integrityScore: number;
  sourceAgreementScore: number;
  lastValidatedAt: string;
  status: MarketTruthStatus;
}

export interface CanonicalMarketQuality {
  overallQualityScore: number;
  freshnessScore: number;
  integrityScore: number;
  sourceAgreementScore: number;
  activeSourcesCount: number;
  staleInstrumentsCount: number;
  anomalousInstrumentsCount: number;
  contradictedInstrumentsCount: number;
  status: MarketTruthStatus;
}

export interface CanonicalMarketSource {
  sourceId: string;
  name: string;
  priority: SourcePriorityLevel;
  feedLatencyMs: number;
  lastHeartbeat: string;
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
  ticksReceivedCount: number;
  errorCount: number;
  disagreementCount: number;
}

export interface CanonicalMarketSession {
  state: MarketSessionState;
  exchange: MarketExchange;
  isHoliday: boolean;
  isWeekend: boolean;
  isSpecialSession: boolean;
  isExpiryDay: boolean;
  sessionStartTime: string;
  sessionEndTime: string;
  timeToNextSessionMs: number;
}

export interface MarketBreadth {
  advances: number;
  declines: number;
  unchanged: number;
  advanceDeclineRatio: number;
  newFiftyTwoWeekHighs: number;
  newFiftyTwoWeekLows: number;
}

export interface CanonicalMarketSnapshot {
  snapshotId: string;
  timestamp: string;
  session: CanonicalMarketSession;
  indices: Record<string, CanonicalMarketTick>;
  sectors: Record<string, { symbol: string; name: string; changePercent: number; weightedContribution: number }>;
  equities: Record<string, CanonicalInstrumentState>;
  derivatives: {
    niftyFuturesBasis: number | null;
    bankNiftyFuturesBasis: number | null;
    indiaVix: number;
    pcrRatio: number;
    maxPainStrike: number | null;
    activeStrikes: CanonicalDerivativeState[];
  };
  volatilityState: {
    indiaVix: number;
    vixChangePercent: number;
    regime: 'LOW_VOL' | 'NORMAL_VOL' | 'ELEVATED_VOL' | 'HIGH_VOL_EXTREME';
  };
  liquidityState: {
    averageSpreadPercent: number;
    totalMarketTurnoverINR: number;
    liquidityCondition: 'AMPLE' | 'NORMAL' | 'THIN' | 'DISTRESSED';
  };
  breadth: MarketBreadth;
  quality: CanonicalMarketQuality;
  provenance: DataLineageProvenance;
}

export interface CanonicalMarketTruthState {
  version: 'v22_market_truth';
  timestamp: string;
  overallStatus: MarketTruthStatus;
  circuitBreakerTripped: boolean;
  circuitBreakerReason?: string;
  quality: CanonicalMarketQuality;
  session: CanonicalMarketSession;
  latestSnapshot: CanonicalMarketSnapshot;
  activeAnomalies: {
    instrumentId: string;
    symbol: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    timestamp: string;
  }[];
}

export interface MarketTruthTelemetry {
  ticksReceived: number;
  ticksRejected: number;
  ticksNormalized: number;
  staleTicks: number;
  duplicateTicks: number;
  sequenceGaps: number;
  sourceDisagreements: number;
  invalidOrderBooks: number;
  priceAnomalies: number;
  feedDisconnects: number;
  canonicalSnapshotsGenerated: number;
  averageProcessingLatencyMs: number;
  maximumProcessingLatencyMs: number;
}
