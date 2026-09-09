/**
 * ATHENA NEWS ENGINE — PHASE 14
 * ExecutionAuditTrail.ts
 * 
 * Execution Audit Trail Engine.
 * Creates immutable audit records connecting Signal -> Strategy -> Portfolio -> Intent -> Validation -> Plan -> Orders -> Fills -> Outcome.
 */

import { ExecutionAuditRecord, ExecutionIntent, ExecutionPlan, ExecutionOrder, ExecutionValidationResult, ExecutionRiskGateResult, TradeLifecycleRecord } from './types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { PortfolioDecision } from '../portfolio/types.ts';

export class ExecutionAuditTrail {
  private static instance: ExecutionAuditTrail;
  private auditLog: Map<string, ExecutionAuditRecord> = new Map();

  private constructor() {}

  public static getInstance(): ExecutionAuditTrail {
    if (!this.instance) {
      this.instance = new ExecutionAuditTrail();
    }
    return this.instance;
  }

  /**
   * Logs a complete execution audit record.
   */
  public logRecord(
    signal: TransmissionSignalResult,
    candidate: CanonicalStrategyCandidate,
    decision: PortfolioDecision,
    intent: ExecutionIntent,
    validation: ExecutionValidationResult,
    riskGate: ExecutionRiskGateResult,
    plan: ExecutionPlan,
    orders: ExecutionOrder[],
    lifecycle: TradeLifecycleRecord
  ): ExecutionAuditRecord {
    const auditId = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fills = orders
      .filter(o => o.status === 'FILLED' || o.filledQuantity > 0)
      .map(o => ({
        orderId: o.orderId,
        fillPrice: o.avgFillPrice,
        fillQty: o.filledQuantity,
        fillTime: o.updatedAt
      }));

    const record: ExecutionAuditRecord = {
      auditId,
      timestamp: new Date().toISOString(),
      signal,
      candidateStrategy: candidate,
      portfolioDecision: decision,
      executionIntent: intent,
      validationResult: validation,
      riskGateResult: riskGate,
      executionPlan: plan,
      orders,
      fills,
      positionStateAfter: { symbol: intent.symbol, quantity: intent.quantity },
      lifecycleRecord: lifecycle
    };

    this.auditLog.set(auditId, record);
    return record;
  }

  public getRecord(auditId: string): ExecutionAuditRecord | undefined {
    return this.auditLog.get(auditId);
  }

  public getAllRecords(): ExecutionAuditRecord[] {
    return Array.from(this.auditLog.values());
  }
}

export const executionAuditTrail = ExecutionAuditTrail.getInstance();
