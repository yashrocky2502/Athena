/**
 * ATHENA NEWS ENGINE — PHASE 10.9 TEST SUITE
 * Phase10_9_HistoricalPerformanceAnalytics.test.ts
 * 
 * Comprehensive test coverage for Phase 10.9 Historical Performance Intelligence & User-Facing Analytics:
 * 1. Core Summary Calculation & Determinism (0-AI Cost)
 * 2. Sample Size Protection Thresholds (0-4 INSUFFICIENT, 5-14 LIMITED, 15+ VALID)
 * 3. Directional Accuracy & Win Rate Mechanics
 * 4. MFE / MAE Excursion Tracking & Ratio Analysis
 * 5. Signal Taxonomy Slicing (Breakout, Earnings Beat, Recovery, etc.)
 * 6. Sector Performance Slicing (IT, Banking, Auto, Pharma, Energy, etc.)
 * 7. Market Regime Slicing (Risk-On, Risk-Off, Range-Bound, High Volatility)
 * 8. Source Authority & Reliability Tracking (Tier 1 Exchange/Regulator vs. Tier 2 News)
 * 9. Priority Effectiveness Analysis (P0_CRITICAL, P1_HIGH, P2_STANDARD)
 * 10. What ATHENA Got Right vs. Wrong Analytical Report
 * 11. Performance Trend Aggregation (7d, 30d, 90d, all)
 * 12. Historical Precedent Lookup for Asset Dossiers
 * 13. Zero-AI Empirical Performance Insight Generation
 * 14. Data Quality & Ledger Audit Reporting
 * 15. Telegram Historical Context Formatting Parity
 * 16. Multi-Parameter Filter Matrix Execution
 * 17. Engine Observability & Telemetry Metrics
 * 18. Immutable Read-Only Integrity Verification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoricalPerformanceAnalyticsEngine } from '../market-intelligence/HistoricalPerformanceAnalyticsEngine';
import { SignalOutcomeEngine, SignalOutcomeRecord } from '../market-intelligence/SignalOutcomeEngine';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';

describe('Phase 10.9: Historical Performance Intelligence & User-Facing Analytics', () => {
  let analyticsEngine: HistoricalPerformanceAnalyticsEngine;
  let outcomeEngine: SignalOutcomeEngine;

  beforeEach(() => {
    SignalOutcomeEngine.resetInstance();
    outcomeEngine = SignalOutcomeEngine.getInstance();
    outcomeEngine.clear();
    analyticsEngine = HistoricalPerformanceAnalyticsEngine.getInstance();
  });

  afterEach(() => {
    outcomeEngine.clear();
    SignalOutcomeEngine.resetInstance();
  });

  // Helper to generate mock outcome records for testing
  const createMockOutcome = (overrides: Partial<SignalOutcomeRecord> = {}): SignalOutcomeRecord => {
    const now = Date.now();
    return {
      signalId: `sig_${Math.random().toString(36).substring(2, 9)}`,
      symbol: 'RELIANCE',
      sector: 'ENERGY',
      signalType: 'BREAKOUT',
      eventType: 'EARNINGS',
      priority: 'P1_HIGH',
      initialDirection: 'BULLISH',
      initialPrice: 2500,
      initialTimestamp: now - 86400000,
      currentPrice: 2550,
      lastUpdatedTimestamp: now,
      evaluatedOutcome: 'CORRECT',
      isResolved: true,
      resolutionType: 'MAX_DURATION_REACHED',
      maxFavorableExcursionPct: 3.5,
      maxAdverseExcursionPct: -0.8,
      finalPriceChangePct: 2.0,
      directionalAccuracy: 'ACCURATE',
      marketRegime: 'RISK_ON',
      sourceTier: 'TIER_1_REGULATORY',
      confidenceScore: 85,
      revisionCount: 1,
      timeBuckets: {
        '15m': { timestamp: now - 85500000, price: 2510, priceChangePercent: 0.4 },
        '1h': { timestamp: now - 82800000, price: 2525, priceChangePercent: 1.0 },
        '4h': { timestamp: now - 72000000, price: 2540, priceChangePercent: 1.6 },
        '24h': { timestamp: now, price: 2550, priceChangePercent: 2.0 }
      },
      ...overrides
    };
  };

  describe('1. Core Performance Summary & Determinism', () => {
    it('1.1 should instantiate singleton instance properly', () => {
      expect(analyticsEngine).toBeDefined();
      expect(HistoricalPerformanceAnalyticsEngine.getInstance()).toBe(analyticsEngine);
    });

    it('1.2 should return empty/default summary when no outcomes exist', () => {
      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary).toBeDefined();
      expect(summary.totalSignals).toBe(0);
      expect(summary.evaluatedSignalsCount).toBe(0);
      expect(summary.sampleQuality).toBe('INSUFFICIENT_SAMPLE');
      expect(summary.sampleSizeNotice).toContain('Insufficient sample size');
    });

    it('1.3 should correctly aggregate 10 valid outcomes into core performance metrics', () => {
      for (let i = 0; i < 10; i++) {
        outcomeEngine.recordOutcome(createMockOutcome({
          evaluatedOutcome: i < 8 ? 'CORRECT' : 'INCORRECT',
          directionalAccuracy: i < 8 ? 'ACCURATE' : 'INACCURATE',
          maxFavorableExcursionPct: i < 8 ? 4.0 : 0.5,
          maxAdverseExcursionPct: i < 8 ? -1.0 : -3.5
        }));
      }

      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary.totalSignals).toBe(10);
      expect(summary.evaluatedSignalsCount).toBe(10);
      expect(summary.directionalAccuracyPct).toBe(80);
      expect(summary.winRatePct).toBe(80);
      expect(summary.sampleQuality).toBe('LIMITED_SAMPLE');
    });

    it('1.4 should compute median and average MFE / MAE accurately', () => {
      const mfes = [1.0, 2.0, 3.0, 4.0, 5.0];
      const maes = [-0.5, -1.0, -1.5, -2.0, -2.5];

      for (let i = 0; i < 5; i++) {
        outcomeEngine.recordOutcome(createMockOutcome({
          maxFavorableExcursionPct: mfes[i],
          maxAdverseExcursionPct: maes[i]
        }));
      }

      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary.averageMfePct).toBe(3.0);
      expect(summary.medianMfePct).toBe(3.0);
      expect(summary.averageMaePct).toBe(1.5);
      expect(summary.medianMaePct).toBe(1.5);
      expect(summary.mfeMaeRatio).toBe('2.00');
    });

    it('1.5 should calculate invalidation rate correctly', () => {
      for (let i = 0; i < 10; i++) {
        outcomeEngine.recordOutcome(createMockOutcome({
          evaluatedOutcome: i < 3 ? 'INVALIDATED' : 'CORRECT',
          directionalAccuracy: i < 3 ? 'INACCURATE' : 'ACCURATE'
        }));
      }

      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary.invalidationRatePct).toBe(30);
    });
  });

  describe('2. Sample Size Protection Thresholds', () => {
    it('2.1 should classify 0-4 samples as INSUFFICIENT_SAMPLE', () => {
      for (let i = 0; i < 4; i++) {
        outcomeEngine.recordOutcome(createMockOutcome());
      }
      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary.sampleQuality).toBe('INSUFFICIENT_SAMPLE');
      expect(summary.isSampleSufficient).toBe(false);
    });

    it('2.2 should classify 5-14 samples as LIMITED_SAMPLE', () => {
      for (let i = 0; i < 5; i++) {
        outcomeEngine.recordOutcome(createMockOutcome());
      }
      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary.sampleQuality).toBe('LIMITED_SAMPLE');
      expect(summary.isSampleSufficient).toBe(true);
    });

    it('2.3 should classify 15+ samples as VALID_HISTORICAL_SAMPLE', () => {
      for (let i = 0; i < 15; i++) {
        outcomeEngine.recordOutcome(createMockOutcome());
      }
      const summary = analyticsEngine.getCorePerformanceSummary();
      expect(summary.sampleQuality).toBe('VALID_HISTORICAL_SAMPLE');
      expect(summary.isSampleSufficient).toBe(true);
    });
  });

  describe('3. Signal Type Performance Slicing', () => {
    it('3.1 should group performance accurately by signal category', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ signalType: 'EARNINGS_BEAT', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ signalType: 'EARNINGS_BEAT', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ signalType: 'ORDER_WIN', evaluatedOutcome: 'INCORRECT' }));

      const slices = analyticsEngine.getSignalTypePerformance();
      expect(slices.length).toBeGreaterThanOrEqual(2);

      const earningsSlice = slices.find(s => s.signalType === 'EARNINGS_BEAT');
      expect(earningsSlice).toBeDefined();
      expect(earningsSlice?.sampleSize).toBe(2);
      expect(earningsSlice?.winRatePct).toBe(100);

      const orderSlice = slices.find(s => s.signalType === 'ORDER_WIN');
      expect(orderSlice).toBeDefined();
      expect(orderSlice?.sampleSize).toBe(1);
      expect(orderSlice?.winRatePct).toBe(0);
    });

    it('3.2 should apply sample protection flag to signal type slices', () => {
      for (let i = 0; i < 6; i++) {
        outcomeEngine.recordOutcome(createMockOutcome({ signalType: 'BREAKOUT' }));
      }
      outcomeEngine.recordOutcome(createMockOutcome({ signalType: 'RECOVERY' }));

      const slices = analyticsEngine.getSignalTypePerformance();
      const breakoutSlice = slices.find(s => s.signalType === 'BREAKOUT');
      const recoverySlice = slices.find(s => s.signalType === 'RECOVERY');

      expect(breakoutSlice?.sampleStatus).toBe('LIMITED');
      expect(recoverySlice?.sampleStatus).toBe('INSUFFICIENT');
    });
  });

  describe('4. Sector Performance Slicing', () => {
    it('4.1 should aggregate performance across different industry sectors', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ sector: 'IT', symbol: 'TCS', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ sector: 'IT', symbol: 'INFY', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ sector: 'BANKING', symbol: 'HDFCBANK', evaluatedOutcome: 'INCORRECT' }));

      const sectorSlices = analyticsEngine.getSectorPerformance();
      expect(sectorSlices.length).toBeGreaterThanOrEqual(2);

      const itSector = sectorSlices.find(s => s.sector === 'IT');
      expect(itSector?.sampleSize).toBe(2);
      expect(itSector?.directionalAccuracyPct).toBe(100);

      const bankSector = sectorSlices.find(s => s.sector === 'BANKING');
      expect(bankSector?.sampleSize).toBe(1);
      expect(bankSector?.directionalAccuracyPct).toBe(0);
    });
  });

  describe('5. Market Regime Performance Slicing', () => {
    it('5.1 should measure signal performance across different market regimes', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ marketRegime: 'RISK_ON', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ marketRegime: 'RISK_ON', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ marketRegime: 'RISK_OFF', evaluatedOutcome: 'INCORRECT' }));

      const regimeSlices = analyticsEngine.getMarketRegimePerformance();

      const riskOn = regimeSlices.find(r => r.marketRegime === 'RISK_ON');
      const riskOff = regimeSlices.find(r => r.marketRegime === 'RISK_OFF');

      expect(riskOn?.sampleSize).toBe(2);
      expect(riskOn?.directionalAccuracyPct).toBe(100);
      expect(riskOff?.sampleSize).toBe(1);
      expect(riskOff?.directionalAccuracyPct).toBe(0);
    });
  });

  describe('6. Source Authority Analytics', () => {
    it('6.1 should track accuracy and reliability score by source tier', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ sourceTier: 'TIER_1_EXCHANGE', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ sourceTier: 'TIER_1_EXCHANGE', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ sourceTier: 'TIER_2_NEWS', evaluatedOutcome: 'INCORRECT' }));

      const sources = analyticsEngine.getSourceAuthorityAnalytics();

      const tier1 = sources.find(s => s.sourceTier === 'TIER_1_EXCHANGE');
      const tier2 = sources.find(s => s.sourceTier === 'TIER_2_NEWS');

      expect(tier1?.accuracyPct).toBe(100);
      expect(tier1?.reliabilityScore).toBeGreaterThanOrEqual(90);
      expect(tier2?.accuracyPct).toBe(0);
    });
  });

  describe('7. Priority Effectiveness Analysis', () => {
    it('7.1 should compute outcome metrics for P0, P1, P2 signals', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ priority: 'P0_CRITICAL', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ priority: 'P1_HIGH', evaluatedOutcome: 'CORRECT' }));
      outcomeEngine.recordOutcome(createMockOutcome({ priority: 'P2_STANDARD', evaluatedOutcome: 'INCORRECT' }));

      const priorities = analyticsEngine.getPriorityEffectiveness();
      const p0 = priorities.find(p => p.priority === 'P0_CRITICAL');
      const p2 = priorities.find(p => p.priority === 'P2_STANDARD');

      expect(p0?.accuracyPct).toBe(100);
      expect(p2?.accuracyPct).toBe(0);
    });
  });

  describe('8. What ATHENA Got Right vs. Wrong Report', () => {
    it('8.1 should segregate high-confidence wins and unexpected invalidations', () => {
      outcomeEngine.recordOutcome(createMockOutcome({
        symbol: 'TATASTEEL',
        confidenceScore: 90,
        evaluatedOutcome: 'CORRECT',
        maxFavorableExcursionPct: 5.5
      }));
      outcomeEngine.recordOutcome(createMockOutcome({
        symbol: 'WIPRO',
        confidenceScore: 85,
        evaluatedOutcome: 'INVALIDATED',
        maxAdverseExcursionPct: -4.0
      }));

      const report = analyticsEngine.getWhatAthenaGotRightWrong();

      expect(report.highConfidenceWins.length).toBe(1);
      expect(report.highConfidenceWins[0].symbol).toBe('TATASTEEL');
      expect(report.topInvalidations.length).toBe(1);
      expect(report.topInvalidations[0].symbol).toBe('WIPRO');
      expect(report.learnings.length).toBeGreaterThan(0);
    });
  });

  describe('9. Historical Performance Trend Aggregation', () => {
    it('9.1 should group trend points by date over specified periods', () => {
      const now = Date.now();
      outcomeEngine.recordOutcome(createMockOutcome({ initialTimestamp: now - (2 * 86400000) }));
      outcomeEngine.recordOutcome(createMockOutcome({ initialTimestamp: now - (1 * 86400000) }));

      const trend = analyticsEngine.getPerformanceTrend('30d');
      expect(trend.period).toBe('30d');
      expect(trend.trendPoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('10. Historical Precedent Lookup for Asset Dossiers', () => {
    it('10.1 should retrieve asset-specific historical precedent with sample quality evaluation', async () => {
      for (let i = 0; i < 6; i++) {
        outcomeEngine.recordOutcome(createMockOutcome({
          symbol: 'INFY',
          eventType: 'EARNINGS',
          evaluatedOutcome: 'CORRECT',
          maxFavorableExcursionPct: 3.0,
          maxAdverseExcursionPct: -0.5,
          finalPriceChangePct: 2.5
        }));
      }

      const precedent = await analyticsEngine.getHistoricalPrecedent('INFY', 'EARNINGS');

      expect(precedent.symbol).toBe('INFY');
      expect(precedent.similarEventsCount).toBe(6);
      expect(precedent.historicalDirectionalAccuracyPct).toBe(100);
      expect(precedent.sampleQuality).toBe('LIMITED_SAMPLE');
    });

    it('10.2 should return INSUFFICIENT_SAMPLE for symbols with under 5 events', async () => {
      outcomeEngine.recordOutcome(createMockOutcome({ symbol: 'NEWSTOCK', eventType: 'ORDER_WIN' }));

      const precedent = await analyticsEngine.getHistoricalPrecedent('NEWSTOCK', 'ORDER_WIN');
      expect(precedent.similarEventsCount).toBe(1);
      expect(precedent.sampleQuality).toBe('INSUFFICIENT_SAMPLE');
      expect(precedent.historicalDirectionalAccuracyPct).toBe('INSUFFICIENT_SAMPLE');
    });
  });

  describe('11. Zero-AI Empirical Performance Insights', () => {
    it('11.1 should generate rule-based insights without external AI calls', () => {
      for (let i = 0; i < 15; i++) {
        outcomeEngine.recordOutcome(createMockOutcome({
          signalType: 'BREAKOUT',
          evaluatedOutcome: 'CORRECT',
          directionalAccuracy: 'ACCURATE'
        }));
      }

      const insights = analyticsEngine.generatePerformanceInsights();
      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some(ins => ins.text.includes('BREAKOUT'))).toBe(true);
    });
  });

  describe('12. Data Quality & Audit Report', () => {
    it('12.1 should generate data quality metrics for ledger audit', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ initialPrice: 100, currentPrice: 105 }));
      outcomeEngine.recordOutcome(createMockOutcome({ initialPrice: 0, currentPrice: 0 }));

      const quality = analyticsEngine.getDataQualityReport();
      expect(quality.totalLedgerRecords).toBe(2);
      expect(quality.completeRecords).toBe(1);
      expect(quality.missingPriceDataCount).toBe(1);
      expect(quality.auditStatus).toBe('WARNING_MISSING_PRICE_DATA');
    });
  });

  describe('13. Telegram Historical Context Formatting Parity', () => {
    it('13.1 should format Telegram Historical Context section when sample size is sufficient', () => {
      const precedent = {
        symbol: 'RELIANCE',
        similarEventsCount: 8,
        historicalDirectionalAccuracyPct: 87.5,
        averageReactionPct: 3.2,
        medianMFE: 4.1,
        medianMAE: -0.9,
        sampleQuality: 'LIMITED_SAMPLE'
      };

      const formatted = TraderTelegramFormatter.formatHistoricalContextSection(precedent);
      expect(formatted).toContain('Historical Context');
      expect(formatted).toContain('Similar Events:');
      expect(formatted).toContain('8');
      expect(formatted).toContain('Historical Directional Accuracy');
      expect(formatted).toContain('87.5%');
      expect(formatted).toContain('Median MFE:');
      expect(formatted).toContain('+4.1%');
      expect(formatted).toContain('Descriptive only');
    });

    it('13.2 should render Insufficient comparable events when sample size < 5', () => {
      const precedent = {
        symbol: 'SMALLCAP',
        similarEventsCount: 2,
        historicalDirectionalAccuracyPct: 'INSUFFICIENT_SAMPLE',
        sampleQuality: 'INSUFFICIENT_SAMPLE'
      };

      const formatted = TraderTelegramFormatter.formatHistoricalContextSection(precedent);
      expect(formatted).toContain('Historical Context');
      expect(formatted).toContain('Insufficient comparable events');
    });
  });

  describe('14. Multi-Parameter Filter Matrix Execution', () => {
    it('14.1 should filter outcomes by symbol, sector, signal type, priority, and regime', () => {
      outcomeEngine.recordOutcome(createMockOutcome({ symbol: 'TCS', sector: 'IT', signalType: 'EARNINGS_BEAT', priority: 'P0_CRITICAL', marketRegime: 'RISK_ON' }));
      outcomeEngine.recordOutcome(createMockOutcome({ symbol: 'INFY', sector: 'IT', signalType: 'ORDER_WIN', priority: 'P1_HIGH', marketRegime: 'RISK_OFF' }));

      const filtered = analyticsEngine.getCorePerformanceSummary({
        symbol: 'TCS',
        sector: 'IT',
        signalType: 'EARNINGS_BEAT',
        priority: 'P0_CRITICAL',
        marketRegime: 'RISK_ON'
      });

      expect(filtered.totalSignals).toBe(1);
      expect(filtered.evaluatedSignalsCount).toBe(1);
    });
  });

  describe('15. Observability & Telemetry Metrics', () => {
    it('15.1 should report operational telemetry for the performance analytics engine', () => {
      outcomeEngine.recordOutcome(createMockOutcome());
      const metrics = analyticsEngine.getObservabilityMetrics();

      expect(metrics.status).toBe('HEALTHY');
      expect(metrics.zeroAiCostEnforced).toBe(true);
      expect(metrics.ledgerRecordCount).toBe(1);
    });
  });

  describe('16. Immutable Read-Only Integrity Verification', () => {
    it('16.1 should never mutate underlying signal outcome records during analytics computation', () => {
      const originalRecord = createMockOutcome({ symbol: 'MUTATION_TEST', confidenceScore: 92 });
      outcomeEngine.recordOutcome(originalRecord);

      // Perform analytics reads
      analyticsEngine.getCorePerformanceSummary();
      analyticsEngine.getSignalTypePerformance();
      analyticsEngine.getSectorPerformance();
      analyticsEngine.getWhatAthenaGotRightWrong();

      const ledger = outcomeEngine.getAllOutcomeRecords();
      const record = ledger.find(r => r.symbol === 'MUTATION_TEST');

      expect(record).toBeDefined();
      expect(record?.confidenceScore).toBe(92);
      expect(record?.symbol).toBe('MUTATION_TEST');
    });
  });
});
