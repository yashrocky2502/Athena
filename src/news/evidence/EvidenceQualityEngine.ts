/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceQualityEngine.ts
 * 
 * Deterministic quality scoring and classification engine:
 * Quality = 0.25*Authority + 0.25*Reliability + 0.20*Freshness + 0.15*Completeness + 0.15*TimestampIntegrity
 * 
 * Categories:
 * EXCELLENT (90-100), GOOD (75-89), DEGRADED (50-74), POOR (25-49), INVALID (0-24)
 * 
 * Invariant: INVALID evidence is blocked from supporting any actionable conclusion.
 */

import { EvidenceQualityStatus, EvidenceType, SourceTier } from './types.ts';
import { sourceAuthorityEngine } from './SourceAuthorityEngine.ts';
import { sourceReliabilityEngine } from './SourceReliabilityEngine.ts';
import { evidenceFreshnessEngine } from './EvidenceFreshnessEngine.ts';

export interface QualityEvaluationResult {
  qualityScore: number;
  status: EvidenceQualityStatus;
  isActionable: boolean;
  breakdown: {
    authorityScore: number;
    reliabilityScore: number;
    freshnessScore: number;
    completenessScore: number;
    timestampIntegrityScore: number;
  };
  metrics?: {
    authorityScore: number;
    reliabilityScore: number;
    freshnessScore: number;
    completenessScore: number;
    timestampIntegrityScore: number;
    timestampPrecisionScore?: number;
  };
  rejectionReason?: string;
}

export class EvidenceQualityEngine {
  private static instance: EvidenceQualityEngine;

  private constructor() {}

  public static getInstance(): EvidenceQualityEngine {
    if (!EvidenceQualityEngine.instance) {
      EvidenceQualityEngine.instance = new EvidenceQualityEngine();
    }
    return EvidenceQualityEngine.instance;
  }

  /**
   * Evaluates overall evidence quality deterministically
   */
  public evaluateQuality(params: {
    evidenceType: EvidenceType;
    source: string;
    sourceTier?: SourceTier;
    sourceTimestamp: string;
    ingestionTimestamp: string;
    availabilityTimestamp: string;
    referenceTimestamp?: string;
    payload: any;
    hasContradictions?: boolean;
  }): QualityEvaluationResult {
    const { evidenceType, source, sourceTimestamp, ingestionTimestamp, referenceTimestamp, payload, hasContradictions } = params;

    // 1. Authority Score
    const authorityScore = sourceAuthorityEngine.getAuthorityScore(source);

    // 2. Freshness Score
    const freshnessMetrics = evidenceFreshnessEngine.evaluateFreshness(
      evidenceType,
      sourceTimestamp,
      ingestionTimestamp,
      referenceTimestamp
    );
    const freshnessScore = freshnessMetrics.freshnessScore;

    // 3. Completeness Score
    let completenessScore = 100;
    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      completenessScore = 0;
    } else if (typeof payload === 'object') {
      const keys = Object.keys(payload);
      if (keys.length < 2) completenessScore = 50;
      else if (keys.some(k => payload[k] === null || payload[k] === undefined)) completenessScore = 75;
    }

    // 4. Timestamp Integrity Score
    let timestampIntegrityScore = 100;
    const srcTime = new Date(sourceTimestamp).getTime();
    const ingTime = new Date(ingestionTimestamp).getTime();

    if (isNaN(srcTime) || isNaN(ingTime)) {
      timestampIntegrityScore = 0;
    } else if (srcTime > ingTime + 1000) {
      // Source claims to be created significantly after ATHENA ingested it (clock skew / fraud)
      timestampIntegrityScore = 20;
    }

    // 5. Reliability Score
    const reliabilityScore = sourceReliabilityEngine.calculateReliability(source, {
      hasTimestamp: !isNaN(srcTime),
      isComplete: completenessScore > 50
    });

    // Weighted Mathematical Composition
    let rawScore =
      authorityScore * 0.25 +
      reliabilityScore * 0.25 +
      freshnessScore * 0.20 +
      completenessScore * 0.15 +
      timestampIntegrityScore * 0.15;

    // Apply contradiction penalty if detected
    if (hasContradictions) {
      rawScore -= 15;
    }

    const qualityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Classification
    let status: EvidenceQualityStatus = 'INVALID';
    let isActionable = true;
    let rejectionReason: string | undefined;

    if (qualityScore >= 90) {
      status = 'EXCELLENT';
    } else if (qualityScore >= 75) {
      status = 'GOOD';
    } else if (qualityScore >= 50) {
      status = 'DEGRADED';
    } else if (qualityScore >= 25) {
      status = 'POOR';
    } else {
      status = 'INVALID';
      isActionable = false;
      rejectionReason = 'Evidence quality score is below minimum actionable threshold (<25)';
    }

    if (timestampIntegrityScore === 0 || completenessScore === 0) {
      status = 'INVALID';
      isActionable = false;
      rejectionReason = 'Critical timestamp or payload defect rendered evidence INVALID';
    }

    const metrics = {
      authorityScore,
      reliabilityScore,
      freshnessScore,
      completenessScore,
      timestampIntegrityScore,
      timestampPrecisionScore: timestampIntegrityScore
    };

    return {
      qualityScore,
      status,
      isActionable,
      breakdown: metrics,
      metrics,
      rejectionReason
    };
  }
}

export const evidenceQualityEngine = EvidenceQualityEngine.getInstance();
