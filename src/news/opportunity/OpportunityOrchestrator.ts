/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Master Opportunity Orchestrator
 */

import {
  CanonicalOpportunity,
  OpportunityFilterCriteria,
  OpportunityDirection,
  OpportunityType
} from './types';
import { OpportunityStore } from './OpportunityStore';
import { OpportunityDetectionEngine, OpportunityCandidateInput } from './OpportunityDetectionEngine';
import { OpportunityQueryEngine, OpportunityQueryResponse } from './OpportunityQueryEngine';
import { TelegramOpportunityAlertEngine, TelegramOpportunityAlertPayload } from './TelegramOpportunityAlertEngine';
import { OpportunityExecutionBridge } from './OpportunityExecutionBridge';
import { OpportunityLearningEngine } from './OpportunityLearningEngine';
import { OpportunityLifecycleEngine } from './OpportunityLifecycleEngine';

export class OpportunityOrchestrator {
  private static instance: OpportunityOrchestrator;
  private isSurveillanceRunning: boolean = false;
  private intervalId: any = null;

  public static getInstance(): OpportunityOrchestrator {
    if (!OpportunityOrchestrator.instance) {
      OpportunityOrchestrator.instance = new OpportunityOrchestrator();
    }
    return OpportunityOrchestrator.instance;
  }

  /**
   * Evaluates and ingests a candidate into the canonical opportunity store
   */
  public ingestOpportunity(input: OpportunityCandidateInput): CanonicalOpportunity {
    const detectionEngine = OpportunityDetectionEngine.getInstance();
    const opp = detectionEngine.detectOpportunity(input);
    OpportunityStore.getInstance().registerOpportunity(opp);
    return opp;
  }

  /**
   * Retrieves all opportunities, filtered or sorted
   */
  public getOpportunities(criteria?: OpportunityFilterCriteria): CanonicalOpportunity[] {
    const store = OpportunityStore.getInstance();
    if (!criteria) {
      return store.getAllOpportunities();
    }
    return store.filterOpportunities(criteria);
  }

  /**
   * Retrieves single opportunity by ID
   */
  public getOpportunityById(id: string): CanonicalOpportunity | undefined {
    return OpportunityStore.getInstance().getOpportunity(id);
  }

  /**
   * Natural language query handler
   */
  public query(queryText: string): OpportunityQueryResponse {
    return OpportunityQueryEngine.getInstance().query(queryText);
  }

  /**
   * Generates Telegram alert for high-priority opportunity
   */
  public formatTelegramAlert(opp: CanonicalOpportunity): TelegramOpportunityAlertPayload {
    return TelegramOpportunityAlertEngine.getInstance().generateAlertPayload(opp);
  }

  /**
   * Evaluates pre-trade execution eligibility against 12-Gate Authorizer & Circuit Breakers
   */
  public evaluateExecutionEligibility(opp: CanonicalOpportunity, context?: { caller?: string; isAiCaller?: boolean }) {
    return OpportunityExecutionBridge.getInstance().evaluateExecutionEligibility(opp, context);
  }

  /**
   * Starts background surveillance checking invalidation triggers
   */
  public startSurveillanceLoop(intervalMs: number = 30000): void {
    if (this.isSurveillanceRunning) return;
    this.isSurveillanceRunning = true;

    this.intervalId = setInterval(() => {
      this.recheckInvalidationTriggers();
    }, intervalMs);
  }

  public stopSurveillanceLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isSurveillanceRunning = false;
  }

  /**
   * Periodic health and invalidation check
   */
  public recheckInvalidationTriggers(): void {
    const store = OpportunityStore.getInstance();
    const all = store.getAllOpportunities();
    const now = new Date().getTime();

    for (const opp of all) {
      if (opp.decisionState === 'EXPIRED' || opp.decisionState === 'CONTRADICTED') continue;

      // 1. Expiration
      if (now > new Date(opp.expiresAt).getTime()) {
        opp.decisionState = 'EXPIRED';
        opp.actionRecommendation = 'EXPIRED';
        OpportunityLifecycleEngine.getInstance().recordTransition({
          opportunityId: opp.opportunityId,
          previousState: 'CONFIRMED',
          newState: 'EXPIRED',
          reason: 'Time-to-live expired',
          confidence: opp.confidenceScore,
          evidenceIds: opp.evidenceIds,
          actor: 'EXPIRATION_TIMER'
        });
        store.registerOpportunity(opp);
      }
    }
  }

  /**
   * Summary metrics for dashboard
   */
  public getMetricsSummary() {
    const all = OpportunityStore.getInstance().getAllOpportunities();
    const p0Count = all.filter(o => o.priorityTier === 'P0_CRITICAL').length;
    const eligibleCount = all.filter(o => o.executionEligibility.isEligible).length;
    const avgConfidence = all.length > 0 ? Math.round(all.reduce((s, o) => s + o.confidenceScore, 0) / all.length) : 0;
    const avgEV = all.length > 0 ? Number((all.reduce((s, o) => s + o.expectedValue, 0) / all.length).toFixed(2)) : 0;

    return {
      totalOpportunities: all.length,
      p0CriticalCount: p0Count,
      executionEligibleCount: eligibleCount,
      averageConfidence: avgConfidence,
      averageExpectedValue: avgEV,
      calibrationMetrics: OpportunityLearningEngine.getInstance().getCalibrationMetrics()
    };
  }
}
