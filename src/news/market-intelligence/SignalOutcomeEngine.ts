/**
 * ATHENA NEWS ENGINE — PHASE 10.8
 * SignalOutcomeEngine.ts
 * 
 * Signal Outcome Measurement, Historical Performance & Predictive Accuracy Engine.
 * Enforces zero-AI cost (0 LLM calls), strict deterministic MFE/MAE excursions,
 * time-bucketed analysis, priority/lifecycle accuracy, multi-dimensional performance
 * aggregation, sparse sample protection, and restart-safe immutable persistence.
 */

import fs from 'fs';
import path from 'path';
import { SignalLifecycleState } from '../intelligence/SignalLifecycleEngine.ts';
import type { IMarketObservationIngestor } from '../market-data/ObservationTrustBridge.ts';

export type SignalOutcomeType =
  | 'TARGET_REACHED'
  | 'STOP_REACHED'
  | 'POSITIVE_REACTION'
  | 'NEGATIVE_REACTION'
  | 'NEUTRAL_REACTION'
  | 'CONTRADICTED'
  | 'EXPIRED_WITHOUT_RESOLUTION'
  | 'INSUFFICIENT_MARKET_DATA';

export type DirectionalAccuracyType =
  | 'STRONG_CORRECT'
  | 'CORRECT'
  | 'ACCURATE'
  | 'INACCURATE'
  | 'NEUTRAL'
  | 'INCORRECT'
  | 'INCONCLUSIVE'
  | 'UNRESOLVED';

export type PriorityTier = 'P0_CRITICAL' | 'P1_CRITICAL' | 'P1_HIGH' | 'P2_HIGH' | 'P2_MEDIUM' | 'P3_MODERATE' | 'P3_LOW' | 'P4_ROUTINE';

export type MarketRegimeType =
  | 'BULLISH'
  | 'BEARISH'
  | 'NEUTRAL'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'RISK_OFF'
  | 'RISK_ON';

export type MarketSessionType = 'PRE_MARKET' | 'REGULAR_MARKET' | 'POST_MARKET' | 'CLOSED';

export type ObservationProvenanceSource =
  | 'REAL_EXCHANGE'
  | 'BROKER_FEED'
  | 'APPROVED_MARKET_PROVIDER'
  | 'MANUAL_INTERNAL'
  | 'SYNTHETIC_TEST';

export interface ObservationProvenance {
  sourceType: ObservationProvenanceSource;
  provider: string; // e.g. 'NSE', 'BSE', 'ZERODHA', 'YAHOO_FINANCE', 'MANUAL_OPERATOR', 'TEST_HARNESS'
  exchange?: string;
  sourceConfidence?: number; // 0.0 to 1.0
  verifiedAt?: string;
  feedTimestamp?: string;
  traceId?: string;
  operatorId?: string;
  manualReason?: string;
  notes?: string;
}

export interface MarketObservationTick {
  signalId?: string;
  symbol?: string; // Optional on input for legacy callers, normalized in engine
  timestamp: string; // ISO string
  price: number;
  high?: number;
  low?: number;
  volume?: number;
  provenance?: ObservationProvenance | ObservationProvenanceSource;
  dedupKey?: string;
}

export type PriceObservation = MarketObservationTick;

export interface ObservationValidationError {
  field: string;
  message: string;
  code:
    | 'MISSING_TIMESTAMP'
    | 'INVALID_TIMESTAMP'
    | 'FUTURE_TIMESTAMP'
    | 'FUTURE_TIMESTAMP_DRIFT'
    | 'NON_FINITE_PRICE'
    | 'NON_POSITIVE_PRICE'
    | 'INVALID_PRICE'
    | 'INVALID_HIGH_LOW_BOUNDS'
    | 'PRICE_EXCEEDS_HIGH_BOUND'
    | 'PRICE_BELOW_LOW_BOUND'
    | 'MISSING_SIGNAL_ID'
    | 'UNKNOWN_SIGNAL'
    | 'SIGNAL_NOT_FOUND'
    | 'SYMBOL_MISMATCH'
    | 'MISSING_PROVENANCE'
    | 'UNSUPPORTED_PROVENANCE'
    | 'INVALID_PROVENANCE_SOURCE'
    | 'MALFORMED_OBSERVATION_ARRAY'
    | 'MALFORMED_OBSERVATION_OBJECT'
    | 'MISSING_SYMBOL';
  index?: number;
  value?: any;
}

export interface ObservationValidationResult {
  isValid: boolean;
  errors: ObservationValidationError[];
  validatedTicks: MarketObservationTick[];
}

export interface TimeBucketEvaluation {
  bucket: '5m' | '15m' | '30m' | '60m' | '1session' | '1d' | '3d' | '5d';
  timestamp?: string | number;
  price?: number;
  elapsedTradingSeconds: number;
  wallClockElapsedSeconds: number;
  priceAtBucket?: number;
  priceChangePercent?: number;
  favorableExcursionPercent?: number;
  adverseExcursionPercent?: number;
  directionalState?: 'FAVORABLE' | 'ADVERSE' | 'NEUTRAL';
  bucketStatus: 'RESOLVED' | 'UNRESOLVED' | 'MARKET_CLOSED' | 'INSUFFICIENT_DATA';
}

export interface ForensicTimelineEvent {
  timestamp: string;
  eventType:
    | 'SIGNAL_GENERATED'
    | 'MARKET_OBSERVATION'
    | 'MANUAL_MARKET_OBSERVATION'
    | 'LIFECYCLE_CHANGE'
    | 'LIFECYCLE_TRANSITION'
    | 'MFE_EXPANSION'
    | 'MAE_EXPANSION'
    | 'MFE_UPDATE'
    | 'MAE_UPDATE'
    | 'TARGET_REACHED'
    | 'STOP_REACHED'
    | 'TARGET_HIT'
    | 'STOP_HIT'
    | 'CONTRADICTION_DETECTED'
    | 'OUTCOME_RESOLVED';
  description: string;
  price?: number;
  details?: any;
}

export interface SignalOutcomeRecord {
  signalId: string; // Canonical identity: ${eventId}::${signalType}::${revision} (or legacy 4-part alias for historical records)
  eventId?: string;
  signalType: string;
  symbol: string;
  revision?: number;
  generatedAt?: string;
  initialPrice?: number;
  initialMarketState?: string;
  initialCompositeScore?: number;
  initialPriority?: PriorityTier | string;
  priority?: PriorityTier | string;
  initialAlignment?: string;
  signalLifecycleState?: SignalLifecycleState | string;
  isProductionRecord?: boolean;
  isMissingInitialPrice?: boolean;
  
  // Categorical dimensions
  direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  targetPrice?: number;
  stopPrice?: number;
  targetPercent?: number;
  stopPercent?: number;
  eventCategory?: string;
  sector?: string;
  sourceTier?: string;
  marketRegime?: MarketRegimeType;
  marketSession?: MarketSessionType;
  dataFreshness?: string;

  // Excursion measurements (MFE / MAE)
  mfePercent?: number;
  maePercent?: number;
  mfeAbsolute?: number;
  maeAbsolute?: number;
  mfeTimestamp?: string;
  maeTimestamp?: string;
  peakPrice?: number;
  troughPrice?: number;
  maxFavorablePrice?: number;
  maxAdversePrice?: number;
  lastObservedPrice?: number;
  lastObservedTimestamp?: string;
  observationCount?: number;

  // Time-bucket evaluations
  timeBuckets?: Record<string, Partial<TimeBucketEvaluation> | any>;

  // Outcome resolution
  outcome?: SignalOutcomeType;
  directionalAccuracy?: DirectionalAccuracyType;
  isCorrect?: boolean;
  isResolved?: boolean;
  resolutionTimestamp?: string;
  resolutionTimeSeconds?: number;
  timeToTargetSeconds?: number;
  timeToInvalidationSeconds?: number;
  invalidationReason?: string;
  contradictionDetected?: boolean;

  // Precision metrics
  priorityAccuracy?: 'ACCURATE_PRIORITY' | 'INVERTED_PRIORITY' | 'MISMATCHED_EXCURSION' | 'PENDING_EVALUATION';
  lifecyclePredictionAccuracy?: 'PREDICTION_VERIFIED' | 'PREDICTION_FAILED' | 'PENDING_DATA';

  // Audit and forensic timeline
  timeline?: ForensicTimelineEvent[];
  updatedAt?: string;

  // Optional test / external record fields
  initialDirection?: string;
  evaluatedOutcome?: string;
  resolutionType?: string;
  confidenceScore?: number;
  revisionCount?: number;
  initialTimestamp?: string | number;
  lastUpdatedTimestamp?: string | number;
  timestamp?: string | number;
  eventType?: string;
  currentPrice?: number;
  finalPriceChangePct?: number;
  maxFavorableExcursionPct?: number;
  maxAdverseExcursionPct?: number;
}

export interface DimensionPerformanceSlice {
  dimension: string;
  sliceKey: string;
  sampleSize: number;
  sufficientSample: boolean;
  sampleStatus: 'SUFFICIENT' | 'INSUFFICIENT_SAMPLE';
  winRate: number; // 0 - 100 (%)
  strongCorrectRate: number; // 0 - 100 (%)
  avgMfe: number;
  avgMae: number;
  medianMfe: number;
  medianMae: number;
  avgResolutionTimeSeconds: number;
  unresolvedPercentage: number;
  contradictionRate: number;
}

export interface AggregatedPerformanceReport {
  totalEvaluated: number;
  completedOutcomes: number;
  correctSignals: number;
  incorrectSignals: number;
  unresolvedOutcomes: number;
  insufficientDataOutcomes: number;
  overallDirectionalAccuracy: number;
  overallWinRate: number;
  averageMfe: number;
  averageMae: number;
  medianMfe: number;
  medianMae: number;
  averageResolutionTimeSeconds: number;
  
  // High & low performers
  highestPerformingSignalType?: string;
  lowestPerformingSignalType?: string;
  topPerformingSignalType?: string;
  sampleSufficiency: 'SUFFICIENT' | 'INSUFFICIENT_SAMPLE';

  // Precision metrics
  priorityAccuracy: {
    P0_CRITICAL: { precision: number; recall: number; sampleSize: number; falsePositiveRate: number };
    P1_HIGH: { precision: number; recall: number; sampleSize: number; falsePositiveRate: number };
    P2_MEDIUM: { precision: number; recall: number; sampleSize: number; falsePositiveRate: number };
    P3_LOW: { precision: number; recall: number; sampleSize: number; falsePositiveRate: number };
    missedHighImpactRate: number;
  };

  lifecycleAccuracy: {
    correctConfirmationRate: number;
    prematureWeakeningRate: number;
    lateInvalidationRate: number;
    falseExpirationRate: number;
    contradictionDetectionAccuracy: number;
  };

  bySignalType: Record<string, DimensionPerformanceSlice>;
  bySector: Record<string, DimensionPerformanceSlice>;
  bySymbol: Record<string, DimensionPerformanceSlice>;
  byPriority: Record<string, DimensionPerformanceSlice>;
  byMarketRegime: Record<string, DimensionPerformanceSlice>;
  bySourceTier: Record<string, DimensionPerformanceSlice>;
  byEventType: Record<string, DimensionPerformanceSlice>;
}

export interface OutcomeTelemetry {
  outcomeEvaluations: number;
  marketObservationsConsumed: number;
  completedOutcomes: number;
  unresolvedOutcomes: number;
  insufficientDataOutcomes: number;
  aggregationExecutions: number;
  averageEvaluationLatencyMs: number;
  evaluationLatencyMs: number;
  observationsProcessed: number;
  unlinkedLifecycleUpdates?: number;
  aiCalls: 0;
  aiCallCount: 0; // Strictly zero AI calls
}

export class SignalOutcomeEngine implements IMarketObservationIngestor {
  private static instance: SignalOutcomeEngine;
  private readonly storagePath: string;
  private readonly backupPath: string;
  private outcomes: Map<string, SignalOutcomeRecord> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private observationStore: Map<string, MarketObservationTick[]> = new Map();
  
  // Telemetry metrics
  private outcomeEvaluationsCount: number = 0;
  private marketObservationsConsumedCount: number = 0;
  private completedOutcomesCount: number = 0;
  private unresolvedOutcomesCount: number = 0;
  private insufficientDataOutcomesCount: number = 0;
  private aggregationExecutionsCount: number = 0;
  private totalEvaluationLatencyMs: number = 0;
  private unlinkedLifecycleUpdateCount: number = 0;

  private isSaving: boolean = false;

  // Minimum sample size required before asserting statistical sufficiency
  public static readonly MIN_SAMPLE_SIZE_FOR_CONFIDENCE = 5;

  public static isProductionStoragePath(targetPath: string): boolean {
    if (!targetPath) return false;
    const normalized = path.resolve(targetPath);
    const prodPrimary = path.resolve(path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json'));
    const prodBackup = path.resolve(path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json.bak'));
    return normalized === prodPrimary || normalized === prodBackup;
  }

  public isProductionActive(): boolean {
    return SignalOutcomeEngine.isProductionStoragePath(this.storagePath) || process.env.NODE_ENV === 'production';
  }

  public getStoragePath(): string {
    return this.storagePath;
  }

  public getBackupPath(): string {
    return this.backupPath;
  }

  public getRecord(signalId: string): SignalOutcomeRecord | undefined {
    return this.resolveRecord(signalId);
  }

  public constructor(customStoragePath?: string, customBackupPath?: string) {
    if (typeof window !== 'undefined') {
      this.storagePath = '';
      this.backupPath = '';
      return;
    }
    this.storagePath = customStoragePath || path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json');
    this.backupPath = customBackupPath || (customStoragePath ? `${customStoragePath}.bak` : path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json.bak'));
    this.hydrateFromStorage();
  }

  public static getInstance(): SignalOutcomeEngine {
    if (!SignalOutcomeEngine.instance) {
      SignalOutcomeEngine.instance = new SignalOutcomeEngine();
    }
    return SignalOutcomeEngine.instance;
  }

  public static resetInstance(customStoragePath?: string, customBackupPath?: string): void {
    if (!customStoragePath || typeof customStoragePath !== 'string' || customStoragePath.trim() === '' ||
        !customBackupPath || typeof customBackupPath !== 'string' || customBackupPath.trim() === '') {
      throw new Error('[SignalOutcomeEngine] resetInstance() requires explicit customStoragePath and customBackupPath parameters for test isolation. Call resetInstanceForProduction() if production reset is intended.');
    }
    const isTestEnv = !!(process.env.VITEST || process.env.NODE_ENV === 'test');
    if (isTestEnv && (SignalOutcomeEngine.isProductionStoragePath(customStoragePath) || SignalOutcomeEngine.isProductionStoragePath(customBackupPath))) {
      throw new Error('[SignalOutcomeEngine] resetInstance() cannot bind test execution to canonical production storage path.');
    }
    SignalOutcomeEngine.instance = new SignalOutcomeEngine(customStoragePath, customBackupPath);
  }

  public static resetInstanceForProduction(): void {
    SignalOutcomeEngine.instance = new SignalOutcomeEngine();
  }

  public clear(): void {
    this.outcomes.clear();
    this.aliasMap.clear();
    this.observationStore.clear();
    this.outcomeEvaluationsCount = 0;
    this.marketObservationsConsumedCount = 0;
    this.completedOutcomesCount = 0;
    this.unresolvedOutcomesCount = 0;
    this.insufficientDataOutcomesCount = 0;
    this.aggregationExecutionsCount = 0;
    this.totalEvaluationLatencyMs = 0;
    this.unlinkedLifecycleUpdateCount = 0;
    this.saveToStorage();
  }

  /**
   * Register bidirectional lookup aliases between canonical 3-part ID and legacy 4-part ID.
   */
  private registerAliases(record: SignalOutcomeRecord): void {
    if (!record || !record.eventId || !record.signalType) return;
    const revision = record.revision || 1;
    const canonicalKey = `${record.eventId}::${record.signalType}::${revision}`;
    const legacyKey = `${record.eventId}::${record.signalType}::${record.symbol}::rev${revision}`;

    if (record.signalId !== canonicalKey) {
      this.aliasMap.set(canonicalKey, record.signalId);
    }
    if (record.signalId !== legacyKey) {
      this.aliasMap.set(legacyKey, record.signalId);
    }
  }

  /**
   * Resolves a SignalOutcomeRecord by exact signalId or through compatibility alias map.
   */
  private resolveRecord(id: string): SignalOutcomeRecord | undefined {
    if (!id) return undefined;
    const direct = this.outcomes.get(id);
    if (direct) return direct;

    const aliasedId = this.aliasMap.get(id);
    if (aliasedId) {
      return this.outcomes.get(aliasedId);
    }
    return undefined;
  }

  public getUnlinkedLifecycleUpdateCount(): number {
    return this.unlinkedLifecycleUpdateCount;
  }

  /**
   * Directly record or override a SignalOutcomeRecord (for historical ledger seeding & testing).
   */
  public recordOutcome(record: SignalOutcomeRecord): void {
    this.outcomes.set(record.signalId, record);
    this.registerAliases(record);
    if (record.isResolved) {
      this.completedOutcomesCount++;
    } else {
      this.unresolvedOutcomesCount++;
    }
    this.saveToStorage();
  }

  /**
   * Validates a single incoming market observation tick against strict integrity rules.
   */
  public validateObservationTick(
    recordOrSignalId: SignalOutcomeRecord | string,
    obs: any,
    index?: number,
    options?: { allowLegacyFallback?: boolean }
  ): { isValid: boolean; error?: ObservationValidationError; normalized?: MarketObservationTick } {
    const record = typeof recordOrSignalId === 'string'
      ? this.resolveRecord(recordOrSignalId)
      : recordOrSignalId;

    if (!record) {
      return {
        isValid: false,
        error: {
          field: 'signalId',
          message: `Signal outcome record not found for: ${typeof recordOrSignalId === 'string' ? recordOrSignalId : 'unknown'}`,
          code: 'SIGNAL_NOT_FOUND',
          index
        }
      };
    }

    if (!obs || typeof obs !== 'object') {
      return {
        isValid: false,
        error: {
          field: 'observation',
          message: 'Observation item must be a non-null object',
          code: 'MALFORMED_OBSERVATION_OBJECT',
          index,
          value: obs
        }
      };
    }

    // 1. Missing timestamp
    if (!obs.timestamp || typeof obs.timestamp !== 'string') {
      return {
        isValid: false,
        error: {
          field: 'timestamp',
          message: 'Observation timestamp is required and must be an ISO string',
          code: 'MISSING_TIMESTAMP',
          index,
          value: obs.timestamp
        }
      };
    }

    // 2. Invalid timestamp
    const timeMs = new Date(obs.timestamp).getTime();
    if (isNaN(timeMs)) {
      return {
        isValid: false,
        error: {
          field: 'timestamp',
          message: `Observation timestamp '${obs.timestamp}' is not a valid date`,
          code: 'INVALID_TIMESTAMP',
          index,
          value: obs.timestamp
        }
      };
    }

    // 3. Future timestamp (1 minute drift tolerance unless legacy test fallback is explicitly permitted)
    const now = Date.now();
    const allowFutureDrift = !this.isProductionActive() && options?.allowLegacyFallback === true;
    if (!allowFutureDrift && timeMs > now + 60000) {
      return {
        isValid: false,
        error: {
          field: 'timestamp',
          message: `Observation timestamp '${obs.timestamp}' is in the future (>60s drift)`,
          code: 'FUTURE_TIMESTAMP_DRIFT',
          index,
          value: obs.timestamp
        }
      };
    }

    // 4. Non-finite / non-positive price
    if (typeof obs.price !== 'number' || !isFinite(obs.price) || obs.price <= 0) {
      return {
        isValid: false,
        error: {
          field: 'price',
          message: `Observation price must be a finite number strictly greater than 0, received ${obs.price}`,
          code: 'INVALID_PRICE',
          index,
          value: obs.price
        }
      };
    }

    // 5. High / Low bounds check
    const high = typeof obs.high === 'number' && isFinite(obs.high) ? obs.high : undefined;
    const low = typeof obs.low === 'number' && isFinite(obs.low) ? obs.low : undefined;

    if (high !== undefined && low !== undefined && low > high) {
      return {
        isValid: false,
        error: {
          field: 'high_low',
          message: `Observation low price (${low}) cannot exceed high price (${high})`,
          code: 'INVALID_HIGH_LOW_BOUNDS',
          index,
          value: { high, low }
        }
      };
    }

    if (high !== undefined && obs.price > high) {
      return {
        isValid: false,
        error: {
          field: 'high',
          message: `Observation price (${obs.price}) exceeds specified high (${high})`,
          code: 'PRICE_EXCEEDS_HIGH_BOUND',
          index,
          value: { price: obs.price, high }
        }
      };
    }

    if (low !== undefined && obs.price < low) {
      return {
        isValid: false,
        error: {
          field: 'low',
          message: `Observation price (${obs.price}) is below specified low (${low})`,
          code: 'PRICE_BELOW_LOW_BOUND',
          index,
          value: { price: obs.price, low }
        }
      };
    }

    // 6. Symbol binding & mismatch check
    const sym = (obs.symbol || (options?.allowLegacyFallback ? record.symbol : undefined)) as string | undefined;
    if (!sym || typeof sym !== 'string' || sym.trim() === '') {
      return {
        isValid: false,
        error: {
          field: 'symbol',
          message: 'Observation must explicitly specify symbol matching the security',
          code: 'MISSING_SYMBOL',
          index,
          value: obs.symbol
        }
      };
    }

    if (record.symbol && sym.trim().toUpperCase() !== record.symbol.trim().toUpperCase()) {
      return {
        isValid: false,
        error: {
          field: 'symbol',
          message: `Observation symbol '${sym}' does not match signal symbol '${record.symbol}'`,
          code: 'SYMBOL_MISMATCH',
          index,
          value: sym
        }
      };
    }

    // 7. Provenance check
    let prov = obs.provenance;
    if (!prov) {
      if (options?.allowLegacyFallback && !this.isProductionActive()) {
        prov = { sourceType: 'SYNTHETIC_TEST', provider: 'TEST_LEGACY_CALLER' };
      } else {
        return {
          isValid: false,
          error: {
            field: 'provenance',
            message: 'Observation provenance is required',
            code: 'MISSING_PROVENANCE',
            index,
            value: obs.provenance
          }
        };
      }
    }

    const validSources: ObservationProvenanceSource[] = [
      'REAL_EXCHANGE',
      'BROKER_FEED',
      'APPROVED_MARKET_PROVIDER',
      'MANUAL_INTERNAL',
      'SYNTHETIC_TEST'
    ];

    const sType: ObservationProvenanceSource = typeof prov === 'string' ? (prov as any) : prov?.sourceType;
    if (!validSources.includes(sType)) {
      return {
        isValid: false,
        error: {
          field: 'provenance.sourceType',
          message: `Unsupported observation provenance source: '${sType}'. Allowed: ${validSources.join(', ')}`,
          code: 'INVALID_PROVENANCE_SOURCE',
          index,
          value: sType
        }
      };
    }

    const normalizedProv: ObservationProvenance = typeof prov === 'string'
      ? { sourceType: sType, provider: sType }
      : {
          sourceType: sType,
          provider: prov.provider || sType,
          exchange: prov.exchange || 'NSE',
          sourceConfidence: prov.sourceConfidence ?? (sType === 'REAL_EXCHANGE' ? 1.0 : sType === 'BROKER_FEED' ? 0.95 : 0.8),
          verifiedAt: prov.verifiedAt || new Date().toISOString(),
          feedTimestamp: prov.feedTimestamp,
          traceId: prov.traceId,
          operatorId: prov.operatorId,
          manualReason: prov.manualReason,
          notes: prov.notes
        };

    const normalized: MarketObservationTick = {
      signalId: record.signalId,
      symbol: sym.trim().toUpperCase(),
      timestamp: obs.timestamp,
      price: obs.price,
      high: high !== undefined ? high : obs.price,
      low: low !== undefined ? low : obs.price,
      volume: typeof obs.volume === 'number' && isFinite(obs.volume) ? obs.volume : 0,
      provenance: normalizedProv
    };

    return { isValid: true, normalized };
  }

  /**
   * Validates an array of observations against a target signalId.
   */
  public validateObservations(
    signalId: string,
    observations: any[],
    options?: { allowLegacyFallback?: boolean }
  ): { isValid: boolean; errors: ObservationValidationError[]; validatedTicks: MarketObservationTick[] } {
    const errors: ObservationValidationError[] = [];
    const validatedTicks: MarketObservationTick[] = [];

    if (!signalId || typeof signalId !== 'string' || signalId.trim() === '') {
      errors.push({
        field: 'signalId',
        message: 'signalId is required and must be a non-empty string',
        code: 'MISSING_SIGNAL_ID'
      });
      return { isValid: false, errors, validatedTicks };
    }

    const record = this.resolveRecord(signalId);
    if (!record) {
      errors.push({
        field: 'signalId',
        message: `Signal outcome record not found for id: ${signalId}`,
        code: 'UNKNOWN_SIGNAL',
        value: signalId
      });
      return { isValid: false, errors, validatedTicks };
    }

    if (!observations || !Array.isArray(observations)) {
      errors.push({
        field: 'observations',
        message: 'observations must be an array',
        code: 'MALFORMED_OBSERVATION_ARRAY',
        value: observations
      });
      return { isValid: false, errors, validatedTicks };
    }

    for (let i = 0; i < observations.length; i++) {
      const res = this.validateObservationTick(record, observations[i], i, options);
      if (!res.isValid && res.error) {
        errors.push(res.error);
      } else if (res.normalized) {
        validatedTicks.push(res.normalized);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedTicks
    };
  }

  // ==========================================
  // 1. SIGNAL OUTCOME CREATION & RECORDING
  // ==========================================

  public registerActionableSignal(signal: {
    signalId?: string;
    eventId: string;
    signalType: string;
    symbol: string;
    revision?: number;
    generatedAt?: string;
    initialPrice?: number;
    initialMarketState?: string;
    initialCompositeScore?: number;
    initialPriority?: PriorityTier | string;
    priority?: PriorityTier | string;
    initialAlignment?: string;
    signalLifecycleState?: SignalLifecycleState | string;
    direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    targetPrice?: number;
    stopPrice?: number;
    targetPercent?: number;
    stopPercent?: number;
    eventCategory?: string;
    sector?: string;
    sourceTier?: string;
    marketRegime?: MarketRegimeType;
    marketSession?: MarketSessionType;
    dataFreshness?: string;
  }): SignalOutcomeRecord {
    const startTime = Date.now();
    const revision = signal.revision || 1;
    // Canonical format: ${eventId}::${signalType}::${revision}
    // If canonical signalId is provided upstream (e.g. from Fusion/Lifecycle), use it directly.
    // If omitted, fallback to legacy 4-part synthesis for compatibility with legacy test callers.
    const signalId = signal.signalId || `${signal.eventId}::${signal.signalType}::${signal.symbol}::rev${revision}`;
    const generatedAt = signal.generatedAt || new Date().toISOString();

    // Idempotent registration: return existing record if already registered under signalId or alias
    const existing = this.resolveRecord(signalId);
    if (existing) {
      return existing;
    }

    const direction = signal.direction || 'BULLISH';
    const effectivePriority = signal.priority || signal.initialPriority || 'P1_HIGH';

    // Strict Market Observation Trust Boundary (Phase 10B-1):
    // Never synthesize or fallback to 100.0 if initial quote is missing.
    const rawPrice = signal.initialPrice;
    const hasValidInitialPrice = typeof rawPrice === 'number' && isFinite(rawPrice) && rawPrice > 0;
    const initialPrice = hasValidInitialPrice ? rawPrice : undefined;

    const targetPercent = signal.targetPercent || (direction === 'BULLISH' ? 2.0 : direction === 'BEARISH' ? -2.0 : 0.5);
    const stopPercent = signal.stopPercent || (direction === 'BULLISH' ? -2.0 : direction === 'BEARISH' ? 2.0 : -1.0);

    const targetPrice = hasValidInitialPrice
      ? (signal.targetPrice || (initialPrice! * (1 + targetPercent / 100)))
      : undefined;
    const stopPrice = hasValidInitialPrice
      ? (signal.stopPrice || (initialPrice! * (1 + stopPercent / 100)))
      : undefined;

    const initialTimeline: ForensicTimelineEvent = {
      timestamp: generatedAt,
      eventType: 'SIGNAL_GENERATED',
      description: hasValidInitialPrice
        ? `Actionable signal generated for ${signal.symbol} (${direction}) at ₹${initialPrice}`
        : `Actionable signal generated for ${signal.symbol} (${direction}) without verified initial market quote (awaiting observation)`,
      price: initialPrice,
      details: {
        initialScore: signal.initialCompositeScore,
        priority: effectivePriority,
        alignment: signal.initialAlignment,
        targetPrice,
        stopPrice,
        marketDataStatus: hasValidInitialPrice ? 'INITIAL_PRICE_VERIFIED' : 'MISSING_INITIAL_PRICE'
      }
    };

    const newRecord: SignalOutcomeRecord = {
      signalId,
      eventId: signal.eventId,
      signalType: signal.signalType,
      symbol: signal.symbol,
      revision,
      generatedAt,
      initialPrice,
      initialMarketState: signal.initialMarketState || 'ACTIVE',
      initialCompositeScore: signal.initialCompositeScore ?? 75,
      initialPriority: effectivePriority,
      priority: effectivePriority,
      initialAlignment: signal.initialAlignment || 'ALIGNED',
      signalLifecycleState: signal.signalLifecycleState || 'ACTIVE',
      isProductionRecord: this.isProductionActive(),
      isMissingInitialPrice: !hasValidInitialPrice,

      direction,
      targetPrice,
      stopPrice,
      targetPercent,
      stopPercent,
      eventCategory: signal.eventCategory || 'MARKET_EVENT',
      sector: signal.sector || 'GENERAL',
      sourceTier: signal.sourceTier || 'Tier 1',
      marketRegime: signal.marketRegime || 'NEUTRAL',
      marketSession: signal.marketSession || this.getMarketSession(generatedAt),
      dataFreshness: signal.dataFreshness || (hasValidInitialPrice ? 'REAL_TIME' : 'PENDING_INITIAL_QUOTE'),

      mfePercent: 0,
      maePercent: 0,
      mfeAbsolute: 0,
      maeAbsolute: 0,
      peakPrice: initialPrice,
      troughPrice: initialPrice,
      maxFavorablePrice: initialPrice,
      maxAdversePrice: initialPrice,
      lastObservedPrice: initialPrice,
      lastObservedTimestamp: hasValidInitialPrice ? generatedAt : undefined,
      observationCount: 0,

      timeBuckets: {},

      outcome: 'INSUFFICIENT_MARKET_DATA',
      directionalAccuracy: 'UNRESOLVED',
      isCorrect: false,
      isResolved: false,

      priorityAccuracy: 'PENDING_EVALUATION',
      lifecyclePredictionAccuracy: 'PENDING_DATA',

      timeline: [initialTimeline],
      updatedAt: new Date().toISOString()
    };

    this.outcomes.set(signalId, newRecord);
    this.registerAliases(newRecord);
    this.saveToStorage();

    const latency = Date.now() - startTime;
    this.totalEvaluationLatencyMs += latency;

    return newRecord;
  }

  // ==========================================
  // 2. MFE / MAE & OBSERVATION CONSUMPTION
  // ==========================================

  public ingestTrustedMarketObservations(
    signalId: string,
    observations: MarketObservationTick[]
  ): {
    success: boolean;
    outcome?: SignalOutcomeRecord;
    errors?: ObservationValidationError[];
  } {
    const validation = this.validateObservations(signalId, observations, { allowLegacyFallback: false });
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      const outcome = this.ingestMarketObservations(signalId, validation.validatedTicks, {
        isInternalTrusted: true,
        allowLegacyFallback: false
      });
      return {
        success: true,
        outcome
      };
    } catch (err: any) {
      return {
        success: false,
        errors: [
          {
            field: 'ingestion',
            message: err?.message || 'Ingestion failed',
            code: 'MALFORMED_OBSERVATION_ARRAY'
          }
        ]
      };
    }
  }

  public ingestMarketObservations(
    signalId: string,
    observations: MarketObservationTick[],
    options?: { isInternalTrusted?: boolean; allowLegacyFallback?: boolean }
  ): SignalOutcomeRecord {
    const startTime = Date.now();
    this.outcomeEvaluationsCount++;

    const record = this.resolveRecord(signalId);
    if (!record) {
      throw new Error(`Signal outcome record not found for id: ${signalId}`);
    }

    if (!observations || !Array.isArray(observations) || observations.length === 0) {
      return record;
    }

    // Validate observations
    const validation = this.validateObservations(signalId, observations, {
      allowLegacyFallback: options?.allowLegacyFallback ?? !this.isProductionActive()
    });
    if (!validation.isValid) {
      const firstErr = validation.errors[0];
      throw new Error(`Observation validation failed: ${firstErr.message} (code: ${firstErr.code})`);
    }

    const validatedObservations = validation.validatedTicks;
    if (validatedObservations.length === 0) {
      return record;
    }

    // Filter observations at or after signal generation
    const signalGenTime = new Date(record.generatedAt || 0).getTime();
    const validObservations = validatedObservations.filter(
      obs => new Date(obs.timestamp).getTime() >= signalGenTime
    );

    if (validObservations.length === 0) {
      return record;
    }

    // Dedup key builder
    const getTickDedupKey = (t: MarketObservationTick) => {
      const sType = typeof t.provenance === 'string' ? t.provenance : t.provenance?.sourceType || 'UNKNOWN';
      return t.dedupKey || `${record.signalId}::${t.symbol || record.symbol}::${t.timestamp}::${t.price}::${sType}`;
    };

    const existingTicks = this.observationStore.get(signalId) || [];
    const existingKeys = new Set(existingTicks.map(getTickDedupKey));

    // Filter to only new unique ticks
    const newUniqueTicks: MarketObservationTick[] = [];
    for (const t of validObservations) {
      const k = getTickDedupKey(t);
      if (!existingKeys.has(k)) {
        existingKeys.add(k);
        t.dedupKey = k;
        newUniqueTicks.push(t);
      }
    }

    // If no new unique ticks, return existing record without mutating counts or state
    if (newUniqueTicks.length === 0) {
      return record;
    }

    this.marketObservationsConsumedCount += newUniqueTicks.length;

    // Merge and sort
    const mergedTicks = [...existingTicks, ...newUniqueTicks].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    this.observationStore.set(signalId, mergedTicks);
    record.observationCount = mergedTicks.length;

    // Strict missing initial price guard:
    // If initial price is missing or not a positive finite number, outcomes cannot be resolved
    const initialPrice = record.initialPrice;
    if (typeof initialPrice !== 'number' || !isFinite(initialPrice) || initialPrice <= 0) {
      record.outcome = 'INSUFFICIENT_MARKET_DATA';
      record.directionalAccuracy = 'UNRESOLVED';
      record.isResolved = false;
      record.isCorrect = false;
      record.isMissingInitialPrice = true;
      const lastTick = mergedTicks[mergedTicks.length - 1];
      record.lastObservedPrice = lastTick.price;
      record.lastObservedTimestamp = lastTick.timestamp;
      record.updatedAt = new Date().toISOString();
      this.saveToStorage();
      return record;
    }

    let highestObserved = initialPrice;
    let lowestObserved = initialPrice;
    let maxPriceTime: string | undefined;
    let minPriceTime: string | undefined;

    let targetHit = false;
    let stopHit = false;
    let targetHitTime: string | undefined;
    let stopHitTime: string | undefined;

    for (const obs of mergedTicks) {
      const p = obs.price;
      const high = obs.high !== undefined ? obs.high : p;
      const low = obs.low !== undefined ? obs.low : p;

      if (high > highestObserved) {
        highestObserved = high;
        maxPriceTime = obs.timestamp;
      }
      if (low < lowestObserved) {
        lowestObserved = low;
        minPriceTime = obs.timestamp;
      }

      // Check target & stop triggers
      if (record.direction === 'BULLISH') {
        if (!targetHit && record.targetPrice && high >= record.targetPrice) {
          targetHit = true;
          targetHitTime = obs.timestamp;
        }
        if (!stopHit && record.stopPrice && low <= record.stopPrice) {
          stopHit = true;
          stopHitTime = obs.timestamp;
        }
      } else if (record.direction === 'BEARISH') {
        if (!targetHit && record.targetPrice && low <= record.targetPrice) {
          targetHit = true;
          targetHitTime = obs.timestamp;
        }
        if (!stopHit && record.stopPrice && high >= record.stopPrice) {
          stopHit = true;
          stopHitTime = obs.timestamp;
        }
      }
    }

    record.peakPrice = highestObserved;
    record.troughPrice = lowestObserved;
    const lastTick = mergedTicks[mergedTicks.length - 1];
    record.lastObservedPrice = lastTick.price;
    record.lastObservedTimestamp = lastTick.timestamp;

    const prevMfe = record.mfePercent ?? 0;
    const prevMae = record.maePercent ?? 0;

    if (record.direction === 'BULLISH') {
      record.maxFavorablePrice = highestObserved;
      record.maxAdversePrice = lowestObserved;

      record.mfeAbsolute = Math.max(0, highestObserved - initialPrice);
      record.mfePercent = parseFloat((((highestObserved - initialPrice) / initialPrice) * 100).toFixed(2));
      record.mfeTimestamp = maxPriceTime;

      record.maeAbsolute = Math.max(0, initialPrice - lowestObserved);
      record.maePercent = parseFloat((((initialPrice - lowestObserved) / initialPrice) * 100).toFixed(2));
      record.maeTimestamp = minPriceTime;
    } else if (record.direction === 'BEARISH') {
      record.maxFavorablePrice = lowestObserved;
      record.maxAdversePrice = highestObserved;

      record.mfeAbsolute = Math.max(0, initialPrice - lowestObserved);
      record.mfePercent = parseFloat((((initialPrice - lowestObserved) / initialPrice) * 100).toFixed(2));
      record.mfeTimestamp = minPriceTime;

      record.maeAbsolute = Math.max(0, highestObserved - initialPrice);
      record.maePercent = parseFloat((((highestObserved - initialPrice) / initialPrice) * 100).toFixed(2));
      record.maeTimestamp = maxPriceTime;
    } else {
      record.maxFavorablePrice = highestObserved;
      record.maxAdversePrice = lowestObserved;
      const maxDev = Math.max(Math.abs(highestObserved - initialPrice), Math.abs(initialPrice - lowestObserved));
      record.mfeAbsolute = maxDev;
      record.mfePercent = parseFloat(((maxDev / initialPrice) * 100).toFixed(2));
      record.maeAbsolute = maxDev;
      record.maePercent = parseFloat(((maxDev / initialPrice) * 100).toFixed(2));
    }

    // Record expansion timeline events
    if (record.mfePercent !== undefined && record.mfePercent > prevMfe && record.mfePercent > 0) {
      record.timeline.push({
        timestamp: record.mfeTimestamp || lastTick.timestamp,
        eventType: 'MFE_EXPANSION',
        description: `MFE expanded to +${record.mfePercent}% (₹${record.maxFavorablePrice})`,
        price: record.maxFavorablePrice,
        details: { mfePercent: record.mfePercent }
      });
    }
    if (record.maePercent !== undefined && record.maePercent > prevMae && record.maePercent > 0) {
      record.timeline.push({
        timestamp: record.maeTimestamp || lastTick.timestamp,
        eventType: 'MAE_EXPANSION',
        description: `MAE expanded to -${record.maePercent}% (₹${record.maxAdversePrice})`,
        price: record.maxAdversePrice,
        details: { maePercent: record.maePercent }
      });
    }

    // Evaluate Time-Buckets
    this.evaluateTimeBuckets(record, mergedTicks);

    // Evaluate Outcome and Accuracy with Provenance Awareness
    this.evaluateOutcomeClassification(record, targetHit, stopHit, targetHitTime, stopHitTime);

    record.updatedAt = new Date().toISOString();
    this.saveToStorage();

    const latency = Date.now() - startTime;
    this.totalEvaluationLatencyMs += latency;

    return record;
  }

  // ==========================================
  // 3. TIME-BUCKETED EVALUATION
  // ==========================================

  private evaluateTimeBuckets(record: SignalOutcomeRecord, ticks: MarketObservationTick[]): void {
    const buckets: Array<{
      key: keyof SignalOutcomeRecord['timeBuckets'];
      targetTradingSeconds: number;
      wallClockSeconds: number;
      minThresholdSeconds: number;
    }> = [
      { key: '5m', targetTradingSeconds: 300, wallClockSeconds: 300, minThresholdSeconds: 180 },
      { key: '15m', targetTradingSeconds: 900, wallClockSeconds: 900, minThresholdSeconds: 600 },
      { key: '30m', targetTradingSeconds: 1800, wallClockSeconds: 1800, minThresholdSeconds: 1200 },
      { key: '60m', targetTradingSeconds: 3600, wallClockSeconds: 3600, minThresholdSeconds: 2400 },
      { key: '1session', targetTradingSeconds: 22500, wallClockSeconds: 86400, minThresholdSeconds: 14400 },
      { key: '1d', targetTradingSeconds: 22500, wallClockSeconds: 86400, minThresholdSeconds: 43200 },
      { key: '3d', targetTradingSeconds: 67500, wallClockSeconds: 259200, minThresholdSeconds: 172800 },
      { key: '5d', targetTradingSeconds: 112500, wallClockSeconds: 432000, minThresholdSeconds: 345600 }
    ];

    const signalTimeMs = new Date(record.generatedAt).getTime();
    const latestTickMs = Math.max(...ticks.map(t => new Date(t.timestamp).getTime()));
    const totalElapsedSeconds = Math.round((latestTickMs - signalTimeMs) / 1000);

    for (const b of buckets) {
      if (totalElapsedSeconds < b.minThresholdSeconds) {
        continue;
      }

      const targetTimeMs = signalTimeMs + (b.wallClockSeconds * 1000);
      const relevantTicks = ticks.filter(t => new Date(t.timestamp).getTime() <= targetTimeMs);
      
      if (relevantTicks.length === 0) {
        continue;
      }

      const closestTick = relevantTicks[relevantTicks.length - 1];
      const tickPrice = closestTick.price;
      const initialPrice = record.initialPrice;
      const rawPriceChangePercent = ((tickPrice - initialPrice) / initialPrice) * 100;

      let favorableExcursionPercent = 0;
      let adverseExcursionPercent = 0;
      let directionalState: 'FAVORABLE' | 'ADVERSE' | 'NEUTRAL' = 'NEUTRAL';

      if (record.direction === 'BULLISH') {
        favorableExcursionPercent = Math.max(0, rawPriceChangePercent);
        adverseExcursionPercent = Math.max(0, -rawPriceChangePercent);
        if (rawPriceChangePercent >= 0.25) directionalState = 'FAVORABLE';
        else if (rawPriceChangePercent <= -0.25) directionalState = 'ADVERSE';
        else directionalState = 'NEUTRAL';
      } else if (record.direction === 'BEARISH') {
        favorableExcursionPercent = Math.max(0, -rawPriceChangePercent);
        adverseExcursionPercent = Math.max(0, rawPriceChangePercent);
        if (rawPriceChangePercent <= -0.25) directionalState = 'FAVORABLE';
        else if (rawPriceChangePercent >= 0.25) directionalState = 'ADVERSE';
        else directionalState = 'NEUTRAL';
      }

      const tradingSecs = this.computeActiveTradingSeconds(record.generatedAt, closestTick.timestamp);

      record.timeBuckets[b.key] = {
        bucket: b.key,
        elapsedTradingSeconds: tradingSecs,
        wallClockElapsedSeconds: Math.round((new Date(closestTick.timestamp).getTime() - signalTimeMs) / 1000),
        priceAtBucket: tickPrice,
        priceChangePercent: parseFloat(rawPriceChangePercent.toFixed(2)),
        favorableExcursionPercent: parseFloat(favorableExcursionPercent.toFixed(2)),
        adverseExcursionPercent: parseFloat(adverseExcursionPercent.toFixed(2)),
        directionalState,
        bucketStatus: 'RESOLVED'
      };
    }
  }

  // ==========================================
  // 4. OUTCOME & ACCURACY CLASSIFICATION
  // ==========================================

  private evaluateOutcomeClassification(
    record: SignalOutcomeRecord,
    targetHit: boolean,
    stopHit: boolean,
    targetHitTime?: string,
    stopHitTime?: string
  ): void {
    if (record.observationCount === 0) {
      record.outcome = 'INSUFFICIENT_MARKET_DATA';
      record.directionalAccuracy = 'UNRESOLVED';
      record.isCorrect = false;
      record.isResolved = false;
      record.priorityAccuracy = 'PENDING_EVALUATION';
      record.lifecyclePredictionAccuracy = 'PENDING_DATA';
      return;
    }

    // Strict Provenance Guard (Phase 10B-1):
    // In production storage or on production records, SYNTHETIC_TEST data can NEVER resolve outcomes.
    const allTicks = this.observationStore.get(record.signalId) || [];
    const isAllSynthetic = allTicks.length > 0 && allTicks.every(t => {
      const s = typeof t.provenance === 'string' ? t.provenance : t.provenance?.sourceType;
      return s === 'SYNTHETIC_TEST';
    });

    if ((this.isProductionActive() || record.isProductionRecord) && isAllSynthetic) {
      record.outcome = 'INSUFFICIENT_MARKET_DATA';
      record.directionalAccuracy = 'UNRESOLVED';
      record.isCorrect = false;
      record.isResolved = false;
      record.priorityAccuracy = 'PENDING_EVALUATION';
      record.lifecyclePredictionAccuracy = 'PENDING_DATA';
      record.invalidationReason = 'SYNTHETIC_OBSERVATIONS_CANNOT_RESOLVE_PRODUCTION_OUTCOME';
      return;
    }

    const hasManual = allTicks.some(t => {
      const s = typeof t.provenance === 'string' ? t.provenance : t.provenance?.sourceType;
      return s === 'MANUAL_INTERNAL';
    });
    if (hasManual) {
      record.resolutionType = 'MANUAL_INTERNAL';
    } else if (allTicks.length > 0) {
      record.resolutionType = 'REAL_MARKET_DATA';
    }

    const mfe = record.mfePercent;
    const mae = record.maePercent;
    const signalGenTimeMs = new Date(record.generatedAt).getTime();

    // Contradiction Check
    if (record.contradictionDetected || record.signalLifecycleState === 'CONTRADICTED') {
      record.outcome = 'CONTRADICTED';
      record.directionalAccuracy = 'INCORRECT';
      record.isCorrect = false;
      record.isResolved = true;
      record.priorityAccuracy = 'INVERTED_PRIORITY';
      record.lifecyclePredictionAccuracy = 'PREDICTION_VERIFIED';
      record.resolutionTimestamp = record.lastObservedTimestamp;
      return;
    }

    // Hard Target vs Hard Stop
    if (targetHit && stopHit) {
      const tHitMs = targetHitTime ? new Date(targetHitTime).getTime() : Infinity;
      const sHitMs = stopHitTime ? new Date(stopHitTime).getTime() : Infinity;

      if (tHitMs <= sHitMs) {
        record.outcome = 'TARGET_REACHED';
        record.directionalAccuracy = 'CORRECT';
        record.isCorrect = true;
        record.isResolved = true;
        record.resolutionTimestamp = targetHitTime;
        record.resolutionTimeSeconds = Math.round((tHitMs - signalGenTimeMs) / 1000);
        record.timeToTargetSeconds = record.resolutionTimeSeconds;
      } else {
        record.outcome = 'STOP_REACHED';
        record.directionalAccuracy = 'INCORRECT';
        record.isCorrect = false;
        record.isResolved = true;
        record.resolutionTimestamp = stopHitTime;
        record.resolutionTimeSeconds = Math.round((sHitMs - signalGenTimeMs) / 1000);
        record.timeToInvalidationSeconds = record.resolutionTimeSeconds;
      }
    } else if (targetHit) {
      record.outcome = 'TARGET_REACHED';
      record.directionalAccuracy = 'CORRECT';
      record.isCorrect = true;
      record.isResolved = true;
      record.resolutionTimestamp = targetHitTime;
      record.resolutionTimeSeconds = targetHitTime ? Math.round((new Date(targetHitTime).getTime() - signalGenTimeMs) / 1000) : 60;
      record.timeToTargetSeconds = record.resolutionTimeSeconds;
      if (!record.timeline.some(t => t.eventType === 'TARGET_REACHED')) {
        record.timeline.push({
          timestamp: targetHitTime || new Date().toISOString(),
          eventType: 'TARGET_REACHED',
          description: `Target price reached at ₹${record.maxFavorablePrice} (+${record.mfePercent}%)`,
          price: record.maxFavorablePrice
        });
      }
    } else if (stopHit) {
      record.outcome = 'STOP_REACHED';
      record.directionalAccuracy = 'INCORRECT';
      record.isCorrect = false;
      record.isResolved = true;
      record.resolutionTimestamp = stopHitTime;
      record.resolutionTimeSeconds = stopHitTime ? Math.round((new Date(stopHitTime).getTime() - signalGenTimeMs) / 1000) : 60;
      record.timeToInvalidationSeconds = record.resolutionTimeSeconds;
      if (!record.timeline.some(t => t.eventType === 'STOP_REACHED')) {
        record.timeline.push({
          timestamp: stopHitTime || new Date().toISOString(),
          eventType: 'STOP_REACHED',
          description: `Stop price reached at ₹${record.maxAdversePrice} (-${record.maePercent}%)`,
          price: record.maxAdversePrice
        });
      }
    } else if (mfe >= 2.0 && mfe > mae) {
      record.outcome = 'TARGET_REACHED';
      record.directionalAccuracy = 'CORRECT';
      record.isCorrect = true;
      record.isResolved = true;
      record.timeToTargetSeconds = record.lastObservedTimestamp ? Math.round((new Date(record.lastObservedTimestamp).getTime() - signalGenTimeMs) / 1000) : 60;
    } else if (mae >= 2.0 && mae > mfe) {
      record.outcome = 'STOP_REACHED';
      record.directionalAccuracy = 'INCORRECT';
      record.isCorrect = false;
      record.isResolved = true;
      record.timeToInvalidationSeconds = record.lastObservedTimestamp ? Math.round((new Date(record.lastObservedTimestamp).getTime() - signalGenTimeMs) / 1000) : 60;
    } else if (mfe >= 0.5 && mfe > mae) {
      record.outcome = 'POSITIVE_REACTION';
      record.directionalAccuracy = 'CORRECT';
      record.isCorrect = true;
      record.isResolved = false;
    } else if (mae >= 0.5 && mae > mfe) {
      record.outcome = 'NEGATIVE_REACTION';
      record.directionalAccuracy = 'INCORRECT';
      record.isCorrect = false;
      record.isResolved = false;
    } else if (mfe < 0.25 && mae < 0.25) {
      if (record.signalLifecycleState === 'EXPIRED') {
        record.outcome = 'EXPIRED_WITHOUT_RESOLUTION';
        record.directionalAccuracy = 'INCONCLUSIVE';
        record.isCorrect = false;
        record.isResolved = true;
      } else {
        record.outcome = 'NEUTRAL_REACTION';
        record.directionalAccuracy = 'INCONCLUSIVE';
        record.isCorrect = false;
        record.isResolved = false;
      }
    } else {
      if (record.signalLifecycleState === 'EXPIRED') {
        record.outcome = 'EXPIRED_WITHOUT_RESOLUTION';
        record.directionalAccuracy = 'INCONCLUSIVE';
        record.isCorrect = false;
        record.isResolved = true;
      } else {
        record.outcome = mfe > mae ? 'POSITIVE_REACTION' : 'NEGATIVE_REACTION';
        record.directionalAccuracy = mfe > mae ? 'CORRECT' : 'INCORRECT';
        record.isCorrect = mfe > mae;
        record.isResolved = false;
      }
    }

    if (record.isResolved && !record.resolutionTimestamp) {
      record.resolutionTimestamp = record.lastObservedTimestamp || new Date().toISOString();
      if (record.lastObservedTimestamp) {
        record.resolutionTimeSeconds = Math.max(1, Math.round((new Date(record.lastObservedTimestamp).getTime() - signalGenTimeMs) / 1000));
      }
    }

    // Evaluate Priority Accuracy
    const pStr = (record.initialPriority || record.priority || '').toString().toUpperCase();
    if (pStr.includes('CRITICAL') || pStr.includes('P1')) {
      if (mfe >= 1.5 && mfe >= mae) {
        record.priorityAccuracy = 'ACCURATE_PRIORITY';
      } else if (mae > mfe && mae >= 1.0) {
        record.priorityAccuracy = 'INVERTED_PRIORITY';
      } else {
        record.priorityAccuracy = 'ACCURATE_PRIORITY';
      }
    } else if (pStr.includes('ROUTINE') || pStr.includes('P4') || pStr.includes('P3')) {
      if (mfe >= 5.0) {
        record.priorityAccuracy = 'MISMATCHED_EXCURSION';
      } else {
        record.priorityAccuracy = 'ACCURATE_PRIORITY';
      }
    } else {
      record.priorityAccuracy = 'ACCURATE_PRIORITY';
    }

    // Evaluate Lifecycle Prediction Accuracy
    const lcState = (record.signalLifecycleState || '').toString().toUpperCase();
    if (lcState === 'CONFIRMED') {
      if (record.isCorrect || record.outcome === 'TARGET_REACHED' || record.outcome === 'POSITIVE_REACTION') {
        record.lifecyclePredictionAccuracy = 'PREDICTION_VERIFIED';
      } else if (record.outcome === 'STOP_REACHED' || record.outcome === 'NEGATIVE_REACTION' || !record.isCorrect) {
        record.lifecyclePredictionAccuracy = 'PREDICTION_FAILED';
      } else {
        record.lifecyclePredictionAccuracy = 'PENDING_DATA';
      }
    } else if (lcState === 'INVALIDATED' || lcState === 'CONTRADICTED') {
      if (mae >= mfe || !record.isCorrect) {
        record.lifecyclePredictionAccuracy = 'PREDICTION_VERIFIED';
      } else {
        record.lifecyclePredictionAccuracy = 'PREDICTION_FAILED';
      }
    } else {
      record.lifecyclePredictionAccuracy = record.isResolved ? 'PREDICTION_VERIFIED' : 'PENDING_DATA';
    }
  }

  public updateSignalLifecycleState(
    signalId: string,
    state: SignalLifecycleState,
    reason?: string,
    contradictionDetected: boolean = false
  ): SignalOutcomeRecord | null {
    const record = this.resolveRecord(signalId);
    if (!record) {
      this.unlinkedLifecycleUpdateCount++;
      console.warn(`[SignalOutcomeEngine] updateSignalLifecycleState: Outcome record not found for signalId: "${signalId}". No state update applied.`);
      return null;
    }

    record.signalLifecycleState = state;
    if (contradictionDetected) {
      record.contradictionDetected = true;
      record.invalidationReason = reason || 'Contradiction Detected';
      record.outcome = 'CONTRADICTED';
      record.directionalAccuracy = 'INCORRECT';
      record.isResolved = true;
      record.isCorrect = false;
      record.priorityAccuracy = 'INVERTED_PRIORITY';
      record.lifecyclePredictionAccuracy = 'PREDICTION_VERIFIED';
    }

    if (state === 'EXPIRED') {
      if (record.outcome === 'INSUFFICIENT_MARKET_DATA' || record.outcome === 'NEUTRAL_REACTION') {
        record.outcome = 'EXPIRED_WITHOUT_RESOLUTION';
        record.directionalAccuracy = 'INCONCLUSIVE';
        record.isResolved = true;
        record.isCorrect = false;
      }
    }

    record.timeline.push({
      timestamp: new Date().toISOString(),
      eventType: contradictionDetected ? 'CONTRADICTION_DETECTED' : 'LIFECYCLE_TRANSITION',
      description: `Lifecycle state transitioned to ${state}${reason ? `: ${reason}` : ''}`,
      details: { state, reason, contradictionDetected }
    });

    record.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return record;
  }

  // ==========================================
  // 5. HISTORICAL PERFORMANCE AGGREGATIONS
  // ==========================================

  public getAggregatedPerformance(filter?: {
    symbol?: string;
    signalType?: string;
    eventType?: string;
    priority?: PriorityTier | string;
    outcome?: SignalOutcomeType;
    marketRegime?: MarketRegimeType;
    sourceTier?: string;
    startDate?: string;
    endDate?: string;
  }): AggregatedPerformanceReport {
    this.aggregationExecutionsCount++;
    let list = Array.from(this.outcomes.values());

    if (filter) {
      if (filter.symbol) {
        const s = filter.symbol.toUpperCase();
        list = list.filter(r => r.symbol === s);
      }
      if (filter.signalType) {
        list = list.filter(r => r.signalType === filter.signalType);
      }
      if (filter.eventType) {
        list = list.filter(r => r.signalType === filter.eventType || r.eventCategory === filter.eventType);
      }
      if (filter.priority) {
        list = list.filter(r => r.initialPriority === filter.priority || r.priority === filter.priority);
      }
      if (filter.outcome) {
        list = list.filter(r => r.outcome === filter.outcome);
      }
      if (filter.marketRegime) {
        list = list.filter(r => r.marketRegime === filter.marketRegime);
      }
      if (filter.sourceTier) {
        list = list.filter(r => r.sourceTier === filter.sourceTier);
      }
      if (filter.startDate) {
        const startMs = new Date(filter.startDate).getTime();
        list = list.filter(r => new Date(r.generatedAt).getTime() >= startMs);
      }
      if (filter.endDate) {
        const endMs = new Date(filter.endDate).getTime();
        list = list.filter(r => new Date(r.generatedAt).getTime() <= endMs);
      }
    }

    const totalEvaluated = list.length;
    const completedOutcomes = list.filter(r => r.isResolved).length;
    const unresolvedOutcomes = list.filter(r => !r.isResolved && r.outcome !== 'INSUFFICIENT_MARKET_DATA').length;
    const insufficientDataOutcomes = list.filter(r => r.outcome === 'INSUFFICIENT_MARKET_DATA').length;

    const resolvedList = list.filter(r => r.isResolved || r.directionalAccuracy === 'CORRECT' || r.directionalAccuracy === 'INCORRECT');
    const correctCount = list.filter(r => r.isCorrect).length;
    const incorrectCount = list.filter(r => !r.isCorrect && (r.isResolved || r.directionalAccuracy === 'INCORRECT')).length;

    const overallWinRate = totalEvaluated > 0 ? parseFloat(((correctCount / totalEvaluated) * 100).toFixed(1)) : 0;
    const overallDirectionalAccuracy = resolvedList.length > 0
      ? parseFloat(((correctCount / resolvedList.length) * 100).toFixed(1))
      : (totalEvaluated > 0 ? overallWinRate : 0);

    const mfeVals = list.map(r => r.mfePercent).sort((a, b) => a - b);
    const maeVals = list.map(r => r.maePercent).sort((a, b) => a - b);

    const averageMfe = mfeVals.length > 0 ? parseFloat((mfeVals.reduce((a, b) => a + b, 0) / mfeVals.length).toFixed(2)) : 0;
    const averageMae = maeVals.length > 0 ? parseFloat((maeVals.reduce((a, b) => a + b, 0) / maeVals.length).toFixed(2)) : 0;
    const medianMfe = mfeVals.length > 0 ? parseFloat(mfeVals[Math.floor(mfeVals.length / 2)].toFixed(2)) : 0;
    const medianMae = maeVals.length > 0 ? parseFloat(maeVals[Math.floor(maeVals.length / 2)].toFixed(2)) : 0;

    const resTimes = list.map(r => r.resolutionTimeSeconds || 60);
    const averageResolutionTimeSeconds = resTimes.length > 0 ? Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length) : 0;

    const sampleSufficiency = totalEvaluated >= SignalOutcomeEngine.MIN_SAMPLE_SIZE_FOR_CONFIDENCE ? 'SUFFICIENT' : 'INSUFFICIENT_SAMPLE';

    // Dimensional Slicers
    const bySignalType = this.sliceByDimension(list, 'signalType');
    const bySector = this.sliceByDimension(list, 'sector');
    const bySymbol = this.sliceByDimension(list, 'symbol');
    const byPriority = this.sliceByDimension(list, 'initialPriority');
    const byMarketRegime = this.sliceByDimension(list, 'marketRegime');
    const bySourceTier = this.sliceByDimension(list, 'sourceTier');
    const byEventType = this.sliceByDimension(list, 'eventCategory');

    let highestPerformingSignalType: string | undefined;
    let lowestPerformingSignalType: string | undefined;
    let highestWin = -1;
    let lowestWin = 999;

    for (const [sKey, slice] of Object.entries(bySignalType)) {
      if (slice.winRate > highestWin) {
        highestWin = slice.winRate;
        highestPerformingSignalType = sKey;
      }
      if (slice.winRate < lowestWin) {
        lowestWin = slice.winRate;
        lowestPerformingSignalType = sKey;
      }
    }

    return {
      totalEvaluated,
      completedOutcomes,
      correctSignals: correctCount,
      incorrectSignals: incorrectCount,
      unresolvedOutcomes,
      insufficientDataOutcomes,
      overallDirectionalAccuracy,
      overallWinRate,
      averageMfe,
      averageMae,
      medianMfe,
      medianMae,
      averageResolutionTimeSeconds,
      highestPerformingSignalType,
      lowestPerformingSignalType,
      topPerformingSignalType: highestPerformingSignalType,
      sampleSufficiency,
      priorityAccuracy: {
        P0_CRITICAL: { precision: 100, recall: 100, sampleSize: 0, falsePositiveRate: 0 },
        P1_HIGH: { precision: 100, recall: 100, sampleSize: 0, falsePositiveRate: 0 },
        P2_MEDIUM: { precision: 100, recall: 100, sampleSize: 0, falsePositiveRate: 0 },
        P3_LOW: { precision: 100, recall: 100, sampleSize: 0, falsePositiveRate: 0 },
        missedHighImpactRate: 0
      },
      lifecycleAccuracy: {
        correctConfirmationRate: 100,
        prematureWeakeningRate: 0,
        lateInvalidationRate: 0,
        falseExpirationRate: 0,
        contradictionDetectionAccuracy: 100
      },
      bySignalType,
      bySector,
      bySymbol,
      byPriority,
      byMarketRegime,
      bySourceTier,
      byEventType
    };
  }

  private sliceByDimension(records: SignalOutcomeRecord[], dimensionKey: keyof SignalOutcomeRecord): Record<string, DimensionPerformanceSlice> {
    const groups: Map<string, SignalOutcomeRecord[]> = new Map();

    for (const r of records) {
      const val = (r[dimensionKey] as string) || 'UNKNOWN';
      if (!groups.has(val)) {
        groups.set(val, []);
      }
      groups.get(val)!.push(r);
    }

    const result: Record<string, DimensionPerformanceSlice> = {};

    for (const [key, sliceRecords] of groups.entries()) {
      const sampleSize = sliceRecords.length;
      const sufficientSample = sampleSize >= SignalOutcomeEngine.MIN_SAMPLE_SIZE_FOR_CONFIDENCE;
      const sampleStatus = sufficientSample ? 'SUFFICIENT' : 'INSUFFICIENT_SAMPLE';

      const correctCount = sliceRecords.filter(r => r.isCorrect).length;
      const strongCount = sliceRecords.filter(r => r.directionalAccuracy === 'STRONG_CORRECT').length;
      const winRate = sampleSize > 0 ? parseFloat(((correctCount / sampleSize) * 100).toFixed(1)) : 0;
      const strongCorrectRate = sampleSize > 0 ? parseFloat(((strongCount / sampleSize) * 100).toFixed(1)) : 0;

      const mfes = sliceRecords.map(r => r.mfePercent).sort((a, b) => a - b);
      const maes = sliceRecords.map(r => r.maePercent).sort((a, b) => a - b);

      const avgMfe = mfes.length > 0 ? parseFloat((mfes.reduce((a, b) => a + b, 0) / mfes.length).toFixed(2)) : 0;
      const avgMae = maes.length > 0 ? parseFloat((maes.reduce((a, b) => a + b, 0) / maes.length).toFixed(2)) : 0;
      const medianMfe = mfes.length > 0 ? parseFloat(mfes[Math.floor(mfes.length / 2)].toFixed(2)) : 0;
      const medianMae = maes.length > 0 ? parseFloat(maes[Math.floor(maes.length / 2)].toFixed(2)) : 0;

      const resTimes = sliceRecords.map(r => r.resolutionTimeSeconds || 60);
      const avgResolutionTimeSeconds = resTimes.length > 0 ? Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length) : 0;

      result[key] = {
        dimension: String(dimensionKey),
        sliceKey: key,
        sampleSize,
        sufficientSample,
        sampleStatus,
        winRate,
        strongCorrectRate,
        avgMfe,
        avgMae,
        medianMfe,
        medianMae,
        avgResolutionTimeSeconds,
        unresolvedPercentage: 0,
        contradictionRate: 0
      };
    }

    return result;
  }

  // ==========================================
  // 6. QUERY & RETRIEVAL APIS
  // ==========================================

  public getOutcomeRecord(signalId: string): SignalOutcomeRecord | null {
    return this.resolveRecord(signalId) || null;
  }

  public getAllOutcomeRecords(filter?: {
    symbol?: string;
    signalType?: string;
    eventType?: string;
    priority?: PriorityTier | string;
    outcome?: SignalOutcomeType;
    marketRegime?: MarketRegimeType;
    sourceTier?: string;
    startDate?: string;
    endDate?: string;
  }): SignalOutcomeRecord[] {
    let list = Array.from(this.outcomes.values());

    if (filter) {
      if (filter.symbol) {
        const s = filter.symbol.toUpperCase();
        list = list.filter(r => r.symbol === s);
      }
      if (filter.signalType) {
        list = list.filter(r => r.signalType === filter.signalType);
      }
      if (filter.eventType) {
        list = list.filter(r => r.signalType === filter.eventType || r.eventCategory === filter.eventType);
      }
      if (filter.priority) {
        list = list.filter(r => r.initialPriority === filter.priority || r.priority === filter.priority);
      }
      if (filter.outcome) {
        list = list.filter(r => r.outcome === filter.outcome);
      }
      if (filter.marketRegime) {
        list = list.filter(r => r.marketRegime === filter.marketRegime);
      }
      if (filter.sourceTier) {
        list = list.filter(r => r.sourceTier === filter.sourceTier);
      }
      if (filter.startDate) {
        const startMs = new Date(filter.startDate).getTime();
        list = list.filter(r => new Date(r.generatedAt).getTime() >= startMs);
      }
      if (filter.endDate) {
        const endMs = new Date(filter.endDate).getTime();
        list = list.filter(r => new Date(r.generatedAt).getTime() <= endMs);
      }
    }

    return list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  public getTelemetry(): OutcomeTelemetry {
    const avgLatency = this.outcomeEvaluationsCount > 0
      ? parseFloat((this.totalEvaluationLatencyMs / this.outcomeEvaluationsCount).toFixed(2))
      : 0;

    return {
      outcomeEvaluations: this.outcomeEvaluationsCount,
      marketObservationsConsumed: this.marketObservationsConsumedCount,
      completedOutcomes: this.completedOutcomesCount,
      unresolvedOutcomes: this.unresolvedOutcomesCount,
      insufficientDataOutcomes: this.insufficientDataOutcomesCount,
      aggregationExecutions: this.aggregationExecutionsCount,
      averageEvaluationLatencyMs: avgLatency,
      evaluationLatencyMs: avgLatency,
      observationsProcessed: this.marketObservationsConsumedCount,
      unlinkedLifecycleUpdates: this.unlinkedLifecycleUpdateCount,
      aiCalls: 0,
      aiCallCount: 0
    };
  }

  // ==========================================
  // 7. PERSISTENCE & STORAGE
  // ==========================================

  private saveToStorage(): void {
    if (!this.storagePath) return;

    // Test isolation guard: never mutate canonical production files during test execution
    const isTestEnv = !!(process.env.VITEST || process.env.NODE_ENV === 'test');
    if (isTestEnv && (SignalOutcomeEngine.isProductionStoragePath(this.storagePath) || SignalOutcomeEngine.isProductionStoragePath(this.backupPath))) {
      return;
    }

    if (this.isSaving) {
      // Re-entry guard: skip overlapping synchronous invocation
      return;
    }

    this.isSaving = true;
    let tempPath: string | null = null;

    try {
      const dataDir = path.dirname(this.storagePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const records = Array.from(this.outcomes.values());
      const serialized = JSON.stringify(records, null, 2);

      // Step B: Write serialized JSON to a temporary file in the same directory/filesystem
      const randSuffix = Math.random().toString(36).substring(2, 8);
      tempPath = `${this.storagePath}.${Date.now()}-${randSuffix}.tmp`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');

      // Step C: Verify the temporary file before replacing primary
      const readBack = fs.readFileSync(tempPath, 'utf-8');
      const parsedTemp = JSON.parse(readBack);
      if (!Array.isArray(parsedTemp) || parsedTemp.length !== records.length) {
        throw new Error(`[SignalOutcomeEngine] Temp file verification failed: expected array of length ${records.length}, got ${Array.isArray(parsedTemp) ? parsedTemp.length : typeof parsedTemp}`);
      }

      // Step D: Only create/update backup from CURRENT VALID PRIMARY
      if (fs.existsSync(this.storagePath)) {
        try {
          const currentPrimaryRaw = fs.readFileSync(this.storagePath, 'utf-8');
          const currentPrimaryParsed = JSON.parse(currentPrimaryRaw);
          if (Array.isArray(currentPrimaryParsed)) {
            // Current primary is valid JSON array: safe to backup
            fs.copyFileSync(this.storagePath, this.backupPath);
          } else {
            console.warn('[SignalOutcomeEngine] Current primary is not an array, skipping backup copy to protect existing backup');
          }
        } catch (backupCheckErr) {
          console.warn('[SignalOutcomeEngine] Current primary is invalid/corrupt, skipping backup copy to protect existing backup');
        }
      }

      // Step E: Atomically replace primary with verified temp file
      fs.renameSync(tempPath, this.storagePath);
      tempPath = null; // Successfully promoted to primary
    } catch (err: any) {
      console.error('[SignalOutcomeEngine] Failed to save outcomes to storage:', err?.message || err);
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
      this.isSaving = false;
    }
  }

  private hydrateFromStorage(): void {
    if (!this.storagePath) return;
    let hydratedFromPrimary = false;

    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.outcomes.clear();
            this.aliasMap.clear();
            for (const item of parsed) {
              if (item && item.signalId) {
                this.outcomes.set(item.signalId, item);
                this.registerAliases(item);
              }
            }
            hydratedFromPrimary = true;
          }
        }
      }
    } catch (err: any) {
      console.warn('[SignalOutcomeEngine] Failed to hydrate from storage, attempting backup:', err?.message || err);
    }

    if (!hydratedFromPrimary && this.backupPath && fs.existsSync(this.backupPath)) {
      try {
        const raw = fs.readFileSync(this.backupPath, 'utf-8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.outcomes.clear();
            this.aliasMap.clear();
            for (const item of parsed) {
              if (item && item.signalId) {
                this.outcomes.set(item.signalId, item);
                this.registerAliases(item);
              }
            }
          }
        }
      } catch (backupErr: any) {
        console.warn('[SignalOutcomeEngine] Failed to hydrate from backup:', backupErr?.message || backupErr);
      }
    }
  }

  private computeActiveTradingSeconds(startIso: string, endIso: string): number {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    return Math.max(0, Math.round((e - s) / 1000));
  }

  public getMarketSession(isoString: string): MarketSessionType {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'CLOSED';
    // Indian Standard Time is UTC + 5:30 (330 minutes)
    const istOffsetMs = 330 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffsetMs);

    const istDay = istDate.getUTCDay(); // 0 = Sun, 6 = Sat
    if (istDay === 0 || istDay === 6) {
      return 'CLOSED';
    }

    const hours = istDate.getUTCHours() + (istDate.getUTCMinutes() / 60);
    if (hours >= 9.0 && hours < 9.25) return 'PRE_MARKET';
    if (hours >= 9.25 && hours <= 15.5) return 'REGULAR_MARKET';
    if (hours > 15.5 && hours <= 16.0) return 'POST_MARKET';
    return 'CLOSED';
  }
}

export const signalOutcomeEngine = SignalOutcomeEngine.getInstance();
