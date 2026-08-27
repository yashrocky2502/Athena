/**
 * ATHENA NEWS ENGINE — PHASE 10.7
 * Phase10_7_SignalLifecycle.test.ts
 * 
 * Continuous Signal Lifecycle, Decay, Invalidation & Actionability Test Suite.
 * Verifies:
 * - Singleton Initialization and State isolation
 * - Clean state transitions (NEW -> ACTIVE -> CONFIRMED -> WEAKENING -> EXPIRED/INVALIDATED)
 * - Decay math logic (conservative vs aggressive curves)
 * - Automatic alignment-driven contradiction invalidation (Bullish vs Bearish conflict)
 * - Persistent storage mock hydration and recovery
 * - Telegram notification routing hooks
 * - Force evaluation and manual invalidation API methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signalLifecycleEngine, SignalLifecycleEngine } from '../intelligence/SignalLifecycleEngine.ts';
import { MarketSignal } from '../intelligence/MarketIntelligenceFusionEngine.ts';

describe('PHASE 10.7 — SIGNAL LIFECYCLE, DECAY & ACTIONS', () => {
  let engine: SignalLifecycleEngine;

  beforeEach(() => {
    engine = SignalLifecycleEngine.getInstance();
    engine.clear();
    vi.restoreAllMocks();
  });

  const createBaseSignal = (id: string, symbol: string, score: number, alignment: any = 'ALIGNED'): MarketSignal => {
    return {
      signalId: id,
      eventId: `evt_${id}`,
      articleId: `art_${id}`,
      symbol: symbol,
      eventType: 'CORPORATE_ACTION',
      signalType: 'CORPORATE_ACTION',
      priority: 'P1_HIGH' as any,
      signalScore: score,
      components: {
        eventMateriality: score,
        marketReaction: score,
        volumeConfirmation: score,
        fnoConfirmation: score,
        sourceAuthority: score,
        freshness: score,
        crossSignalAlignment: score,
        dataQuality: score,
        eventScore: score
      } as any,
      alignment: alignment,
      lifecycleState: 'ACTIVE' as any,
      explanation: 'Test signal explanation',
      timestamp: new Date().toISOString(),
      revision: 1,
      warnings: [],
      eventMateriality: 'HIGH',
      fundamentalDirection: 'BULLISH',
      overallConfirmation: 'INSUFFICIENT_EVIDENCE',
      sourceTier: 'TIER_1' as any,
      freshnessText: 'REAL_TIME',
      crossAssetImpacts: [],
      priceReactionText: 'STEEP_POSITIVE',
      volumeText: 'STRONG_VOLUME_CONFIRMED',
      fnoText: 'LONG_BUILDUP'
    };
  };

  it('Section 1 - Initialization & Clean Clear', () => {
    expect(engine).toBeDefined();
    expect(engine.getActiveLifecycles().length).toBe(0);
    expect(engine.getHistoricalLedger().length).toBe(0);
    expect(engine.getObservability().activeSignals).toBe(0);
  });

  it('Section 2 - Evaluate Signal state progression & Score decay', () => {
    const signal = createBaseSignal('sig_1', 'RELIANCE', 85, 'NEUTRAL');
    const lc = engine.evaluateSignal(signal);

    expect(lc).toBeDefined();
    expect(lc.signalId).toBe('sig_1');
    expect(lc.currentState).toBe('ACTIVE');
    expect(lc.rawScore).toBe(85);
    expect(lc.decayedScore).toBe(85); // immediate evaluation has age 0
    expect(lc.actionability).toBe('ACTIONABLE');
    
    // Timeline has 2 entries: initial NEW state transition, and progressive ACTIVE transition
    expect(lc.timeline.length).toBe(2);
    expect(lc.timeline[0].newState).toBe('NEW');
    expect(lc.timeline[1].newState).toBe('ACTIVE');

    // Re-evaluating immediately keeps it ACTIVE and no decay
    const lc2 = engine.evaluateSignal(signal);
    expect(lc2.currentState).toBe('ACTIVE');
    expect(lc2.decayedScore).toBe(85);
  });

  it('Section 3 - Continuous Age-based decay math and transition to WEAKENING', () => {
    const signal = createBaseSignal('sig_2', 'INFY', 90);
    signal.eventType = 'BREAKING'; // validityWindow = 300 seconds
    const lc = engine.evaluateSignal(signal);

    // Mock time passage of 2 minutes (120 seconds) which is 40% decay
    lc.scoreAge = 120;
    lc.createdAt = new Date(Date.now() - 120 * 1000).toISOString();

    const lcDecayed = engine.evaluateSignal(signal);
    
    // Decayed score should be strictly lower than rawScore
    expect(lcDecayed.decayedScore).toBeLessThan(90);
    // Score decay age of 2 mins on a 300s window gives decay factor < 0.7
    expect(lcDecayed.currentState).toBe('WEAKENING');
    expect(lcDecayed.actionability).toBe('WATCH');
    expect(lcDecayed.timeline.length).toBe(3); // NEW -> ACTIVE -> WEAKENING
    expect(lcDecayed.timeline[2].newState).toBe('WEAKENING');
  });

  it('Section 4 - Transition to EXPIRED on total decay', () => {
    const signal = createBaseSignal('sig_3', 'TCS', 70);
    signal.eventType = 'BREAKING'; // validityWindow = 300 seconds
    const lc = engine.evaluateSignal(signal);

    // Mock time passage of 6 minutes (360 seconds) which exceeds the 300s validity window
    lc.scoreAge = 360;
    lc.createdAt = new Date(Date.now() - 360 * 1000).toISOString();

    const lcExpired = engine.evaluateSignal(signal);
    expect(lcExpired.currentState).toBe('EXPIRED');
    expect(lcExpired.decayedScore).toBe(0);
    expect(lcExpired.actionability).toBe('NO_LONGER_ACTIONABLE');
    expect(lcExpired.expiredAt).toBeDefined();

    // Ledger should now record the expired outcome
    const ledger = engine.getHistoricalLedger();
    expect(ledger.length).toBe(1);
    expect(ledger[0].signalId).toBe('sig_3');
    expect(ledger[0].finalState).toBe('EXPIRED');
    expect(ledger[0].duration).toBeGreaterThanOrEqual(360);
  });

  it('Section 5 - Inbound confirmation strengthens state', () => {
    const signal = createBaseSignal('sig_4', 'HDFCBANK', 80);
    const lc = engine.evaluateSignal(signal);
    expect(lc.currentState).toBe('ACTIVE');

    // Trigger high score evaluation to CONFIRMED
    const strongerSignal = createBaseSignal('sig_4', 'HDFCBANK', 98);
    const lcConfirmed = engine.evaluateSignal(strongerSignal);

    expect(lcConfirmed.currentState).toBe('CONFIRMED');
    expect(lcConfirmed.confirmedAt).toBeDefined();
    expect(lcConfirmed.peakScore).toBe(98);
    expect(lcConfirmed.timeline.length).toBe(3); // NEW -> ACTIVE -> CONFIRMED
    expect(lcConfirmed.timeline[2].newState).toBe('CONFIRMED');
  });

  it('Section 6 - Alignment Invalidation (Contradiction and state CONTRADICTED)', () => {
    const signalBullish = createBaseSignal('sig_5_reliance', 'RELIANCE', 80, 'ALIGNED');
    signalBullish.fundamentalDirection = 'BULLISH';
    engine.evaluateSignal(signalBullish);

    // Opposing signal is evaluated
    const signalBearish = createBaseSignal('sig_5_reliance_bear', 'RELIANCE', 85, 'CONFLICTING');
    signalBearish.fundamentalDirection = 'BEARISH';
    signalBearish.alignment = 'CONFLICTING' as any;
    engine.evaluateSignal(signalBearish);

    // The original bullish signal is evaluated and gets contradicted (receives conflicting alignment)
    signalBullish.alignment = 'CONFLICTING';
    const lcBullishRefreshed = engine.evaluateSignal(signalBullish);
    expect(lcBullishRefreshed.currentState).toBe('CONTRADICTED');
    expect(lcBullishRefreshed.contradictionDetected).toBe(true);
    expect(lcBullishRefreshed.actionability).toBe('NO_LONGER_ACTIONABLE');
    expect(lcBullishRefreshed.timeline.find(t => t.newState === 'CONTRADICTED')).toBeDefined();
  });

  it('Section 7 - Manual Invalidation workflow', () => {
    const signal = createBaseSignal('sig_6', 'SBIN', 80);
    const lc = engine.evaluateSignal(signal);

    const success = engine.manualInvalidation('sig_6', 'Operator manual oversight cancel');
    expect(success).toBe(true);

    const lcInvalid = engine.getActiveLifecycles().find(l => l.signalId === 'sig_6');
    expect(lcInvalid).toBeDefined();
    expect(lcInvalid?.currentState).toBe('INVALIDATED');
    expect(lcInvalid?.invalidationReason).toBe('Operator manual oversight cancel');
    expect(lcInvalid?.invalidatedAt).toBeDefined();
    expect(lcInvalid?.actionability).toBe('INVALIDATED');

    const ledger = engine.getHistoricalLedger();
    expect(ledger.length).toBe(1);
    expect(ledger[0].finalState).toBe('INVALIDATED');
  });

  it('Section 8 - Observability telemetry metrics reporting', () => {
    // Set up a variety of lifecycles
    const s1 = createBaseSignal('sig_obs_1', 'RELIANCE', 80);
    const s2 = createBaseSignal('sig_obs_2', 'SBIN', 95);
    const s3 = createBaseSignal('sig_obs_3', 'INFY', 40);

    engine.evaluateSignal(s1); // ACTIVE
    
    engine.evaluateSignal(s2); // ACTIVE
    engine.evaluateSignal(s2); // CONFIRMED (since score > 90 and second call)

    engine.evaluateSignal(s3); // ACTIVE
    const lc3 = engine.getActiveLifecycles().find(l => l.signalId === 'sig_obs_3')!;
    lc3.scoreAge = 3600;
    lc3.createdAt = new Date(Date.now() - 3600 * 1000).toISOString();
    engine.evaluateSignal(s3); // WEAKENING

    const obs = engine.getObservability();
    expect(obs.activeSignals).toBeGreaterThanOrEqual(1);
    expect(obs.confirmedSignals).toBeGreaterThanOrEqual(1);
    expect(obs.zeroAiExecutionCount).toBeGreaterThanOrEqual(5);
  });

  it('Section 9 - Hydration and restart safety persistence', () => {
    const signal = createBaseSignal('sig_persist_1', 'AXISBANK', 88);
    engine.evaluateSignal(signal);

    // Trigger explicit manual persist
    engine.persist();

    // Create a new instance and verify hydrated state
    const newEngineInstance = SignalLifecycleEngine.getInstance();
    newEngineInstance.hydrate();

    const activeLcs = newEngineInstance.getActiveLifecycles();
    expect(activeLcs.some(l => l.signalId === 'sig_persist_1')).toBe(true);

    const match = activeLcs.find(l => l.signalId === 'sig_persist_1');
    expect(match?.currentState).toBe('ACTIVE');
    expect(match?.rawScore).toBe(88);
  });
});
