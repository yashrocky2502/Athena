/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketSourceConsensusEngine.ts
 * 
 * Deterministic multi-source cross-validation and consensus arbitration engine.
 * ZERO-AI: Deterministic priority arbitration & divergence detection.
 */

import {
  CanonicalMarketTick,
  SourcePriorityLevel,
  MarketTruthStatus
} from './types.ts';

export interface ConsensusEvaluation {
  canonicalTick: CanonicalMarketTick;
  sourceAgreementScore: number; // 0 to 100
  confidenceScore: number;      // 0 to 100
  preferredSource: string;
  disagreementSeverity: 'NONE' | 'MINOR' | 'MATERIAL' | 'CRITICAL';
  status: MarketTruthStatus;
  participatingSources: { source: string; price: number; timestamp: string; priority: SourcePriorityLevel }[];
  divergencePercent: number;
}

export class MarketSourceConsensusEngine {
  private static instance: MarketSourceConsensusEngine;

  private priorityWeights: Record<SourcePriorityLevel, number> = {
    P0_AUTHORITATIVE: 100,
    P1_PRIMARY: 80,
    P2_SECONDARY: 50,
    P3_FALLBACK: 20
  };

  private constructor() {}

  public static getInstance(): MarketSourceConsensusEngine {
    if (!MarketSourceConsensusEngine.instance) {
      MarketSourceConsensusEngine.instance = new MarketSourceConsensusEngine();
    }
    return MarketSourceConsensusEngine.instance;
  }

  /**
   * Evaluates consensus across multiple candidate ticks for the same instrument.
   */
  public arbitrate(ticks: CanonicalMarketTick[]): ConsensusEvaluation {
    if (!ticks || ticks.length === 0) {
      throw new Error('Cannot arbitrate empty ticks array');
    }

    if (ticks.length === 1) {
      return {
        canonicalTick: ticks[0],
        sourceAgreementScore: 100,
        confidenceScore: this.priorityWeights[ticks[0].sourcePriority] || 80,
        preferredSource: ticks[0].source,
        disagreementSeverity: 'NONE',
        status: ticks[0].qualityStatus,
        participatingSources: [{
          source: ticks[0].source,
          price: ticks[0].lastPrice,
          timestamp: ticks[0].timestamp,
          priority: ticks[0].sourcePriority
        }],
        divergencePercent: 0
      };
    }

    // Sort ticks by priority descending
    const sortedTicks = [...ticks].sort((a, b) => {
      const weightA = this.priorityWeights[a.sourcePriority] || 0;
      const weightB = this.priorityWeights[b.sourcePriority] || 0;
      return weightB - weightA;
    });

    const primaryTick = sortedTicks[0];
    const prices = ticks.map(t => t.lastPrice).filter(p => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const divergencePercent = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

    let disagreementSeverity: 'NONE' | 'MINOR' | 'MATERIAL' | 'CRITICAL' = 'NONE';
    let sourceAgreementScore = 100;
    let status: MarketTruthStatus = 'VALID';

    // Tolerance thresholds:
    // Index: > 0.2% is material, > 0.6% is critical
    // Equity: > 0.5% is material, > 1.5% is critical
    const isIndex = primaryTick.assetClass === 'INDEX';
    const materialThreshold = isIndex ? 0.2 : 0.5;
    const criticalThreshold = isIndex ? 0.6 : 1.5;

    if (divergencePercent === 0) {
      disagreementSeverity = 'NONE';
      sourceAgreementScore = 100;
      status = 'VALID';
    } else if (divergencePercent < materialThreshold) {
      disagreementSeverity = 'MINOR';
      sourceAgreementScore = Math.round(100 - (divergencePercent / materialThreshold) * 20);
      status = 'VALID';
    } else if (divergencePercent < criticalThreshold) {
      disagreementSeverity = 'MATERIAL';
      sourceAgreementScore = Math.round(80 - (divergencePercent / criticalThreshold) * 40);
      status = 'DEGRADED';
    } else {
      disagreementSeverity = 'CRITICAL';
      sourceAgreementScore = 20;
      status = 'CONTRADICTED'; // Flag contradiction rather than inventing synthetic truth
    }

    // Select the authoritative/primary tick without blindly averaging
    const selectedTick = {
      ...primaryTick,
      qualityStatus: status
    };

    const participatingSources = ticks.map(t => ({
      source: t.source,
      price: t.lastPrice,
      timestamp: t.timestamp,
      priority: t.sourcePriority
    }));

    const confidenceScore = Math.min(
      this.priorityWeights[primaryTick.sourcePriority] || 80,
      sourceAgreementScore
    );

    return {
      canonicalTick: selectedTick,
      sourceAgreementScore,
      confidenceScore,
      preferredSource: primaryTick.source,
      disagreementSeverity,
      status,
      participatingSources,
      divergencePercent: Number(divergencePercent.toFixed(3))
    };
  }
}

export const marketSourceConsensusEngine = MarketSourceConsensusEngine.getInstance();
