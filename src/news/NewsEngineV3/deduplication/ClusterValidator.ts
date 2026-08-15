/**
 * ATHENA NEWS ENGINE V3 — CLUSTER VALIDATOR
 * 
 * Quality and integrity validator for StoryCluster instances.
 * Guarantees that no merged cluster violates non-merge rules.
 */

import { StoryCluster, ClusterValidationResult } from './types/DeduplicationTypes';

export class ClusterValidator {
  /**
   * Validates a StoryCluster against Phase 4 quality constraints.
   */
  public static validateCluster(cluster: StoryCluster): ClusterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let conflictDetected = false;
    let conflictReason: string | undefined;

    // 1. Structural Checks
    if (!cluster.clusterId || !cluster.clusterId.trim()) {
      errors.push('CRITICAL_MISSING_CLUSTER_ID: Cluster ID is missing.');
    }

    if (!cluster.canonicalHeadline || !cluster.canonicalHeadline.trim()) {
      errors.push('CRITICAL_MISSING_HEADLINE: Canonical headline is missing or empty.');
    }

    if (!cluster.sources || cluster.sources.length === 0) {
      errors.push('CRITICAL_NO_SOURCES: Cluster must contain at least one source article.');
    }

    // 2. Score bounds check
    if (cluster.confidence < 0 || cluster.confidence > 100) {
      errors.push(`INVALID_CONFIDENCE_SCORE: Confidence score ${cluster.confidence} is out of 0-100 bounds.`);
    }

    if (cluster.verificationScore.score < 0 || cluster.verificationScore.score > 100) {
      errors.push(`INVALID_VERIFICATION_SCORE: Verification score ${cluster.verificationScore.score} is out of 0-100 bounds.`);
    }

    // 3. Multi-company cross-document conflict verification
    if (cluster.documents.length > 1) {
      const primaryTickers = new Set<string>();
      cluster.documents.forEach(doc => {
        if (doc.primaryCompany) {
          primaryTickers.add(doc.primaryCompany.ticker);
        }
      });

      if (primaryTickers.size > 1) {
        conflictDetected = true;
        conflictReason = `COMPANY_CROSS_CONFLICT: Merged documents contain multiple conflicting primary tickers: [${Array.from(primaryTickers).join(', ')}]`;
        errors.push(conflictReason);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflictDetected,
      conflictReason
    };
  }
}
