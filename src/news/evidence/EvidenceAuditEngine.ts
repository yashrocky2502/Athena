/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceAuditEngine.ts
 * 
 * Continuous and on-demand forensic integrity audit engine.
 * Validates cryptographic hashes, provenance chains, timestamp availability,
 * AI security boundaries, and credential leaks across all evidence.
 */

import {
  EvidenceAuditRecord,
  EvidenceAuditIssue,
  EvidenceObject,
  EvidenceChain,
  ForensicDecisionRecord
} from './types.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';
import { evidenceStore } from './EvidenceStore.ts';
import { evidenceAvailabilityEngine } from './EvidenceAvailabilityEngine.ts';

export class EvidenceAuditEngine {
  private static instance: EvidenceAuditEngine;

  private constructor() {}

  public static getInstance(): EvidenceAuditEngine {
    if (!EvidenceAuditEngine.instance) {
      EvidenceAuditEngine.instance = new EvidenceAuditEngine();
    }
    return EvidenceAuditEngine.instance;
  }

  /**
   * Executes comprehensive system-wide audit of all evidence, chains, and decisions
   */
  public runFullAudit(): EvidenceAuditRecord {
    const issues: EvidenceAuditIssue[] = [];
    const allEvidence = evidenceStore.getAllEvidence();
    const allChains = evidenceStore.getAllChains();
    const allDecisions = evidenceStore.getAllDecisions();

    let passCount = 0;
    let warningCount = 0;
    let failCount = 0;

    // 1. Audit Evidence Objects
    for (const evi of allEvidence) {
      // 1.1 Hash integrity
      const expectedContentHash = EvidenceHashEngine.computeContentHash(evi.payload);
      if (evi.contentHash !== expectedContentHash) {
        issues.push({
          issueId: `iss_hash_${evi.id}`,
          severity: 'CRITICAL',
          type: 'INVALID_HASH',
          targetId: evi.id,
          message: `Content hash mismatch: stored (${evi.contentHash}) vs computed (${expectedContentHash})`,
          detectedAt: new Date().toISOString()
        });
        evidenceStore.incrementHashFailures();
        failCount++;
      } else {
        passCount++;
      }

      // 1.2 Timestamp integrity
      const srcMs = new Date(evi.sourceTimestamp).getTime();
      const ingMs = new Date(evi.ingestionTimestamp).getTime();
      const availMs = new Date(evi.availabilityTimestamp).getTime();

      if (isNaN(srcMs) || isNaN(ingMs) || isNaN(availMs)) {
        issues.push({
          issueId: `iss_ts_${evi.id}`,
          severity: 'CRITICAL',
          type: 'MISSING_TIMESTAMP',
          targetId: evi.id,
          message: `Corrupt or unparseable timestamps on evidence ${evi.id}`,
          detectedAt: new Date().toISOString()
        });
        failCount++;
      } else if (srcMs > ingMs + 2000) {
        issues.push({
          issueId: `iss_skew_${evi.id}`,
          severity: 'WARNING',
          type: 'FUTURE_EVIDENCE_DETECTED',
          targetId: evi.id,
          message: `Source timestamp (${evi.sourceTimestamp}) is later than ingestion timestamp (${evi.ingestionTimestamp})`,
          detectedAt: new Date().toISOString()
        });
        warningCount++;
      }

      // 1.3 Secret Exposure Check
      const stringifiedPayload = JSON.stringify(evi.payload || {});
      if (
        stringifiedPayload.includes('api_key') ||
        stringifiedPayload.includes('totp_secret') ||
        stringifiedPayload.includes('access_token')
      ) {
        issues.push({
          issueId: `iss_sec_${evi.id}`,
          severity: 'CRITICAL',
          type: 'SECRET_EXPOSURE_DETECTED',
          targetId: evi.id,
          message: `Unsanitized secret pattern found in payload of evidence ${evi.id}`,
          detectedAt: new Date().toISOString()
        });
        failCount++;
      }
    }

    // 2. Audit Evidence Chains
    for (const chain of allChains) {
      if (chain.hasCycles) {
        issues.push({
          issueId: `iss_cycle_${chain.chainId}`,
          severity: 'CRITICAL',
          type: 'BROKEN_RELATIONSHIP',
          targetId: chain.chainId,
          message: `Circular dependency detected in evidence chain ${chain.chainId}`,
          detectedAt: new Date().toISOString()
        });
        failCount++;
      }
      if (chain.hasOrphans) {
        issues.push({
          issueId: `iss_orphan_${chain.chainId}`,
          severity: 'WARNING',
          type: 'ORPHAN_EVIDENCE',
          targetId: chain.chainId,
          message: `Disconnected orphan nodes detected in chain ${chain.chainId}`,
          detectedAt: new Date().toISOString()
        });
        warningCount++;
      }
    }

    // 3. Audit Decisions
    for (const dec of allDecisions) {
      if (!dec.evidenceChainId) {
        issues.push({
          issueId: `iss_noprov_${dec.decisionId}`,
          severity: 'CRITICAL',
          type: 'MISSING_PROVENANCE',
          targetId: dec.decisionId,
          message: `Decision ${dec.decisionId} lacks an associated evidenceChainId`,
          detectedAt: new Date().toISOString()
        });
        evidenceStore.incrementProvenanceFailures();
        failCount++;
      }
    }

    // Determine overall audit status
    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (failCount > 0) {
      status = 'FAIL';
    } else if (warningCount > 0) {
      status = 'WARNING';
    }

    const auditId = `audit_${Date.now()}`;
    const auditRecord: EvidenceAuditRecord = {
      auditId,
      timestamp: new Date().toISOString(),
      totalEvidenceChecked: allEvidence.length,
      totalChainsChecked: allChains.length,
      totalDecisionsChecked: allDecisions.length,
      passCount,
      warningCount,
      failCount,
      status,
      issues,
      deterministicHash: 'aud_' + EvidenceHashEngine.sha256(`audit_${passCount}_${warningCount}_${failCount}`).substring(0, 32)
    };

    evidenceStore.updateAuditTimestamp();
    return auditRecord;
  }
}

export const evidenceAuditEngine = EvidenceAuditEngine.getInstance();
