/**
 * ATHENA NEWS ENGINE — PHASE 14
 * ExecutionRiskGate.ts
 * 
 * Deterministic Execution Risk Gate.
 * Evaluates ExecutionIntent and Validation Results to output execution statuses:
 * APPROVED, APPROVED_WITH_LIMITS, CONDITIONAL, BLOCKED, EXPIRED, CANCEL_REQUIRED.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic rules engine.
 */

import { ExecutionIntent, ExecutionRiskGateResult, ExecutionRiskGateStatus, ExecutionValidationResult } from './types.ts';
import { PortfolioSnapshot, PortfolioDecision } from '../portfolio/types.ts';

export class ExecutionRiskGate {
  private static instance: ExecutionRiskGate;

  private constructor() {}

  public static getInstance(): ExecutionRiskGate {
    if (!this.instance) {
      this.instance = new ExecutionRiskGate();
    }
    return this.instance;
  }

  /**
   * Evaluates proposed ExecutionIntent and produces a deterministic gate status.
   */
  public evaluateGate(
    intent: ExecutionIntent,
    validation: ExecutionValidationResult,
    decision: PortfolioDecision,
    snapshot: PortfolioSnapshot
  ): ExecutionRiskGateResult {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const evaluatedAt = new Date().toISOString();

    // 1. BLOCKED check
    if (!validation.isValid || validation.hardRejection) {
      return {
        status: 'BLOCKED',
        requestedQuantity: intent.quantity,
        approvedQuantity: 0,
        maxAllowedSlippagePct: 0,
        reasons: validation.rejectionReasons,
        warnings: validation.warnings,
        evaluatedAt
      };
    }

    // 2. EXPIRED check
    const now = Date.now();
    const intentAgeMs = now - new Date(intent.timestamp).getTime();
    if (intentAgeMs > 86400000) {
      return {
        status: 'EXPIRED',
        requestedQuantity: intent.quantity,
        approvedQuantity: 0,
        maxAllowedSlippagePct: 0,
        reasons: ['Execution Intent time window has expired (>24 hours).'],
        warnings: [],
        evaluatedAt
      };
    }

    // 3. Quantity Sizing Limit check (Portfolio Decision Sizing)
    const recQty = decision.positionSizing?.recommendedQuantity || intent.quantity;
    const maxAllowedQty = decision.positionSizing?.maxAllowedQuantity || intent.quantity;
    let approvedQty = Math.min(intent.quantity, recQty, maxAllowedQty);

    let status: ExecutionRiskGateStatus = 'APPROVED';
    let maxAllowedSlippagePct = 0.30; // 0.30% default max slippage for liquid instruments

    // If quantity had to be trimmed
    if (approvedQty < intent.quantity && approvedQty > 0) {
      status = 'APPROVED_WITH_LIMITS';
      reasons.push(`Approved quantity trimmed from ${intent.quantity} to ${approvedQty} due to portfolio risk/margin limits (${decision.positionSizing?.limitingFactor || 'Capital Cap'}).`);
    } else if (approvedQty <= 0) {
      status = 'BLOCKED';
      reasons.push('Approved quantity reduced to 0 by Portfolio Position Sizing Engine.');
      return {
        status: 'BLOCKED',
        requestedQuantity: intent.quantity,
        approvedQuantity: 0,
        maxAllowedSlippagePct: 0,
        reasons,
        warnings,
        evaluatedAt
      };
    }

    // CONDITIONAL check (e.g. if portfolio risk gate status was HEDGE_REQUIRED or CONDITIONAL)
    if (decision.riskGateStatus === 'HEDGE_REQUIRED' || decision.riskGateStatus === 'CONDITIONAL') {
      status = 'CONDITIONAL';
      reasons.push(`Execution conditioned on executing mandatory portfolio hedge or limit bounds.`);
      maxAllowedSlippagePct = 0.15; // Tighten slippage tolerance for conditional trades
    }

    // Check margin utilization for slippage adjustment
    const marginRatio = snapshot.usedMarginINR / snapshot.totalCapitalINR;
    if (marginRatio > 0.70) {
      warnings.push('Elevated margin utilization (>70%). Tightened execution slippage bounds.');
      maxAllowedSlippagePct = Math.min(maxAllowedSlippagePct, 0.20);
    }

    if (reasons.length === 0) {
      reasons.push('Execution intent satisfies all pre-trade safety gates, portfolio capacity, and slippage bounds.');
    }

    return {
      status,
      requestedQuantity: intent.quantity,
      approvedQuantity: approvedQty,
      maxAllowedSlippagePct,
      reasons,
      warnings,
      evaluatedAt
    };
  }
}

export const executionRiskGate = ExecutionRiskGate.getInstance();
