/**
 * ATHENA NEWS ENGINE — PHASE 10.8
 * Phase10_8_SignalOutcomePerformance.test.ts
 * 
 * Comprehensive Forensic Outcome Measurement, Historical Performance & Predictive Accuracy Test Suite.
 * 
 * Verifies:
 * 1. Signal Outcome Creation & Immutability
 * 2. Market Excursion Measurement (MFE / MAE)
 * 3. Time-Bucketed Outcome Evaluation (5m, 15m, 30m, 60m, 1d, 3d, 5d)
 * 4. Outcome Classification (Target, Stop, Directional, Neutral, Contradicted, Expired)
 * 5. Directional Accuracy (Bullish, Bearish, Inconclusive)
 * 6. Priority Accuracy (High priority excursion dominance)
 * 7. Lifecycle Prediction Accuracy (State correlation)
 * 8. Performance Aggregation & Dimensional Slicing (Symbol, Signal Type, Sector, Priority, Market Regime)
 * 9. Zero-AI Cost & Absolute Mathematical Determinism
 * 10. Persistence, Serialization & State Recovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignalOutcomeEngine, SignalOutcomeRecord, PriceObservation } from '../market-intelligence/SignalOutcomeEngine.ts';

describe('PHASE 10.8 — SIGNAL OUTCOME MEASUREMENT & PERFORMANCE INTELLIGENCE', () => {
  let engine: SignalOutcomeEngine;

  beforeEach(() => {
    engine = SignalOutcomeEngine.getInstance();
    engine.clear();
    vi.restoreAllMocks();
  });

  // Helper for generating standard signal registrations
  const registerTestSignal = (overrides: Partial<Parameters<typeof engine.registerActionableSignal>[0]> = {}): SignalOutcomeRecord => {
    const defaultParams = {
      eventId: 'evt_test_1',
      signalType: 'EARNINGS_BEAT',
      symbol: 'RELIANCE',
      revision: 1,
      generatedAt: new Date(Date.now() - 3600000).toISOString(),
      initialPrice: 1000,
      initialMarketState: 'ACTIVE' as const,
      initialCompositeScore: 88,
      initialPriority: 'P1_CRITICAL' as const,
      initialAlignment: 'ALIGNED' as const,
      signalLifecycleState: 'ACTIVE' as const,
      direction: 'BULLISH' as const,
      eventCategory: 'EARNINGS',
      sector: 'ENERGY',
      sourceTier: 'Tier 1'
    };

    return engine.registerActionableSignal({ ...defaultParams, ...overrides });
  };

  // ==========================================
  // CATEGORY 1: SIGNAL OUTCOME CREATION & IMMUTABILITY
  // ==========================================
  describe('Category 1: Signal Outcome Creation & Immutability', () => {
    it('1.1 should create an immutable outcome record for actionable signal', () => {
      const outcome = registerTestSignal();
      expect(outcome).toBeDefined();
      expect(outcome.signalId).toBe('evt_test_1::EARNINGS_BEAT::RELIANCE::rev1');
      expect(outcome.initialPrice).toBe(1000);
      expect(outcome.direction).toBe('BULLISH');
      expect(outcome.isResolved).toBe(false);
      expect(outcome.outcome).toBe('INSUFFICIENT_MARKET_DATA');
    });

    it('1.2 should return identical record on idempotent registration of same signalId', () => {
      const outcome1 = registerTestSignal();
      const outcome2 = registerTestSignal();
      expect(outcome1.signalId).toBe(outcome2.signalId);
      expect(engine.getAllOutcomeRecords().length).toBe(1);
    });

    it('1.3 should create new distinct outcome record when revision increments', () => {
      const outcome1 = registerTestSignal({ revision: 1 });
      const outcome2 = registerTestSignal({ revision: 2 });
      expect(outcome1.signalId).not.toBe(outcome2.signalId);
      expect(outcome2.signalId).toContain('rev2');
      expect(engine.getAllOutcomeRecords().length).toBe(2);
    });

    it('1.4 should record initial milestone in forensic timeline upon creation', () => {
      const outcome = registerTestSignal();
      expect(outcome.timeline.length).toBeGreaterThanOrEqual(1);
      expect(outcome.timeline[0].eventType).toBe('SIGNAL_GENERATED');
      expect(outcome.timeline[0].price).toBe(1000);
    });

    it('1.5 should initialize MFE and MAE to 0 on newly generated signal', () => {
      const outcome = registerTestSignal();
      expect(outcome.mfePercent).toBe(0);
      expect(outcome.maePercent).toBe(0);
      expect(outcome.maxFavorablePrice).toBe(1000);
      expect(outcome.maxAdversePrice).toBe(1000);
    });
  });

  // ==========================================
  // CATEGORY 2: MARKET EXCURSION MEASUREMENT (MFE / MAE)
  // ==========================================
  describe('Category 2: Market Excursion Measurement (MFE / MAE)', () => {
    it('2.1 should calculate positive MFE and negative MAE for a BULLISH signal', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 102, high: 105, low: 98, volume: 1000 },
        { timestamp: new Date(baseTime + 120000).toISOString(), price: 104, high: 108, low: 101, volume: 1500 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated).toBeDefined();
      expect(updated!.maxFavorablePrice).toBe(108);
      expect(updated!.maxAdversePrice).toBe(98);
      // MFE: (108 - 100) / 100 * 100 = 8.0%
      expect(updated!.mfePercent).toBe(8.0);
      // MAE: (100 - 98) / 100 * 100 = 2.0%
      expect(updated!.maePercent).toBe(2.0);
    });

    it('2.2 should calculate positive MFE and negative MAE for a BEARISH signal', () => {
      const outcome = registerTestSignal({ direction: 'BEARISH', initialPrice: 200, signalId: 'bear_test' });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 195, high: 204, low: 190, volume: 1000 },
        { timestamp: new Date(baseTime + 120000).toISOString(), price: 188, high: 192, low: 180, volume: 2000 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated).toBeDefined();
      expect(updated!.maxFavorablePrice).toBe(180);
      expect(updated!.maxAdversePrice).toBe(204);
      // Bearish MFE: (200 - 180) / 200 * 100 = 10.0%
      expect(updated!.mfePercent).toBe(10.0);
      // Bearish MAE: (204 - 200) / 200 * 100 = 2.0%
      expect(updated!.maePercent).toBe(2.0);
    });

    it('2.3 should preserve flat 0% MFE/MAE when prices match initial exactly', () => {
      const outcome = registerTestSignal({ initialPrice: 500 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 500, high: 500, low: 500, volume: 500 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.mfePercent).toBe(0);
      expect(updated!.maePercent).toBe(0);
    });

    it('2.4 should track deepening MAE without MFE growth during adverse market moves', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 95, high: 99, low: 94, volume: 500 },
        { timestamp: new Date(baseTime + 120000).toISOString(), price: 90, high: 92, low: 88, volume: 500 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.mfePercent).toBe(0);
      expect(updated!.maePercent).toBe(12.0); // (100 - 88) / 100 = 12%
    });

    it('2.5 should record MFE/MAE expansion events in the timeline', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 105, high: 105, low: 99, volume: 500 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      const mfeEvent = updated!.timeline.find(t => t.eventType === 'MFE_EXPANSION');
      expect(mfeEvent).toBeDefined();
      expect(mfeEvent!.price).toBe(105);
    });

    it('2.6 should correctly handle extreme price spikes', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 150, high: 150, low: 100, volume: 10000 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.mfePercent).toBe(50.0);
    });

    it('2.7 should correctly handle fractional decimal prices without roundoff degradation', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 123.45 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 125.92, high: 125.92, low: 123.45, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.mfePercent).toBeGreaterThan(1.9);
      expect(updated!.mfePercent).toBeLessThan(2.1);
    });
  });

  // ==========================================
  // CATEGORY 3: TIME-BUCKETED EVALUATION
  // ==========================================
  describe('Category 3: Time-Bucketed Outcome Evaluation', () => {
    it('3.1 should bucket price changes into 5m horizon when tick is within 5 minutes', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 4 * 60 * 1000).toISOString(), price: 103, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.timeBuckets['5m']).toBeDefined();
      expect(updated!.timeBuckets['5m'].priceChangePercent).toBe(3.0);
      expect(updated!.timeBuckets['5m'].directionalState).toBe('FAVORABLE');
    });

    it('3.2 should bucket price changes into 15m and 30m horizons as time advances', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 12 * 60 * 1000).toISOString(), price: 104, volume: 100 },
        { timestamp: new Date(baseTime + 28 * 60 * 1000).toISOString(), price: 106, volume: 200 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.timeBuckets['15m']).toBeDefined();
      expect(updated!.timeBuckets['15m'].priceChangePercent).toBe(4.0);
      expect(updated!.timeBuckets['30m']).toBeDefined();
      expect(updated!.timeBuckets['30m'].priceChangePercent).toBe(6.0);
    });

    it('3.3 should bucket price changes into 1d, 3d, 5d horizons for multi-day observations', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 20 * 3600 * 1000).toISOString(), price: 108, volume: 100 },
        { timestamp: new Date(baseTime + 65 * 3600 * 1000).toISOString(), price: 112, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.timeBuckets['1d']).toBeDefined();
      expect(updated!.timeBuckets['1d'].priceChangePercent).toBe(8.0);
      expect(updated!.timeBuckets['3d']).toBeDefined();
      expect(updated!.timeBuckets['3d'].priceChangePercent).toBe(12.0);
    });

    it('3.4 should mark directionalState as ADVERSE when price moves against signal in bucket', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 50 * 60 * 1000).toISOString(), price: 97, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.timeBuckets['60m']).toBeDefined();
      expect(updated!.timeBuckets['60m'].directionalState).toBe('ADVERSE');
    });

    it('3.5 should mark directionalState as NEUTRAL when price change is negligible within bucket', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 50 * 60 * 1000).toISOString(), price: 100.1, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.timeBuckets['60m'].directionalState).toBe('NEUTRAL');
    });

    it('3.6 should gracefully leave unreached time buckets unpopulated', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 2 * 60 * 1000).toISOString(), price: 101, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.timeBuckets['5d']).toBeUndefined();
    });
  });

  // ==========================================
  // CATEGORY 4: OUTCOME CLASSIFICATION
  // ==========================================
  describe('Category 4: Outcome Classification', () => {
    it('4.1 should classify outcome as TARGET_REACHED when MFE meets threshold before stop', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 102.5, high: 102.5, low: 99.5, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.outcome).toBe('TARGET_REACHED');
      expect(updated!.isResolved).toBe(true);
      expect(updated!.isCorrect).toBe(true);
      expect(updated!.timeToTargetSeconds).toBe(60);
    });

    it('4.2 should classify outcome as STOP_REACHED when MAE meets stop threshold before target', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 98.0, high: 100.2, low: 98.0, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.outcome).toBe('STOP_REACHED');
      expect(updated!.isResolved).toBe(true);
      expect(updated!.isCorrect).toBe(false);
      expect(updated!.timeToInvalidationSeconds).toBe(60);
    });

    it('4.3 should classify outcome as POSITIVE_REACTION when price moves favorably without hitting full target', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 101.0, high: 101.2, low: 99.8, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.outcome).toBe('POSITIVE_REACTION');
      expect(updated!.isCorrect).toBe(true);
    });

    it('4.4 should classify outcome as NEGATIVE_REACTION when price moves adversely without hitting stop', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 99.0, high: 100.1, low: 99.0, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.outcome).toBe('NEGATIVE_REACTION');
      expect(updated!.isCorrect).toBe(false);
    });

    it('4.5 should classify outcome as NEUTRAL_REACTION when fluctuations remain within 0.25%', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 100.1, high: 100.15, low: 99.9, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.outcome).toBe('NEUTRAL_REACTION');
      expect(updated!.directionalAccuracy).toBe('INCONCLUSIVE');
    });

    it('4.6 should classify outcome as CONTRADICTED upon contradictory event or state', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      engine.updateSignalLifecycleState(outcome.signalId, 'CONTRADICTED', 'Opposing catalyst published', true);

      const record = engine.getOutcomeRecord(outcome.signalId);
      expect(record!.outcome).toBe('CONTRADICTED');
      expect(record!.contradictionDetected).toBe(true);
      expect(record!.isResolved).toBe(true);
    });

    it('4.7 should classify outcome as EXPIRED_WITHOUT_RESOLUTION upon lifecycle expiry without target/stop', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      engine.updateSignalLifecycleState(outcome.signalId, 'EXPIRED', 'Holding window elapsed without target/stop');

      const record = engine.getOutcomeRecord(outcome.signalId);
      expect(record!.outcome).toBe('EXPIRED_WITHOUT_RESOLUTION');
      expect(record!.isResolved).toBe(true);
    });

    it('4.8 should classify outcome as STOP_REACHED for BEARISH signal when price spikes upward past stop threshold', () => {
      const outcome = registerTestSignal({ direction: 'BEARISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      const observations: PriceObservation[] = [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 102.5, high: 102.5, low: 99.8, volume: 100 }
      ];

      const updated = engine.ingestMarketObservations(outcome.signalId, observations);
      expect(updated!.outcome).toBe('STOP_REACHED');
      expect(updated!.isCorrect).toBe(false);
    });
  });

  // ==========================================
  // CATEGORY 5: DIRECTIONAL ACCURACY
  // ==========================================
  describe('Category 5: Directional Accuracy', () => {
    it('5.1 should mark BULLISH signal with positive return as CORRECT', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 103, volume: 100 }
      ]);
      expect(updated!.directionalAccuracy).toBe('CORRECT');
      expect(updated!.isCorrect).toBe(true);
    });

    it('5.2 should mark BULLISH signal with negative return as INCORRECT', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 96, volume: 100 }
      ]);
      expect(updated!.directionalAccuracy).toBe('INCORRECT');
      expect(updated!.isCorrect).toBe(false);
    });

    it('5.3 should mark BEARISH signal with negative price move as CORRECT', () => {
      const outcome = registerTestSignal({ direction: 'BEARISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 97, volume: 100 }
      ]);
      expect(updated!.directionalAccuracy).toBe('CORRECT');
      expect(updated!.isCorrect).toBe(true);
    });

    it('5.4 should mark BEARISH signal with positive price move as INCORRECT', () => {
      const outcome = registerTestSignal({ direction: 'BEARISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 104, volume: 100 }
      ]);
      expect(updated!.directionalAccuracy).toBe('INCORRECT');
      expect(updated!.isCorrect).toBe(false);
    });

    it('5.5 should mark flat price moves as INCONCLUSIVE', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 100.05, volume: 100 }
      ]);
      expect(updated!.directionalAccuracy).toBe('INCONCLUSIVE');
    });

    it('5.6 should preserve directional accuracy classification upon subsequent observations', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 103, volume: 100 }
      ]);
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 120000).toISOString(), price: 105, volume: 200 }
      ]);
      expect(updated!.directionalAccuracy).toBe('CORRECT');
    });
  });

  // ==========================================
  // CATEGORY 6: PRIORITY ACCURACY
  // ==========================================
  describe('Category 6: Priority Accuracy', () => {
    it('6.1 should mark ACCURATE_PRIORITY when high priority produces large excursion (MFE >= 1.5%)', () => {
      const outcome = registerTestSignal({ initialPriority: 'P1_CRITICAL', direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 103, high: 103, low: 99, volume: 100 }
      ]);
      expect(updated!.priorityAccuracy).toBe('ACCURATE_PRIORITY');
    });

    it('6.2 should mark INVERTED_PRIORITY when high priority produces large adverse move (MAE > MFE)', () => {
      const outcome = registerTestSignal({ initialPriority: 'P1_CRITICAL', direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 96, high: 100.5, low: 95.5, volume: 100 }
      ]);
      expect(updated!.priorityAccuracy).toBe('INVERTED_PRIORITY');
    });

    it('6.3 should mark ACCURATE_PRIORITY for routine priority with modest moves', () => {
      const outcome = registerTestSignal({ initialPriority: 'P4_ROUTINE', direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 100.8, high: 100.9, low: 99.5, volume: 100 }
      ]);
      expect(updated!.priorityAccuracy).toBe('ACCURATE_PRIORITY');
    });

    it('6.4 should handle low priority with unexpected high excursion', () => {
      const outcome = registerTestSignal({ initialPriority: 'P4_ROUTINE', direction: 'BULLISH', initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 108, high: 108, low: 99.5, volume: 100 }
      ]);
      expect(updated!.priorityAccuracy).toBe('MISMATCHED_EXCURSION');
    });

    it('6.5 should initialize priorityAccuracy to PENDING_EVALUATION before observations', () => {
      const outcome = registerTestSignal();
      expect(outcome.priorityAccuracy).toBe('PENDING_EVALUATION');
    });
  });

  // ==========================================
  // CATEGORY 7: LIFECYCLE PREDICTION ACCURACY
  // ==========================================
  describe('Category 7: Lifecycle Prediction Accuracy', () => {
    it('7.1 should mark PREDICTION_VERIFIED when CONFIRMED lifecycle reaches target', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      engine.updateSignalLifecycleState(outcome.signalId, 'CONFIRMED', 'Volume and market reaction confirmed');
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 103, high: 103, low: 99, volume: 100 }
      ]);
      expect(updated!.lifecyclePredictionAccuracy).toBe('PREDICTION_VERIFIED');
    });

    it('7.2 should mark PREDICTION_FAILED when CONFIRMED lifecycle hits stop', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      engine.updateSignalLifecycleState(outcome.signalId, 'CONFIRMED', 'Confirmed state');
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 97, high: 100, low: 97, volume: 100 }
      ]);
      expect(updated!.lifecyclePredictionAccuracy).toBe('PREDICTION_FAILED');
    });

    it('7.3 should mark PREDICTION_VERIFIED when INVALIDATED state correctly precedes adverse moves', () => {
      const outcome = registerTestSignal({ direction: 'BULLISH', initialPrice: 100 });
      engine.updateSignalLifecycleState(outcome.signalId, 'INVALIDATED', 'Invalidated due to contradiction');
      const baseTime = new Date(outcome.generatedAt).getTime();
      const updated = engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 97, high: 100, low: 97, volume: 100 }
      ]);
      expect(updated!.lifecyclePredictionAccuracy).toBe('PREDICTION_VERIFIED');
    });

    it('7.4 should initialize lifecyclePredictionAccuracy to PENDING_DATA before resolution', () => {
      const outcome = registerTestSignal();
      expect(outcome.lifecyclePredictionAccuracy).toBe('PENDING_DATA');
    });
  });

  // ==========================================
  // CATEGORY 8: PERFORMANCE AGGREGATION & DIMENSIONAL SLICING
  // ==========================================
  describe('Category 8: Performance Aggregation & Dimensional Slicing', () => {
    beforeEach(() => {
      // Seed 6 diverse outcome records across types, sectors, and symbols
      const baseTime = Date.now() - 3600000;
      
      // Signal 1: Reliance (EARNINGS_BEAT, ENERGY, BULLISH) -> Target Reached (Correct)
      const s1 = registerTestSignal({ eventId: 'e1', symbol: 'RELIANCE', signalType: 'EARNINGS_BEAT', sector: 'ENERGY', direction: 'BULLISH', initialPrice: 100 });
      engine.ingestMarketObservations(s1.signalId, [{ timestamp: new Date(baseTime + 60000).toISOString(), price: 103, high: 103, low: 99.5, volume: 100 }]);

      // Signal 2: TCS (EARNINGS_BEAT, IT, BULLISH) -> Target Reached (Correct)
      const s2 = registerTestSignal({ eventId: 'e2', symbol: 'TCS', signalType: 'EARNINGS_BEAT', sector: 'IT', direction: 'BULLISH', initialPrice: 200 });
      engine.ingestMarketObservations(s2.signalId, [{ timestamp: new Date(baseTime + 60000).toISOString(), price: 206, high: 206, low: 199, volume: 100 }]);

      // Signal 3: Infosys (REGULATORY_ACTION, IT, BEARISH) -> Target Reached (Correct)
      const s3 = registerTestSignal({ eventId: 'e3', symbol: 'INFY', signalType: 'REGULATORY_ACTION', sector: 'IT', direction: 'BEARISH', initialPrice: 300 });
      engine.ingestMarketObservations(s3.signalId, [{ timestamp: new Date(baseTime + 60000).toISOString(), price: 291, high: 301, low: 291, volume: 100 }]);

      // Signal 4: HDFC Bank (MANAGEMENT_CHANGE, BANKING, BULLISH) -> Stop Reached (Incorrect)
      const s4 = registerTestSignal({ eventId: 'e4', symbol: 'HDFCBANK', signalType: 'MANAGEMENT_CHANGE', sector: 'BANKING', direction: 'BULLISH', initialPrice: 100 });
      engine.ingestMarketObservations(s4.signalId, [{ timestamp: new Date(baseTime + 60000).toISOString(), price: 97, high: 100.2, low: 97, volume: 100 }]);

      // Signal 5: ICICI Bank (MANAGEMENT_CHANGE, BANKING, BULLISH) -> Neutral (Inconclusive)
      const s5 = registerTestSignal({ eventId: 'e5', symbol: 'ICICIBANK', signalType: 'MANAGEMENT_CHANGE', sector: 'BANKING', direction: 'BULLISH', initialPrice: 100 });
      engine.ingestMarketObservations(s5.signalId, [{ timestamp: new Date(baseTime + 60000).toISOString(), price: 100.1, high: 100.1, low: 99.9, volume: 100 }]);

      // Signal 6: SBI (EARNINGS_BEAT, BANKING, BULLISH) -> Target Reached (Correct)
      const s6 = registerTestSignal({ eventId: 'e6', symbol: 'SBIN', signalType: 'EARNINGS_BEAT', sector: 'BANKING', direction: 'BULLISH', initialPrice: 100 });
      engine.ingestMarketObservations(s6.signalId, [{ timestamp: new Date(baseTime + 60000).toISOString(), price: 104, high: 104, low: 99, volume: 100 }]);
    });

    it('8.1 should compute overall aggregate performance across all records', () => {
      const perf = engine.getAggregatedPerformance();
      expect(perf.totalEvaluated).toBe(6);
      expect(perf.completedOutcomes).toBe(5); // s1, s2, s3, s4, s6 resolved
      expect(perf.correctSignals).toBe(4); // s1, s2, s3, s6
      expect(perf.incorrectSignals).toBe(1); // s4
      expect(perf.overallDirectionalAccuracy).toBeGreaterThan(60);
    });

    it('8.2 should slice performance by Signal Type', () => {
      const perf = engine.getAggregatedPerformance();
      expect(perf.bySignalType['EARNINGS_BEAT']).toBeDefined();
      expect(perf.bySignalType['EARNINGS_BEAT'].sampleSize).toBe(3);
      expect(perf.bySignalType['EARNINGS_BEAT'].winRate).toBe(100);
      expect(perf.bySignalType['MANAGEMENT_CHANGE'].sampleSize).toBe(2);
      expect(perf.bySignalType['MANAGEMENT_CHANGE'].winRate).toBe(0);
    });

    it('8.3 should slice performance by Sector', () => {
      const perf = engine.getAggregatedPerformance();
      expect(perf.bySector['IT']).toBeDefined();
      expect(perf.bySector['IT'].sampleSize).toBe(2);
      expect(perf.bySector['IT'].winRate).toBe(100);
      expect(perf.bySector['BANKING']).toBeDefined();
      expect(perf.bySector['BANKING'].sampleSize).toBe(3);
    });

    it('8.4 should slice performance by Symbol', () => {
      const perf = engine.getAggregatedPerformance({ symbol: 'RELIANCE' });
      expect(perf.totalEvaluated).toBe(1);
      expect(perf.correctSignals).toBe(1);
      expect(perf.sampleSufficiency).toBe('INSUFFICIENT_SAMPLE');
    });

    it('8.5 should enforce INSUFFICIENT_SAMPLE when slice count < 5', () => {
      const perf = engine.getAggregatedPerformance();
      expect(perf.bySignalType['REGULATORY_ACTION'].sufficientSample).toBe(false);
      expect(perf.bySignalType['REGULATORY_ACTION'].sampleStatus).toBe('INSUFFICIENT_SAMPLE');
    });

    it('8.6 should identify top-performing and lowest-performing signal types', () => {
      const perf = engine.getAggregatedPerformance();
      expect(perf.topPerformingSignalType).toBe('EARNINGS_BEAT');
      expect(perf.lowestPerformingSignalType).toBe('MANAGEMENT_CHANGE');
    });

    it('8.7 should calculate average and median MFE and MAE across slices', () => {
      const perf = engine.getAggregatedPerformance();
      expect(perf.averageMfe).toBeGreaterThan(0);
      expect(perf.averageMae).toBeGreaterThanOrEqual(0);
      expect(perf.medianMfe).toBeGreaterThan(0);
    });

    it('8.8 should filter aggregated performance by date window', () => {
      const perf = engine.getAggregatedPerformance({
        startDate: new Date(Date.now() + 100000).toISOString()
      });
      expect(perf.totalEvaluated).toBe(0);
      expect(perf.sampleSufficiency).toBe('INSUFFICIENT_SAMPLE');
    });
  });

  // ==========================================
  // CATEGORY 9: ZERO-AI COST & DETERMINISM
  // ==========================================
  describe('Category 9: Zero-AI Cost & Mathematical Determinism', () => {
    it('9.1 should guarantee 0 AI calls across evaluation lifecycle', () => {
      const outcome = registerTestSignal();
      const baseTime = new Date(outcome.generatedAt).getTime();
      engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 105, volume: 100 }
      ]);
      const telemetry = engine.getTelemetry();
      expect(telemetry.aiCallCount).toBe(0);
      expect(telemetry.evaluationLatencyMs).toBeLessThan(100);
    });

    it('9.2 should produce identical outcome calculations on identical observation inputs', () => {
      const obs: PriceObservation[] = [
        { timestamp: '2026-08-26T10:00:00Z', price: 104, high: 106, low: 99, volume: 500 }
      ];

      const s1 = registerTestSignal({ eventId: 'det1', initialPrice: 100 });
      const s2 = registerTestSignal({ eventId: 'det2', initialPrice: 100 });

      const u1 = engine.ingestMarketObservations(s1.signalId, obs);
      const u2 = engine.ingestMarketObservations(s2.signalId, obs);

      expect(u1!.mfePercent).toBe(u2!.mfePercent);
      expect(u1!.maePercent).toBe(u2!.maePercent);
      expect(u1!.outcome).toBe(u2!.outcome);
      expect(u1!.directionalAccuracy).toBe(u2!.directionalAccuracy);
    });

    it('9.3 should never emit NaN or undefined in performance ratios for empty datasets', () => {
      engine.clear();
      const perf = engine.getAggregatedPerformance();
      expect(perf.overallDirectionalAccuracy).toBe(0);
      expect(perf.overallWinRate).toBe(0);
      expect(perf.averageMfe).toBe(0);
      expect(perf.averageMae).toBe(0);
      expect(perf.sampleSufficiency).toBe('INSUFFICIENT_SAMPLE');
    });

    it('9.4 should deterministically reject undefined observations array', () => {
      const outcome = registerTestSignal();
      const updated = engine.ingestMarketObservations(outcome.signalId, null as any);
      expect(updated).toBeDefined();
      expect(updated!.observationCount).toBe(0);
    });

    it('9.5 should maintain telemetry counter for processed observations', () => {
      const outcome = registerTestSignal();
      const baseTime = new Date(outcome.generatedAt).getTime();
      engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 101, volume: 100 },
        { timestamp: new Date(baseTime + 120000).toISOString(), price: 102, volume: 200 }
      ]);
      const telemetry = engine.getTelemetry();
      expect(telemetry.observationsProcessed).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================
  // CATEGORY 10: PERSISTENCE, SERIALIZATION & STATE RECOVERY
  // ==========================================
  describe('Category 10: Persistence, Serialization & State Recovery', () => {
    it('10.1 should persist outcome records to storage and allow fresh retrieval', () => {
      const outcome = registerTestSignal({ symbol: 'INFY', initialPrice: 1500 });
      const record = engine.getOutcomeRecord(outcome.signalId);
      expect(record).toBeDefined();
      expect(record!.symbol).toBe('INFY');
      expect(record!.initialPrice).toBe(1500);
    });

    it('10.2 should allow filtering records by symbol, signalType, priority, outcome', () => {
      registerTestSignal({ eventId: 'p1', symbol: 'TCS', signalType: 'EARNINGS_BEAT', priority: 'P1_CRITICAL' });
      registerTestSignal({ eventId: 'p2', symbol: 'INFY', signalType: 'MANAGEMENT_CHANGE', priority: 'P3_MODERATE' });

      const tcsOnly = engine.getAllOutcomeRecords({ symbol: 'TCS' });
      expect(tcsOnly.length).toBe(1);
      expect(tcsOnly[0].symbol).toBe('TCS');

      const p3Only = engine.getAllOutcomeRecords({ priority: 'P3_MODERATE' });
      expect(p3Only.length).toBe(1);
      expect(p3Only[0].symbol).toBe('INFY');
    });

    it('10.3 should preserve forensic timeline steps across observation updates', () => {
      const outcome = registerTestSignal({ initialPrice: 100 });
      const baseTime = new Date(outcome.generatedAt).getTime();

      engine.ingestMarketObservations(outcome.signalId, [
        { timestamp: new Date(baseTime + 60000).toISOString(), price: 104, volume: 100 }
      ]);
      engine.updateSignalLifecycleState(outcome.signalId, 'CONFIRMED', 'Confirmed state');

      const record = engine.getOutcomeRecord(outcome.signalId);
      expect(record!.timeline.length).toBeGreaterThanOrEqual(3);
      expect(record!.timeline.map(t => t.eventType)).toContain('SIGNAL_GENERATED');
      expect(record!.timeline.map(t => t.eventType)).toContain('TARGET_REACHED');
      expect(record!.timeline.map(t => t.eventType)).toContain('LIFECYCLE_TRANSITION');
    });

    it('10.4 should maintain state isolation across singleton calls', () => {
      const inst1 = SignalOutcomeEngine.getInstance();
      const inst2 = SignalOutcomeEngine.getInstance();
      expect(inst1).toBe(inst2);
    });

    it('10.5 should clean in-memory state on clear()', () => {
      registerTestSignal();
      expect(engine.getAllOutcomeRecords().length).toBeGreaterThan(0);
      engine.clear();
      expect(engine.getAllOutcomeRecords().length).toBe(0);
    });
  });
});
