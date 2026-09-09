/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceIndependenceEngine.ts
 * 
 * Detects correlated and syndicated evidence to prevent artificial confirmation inflation.
 * (e.g. 5 news portals repeating the identical wire copy must NOT be treated as 5 independent sources).
 */

import { EvidenceObject } from './types.ts';

export interface IndependenceAnalysisResult {
  totalItems: number;
  independentSourceCount: number;
  syndicatedClusterCount: number;
  independenceRatio: number; // independentSourceCount / totalItems
  clusters: {
    primaryEvidenceId: string;
    primarySource: string;
    syndicatedCopies: string[];
    clusterFingerprint: string;
  }[];
}

export class EvidenceIndependenceEngine {
  private static instance: EvidenceIndependenceEngine;

  private constructor() {}

  public static getInstance(): EvidenceIndependenceEngine {
    if (!EvidenceIndependenceEngine.instance) {
      EvidenceIndependenceEngine.instance = new EvidenceIndependenceEngine();
    }
    return EvidenceIndependenceEngine.instance;
  }

  /**
   * Directly evaluates independence between two source identifiers
   */
  public evaluateIndependence(sourceA: string, sourceB: string): {
    isIndependent: boolean;
    independenceScore: number;
  } {
    const isSame = sourceA.trim().toUpperCase() === sourceB.trim().toUpperCase();
    return {
      isIndependent: !isSame,
      independenceScore: isSame ? 20 : 95
    };
  }

  /**
   * Generates a simplified semantic fingerprint for news/text payloads to detect wire syndication
   */
  private generateContentFingerprint(payload: any): string {
    if (!payload) return 'empty';
    if (typeof payload === 'string') {
      return payload.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
    }
    if (typeof payload === 'object') {
      const headline = payload.headline || payload.title || payload.summary || '';
      if (headline) {
        return String(headline).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
      }
      return JSON.stringify(payload).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
    }
    return 'unknown';
  }

  /**
   * Analyzes an array of evidence items and returns true independent sources vs syndicated copies
   */
  public analyzeIndependence(evidenceList: EvidenceObject[]): IndependenceAnalysisResult {
    if (!evidenceList || evidenceList.length === 0) {
      return {
        totalItems: 0,
        independentSourceCount: 0,
        syndicatedClusterCount: 0,
        independenceRatio: 1.0,
        clusters: []
      };
    }

    const clustersMap: Map<string, { primary: EvidenceObject; copies: EvidenceObject[] }> = new Map();
    const sourceSet: Set<string> = new Set();

    for (const evi of evidenceList) {
      const source = evi.source.toUpperCase();
      const fingerprint = evi.contentHash || this.generateContentFingerprint(evi.payload);
      const clusterKey = `${evi.evidenceType}_${fingerprint}`;

      if (clustersMap.has(clusterKey)) {
        clustersMap.get(clusterKey)!.copies.push(evi);
      } else {
        clustersMap.set(clusterKey, {
          primary: evi,
          copies: []
        });
        sourceSet.add(source);
      }
    }

    const clusters = Array.from(clustersMap.values()).map(c => ({
      primaryEvidenceId: c.primary.id,
      primarySource: c.primary.source,
      syndicatedCopies: c.copies.map(cp => `${cp.source}:${cp.id}`),
      clusterFingerprint: c.primary.contentHash || 'ch_gen'
    }));

    const independentCount = clusters.length;
    const totalItems = evidenceList.length;
    const syndicatedClusterCount = clusters.filter(c => c.syndicatedCopies.length > 0).length;
    const independenceRatio = totalItems > 0 ? Number((independentCount / totalItems).toFixed(2)) : 1.0;

    return {
      totalItems,
      independentSourceCount: independentCount,
      syndicatedClusterCount,
      independenceRatio,
      clusters
    };
  }
}

export const evidenceIndependenceEngine = EvidenceIndependenceEngine.getInstance();
