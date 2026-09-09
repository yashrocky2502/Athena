/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceCorroborationEngine.ts
 * 
 * Determines whether multiple independent, authoritative sources cross-corroborate
 * the same conclusion or directional thesis.
 */

import { EvidenceObject, EvidenceCorroborationSummary, SourceTier } from './types.ts';
import { evidenceIndependenceEngine } from './EvidenceIndependenceEngine.ts';
import { sourceAuthorityEngine } from './SourceAuthorityEngine.ts';

export class EvidenceCorroborationEngine {
  private static instance: EvidenceCorroborationEngine;

  private constructor() {}

  public static getInstance(): EvidenceCorroborationEngine {
    if (!EvidenceCorroborationEngine.instance) {
      EvidenceCorroborationEngine.instance = new EvidenceCorroborationEngine();
    }
    return EvidenceCorroborationEngine.instance;
  }

  /**
   * Calculates corroboration across a set of evidence supporting a single thesis
   */
  public evaluateCorroboration(evidenceList: EvidenceObject[]): EvidenceCorroborationSummary {
    if (!evidenceList || evidenceList.length === 0) {
      return {
        corroborationScore: 0,
        totalSourcesCount: 0,
        independentSourcesCount: 0,
        syndicatedDuplicatesCount: 0,
        highestAuthorityTier: 'P4_UNVERIFIED',
        corroboratingEvidenceIds: [],
        status: 'UNVERIFIED'
      };
    }

    const independence = evidenceIndependenceEngine.analyzeIndependence(evidenceList);
    const independentCount = independence.independentSourceCount;
    const totalCount = evidenceList.length;
    const syndicatedDuplicates = totalCount - independentCount;

    // Identify highest authority tier present
    let highestTier: SourceTier = 'P4_UNVERIFIED';
    let highestTierScore = 20;

    for (const evi of evidenceList) {
      const auth = sourceAuthorityEngine.classifySource(evi.source);
      if (auth.baseAuthorityScore > highestTierScore) {
        highestTierScore = auth.baseAuthorityScore;
        highestTier = auth.tier;
      }
    }

    // Has official / regulatory source
    const hasP0 = highestTier === 'P0_AUTHORITATIVE';
    const hasP1 = highestTier === 'P1_PRIMARY';

    // Calculate corroboration score
    let corroborationScore = 0;

    if (independentCount >= 3) {
      corroborationScore = hasP0 ? 95 : (hasP1 ? 88 : 78);
    } else if (independentCount === 2) {
      corroborationScore = hasP0 ? 88 : (hasP1 ? 78 : 65);
    } else if (independentCount === 1) {
      corroborationScore = hasP0 ? 70 : (hasP1 ? 55 : 40);
    }

    // Determine status
    let status: 'STRONG_CORROBORATION' | 'MODERATE_CORROBORATION' | 'SINGLE_SOURCE' | 'UNVERIFIED' = 'UNVERIFIED';
    if (corroborationScore >= 80) {
      status = 'STRONG_CORROBORATION';
    } else if (corroborationScore >= 60) {
      status = 'MODERATE_CORROBORATION';
    } else if (independentCount === 1) {
      status = 'SINGLE_SOURCE';
    }

    return {
      corroborationScore,
      totalSourcesCount: totalCount,
      independentSourcesCount: independentCount,
      independentSourceCount: independentCount,
      contradictionDetected: false,
      syndicatedDuplicatesCount: syndicatedDuplicates,
      highestAuthorityTier: highestTier,
      corroboratingEvidenceIds: evidenceList.map(e => e.id),
      status
    };
  }
}

export const evidenceCorroborationEngine = EvidenceCorroborationEngine.getInstance();
