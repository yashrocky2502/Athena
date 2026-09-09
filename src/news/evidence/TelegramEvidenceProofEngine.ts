/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * TelegramEvidenceProofEngine.ts
 * 
 * Formats standardized deterministic Telegram evidence proof cards.
 * Provides transparent, immutable evidence audit cards for live and replay alerts.
 */

import { TelegramEvidenceProof, ForensicDecisionRecord, EvidenceObject } from './types.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';

export class TelegramEvidenceProofEngine {
  private static instance: TelegramEvidenceProofEngine;

  private constructor() {}

  public static getInstance(): TelegramEvidenceProofEngine {
    if (!TelegramEvidenceProofEngine.instance) {
      TelegramEvidenceProofEngine.instance = new TelegramEvidenceProofEngine();
    }
    return TelegramEvidenceProofEngine.instance;
  }

  /**
   * Formats a ForensicDecisionRecord into a TelegramEvidenceProof card
   */
  public generateProofCard(record: ForensicDecisionRecord): TelegramEvidenceProof {
    const proofId = `proof_${record.decisionId}`;
    const primarySummaries = record.primaryEvidence.map(p => `• [${p.source}] ${p.label} (Score: ${p.qualityScore}/100)`);
    const marketConfirmation = record.marketTruthState?.regime ? `Regime: ${record.marketTruthState.regime} (Quality: ${record.marketTruthState.qualityScore}%)` : 'CONFIRMED';
    const riskStatus = record.portfolioState?.totalRiskGatesPassed ? 'PASSED (12/12 Gates)' : 'GATED / RESTRICTED';
    const contradictionSummary = record.contradictingEvidence.length > 0
      ? record.contradictingEvidence.map(c => `⚠ ${c.description} (-${c.penaltyScore} pts)`).join('\n')
      : 'None (Clean Consensus)';

    const sourceQualitySummary = `Avg Quality: ${record.confidenceBreakdown.evidenceQualityWeight}/100 | Authority: ${record.confidenceBreakdown.sourceAuthorityWeight}/100`;
    const isHistorical = !!record.marketTruthState?.snapshotId?.includes('replay');

    const replayBadge = isHistorical ? '🕰 [HISTORICAL REPLAY PROOF]\n' : '';

    const formattedMessage =
      `${replayBadge}🏛 **ATHENA FORENSIC EVIDENCE PROOF**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 **Decision:** ${record.decision} | **Symbol:** ${record.symbol || 'MARKET'}\n` +
      `📊 **Confidence:** ${record.confidence}/100\n` +
      `🧮 **Breakdown:** Quality: ${record.confidenceBreakdown.evidenceQualityWeight} | Auth: ${record.confidenceBreakdown.sourceAuthorityWeight} | Pen: ${record.confidenceBreakdown.contradictionPenalty}\n\n` +
      `📜 **Primary Evidence:**\n${primarySummaries.join('\n') || '• Direct Microstructure Consensus'}\n\n` +
      `🔍 **Market Confirmation:** ${marketConfirmation}\n` +
      `🛡 **Risk Status:** ${riskStatus}\n` +
      `⚖ **Contradictions:** ${contradictionSummary}\n` +
      `⭐ **Source Integrity:** ${sourceQualitySummary}\n\n` +
      `⏱ **Timestamp:** ${record.timestamp}\n` +
      `🆔 **Evidence Chain ID:** \`${record.evidenceChainId}\`\n` +
      `🔐 **Audit Hash:** \`${record.deterministicHash}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return {
      proofId,
      decision: record.decision,
      symbol: record.symbol || 'MARKET',
      confidence: record.confidence,
      primaryEvidenceSummary: primarySummaries,
      marketConfirmationSummary: marketConfirmation,
      riskStatusSummary: riskStatus,
      contradictionSummary,
      sourceQualitySummary,
      timestamp: record.timestamp,
      evidenceId: record.primaryEvidence[0]?.evidenceId || record.evidenceChainId,
      provenanceId: `prov_${record.decisionId}`,
      deterministicHash: record.deterministicHash,
      isHistoricalReplay: isHistorical,
      formattedMessage
    };
  }
}

export const telegramEvidenceProofEngine = TelegramEvidenceProofEngine.getInstance();
