/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Decision State Machine & WATCH/WAIT/AVOID Recommendation Engine
 */

import {
  ActionRecommendation,
  CanonicalOpportunity,
  DecisionState
} from './types';

export class OpportunityDecisionEngine {
  private static instance: OpportunityDecisionEngine;

  public static getInstance(): OpportunityDecisionEngine {
    if (!OpportunityDecisionEngine.instance) {
      OpportunityDecisionEngine.instance = new OpportunityDecisionEngine();
    }
    return OpportunityDecisionEngine.instance;
  }

  /**
   * Advances the deterministic decision state machine based on multi-factor scores and gate results
   */
  public evaluateDecisionState(opp: CanonicalOpportunity): {
    decisionState: DecisionState;
    actionRecommendation: ActionRecommendation;
    decisionReason: string;
  } {
    // 1. Expiration Check
    if (new Date().getTime() > new Date(opp.expiresAt).getTime()) {
      return {
        decisionState: 'EXPIRED',
        actionRecommendation: 'EXPIRED',
        decisionReason: `Opportunity expired at ${opp.expiresAt}`
      };
    }

    // 2. Active Invalidation Check
    const activeInvalidations = opp.invalidationConditions.filter(c => c.isTriggered);
    if (activeInvalidations.length > 0) {
      return {
        decisionState: 'CONTRADICTED',
        actionRecommendation: 'AVOID',
        decisionReason: `Invalidation triggered: ${activeInvalidations[0].description}`
      };
    }

    // 3. Evidence Quality Gate
    if (opp.evidenceQualityScore < 50 || opp.evidenceIds.length === 0) {
      return {
        decisionState: 'INSUFFICIENT_EVIDENCE',
        actionRecommendation: 'WAIT',
        decisionReason: 'Insufficient deterministic evidence to substantiate the thesis'
      };
    }

    // 4. Contradiction & Circuit Breaker Gate
    if (opp.contradictionScore >= 50 || opp.confirmationBreakdown.overallStatus === 'CRITICALLY_CONTRADICTED') {
      return {
        decisionState: 'CONTRADICTED',
        actionRecommendation: 'AVOID',
        decisionReason: `Critical contradiction detected: ${opp.confirmationBreakdown.criticalContradictionReason || 'Market divergences contradict directional thesis'}`
      };
    }

    // 5. Confirmation Evaluation
    if (opp.confirmationBreakdown.confirmingDimensionCount < 2 || opp.confirmationScore < 45) {
      return {
        decisionState: 'UNCONFIRMED',
        actionRecommendation: 'WATCH',
        decisionReason: 'Fewer than 2 independent market dimensions confirm the move; maintain on active watchlist'
      };
    }

    // 6. Portfolio & Risk Gate
    if (opp.portfolioReview && opp.portfolioReview.status === 'PORTFOLIO_BLOCKED') {
      return {
        decisionState: 'REJECTED',
        actionRecommendation: 'BLOCKED',
        decisionReason: `Risk & Portfolio Gate rejection: ${opp.portfolioReview.blockingReasons.join('; ')}`
      };
    }

    // 7. Full Execution Eligibility
    if (opp.executionEligibility.isEligible && opp.confidenceScore >= 70 && opp.expectedValue > 0.5) {
      return {
        decisionState: 'EXECUTION_ELIGIBLE',
        actionRecommendation: 'TRADE',
        decisionReason: `All 12 deterministic gates passed. Strong multi-factor confirmation (${opp.confirmationScore}/100) with positive expected value (+${opp.expectedValue}%)`
      };
    }

    // 8. Tradeable but waiting for execution window / lower priority
    if (opp.confidenceScore >= 60 && opp.expectedValue > 0) {
      return {
        decisionState: 'TRADEABLE',
        actionRecommendation: 'TRADE',
        decisionReason: `Tradeable candidate: Multi-factor confirmed with positive expectancy, pending execution priority slot`
      };
    }

    // 9. Moderate confidence / Watchlist
    return {
      decisionState: 'CONFIRMED',
      actionRecommendation: 'WATCH',
      decisionReason: `Thesis confirmed by market data, but confidence (${opp.confidenceScore}/100) or EV (+${opp.expectedValue}%) below immediate execution thresholds`
    };
  }
}
