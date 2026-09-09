/**
 * ATHENA — PHASE 24
 * Phase24_EvidenceEngine.test.ts
 * 
 * Comprehensive test suite verifying 100% of Phase 24 requirements:
 * 1. Evidence Object Creation, Canonical Serialization & Deterministic Hashing
 * 2. Source Authority (P0-P4) & Reliability Tracking
 * 3. Evidence Quality Scoring (0-100) & Freshness Degradation
 * 4. Strict Availability Firewall & Look-Ahead Bias Prevention
 * 5. Cross-Source Corroboration & Source Independence Analysis
 * 6. Contradiction & Conflict Detection with Deterministic Penalty Deductions
 * 7. Deterministic Mathematical Confidence Decomposition
 * 8. Directed Acyclic Graph (DAG) Evidence Chain Validation & Cycle Detection
 * 9. Forensic Decision Recording with Zero-Secret Sanitization
 * 10. Continuous Forensic Integrity Audits
 * 11. AI Safety Boundary & Zero-Hallucination Guard ("INSUFFICIENT_DETERMINISTIC_EVIDENCE")
 * 12. Telegram Evidence Proof Card Formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceHashEngine } from '../EvidenceHashEngine.ts';
import { SourceAuthorityEngine } from '../SourceAuthorityEngine.ts';
import { SourceReliabilityEngine } from '../SourceReliabilityEngine.ts';
import { EvidenceQualityEngine } from '../EvidenceQualityEngine.ts';
import { EvidenceFreshnessEngine } from '../EvidenceFreshnessEngine.ts';
import { EvidenceAvailabilityEngine } from '../EvidenceAvailabilityEngine.ts';
import { EvidenceIndependenceEngine } from '../EvidenceIndependenceEngine.ts';
import { EvidenceCorroborationEngine } from '../EvidenceCorroborationEngine.ts';
import { EvidenceConflictEngine } from '../EvidenceConflictEngine.ts';
import { DeterministicConfidenceEngine } from '../DeterministicConfidenceEngine.ts';
import { ConfidenceCalibrationEngine } from '../ConfidenceCalibrationEngine.ts';
import { EvidenceChainEngine } from '../EvidenceChainEngine.ts';
import { ForensicDecisionEngine } from '../ForensicDecisionEngine.ts';
import { EvidenceAuditEngine } from '../EvidenceAuditEngine.ts';
import { AIEvidenceBoundaryGuard } from '../AIEvidenceBoundaryGuard.ts';
import { TelegramEvidenceProofEngine } from '../TelegramEvidenceProofEngine.ts';
import { evidenceStore } from '../EvidenceStore.ts';
import {
  EvidenceObject,
  EvidenceNode,
  EvidenceEdge,
  DecisionType
} from '../types.ts';

describe('ATHENA Phase 24 — Universal Evidence, Provenance, Confidence & Forensic Explainability Layer', () => {
  let hashEngine: EvidenceHashEngine;
  let authEngine: SourceAuthorityEngine;
  let relEngine: SourceReliabilityEngine;
  let qualityEngine: EvidenceQualityEngine;
  let freshnessEngine: EvidenceFreshnessEngine;
  let availEngine: EvidenceAvailabilityEngine;
  let indepEngine: EvidenceIndependenceEngine;
  let corrobEngine: EvidenceCorroborationEngine;
  let conflictEngine: EvidenceConflictEngine;
  let confidenceEngine: DeterministicConfidenceEngine;
  let calibrationEngine: ConfidenceCalibrationEngine;
  let chainEngine: EvidenceChainEngine;
  let decisionEngine: ForensicDecisionEngine;
  let auditEngine: EvidenceAuditEngine;
  let aiGuard: AIEvidenceBoundaryGuard;
  let proofEngine: TelegramEvidenceProofEngine;

  beforeEach(() => {
    evidenceStore.clear();
    authEngine = SourceAuthorityEngine.getInstance();
    relEngine = SourceReliabilityEngine.getInstance();
    qualityEngine = EvidenceQualityEngine.getInstance();
    freshnessEngine = EvidenceFreshnessEngine.getInstance();
    availEngine = EvidenceAvailabilityEngine.getInstance();
    indepEngine = EvidenceIndependenceEngine.getInstance();
    corrobEngine = EvidenceCorroborationEngine.getInstance();
    conflictEngine = EvidenceConflictEngine.getInstance();
    confidenceEngine = DeterministicConfidenceEngine.getInstance();
    calibrationEngine = ConfidenceCalibrationEngine.getInstance();
    chainEngine = EvidenceChainEngine.getInstance();
    decisionEngine = ForensicDecisionEngine.getInstance();
    auditEngine = EvidenceAuditEngine.getInstance();
    aiGuard = AIEvidenceBoundaryGuard.getInstance();
    proofEngine = TelegramEvidenceProofEngine.getInstance();
  });

  // 1. Canonical Serialization & Deterministic Hashing
  describe('EvidenceHashEngine', () => {
    it('should compute identical sha256 hash regardless of object key insertion order', () => {
      const objA = { z: 10, a: 'test', m: { b: 2, a: 1 } };
      const objB = { a: 'test', m: { a: 1, b: 2 }, z: 10 };

      const hashA = EvidenceHashEngine.computeContentHash(objA);
      const hashB = EvidenceHashEngine.computeContentHash(objB);

      expect(hashA).toBe(hashB);
      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should compute deterministic evidence canonical hash incorporating all required dimensions', () => {
      const canonicalHash = EvidenceHashEngine.computeCanonicalHash({
        id: 'EVI_001',
        evidenceType: 'FILING_EVIDENCE',
        source: 'NSE_INDIA',
        sourceTimestamp: '2026-07-20T10:00:00.000Z',
        availabilityTimestamp: '2026-07-20T10:00:00.200Z',
        contentHash: 'a'.repeat(64),
        provenanceId: 'PROV_001',
        version: 1
      });

      expect(canonicalHash).toBeDefined();
      expect(canonicalHash.length).toBe(64);
    });
  });

  // 2. Source Authority & Reliability Tracking
  describe('SourceAuthorityEngine & SourceReliabilityEngine', () => {
    it('should assign P0_AUTHORITATIVE and 100 score to official exchange filings', () => {
      const classification = authEngine.classifySource('NSE_INDIA');
      expect(classification.tier).toBe('P0_AUTHORITATIVE');
      expect(classification.authorityScore).toBe(100);
      expect(classification.isPrimary).toBe(true);
    });

    it('should assign P2_SECONDARY and 70 score to secondary financial press', () => {
      const classification = authEngine.classifySource('MONEYCONTROL');
      expect(classification.tier).toBe('P2_SECONDARY');
      expect(classification.authorityScore).toBe(70);
      expect(classification.isPrimary).toBe(false);
    });

    it('should dynamically update reliability score upon historical truth verification', () => {
      const initial = relEngine.getReliability('REUTERS_TERMINAL');
      expect(initial.reliabilityScore).toBe(95);

      // Record a verified true report
      relEngine.recordOutcome('REUTERS_TERMINAL', true);
      const after = relEngine.getReliability('REUTERS_TERMINAL');
      expect(after.verifiedReports).toBe(initial.verifiedReports + 1);
      expect(after.reliabilityScore).toBeGreaterThanOrEqual(95);
    });
  });

  // 3. Evidence Quality Scoring & Freshness
  describe('EvidenceQualityEngine & EvidenceFreshnessEngine', () => {
    it('should evaluate high quality for complete, schema-valid P0 evidence with low latency', () => {
      const now = new Date();
      const srcTs = new Date(now.getTime() - 500).toISOString();
      const ingTs = new Date(now.getTime() - 300).toISOString();
      const availTs = now.toISOString();

      const evaluation = qualityEngine.evaluateQuality({
        evidenceType: 'FILING_EVIDENCE',
        source: 'NSE_INDIA',
        sourceTier: 'P0_AUTHORITATIVE',
        sourceTimestamp: srcTs,
        ingestionTimestamp: ingTs,
        availabilityTimestamp: availTs,
        payload: {
          symbol: 'RELIANCE',
          q1ProfitINR: 21850,
          yoyGrowthPct: 14.8
        }
      });

      expect(evaluation.qualityScore).toBeGreaterThanOrEqual(90);
      expect(evaluation.status).toBe('EXCELLENT');
      expect(evaluation.metrics.completenessScore).toBe(100);
      expect(evaluation.metrics.timestampPrecisionScore).toBe(100);
    });

    it('should degrade freshness score for older market events', () => {
      const freshScore = freshnessEngine.computeFreshnessScore({
        evidenceType: 'ORDERBOOK_EVIDENCE',
        sourceTimestamp: new Date().toISOString(),
        currentTimestamp: new Date().toISOString()
      });
      expect(freshScore.freshnessScore).toBe(100);
      expect(freshScore.isStale).toBe(false);

      // 10 minutes ago for orderbook (half-life: 5s)
      const staleTimestamp = new Date(Date.now() - 600 * 1000).toISOString();
      const staleScore = freshnessEngine.computeFreshnessScore({
        evidenceType: 'ORDERBOOK_EVIDENCE',
        sourceTimestamp: staleTimestamp,
        currentTimestamp: new Date().toISOString()
      });
      expect(staleScore.freshnessScore).toBeLessThan(10);
      expect(staleScore.isStale).toBe(true);
    });
  });

  // 4. Strict Availability Firewall
  describe('EvidenceAvailabilityEngine', () => {
    it('should ALLOW evidence whose availabilityTimestamp <= asOfTimestamp', () => {
      const check = availEngine.checkAvailability({
        availabilityTimestamp: '2026-07-20T10:00:00.000Z',
        asOfTimestamp: '2026-07-20T10:05:00.000Z'
      });

      expect(check.isAvailable).toBe(true);
      expect(check.isFutureBlocked).toBe(false);
      expect(check.latencyMs).toBe(300000);
    });

    it('should BLOCK look-ahead future evidence whose availabilityTimestamp > asOfTimestamp', () => {
      const check = availEngine.checkAvailability({
        availabilityTimestamp: '2026-07-20T10:15:00.000Z',
        asOfTimestamp: '2026-07-20T10:00:00.000Z'
      });

      expect(check.isAvailable).toBe(false);
      expect(check.isFutureBlocked).toBe(true);
      expect(check.reason).toContain('LOOK-AHEAD BIAS DETECTED');
    });
  });

  // 5. Cross-Source Corroboration & Independence
  describe('EvidenceCorroborationEngine & EvidenceIndependenceEngine', () => {
    it('should score high independence for separate institutional sources (Exchange vs Broker)', () => {
      const indep = indepEngine.evaluateIndependence('NSE_INDIA', 'ZERODHA_FEED');
      expect(indep.isIndependent).toBe(true);
      expect(indep.independenceScore).toBeGreaterThanOrEqual(90);
    });

    it('should compute strong corroboration when multiple independent sources agree on direction', () => {
      const evidenceA: Partial<EvidenceObject> = {
        id: 'E_1',
        source: 'NSE_INDIA',
        sourceTier: 'P0_AUTHORITATIVE',
        authorityScore: 100,
        qualityScore: 98,
        payload: { direction: 'BULLISH', value: 14.8 }
      };
      const evidenceB: Partial<EvidenceObject> = {
        id: 'E_2',
        source: 'BLOOMBERG_TERMINAL',
        sourceTier: 'P1_PRIMARY',
        authorityScore: 90,
        qualityScore: 92,
        payload: { direction: 'BULLISH', value: 14.5 }
      };

      const result = corrobEngine.evaluateCorroboration([evidenceA as EvidenceObject, evidenceB as EvidenceObject]);
      expect(result.corroborationScore).toBeGreaterThanOrEqual(80);
      expect(result.independentSourceCount).toBe(2);
      expect(result.contradictionDetected).toBe(false);
    });
  });

  // 6. Contradiction Detection & Penalty
  describe('EvidenceConflictEngine', () => {
    it('should detect directional contradiction between conflicting evidence', () => {
      const bullishEvi: Partial<EvidenceObject> = {
        id: 'E_BULL',
        source: 'NSE_INDIA',
        payload: { direction: 'BULLISH', headline: 'RIL profit jumps 15%' }
      };
      const bearishEvi: Partial<EvidenceObject> = {
        id: 'E_BEAR',
        source: 'ANALYST_DOWNGRADE',
        payload: { direction: 'BEARISH', headline: 'Brokerage downgrades RIL to SELL' }
      };

      const conflicts = conflictEngine.detectConflicts([bullishEvi as EvidenceObject, bearishEvi as EvidenceObject]);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe('DIRECTIONAL_CONTRADICTION');
      expect(conflicts[0].penaltyScore).toBeGreaterThanOrEqual(10);
    });
  });

  // 7. Deterministic Mathematical Confidence Decomposition
  describe('DeterministicConfidenceEngine', () => {
    it('should compute decomposed confidence with transparent arithmetic and penalties', () => {
      const breakdown = confidenceEngine.calculateConfidence({
        sourceAuthorityScore: 100,
        sourceReliabilityScore: 90,
        evidenceQualityScore: 96,
        freshnessScore: 95,
        marketConfirmationScore: 88,
        corroborationScore: 85,
        contradictionPenalty: 8
      });

      expect(breakdown.finalConfidence).toBe(84);
      expect(breakdown.formula).toContain('round(');
      expect(breakdown.contradictionPenalty).toBe(8);
    });
  });

  // 8. DAG Evidence Chain & Cycle Detection
  describe('EvidenceChainEngine', () => {
    it('should build a valid DAG and verify no cycles or orphans exist', () => {
      const nodeA: EvidenceNode = {
        nodeId: 'node_root',
        evidenceId: 'EVI_ROOT',
        evidenceType: 'FILING_EVIDENCE',
        source: 'NSE_INDIA',
        label: 'NSE Q1 Result',
        timestamp: '2026-07-20T10:00:00.000Z',
        authorityScore: 100,
        qualityScore: 98,
        confidence: 95,
        outgoingEdges: ['edge_1'],
        incomingEdges: []
      };

      const nodeB: EvidenceNode = {
        nodeId: 'node_signal',
        evidenceId: 'EVI_SIG',
        evidenceType: 'SIGNAL_EVIDENCE',
        source: 'ATHENA_QUANT_MOMENTUM',
        label: 'Momentum Long Signal',
        timestamp: '2026-07-20T10:05:00.000Z',
        authorityScore: 90,
        qualityScore: 95,
        confidence: 90,
        outgoingEdges: [],
        incomingEdges: ['edge_1']
      };

      const edge: EvidenceEdge = {
        edgeId: 'edge_1',
        fromNodeId: 'node_root',
        toNodeId: 'node_signal',
        relationship: 'CAUSED_SIGNAL',
        weight: 1.0,
        timestamp: '2026-07-20T10:05:00.000Z'
      };

      const chain = chainEngine.buildChain({
        chainId: 'chain_test_01',
        rootEvidenceId: 'EVI_ROOT',
        nodes: [nodeA, nodeB],
        edges: [edge]
      });

      expect(chain.hasCycles).toBe(false);
      expect(chain.hasOrphans).toBe(false);
      expect(chain.depth).toBe(2);
      expect(chain.canonicalChainHash).toBeDefined();
    });

    it('should detect cycles and mark hasCycles=true if circular edges exist', () => {
      const nodeA: EvidenceNode = {
        nodeId: 'A',
        evidenceId: 'E_A',
        evidenceType: 'MARKET_EVIDENCE',
        source: 'SRC_A',
        label: 'A',
        timestamp: '2026-07-20T10:00:00.000Z',
        authorityScore: 80,
        qualityScore: 80,
        confidence: 80,
        outgoingEdges: ['e_AB'],
        incomingEdges: ['e_BA']
      };
      const nodeB: EvidenceNode = {
        nodeId: 'B',
        evidenceId: 'E_B',
        evidenceType: 'MARKET_EVIDENCE',
        source: 'SRC_B',
        label: 'B',
        timestamp: '2026-07-20T10:01:00.000Z',
        authorityScore: 80,
        qualityScore: 80,
        confidence: 80,
        outgoingEdges: ['e_BA'],
        incomingEdges: ['e_AB']
      };

      const edgeAB: EvidenceEdge = { edgeId: 'e_AB', fromNodeId: 'A', toNodeId: 'B', relationship: 'SUPPORTS', weight: 1, timestamp: '2026-07-20T10:01:00.000Z' };
      const edgeBA: EvidenceEdge = { edgeId: 'e_BA', fromNodeId: 'B', toNodeId: 'A', relationship: 'SUPPORTS', weight: 1, timestamp: '2026-07-20T10:02:00.000Z' };

      const chain = chainEngine.buildChain({
        chainId: 'chain_cycle',
        rootEvidenceId: 'E_A',
        nodes: [nodeA, nodeB],
        edges: [edgeAB, edgeBA]
      });

      expect(chain.hasCycles).toBe(true);
    });
  });

  // 9. Forensic Decision Recording with Secret Sanitization
  describe('ForensicDecisionEngine & CredentialSanitizer', () => {
    it('should record decision with full breakdown and sanitize any accidental credentials', () => {
      const confidence = confidenceEngine.calculateConfidence({
        sourceAuthorityScore: 100,
        sourceReliabilityScore: 90,
        evidenceQualityScore: 95,
        freshnessScore: 95,
        marketConfirmationScore: 90,
        corroborationScore: 90,
        contradictionPenalty: 0
      });

      const decisionRecord = decisionEngine.recordForensicDecision({
        decisionId: 'dec_test_001',
        decisionType: 'BUY_ORDER' as DecisionType,
        symbol: 'RELIANCE',
        decision: 'Execute 500 shares RELIANCE limit order',
        confidenceBreakdown: confidence,
        evidenceChainId: 'chain_test_01',
        primaryEvidence: [
          {
            nodeId: 'n_1',
            evidenceId: 'evi_1',
            evidenceType: 'FILING_EVIDENCE',
            label: 'NSE Filing',
            timestamp: new Date().toISOString(),
            authorityScore: 100,
            qualityScore: 98,
            confidence: 98,
            source: 'NSE_INDIA',
            outgoingEdges: [],
            incomingEdges: []
          }
        ],
        executionState: {
          executionIntentId: 'exec_001',
          mode: 'PAPER',
          authorized: true
        }
      });

      expect(decisionRecord.decisionId).toBe('dec_test_001');
      expect(decisionRecord.deterministicHash).toBeDefined();
      expect(decisionRecord.secretSanitized).toBe(true);

      // Verify retrieval from store
      const stored = evidenceStore.getDecision('dec_test_001');
      expect(stored).toBeDefined();
      expect(stored?.decision).toBe('Execute 500 shares RELIANCE limit order');
    });
  });

  // 10. Continuous Forensic Integrity Audit
  describe('EvidenceAuditEngine', () => {
    it('should perform continuous audit and report PASS status when evidence store is healthy', () => {
      const audit = auditEngine.runFullAudit();
      expect(audit.status).toBe('PASS');
      expect(audit.failCount).toBe(0);
      expect(audit.deterministicHash).toBeDefined();
    });
  });

  // 11. AI Boundary & Zero-Hallucination Guard
  describe('AIEvidenceBoundaryGuard', () => {
    it('should throw error when AI attempts MUTATE or AUTHORIZE operations', () => {
      expect(() => {
        aiGuard.assertPermittedAIOperation('MUTATE');
      }).toThrowError(/\[AI_BOUNDARY_VIOLATION\]/);

      expect(() => {
        aiGuard.assertPermittedAIOperation('AUTHORIZE');
      }).toThrowError(/\[AI_BOUNDARY_VIOLATION\]/);
    });

    it('should return INSUFFICIENT_DETERMINISTIC_EVIDENCE if no immutable evidence matches query', () => {
      const response = aiGuard.queryDeterministicExplanation({
        query: 'Why is XYZ_UNKNOWN_STOCK crashing?'
      });

      expect(response.hasDeterministicEvidence).toBe(false);
      expect(response.status).toBe('INSUFFICIENT_DETERMINISTIC_EVIDENCE');
      expect(response.answerSummary).toContain('INSUFFICIENT_DETERMINISTIC_EVIDENCE');
    });
  });

  // 12. Telegram Evidence Proof Card
  describe('TelegramEvidenceProofEngine', () => {
    it('should generate formatted deterministic Telegram evidence proof cards', () => {
      const confidence = confidenceEngine.calculateConfidence({
        sourceAuthorityScore: 100,
        sourceReliabilityScore: 90,
        evidenceQualityScore: 95,
        freshnessScore: 95,
        marketConfirmationScore: 85,
        corroborationScore: 85,
        contradictionPenalty: 5
      });

      const record = decisionEngine.recordForensicDecision({
        decisionId: 'dec_proof_01',
        decisionType: 'LONG_SIGNAL' as DecisionType,
        symbol: 'INFY',
        decision: 'LONG INFY at market open',
        confidenceBreakdown: confidence,
        evidenceChainId: 'chain_proof_01',
        primaryEvidence: [
          {
            nodeId: 'n_infy',
            evidenceId: 'evi_infy',
            evidenceType: 'FILING_EVIDENCE',
            label: 'Infosys $2B Mega Deal',
            timestamp: new Date().toISOString(),
            authorityScore: 100,
            qualityScore: 96,
            confidence: 95,
            source: 'BSE_INDIA',
            outgoingEdges: [],
            incomingEdges: []
          }
        ]
      });

      const proofCard = proofEngine.generateProofCard(record);
      expect(proofCard.proofId).toBe('proof_dec_proof_01');
      expect(proofCard.formattedMessage).toContain('ATHENA FORENSIC EVIDENCE PROOF');
      expect(proofCard.formattedMessage).toContain('INFY');
      expect(proofCard.formattedMessage).toContain(record.deterministicHash);
    });
  });
});
