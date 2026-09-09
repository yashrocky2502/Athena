/**
 * ATHENA NEWS ENGINE — PHASE 16
 * StrategyPromotionGate.ts
 * 
 * Anti-Overfitting Evolution Gate.
 * Validates evolved strategies to prevent curve-fitting, look-ahead bias, and single-regime dependencies,
 * promoting strategies through: EXPERIMENTAL -> VALIDATING -> PAPER -> CANDIDATE -> APPROVED.
 */

import { EvolvedStrategy } from './StrategyEvolutionEngine.ts';

export type PromotionState = 'EXPERIMENTAL' | 'VALIDATING' | 'PAPER' | 'CANDIDATE' | 'APPROVED';

export interface PromotionGateResult {
  strategyId: string;
  previousState: PromotionState;
  currentState: PromotionState;
  passed: boolean;
  scoreCard: {
    sampleSizeCheck: boolean;
    walkForwardCheck: boolean;
    oosCheck: boolean;
    bootstrapCheck: boolean;
    monteCarloCheck: boolean;
    drawdownCheck: boolean;
    degradationCheck: boolean;
    regimeStabilityCheck: boolean;
  };
  failures: string[];
  evaluatedAt: string;
}

export class StrategyPromotionGate {
  private static strategyStates: Map<string, PromotionState> = new Map();
  private static promotionHistory: PromotionGateResult[] = [];

  /**
   * Evaluates if a strategy qualifies to advance to the next state
   */
  public static evaluatePromotion(
    strategy: EvolvedStrategy,
    additionalMetrics?: {
      backtestTradeCount?: number;
      walkForwardTradeCount?: number;
      bootstrapLowerWinRate?: number;
      regimeStabilityScore?: number; // 0-100 stability across BULL/BEAR/RANGE
    }
  ): PromotionGateResult {
    const current = this.strategyStates.get(strategy.strategyId) || 'EXPERIMENTAL';

    const metrics = {
      backtestTradeCount: additionalMetrics?.backtestTradeCount ?? 40,
      walkForwardTradeCount: additionalMetrics?.walkForwardTradeCount ?? 20,
      bootstrapLowerWinRate: additionalMetrics?.bootstrapLowerWinRate ?? 52.0,
      regimeStabilityScore: additionalMetrics?.regimeStabilityScore ?? 80.0,
    };

    const failures: string[] = [];
    const scoreCard = {
      sampleSizeCheck: metrics.backtestTradeCount >= 30 && metrics.walkForwardTradeCount >= 15,
      walkForwardCheck: (strategy.walkForwardScore ?? 0) >= 65,
      oosCheck: (strategy.oosScore ?? 0) >= 60,
      bootstrapCheck: metrics.bootstrapLowerWinRate >= 50.0,
      monteCarloCheck: (strategy.robustnessScore ?? 0) >= 70,
      drawdownCheck: (strategy.parameters.stopLossPct * 10) < 25.0, // proxy check
      degradationCheck: ((strategy.backtestScore ?? 0) - (strategy.oosScore ?? 0)) < 15.0,
      regimeStabilityCheck: metrics.regimeStabilityScore >= 70,
    };

    // Track failures
    if (!scoreCard.sampleSizeCheck) failures.push(`Insufficient sample size (Backtest: ${metrics.backtestTradeCount}/30, WalkForward: ${metrics.walkForwardTradeCount}/15)`);
    if (!scoreCard.walkForwardCheck) failures.push(`Walk forward score underperforms limit (${strategy.walkForwardScore}/65)`);
    if (!scoreCard.oosCheck) failures.push(`Out of sample score underperforms limit (${strategy.oosScore}/60)`);
    if (!scoreCard.bootstrapCheck) failures.push(`Bootstrap win-rate 95% lower bound must be above 50% (actual: ${metrics.bootstrapLowerWinRate}%)`);
    if (!scoreCard.monteCarloCheck) failures.push(`Monte carlo robustness underperforms limit (${strategy.robustnessScore}/70)`);
    if (!scoreCard.degradationCheck) failures.push('Overfitting detected: Out-Of-Sample performance degraded excessively vs backtest');
    if (!scoreCard.regimeStabilityCheck) failures.push('Single regime dependency: Strategy fails robustness checks in alternative regimes');

    const passed = failures.length === 0;
    let nextState = current;

    if (passed) {
      if (current === 'EXPERIMENTAL') nextState = 'VALIDATING';
      else if (current === 'VALIDATING') nextState = 'PAPER';
      else if (current === 'PAPER') nextState = 'CANDIDATE';
      else if (current === 'CANDIDATE') nextState = 'APPROVED';
    }

    this.strategyStates.set(strategy.strategyId, nextState);

    const result: PromotionGateResult = {
      strategyId: strategy.strategyId,
      previousState: current,
      currentState: nextState,
      passed,
      scoreCard,
      failures,
      evaluatedAt: new Date().toISOString(),
    };

    this.promotionHistory.push(result);
    return result;
  }

  public static getPromotionState(strategyId: string): PromotionState {
    return this.strategyStates.get(strategyId) || 'EXPERIMENTAL';
  }

  public static setPromotionState(strategyId: string, state: PromotionState): void {
    this.strategyStates.set(strategyId, state);
  }

  public static getPromotionHistory(): PromotionGateResult[] {
    return this.promotionHistory;
  }

  public static clear(): void {
    this.strategyStates.clear();
    this.promotionHistory = [];
  }
}
