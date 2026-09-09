/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * evidenceRoutes.ts
 * 
 * Express REST API Router for Evidence, Provenance, Forensic Decisions, and Audit.
 * Mount target: /api/v5/evidence
 */

import { Router, Request, Response } from 'express';
import { evidenceStore } from '../evidence/EvidenceStore.ts';
import { evidenceChainEngine } from '../evidence/EvidenceChainEngine.ts';
import { evidenceQualityEngine } from '../evidence/EvidenceQualityEngine.ts';
import { evidenceConflictEngine } from '../evidence/EvidenceConflictEngine.ts';
import { forensicDecisionEngine } from '../evidence/ForensicDecisionEngine.ts';
import { evidenceAuditEngine } from '../evidence/EvidenceAuditEngine.ts';
import { aiEvidenceBoundaryGuard } from '../evidence/AIEvidenceBoundaryGuard.ts';
import { telegramEvidenceProofEngine } from '../evidence/TelegramEvidenceProofEngine.ts';
import { confidenceCalibrationEngine } from '../evidence/ConfidenceCalibrationEngine.ts';
import { EvidenceHashEngine } from '../evidence/EvidenceHashEngine.ts';
import { sourceAuthorityEngine } from '../evidence/SourceAuthorityEngine.ts';
import { brokerProvenanceEngine } from '../evidence/BrokerProvenanceEngine.ts';

export const evidenceRouter = Router();

// ==========================================
// 1. Search & Telemetry
// ==========================================

// GET /search - Search evidence with filters
evidenceRouter.get('/search', (req: Request, res: Response) => {
  try {
    const symbol = req.query.symbol as string | undefined;
    const entity = req.query.entity as string | undefined;
    const evidenceType = req.query.type as any;
    const source = req.query.source as string | undefined;
    const minQuality = req.query.minQuality ? Number(req.query.minQuality) : undefined;
    const minConfidence = req.query.minConfidence ? Number(req.query.minConfidence) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const results = evidenceStore.queryEvidence({
      symbol,
      entity,
      evidenceType,
      source,
      minQuality,
      minConfidence,
      limit
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /telemetry - Overall evidence and provenance health metrics
evidenceRouter.get('/telemetry', (req: Request, res: Response) => {
  try {
    const telemetry = evidenceStore.getTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /audit - Run or retrieve continuous integrity audit
evidenceRouter.get('/audit', (req: Request, res: Response) => {
  try {
    const auditRecord = evidenceAuditEngine.runFullAudit();
    res.json({ success: true, data: auditRecord });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /calibration - Confidence calibration & Brier scores
evidenceRouter.get('/calibration', (req: Request, res: Response) => {
  try {
    const report = confidenceCalibrationEngine.getCalibrationReport();
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. Forensic Decisions & Explanations
// ==========================================

// GET /decision/:decisionId - "Why did Athena decide this?"
evidenceRouter.get('/decision/:decisionId', (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;
    const decision = evidenceStore.getDecision(decisionId);

    if (!decision) {
      res.status(404).json({ success: false, error: `Decision '${decisionId}' not found in forensic store` });
      return;
    }

    const explanation = forensicDecisionEngine.explainDecision(decisionId);
    const proofCard = telegramEvidenceProofEngine.generateProofCard(decision);

    res.json({
      success: true,
      data: {
        decisionRecord: decision,
        explanation: explanation.explanationSummary,
        proofCard
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /ask-athena - Query explainability safely without hallucination
evidenceRouter.post('/ask-athena', (req: Request, res: Response) => {
  try {
    const { query, symbol, decisionId } = req.body;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter is required' });
      return;
    }

    const result = aiEvidenceBoundaryGuard.queryDeterministicExplanation({
      query,
      symbol,
      decisionId
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. Evidence Object & Provenance Inspection
// ==========================================

// GET /:id/chain - Evidence DAG chain
evidenceRouter.get('/:id/chain', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const chain = evidenceStore.getChain(id) || evidenceChainEngine.getChain(id);

    if (chain) {
      res.json({ success: true, data: chain });
      return;
    }

    // Attempt to synthesize on-demand chain if id is an evidence object
    const evidence = evidenceStore.getEvidence(id);
    if (!evidence) {
      res.status(404).json({ success: false, error: `Evidence chain or object '${id}' not found` });
      return;
    }

    const rootNode = evidenceChainEngine.createNodeFromEvidence(evidence, `Root: ${evidence.source}`);
    const chainObj = evidenceChainEngine.buildChain({
      chainId: `chain_${id}`,
      rootEvidenceId: id,
      nodes: [rootNode],
      edges: []
    });

    res.json({ success: true, data: chainObj });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id/conflicts - Conflicts associated with evidence
evidenceRouter.get('/:id/conflicts', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conflicts = evidenceStore.getAllConflicts().filter(c => c.evidenceIdA === id || c.evidenceIdB === id);
    res.json({ success: true, count: conflicts.length, data: conflicts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id/quality - Detailed quality metrics for an evidence object
evidenceRouter.get('/:id/quality', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const evidence = evidenceStore.getEvidence(id);

    if (!evidence) {
      res.status(404).json({ success: false, error: `Evidence object '${id}' not found` });
      return;
    }

    const qualityEval = evidenceQualityEngine.evaluateQuality({
      evidenceType: evidence.evidenceType,
      source: evidence.source,
      sourceTier: evidence.sourceTier,
      sourceTimestamp: evidence.sourceTimestamp,
      ingestionTimestamp: evidence.ingestionTimestamp,
      availabilityTimestamp: evidence.availabilityTimestamp,
      payload: evidence.payload
    });

    res.json({ success: true, data: qualityEval });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id/provenance - Lineage & Broker provenance trace
evidenceRouter.get('/:id/provenance', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const brokerTrace = brokerProvenanceEngine.getTrace(id);
    const evidence = evidenceStore.getEvidence(id);

    res.json({
      success: true,
      data: {
        provenanceId: evidence?.provenanceId || `prov_${id}`,
        evidenceId: id,
        brokerTrace: brokerTrace || null,
        version: evidence?.version || 1,
        supersedes: evidence?.supersedesEvidenceId || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id - Single evidence object lookup
evidenceRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const evidence = evidenceStore.getEvidence(id);

    if (!evidence) {
      res.status(404).json({ success: false, error: `Evidence '${id}' not found` });
      return;
    }

    res.json({ success: true, data: evidence });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /verify - Verifies cryptographic integrity of a submitted payload or record
evidenceRouter.post('/verify', (req: Request, res: Response) => {
  try {
    const { payload, expectedHash } = req.body;
    if (!payload) {
      res.status(400).json({ success: false, error: 'Payload is required' });
      return;
    }

    const computedHash = EvidenceHashEngine.computeContentHash(payload);
    const isValid = expectedHash ? computedHash === expectedHash : true;

    res.json({
      success: true,
      data: {
        isValid,
        computedHash,
        expectedHash: expectedHash || null,
        isTamperFree: isValid
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
