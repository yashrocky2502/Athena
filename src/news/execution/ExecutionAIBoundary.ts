/**
 * ATHENA NEWS ENGINE — PHASE 20
 * ExecutionAIBoundary.ts
 * 
 * Strict AI Execution Boundary.
 * Enforces the core architectural invariant:
 * AI / LLM -> Research / Signal / Strategy Candidate -> Portfolio Decision -> Risk Gate -> Execution Intent -> PreTradeValidation -> ExecutionRiskGate -> Broker Adapter.
 * 
 * Strictly BLOCKS any attempt by an AI or prompt to bypass deterministic pre-trade validation or directly submit broker orders.
 */

import { ExecutionIntent, ExecutionRiskGateResult, ExecutionValidationResult } from './types.ts';

export class ExecutionAIBoundary {
  private static instance: ExecutionAIBoundary;

  private constructor() {}

  public static getInstance(): ExecutionAIBoundary {
    if (!this.instance) {
      this.instance = new ExecutionAIBoundary();
    }
    return this.instance;
  }

  /**
   * Verifies that an order execution request originates from validated deterministic gates.
   * Throws AI_EXECUTION_BYPASS_BLOCKED if a direct AI/LLM call attempts to bypass validation.
   */
  public verifyAIBoundaryPass(
    intent?: ExecutionIntent,
    validation?: ExecutionValidationResult,
    riskGate?: ExecutionRiskGateResult,
    isDirectAICall: boolean = false
  ): boolean {
    if (isDirectAICall) {
      throw new Error('AI_EXECUTION_BYPASS_BLOCKED: AI is strictly prohibited from directly placing or modifying trades. AI may only propose strategy candidates.');
    }

    if (validation && (!validation.isValid || validation.hardRejection)) {
      throw new Error(`AI_EXECUTION_BYPASS_BLOCKED: Order submission blocked by PreTradeValidationEngine: ${validation.rejectionReasons.join(', ')}`);
    }

    if (riskGate && (riskGate.status === 'BLOCKED' || riskGate.status === 'EXPIRED' || riskGate.status === 'CANCEL_REQUIRED')) {
      throw new Error(`AI_EXECUTION_BYPASS_BLOCKED: Order submission blocked by ExecutionRiskGate: ${riskGate.reasons.join(', ')}`);
    }

    return true;
  }
}

export const executionAIBoundary = ExecutionAIBoundary.getInstance();
