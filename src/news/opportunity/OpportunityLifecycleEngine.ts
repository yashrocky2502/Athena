/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Opportunity Lifecycle & State Audit Engine
 */

import {
  CanonicalOpportunity,
  DecisionState,
  OpportunityLifecycleEvent
} from './types';

export class OpportunityLifecycleEngine {
  private static instance: OpportunityLifecycleEngine;
  private lifecycleHistory: Map<string, OpportunityLifecycleEvent[]> = new Map();

  public static getInstance(): OpportunityLifecycleEngine {
    if (!OpportunityLifecycleEngine.instance) {
      OpportunityLifecycleEngine.instance = new OpportunityLifecycleEngine();
    }
    return OpportunityLifecycleEngine.instance;
  }

  /**
   * Records an immutable lifecycle state transition
   */
  public recordTransition(params: {
    opportunityId: string;
    previousState: DecisionState;
    newState: DecisionState;
    reason: string;
    confidence: number;
    evidenceIds: string[];
    deterministicRuleIds?: string[];
    actor?: 'SYSTEM_DETERMINISTIC_ENGINE' | 'MARKET_TRUTH_TRIGGER' | 'RISK_GATE' | 'CIRCUIT_BREAKER' | 'EXPIRATION_TIMER';
    metadata?: Record<string, any>;
  }): OpportunityLifecycleEvent {
    const event: OpportunityLifecycleEvent = {
      eventId: `EVT_LIFECYCLE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      opportunityId: params.opportunityId,
      timestamp: new Date().toISOString(),
      previousState: params.previousState,
      newState: params.newState,
      reason: params.reason,
      confidence: params.confidence,
      evidenceIds: params.evidenceIds,
      deterministicRuleIds: params.deterministicRuleIds || ['RULE_STATE_TRANSITION_DEFAULT'],
      actor: params.actor || 'SYSTEM_DETERMINISTIC_ENGINE',
      metadata: params.metadata
    };

    const history = this.lifecycleHistory.get(params.opportunityId) || [];
    history.push(event);
    this.lifecycleHistory.set(params.opportunityId, history);

    return event;
  }

  /**
   * Retrieves complete lifecycle audit trail for an opportunity
   */
  public getLifecycleHistory(opportunityId: string): OpportunityLifecycleEvent[] {
    return this.lifecycleHistory.get(opportunityId) || [];
  }

  /**
   * Clears state for tests or resets
   */
  public clear(): void {
    this.lifecycleHistory.clear();
  }
}
