/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Continuous Decision Learning, Calibration & Attribution Engine
 */

import {
  CanonicalOpportunity,
  OpportunityAttribution,
  OpportunityDirection
} from './types';
import { OpportunityHistoricalAnalogueEngine } from './OpportunityHistoricalAnalogueEngine';

export class OpportunityLearningEngine {
  private static instance: OpportunityLearningEngine;
  private attributions: Map<string, OpportunityAttribution> = new Map();

  public static getInstance(): OpportunityLearningEngine {
    if (!OpportunityLearningEngine.instance) {
      OpportunityLearningEngine.instance = new OpportunityLearningEngine();
    }
    return OpportunityLearningEngine.instance;
  }

  /**
   * Reconciles an opportunity outcome with actual market post-trade movement
   */
  public recordOutcome(params: {
    opportunity: CanonicalOpportunity;
    actualDirection: OpportunityDirection;
    actualReturnPct: number;
    maxAdverseExcursionPct: number;
    maxFavourableExcursionPct: number;
    executionTimestamp?: string;
    closeTimestamp?: string;
  }): OpportunityAttribution {
    const opp = params.opportunity;
    const isWin = (opp.direction === 'LONG' && params.actualReturnPct > 0) ||
                  (opp.direction === 'SHORT' && params.actualReturnPct > 0);

    // Calibration error: absolute difference between predicted probability and binary outcome (1 or 0)
    const predictedProb = opp.expectedValueBreakdown.probabilityOfSuccess || (opp.confidenceScore / 100);
    const calibrationError = Number(Math.abs(predictedProb - (isWin ? 1.0 : 0.0)).toFixed(3));

    const attribution: OpportunityAttribution = {
      opportunityId: opp.opportunityId,
      predictedDirection: opp.direction,
      predictedConfidence: opp.confidenceScore,
      predictedExpectedValue: opp.expectedValue,
      actualDirection: params.actualDirection,
      actualReturnPct: params.actualReturnPct,
      maxAdverseExcursionPct: params.maxAdverseExcursionPct ?? 0,
      maxFavourableExcursionPct: params.maxFavourableExcursionPct ?? 0,
      calibrationError,
      wasSuccessful: isWin,
      regime: opp.regimeCompatibilityBreakdown.currentRegime,
      strategy: opp.opportunityType,
      evidenceQualityScore: opp.evidenceQualityScore,
      contradictionStateAtCreation: opp.contradictionScore,
      executionTimestamp: params.executionTimestamp,
      closeTimestamp: params.closeTimestamp || new Date().toISOString(),
      evaluatedAt: new Date().toISOString()
    };

    this.attributions.set(opp.opportunityId, attribution);

    // Register into Historical Analogue Engine for continuous deterministic feedback
    OpportunityHistoricalAnalogueEngine.getInstance().registerHistoricalEvent({
      eventId: `LEARNED_${opp.opportunityId}`,
      symbol: opp.instrument,
      opportunityType: opp.opportunityType,
      direction: opp.direction,
      regime: opp.regimeCompatibilityBreakdown.currentRegime,
      catalystType: opp.catalyst,
      eventTimestamp: params.closeTimestamp || new Date().toISOString(),
      actualReturnPct: params.actualReturnPct,
      maxAdverseExcursionPct: params.maxAdverseExcursionPct,
      maxFavourableExcursionPct: params.maxFavourableExcursionPct,
      isWin
    });

    return attribution;
  }

  public getAttribution(opportunityId: string): OpportunityAttribution | undefined {
    return this.attributions.get(opportunityId);
  }

  public getAllAttributions(): OpportunityAttribution[] {
    return Array.from(this.attributions.values());
  }

  /**
   * Calculates overall Brier Score / calibration accuracy
   */
  public getCalibrationMetrics(): {
    totalEvaluated: number;
    winRate: number;
    avgCalibrationError: number;
    brierScore: number;
  } {
    const list = this.getAllAttributions();
    if (list.length === 0) {
      return { totalEvaluated: 0, winRate: 0, avgCalibrationError: 0, brierScore: 0 };
    }

    const wins = list.filter(a => a.wasSuccessful).length;
    const winRate = Number((wins / list.length).toFixed(2));
    const avgCalibrationError = Number((list.reduce((sum, a) => sum + (a.calibrationError || 0), 0) / list.length).toFixed(3));
    const brierScore = Number((list.reduce((sum, a) => sum + Math.pow(a.calibrationError || 0, 2), 0) / list.length).toFixed(3));

    return {
      totalEvaluated: list.length,
      winRate,
      avgCalibrationError,
      brierScore
    };
  }
}
