/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * AIEvidenceBoundaryGuard.ts
 * 
 * Strict safety boundary for AI interaction with the Evidence Engine.
 * 
 * CORE RULES:
 * 1. AI is an INTERPRETATION LAYER, NOT an Evidence Source.
 * 2. AI may:
 *    • Read evidence
 *    • Summarize evidence
 *    • Explain evidence in natural language
 *    • Generate human-readable reports from immutable evidence
 * 3. AI may NOT:
 *    • Create evidence
 *    • Modify evidence
 *    • Alter timestamps
 *    • Assign source authority
 *    • Override confidence
 *    • Remove contradictions
 *    • Authorize execution
 *    • Change risk decisions
 * 
 * If deterministic evidence is missing for a user query, Ask ATHENA MUST state:
 * "INSUFFICIENT_DETERMINISTIC_EVIDENCE" rather than hallucinating reasons.
 */

import { EvidenceObject, ForensicDecisionRecord } from './types.ts';
import { evidenceStore } from './EvidenceStore.ts';
import { forensicDecisionEngine } from './ForensicDecisionEngine.ts';

export interface AskAthenaEvidenceResponse {
  query: string;
  hasDeterministicEvidence: boolean;
  status: 'EVIDENCE_FOUND' | 'INSUFFICIENT_DETERMINISTIC_EVIDENCE' | 'SECURITY_BLOCKED';
  answerSummary: string;
  supportingEvidenceIds: string[];
  confidence: number;
  deterministicHash?: string;
  rawForensicRecord?: ForensicDecisionRecord;
}

export class AIEvidenceBoundaryGuard {
  private static instance: AIEvidenceBoundaryGuard;

  private constructor() {}

  public static getInstance(): AIEvidenceBoundaryGuard {
    if (!AIEvidenceBoundaryGuard.instance) {
      AIEvidenceBoundaryGuard.instance = new AIEvidenceBoundaryGuard();
    }
    return AIEvidenceBoundaryGuard.instance;
  }

  /**
   * Asserts that an incoming request is NOT attempting to mutate evidence or authorize execution
   */
  public assertPermittedAIOperation(operationType: 'READ' | 'SUMMARIZE' | 'EXPLAIN' | 'MUTATE' | 'AUTHORIZE'): void {
    if (operationType === 'MUTATE' || operationType === 'AUTHORIZE') {
      throw new Error(`[AI_BOUNDARY_VIOLATION] Operation '${operationType}' is forbidden for AI layers.`);
    }
  }

  /**
   * Processes an Ask ATHENA explainability query using strictly deterministic evidence
   */
  public queryDeterministicExplanation(params: {
    query: string;
    symbol?: string;
    decisionId?: string;
  }): AskAthenaEvidenceResponse {
    const { query, symbol, decisionId } = params;

    // 1. If querying by explicit decisionId
    if (decisionId) {
      const explanation = forensicDecisionEngine.explainDecision(decisionId);
      if (explanation.isExplainable && explanation.decisionRecord) {
        return {
          query,
          hasDeterministicEvidence: true,
          status: 'EVIDENCE_FOUND',
          answerSummary: explanation.explanationSummary,
          supportingEvidenceIds: explanation.decisionRecord.primaryEvidence.map(n => n.evidenceId),
          confidence: explanation.decisionRecord.confidence,
          deterministicHash: explanation.decisionRecord.deterministicHash,
          rawForensicRecord: explanation.decisionRecord
        };
      }
    }

    // 2. If querying by symbol (e.g. "Why is Reliance moving?")
    if (symbol) {
      const sym = symbol.toUpperCase();
      const matchingEvidence = evidenceStore.queryEvidence({ symbol: sym, limit: 10 });
      if (matchingEvidence.length > 0) {
        const topEvidence = matchingEvidence[0];
        const summary = `Deterministic evidence for ${sym} indicates: ${topEvidence.payload?.headline || topEvidence.payload?.summary || 'Market microstructure action recorded'} (Source: ${topEvidence.source}, Authority: ${topEvidence.authorityScore}/100, Quality: ${topEvidence.qualityScore}/100).`;

        return {
          query,
          hasDeterministicEvidence: true,
          status: 'EVIDENCE_FOUND',
          answerSummary: summary,
          supportingEvidenceIds: matchingEvidence.map(e => e.id),
          confidence: topEvidence.confidence,
          deterministicHash: topEvidence.canonicalHash
        };
      }
    }

    // 3. If no deterministic evidence exists, NEVER hallucinate
    return {
      query,
      hasDeterministicEvidence: false,
      status: 'INSUFFICIENT_DETERMINISTIC_EVIDENCE',
      answerSummary: 'INSUFFICIENT_DETERMINISTIC_EVIDENCE: ATHENA could not find immutable, authoritative evidence matching this query. AI speculation is prohibited.',
      supportingEvidenceIds: [],
      confidence: 0
    };
  }
}

export const aiEvidenceBoundaryGuard = AIEvidenceBoundaryGuard.getInstance();
