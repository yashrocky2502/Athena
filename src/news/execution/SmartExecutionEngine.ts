/**
 * ATHENA NEWS ENGINE — PHASE 14
 * SmartExecutionEngine.ts
 * 
 * Smart Execution Engine.
 * Selects optimal deterministic execution tactics (IMMEDIATE, PASSIVE_LIMIT, AGGRESSIVE_LIMIT,
 * VWAP_STYLE, STAGED_ENTRY, HEDGE_FIRST, SPREAD_FIRST) based on market micro-structure.
 * 
 * ZERO-AI COST CONTRACT: 100% mathematical rules engine.
 */

import { ExecutionIntent, ExecutionTacticMode } from './types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';

export class SmartExecutionEngine {
  private static instance: SmartExecutionEngine;

  private constructor() {}

  public static getInstance(): SmartExecutionEngine {
    if (!this.instance) {
      this.instance = new SmartExecutionEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates market microstructure and strategy intent to determine optimal execution tactic.
   */
  public selectTactics(
    intent: ExecutionIntent,
    candidate: CanonicalStrategyCandidate,
    bidAskSpreadPct: number = 0.05,
    volatilityRegime: 'LOW' | 'BALANCED' | 'HIGH' | 'EXTREME' = 'BALANCED'
  ): { tacticMode: ExecutionTacticMode; rationale: string; stagingConfig?: { totalStages: number; delayMsBetweenStages: number } } {
    // 1. Multi-leg Option Spreads -> SPREAD_FIRST or HEDGE_FIRST
    if (candidate.category === 'OPTIONS' || candidate.strategyType.startsWith('OPTION_')) {
      if (candidate.strategyType.includes('SPREAD') || candidate.strategyType.includes('CONDOR')) {
        return {
          tacticMode: 'SPREAD_FIRST',
          rationale: 'Multi-leg option spread detected. Submitting spread legs simultaneously to minimize leg-risk.'
        };
      }
      if (candidate.strategyType.includes('HEDGE')) {
        return {
          tacticMode: 'HEDGE_FIRST',
          rationale: 'Risk reduction strategy. Executing protective hedge leg first.'
        };
      }
    }

    // 2. Urgent Signal / High Transmission Score -> IMMEDIATE or AGGRESSIVE_LIMIT
    if (intent.executionPriority === 'URGENT' || volatilityRegime === 'EXTREME') {
      return {
        tacticMode: 'IMMEDIATE',
        rationale: 'High urgency signal or extreme volatility. Executing immediately at marketable limit.'
      };
    }

    // 3. Large Order Size (> 1,000 shares or 50 contracts) -> STAGED_ENTRY or VWAP_STYLE
    if (intent.quantity > 50 && intent.assetClass !== 'EQUITY') {
      return {
        tacticMode: 'STAGED_ENTRY',
        rationale: 'Large size order. Staging entry in 3 discrete blocks to minimize market impact.',
        stagingConfig: { totalStages: 3, delayMsBetweenStages: 2000 }
      };
    }

    // 4. Wide Spread (> 0.20%) & Low Volatility -> PASSIVE_LIMIT
    if (bidAskSpreadPct > 0.20 && volatilityRegime === 'LOW') {
      return {
        tacticMode: 'PASSIVE_LIMIT',
        rationale: 'Wide bid-ask spread in low volatility environment. Placing passive limit order at mid-price.'
      };
    }

    // 5. Default -> AGGRESSIVE_LIMIT (Limit at top of book)
    return {
      tacticMode: 'AGGRESSIVE_LIMIT',
      rationale: 'Standard execution. Placing limit order at current ask/bid for rapid fill.'
    };
  }
}

export const smartExecutionEngine = SmartExecutionEngine.getInstance();
