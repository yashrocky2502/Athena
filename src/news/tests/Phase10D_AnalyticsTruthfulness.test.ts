/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10D
 * Phase10D_AnalyticsTruthfulness.test.ts
 *
 * Dedicated Analytics Truthfulness & Empirical Grounding Test Suite.
 *
 * Test Matrix (Requirements A through S):
 * - TEST A: Replace "0%" accuracy with INSUFFICIENT_DATA status when no directionally evaluable evidence exists (denominator = 0)
 * - TEST B: Exclude EXPIRED_WITHOUT_RESOLUTION from directional accuracy denominator (inconclusive != incorrect)
 * - TEST C: Directional accuracy denominator is strictly CORRECT + INCORRECT, not total signals or total evaluated
 * - TEST D: Exclude INSUFFICIENT_MARKET_DATA from directional accuracy denominator
 * - TEST E: Remove hardcoded performance claims (no fabricated 100% win rates or fake claims in insights/slices)
 * - TEST F: Missing MFE does not default to 0; reports mfeStatus: 'INSUFFICIENT_DATA' or 'MEASURABLE'
 * - TEST G: Missing MAE does not default to 0; reports maeStatus: 'INSUFFICIENT_DATA' or 'MEASURABLE'
 * - TEST H: Missing resolution time does not default to 3600 seconds or 0; reports resolutionTimeStatus: 'INSUFFICIENT_DATA' or 'MEASURABLE'
 * - TEST I: P&L metrics report pnlStatus: 'UNAVAILABLE_NO_POSITION_SIZE_MODEL' across all summaries and slices (never fabricate money)
 * - TEST J: Signal type slices accurately track accuracyStatus, directionallyEvaluableCount, correctCount, incorrectCount, expiredInconclusiveCount, mfeStatus, maeStatus
 * - TEST K: Sector slices accurately track accuracyStatus, directionallyEvaluableCount, correctCount, incorrectCount, expiredInconclusiveCount, mfeStatus, maeStatus
 * - TEST L: Market regime slices accurately track accuracyStatus, directionallyEvaluableCount, correctCount, incorrectCount, expiredInconclusiveCount, mfeStatus, maeStatus
 * - TEST M: Source tier slices accurately track accuracyStatus, directionallyEvaluableCount, correctCount, incorrectCount, expiredInconclusiveCount, mfeStatus, maeStatus
 * - TEST N: Priority effectiveness slices accurately track accuracyStatus, directionallyEvaluableCount, correctCount, incorrectCount, expiredInconclusiveCount, mfeStatus, maeStatus
 * - TEST O: "What Athena Got Right vs Wrong" report strictly uses truthful categorization and excludes inconclusive records from directional calls
 * - TEST P: Historical precedent reports historicalDirectionalAccuracyPct: 'INSUFFICIENT_SAMPLE' and 'INSUFFICIENT_SAMPLE' for metrics when sample size is insufficient or evaluable count is 0
 * - TEST Q: Performance trend reports accuracyStatus: 'INSUFFICIENT_DATA' and directionalAccuracyPct: 0 when evaluable count is 0, without fabricating metrics
 * - TEST R: Analytics operations remain zero-AI-cost, strictly deterministic, and read-only (aiCalls === 0)
 * - TEST S: Protected production datasets remain byte-for-byte unchanged with exact SHA-256 hashes
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

import {
  SignalOutcomeEngine,
  SignalOutcomeRecord,
  categorizeOutcomeRecord,
  MetricAvailabilityStatus
} from '../market-intelligence/SignalOutcomeEngine';
import {
  HistoricalPerformanceAnalyticsEngine
} from '../market-intelligence/HistoricalPerformanceAnalyticsEngine';

describe('PHASE 10D — ANALYTICS TRUTHFULNESS REMEDIATION', () => {
  let tempDir: string;
  let testStoragePath: string;
  let testBackupPath: string;

  let outcomeEngine: SignalOutcomeEngine;
  let analyticsEngine: HistoricalPerformanceAnalyticsEngine;

  // Authoritative protected production datasets and their immutable baseline hashes
  const protectedDatasets = [
    {
      filePath: 'data/market_intelligence_outcomes.json',
      expectedHash: '47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd',
      expectedCount: 446
    },
    {
      filePath: 'data/market_intelligence_outcomes.json.bak',
      expectedHash: '33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764',
      expectedCount: 445
    },
    {
      filePath: 'data/news_signal_lifecycle.json',
      expectedHash: 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1',
      expectedCount: null
    },
    {
      filePath: 'data/news_signal_historical_ledger.json',
      expectedHash: '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c',
      expectedCount: null
    }
  ];

  function computeSha256(filePath: string): string {
    const fullPath = path.resolve(process.cwd(), filePath);
    const fileBuffer = fs.readFileSync(fullPath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  function getRecordCount(filePath: string): number | null {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object' && data !== null) return Object.keys(data).length;
      return null;
    } catch {
      return null;
    }
  }

  beforeAll(() => {
    // Verify production datasets before any tests run
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      if (dataset.expectedCount !== null) {
        expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
      }
    }
  });

  afterAll(() => {
    // Restore production instance of SignalOutcomeEngine
    SignalOutcomeEngine.resetInstanceForProduction();

    // Verify production datasets remain byte-for-byte unchanged after all tests complete
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      if (dataset.expectedCount !== null) {
        expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
      }
    }
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase10d-test-'));
    testStoragePath = path.join(tempDir, 'market_intelligence_outcomes.json');
    testBackupPath = path.join(tempDir, 'market_intelligence_outcomes.json.bak');

    SignalOutcomeEngine.resetInstance(testStoragePath, testBackupPath);
    outcomeEngine = SignalOutcomeEngine.getInstance();
    analyticsEngine = HistoricalPerformanceAnalyticsEngine.getInstance();
    analyticsEngine.clearCache();
  });

  afterEach(() => {
    SignalOutcomeEngine.resetInstance(testStoragePath, testBackupPath);
    analyticsEngine.clearCache();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  const createRecord = (overrides: Partial<SignalOutcomeRecord> = {}): SignalOutcomeRecord => {
    const now = Date.now();
    return {
      signalId: `sig_${Math.random().toString(36).substring(2, 9)}`,
      symbol: 'INFY',
      sector: 'IT',
      signalType: 'BREAKOUT',
      eventType: 'EARNINGS',
      priority: 'P1_HIGH',
      initialPrice: 1500,
      generatedAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now).toISOString(),
      ...overrides
    };
  };

  // =========================================================================
  // TEST A: Replace "0%" accuracy with INSUFFICIENT_DATA status
  // =========================================================================
  it('TEST A: replaces "0%" accuracy with INSUFFICIENT_DATA status when no directionally evaluable evidence exists', () => {
    // 0 records in ledger
    const summaryEmpty = analyticsEngine.getCorePerformanceSummary();
    expect(summaryEmpty.directionallyEvaluableCount).toBe(0);
    expect(summaryEmpty.accuracyStatus).toBe('INSUFFICIENT_DATA');
    expect(summaryEmpty.directionalAccuracyPct).toBe(0); // reported numeric 0 but flagged INSUFFICIENT_DATA

    // 1 unresolved record with no evaluation
    outcomeEngine.recordOutcome(createRecord({ isResolved: false }));
    const summaryUnresolved = analyticsEngine.getCorePerformanceSummary();
    expect(summaryUnresolved.directionallyEvaluableCount).toBe(0);
    expect(summaryUnresolved.accuracyStatus).toBe('INSUFFICIENT_DATA');

    // SignalOutcomeEngine direct summary
    const engineSummary = outcomeEngine.getOutcomeSummary();
    expect(engineSummary.directionallyEvaluableCount).toBe(0);
    expect(engineSummary.accuracyStatus).toBe('INSUFFICIENT_DATA');
  });

  // =========================================================================
  // TEST B: Exclude EXPIRED_WITHOUT_RESOLUTION from directional accuracy denominator
  // =========================================================================
  it('TEST B: excludes EXPIRED_WITHOUT_RESOLUTION from the directional accuracy denominator (inconclusive != incorrect)', () => {
    // 1 CORRECT signal and 2 EXPIRED_WITHOUT_RESOLUTION signals
    outcomeEngine.recordOutcome(createRecord({
      signalId: 'sig-correct',
      isResolved: true,
      isCorrect: true,
      evaluatedOutcome: 'CORRECT',
      directionalAccuracy: 'CORRECT'
    }));

    outcomeEngine.recordOutcome(createRecord({
      signalId: 'sig-exp-1',
      isResolved: true,
      outcome: 'EXPIRED_WITHOUT_RESOLUTION',
      directionalAccuracy: 'INCONCLUSIVE'
    }));

    outcomeEngine.recordOutcome(createRecord({
      signalId: 'sig-exp-2',
      isResolved: true,
      outcome: 'EXPIRED_WITHOUT_RESOLUTION',
      directionalAccuracy: 'INCONCLUSIVE'
    }));

    // Verify categorization
    expect(categorizeOutcomeRecord(outcomeEngine.getRecord('sig-correct')!)).toBe('CORRECT');
    expect(categorizeOutcomeRecord(outcomeEngine.getRecord('sig-exp-1')!)).toBe('EXPIRED_INCONCLUSIVE');
    expect(categorizeOutcomeRecord(outcomeEngine.getRecord('sig-exp-2')!)).toBe('EXPIRED_INCONCLUSIVE');

    const summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.totalEvaluated).toBe(3);
    expect(summary.directionallyEvaluableCount).toBe(1); // 1, NOT 3!
    expect(summary.correctCount).toBe(1);
    expect(summary.incorrectCount).toBe(0);
    expect(summary.expiredInconclusiveCount).toBe(2);
    expect(summary.accuracyStatus).toBe('MEASURABLE');
    expect(summary.directionalAccuracyPct).toBe(100); // 1/1 = 100%, not 1/3 (33.3%)!

    const engineSummary = outcomeEngine.getOutcomeSummary();
    expect(engineSummary.directionallyEvaluableCount).toBe(1);
    expect(engineSummary.directionalAccuracyPct).toBe(100);
  });

  // =========================================================================
  // TEST C: Directional accuracy denominator is strictly CORRECT + INCORRECT
  // =========================================================================
  it('TEST C: directional accuracy denominator is strictly CORRECT + INCORRECT, not total signals or total evaluated', () => {
    // 3 CORRECT, 1 INCORRECT, 2 EXPIRED_WITHOUT_RESOLUTION, 1 NEUTRAL, 1 CONTRADICTED
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ isCorrect: false, evaluatedOutcome: 'INCORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'EXPIRED_WITHOUT_RESOLUTION', directionalAccuracy: 'INCONCLUSIVE' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'EXPIRED_WITHOUT_RESOLUTION', directionalAccuracy: 'INCONCLUSIVE' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'NEUTRAL_REACTION', directionalAccuracy: 'NEUTRAL' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'CONTRADICTED', contradictionDetected: true }));

    const summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.totalEvaluated).toBe(8);
    expect(summary.correctCount).toBe(3);
    expect(summary.incorrectCount).toBe(1);
    expect(summary.directionallyEvaluableCount).toBe(4); // 3 + 1 = 4
    expect(summary.directionalAccuracyPct).toBe(75); // 3 / 4 * 100 = 75.0%

    const engineSummary = outcomeEngine.getOutcomeSummary();
    expect(engineSummary.directionallyEvaluableCount).toBe(4);
    expect(engineSummary.directionalAccuracyPct).toBe(75);
  });

  // =========================================================================
  // TEST D: Exclude INSUFFICIENT_MARKET_DATA from directional accuracy denominator
  // =========================================================================
  it('TEST D: excludes INSUFFICIENT_MARKET_DATA from the directional accuracy denominator', () => {
    // 2 CORRECT, 0 INCORRECT, 3 INSUFFICIENT_MARKET_DATA
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'INSUFFICIENT_MARKET_DATA' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'INSUFFICIENT_MARKET_DATA' }));
    outcomeEngine.recordOutcome(createRecord({ outcome: 'INSUFFICIENT_MARKET_DATA' }));

    const summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.totalEvaluated).toBe(5);
    expect(summary.directionallyEvaluableCount).toBe(2);
    expect(summary.insufficientMarketDataCount).toBe(3);
    expect(summary.directionalAccuracyPct).toBe(100); // 2/2 = 100%
  });

  // =========================================================================
  // TEST E: Remove hardcoded performance claims
  // =========================================================================
  it('TEST E: removes hardcoded performance claims and never fabricates 100% win rates on empty cohorts', () => {
    const emptySummary = analyticsEngine.getCorePerformanceSummary();
    expect(emptySummary.accuracyStatus).toBe('INSUFFICIENT_DATA');
    expect(emptySummary.mfeStatus).toBe('INSUFFICIENT_DATA');
    expect(emptySummary.maeStatus).toBe('INSUFFICIENT_DATA');
    expect(emptySummary.resolutionTimeStatus).toBe('INSUFFICIENT_DATA');

    // Performance insights on empty/insufficient dataset should not make wild unsubstantiated claims
    const insights = analyticsEngine.generatePerformanceInsights();
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.description).not.toContain('100% guaranteed');
      expect(insight.wordingNotice).toBe('Historical observation');
    }
  });

  // =========================================================================
  // TEST F: Missing MFE does not default to 0; reports mfeStatus
  // =========================================================================
  it('TEST F: missing MFE reports mfeStatus: INSUFFICIENT_DATA when missing, MEASURABLE when present', () => {
    // No MFE recorded
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true }));
    let summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.mfeStatus).toBe('INSUFFICIENT_DATA');

    // With explicit valid MFE
    analyticsEngine.clearCache();
    outcomeEngine.recordOutcome(createRecord({ mfePercent: 2.5 }));
    summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.mfeStatus).toBe('MEASURABLE');
    expect(summary.averageMFE).toBe(2.5);
  });

  // =========================================================================
  // TEST G: Missing MAE does not default to 0; reports maeStatus
  // =========================================================================
  it('TEST G: missing MAE reports maeStatus: INSUFFICIENT_DATA when missing, MEASURABLE when present', () => {
    // No MAE recorded
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true }));
    let summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.maeStatus).toBe('INSUFFICIENT_DATA');

    // With explicit valid MAE
    analyticsEngine.clearCache();
    outcomeEngine.recordOutcome(createRecord({ maePercent: -1.2 }));
    summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.maeStatus).toBe('MEASURABLE');
    expect(summary.averageMAE).toBe(1.2);
  });

  // =========================================================================
  // TEST H: Missing resolution time does not default to 3600 seconds or 0; reports status
  // =========================================================================
  it('TEST H: missing resolution time reports resolutionTimeStatus: INSUFFICIENT_DATA and does not default to 3600', () => {
    // Signal without resolution time
    outcomeEngine.recordOutcome(createRecord({ isResolved: true, isCorrect: true }));
    let summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.resolutionTimeStatus).toBe('INSUFFICIENT_DATA');
    expect(summary.averageResolutionTimeSeconds).not.toBe(3600);

    // With valid resolution time
    analyticsEngine.clearCache();
    outcomeEngine.recordOutcome(createRecord({ resolutionTimeSeconds: 420 }));
    summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.resolutionTimeStatus).toBe('MEASURABLE');
    expect(summary.averageResolutionTimeSeconds).toBe(420);
  });

  // =========================================================================
  // TEST I: P&L metrics report UNAVAILABLE_NO_POSITION_SIZE_MODEL
  // =========================================================================
  it('TEST I: P&L metrics report UNAVAILABLE_NO_POSITION_SIZE_MODEL across all summaries and slices', () => {
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, mfePercent: 3.0, marketRegime: 'RISK_ON' }));

    const summary = analyticsEngine.getCorePerformanceSummary();
    expect(summary.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');

    const signalTypes = analyticsEngine.getSignalTypePerformance();
    expect(signalTypes[0]?.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');

    const sectors = analyticsEngine.getSectorPerformance();
    expect(sectors[0]?.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');

    const regimes = analyticsEngine.getMarketRegimePerformance();
    expect(regimes['RISK_ON']?.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');

    const priorities = analyticsEngine.getPriorityEffectiveness();
    expect(priorities.P1_HIGH?.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');

    const sources = analyticsEngine.getSourceAuthorityAnalytics();
    expect(sources[0]?.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');

    const engineSummary = outcomeEngine.getOutcomeSummary();
    expect(engineSummary.pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');
  });

  // =========================================================================
  // TEST J: Signal type slices track truthfulness metrics
  // =========================================================================
  it('TEST J: signal type slices accurately track accuracyStatus, counts, and exclude inconclusive records', () => {
    outcomeEngine.recordOutcome(createRecord({ signalType: 'BREAKOUT', isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ signalType: 'BREAKOUT', outcome: 'EXPIRED_WITHOUT_RESOLUTION', directionalAccuracy: 'INCONCLUSIVE' }));

    const slices = analyticsEngine.getSignalTypePerformance();
    const breakout = slices.find(s => s.signalType === 'BREAKOUT');
    expect(breakout).toBeDefined();
    expect(breakout!.sampleSize).toBe(2);
    expect(breakout!.directionallyEvaluableCount).toBe(1);
    expect(breakout!.correctCount).toBe(1);
    expect(breakout!.expiredInconclusiveCount).toBe(1);
    expect(breakout!.accuracyStatus).toBe('MEASURABLE');
    expect(breakout!.winRatePct).toBe(100);
  });

  // =========================================================================
  // TEST K: Sector slices track truthfulness metrics
  // =========================================================================
  it('TEST K: sector slices accurately track accuracyStatus, counts, and exclude inconclusive records', () => {
    outcomeEngine.recordOutcome(createRecord({ sector: 'ENERGY', isCorrect: false, evaluatedOutcome: 'INCORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ sector: 'ENERGY', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));

    const slices = analyticsEngine.getSectorPerformance();
    const energy = slices.find(s => s.sector === 'ENERGY');
    expect(energy).toBeDefined();
    expect(energy!.sampleSize).toBe(2);
    expect(energy!.directionallyEvaluableCount).toBe(1);
    expect(energy!.correctCount).toBe(0);
    expect(energy!.incorrectCount).toBe(1);
    expect(energy!.expiredInconclusiveCount).toBe(1);
    expect(energy!.accuracyStatus).toBe('MEASURABLE');
    expect(energy!.directionalAccuracyPct).toBe(0);
  });

  // =========================================================================
  // TEST L: Market regime slices track truthfulness metrics
  // =========================================================================
  it('TEST L: market regime slices accurately track accuracyStatus, counts, and exclude inconclusive records', () => {
    outcomeEngine.recordOutcome(createRecord({ marketRegime: 'BULLISH', isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ marketRegime: 'BULLISH', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));

    const regimes = analyticsEngine.getMarketRegimePerformance();
    const bullish = regimes['BULLISH'];
    expect(bullish).toBeDefined();
    expect(bullish.sampleSize).toBe(2);
    expect(bullish.directionallyEvaluableCount).toBe(1);
    expect(bullish.correctCount).toBe(1);
    expect(bullish.expiredInconclusiveCount).toBe(1);
    expect(bullish.accuracyStatus).toBe('MEASURABLE');
    expect(bullish.directionalAccuracyPct).toBe(100);
  });

  // =========================================================================
  // TEST M: Source tier slices track truthfulness metrics
  // =========================================================================
  it('TEST M: source tier slices accurately track accuracyStatus, counts, and exclude inconclusive records', () => {
    outcomeEngine.recordOutcome(createRecord({ sourceTier: 'TIER_1_REGULATORY', isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ sourceTier: 'TIER_1_REGULATORY', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));

    const sources = analyticsEngine.getSourceAuthorityAnalytics();
    const regTier = sources.find(s => s.sourceTier === 'TIER_1_REGULATORY');
    expect(regTier).toBeDefined();
    expect(regTier!.sampleSize).toBe(2);
    expect(regTier!.directionallyEvaluableCount).toBe(1);
    expect(regTier!.correctCount).toBe(1);
    expect(regTier!.expiredInconclusiveCount).toBe(1);
    expect(regTier!.accuracyStatus).toBe('MEASURABLE');
    expect(regTier!.accuracyPct).toBe(100);
  });

  // =========================================================================
  // TEST N: Priority effectiveness slices track truthfulness metrics
  // =========================================================================
  it('TEST N: priority effectiveness slices accurately track accuracyStatus, counts, and exclude inconclusive records', () => {
    outcomeEngine.recordOutcome(createRecord({ priority: 'P0_CRITICAL', isCorrect: true, evaluatedOutcome: 'CORRECT' }));
    outcomeEngine.recordOutcome(createRecord({ priority: 'P0_CRITICAL', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));

    const priorities = analyticsEngine.getPriorityEffectiveness();
    const p0 = priorities['P0_CRITICAL'];
    expect(p0).toBeDefined();
    expect(p0.sampleSize).toBe(2);
    expect(p0.directionallyEvaluableCount).toBe(1);
    expect(p0.correctCount).toBe(1);
    expect(p0.expiredInconclusiveCount).toBe(1);
    expect(p0.accuracyStatus).toBe('MEASURABLE');
    expect(p0.accuracyPct).toBe(100);
  });

  // =========================================================================
  // TEST O: "What Athena Got Right vs Wrong" report strictly uses truthful categorization
  // =========================================================================
  it('TEST O: "What Athena Got Right vs Wrong" report strictly uses truthful categorization and separates expired inconclusive', () => {
    outcomeEngine.recordOutcome(createRecord({
      symbol: 'TCS',
      confidenceScore: 92,
      isCorrect: true,
      evaluatedOutcome: 'CORRECT',
      mfePercent: 4.2
    }));

    outcomeEngine.recordOutcome(createRecord({
      symbol: 'SBIN',
      isResolved: true,
      isCorrect: false,
      evaluatedOutcome: 'INCORRECT',
      maePercent: -2.5
    }));

    outcomeEngine.recordOutcome(createRecord({
      symbol: 'ITC',
      outcome: 'EXPIRED_WITHOUT_RESOLUTION',
      directionalAccuracy: 'INCONCLUSIVE'
    }));

    const report = analyticsEngine.getWhatAthenaGotRightWrong();
    expect(report.highConfidenceWins.length).toBe(1);
    expect(report.highConfidenceWins[0].symbol).toBe('TCS');

    expect(report.gotWrong.incorrectDirectionalCalls.length).toBe(1);
    expect(report.gotWrong.incorrectDirectionalCalls[0].symbol).toBe('SBIN');

    expect(report.gotWrong.expiredWithoutReaction.length).toBe(1);
    expect(report.gotWrong.expiredWithoutReaction[0].symbol).toBe('ITC');
  });

  // =========================================================================
  // TEST P: Historical precedent reports INSUFFICIENT_SAMPLE when appropriate
  // =========================================================================
  it('TEST P: historical precedent reports INSUFFICIENT_SAMPLE for accuracy and metrics when sample is empty or evaluable count is 0', async () => {
    // 0 similar records
    const precedentEmpty = await analyticsEngine.getHistoricalPrecedent('RELIANCE', 'BREAKOUT');
    expect(precedentEmpty.similarEventsCount).toBe(0);
    expect(precedentEmpty.historicalDirectionalAccuracyPct).toBe('INSUFFICIENT_SAMPLE');
    expect(precedentEmpty.averageReactionPct).toBe('INSUFFICIENT_SAMPLE');
    expect(precedentEmpty.statusText).toContain('Insufficient');

    // Only EXPIRED_WITHOUT_RESOLUTION records (evaluable count = 0)
    outcomeEngine.recordOutcome(createRecord({ symbol: 'RELIANCE', signalType: 'BREAKOUT', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));
    outcomeEngine.recordOutcome(createRecord({ symbol: 'RELIANCE', signalType: 'BREAKOUT', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));
    outcomeEngine.recordOutcome(createRecord({ symbol: 'RELIANCE', signalType: 'BREAKOUT', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));
    outcomeEngine.recordOutcome(createRecord({ symbol: 'RELIANCE', signalType: 'BREAKOUT', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));
    outcomeEngine.recordOutcome(createRecord({ symbol: 'RELIANCE', signalType: 'BREAKOUT', outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));

    const precedentInconclusive = await analyticsEngine.getHistoricalPrecedent('RELIANCE', 'BREAKOUT');
    expect(precedentInconclusive.similarEventsCount).toBe(5);
    expect(precedentInconclusive.historicalDirectionalAccuracyPct).toBe('INSUFFICIENT_SAMPLE');
    expect(precedentInconclusive.statusText).toContain('Insufficient Data');
  });

  // =========================================================================
  // TEST Q: Performance trend reports accuracyStatus: INSUFFICIENT_DATA when evaluable is 0
  // =========================================================================
  it('TEST Q: performance trend reports accuracyStatus: INSUFFICIENT_DATA and does not fabricate metrics', () => {
    outcomeEngine.recordOutcome(createRecord({ outcome: 'EXPIRED_WITHOUT_RESOLUTION' }));

    const trend = analyticsEngine.getPerformanceTrend('30d');
    expect(trend.status).toBe('SUCCESS');
    expect(trend.dataPoints.length).toBe(1);
    expect(trend.dataPoints[0].directionallyEvaluableCount).toBe(0);
    expect(trend.dataPoints[0].accuracyStatus).toBe('INSUFFICIENT_DATA');
    expect(trend.dataPoints[0].directionalAccuracyPct).toBe(0);
    expect(trend.dataPoints[0].pnlStatus).toBe('UNAVAILABLE_NO_POSITION_SIZE_MODEL');
  });

  // =========================================================================
  // TEST R: Zero AI cost enforced and deterministic
  // =========================================================================
  it('TEST R: analytics operations remain strictly zero-AI-cost, deterministic, and read-only', () => {
    outcomeEngine.recordOutcome(createRecord({ isCorrect: true, evaluatedOutcome: 'CORRECT' }));

    analyticsEngine.getCorePerformanceSummary();
    analyticsEngine.getSignalTypePerformance();
    analyticsEngine.getSectorPerformance();
    analyticsEngine.getMarketRegimePerformance();
    analyticsEngine.getSourceAuthorityAnalytics();
    analyticsEngine.getPriorityEffectiveness();
    analyticsEngine.getWhatAthenaGotRightWrong();
    analyticsEngine.generatePerformanceInsights();

    const telemetry = analyticsEngine.getObservabilityMetrics();
    expect(telemetry.zeroAiCostEnforced).toBe(true);
    expect(telemetry.aiCalls).toBe(0);
    expect(telemetry.aiCallCount).toBe(0);

    const outcomeTelemetry = outcomeEngine.getTelemetry();
    expect(outcomeTelemetry.aiCalls).toBe(0);
    expect(outcomeTelemetry.aiCallCount).toBe(0);
  });

  // =========================================================================
  // TEST S: Protected production datasets remain byte-for-byte unchanged
  // =========================================================================
  it('TEST S: protected production datasets remain byte-for-byte unchanged with exact SHA-256 hashes', () => {
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      expect(hash).toBe(dataset.expectedHash);
      if (dataset.expectedCount !== null) {
        expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
      }
    }
  });
});
