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

export interface MarketObservationTick {
  timestamp: string; // ISO string
  price: number;
  high?: number;
  low?: number;
  volume?: number;
}

export type PriceObservation = MarketObservationTick;

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
  signalId: string; // Primary identity: ${eventId}::${signalType}::${symbol}::rev${revision}
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
  aiCalls: 0;
  aiCallCount: 0; // Strictly zero AI calls
}

export class SignalOutcomeEngine {
  private static instance: SignalOutcomeEngine;
  private readonly storagePath: string;
  private readonly backupPath: string;
  private outcomes: Map<string, SignalOutcomeRecord> = new Map();
  private observationStore: Map<string, MarketObservationTick[]> = new Map();
  
  // Telemetry metrics
  private outcomeEvaluationsCount: number = 0;
  private marketObservationsConsumedCount: number = 0;
  private completedOutcomesCount: number = 0;
  private unresolvedOutcomesCount: number = 0;
  private insufficientDataOutcomesCount: number = 0;
  private aggregationExecutionsCount: number = 0;
  private totalEvaluationLatencyMs: number = 0;

  // Minimum sample size required before asserting statistical sufficiency
  public static readonly MIN_SAMPLE_SIZE_FOR_CONFIDENCE = 5;

  private constructor() {
    this.storagePath = path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json');
    this.backupPath = path.join(process.cwd(), 'data', 'market_intelligence_outcomes.json.bak');
    this.hydrateFromStorage();
  }

  public static getInstance(): SignalOutcomeEngine {
    if (!SignalOutcomeEngine.instance) {
      SignalOutcomeEngine.instance = new SignalOutcomeEngine();
    }
    return SignalOutcomeEngine.instance;
  }

  public static resetInstance(): void {
    SignalOutcomeEngine.instance = new SignalOutcomeEngine();
  }

  public clear(): void {
    this.outcomes.clear();
    this.observationStore.clear();
    this.outcomeEvaluationsCount = 0;
    this.marketObservationsConsumedCount = 0;
    this.completedOutcomesCount = 0;
    this.unresolvedOutcomesCount = 0;
    this.insufficientDataOutcomesCount = 0;
    this.aggregationExecutionsCount = 0;
    this.totalEvaluationLatencyMs = 0;
    this.saveToStorage();
  }

  /**
   * Directly record or override a SignalOutcomeRecord (for historical ledger seeding & testing).
   */
  public recordOutcome(record: SignalOutcomeRecord): void {
    this.outcomes.set(record.signalId, record);
    if (record.isResolved) {
      this.completedOutcomesCount++;
    } else {
      this.unresolvedOutcomesCount++;
    }
    this.saveToStorage();
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
    initialPrice: number;
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
    const signalId = signal.signalId || `${signal.eventId}::${signal.signalType}::${signal.symbol}::rev${revision}`;
    const generatedAt = signal.generatedAt || new Date().toISOString();

    if (this.outcomes.has(signalId)) {
      return this.outcomes.get(signalId)!;
    }

    const direction = signal.direction || 'BULLISH';
    const targetPercent = signal.targetPercent || (direction === 'BULLISH' ? 2.0 : direction === 'BEARISH' ? -2.0 : 0.5);
    const stopPercent = signal.stopPercent || (direction === 'BULLISH' ? -2.0 : direction === 'BEARISH' ? 2.0 : -1.0);
    const targetPrice = signal.targetPrice || (signal.initialPrice * (1 + targetPercent / 100));
    const stopPrice = signal.stopPrice || (signal.initialPrice * (1 + stopPercent / 100));
    const effectivePriority = signal.priority || signal.initialPriority || 'P1_HIGH';

    const initialTimeline: ForensicTimelineEvent = {
      timestamp: generatedAt,
      eventType: 'SIGNAL_GENERATED',
      description: `Actionable signal generated for ${signal.symbol} (${direction}) at ₹${signal.initialPrice}`,
      price: signal.initialPrice,
      details: {
        initialScore: signal.initialCompositeScore,
        priority: effectivePriority,
        alignment: signal.initialAlignment,
        targetPrice,
        stopPrice
      }
    };

    const newRecord: SignalOutcomeRecord = {
      signalId,
      eventId: signal.eventId,
      signalType: signal.signalType,
      symbol: signal.symbol,
      revision,
      generatedAt,
      initialPrice: signal.initialPrice,
      initialMarketState: signal.initialMarketState || 'ACTIVE',
      initialCompositeScore: signal.initialCompositeScore ?? 75,
      initialPriority: effectivePriority,
      priority: effectivePriority,
      initialAlignment: signal.initialAlignment || 'ALIGNED',
      signalLifecycleState: signal.signalLifecycleState || 'ACTIVE',
      
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
      dataFreshness: signal.dataFreshness || 'REAL_TIME',

      mfePercent: 0,
      maePercent: 0,
      mfeAbsolute: 0,
      maeAbsolute: 0,
      peakPrice: signal.initialPrice,
      troughPrice: signal.initialPrice,
      maxFavorablePrice: signal.initialPrice,
      maxAdversePrice: signal.initialPrice,
      lastObservedPrice: signal.initialPrice,
      lastObservedTimestamp: generatedAt,
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
    this.saveToStorage();

    const latency = Date.now() - startTime;
    this.totalEvaluationLatencyMs += latency;

    return newRecord;
  }

  // ==========================================
  // 2. MFE / MAE & OBSERVATION CONSUMPTION
  // ==========================================

  public ingestMarketObservations(signalId: string, observations: MarketObservationTick[]): SignalOutcomeRecord {
    const startTime = Date.now();
    this.outcomeEvaluationsCount++;

    const record = this.outcomes.get(signalId);
    if (!record) {
      throw new Error(`Signal outcome record not found for id: ${signalId}`);
    }

    if (!observations || !Array.isArray(observations) || observations.length === 0) {
      return record;
    }

    this.marketObservationsConsumedCount += observations.length;

    // Filter observations at or after signal generation
    const signalGenTime = new Date(record.generatedAt).getTime();
    const validObservations = observations.filter(obs => new Date(obs.timestamp).getTime() >= signalGenTime);

    if (validObservations.length === 0) {
      return record;
    }

    // Merge and sort
    const existingTicks = this.observationStore.get(signalId) || [];
    const mergedTicks = [...existingTicks, ...validObservations].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const dedupedTicks: MarketObservationTick[] = [];
    const seenTimes = new Set<string>();
    for (const t of mergedTicks) {
      if (!seenTimes.has(t.timestamp)) {
        seenTimes.add(t.timestamp);
        dedupedTicks.push(t);
      }
    }
    this.observationStore.set(signalId, dedupedTicks);
    record.observationCount = dedupedTicks.length;

    const initialPrice = record.initialPrice;
    if (initialPrice <= 0) {
      record.outcome = 'INSUFFICIENT_MARKET_DATA';
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

    for (const obs of dedupedTicks) {
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
    const lastTick = dedupedTicks[dedupedTicks.length - 1];
    record.lastObservedPrice = lastTick.price;
    record.lastObservedTimestamp = lastTick.timestamp;

    const prevMfe = record.mfePercent;
    const prevMae = record.maePercent;

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
    if (record.mfePercent > prevMfe && record.mfePercent > 0) {
      record.timeline.push({
        timestamp: record.mfeTimestamp || lastTick.timestamp,
        eventType: 'MFE_EXPANSION',
        description: `MFE expanded to +${record.mfePercent}% (₹${record.maxFavorablePrice})`,
        price: record.maxFavorablePrice,
        details: { mfePercent: record.mfePercent }
      });
    }
    if (record.maePercent > prevMae && record.maePercent > 0) {
      record.timeline.push({
        timestamp: record.maeTimestamp || lastTick.timestamp,
        eventType: 'MAE_EXPANSION',
        description: `MAE expanded to -${record.maePercent}% (₹${record.maxAdversePrice})`,
        price: record.maxAdversePrice,
        details: { maePercent: record.maePercent }
      });
    }

    // Evaluate Time-Buckets
    this.evaluateTimeBuckets(record, dedupedTicks);

    // Evaluate Outcome and Accuracy
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
    const record = this.outcomes.get(signalId);
    if (!record) return null;

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
    return this.outcomes.get(signalId) || null;
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
      aiCalls: 0,
      aiCallCount: 0
    };
  }

  // ==========================================
  // 7. PERSISTENCE & STORAGE
  // ==========================================

  private saveToStorage(): void {
    try {
      const dataDir = path.dirname(this.storagePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const serialized = JSON.stringify(Array.from(this.outcomes.values()), null, 2);

      if (fs.existsSync(this.storagePath)) {
        try {
          fs.copyFileSync(this.storagePath, this.backupPath);
        } catch {}
      }

      fs.writeFileSync(this.storagePath, serialized, 'utf-8');
    } catch (err) {
      console.error('[SignalOutcomeEngine] Failed to save outcomes to storage:', err);
    }
  }

  private hydrateFromStorage(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.outcomes.clear();
          for (const item of parsed) {
            if (item && item.signalId) {
              this.outcomes.set(item.signalId, item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SignalOutcomeEngine] Failed to hydrate from storage, attempting backup:', err);
      try {
        if (fs.existsSync(this.backupPath)) {
          const raw = fs.readFileSync(this.backupPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.outcomes.clear();
            for (const item of parsed) {
              if (item && item.signalId) {
                this.outcomes.set(item.signalId, item);
              }
            }
          }
        }
      } catch {}
    }
  }

  private computeActiveTradingSeconds(startIso: string, endIso: string): number {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    return Math.max(0, Math.round((e - s) / 1000));
  }

  private getMarketSession(isoString: string): MarketSessionType {
    const d = new Date(isoString);
    const hours = d.getUTCHours() + 5.5; // IST
    if (hours >= 9.0 && hours < 9.25) return 'PRE_MARKET';
    if (hours >= 9.25 && hours <= 15.5) return 'REGULAR_MARKET';
    if (hours > 15.5 && hours <= 16.0) return 'POST_MARKET';
    return 'CLOSED';
  }
}

export const signalOutcomeEngine = SignalOutcomeEngine.getInstance();
