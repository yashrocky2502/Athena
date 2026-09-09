/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Execution Control Plane Bridge & Safety Boundary Gatekeeper
 */

import {
  CanonicalOpportunity,
  ExecutionEligibilityDecision
} from './types';
import { MarketTruthCircuitBreaker } from '../market-truth/MarketTruthCircuitBreaker';
import { ExecutionKillSwitch } from '../execution/ExecutionKillSwitch';

export class OpportunityExecutionBridge {
  private static instance: OpportunityExecutionBridge;

  public static getInstance(): OpportunityExecutionBridge {
    if (!OpportunityExecutionBridge.instance) {
      OpportunityExecutionBridge.instance = new OpportunityExecutionBridge();
    }
    return OpportunityExecutionBridge.instance;
  }

  /**
   * Deterministically evaluates execution eligibility against 12-Gate Authorizer,
   * MarketTruthCircuitBreaker, and ExecutionKillSwitch.
   * 
   * HARD SAFETY RULE:
   * AI models are STRICTLY FORBIDDEN from calling this to bypass gates or directly place orders.
   */
  public evaluateExecutionEligibility(
    opportunity: CanonicalOpportunity,
    context?: { caller?: string; isAiCaller?: boolean }
  ): ExecutionEligibilityDecision {
    const timestamp = new Date().toISOString();

    // 1. AI Execution Boundary Check
    if (context?.isAiCaller || context?.caller?.toUpperCase().includes('AI') || context?.caller?.toUpperCase().includes('LLM')) {
      return {
        isEligible: false,
        status: 'BLOCKED',
        reason: 'CRITICAL_SAFETY_VIOLATION: AI models are strictly forbidden from authorizing capital or execution',
        failedGates: ['GATE_AI_BOUNDARY_FIREWALL'],
        passedGatesCount: 0,
        totalGatesCount: 12,
        authorizerApproval: false,
        circuitBreakerBlocked: false,
        killSwitchBlocked: false,
        timestamp
      };
    }

    const failedGates: string[] = [];
    let totalGatesCount = 12;
    let passedGatesCount = 0;

    // Gate 1: Market Truth Circuit Breaker
    const circuitBreaker = MarketTruthCircuitBreaker.getInstance();
    const isCircuitBreakerTripped = circuitBreaker.isTripped();
    if (isCircuitBreakerTripped) {
      failedGates.push('GATE_01_MARKET_TRUTH_CIRCUIT_BREAKER');
    } else {
      passedGatesCount++;
    }

    // Gate 2: Execution Kill Switch
    const killSwitch = ExecutionKillSwitch.getInstance();
    const isKillSwitchActive = killSwitch.getStatus().active;
    if (isKillSwitchActive) {
      failedGates.push('GATE_02_EXECUTION_KILL_SWITCH');
    } else {
      passedGatesCount++;
    }

    // Gate 3: Evidence Quality Threshold (>= 60)
    if (opportunity.evidenceQualityScore < 60) {
      failedGates.push('GATE_03_EVIDENCE_QUALITY_INSUFFICIENT');
    } else {
      passedGatesCount++;
    }

    // Gate 4: Evidence Freshness SLA (>= 40)
    if (opportunity.evidenceFreshnessScore < 40) {
      failedGates.push('GATE_04_EVIDENCE_STALENESS');
    } else {
      passedGatesCount++;
    }

    // Gate 5: Contradiction Firewall
    if (opportunity.contradictionScore > 50 || opportunity.confirmationBreakdown.overallStatus === 'CRITICALLY_CONTRADICTED') {
      failedGates.push('GATE_05_CRITICAL_CONTRADICTION_PRESENT');
    } else {
      passedGatesCount++;
    }

    // Gate 6: Multi-Source Confirmation (>= 2 confirming dimensions)
    if (opportunity.confirmationBreakdown.confirmingDimensionCount < 2 || opportunity.confirmationScore < 40) {
      failedGates.push('GATE_06_MULTI_SOURCE_CONFIRMATION_FAILED');
    } else {
      passedGatesCount++;
    }

    // Gate 7: Deterministic Expected Value (> 0)
    if (opportunity.expectedValue <= 0) {
      failedGates.push('GATE_07_NEGATIVE_EXPECTED_VALUE');
    } else {
      passedGatesCount++;
    }

    // Gate 8: Invalidation Triggers Check (no active invalidation)
    const activeInvalidations = opportunity.invalidationConditions.filter(c => c.isTriggered);
    if (activeInvalidations.length > 0) {
      failedGates.push(`GATE_08_INVALIDATION_TRIGGERED: ${activeInvalidations[0].description}`);
    } else {
      passedGatesCount++;
    }

    // Gate 9: Portfolio Compatibility
    if (opportunity.portfolioReview && opportunity.portfolioReview.status === 'PORTFOLIO_BLOCKED') {
      failedGates.push(`GATE_09_PORTFOLIO_LIMIT_BREACH: ${opportunity.portfolioReview.blockingReasons.join('; ')}`);
    } else {
      passedGatesCount++;
    }

    // Gate 10: Confidence Threshold (>= 65)
    if (opportunity.confidenceScore < 65) {
      failedGates.push('GATE_10_CONFIDENCE_BELOW_TRADING_THRESHOLD');
    } else {
      passedGatesCount++;
    }

    // Gate 11: Regime Compatibility (>= 50)
    if (opportunity.regimeCompatibilityScore < 50) {
      failedGates.push('GATE_11_REGIME_INCOMPATIBILITY');
    } else {
      passedGatesCount++;
    }

    // Gate 12: Liquidity Score (>= 50)
    if (opportunity.liquidityScore < 50) {
      failedGates.push('GATE_12_LIQUIDITY_INADEQUATE');
    } else {
      passedGatesCount++;
    }

    const isEligible = failedGates.length === 0;

    return {
      isEligible,
      status: isEligible ? 'ELIGIBLE' : 'BLOCKED',
      reason: isEligible ? 'All 12 deterministic pre-trade risk gates passed successfully' : `Blocked by ${failedGates.length} failed gates: ${failedGates.join(', ')}`,
      failedGates,
      passedGatesCount,
      totalGatesCount,
      authorizerApproval: isEligible,
      circuitBreakerBlocked: isCircuitBreakerTripped,
      killSwitchBlocked: isKillSwitchActive,
      timestamp
    };
  }
}
