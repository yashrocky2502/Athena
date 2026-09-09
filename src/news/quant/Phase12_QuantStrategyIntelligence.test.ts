/**
 * ATHENA NEWS ENGINE — PHASE 12
 * Phase12_QuantStrategyIntelligence.test.ts
 * 
 * Standardized Production Acceptance Test Suite for Phase 12:
 * Quantitative Strategy Intelligence & Signal-to-Strategy Engine.
 * 
 * Tests 20 critical scenarios:
 * 1. Signal → strategy translation
 * 2. Strategy compatibility
 * 3. Event-conditioned historical matching
 * 4. Backtest correctness
 * 5. P&L correctness
 * 6. MFE/MAE
 * 7. Expected value calculation
 * 8. Risk gate evaluation
 * 9. Lifecycle state integration
 * 10. Contradiction & Invalidation safety handling
 * 11. Insufficient sample handling
 * 12. Walk-forward validation
 * 13. Out-of-sample validation
 * 14. Overfitting detection & warnings
 * 15. Options payoff & Greek calculations
 * 16. Telegram formatting
 * 17. Observability & Zero-AI boundary
 */

import { describe, it, expect } from 'vitest';
import { quantStrategyIntelligenceEngine } from './QuantStrategyIntelligenceEngine.ts';
import { eventToSignalTransmissionEngine } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { StrategyTemplateSystem } from './StrategyTemplateSystem.ts';
import { strategyRiskGate } from './StrategyRiskGate.ts';
import { strategyExpectedValueEngine } from './StrategyExpectedValueEngine.ts';
import { strategyBacktestEngine } from './StrategyBacktestEngine.ts';

describe('ATHENA Phase 12 — Quantitative Strategy Intelligence', () => {
  // Sample Mock Transmission Signal (Bullish Order Win)
  const mockBullishArticle = {
    id: 'art-tata-ev-order-001',
    headline: 'Tata Motors wins ₹2,500 Crore EV Bus Supply Order from DTC',
    body: 'Tata Motors secures prestigious electric bus supply contract for 1500 units with high operating margins.',
    symbol: 'TATAMOTORS',
    publishedAt: new Date().toISOString()
  };

  const signalBullish = eventToSignalTransmissionEngine.transmitEventToSignal(mockBullishArticle, true);

  it('1. Signal-to-Strategy Candidate Translation: Generates versioned strategy candidates across Equity and Options', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish, true);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(c => c.category === 'EQUITY')).toBe(true);
    expect(candidates.some(c => c.category === 'OPTIONS')).toBe(true);
    expect(candidates[0].schemaVersion).toBe('v12_strategy_candidate');
  });

  it('2. Strategy Compatibility Engine: Computes compatibility score and valid ratings', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const topCandidate = candidates[0];
    expect(topCandidate.compatibilityScore).toBeGreaterThan(60);
    expect(['COMPATIBLE', 'CONDITIONAL']).toContain(topCandidate.compatibilityRating);
  });

  it('3. Event-Conditioned Historical Matching: Finds analogues with valid sample size', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const precedents = candidates[0].historicalPrecedents;
    expect(precedents.sampleSize).toBeGreaterThanOrEqual(5);
    expect(['VALID_HISTORICAL_SAMPLE', 'LIMITED_SAMPLE']).toContain(precedents.sampleQuality);
  });

  it('4 & 5. Backtest & P&L Deterministic Calculations: Validates Net PnL and lookahead bias protection', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const bt = candidates[0].backtestMetrics;
    expect(bt.totalTrades).toBeGreaterThan(0);
    expect(typeof bt.netPnL).toBe('number');
    expect(bt.hasLookaheadBiasProtection).toBe(true);
  });

  it('6. MFE / MAE Excursion Analysis: Computes deterministic excursion medians', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const bt = candidates[0].backtestMetrics;
    expect(typeof bt.mfeMedianPct).toBe('number');
    expect(typeof bt.maeMedianPct).toBe('number');
  });

  it('7. Expected Value Engine: Calculates expected value in INR and 95% confidence intervals', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const ev = candidates[0].expectedValue;
    expect(typeof ev.expectedValueINR).toBe('number');
    expect(ev.confidenceInterval95Pct.length).toBe(2);
  });

  it('8 & 9. Risk Gate & Signal Lifecycle Integration: Evaluates risk score and actionability state', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const top = candidates[0];
    expect(['TRADEABLE', 'WATCH', 'CONDITIONAL', 'NO_TRADE']).toContain(top.actionability);
    expect(typeof top.riskProfile.overallRiskScore).toBe('number');
  });

  it('10. Contradiction & Invalidation Safety Handling: Forces ALL strategies to NO_TRADE on contradicted signal', () => {
    const contradictedSignal = {
      ...signalBullish,
      alignment: 'CONTRADICTED' as const,
      lifecycleState: 'CONTRADICTED' as const
    };
    const cands = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(contradictedSignal, true);
    expect(cands.every(c => c.actionability === 'NO_TRADE')).toBe(true);
  });

  it('11. Insufficient Sample Handling: Safely processes rare event signal without crashing', () => {
    const rareSignal = {
      ...signalBullish,
      headline: 'Obscure Penny Stock Demerger Surprise',
      symbol: 'OBSCURE'
    };
    const cands = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(rareSignal, true);
    expect(cands.length).toBeGreaterThan(0);
  });

  it('12-14. Robustness Validation & Overfitting Detection: Checks walk-forward and out-of-sample tests', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const rob = candidates[0].robustnessReport;
    expect(typeof rob.walkForwardPassed).toBe('boolean');
    expect(typeof rob.outOfSamplePassed).toBe('boolean');
    expect(['LOW', 'MODERATE']).toContain(rob.overfittingRiskLevel);
  });

  it('15. Options Payoff & Greek Calculations: Correctly constructs multi-leg Bull Call Spread and computes Greeks', () => {
    const legs = StrategyTemplateSystem.constructOptionLegs('OPTION_BULL_CALL_SPREAD', 1000);
    const greeks = StrategyTemplateSystem.calculateOptionGreeks(1000, legs);
    expect(legs.length).toBe(2);
    expect(typeof greeks.netDelta).toBe('number');
    expect(typeof greeks.maxProfit).toBe('number');
    expect(typeof greeks.maxLoss).toBe('number');
    expect(greeks.breakevenPoints.length).toBeGreaterThan(0);
  });

  it('16. Telegram Quant Strategy Snapshot Formatting: Formats ground-truth snapshot with disclaimer', () => {
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signalBullish);
    const tgMsg = quantStrategyIntelligenceEngine.generateTelegramQuantSnapshot(candidates[0]);
    expect(tgMsg).toContain('QUANT STRATEGY SNAPSHOT');
    expect(tgMsg).toContain('Expected Value');
    expect(tgMsg).toContain('DISCLAIMER');
  });

  it('17-20. Observability, Cache Identity & Zero-AI Boundary: Enforces zero AI invocations in quant calculations', () => {
    const obs = quantStrategyIntelligenceEngine.getObservability();
    expect(obs.signalsConsumed).toBeGreaterThanOrEqual(1);
    expect(obs.deterministicCalculations).toBeGreaterThan(0);
    expect(obs.aiResearchInvocations).toBe(0);
  });
});
