/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * DeterministicConfidenceEngine.ts
 * 
 * Mathematically reproducible confidence calculation and decomposition engine.
 * 
 * Invariant: Confidence is 100% deterministic arithmetic.
 * AI models are strictly barred from generating or altering confidence scores.
 */

import { ConfidenceBreakdown } from './types.ts';

export interface ConfidenceInputFactors {
  sourceAuthority?: number;
  sourceAuthorityScore?: number;
  sourceReliability?: number;
  sourceReliabilityScore?: number;
  evidenceQuality?: number;
  evidenceQualityScore?: number;
  freshness?: number;
  freshnessScore?: number;
  marketConfirmation?: number;
  marketConfirmationScore?: number;
  crossSourceCorroboration?: number;
  corroborationScore?: number;
  contradictionPenalty?: number;
  calculatedAt?: string;
}

export class DeterministicConfidenceEngine {
  private static instance: DeterministicConfidenceEngine;

  // Weight constants (Sum = 1.0)
  public static readonly WEIGHT_AUTHORITY = 0.15;
  public static readonly WEIGHT_RELIABILITY = 0.15;
  public static readonly WEIGHT_QUALITY = 0.20;
  public static readonly WEIGHT_FRESHNESS = 0.15;
  public static readonly WEIGHT_MARKET_CONFIRMATION = 0.20;
  public static readonly WEIGHT_CORROBORATION = 0.15;

  private constructor() {}

  public static getInstance(): DeterministicConfidenceEngine {
    if (!DeterministicConfidenceEngine.instance) {
      DeterministicConfidenceEngine.instance = new DeterministicConfidenceEngine();
    }
    return DeterministicConfidenceEngine.instance;
  }

  /**
   * Computes deterministic decomposed confidence score
   */
  public calculateConfidence(factors: ConfidenceInputFactors): ConfidenceBreakdown {
    const {
      sourceAuthority,
      sourceReliability,
      evidenceQuality,
      freshness,
      marketConfirmation,
      crossSourceCorroboration,
      contradictionPenalty,
      calculatedAt = new Date().toISOString()
    } = factors;

    const auth = Math.max(0, Math.min(100, factors.sourceAuthority ?? factors.sourceAuthorityScore ?? 80));
    const rel = Math.max(0, Math.min(100, factors.sourceReliability ?? factors.sourceReliabilityScore ?? 80));
    const qual = Math.max(0, Math.min(100, factors.evidenceQuality ?? factors.evidenceQualityScore ?? 80));
    const fresh = Math.max(0, Math.min(100, factors.freshness ?? factors.freshnessScore ?? 80));
    const conf = Math.max(0, Math.min(100, factors.marketConfirmation ?? factors.marketConfirmationScore ?? 80));
    const corr = Math.max(0, Math.min(100, factors.crossSourceCorroboration ?? factors.corroborationScore ?? 80));
    const pen = Math.max(0, Math.min(50, factors.contradictionPenalty ?? 0));

    // Weighted base sum
    const baseScore =
      auth * DeterministicConfidenceEngine.WEIGHT_AUTHORITY +
      rel * DeterministicConfidenceEngine.WEIGHT_RELIABILITY +
      qual * DeterministicConfidenceEngine.WEIGHT_QUALITY +
      fresh * DeterministicConfidenceEngine.WEIGHT_FRESHNESS +
      conf * DeterministicConfidenceEngine.WEIGHT_MARKET_CONFIRMATION +
      corr * DeterministicConfidenceEngine.WEIGHT_CORROBORATION;

    // Subtract contradiction penalty
    const finalScore = Math.max(5, Math.min(100, Math.round(baseScore - pen)));

    const formula = `round((${auth}*0.15 + ${rel}*0.15 + ${qual}*0.20 + ${fresh}*0.15 + ${conf}*0.20 + ${corr}*0.15) - ${pen}) = ${finalScore}`;

    return {
      finalConfidence: finalScore,
      sourceAuthorityWeight: auth,
      sourceReliabilityWeight: rel,
      evidenceQualityWeight: qual,
      freshnessWeight: fresh,
      marketConfirmationWeight: conf,
      crossSourceCorroborationWeight: corr,
      contradictionPenalty: pen,
      formula,
      isDeterministic: true,
      calculatedAt
    };
  }
}

export const deterministicConfidenceEngine = DeterministicConfidenceEngine.getInstance();
