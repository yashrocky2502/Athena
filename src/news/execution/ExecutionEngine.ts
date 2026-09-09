/**
 * ATHENA NEWS ENGINE — PHASE 20
 * ExecutionEngine.ts
 * 
 * Central Orchestrator Facade for Execution Intelligence & Deterministic Trade Lifecycle Engine.
 * Connects Phase 11 (Signal) -> Phase 12 (Strategy) -> Phase 13 (Portfolio Decision) -> Phase 14 Execution -> Phase 20 Production Broker Adapters & Multi-Gate Authorizer.
 */

import {
  ExecutionIntent, ExecutionPlan, ExecutionOrder, ExecutionValidationResult,
  ExecutionRiskGateResult, TradeLifecycleRecord, ExecutionAuditRecord, ExecutionMode
} from './types.ts';
import { preTradeValidationEngine } from './PreTradeValidationEngine.ts';
import { executionRiskGate } from './ExecutionRiskGate.ts';
import { orderConstructionEngine } from './OrderConstructionEngine.ts';
import { smartExecutionEngine } from './SmartExecutionEngine.ts';
import { executionSlippageEngine } from './ExecutionSlippageEngine.ts';
import { orderLifecycleStateMachine } from './OrderLifecycleStateMachine.ts';
import { tradeLifecycleEngine } from './TradeLifecycleEngine.ts';
import { executionAdapterFactory } from './ExecutionAdapterFactory.ts';
import { executionKillSwitch } from './ExecutionKillSwitch.ts';
import { executionMonitoringEngine } from './ExecutionMonitoringEngine.ts';
import { executionAuditTrail } from './ExecutionAuditTrail.ts';
import { executionAIBoundary } from './ExecutionAIBoundary.ts';
import { executionTelegramSnapshot } from './ExecutionTelegramSnapshot.ts';
import { liveExecutionGateController } from './LiveExecutionGateController.ts';
import { orderReconciliationEngine } from './OrderReconciliationEngine.ts';

import { PortfolioSnapshot, PortfolioDecision } from '../portfolio/types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

export interface FullExecutionResult {
  success: boolean;
  intent: ExecutionIntent;
  validation: ExecutionValidationResult;
  riskGate: ExecutionRiskGateResult;
  plan?: ExecutionPlan;
  orders?: ExecutionOrder[];
  lifecycle?: TradeLifecycleRecord;
  auditRecord?: ExecutionAuditRecord;
  telegramText: string;
}

export class ExecutionEngine {
  private static instance: ExecutionEngine;

  private constructor() {}

  public static getInstance(): ExecutionEngine {
    if (!this.instance) {
      this.instance = new ExecutionEngine();
    }
    return this.instance;
  }

  /**
   * Processes a proposed execution request from Phase 11-13 outputs through the complete pipeline.
   */
  public async processExecution(
    signal: TransmissionSignalResult,
    candidate: CanonicalStrategyCandidate,
    decision: PortfolioDecision,
    snapshot: PortfolioSnapshot,
    requestedQty?: number,
    quoteAgeMs: number = 500,
    isMarketOpen: boolean = true
  ): Promise<FullExecutionResult> {
    const qty = requestedQty || decision.positionSizing?.recommendedQuantity || candidate.optionsGreeks?.breakevenPoints?.[0] || 1;
    const now = new Date().toISOString();
    const mode = executionAdapterFactory.getMode();

    // 1. Check Kill Switch
    if (executionKillSwitch.checkBlockExecution(candidate.symbol, candidate.strategyId)) {
      const blockedValidation: ExecutionValidationResult = {
        isValid: false,
        hardRejection: true,
        rejectionReasons: [`HARD_REJECT: Execution blocked by active Kill Switch (${executionKillSwitch.getStatus().reason})`],
        warnings: [],
        validatedAt: now,
        quoteTimestampAgeMs: quoteAgeMs,
        marketSessionValid: isMarketOpen
      };
      const blockedIntent: ExecutionIntent = {
        schemaVersion: 'v14_execution_intelligence',
        executionId: `exec-kill-${Date.now()}`,
        strategyId: candidate.strategyId,
        portfolioDecisionId: decision.decisionId,
        symbol: candidate.symbol,
        underlyingSymbol: candidate.symbol,
        instrument: candidate.symbol,
        assetClass: candidate.category === 'OPTIONS' ? 'OPTIONS' : 'EQUITY',
        side: candidate.direction === 'SHORT' ? 'SELL' : 'BUY',
        quantity: qty,
        targetPrice: candidate.entryPrice || 100,
        orderType: 'LIMIT',
        timeInForce: 'DAY',
        entryRationale: candidate.description || 'Kill switch blocked',
        sourceSignalId: signal.signalId,
        riskGateStatus: 'BLOCKED',
        portfolioGateStatus: decision.decision,
        timestamp: now,
        expiry: new Date(Date.now() + 86400000).toISOString(),
        confidenceScore: candidate.compatibilityScore,
        executionPriority: 'HIGH',
        mode
      };
      const telegramText = executionTelegramSnapshot.generateExecutionBlockedSnapshot(candidate.symbol, qty, blockedValidation);
      return {
        success: false,
        intent: blockedIntent,
        validation: blockedValidation,
        riskGate: { status: 'BLOCKED', requestedQuantity: qty, approvedQuantity: 0, maxAllowedSlippagePct: 0, reasons: blockedValidation.rejectionReasons, warnings: [], evaluatedAt: now },
        telegramText
      };
    }

    // 2. Create Execution Intent
    const intent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: `exec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      strategyId: candidate.strategyId,
      portfolioDecisionId: decision.decisionId,
      symbol: candidate.symbol,
      underlyingSymbol: candidate.symbol,
      instrument: candidate.symbol,
      assetClass: candidate.category === 'OPTIONS' ? 'OPTIONS' : 'EQUITY',
      side: candidate.direction === 'SHORT' ? 'SELL' : 'BUY',
      quantity: qty,
      targetPrice: candidate.entryPrice || 100,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: candidate.description || 'Strategy execution intent',
      sourceSignalId: signal.signalId,
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: decision.decision,
      timestamp: now,
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: candidate.compatibilityScore,
      executionPriority: 'HIGH',
      mode
    };

    // 3. Pre-Trade Validation
    const validation = preTradeValidationEngine.validateExecution(intent, candidate, decision, snapshot, quoteAgeMs, isMarketOpen);

    // 4. Execution Risk Gate
    const riskGate = executionRiskGate.evaluateGate(intent, validation, decision, snapshot);

    if (!validation.isValid || riskGate.status === 'BLOCKED') {
      const telegramText = executionTelegramSnapshot.generateExecutionBlockedSnapshot(intent.symbol, intent.quantity, validation, riskGate);
      return {
        success: false,
        intent,
        validation,
        riskGate,
        telegramText
      };
    }

    // 5. Verify Strict AI Boundary Pass
    executionAIBoundary.verifyAIBoundaryPass(intent, validation, riskGate, false);

    // 6. Select Execution Tactic
    const tacticInfo = smartExecutionEngine.selectTactics(intent, candidate);

    // 7. Order Construction (Plan & Orders)
    const plan = orderConstructionEngine.createExecutionPlan(intent, candidate, riskGate, tacticInfo.tacticMode);
    const unsubmittedOrders = orderConstructionEngine.buildOrdersForPlan(plan);

    // 8. If in LIVE mode, verify 12 Multi-Gates before broker submission
    if (mode === 'LIVE') {
      for (const ord of unsubmittedOrders) {
        const liveGateCheck = await liveExecutionGateController.evaluateLiveGates(
          ord, intent, 'ZERODHA', snapshot, false, undefined, riskGate
        );
        if (liveGateCheck.decision === 'ORDER_BLOCKED') {
          const blockedVal: ExecutionValidationResult = {
            isValid: false,
            hardRejection: true,
            rejectionReasons: liveGateCheck.failureReasons,
            warnings: [],
            validatedAt: now,
            quoteTimestampAgeMs: quoteAgeMs,
            marketSessionValid: isMarketOpen
          };
          const telegramText = executionTelegramSnapshot.generateExecutionBlockedSnapshot(ord.symbol, ord.quantity, blockedVal);
          return {
            success: false,
            intent,
            validation: blockedVal,
            riskGate: { ...riskGate, status: 'BLOCKED', reasons: liveGateCheck.failureReasons },
            telegramText
          };
        }
      }
    }

    // 9. Submit Orders through Active Adapter
    const adapter = executionAdapterFactory.getAdapter();
    const executedOrders: ExecutionOrder[] = [];

    for (let order of unsubmittedOrders) {
      orderLifecycleStateMachine.transition('CREATED', 'VALIDATING');
      orderLifecycleStateMachine.transition('VALIDATING', 'APPROVED');
      orderLifecycleStateMachine.transition('APPROVED', 'SUBMITTED');

      orderReconciliationEngine.registerOrder(order);
      const filledOrder = await adapter.submitOrder(order);
      orderLifecycleStateMachine.transition('SUBMITTED', 'ACKNOWLEDGED');
      orderLifecycleStateMachine.transition('ACKNOWLEDGED', 'FILLED');

      // 10. Calculate Slippage Metrics
      const slippageReport = executionSlippageEngine.calculateSlippage(filledOrder, candidate.entryPrice);
      filledOrder.slippageINR = slippageReport.absoluteSlippageINR;
      filledOrder.slippagePct = slippageReport.slippagePct;

      executedOrders.push(filledOrder);
      executionMonitoringEngine.recordOrder(filledOrder);
    }

    // 11. Initialize Trade Lifecycle Record
    const lifecycle = tradeLifecycleEngine.initializeTradeRecord(signal, candidate, decision, plan, executedOrders);
    tradeLifecycleEngine.recordFill(lifecycle.tradeId, executedOrders[0]);

    // 12. Record Immutable Audit Trail
    const auditRecord = executionAuditTrail.logRecord(
      signal, candidate, decision, intent, validation, riskGate, plan, executedOrders, lifecycle
    );

    // 13. Generate Telegram Markdown Text
    const telegramText = executionTelegramSnapshot.generateExecutionSuccessSnapshot(plan, executedOrders, riskGate, mode);

    return {
      success: true,
      intent,
      validation,
      riskGate,
      plan,
      orders: executedOrders,
      lifecycle,
      auditRecord,
      telegramText
    };
  }
}

export const executionEngine = ExecutionEngine.getInstance();
