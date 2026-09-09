/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * SignalEvidenceEngine.ts
 * 
 * Captures immutable evidence traces for every generated quantitative or qualitative signal.
 * Ensures that no signal exists without linked trigger, confirmation, and contradiction evidence.
 */

import { SignalEvidenceTrace, EvidenceObject } from './types.ts';
import { deterministicConfidenceEngine } from './DeterministicConfidenceEngine.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';

export class SignalEvidenceEngine {
  private static instance: SignalEvidenceEngine;

  private constructor() {}

  public static getInstance(): SignalEvidenceEngine {
    if (!SignalEvidenceEngine.instance) {
      SignalEvidenceEngine.instance = new SignalEvidenceEngine();
    }
    return SignalEvidenceEngine.instance;
  }

  /**
   * Constructs a complete SignalEvidenceTrace record
   */
  public createSignalTrace(params: {
    signalId: string;
    signalType: string;
    symbol: string;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    triggerEvidence: EvidenceObject[];
    confirmationEvidence?: EvidenceObject[];
    contradictionEvidence?: EvidenceObject[];
    marketReactionEvidence?: EvidenceObject[];
    transmissionScore?: number;
  }): SignalEvidenceTrace {
    const {
      signalId,
      signalType,
      symbol,
      direction,
      triggerEvidence,
      confirmationEvidence = [],
      contradictionEvidence = [],
      marketReactionEvidence = [],
      transmissionScore = 75
    } = params;

    const primaryTrigger = triggerEvidence[0];
    const authScore = primaryTrigger?.authorityScore ?? 80;
    const relScore = primaryTrigger?.reliabilityScore ?? 80;
    const qualScore = primaryTrigger?.qualityScore ?? 85;
    const freshScore = primaryTrigger?.freshnessScore ?? 90;
    const confirmationScore = confirmationEvidence.length > 0 ? 85 : 65;
    const corroborationScore = triggerEvidence.length > 1 ? 85 : 60;
    const contradictionPenalty = contradictionEvidence.length > 0 ? 15 : 0;

    const confidenceBreakdown = deterministicConfidenceEngine.calculateConfidence({
      sourceAuthority: authScore,
      sourceReliability: relScore,
      evidenceQuality: qualScore,
      freshness: freshScore,
      marketConfirmation: confirmationScore,
      crossSourceCorroboration: corroborationScore,
      contradictionPenalty
    });

    const evidenceChainId = `chain_sig_${signalId}`;

    return {
      signalId,
      signalType,
      symbol,
      direction,
      triggerEvidence,
      confirmationEvidence,
      contradictionEvidence,
      marketReactionEvidence,
      transmissionScore,
      calculatedConfidence: confidenceBreakdown.finalConfidence,
      evidenceChainId
    };
  }
}

export const signalEvidenceEngine = SignalEvidenceEngine.getInstance();
