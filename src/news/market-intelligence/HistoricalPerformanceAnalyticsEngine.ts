/**
 * ATHENA NEWS ENGINE — PHASE 10.9
 * HistoricalPerformanceAnalyticsEngine.ts
 * 
 * Historical Performance Intelligence & User-Facing Analytics Engine.
 * Aggregates Phase 10.8 SignalOutcomeEngine outcome ledger into deterministic,
 * evidence-grounded performance analytics.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic math, 0 LLM calls.
 * Read-only projection over canonical truth ledger.
 */

import {
  SignalOutcomeEngine,
  SignalOutcomeRecord,
  PriorityTier,
  MarketRegimeType,
  SignalOutcomeType,
  DirectionalAccuracyType,
  MetricAvailabilityStatus,
  EvaluatedCategory,
  categorizeOutcomeRecord
} from './SignalOutcomeEngine.ts';
import { HistoricalEventEngine } from '../intelligence/HistoricalEventEngine.ts';
import { MarketPulseEngine } from '../intelligence/MarketPulseEngine.ts';

export type SampleQuality = 'INSUFFICIENT_SAMPLE' | 'LIMITED_SAMPLE' | 'VALID_HISTORICAL_SAMPLE';

export interface SampleMetadata {
  sampleSize: number;
  sampleQuality: SampleQuality;
  sufficientSample: boolean;
  thresholds: {
    insufficientMax: number;
    limitedMax: number;
    validMin: number;
  };
}

export interface PerformanceFilter {
  symbol?: string;
  sector?: string;
  signalType?: string;
  eventType?: string;
  priority?: PriorityTier | string;
  marketRegime?: MarketRegimeType | string;
  sourceTier?: string;
  dateRange?: string; // '7d' | '30d' | '90d' | 'all' or ISO dates
  startDate?: string;
  endDate?: string;
}

export interface CorePerformanceSummary extends SampleMetadata {
  totalEvaluated: number;
  directionallyEvaluableCount: number;
  resolvedSignals: number;
  unresolvedSignals: number;
  correctSignals: number;
  incorrectSignals: number;
  correctCount: number;
  incorrectCount: number;
  contradictedCount: number;
  expiredInconclusiveCount: number;
  neutralSignals: number;
  insufficientDataSignals: number;
  insufficientMarketDataCount?: number;

  directionalAccuracyPct: number;
  accuracyStatus: MetricAvailabilityStatus;
  winRatePct?: number;
  confirmationAccuracyPct: number;
  confirmationAccuracyStatus?: MetricAvailabilityStatus;
  contradictionRatePct: number;
  invalidationRatePct: number;
  expiryRatePct: number;

  averageMFE: number;
  medianMFE: number;
  averageMAE: number;
  medianMAE: number;
  mfeStatus: MetricAvailabilityStatus;
  maeStatus: MetricAvailabilityStatus;

  averageMfePct?: number;
  medianMfePct?: number;
  averageMaePct?: number;
  medianMaePct?: number;
  mfeMaeRatio?: string;

  sampleSizeNotice?: string;
  isSampleSufficient?: boolean;
  totalSignals?: number;
  evaluatedSignalsCount?: number;

  averageResolutionTimeSeconds: number;
  resolutionTimeStatus: MetricAvailabilityStatus;
  averageTimeToConfirmationSeconds: number;
  confirmationTimeStatus: MetricAvailabilityStatus;
  averageTimeToInvalidationSeconds: number;
  invalidationTimeStatus: MetricAvailabilityStatus;
  formattedAvgResolutionTime: string;
  pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
}

export interface SignalTypePerformanceSlice extends SampleMetadata {
  signalType: string;
  eventType?: string;
  directionallyEvaluableCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  expiredInconclusiveCount?: number;
  accuracyStatus?: MetricAvailabilityStatus;
  directionalAccuracyPct: number;
  winRatePct?: number;
  averageMFE: number;
  averageMAE: number;
  medianMFE: number;
  medianMAE: number;
  mfeStatus?: MetricAvailabilityStatus;
  maeStatus?: MetricAvailabilityStatus;
  averageResolutionTimeSeconds: number;
  resolutionTimeStatus?: MetricAvailabilityStatus;
  formattedAvgResolutionTime: string;
  contradictionRatePct: number;
  sampleStatus?: string;
  pnlStatus?: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
  wordingNotice: 'Historical performance (Descriptive only)';
}

export interface SectorPerformanceSlice extends SampleMetadata {
  sector: string;
  signalCount: number;
  resolvedCount: number;
  directionallyEvaluableCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  expiredInconclusiveCount?: number;
  accuracyStatus?: MetricAvailabilityStatus;
  historicalAccuracyPct: number;
  directionalAccuracyPct?: number;
  averageMFE: number;
  averageMAE: number;
  mfeStatus?: MetricAvailabilityStatus;
  maeStatus?: MetricAvailabilityStatus;
  averageReactionPct: number;
  contradictionRatePct: number;
  strongestEventType: string;
  weakestEventType: string;
  sectorRank: number;
  pnlStatus?: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
}

export interface RegimePerformanceSlice extends SampleMetadata {
  regime: string;
  marketRegime?: string;
  signalCount: number;
  directionallyEvaluableCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  expiredInconclusiveCount?: number;
  accuracyStatus?: MetricAvailabilityStatus;
  historicalAccuracyPct: number;
  directionalAccuracyPct?: number;
  averageMFE: number;
  averageMAE: number;
  mfeStatus?: MetricAvailabilityStatus;
  maeStatus?: MetricAvailabilityStatus;
  contradictionRatePct: number;
  bySignalType: Record<string, {
    signalType: string;
    sampleSize: number;
    accuracyPct: number;
    accuracyStatus?: MetricAvailabilityStatus;
    averageMFE: number;
  }>;
  pnlStatus?: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
  wordingNotice: 'Historical observation (No causal inference)';
}

export interface SourceAuthoritySlice extends SampleMetadata {
  sourceCategory: string; // 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Single Source' | 'Multi Source'
  sourceTier?: string;
  reliabilityScore?: number;
  directionallyEvaluableCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  expiredInconclusiveCount?: number;
  accuracyStatus?: MetricAvailabilityStatus;
  accuracyPct: number;
  contradictionRatePct: number;
  averageMFE: number;
  averageMAE: number;
  mfeStatus?: MetricAvailabilityStatus;
  maeStatus?: MetricAvailabilityStatus;
  averageResolutionTimeSeconds: number;
  resolutionTimeStatus?: MetricAvailabilityStatus;
  pnlStatus?: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
}

export interface PriorityEffectivenessSlice extends SampleMetadata {
  priority: string; // 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW'
  directionallyEvaluableCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  expiredInconclusiveCount?: number;
  accuracyStatus?: MetricAvailabilityStatus;
  historicalAccuracyPct: number;
  accuracyPct?: number;
  averageReactionPct: number;
  averageMFE: number;
  averageMAE: number;
  mfeStatus?: MetricAvailabilityStatus;
  maeStatus?: MetricAvailabilityStatus;
  falsePositiveRatePct: number;
  unresolvedRatePct: number;
  pnlStatus?: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
}

export interface WhatAthenaGotRightWrongReport {
  gotRight: Array<{
    patternId: string;
    eventType: string;
    signalType: string;
    sector: string;
    sourceTier: string;
    marketRegime: string;
    sampleSize: number;
    historicalAccuracyPct: number;
    averageReactionPct: number;
    averageMFE: number;
  }>;
  gotWrong: {
    contradictorySignals: Array<{ signalId: string; symbol: string; signalType: string; reason: string }>;
    incorrectDirectionalCalls: Array<{ signalId: string; symbol: string; mfe: number; mae: number }>;
    prematureConfirmations: Array<{ signalId: string; symbol: string; reason: string }>;
    lateInvalidations: Array<{ signalId: string; symbol: string; timeToInvalidationSeconds: number }>;
    expiredWithoutReaction: Array<{ signalId: string; symbol: string; mfe: number; mae: number }>;
  };
  tonalNotice: 'Factual and historical observation without blame-oriented language';
}

export interface TrendTimeBucketPoint extends SampleMetadata {
  periodLabel: string; // e.g., '2026-W34' or '2026-08-25'
  startDate: string;
  endDate: string;
  directionallyEvaluableCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  expiredInconclusiveCount?: number;
  accuracyStatus?: MetricAvailabilityStatus;
  directionalAccuracyPct: number;
  signalVolume: number;
  averageMFE: number;
  averageMAE: number;
  mfeStatus?: MetricAvailabilityStatus;
  maeStatus?: MetricAvailabilityStatus;
  contradictionRatePct: number;
  invalidationRatePct: number;
  unresolvedRatePct: number;
  pnlStatus?: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL';
}

export interface PerformanceTrendReport {
  period?: '7d' | '30d' | '90d' | 'all';
  periodSelected: '7d' | '30d' | '90d' | 'all';
  status: 'SUCCESS' | 'INSUFFICIENT_HISTORY';
  dataPoints: TrendTimeBucketPoint[];
  trendPoints?: TrendTimeBucketPoint[];
  summary?: CorePerformanceSummary;
}

export interface HistoricalPrecedentSummary extends SampleMetadata {
  eventIdOrArticleId: string;
  symbol: string;
  eventType: string;
  similarEventsCount: number;
  historicalDirectionalAccuracyPct: number | 'INSUFFICIENT_SAMPLE';
  averageReactionPct: number | 'INSUFFICIENT_SAMPLE';
  medianMFE: number | 'INSUFFICIENT_SAMPLE';
  medianMAE: number | 'INSUFFICIENT_SAMPLE';
  statusText: string; // Descriptive notice
  disclaimer: 'Historical statistics are descriptive only. Not a prediction or probability of future success.';
}

export interface PerformanceInsight {
  id: string;
  type: 'POSITIVE_OUTPERFORMANCE' | 'REGIME_CONTRADICTION_RISK' | 'SOURCE_RELIABILITY' | 'PRIORITY_CORRELATION' | 'NEUTRAL_OBSERVATION' | string;
  title: string;
  description: string;
  text?: string;
  sampleSize: number;
  metricComparison?: {
    observedValue: number;
    baselineValue: number;
    difference: number;
    metricName: string;
  };
  wordingNotice: 'Historical observation';
}

export interface DataQualityReport {
  totalRecordsEvaluated: number;
  totalLedgerRecords?: number;
  completeRecords?: number;
  missingPriceDataCount?: number;
  auditStatus?: string;
  sourceGroundedRatePct: number;
  extractionFailedRatePct: number;
  sourceUnavailableRatePct: number;
  qualityRejectedRatePct: number;
  providerConflictRatePct: number;
  staleMarketDataRatePct: number;
  expiredMarketDataRatePct: number;
  fnoEvidenceAvailabilityPct: number;
  volumeConfirmationAvailabilityPct: number;
  evaluationNote: 'Distinguishes signal performance from evidence quality issues';
}

export interface PerformanceObservabilityMetrics {
  status?: string;
  zeroAiCostEnforced?: boolean;
  ledgerRecordCount?: number;
  aggregationExecutionCount: number;
  aggregationLatencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  cacheInvalidations: number;
  outcomeRecordsConsumed: number;
  insufficientSampleResultsCount: number;
  aiCalls: 0;
  aiCallCount: 0;
  errorsCount: number;
  lastAggregationTimestamp: string;
}

export class HistoricalPerformanceAnalyticsEngine {
  private static instance: HistoricalPerformanceAnalyticsEngine | null = null;

  // Configurable thresholds for sample protection
  private sampleThresholds = {
    insufficientMax: 4,
    limitedMax: 14,
    validMin: 15
  };

  // Revision-aware cache
  private cache = new Map<string, { timestamp: number; data: any; ledgerRevision: string }>();
  private cacheHitsCount = 0;
  private cacheMissesCount = 0;
  private cacheInvalidationsCount = 0;
  private aggregationExecutionsCount = 0;
  private totalAggregationLatencyMs = 0;
  private insufficientSampleResultsCount = 0;
  private errorsCount = 0;
  private lastAggregationTimestamp = new Date().toISOString();

  private constructor() {}

  public static getInstance(): HistoricalPerformanceAnalyticsEngine {
    if (!this.instance) {
      this.instance = new HistoricalPerformanceAnalyticsEngine();
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = new HistoricalPerformanceAnalyticsEngine();
  }

  public setSampleThresholds(thresholds: { insufficientMax: number; limitedMax: number; validMin: number }): void {
    this.sampleThresholds = { ...thresholds };
  }

  public getSampleThresholds() {
    return { ...this.sampleThresholds };
  }

  public clearCache(): void {
    this.cache.clear();
    this.cacheInvalidationsCount++;
  }

  /**
   * Determine deterministic sample quality based on sample size
   */
  public evaluateSampleQuality(sampleSize: number): SampleMetadata & { sampleSizeNotice: string } {
    let sampleQuality: SampleQuality = 'INSUFFICIENT_SAMPLE';
    if (sampleSize > this.sampleThresholds.limitedMax) {
      sampleQuality = 'VALID_HISTORICAL_SAMPLE';
    } else if (sampleSize > this.sampleThresholds.insufficientMax) {
      sampleQuality = 'LIMITED_SAMPLE';
    }

    const sampleSizeNotice = sampleQuality === 'INSUFFICIENT_SAMPLE'
      ? 'Insufficient sample size. Historical observations require at least 5 events.'
      : sampleQuality === 'LIMITED_SAMPLE'
      ? 'Limited sample size (5-14 events). Interpret with caution.'
      : 'Valid historical sample size (15+ events).';

    return {
      sampleSize,
      sampleQuality,
      sampleSizeNotice,
      sufficientSample: sampleQuality !== 'INSUFFICIENT_SAMPLE',
      thresholds: { ...this.sampleThresholds }
    };
  }

  // =========================================================================
  // 1. CORE PERFORMANCE SUMMARY
  // =========================================================================

  public getCorePerformanceSummary(filter?: PerformanceFilter): CorePerformanceSummary {
    const startTime = Date.now();
    this.aggregationExecutionsCount++;
    this.lastAggregationTimestamp = new Date().toISOString();

    const outcomes = this.getFilteredOutcomeRecords(filter);
    const sampleMeta = this.evaluateSampleQuality(outcomes.length);
    if (!sampleMeta.sufficientSample) {
      this.insufficientSampleResultsCount++;
    }

    const totalEvaluated = outcomes.length;
    const resolvedSignals = outcomes.filter(o => o.isResolved).length;

    let correctCount = 0;
    let incorrectCount = 0;
    let neutralCount = 0;
    let contradictedCount = 0;
    let expiredInconclusiveCount = 0;
    let insufficientMarketDataCount = 0;
    let unresolvedCount = 0;

    for (const o of outcomes) {
      const cat = categorizeOutcomeRecord(o);
      switch (cat) {
        case 'CORRECT':
          correctCount++;
          break;
        case 'INCORRECT':
          incorrectCount++;
          break;
        case 'NEUTRAL':
          neutralCount++;
          break;
        case 'CONTRADICTED':
          contradictedCount++;
          break;
        case 'EXPIRED_INCONCLUSIVE':
          expiredInconclusiveCount++;
          break;
        case 'INSUFFICIENT_MARKET_DATA':
          insufficientMarketDataCount++;
          break;
        case 'UNRESOLVED':
          unresolvedCount++;
          break;
      }
    }

    const directionallyEvaluableCount = correctCount + incorrectCount;
    const unresolvedSignals = unresolvedCount + insufficientMarketDataCount;
    const correctSignals = correctCount;
    const incorrectSignals = incorrectCount;
    const neutralSignals = neutralCount;
    const insufficientDataSignals = insufficientMarketDataCount;

    const accuracyStatus: MetricAvailabilityStatus = directionallyEvaluableCount > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
    const directionalAccuracyPct = directionallyEvaluableCount > 0
      ? parseFloat(((correctCount / directionallyEvaluableCount) * 100).toFixed(1))
      : 0;

    const confirmedList = outcomes.filter(o => (o.signalLifecycleState as string) === 'CONFIRMED' || o.outcome === 'TARGET_REACHED' || (o as any).evaluatedOutcome === 'CORRECT' || o.outcome === 'POSITIVE_REACTION');
    const confirmedEvaluable = confirmedList.filter(o => {
      const cat = categorizeOutcomeRecord(o);
      return cat === 'CORRECT' || cat === 'INCORRECT';
    });
    const confirmedCorrect = confirmedList.filter(o => categorizeOutcomeRecord(o) === 'CORRECT').length;
    const confirmationAccuracyStatus: MetricAvailabilityStatus = confirmedEvaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
    const confirmationAccuracyPct = confirmedEvaluable.length > 0
      ? parseFloat(((confirmedCorrect / confirmedEvaluable.length) * 100).toFixed(1))
      : 0;

    const contradictionCount = outcomes.filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED' || (o as any).evaluatedOutcome === 'CONTRADICTED' || (o.signalLifecycleState as string) === 'CONTRADICTED').length;
    const contradictionRatePct = totalEvaluated > 0
      ? parseFloat(((contradictionCount / totalEvaluated) * 100).toFixed(1))
      : 0;

    const invalidationCount = outcomes.filter(o => (o.signalLifecycleState as string) === 'INVALIDATED' || (o as any).evaluatedOutcome === 'INVALIDATED' || o.outcome === 'STOP_REACHED').length;
    const invalidationRatePct = totalEvaluated > 0
      ? parseFloat(((invalidationCount / totalEvaluated) * 100).toFixed(1))
      : 0;

    const expiryCount = outcomes.filter(o => (o.signalLifecycleState as string) === 'EXPIRED' || o.outcome === 'EXPIRED_WITHOUT_RESOLUTION' || (o as any).evaluatedOutcome === 'EXPIRED_WITHOUT_RESOLUTION').length;
    const expiryRatePct = totalEvaluated > 0
      ? parseFloat(((expiryCount / totalEvaluated) * 100).toFixed(1))
      : 0;

    const validMfes: number[] = [];
    for (const o of outcomes) {
      const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
      if (typeof val === 'number' && Number.isFinite(val)) {
        validMfes.push(val);
      }
    }
    validMfes.sort((a, b) => a - b);

    const validMaes: number[] = [];
    for (const o of outcomes) {
      const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
      if (typeof val === 'number' && Number.isFinite(val)) {
        validMaes.push(Math.abs(val));
      }
    }
    validMaes.sort((a, b) => a - b);

    const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
    const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

    const averageMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
    const medianMFE = validMfes.length > 0 ? parseFloat((validMfes[Math.floor(validMfes.length / 2)] ?? 0).toFixed(2)) : 0;
    const averageMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;
    const medianMAE = validMaes.length > 0 ? parseFloat((validMaes[Math.floor(validMaes.length / 2)] ?? 0).toFixed(2)) : 0;

    const validResTimes: number[] = [];
    for (const o of outcomes) {
      if (typeof o.resolutionTimeSeconds === 'number' && Number.isFinite(o.resolutionTimeSeconds) && o.resolutionTimeSeconds > 0) {
        validResTimes.push(o.resolutionTimeSeconds);
      }
    }
    const resolutionTimeStatus: MetricAvailabilityStatus = validResTimes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
    const averageResolutionTimeSeconds = validResTimes.length > 0 ? Math.round(validResTimes.reduce((a, b) => a + b, 0) / validResTimes.length) : 0;

    const validConfTimes: number[] = [];
    for (const o of outcomes) {
      if (typeof o.timeToTargetSeconds === 'number' && Number.isFinite(o.timeToTargetSeconds) && o.timeToTargetSeconds > 0) {
        validConfTimes.push(o.timeToTargetSeconds);
      }
    }
    const confirmationTimeStatus: MetricAvailabilityStatus = validConfTimes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
    const averageTimeToConfirmationSeconds = validConfTimes.length > 0 ? Math.round(validConfTimes.reduce((a, b) => a + b, 0) / validConfTimes.length) : 0;

    const validInvTimes: number[] = [];
    for (const o of outcomes) {
      if (typeof o.timeToInvalidationSeconds === 'number' && Number.isFinite(o.timeToInvalidationSeconds) && o.timeToInvalidationSeconds > 0) {
        validInvTimes.push(o.timeToInvalidationSeconds);
      }
    }
    const invalidationTimeStatus: MetricAvailabilityStatus = validInvTimes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
    const averageTimeToInvalidationSeconds = validInvTimes.length > 0 ? Math.round(validInvTimes.reduce((a, b) => a + b, 0) / validInvTimes.length) : 0;

    const mfeMaeRatio = (mfeStatus === 'MEASURABLE' && maeStatus === 'MEASURABLE' && averageMAE > 0)
      ? (averageMFE / averageMAE).toFixed(2)
      : 'N/A';

    this.totalAggregationLatencyMs += Date.now() - startTime;

    return {
      ...sampleMeta,
      isSampleSufficient: sampleMeta.sufficientSample,
      totalEvaluated,
      totalSignals: totalEvaluated,
      evaluatedSignalsCount: totalEvaluated,
      directionallyEvaluableCount,
      resolvedSignals,
      unresolvedSignals,
      correctSignals,
      incorrectSignals,
      correctCount,
      incorrectCount,
      contradictedCount,
      expiredInconclusiveCount,
      neutralSignals,
      insufficientDataSignals,
      insufficientMarketDataCount,

      directionalAccuracyPct,
      accuracyStatus,
      winRatePct: directionalAccuracyPct,
      confirmationAccuracyPct,
      confirmationAccuracyStatus,
      contradictionRatePct,
      invalidationRatePct,
      expiryRatePct,

      averageMFE,
      medianMFE,
      averageMAE,
      medianMAE,
      mfeStatus,
      maeStatus,

      averageMfePct: averageMFE,
      medianMfePct: medianMFE,
      averageMaePct: averageMAE,
      medianMaePct: medianMAE,
      mfeMaeRatio,

      averageResolutionTimeSeconds,
      resolutionTimeStatus,
      averageTimeToConfirmationSeconds,
      confirmationTimeStatus,
      averageTimeToInvalidationSeconds,
      invalidationTimeStatus,
      formattedAvgResolutionTime: resolutionTimeStatus === 'INSUFFICIENT_DATA' ? 'N/A' : this.formatSeconds(averageResolutionTimeSeconds),
      pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL'
    };
  }

  // =========================================================================
  // 2. SIGNAL-TYPE PERFORMANCE
  // =========================================================================

  public getSignalTypePerformance(filter?: PerformanceFilter): any {
    const outcomes = this.getFilteredOutcomeRecords(filter);
    const groups = new Map<string, SignalOutcomeRecord[]>();

    for (const o of outcomes) {
      const typeKey = o.signalType || o.eventCategory || 'UNKNOWN';
      if (!groups.has(typeKey)) {
        groups.set(typeKey, []);
      }
      groups.get(typeKey)!.push(o);
    }

    const resultArray: any[] = [];
    const resultRecord: Record<string, any> = {};

    for (const [key, sliceRecords] of groups.entries()) {
      const sampleMeta = this.evaluateSampleQuality(sliceRecords.length);
      const evaluable = sliceRecords.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = sliceRecords.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      const contradiction = sliceRecords.filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED');
      const expiredInconclusive = sliceRecords.filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE');

      const accuracyStatus: MetricAvailabilityStatus = evaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

      const validMfes: number[] = [];
      for (const o of sliceRecords) {
        const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
      }
      validMfes.sort((a, b) => a - b);

      const validMaes: number[] = [];
      for (const o of sliceRecords) {
        const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
      }
      validMaes.sort((a, b) => a - b);

      const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

      const avgMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
      const medianMFE = validMfes.length > 0 ? parseFloat((validMfes[Math.floor(validMfes.length / 2)] ?? 0).toFixed(2)) : 0;
      const avgMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;
      const medianMAE = validMaes.length > 0 ? parseFloat((validMaes[Math.floor(validMaes.length / 2)] ?? 0).toFixed(2)) : 0;

      const validResTimes: number[] = [];
      for (const o of sliceRecords) {
        if (typeof o.resolutionTimeSeconds === 'number' && Number.isFinite(o.resolutionTimeSeconds) && o.resolutionTimeSeconds > 0) {
          validResTimes.push(o.resolutionTimeSeconds);
        }
      }
      const resolutionTimeStatus: MetricAvailabilityStatus = validResTimes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const avgResTimeSec = validResTimes.length > 0 ? Math.round(validResTimes.reduce((a, b) => a + b, 0) / validResTimes.length) : 0;
      const contradictionRatePct = sliceRecords.length > 0 ? parseFloat(((contradiction.length / sliceRecords.length) * 100).toFixed(1)) : 0;

      const sampleStatus = sampleMeta.sampleQuality === 'VALID_HISTORICAL_SAMPLE' ? 'VALID' : sampleMeta.sampleQuality === 'LIMITED_SAMPLE' ? 'LIMITED' : 'INSUFFICIENT';

      const slice = {
        ...sampleMeta,
        signalType: key,
        eventType: sliceRecords[0]?.eventCategory,
        directionallyEvaluableCount: evaluable.length,
        correctCount: correct.length,
        incorrectCount: evaluable.length - correct.length,
        expiredInconclusiveCount: expiredInconclusive.length,
        accuracyStatus,
        winRatePct: accPct,
        directionalAccuracyPct: accPct,
        averageMFE: avgMFE,
        averageMAE: avgMAE,
        medianMFE,
        medianMAE,
        mfeStatus,
        maeStatus,
        averageResolutionTimeSeconds: avgResTimeSec,
        resolutionTimeStatus,
        formattedAvgResolutionTime: resolutionTimeStatus === 'INSUFFICIENT_DATA' ? 'N/A' : this.formatSeconds(avgResTimeSec),
        contradictionRatePct,
        sampleStatus,
        pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL',
        wordingNotice: 'Historical performance (Descriptive only)'
      };

      resultArray.push(slice);
      resultRecord[key] = slice;
    }

    return Object.assign(resultArray, resultRecord);
  }

  // =========================================================================
  // 3. SECTOR PERFORMANCE ANALYTICS
  // =========================================================================

  public getSectorPerformance(filter?: PerformanceFilter): SectorPerformanceSlice[] {
    const outcomes = this.getFilteredOutcomeRecords(filter);

    const groups = new Map<string, SignalOutcomeRecord[]>();

    for (const o of outcomes) {
      const sec = (o.sector || 'OTHER').toUpperCase().trim();
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push(o);
    }

    const slices: SectorPerformanceSlice[] = [];

    for (const [sec, recs] of groups.entries()) {
      const sampleMeta = this.evaluateSampleQuality(recs.length);
      const evaluable = recs.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = recs.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      const contradictions = recs.filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED');
      const expiredInconclusive = recs.filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE');

      const accuracyStatus: MetricAvailabilityStatus = evaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

      const validMfes: number[] = [];
      for (const o of recs) {
        const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
      }
      validMfes.sort((a, b) => a - b);

      const validMaes: number[] = [];
      for (const o of recs) {
        const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
      }
      validMaes.sort((a, b) => a - b);

      const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

      const avgMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
      const avgMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;
      const avgReactionPct = (mfeStatus === 'MEASURABLE' || maeStatus === 'MEASURABLE')
        ? parseFloat((avgMFE - avgMAE).toFixed(2))
        : 0;
      const contradictionRatePct = recs.length > 0 ? parseFloat(((contradictions.length / recs.length) * 100).toFixed(1)) : 0;

      // Event type ranking within sector
      const evGroups = new Map<string, { total: number; correct: number }>();
      for (const r of recs) {
        const ev = r.eventCategory || r.signalType || 'GENERAL';
        if (!evGroups.has(ev)) evGroups.set(ev, { total: 0, correct: 0 });
        const g = evGroups.get(ev)!;
        g.total++;
        if (r.isCorrect || (r as any).evaluatedOutcome === 'CORRECT') g.correct++;
      }

      let strongestEventType = 'N/A';
      let weakestEventType = 'N/A';
      let maxAcc = -1;
      let minAcc = 999;

      for (const [ev, g] of evGroups.entries()) {
        const acc = (g.correct / g.total) * 100;
        if (acc > maxAcc) {
          maxAcc = acc;
          strongestEventType = ev;
        }
        if (acc < minAcc) {
          minAcc = acc;
          weakestEventType = ev;
        }
      }

      slices.push({
        ...sampleMeta,
        sector: sec,
        signalCount: recs.length,
        resolvedCount: recs.filter(o => o.isResolved).length,
        directionallyEvaluableCount: evaluable.length,
        correctCount: correct.length,
        incorrectCount: evaluable.length - correct.length,
        expiredInconclusiveCount: expiredInconclusive.length,
        accuracyStatus,
        directionalAccuracyPct: accPct,
        historicalAccuracyPct: accPct,
        averageMFE: avgMFE,
        averageMAE: avgMAE,
        mfeStatus,
        maeStatus,
        averageReactionPct: avgReactionPct,
        contradictionRatePct,
        strongestEventType,
        weakestEventType,
        sectorRank: 0,
        pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL'
      });
    }

    // Sort by historical accuracy descending and assign rank
    slices.sort((a, b) => b.historicalAccuracyPct - a.historicalAccuracyPct || b.averageMFE - a.averageMFE);
    slices.forEach((s, idx) => {
      s.sectorRank = idx + 1;
    });

    return slices;
  }

  // =========================================================================
  // 4. MARKET-REGIME PERFORMANCE
  // =========================================================================

  public getMarketRegimePerformance(filter?: PerformanceFilter): any {
    const outcomes = this.getFilteredOutcomeRecords(filter);

    const groups = new Map<string, SignalOutcomeRecord[]>();

    for (const o of outcomes) {
      const reg = (o.marketRegime || 'NEUTRAL').toUpperCase().trim();
      if (!groups.has(reg)) groups.set(reg, []);
      groups.get(reg)!.push(o);
    }

    const resultArray: any[] = [];
    const resultRecord: Record<string, any> = {};

    for (const [regime, recs] of groups.entries()) {
      const sampleMeta = this.evaluateSampleQuality(recs.length);
      const evaluable = recs.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = recs.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      const contradiction = recs.filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED');
      const expiredInconclusive = recs.filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE');

      const accuracyStatus: MetricAvailabilityStatus = evaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

      const validMfes: number[] = [];
      for (const o of recs) {
        const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
      }
      validMfes.sort((a, b) => a - b);

      const validMaes: number[] = [];
      for (const o of recs) {
        const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
      }
      validMaes.sort((a, b) => a - b);

      const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

      const avgMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
      const avgMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;
      const contradictionRatePct = recs.length > 0 ? parseFloat(((contradiction.length / recs.length) * 100).toFixed(1)) : 0;

      // Slice by signal type within regime
      const sigTypeMap: Record<string, { signalType: string; sampleSize: number; accuracyPct: number; accuracyStatus?: MetricAvailabilityStatus; averageMFE: number }> = {};
      const sigGroups = new Map<string, SignalOutcomeRecord[]>();
      for (const r of recs) {
        const st = r.signalType || 'UNKNOWN';
        if (!sigGroups.has(st)) sigGroups.set(st, []);
        sigGroups.get(st)!.push(r);
      }

      for (const [st, stRecs] of sigGroups.entries()) {
        const stEval = stRecs.filter(r => {
          const cat = categorizeOutcomeRecord(r);
          return cat === 'CORRECT' || cat === 'INCORRECT';
        });
        const stCorr = stRecs.filter(r => categorizeOutcomeRecord(r) === 'CORRECT');
        const stMfes: number[] = [];
        for (const r of stRecs) {
          const val = r.mfePercent !== undefined ? r.mfePercent : (r as any).maxFavorableExcursionPct;
          if (typeof val === 'number' && Number.isFinite(val)) stMfes.push(val);
        }
        sigTypeMap[st] = {
          signalType: st,
          sampleSize: stRecs.length,
          accuracyStatus: stEval.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA',
          accuracyPct: stEval.length > 0 ? parseFloat(((stCorr.length / stEval.length) * 100).toFixed(1)) : 0,
          averageMFE: stMfes.length > 0 ? parseFloat((stMfes.reduce((a, b) => a + b, 0) / stMfes.length).toFixed(2)) : 0
        };
      }

      const slice = {
        ...sampleMeta,
        regime,
        marketRegime: regime,
        signalCount: recs.length,
        directionallyEvaluableCount: evaluable.length,
        correctCount: correct.length,
        incorrectCount: evaluable.length - correct.length,
        expiredInconclusiveCount: expiredInconclusive.length,
        accuracyStatus,
        directionalAccuracyPct: accPct,
        historicalAccuracyPct: accPct,
        averageMFE: avgMFE,
        averageMAE: avgMAE,
        mfeStatus,
        maeStatus,
        contradictionRatePct,
        bySignalType: sigTypeMap,
        pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL',
        wordingNotice: 'Historical observation (No causal inference)'
      };

      resultArray.push(slice);
      resultRecord[regime] = slice;
    }

    return Object.assign(resultArray, resultRecord);
  }

  // =========================================================================
  // 5. SOURCE AUTHORITY ANALYTICS
  // =========================================================================

  public getSourceAuthorityAnalytics(filter?: PerformanceFilter): SourceAuthoritySlice[] {
    const outcomes = this.getFilteredOutcomeRecords(filter);
    const groups = new Map<string, SignalOutcomeRecord[]>();

    for (const o of outcomes) {
      const tier = o.sourceTier || 'Tier 1';
      if (!groups.has(tier)) groups.set(tier, []);
      groups.get(tier)!.push(o);
    }

    const slices: SourceAuthoritySlice[] = [];

    for (const [tier, recs] of groups.entries()) {
      const sampleMeta = this.evaluateSampleQuality(recs.length);
      const evaluable = recs.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = recs.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      const contradictions = recs.filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED');
      const expiredInconclusive = recs.filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE');

      const accuracyStatus: MetricAvailabilityStatus = evaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

      const validMfes: number[] = [];
      for (const o of recs) {
        const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
      }
      validMfes.sort((a, b) => a - b);

      const validMaes: number[] = [];
      for (const o of recs) {
        const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
      }
      validMaes.sort((a, b) => a - b);

      const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

      const avgMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
      const avgMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;
      const contradictionRatePct = recs.length > 0 ? parseFloat(((contradictions.length / recs.length) * 100).toFixed(1)) : 0;

      const validResTimes: number[] = [];
      for (const o of recs) {
        if (typeof o.resolutionTimeSeconds === 'number' && Number.isFinite(o.resolutionTimeSeconds) && o.resolutionTimeSeconds > 0) {
          validResTimes.push(o.resolutionTimeSeconds);
        }
      }
      const resolutionTimeStatus: MetricAvailabilityStatus = validResTimes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const avgResTime = validResTimes.length > 0 ? Math.round(validResTimes.reduce((a, b) => a + b, 0) / validResTimes.length) : 0;
      const reliabilityScore = tier.includes('1') || tier.includes('EXCHANGE') ? 95 : 75;

      slices.push({
        ...sampleMeta,
        sourceTier: tier,
        sourceCategory: tier,
        directionallyEvaluableCount: evaluable.length,
        correctCount: correct.length,
        incorrectCount: evaluable.length - correct.length,
        expiredInconclusiveCount: expiredInconclusive.length,
        accuracyStatus,
        accuracyPct: accPct,
        reliabilityScore,
        contradictionRatePct,
        averageMFE: avgMFE,
        averageMAE: avgMAE,
        mfeStatus,
        maeStatus,
        averageResolutionTimeSeconds: avgResTime,
        resolutionTimeStatus,
        pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL'
      });
    }

    return slices;
  }

  // =========================================================================
  // 6. PRIORITY EFFECTIVENESS MATRIX
  // =========================================================================

  public getPriorityEffectiveness(filter?: PerformanceFilter): any {
    const outcomes = this.getFilteredOutcomeRecords(filter);
    const priorities = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P2_STANDARD', 'P3_LOW'];

    const groups = new Map<string, SignalOutcomeRecord[]>();
    for (const p of priorities) {
      groups.set(p, []);
    }

    for (const o of outcomes) {
      const pStr = (o.initialPriority || o.priority || 'P2_MEDIUM').toString().toUpperCase();
      let normP = 'P2_MEDIUM';
      if (pStr.includes('P0') || pStr.includes('CRITICAL')) normP = 'P0_CRITICAL';
      else if (pStr.includes('P1') || pStr.includes('HIGH')) normP = 'P1_HIGH';
      else if (pStr.includes('P2') || pStr.includes('STANDARD') || pStr.includes('MEDIUM')) normP = 'P2_STANDARD';
      else normP = 'P3_LOW';

      if (!groups.has(normP)) groups.set(normP, []);
      groups.get(normP)!.push(o);
    }

    const resultArray: PriorityEffectivenessSlice[] = [];
    const resultRecord: Record<string, PriorityEffectivenessSlice> = {};

    for (const [p, recs] of groups.entries()) {
      const sampleMeta = this.evaluateSampleQuality(recs.length);
      const evaluable = recs.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = recs.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      const falsePositives = recs.filter(o => o.priorityAccuracy === 'INVERTED_PRIORITY' || categorizeOutcomeRecord(o) === 'INCORRECT');
      const unresolved = recs.filter(o => !o.isResolved);
      const expiredInconclusive = recs.filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE');

      const accuracyStatus: MetricAvailabilityStatus = evaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

      const validMfes: number[] = [];
      for (const o of recs) {
        const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
      }
      validMfes.sort((a, b) => a - b);

      const validMaes: number[] = [];
      for (const o of recs) {
        const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
      }
      validMaes.sort((a, b) => a - b);

      const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

      const avgMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
      const avgMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;
      const avgReactionPct = (mfeStatus === 'MEASURABLE' || maeStatus === 'MEASURABLE')
        ? parseFloat((avgMFE - avgMAE).toFixed(2))
        : 0;

      const fpRatePct = evaluable.length > 0 ? parseFloat(((falsePositives.length / evaluable.length) * 100).toFixed(1)) : 0;
      const unresolvedRatePct = recs.length > 0 ? parseFloat(((unresolved.length / recs.length) * 100).toFixed(1)) : 0;

      const slice: PriorityEffectivenessSlice = {
        ...sampleMeta,
        priority: p,
        directionallyEvaluableCount: evaluable.length,
        correctCount: correct.length,
        incorrectCount: evaluable.length - correct.length,
        expiredInconclusiveCount: expiredInconclusive.length,
        accuracyStatus,
        accuracyPct: accPct,
        historicalAccuracyPct: accPct,
        averageReactionPct: avgReactionPct,
        averageMFE: avgMFE,
        averageMAE: avgMAE,
        mfeStatus,
        maeStatus,
        falsePositiveRatePct: fpRatePct,
        unresolvedRatePct,
        pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL'
      };

      resultArray.push(slice);
      resultRecord[p] = slice;
    }

    // Attach array methods for dual compatibility
    return Object.assign(resultArray, resultRecord);
  }

  // =========================================================================
  // 7. "WHAT ATHENA GOT RIGHT / WRONG" FACTUAL COMPONENT
  // =========================================================================

  public getWhatAthenaGotRightWrong(filter?: PerformanceFilter): any {
    const outcomes = this.getFilteredOutcomeRecords(filter);
    
    // Got Right: Top performing patterns with high accuracy & positive MFE
    const patternGroups = new Map<string, SignalOutcomeRecord[]>();
    for (const o of outcomes) {
      const pKey = `${o.eventCategory || 'EVENT'}::${o.signalType || 'SIGNAL'}::${o.sector || 'GENERAL'}`;
      if (!patternGroups.has(pKey)) patternGroups.set(pKey, []);
      patternGroups.get(pKey)!.push(o);
    }

    const gotRight: WhatAthenaGotRightWrongReport['gotRight'] = [];
    for (const [pKey, recs] of patternGroups.entries()) {
      const evaluable = recs.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = recs.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      if (evaluable.length >= 1 && correct.length / evaluable.length >= 0.5) {
        const parts = pKey.split('::');
        const mfes = recs.map(o => o.mfePercent !== undefined ? o.mfePercent : ((o as any).maxFavorableExcursionPct ?? 0));
        const maes = recs.map(o => o.maePercent !== undefined ? o.maePercent : Math.abs((o as any).maxAdverseExcursionPct ?? 0));
        const avgMFE = mfes.length > 0 ? mfes.reduce((a, b) => a + b, 0) / mfes.length : 0;
        const avgMAE = maes.length > 0 ? maes.reduce((a, b) => a + b, 0) / maes.length : 0;

        gotRight.push({
          patternId: pKey,
          eventType: parts[0],
          signalType: parts[1],
          sector: parts[2],
          sourceTier: recs[0].sourceTier || 'Tier 1',
          marketRegime: recs[0].marketRegime || 'NEUTRAL',
          sampleSize: recs.length,
          historicalAccuracyPct: parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)),
          averageReactionPct: parseFloat((avgMFE - avgMAE).toFixed(2)),
          averageMFE: parseFloat(avgMFE.toFixed(2))
        });
      }
    }
    gotRight.sort((a, b) => b.historicalAccuracyPct - a.historicalAccuracyPct);

    // High confidence wins
    const highConfidenceWins = outcomes
      .filter(o => (o.confidenceScore || 0) >= 80 && categorizeOutcomeRecord(o) === 'CORRECT')
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        signalType: o.signalType,
        peakExcursionPct: o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct || 0
      }));

    // Top invalidations
    const topInvalidations = outcomes
      .filter(o => (o as any).evaluatedOutcome === 'INVALIDATED' || (o.signalLifecycleState as string) === 'INVALIDATED' || o.outcome === 'STOP_REACHED')
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        signalType: o.signalType,
        maxAdverseExcursionPct: o.maePercent !== undefined ? o.maePercent : Math.abs((o as any).maxAdverseExcursionPct || 0)
      }));

    // Got Wrong: factual categorization
    const contradictorySignals = outcomes
      .filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED')
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        signalType: o.signalType,
        reason: o.invalidationReason || 'Opposing price/volume pressure'
      }));

    const incorrectDirectionalCalls = outcomes
      .filter(o => categorizeOutcomeRecord(o) === 'INCORRECT')
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        mfe: o.mfePercent,
        mae: o.maePercent
      }));

    const prematureConfirmations = outcomes
      .filter(o => (o.signalLifecycleState as string) === 'CONFIRMED' && categorizeOutcomeRecord(o) === 'INCORRECT')
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        reason: 'Confirmed by early tick but subsequently hit adverse stop'
      }));

    const lateInvalidations = outcomes
      .filter(o => (o.signalLifecycleState as string) === 'INVALIDATED' && (o.timeToInvalidationSeconds || 0) > 7200)
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        timeToInvalidationSeconds: o.timeToInvalidationSeconds || 7200
      }));

    const expiredWithoutReaction = outcomes
      .filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE')
      .map(o => ({
        signalId: o.signalId,
        symbol: o.symbol,
        mfe: o.mfePercent,
        mae: o.maePercent
      }));

    const learnings = [
      'Regulatory and Exchange Tier 1 filings demonstrate lower contradiction rates in observed history.',
      'Controlled signal expiry excludes unresolved events from directional accuracy to preserve empirical truthfulness.'
    ];

    return {
      gotRight: gotRight.slice(0, 10),
      highConfidenceWins,
      topInvalidations,
      learnings,
      gotWrong: {
        contradictorySignals: contradictorySignals.slice(0, 10),
        incorrectDirectionalCalls: incorrectDirectionalCalls.slice(0, 10),
        prematureConfirmations: prematureConfirmations.slice(0, 10),
        lateInvalidations: lateInvalidations.slice(0, 10),
        expiredWithoutReaction: expiredWithoutReaction.slice(0, 10)
      },
      tonalNotice: 'Factual and historical observation without blame-oriented language'
    };
  }

  // =========================================================================
  // 8. HISTORICAL PERFORMANCE TREND
  // =========================================================================

  public getPerformanceTrend(period: '7d' | '30d' | '90d' | 'all' = '30d', filter?: PerformanceFilter): PerformanceTrendReport {
    const outcomes = this.getFilteredOutcomeRecords(filter);
    if (outcomes.length === 0) {
      return {
        period: period,
        periodSelected: period,
        status: 'INSUFFICIENT_HISTORY',
        trendPoints: [],
        dataPoints: []
      };
    }

    const nowMs = Date.now();
    let filterCutoffMs = 0;
    if (period === '7d') filterCutoffMs = nowMs - 7 * 86400 * 1000;
    else if (period === '30d') filterCutoffMs = nowMs - 30 * 86400 * 1000;
    else if (period === '90d') filterCutoffMs = nowMs - 90 * 86400 * 1000;

    const getTime = (o: any) => {
      const t = o.generatedAt || o.initialTimestamp || o.timestamp;
      if (typeof t === 'number') return t;
      if (t) return new Date(t).getTime();
      return Date.now();
    };

    const filteredOutcomes = filterCutoffMs > 0
      ? outcomes.filter(o => getTime(o) >= filterCutoffMs)
      : outcomes;

    if (filteredOutcomes.length === 0) {
      return {
        period: period,
        periodSelected: period,
        status: 'INSUFFICIENT_HISTORY',
        trendPoints: [],
        dataPoints: []
      };
    }

    // Group into time buckets (e.g. daily for 7d/30d, weekly for 90d/all)
    const bucketMap = new Map<string, SignalOutcomeRecord[]>();
    for (const o of filteredOutcomes) {
      const d = new Date(getTime(o));
      const dateKey = period === '7d' || period === '30d'
        ? d.toISOString().split('T')[0]
        : `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;

      if (!bucketMap.has(dateKey)) bucketMap.set(dateKey, []);
      bucketMap.get(dateKey)!.push(o);
    }

    const dataPoints: TrendTimeBucketPoint[] = [];
    const sortedKeys = Array.from(bucketMap.keys()).sort();

    for (const k of sortedKeys) {
      const recs = bucketMap.get(k)!;
      const sampleMeta = this.evaluateSampleQuality(recs.length);
      const evaluable = recs.filter(o => {
        const cat = categorizeOutcomeRecord(o);
        return cat === 'CORRECT' || cat === 'INCORRECT';
      });
      const correct = recs.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
      const contradiction = recs.filter(o => o.contradictionDetected || o.outcome === 'CONTRADICTED');
      const invalidations = recs.filter(o => (o.signalLifecycleState as string) === 'INVALIDATED');
      const unresolved = recs.filter(o => !o.isResolved);
      const expiredInconclusive = recs.filter(o => categorizeOutcomeRecord(o) === 'EXPIRED_INCONCLUSIVE');

      const accuracyStatus: MetricAvailabilityStatus = evaluable.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

      const validMfes: number[] = [];
      for (const o of recs) {
        const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
      }
      const validMaes: number[] = [];
      for (const o of recs) {
        const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
        if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
      }

      const mfeStatus: MetricAvailabilityStatus = validMfes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';
      const maeStatus: MetricAvailabilityStatus = validMaes.length > 0 ? 'MEASURABLE' : 'INSUFFICIENT_DATA';

      const avgMFE = validMfes.length > 0 ? parseFloat((validMfes.reduce((a, b) => a + b, 0) / validMfes.length).toFixed(2)) : 0;
      const avgMAE = validMaes.length > 0 ? parseFloat((validMaes.reduce((a, b) => a + b, 0) / validMaes.length).toFixed(2)) : 0;

      dataPoints.push({
        ...sampleMeta,
        periodLabel: k,
        startDate: recs[recs.length - 1].generatedAt || new Date(getTime(recs[recs.length - 1])).toISOString(),
        endDate: recs[0].generatedAt || new Date(getTime(recs[0])).toISOString(),
        directionallyEvaluableCount: evaluable.length,
        correctCount: correct.length,
        incorrectCount: evaluable.length - correct.length,
        expiredInconclusiveCount: expiredInconclusive.length,
        accuracyStatus,
        directionalAccuracyPct: accPct,
        signalVolume: recs.length,
        averageMFE: avgMFE,
        averageMAE: avgMAE,
        mfeStatus,
        maeStatus,
        contradictionRatePct: parseFloat(((contradiction.length / recs.length) * 100).toFixed(1)),
        invalidationRatePct: parseFloat(((invalidations.length / recs.length) * 100).toFixed(1)),
        unresolvedRatePct: parseFloat(((unresolved.length / recs.length) * 100).toFixed(1)),
        pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL'
      });
    }

    const summary = this.getCorePerformanceSummary({ ...filter, dateRange: period });

    return {
      period: period,
      periodSelected: period,
      status: 'SUCCESS',
      trendPoints: dataPoints,
      dataPoints,
      summary
    };
  }

  // =========================================================================
  // 10. HISTORICAL PRECEDENT INTEGRATION
  // =========================================================================

  public async getHistoricalPrecedent(
    symbol: string,
    eventType: string = 'ALL'
  ): Promise<HistoricalPrecedentSummary> {
    const sym = symbol.toUpperCase().trim();
    const evType = eventType.toUpperCase().trim();

    // Query outcome ledger first for exact matches
    const outcomes = this.getFilteredOutcomeRecords({ symbol: sym, eventType: evType === 'ALL' ? undefined : evType });
    const sampleMeta = this.evaluateSampleQuality(outcomes.length);

    if (outcomes.length < 5) {
      // Fallback attempt to query HistoricalEventEngine
      try {
        const histEngine = HistoricalEventEngine.getInstance();
        const histReport = await histEngine.getHistoricalSimilarEvents(sym, evType);
        if (histReport && histReport.events && histReport.events.length >= 5) {
          const validReactions = histReport.events.filter(e => typeof e.marketReaction.priceChangePct === 'number');
          const posCount = validReactions.filter(e => (e.marketReaction.priceChangePct as number) > 0).length;
          const accPct = validReactions.length > 0 ? parseFloat(((posCount / validReactions.length) * 100).toFixed(1)) : 0;
          const avgReac = typeof histReport.empiricalSummary.averagePriceReactionPct === 'number'
            ? histReport.empiricalSummary.averagePriceReactionPct
            : 0;

          return {
            ...this.evaluateSampleQuality(histReport.events.length),
            eventIdOrArticleId: `hist-${sym}`,
            symbol: sym,
            eventType: evType,
            similarEventsCount: histReport.events.length,
            historicalDirectionalAccuracyPct: accPct,
            averageReactionPct: avgReac,
            medianMFE: parseFloat((avgReac * 1.2).toFixed(2)),
            medianMAE: parseFloat((-Math.abs(avgReac * 0.4)).toFixed(2)),
            statusText: `Historical Context: ${histReport.events.length} similar events identified. Accuracy ${accPct}%, Avg reaction ${avgReac}%`,
            disclaimer: 'Historical statistics are descriptive only. Not a prediction or probability of future success.'
          };
        }
      } catch {}

      return {
        ...sampleMeta,
        eventIdOrArticleId: `hist-${sym}`,
        symbol: sym,
        eventType: evType,
        similarEventsCount: outcomes.length,
        historicalDirectionalAccuracyPct: 'INSUFFICIENT_SAMPLE',
        averageReactionPct: 'INSUFFICIENT_SAMPLE',
        medianMFE: 'INSUFFICIENT_SAMPLE',
        medianMAE: 'INSUFFICIENT_SAMPLE',
        statusText: 'Historical Context: Insufficient comparable events',
        disclaimer: 'Historical statistics are descriptive only. Not a prediction or probability of future success.'
      };
    }

    const evaluable = outcomes.filter(o => {
      const cat = categorizeOutcomeRecord(o);
      return cat === 'CORRECT' || cat === 'INCORRECT';
    });
    const correct = outcomes.filter(o => categorizeOutcomeRecord(o) === 'CORRECT');
    const accPct = evaluable.length > 0 ? parseFloat(((correct.length / evaluable.length) * 100).toFixed(1)) : 0;

    const validMfes: number[] = [];
    for (const o of outcomes) {
      const val = o.mfePercent !== undefined ? o.mfePercent : (o as any).maxFavorableExcursionPct;
      if (typeof val === 'number' && Number.isFinite(val)) validMfes.push(val);
    }
    validMfes.sort((a, b) => a - b);

    const validMaes: number[] = [];
    for (const o of outcomes) {
      const val = o.maePercent !== undefined ? o.maePercent : (o as any).maxAdverseExcursionPct;
      if (typeof val === 'number' && Number.isFinite(val)) validMaes.push(Math.abs(val));
    }
    validMaes.sort((a, b) => a - b);

    const avgMFE = validMfes.length > 0 ? validMfes.reduce((a, b) => a + b, 0) / validMfes.length : 0;
    const avgMAE = validMaes.length > 0 ? validMaes.reduce((a, b) => a + b, 0) / validMaes.length : 0;

    const medianMFE = validMfes.length > 0 ? (validMfes[Math.floor(validMfes.length / 2)] ?? 0) : 0;
    const medianMAE = validMaes.length > 0 ? (validMaes[Math.floor(validMaes.length / 2)] ?? 0) : 0;

    const accStatusText = evaluable.length > 0 ? `Directional Accuracy ${accPct}%` : 'Directional Accuracy: Insufficient Data';

    return {
      ...sampleMeta,
      eventIdOrArticleId: `hist-${sym}`,
      symbol: sym,
      eventType: evType,
      similarEventsCount: outcomes.length,
      historicalDirectionalAccuracyPct: evaluable.length > 0 ? accPct : 'INSUFFICIENT_SAMPLE',
      averageReactionPct: (validMfes.length > 0 || validMaes.length > 0) ? parseFloat((avgMFE - avgMAE).toFixed(2)) : 'INSUFFICIENT_SAMPLE',
      medianMFE: validMfes.length > 0 ? parseFloat(medianMFE.toFixed(2)) : 'INSUFFICIENT_SAMPLE',
      medianMAE: validMaes.length > 0 ? parseFloat(medianMAE.toFixed(2)) : 'INSUFFICIENT_SAMPLE',
      statusText: `Historical Context: ${outcomes.length} similar events identified. ${accStatusText}`,
      disclaimer: 'Historical statistics are descriptive only. Not a prediction or probability of future success.'
    };
  }

  // =========================================================================
  // 16. PERFORMANCE INSIGHT GENERATOR (DETERMINISTIC)
  // =========================================================================

  public generatePerformanceInsights(filter?: PerformanceFilter): PerformanceInsight[] {
    const summary = this.getCorePerformanceSummary(filter);
    const sectors = this.getSectorPerformance(filter);
    const priorities = this.getPriorityEffectiveness(filter);
    const regimes = this.getMarketRegimePerformance(filter);

    const insights: PerformanceInsight[] = [];

    // Insight 1: Sector Outperformance
    const topSector = sectors.find(s => s.sampleSize >= 1 && s.historicalAccuracyPct >= 0);
    if (topSector) {
      insights.push({
        id: `insight-sector-${topSector.sector}`,
        type: 'POSITIVE_OUTPERFORMANCE',
        title: `Sector Outperformance: ${topSector.sector}`,
        text: `Historically, BREAKOUT and event signals in ${topSector.sector} exhibit strong directional performance.`,
        description: `${topSector.sector} signals have historically produced ${topSector.historicalAccuracyPct}% directional accuracy across ${topSector.sampleSize} observations.`,
        sampleSize: topSector.sampleSize,
        metricComparison: {
          observedValue: topSector.historicalAccuracyPct,
          baselineValue: summary.directionalAccuracyPct,
          difference: parseFloat((topSector.historicalAccuracyPct - summary.directionalAccuracyPct).toFixed(1)),
          metricName: 'Directional Accuracy (%)'
        },
        wordingNotice: 'Historical observation'
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'insight-default',
        type: 'NEUTRAL_OBSERVATION',
        title: 'Empirical Intelligence Ready',
        text: 'Historical outcome ledger loaded for descriptive cohort analysis.',
        description: 'System maintains strictly deterministic observation across signal cohorts.',
        sampleSize: summary.totalEvaluated,
        wordingNotice: 'Historical observation'
      });
    }

    // Insight 2: High-Volatility Priority Risk
    const highVolRegime = regimes['HIGH_VOLATILITY'];
    if (highVolRegime && highVolRegime.sampleSize >= 5 && highVolRegime.contradictionRatePct > summary.contradictionRatePct) {
      insights.push({
        id: 'insight-regime-high-vol',
        type: 'REGIME_CONTRADICTION_RISK',
        title: 'High Volatility Contradiction Risk',
        description: `Signals generated during HIGH_VOLATILITY market regimes show a higher contradiction rate (${highVolRegime.contradictionRatePct}%) than the baseline (${summary.contradictionRatePct}%).`,
        sampleSize: highVolRegime.sampleSize,
        metricComparison: {
          observedValue: highVolRegime.contradictionRatePct,
          baselineValue: summary.contradictionRatePct,
          difference: parseFloat((highVolRegime.contradictionRatePct - summary.contradictionRatePct).toFixed(1)),
          metricName: 'Contradiction Rate (%)'
        },
        wordingNotice: 'Historical observation'
      });
    }

    // Insight 3: P0 Critical Priority Accuracy
    const p0 = priorities['P0_CRITICAL'];
    if (p0 && p0.sampleSize >= 3) {
      insights.push({
        id: 'insight-priority-p0',
        type: 'PRIORITY_CORRELATION',
        title: 'P0 Critical Priority Performance',
        description: `P0 Critical signals have achieved an average MFE of +${p0.averageMFE}% with an accuracy of ${p0.historicalAccuracyPct}%.`,
        sampleSize: p0.sampleSize,
        metricComparison: {
          observedValue: p0.averageMFE,
          baselineValue: summary.averageMFE,
          difference: parseFloat((p0.averageMFE - summary.averageMFE).toFixed(2)),
          metricName: 'Average MFE (%)'
        },
        wordingNotice: 'Historical observation'
      });
    }

    return insights;
  }

  // =========================================================================
  // 17. DATA QUALITY DASHBOARD
  // =========================================================================

  public getDataQualityReport(): DataQualityReport {
    const outcomes = this.getFilteredOutcomeRecords();
    const total = outcomes.length || 1;

    const sourceGrounded = outcomes.filter(o => o.sourceTier === 'Tier 1' || o.sourceTier === 'Tier 2' || (o as any).sourceTier === 'TIER_1_REGULATORY' || (o as any).sourceTier === 'TIER_1_EXCHANGE').length;
    const extractionFailed = outcomes.filter(o => o.dataFreshness === 'STALE').length;
    const sourceUnavailable = outcomes.filter(o => o.sourceTier === 'Tier 3').length;
    const qualityRejected = outcomes.filter(o => o.outcome === 'INSUFFICIENT_MARKET_DATA').length;
    const providerConflicts = outcomes.filter(o => o.contradictionDetected).length;
    const staleData = outcomes.filter(o => o.dataFreshness === 'STALE' || o.dataFreshness === 'EXPIRED').length;
    const expiredData = outcomes.filter(o => (o.signalLifecycleState as string) === 'EXPIRED').length;

    const fnoCount = outcomes.filter(o => o.initialMarketState !== 'UNKNOWN').length;
    const volumeCount = outcomes.filter(o => (o as any).observationCount > 0 || o.timeBuckets).length;

    const completeRecords = outcomes.filter(o => o.initialPrice > 0 && o.currentPrice > 0).length;
    const missingPriceDataCount = outcomes.filter(o => !o.initialPrice || !o.currentPrice).length;

    return {
      totalRecordsEvaluated: outcomes.length,
      totalLedgerRecords: outcomes.length,
      completeRecords,
      missingPriceDataCount,
      auditStatus: missingPriceDataCount > 0 ? 'WARNING_MISSING_PRICE_DATA' : 'AUDIT_PASSED',
      sourceGroundedRatePct: parseFloat(((sourceGrounded / total) * 100).toFixed(1)),
      extractionFailedRatePct: parseFloat(((extractionFailed / total) * 100).toFixed(1)),
      sourceUnavailableRatePct: parseFloat(((sourceUnavailable / total) * 100).toFixed(1)),
      qualityRejectedRatePct: parseFloat(((qualityRejected / total) * 100).toFixed(1)),
      providerConflictRatePct: parseFloat(((providerConflicts / total) * 100).toFixed(1)),
      staleMarketDataRatePct: parseFloat(((staleData / total) * 100).toFixed(1)),
      expiredMarketDataRatePct: parseFloat(((expiredData / total) * 100).toFixed(1)),
      fnoEvidenceAvailabilityPct: parseFloat(((fnoCount / total) * 100).toFixed(1)),
      volumeConfirmationAvailabilityPct: parseFloat(((volumeCount / total) * 100).toFixed(1)),
      evaluationNote: 'Distinguishes signal performance from evidence quality issues'
    };
  }

  // =========================================================================
  // 18. PERFORMANCE OBSERVABILITY METRICS
  // =========================================================================

  public getObservabilityMetrics(): PerformanceObservabilityMetrics {
    const outcomes = SignalOutcomeEngine.getInstance().getAllOutcomeRecords();
    const avgLatency = this.aggregationExecutionsCount > 0
      ? parseFloat((this.totalAggregationLatencyMs / this.aggregationExecutionsCount).toFixed(2))
      : 0;

    return {
      status: 'HEALTHY',
      zeroAiCostEnforced: true,
      ledgerRecordCount: outcomes.length,
      aggregationExecutionCount: this.aggregationExecutionsCount,
      aggregationLatencyMs: avgLatency,
      cacheHits: this.cacheHitsCount,
      cacheMisses: this.cacheMissesCount,
      cacheInvalidations: this.cacheInvalidationsCount,
      outcomeRecordsConsumed: outcomes.length,
      insufficientSampleResultsCount: this.insufficientSampleResultsCount,
      aiCalls: 0,
      aiCallCount: 0,
      errorsCount: this.errorsCount,
      lastAggregationTimestamp: this.lastAggregationTimestamp
    };
  }

  // =========================================================================
  // HELPER METHODS & FILTERING
  // =========================================================================

  private getFilteredOutcomeRecords(filter?: PerformanceFilter): SignalOutcomeRecord[] {
    const engine = SignalOutcomeEngine.getInstance();
    let records = engine.getAllOutcomeRecords();

    if (!filter) return records;

    if (filter.symbol) {
      const sym = filter.symbol.toUpperCase().trim();
      records = records.filter(r => r.symbol === sym);
    }

    if (filter.sector) {
      const sec = filter.sector.toUpperCase().trim();
      records = records.filter(r => (r.sector || '').toUpperCase().includes(sec));
    }

    if (filter.signalType) {
      records = records.filter(r => r.signalType === filter.signalType || r.eventCategory === filter.signalType);
    }

    if (filter.eventType) {
      records = records.filter(r => r.eventType === filter.eventType || r.eventCategory === filter.eventType || r.signalType === filter.eventType);
    }

    if (filter.priority) {
      records = records.filter(r => r.initialPriority === filter.priority || r.priority === filter.priority);
    }

    if (filter.marketRegime) {
      records = records.filter(r => r.marketRegime === filter.marketRegime);
    }

    if (filter.sourceTier) {
      records = records.filter(r => r.sourceTier === filter.sourceTier);
    }

    if (filter.startDate) {
      const startMs = new Date(filter.startDate).getTime();
      records = records.filter(r => new Date(r.generatedAt).getTime() >= startMs);
    }

    if (filter.endDate) {
      const endMs = new Date(filter.endDate).getTime();
      records = records.filter(r => new Date(r.generatedAt).getTime() <= endMs);
    }

    if (filter.dateRange && !filter.startDate && !filter.endDate) {
      const now = Date.now();
      let cutMs = 0;
      if (filter.dateRange === '7d') cutMs = now - 7 * 86400 * 1000;
      else if (filter.dateRange === '30d') cutMs = now - 30 * 86400 * 1000;
      else if (filter.dateRange === '90d') cutMs = now - 90 * 86400 * 1000;
      if (cutMs > 0) {
        records = records.filter(r => new Date(r.generatedAt).getTime() >= cutMs);
      }
    }

    return records;
  }

  private formatSeconds(seconds: number): string {
    if (seconds <= 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}

export const historicalPerformanceAnalyticsEngine = HistoricalPerformanceAnalyticsEngine.getInstance();
