/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceChainEngine.ts
 * 
 * Manages DAG Evidence Chains connecting root evidence, intermediate inferences,
 * confirming market data, risk validations, and final decision nodes.
 * 
 * Guarantees:
 * • Detects cycles (DAG validation)
 * • Identifies orphan decisions / orphan evidence
 * • Computes tamper-evident cryptographic chainHash
 */

import {
  EvidenceChain,
  EvidenceNode,
  EvidenceEdge,
  EvidenceRelationshipType,
  EvidenceObject
} from './types.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';
import { deterministicConfidenceEngine } from './DeterministicConfidenceEngine.ts';

export class EvidenceChainEngine {
  private static instance: EvidenceChainEngine;
  private chains: Map<string, EvidenceChain> = new Map();

  private constructor() {}

  public static getInstance(): EvidenceChainEngine {
    if (!EvidenceChainEngine.instance) {
      EvidenceChainEngine.instance = new EvidenceChainEngine();
    }
    return EvidenceChainEngine.instance;
  }

  /**
   * Builds an EvidenceChain from nodes and edges
   */
  public buildChain(params: {
    chainId: string;
    rootEvidenceId: string;
    targetDecisionId?: string;
    nodes: EvidenceNode[];
    edges: EvidenceEdge[];
    contradictionPenalty?: number;
  }): EvidenceChain {
    const {
      chainId,
      rootEvidenceId,
      targetDecisionId,
      nodes,
      edges,
      contradictionPenalty = 0
    } = params;

    const normalizedEdges: EvidenceEdge[] = edges.map(e => ({
      ...e,
      sourceNodeId: e.sourceNodeId || e.fromNodeId || '',
      targetNodeId: e.targetNodeId || e.toNodeId || ''
    }));

    // Check for cycles using DFS
    const hasCycles = this.detectCycles(nodes, normalizedEdges);

    // Check for orphans
    const hasOrphans = this.detectOrphans(nodes, normalizedEdges, rootEvidenceId);

    // Compute chain scores
    const avgQuality = nodes.length > 0
      ? Math.round(nodes.reduce((sum, n) => sum + (n.qualityScore ?? 80), 0) / nodes.length)
      : 0;

    const avgAuthority = nodes.length > 0
      ? Math.round(nodes.reduce((sum, n) => sum + (n.authorityScore ?? 80), 0) / nodes.length)
      : 0;

    const corroboratingEdges = normalizedEdges.filter(e => e.relationship === 'CORROBORATES' || e.relationship === 'CONFIRMS' || e.relationship === 'SUPPORTS');
    const corroborationScore = Math.min(100, Math.round((corroboratingEdges.length / Math.max(1, nodes.length - 1)) * 100));

    const confidenceBreakdown = deterministicConfidenceEngine.calculateConfidence({
      sourceAuthority: avgAuthority,
      sourceReliability: 85,
      evidenceQuality: avgQuality,
      freshness: 90,
      marketConfirmation: corroborationScore > 50 ? 85 : 65,
      crossSourceCorroboration: corroborationScore,
      contradictionPenalty
    });

    const chainHash = EvidenceHashEngine.computeChainHash(nodes, normalizedEdges, '00000000');

    const chain: EvidenceChain = {
      chainId,
      rootEvidenceId,
      targetDecisionId,
      nodes,
      edges: normalizedEdges,
      chainHash,
      canonicalChainHash: chainHash,
      depth: Math.max(1, nodes.length),
      overallConfidence: confidenceBreakdown.finalConfidence,
      qualityScore: avgQuality,
      corroborationScore,
      contradictionPenalty: -contradictionPenalty,
      isComplete: !hasOrphans && !hasCycles && nodes.length > 0,
      hasOrphans,
      hasCycles,
      engineVersion: 'v24.1',
      createdAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString()
    };

    this.chains.set(chainId, chain);
    return chain;
  }

  /**
   * Helper to convert EvidenceObject into EvidenceNode
   */
  public createNodeFromEvidence(evidence: EvidenceObject, label?: string): EvidenceNode {
    return {
      nodeId: `node_${evidence.id}`,
      evidenceId: evidence.id,
      evidenceType: evidence.evidenceType,
      label: label || `${evidence.evidenceType}: ${evidence.source}`,
      timestamp: evidence.timestamp || evidence.sourceTimestamp,
      authorityScore: evidence.authorityScore,
      qualityScore: evidence.qualityScore,
      source: evidence.source,
      status: evidence.status
    };
  }

  /**
   * Helper to create EvidenceEdge
   */
  public createEdge(
    sourceNodeId: string,
    targetNodeId: string,
    relationship: EvidenceRelationshipType,
    weight: number = 1.0,
    confidence: number = 85,
    reason?: string
  ): EvidenceEdge {
    return {
      edgeId: `edge_${sourceNodeId}_${targetNodeId}_${relationship}`,
      sourceNodeId,
      targetNodeId,
      relationship,
      weight: Math.max(0, Math.min(1.0, weight)),
      confidence,
      reason,
      detectedAt: new Date().toISOString()
    };
  }

  /**
   * Cycle detection in DAG
   */
  private detectCycles(nodes: EvidenceNode[], edges: EvidenceEdge[]): boolean {
    const adj: Map<string, string[]> = new Map();
    nodes.forEach(n => adj.set(n.nodeId, []));
    edges.forEach(e => {
      if (adj.has(e.sourceNodeId)) {
        adj.get(e.sourceNodeId)!.push(e.targetNodeId);
      }
    });

    const visited: Set<string> = new Set();
    const recStack: Set<string> = new Set();

    const isCyclic = (curr: string): boolean => {
      visited.add(curr);
      recStack.add(curr);

      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          if (isCyclic(next)) return true;
        } else if (recStack.has(next)) {
          return true;
        }
      }

      recStack.delete(curr);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.nodeId)) {
        if (isCyclic(node.nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Detects disconnected nodes in chain (orphans)
   */
  private detectOrphans(nodes: EvidenceNode[], edges: EvidenceEdge[], rootEvidenceId: string): boolean {
    if (nodes.length <= 1) return false;
    const connectedNodes = new Set<string>();
    edges.forEach(e => {
      connectedNodes.add(e.sourceNodeId);
      connectedNodes.add(e.targetNodeId);
    });

    // Check if every node appears in at least one edge
    return nodes.some(n => !connectedNodes.has(n.nodeId));
  }

  public getChain(chainId: string): EvidenceChain | undefined {
    return this.chains.get(chainId);
  }

  public getAllChains(): EvidenceChain[] {
    return Array.from(this.chains.values());
  }

  public reset(): void {
    this.chains.clear();
  }
}

export const evidenceChainEngine = EvidenceChainEngine.getInstance();
