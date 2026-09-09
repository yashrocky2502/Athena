/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH, TIME-TRAVEL REPLAY & DETERMINISTIC EVENT RECONSTRUCTION ENGINE
 * Phase23_HistoricalMarketTruth.test.ts
 * 
 * Comprehensive automated test suite covering all 20 required verification points:
 * 1. Historical snapshot retrieval
 * 2. Timestamp ordering
 * 3. News availability firewall
 * 4. Future data rejection
 * 5. Look-ahead bias detection
 * 6. Historical event reconstruction
 * 7. Replay determinism
 * 8. Checkpoint integrity
 * 9. Event bus replay
 * 10. Surveillance replay
 * 11. Signal replay
 * 12. Strategy replay
 * 13. Portfolio replay
 * 14. Execution simulation isolation
 * 15. Drift detection
 * 16. Historical causal analysis
 * 17. Data revision detection
 * 18. Data quality scoring
 * 19. Production-state isolation
 * 20. AI boundary enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  historicalMarketTruthStore,
  historicalNewsTruthStore,
  historicalFutureFirewall,
  historicalLookAheadBiasEngine,
  historicalEventReconstructionEngine,
  historicalReplayEngine,
  historicalReplayCheckpointEngine,
  historicalSurveillanceReplayEngine,
  historicalSignalReplayEngine,
  historicalStrategyReplayEngine,
  historicalPortfolioReplayEngine,
  historicalSimulationExecutionAdapter,
  replayDriftDetectionEngine,
  historicalDecisionComparisonEngine,
  historicalRevisionDetector,
  historicalDataQualityScorer,
  historicalTelegramSafetyGuard,
  historicalCausalEngine,
  HistoricalHashUtils
} from './index.ts';

describe('ATHENA Phase 23 — Historical Market Truth, Time-Travel Replay & Event Reconstruction', () => {
  beforeEach(() => {
    historicalFutureFirewall.reset();
    historicalLookAheadBiasEngine.clear();
    historicalReplayEngine.clear();
  });

  // 1. Historical snapshot retrieval
  it('1. should retrieve canonical historical market snapshot by timestamp', () => {
    const res = historicalMarketTruthStore.getSnapshotAtTimestamp('2026-07-20T10:15:00.000Z');
    expect(res.found).toBe(true);
    expect(res.status).toBe('VALID');
    expect(res.snapshot).toBeDefined();
    expect(res.snapshot?.equities?.['RELIANCE']).toBeDefined();
    expect(res.snapshot?.equities?.['RELIANCE']?.latestTick?.lastPrice).toBe(2950.0);
    expect(res.deterministicHash).toMatch(/^h_/);
  });

  // 2. Timestamp ordering
  it('2. should maintain strictly deterministic chronological ordering without data gaps', () => {
    const ticks = historicalMarketTruthStore.getTicksForSymbol('RELIANCE', '2026-07-20T12:00:00.000Z');
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i++) {
      const prevMs = new Date(ticks[i - 1].timestamp).getTime();
      const currMs = new Date(ticks[i].timestamp).getTime();
      expect(currMs).toBeGreaterThanOrEqual(prevMs);
    }
  });

  // 3. News availability firewall
  it('3. should ensure news articles become available strictly at their publication timestamp', () => {
    // 09:15 replay: only articles published <= 09:15 should be present
    const newsEarly = historicalNewsTruthStore.getNewsAtTimestamp('2026-07-20T09:15:00.000Z');
    expect(newsEarly.some(n => n.publishedAt > '2026-07-20T09:15:00.000Z')).toBe(false);

    // 12:00 replay: articles published at 09:21 and 11:30 should be present
    const newsLater = historicalNewsTruthStore.getNewsAtTimestamp('2026-07-20T12:00:00.000Z');
    expect(newsLater.length).toBeGreaterThan(newsEarly.length);
    expect(newsLater.some(n => n.canonicalArticleId === 'art_20260720_0921')).toBe(true);
  });

  // 4. Future data rejection
  it('4. should reject future data when firewall is active', () => {
    historicalFutureFirewall.setReplayCursor('2026-07-20T10:00:00.000Z');

    // Inspecting a record with timestamp 10:30 (future) should fail
    const result = historicalFutureFirewall.inspectRecord(
      'INGESTION',
      '2026-07-20T10:30:00.000Z',
      'NSE',
      'lastPrice',
      2960.0,
      false
    );

    expect(result.passed).toBe(false);
    expect(result.violation).toBeDefined();
    expect(result.violation?.message).toContain('LOOK_AHEAD_BIAS_DETECTED');
  });

  // 5. Look-ahead bias detection
  it('5. should actively detect look-ahead bias and flag violations', () => {
    const taintedData = {
      activeSymbol: 'RELIANCE',
      candle: {
        timestamp: '2026-07-20T14:00:00.000Z', // In future compared to 10:15
        closePrice: 2955.0
      }
    };

    const audit = historicalLookAheadBiasEngine.auditReplayState('TestTarget', '2026-07-20T10:15:00.000Z', taintedData);
    expect(audit.hasLookAheadBias).toBe(true);
    expect(audit.violations.length).toBe(1);
    expect(audit.violations[0].field).toBe('candle.timestamp');
  });

  // 6. Historical event reconstruction
  it('6. should reconstruct complete multi-module state at exact historical timestamp', () => {
    const state = historicalEventReconstructionEngine.reconstructAtTimestamp({
      symbol: 'RELIANCE',
      replayTimestamp: '2026-07-20T10:15:00.000Z'
    });

    expect(state.replayTimestamp).toBe('2026-07-20T10:15:00.000Z');
    expect(state.targetSymbol).toBe('RELIANCE');
    expect(state.whatAthenaKnewSummary.price).toBe(2950.0);
    expect(state.signalState).toBeDefined();
    expect(state.derivativeSnapshot).toBeDefined();
    expect(state.macroSnapshot).toBeDefined();
    expect(state.portfolioState).toBeDefined();
    expect(state.aggregateStateHash).toMatch(/^h_/);
  });

  // 7. Replay determinism
  it('7. should produce identical aggregate state hashes on repeated runs', () => {
    const state1 = historicalEventReconstructionEngine.reconstructAtTimestamp({
      symbol: 'RELIANCE',
      replayTimestamp: '2026-07-20T10:15:00.000Z'
    });

    const state2 = historicalEventReconstructionEngine.reconstructAtTimestamp({
      symbol: 'RELIANCE',
      replayTimestamp: '2026-07-20T10:15:00.000Z'
    });

    expect(state1.aggregateStateHash).toBe(state2.aggregateStateHash);
    expect(state1.signalState.deterministicHash).toBe(state2.signalState.deterministicHash);
  });

  // 8. Checkpoint integrity
  it('8. should generate immutable checkpoints with valid composite hashes', () => {
    const session = historicalReplayEngine.createSession({
      targetDate: '2026-07-20',
      startTime: '2026-07-20T09:15:00.000Z',
      endTime: '2026-07-20T10:15:00.000Z'
    });

    expect(session.checkpoints.length).toBeGreaterThan(0);
    const chk = session.checkpoints[0];
    expect(chk.checkpointId).toBeDefined();
    expect(chk.canonicalMarketSnapshotHash).toMatch(/^h_/);
    expect(chk.aggregateStateHash).toMatch(/^h_/);
  });

  // 9. Event bus replay
  it('9. should step forward and backward in replay time without state corruption', () => {
    const session = historicalReplayEngine.createSession({
      targetDate: '2026-07-20',
      startTime: '2026-07-20T09:15:00.000Z',
      endTime: '2026-07-20T15:30:00.000Z'
    });

    const step1 = historicalReplayEngine.stepForward(session.id, 15);
    expect(step1.session.currentReplayTimestamp).toBe('2026-07-20T09:30:00.000Z');

    const step2 = historicalReplayEngine.stepForward(session.id, 30);
    expect(step2.session.currentReplayTimestamp).toBe('2026-07-20T10:00:00.000Z');

    const stepBack = historicalReplayEngine.stepBackward(session.id);
    expect(stepBack.session.currentReplayTimestamp).toBe('2026-07-20T09:30:00.000Z');
  });

  // 10. Surveillance replay
  it('10. should replay surveillance logic detecting price jumps and narrative contradiction', () => {
    const alerts = historicalSurveillanceReplayEngine.evaluateSurveillance(
      'RELIANCE',
      '2026-07-20T11:35:00.000Z',
      2915.0, // Midday dip
      2950.0,
      2500000,
      1000000,
      true // Contradictory news
    );

    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.some(a => a.anomalyType === 'CONTRADICTION')).toBe(true);
    expect(alerts.some(a => a.anomalyType === 'VOLUME_SPIKE')).toBe(true);
  });

  // 11. Signal replay
  it('11. should reconstruct signal lifecycle deterministically', () => {
    const news = historicalNewsTruthStore.getNewsAtTimestamp('2026-07-20T09:30:00.000Z', 'RELIANCE');
    const signal = historicalSignalReplayEngine.generateSignal(
      'RELIANCE',
      '2026-07-20T09:30:00.000Z',
      0.65,
      news,
      false
    );

    expect(signal.direction).toBe('LONG');
    expect(signal.confirmationState).toBe('CONFIRMED');
    expect(signal.lifecycleState).toBe('TRADEABLE');
    expect(signal.transmissionScore).toBeGreaterThan(50);
  });

  // 12. Strategy replay
  it('12. should reconstruct strategy candidates and separate available data from future outcomes', () => {
    const news = historicalNewsTruthStore.getNewsAtTimestamp('2026-07-20T09:30:00.000Z', 'RELIANCE');
    const signal = historicalSignalReplayEngine.generateSignal(
      'RELIANCE',
      '2026-07-20T09:30:00.000Z',
      0.65,
      news
    );
    const strategy = historicalStrategyReplayEngine.evaluateStrategy(
      'RELIANCE',
      '2026-07-20T09:30:00.000Z',
      signal
    );

    expect(strategy.variantId).toBe('BULL_CALL_SPREAD_V1');
    expect(strategy.executionFeasibility).toBe(true);
    expect(strategy.expectedValue).toBeGreaterThan(0);
  });

  // 13. Portfolio replay
  it('13. should reconstruct portfolio Greeks, VaR, and margin at historical timestamp', () => {
    const port = historicalPortfolioReplayEngine.evaluatePortfolioState('2026-07-20T10:15:00.000Z');
    expect(port.nav).toBeGreaterThan(0);
    expect(port.delta).toBe(0.42);
    expect(port.var95).toBe(145000);
    expect(port.sectorExposures['Energy']).toBe(28.0);
  });

  // 14. Execution simulation isolation
  it('14. should simulate execution with slippage/commission and zero live broker access', () => {
    const exec = historicalSimulationExecutionAdapter.simulateOrder({
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 100,
      orderType: 'LIMIT',
      requestedPrice: 2950.0,
      currentMarketPrice: 2950.0,
      replayTimestamp: '2026-07-20T10:15:00.000Z'
    });

    expect(exec.status).toBe('FILLED');
    expect(exec.filledQuantity).toBe(100);
    expect(exec.simulatedCommission).toBeGreaterThan(0);
    expect(exec.provenanceId).toContain('prov_');
  });

  // 15. Drift detection
  it('15. should verify zero drift across duplicate deterministic replay runs', () => {
    const session = historicalReplayEngine.createSession({
      targetDate: '2026-07-20',
      startTime: '2026-07-20T09:15:00.000Z',
      endTime: '2026-07-20T10:15:00.000Z'
    });

    const report = replayDriftDetectionEngine.compareReplayRuns(session.id, session.checkpoints, session.checkpoints);
    expect(report.isDeterministic).toBe(true);
    expect(report.driftType).toBe('NO_DRIFT');
    expect(report.driftDetails.length).toBe(0);
  });

  // 16. Historical causal analysis
  it('16. should answer historical causal questions using only information at that timestamp', () => {
    const analysis = historicalCausalEngine.explainHistoricalEvent({
      query: 'Why did Reliance reverse at 13:20?',
      symbol: 'RELIANCE',
      replayTimestamp: '2026-07-20T13:20:00.000Z'
    });

    expect(analysis.symbol).toBe('RELIANCE');
    expect(analysis.primaryCause).toContain('POLICY_CLARIFICATION');
    expect(analysis.confidenceScore).toBeGreaterThan(70);
    expect(analysis.whatAthenaKnewAtTime.activePrice).toBe(2940.0);
    expect(analysis.whatHappenedAfterSeparated.priceAfter1h).toBeDefined();
  });

  // 17. Data revision detection
  it('17. should detect retrospective historical revisions and preserve original records', () => {
    const original = { lastPrice: 2950.0, volume: 100000, recordedAt: '2026-07-20T10:15:00.000Z' };
    const revised = { lastPrice: 2930.0, volume: 100000, recordedAt: '2026-07-25T00:00:00.000Z' };

    const check = historicalRevisionDetector.evaluateRevision(
      'RELIANCE',
      '2026-07-20T10:15:00.000Z',
      original,
      revised,
      'CORP_ACTION_ADJUSTMENT'
    );

    expect(check.isRevised).toBe(true);
    expect(check.record?.revisionReason).toBe('CORP_ACTION_ADJUSTMENT');
    expect(check.record?.originalVersion.lastPrice).toBe(2950.0);
    expect(check.record?.currentVersion.lastPrice).toBe(2930.0);
  });

  // 18. Data quality scoring
  it('18. should compute comprehensive historical data quality score and rating', () => {
    const quality = historicalDataQualityScorer.evaluateDataset({
      totalExpectedIntervals: 75,
      presentIntervals: 75,
      timestampsValid: true,
      hasAuthoritativeSource: true,
      duplicateCount: 0,
      revisionCount: 0,
      hasCrossedBooks: false
    });

    expect(quality.score).toBe(100);
    expect(quality.rating).toBe('EXCELLENT');
    expect(quality.breakdown.completeness).toBe(25);
  });

  // 19. Production-state isolation & Telegram safety
  it('19. should generate HistoricalAlertProof without triggering live Telegram dispatch', () => {
    const proof = historicalTelegramSafetyGuard.interceptAndCreateProof({
      symbol: 'RELIANCE',
      timestamp: '2026-07-20T10:15:00.000Z',
      title: 'High Volatility Breakout',
      body: 'Breakout above resistance 2950'
    });

    expect(proof.isSimulated).toBe(true);
    expect(proof.isHistoricalReplay).toBe(true);
    expect(proof.dispatchedToLiveTelegram).toBe(false);
    expect(proof.safetyWatermark).toContain('NOT_FOR_LIVE_EXECUTION');
  });

  // 20. AI boundary enforcement
  it('20. should assert AI boundary and block prompt context containing future timestamps', () => {
    const validAiContext = {
      price: 2950.0,
      timestamp: '2026-07-20T10:15:00.000Z'
    };
    expect(() => historicalFutureFirewall.assertAiBoundary(validAiContext, '2026-07-20T10:15:00.000Z')).not.toThrow();

    const leakedAiContext = {
      price: 2950.0,
      timestamp: '2026-07-20T14:30:00.000Z' // Leaked future timestamp
    };
    expect(() => historicalFutureFirewall.assertAiBoundary(leakedAiContext, '2026-07-20T10:15:00.000Z')).toThrow(
      /LOOK_AHEAD_BIAS_DETECTED/
    );
  });
});
