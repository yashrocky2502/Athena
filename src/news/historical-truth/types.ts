/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH, TIME-TRAVEL REPLAY & DETERMINISTIC EVENT RECONSTRUCTION ENGINE
 * types.ts
 * 
 * Canonical immutable historical entities, replay sessions, checkpoints,
 * firewall definitions, and diagnostic schemas.
 */

import { CanonicalMarketTick, CanonicalMarketSnapshot, MarketTruthStatus, MarketSessionState } from '../market-truth/types.ts';

// --------------------------------------------------------------------------
// 1. Core Historical Metadata & Enums
// --------------------------------------------------------------------------

export type HistoricalReplayMode = 'EVENT_BY_EVENT' | 'MINUTE_BY_MINUTE' | 'FAST_FORWARD' | 'FULL_DAY';

export type HistoricalReplayStatus = 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'INVALIDATED_LOOKAHEAD';

export type HistoricalDataQualityRating = 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR' | 'INVALID';

export type ReplayDriftType = 'NO_DRIFT' | 'DATA_DRIFT' | 'LOGIC_DRIFT' | 'SCHEMA_DRIFT' | 'NON_DETERMINISTIC_DRIFT';

export type HistoricalSignalLifecycle = 
  | 'CREATED' 
  | 'VALIDATED' 
  | 'TRADEABLE' 
  | 'BLOCKED' 
  | 'CONTRADICTED' 
  | 'EXPIRED' 
  | 'EXECUTED' 
  | 'LEARNED';

export interface HistoricalProvenance {
  source: string;
  sourceTimestamp: string;
  ingestionTimestamp?: string;
  schemaVersion: string;
  deterministicHash: string;
  provenanceId: string;
  isRevised?: boolean;
  revisionVersion?: number;
}

// --------------------------------------------------------------------------
// 2. Canonical Immutable Historical Entities
// --------------------------------------------------------------------------

export interface HistoricalMarketTick extends CanonicalMarketTick {
  historicalReplayId?: string;
  deterministicHash: string;
  provenanceId: string;
}

export interface HistoricalNewsEvent {
  id: string;
  canonicalArticleId: string;
  headline: string;
  summary: string;
  publishedAt: string; // Publication timestamp
  ingestedAt: string;  // Ingestion timestamp
  source: string;
  publisher: string;
  entities: string[];
  sectors: string[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'HIGH_VOLATILITY';
  catalystClassification: string;
  sourceReliability: number; // 0-100
  evidenceReferences: string[];
  isFnO?: boolean;
  deterministicHash: string;
  provenanceId: string;
  schemaVersion: string;
}

export interface HistoricalFilingEvent {
  id: string;
  companySymbol: string;
  filingType: 'QUARTERLY_RESULTS' | 'ANNUAL_REPORT' | 'INSIDER_TRADING' | 'BOARD_MEETING' | 'DISCLOSURE' | 'PRESS_RELEASE';
  headline: string;
  publishedAt: string;
  source: string;
  financialMetrics?: Record<string, number | string>;
  deterministicHash: string;
  provenanceId: string;
  schemaVersion: string;
}

export interface HistoricalCorporateAction {
  id: string;
  symbol: string;
  actionType: 'DIVIDEND' | 'SPLIT' | 'BONUS' | 'RIGHTS' | 'BUYBACK' | 'MERGER';
  exDate: string;
  recordDate: string;
  announcementDate: string;
  adjustmentFactor: number;
  originalPricePreAction?: number;
  deterministicHash: string;
  provenanceId: string;
  schemaVersion: string;
}

export interface HistoricalDerivativeSnapshot {
  timestamp: string;
  underlyingSymbol: string;
  spotPrice: number;
  futuresPrice: number;
  futuresBasis: number;
  atmStrike: number;
  atmIV: number;
  putCallRatioOI: number;
  putCallRatioVolume: number;
  totalOpenInterest: number;
  oiChangePercent: number;
  maxPainStrike: number;
  strikes: Array<{
    strike: number;
    callOI: number;
    putOI: number;
    callIV: number;
    putIV: number;
    callLTP: number;
    putLTP: number;
  }>;
  deterministicHash: string;
  provenanceId: string;
  schemaVersion: string;
}

export interface HistoricalMacroSnapshot {
  timestamp: string;
  rbiRepoRate: number;
  indiaCPI: number;
  india10YBondYield: number;
  us10YBondYield: number;
  usdBrlOrInr: number;
  crudeOilBRENT: number;
  goldUSD: number;
  deterministicHash: string;
  provenanceId: string;
  schemaVersion: string;
}

export interface HistoricalSurveillanceEvent {
  id: string;
  timestamp: string;
  symbol: string;
  anomalyType: 'PRICE_JUMP' | 'VOLUME_SPIKE' | 'VOLATILITY_EXPANSION' | 'OI_DIVERGENCE' | 'IV_CRUSH' | 'CONTRADICTION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectionLatencyMs: number;
  confirmationLatencyMs: number;
  isConfirmed: boolean;
  isFalsePositiveCandidate: boolean;
  score: number;
  description: string;
  deterministicHash: string;
  provenanceId: string;
}

export interface HistoricalSignalState {
  signalId: string;
  timestamp: string;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  reactionScore: number;
  directionalAlignment: number;
  confirmationState: 'CONFIRMED' | 'UNCONFIRMED' | 'CONTRADICTED';
  contradictionState: string;
  transmissionScore: number;
  lifecycleState: HistoricalSignalLifecycle;
  catalystIds: string[];
  deterministicHash: string;
  provenanceId: string;
}

export interface HistoricalStrategyState {
  strategyId: string;
  variantId: string;
  timestamp: string;
  symbol: string;
  parameters: Record<string, any>;
  expectedValue: number;
  riskScore: number;
  probabilityOfProfit: number;
  strategyScore: number;
  regimeCompatibility: string;
  executionFeasibility: boolean;
  deterministicHash: string;
  provenanceId: string;
}

export interface HistoricalPortfolioState {
  timestamp: string;
  nav: number;
  cash: number;
  totalPositionsValue: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  var95: number;
  var99: number;
  concentrationScore: number;
  sectorExposures: Record<string, number>;
  usedMargin: number;
  availableMargin: number;
  maxDrawdownPercent: number;
  stressLossScenarios: {
    niftyMinus5Pct: number;
    crudePlus10Pct: number;
    ivSpike20Pct: number;
  };
  deterministicHash: string;
  provenanceId: string;
}

export interface HistoricalExecutionState {
  orderId: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT';
  requestedPrice: number;
  status: 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  averageFillPrice: number;
  simulatedSlippage: number;
  simulatedCommission: number;
  simulatedLatencyMs: number;
  executionQualityScore: number;
  deterministicHash: string;
  provenanceId: string;
}

// --------------------------------------------------------------------------
// 3. Replay Checkpoints & Sessions
// --------------------------------------------------------------------------

export interface HistoricalReplayCheckpoint {
  checkpointId: string;
  sequence: number;
  timestamp: string;
  canonicalMarketSnapshotHash: string;
  newsStateHash: string;
  surveillanceStateHash: string;
  signalStateHash: string;
  strategyStateHash: string;
  portfolioStateHash: string;
  executionStateHash: string;
  aggregateStateHash: string;
  eventsProcessedCount: number;
}

export interface HistoricalReplayConfig {
  sessionId: string;
  targetDate: string; // YYYY-MM-DD
  startTime: string;  // HH:mm:ss or ISO
  endTime: string;    // HH:mm:ss or ISO
  symbols: string[];
  mode: HistoricalReplayMode;
  speedMultiplier: number; // 1, 5, 10, 50, 0 (instant)
  stepIntervalMs?: number;
  initialCash?: number;
  enforceFirewallStrict: boolean;
}

export interface HistoricalReplaySession {
  id: string;
  config: HistoricalReplayConfig;
  status: HistoricalReplayStatus;
  currentReplayTimestamp: string;
  createdAt: string;
  updatedAt: string;
  eventsTotal: number;
  eventsProcessed: number;
  checkpoints: HistoricalReplayCheckpoint[];
  latestSnapshot?: CanonicalMarketSnapshot;
  latestNews?: HistoricalNewsEvent[];
  latestSurveillance?: HistoricalSurveillanceEvent[];
  latestSignals?: HistoricalSignalState[];
  latestStrategies?: HistoricalStrategyState[];
  latestPortfolio?: HistoricalPortfolioState;
  latestExecutions?: HistoricalExecutionState[];
  lookAheadViolationsCount: number;
  qualityScore: number;
  qualityRating: HistoricalDataQualityRating;
  aggregateHash: string;
}

// --------------------------------------------------------------------------
// 4. Look-Ahead Bias & Diagnostics
// --------------------------------------------------------------------------

export interface LookAheadViolation {
  violationId: string;
  detectedAt: string;
  sourceTimestamp: string;
  replayTimestamp: string;
  source: string;
  field: string;
  leakedValue: any;
  severity: 'CRITICAL_BREACH';
  engine: string;
  message: string;
}

export interface ReplayDriftReport {
  sessionId: string;
  runA_Hash: string;
  runB_Hash: string;
  driftType: ReplayDriftType;
  driftDetails: string[];
  isDeterministic: boolean;
  evaluatedAt: string;
}

export interface DecisionComparisonRecord {
  timestamp: string;
  eventDescription: string;
  originalDecision: string;
  replayedDecision: string;
  differenceType: 'MATCH' | 'DIVERGENCE' | 'CONTRADICTION';
  dataAvailableOriginal: string[];
  dataAvailableReplay: string[];
  affectedEngine: string;
  explanation: string;
}

export interface HistoricalRevisionRecord {
  id: string;
  symbol: string;
  timestamp: string;
  originalVersion: {
    lastPrice: number;
    volume: number;
    hash: string;
    recordedAt: string;
  };
  currentVersion: {
    lastPrice: number;
    volume: number;
    hash: string;
    recordedAt: string;
  };
  revisionReason: 'CORP_ACTION_ADJUSTMENT' | 'EXCHANGE_CORRECTION' | 'RESTATED_METRICS';
  detectedAt: string;
}

export interface HistoricalDataQualityScore {
  score: number; // 0-100
  rating: HistoricalDataQualityRating;
  breakdown: {
    completeness: number;      // 0-25
    timestampIntegrity: number;// 0-25
    sourceAuthority: number;   // 0-20
    intervalContinuity: number;// 0-15
    feedConsistency: number;   // 0-15
  };
  missingIntervalsCount: number;
  duplicateEventsCount: number;
  revisionsDetectedCount: number;
  evaluatedAt: string;
}

export interface HistoricalAlertProof {
  alertId: string;
  timestamp: string;
  symbol: string;
  title: string;
  body: string;
  isSimulated: true;
  isHistoricalReplay: true;
  safetyWatermark: 'SIMULATED | HISTORICAL_REPLAY | NOT_FOR_LIVE_EXECUTION';
  dispatchedToLiveTelegram: false;
}

export interface HistoricalCausalAnalysis {
  query: string;
  replayTimestamp: string;
  symbol: string;
  primaryCause: string;
  contributingFactors: string[];
  correlations: string[];
  confirmationState: 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'UNCONFIRMED';
  contradictionFactors: string[];
  evidenceList: Array<{
    type: 'PRICE' | 'NEWS' | 'OI' | 'VOLUME' | 'MACRO' | 'SURVEILLANCE';
    description: string;
    timestamp: string;
    provenance: string;
  }>;
  confidenceScore: number; // 0-100
  whatAthenaKnewAtTime: {
    activePrice: number;
    activeRegime: string;
    latestNewsHeadlines: string[];
    oiState: string;
    macroSummary: string;
  };
  whatHappenedAfterSeparated: {
    priceAfter15m?: number;
    priceAfter1h?: number;
    outcomeVerdict?: string;
  };
}
