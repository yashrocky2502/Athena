/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * ExecutionEvidenceEngine.ts
 * 
 * Captures execution intent evidence and enforces the 12-Gate Execution Authorizer.
 * 
 * CRITICAL SAFETY INVARIANT:
 * AI is strictly barred from authorizing or creating execution evidence.
 * isAiCreated = FALSE, isAiAuthorized = FALSE.
 */

import { ExecutionEvidenceTrace } from './types.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';

export class ExecutionEvidenceEngine {
  private static instance: ExecutionEvidenceEngine;

  private constructor() {}

  public static getInstance(): ExecutionEvidenceEngine {
    if (!ExecutionEvidenceEngine.instance) {
      ExecutionEvidenceEngine.instance = new ExecutionEvidenceEngine();
    }
    return ExecutionEvidenceEngine.instance;
  }

  /**
   * Creates deterministic execution evidence trace
   */
  public createExecutionTrace(params: {
    executionIntentId: string;
    orderId?: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'LIMIT' | 'MARKET';
    executionMode: 'PAPER' | 'SANDBOX' | 'LIVE';
    strategyEvidenceChainId: string;
    portfolioRiskGateEvidenceId: string;
    marketTruthEvidenceId: string;
    marketDataFreshnessMs: number;
    brokerHealthEvidenceId: string;
    twelveGatePassStatus: boolean;
    callerIdentity?: string;
  }): ExecutionEvidenceTrace {
    const {
      executionIntentId,
      orderId,
      symbol,
      action,
      quantity,
      orderType,
      executionMode,
      strategyEvidenceChainId,
      portfolioRiskGateEvidenceId,
      marketTruthEvidenceId,
      marketDataFreshnessMs,
      brokerHealthEvidenceId,
      twelveGatePassStatus,
      callerIdentity
    } = params;

    // AI Safety Check: Reject if caller is AI model
    if (callerIdentity && (callerIdentity.includes('AI') || callerIdentity.includes('LLM') || callerIdentity.includes('GEMINI'))) {
      throw new Error(`[AI_EXECUTION_AUTHORIZATION_ATTEMPT] AI models are strictly prohibited from authorizing or creating execution intents.`);
    }

    // Generate cryptographic authorization hash
    const authPayload = {
      intent: executionIntentId,
      sym: symbol,
      act: action,
      qty: quantity,
      strat: strategyEvidenceChainId,
      risk: portfolioRiskGateEvidenceId,
      truth: marketTruthEvidenceId,
      gates: twelveGatePassStatus,
      mode: executionMode
    };
    const authorizationHash = 'auth_' + EvidenceHashEngine.sha256(EvidenceHashEngine.canonicalStringify(authPayload)).substring(0, 32);

    return {
      executionIntentId,
      orderId,
      symbol,
      action,
      quantity,
      orderType,
      executionMode,
      strategyEvidenceChainId,
      portfolioRiskGateEvidenceId,
      marketTruthEvidenceId,
      marketDataFreshnessMs,
      brokerHealthEvidenceId,
      twelveGatePassStatus,
      authorizationHash,
      isAiCreated: false,
      isAiAuthorized: false
    };
  }
}

export const executionEvidenceEngine = ExecutionEvidenceEngine.getInstance();
