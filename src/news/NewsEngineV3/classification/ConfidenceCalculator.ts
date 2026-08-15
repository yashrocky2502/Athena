/**
 * ATHENA NEWS ENGINE V3 — CONFIDENCE CALCULATOR
 * 
 * Computes deterministic classification confidence score (0–100) based on rule weights,
 * company resolution confidence, entity density, and conflict detection status.
 */

import { CategoryMatch, ResolvedCompany } from './types/ClassificationTypes';

export class ConfidenceCalculator {
  /**
   * Calculates overall classification confidence score.
   */
  public static calculateConfidence(
    matches: CategoryMatch[],
    companies: ResolvedCompany[],
    conflictsDetected: string[]
  ): number {
    if (matches.length === 0) return 0;

    // Highest rule match score
    const topRuleConfidence = Math.max(...matches.map(m => m.confidence));

    // Company resolution contribution
    let companyScore = 80;
    if (companies.length > 0) {
      companyScore = Math.max(...companies.map(c => c.confidence));
    }

    // Base confidence formula
    let totalScore = Math.round((topRuleConfidence * 0.7) + (companyScore * 0.3));

    // Penalty if conflicts were present and resolved
    if (conflictsDetected.length > 0) {
      totalScore = Math.max(50, totalScore - 5);
    }

    // Boost if multiple rules aligned on same story
    if (matches.length > 1) {
      totalScore = Math.min(100, totalScore + 3);
    }

    return Math.max(0, Math.min(100, totalScore));
  }
}
