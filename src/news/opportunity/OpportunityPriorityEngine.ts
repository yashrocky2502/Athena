/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Opportunity Priority Queue & Ranking Engine
 */

import { CanonicalOpportunity, PriorityTier } from './types';

export class OpportunityPriorityEngine {
  private static instance: OpportunityPriorityEngine;

  public static getInstance(): OpportunityPriorityEngine {
    if (!OpportunityPriorityEngine.instance) {
      OpportunityPriorityEngine.instance = new OpportunityPriorityEngine();
    }
    return OpportunityPriorityEngine.instance;
  }

  /**
   * Assigns a deterministic Priority Tier based on multi-factor scores and urgency
   */
  public determinePriorityTier(opp: Partial<CanonicalOpportunity>): PriorityTier {
    const score = opp.confidenceScore ?? 50;
    const ev = opp.expectedValue ?? 0;
    const impact = opp.marketImpact ?? 'MEDIUM';
    const isEligible = opp.executionEligibility?.isEligible;
    const evidenceQuality = opp.evidenceQualityScore ?? 50;

    if (score >= 85 && ev >= 1.5 && evidenceQuality >= 80 && impact === 'HIGH') {
      return 'P0_CRITICAL';
    } else if (score >= 75 && ev >= 1.0 && isEligible) {
      return 'P1_IMMEDIATE';
    } else if (score >= 65 && ev >= 0.5) {
      return 'P2_HIGH';
    } else if (score >= 45) {
      return 'P3_MONITOR';
    } else {
      return 'P4_INFORMATIONAL';
    }
  }

  /**
   * Sorts opportunities strictly deterministically
   */
  public rankOpportunities(opportunities: CanonicalOpportunity[]): CanonicalOpportunity[] {
    const tierWeights: Record<PriorityTier, number> = {
      'P0_CRITICAL': 500,
      'P1_IMMEDIATE': 400,
      'P2_HIGH': 300,
      'P3_MONITOR': 200,
      'P4_INFORMATIONAL': 100
    };

    return [...opportunities].sort((a, b) => {
      // 1. Priority Tier
      const tierDiff = tierWeights[b.priorityTier] - tierWeights[a.priorityTier];
      if (tierDiff !== 0) return tierDiff;

      // 2. Confidence Score
      const confDiff = b.confidenceScore - a.confidenceScore;
      if (confDiff !== 0) return confDiff;

      // 3. Expected Value
      const evDiff = b.expectedValue - a.expectedValue;
      if (evDiff !== 0) return evDiff;

      // 4. Evidence Quality
      return b.evidenceQualityScore - a.evidenceQualityScore;
    });
  }
}
