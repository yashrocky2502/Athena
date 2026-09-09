/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceConflictEngine.ts
 * 
 * Contradiction and Conflict Detection Engine:
 * Detects cross-source disputes, price/news divergence, volume/price anomalies,
 * and macroeconomic/market contradictions.
 * 
 * Classifications: INFO, MINOR, MATERIAL, CRITICAL
 * 
 * Invariant: MATERIAL and CRITICAL conflicts strictly propagate into risk gates.
 */

import { EvidenceConflict, ConflictSeverity, EvidenceObject } from './types.ts';

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  hasMaterialOrCriticalConflicts: boolean;
  totalPenalty: number;
  conflicts: EvidenceConflict[];
}

export class EvidenceConflictEngine {
  private static instance: EvidenceConflictEngine;

  private constructor() {}

  public static getInstance(): EvidenceConflictEngine {
    if (!EvidenceConflictEngine.instance) {
      EvidenceConflictEngine.instance = new EvidenceConflictEngine();
    }
    return EvidenceConflictEngine.instance;
  }

  /**
   * Detects conflicts between pairs or collections of evidence
   */
  public detectConflicts(params: {
    newsEvidence?: EvidenceObject[];
    marketTickEvidence?: EvidenceObject[];
    surveillanceEvidence?: EvidenceObject[];
    macroEvidence?: EvidenceObject[];
    signalDirection?: 'LONG' | 'SHORT' | 'NEUTRAL';
  } | EvidenceObject[]): ConflictDetectionResult & EvidenceConflict[] {
    const conflicts: EvidenceConflict[] = [];

    let newsEvidence: EvidenceObject[] = [];
    let marketTickEvidence: EvidenceObject[] = [];
    let surveillanceEvidence: EvidenceObject[] = [];
    let macroEvidence: EvidenceObject[] = [];
    let signalDirection: 'LONG' | 'SHORT' | 'NEUTRAL' | undefined;

    if (Array.isArray(params)) {
      // Direct array of EvidenceObjects passed
      for (const item of params) {
        if (item.evidenceType === 'MARKET_TICK_EVIDENCE' || item.evidenceType === 'ORDERBOOK_EVIDENCE') {
          marketTickEvidence.push(item);
        } else if (item.evidenceType === 'SURVEILLANCE_EVIDENCE') {
          surveillanceEvidence.push(item);
        } else if (item.evidenceType === 'MACRO_EVIDENCE') {
          macroEvidence.push(item);
        } else {
          newsEvidence.push(item);
        }
      }

      // Check cross-evidence directional contradictions
      for (let i = 0; i < params.length; i++) {
        for (let j = i + 1; j < params.length; j++) {
          const a = params[i];
          const b = params[j];
          const dirA = (a.payload?.direction || a.payload?.sentiment || '').toUpperCase();
          const dirB = (b.payload?.direction || b.payload?.sentiment || '').toUpperCase();

          const isBullA = dirA === 'BULLISH' || dirA === 'LONG' || dirA === 'POSITIVE';
          const isBearA = dirA === 'BEARISH' || dirA === 'SHORT' || dirA === 'NEGATIVE';
          const isBullB = dirB === 'BULLISH' || dirB === 'LONG' || dirB === 'POSITIVE';
          const isBearB = dirB === 'BEARISH' || dirB === 'SHORT' || dirB === 'NEGATIVE';

          if ((isBullA && isBearB) || (isBearA && isBullB)) {
            conflicts.push({
              conflictId: `conf_dir_${Date.now()}_${i}_${j}`,
              conflictType: 'DIRECTIONAL_CONTRADICTION',
              severity: 'MATERIAL',
              description: `Directional conflict between ${a.source} (${dirA}) and ${b.source} (${dirB})`,
              evidenceIdA: a.id,
              evidenceIdB: b.id,
              penaltyScore: 15,
              detectedAt: new Date().toISOString(),
              isResolved: false
            });
          }
        }
      }
    } else {
      newsEvidence = params.newsEvidence || [];
      marketTickEvidence = params.marketTickEvidence || [];
      surveillanceEvidence = params.surveillanceEvidence || [];
      macroEvidence = params.macroEvidence || [];
      signalDirection = params.signalDirection;
    }

    // 1. Check Price vs News Contradiction
    // (e.g. Bullish high-impact news, but price is falling heavily on high volume)
    for (const news of newsEvidence) {
      const newsSentiment = news.payload?.sentiment || news.payload?.expectedDirection;
      for (const tick of marketTickEvidence) {
        const priceChangePct = tick.payload?.priceChangePercent ?? tick.payload?.priceChange ?? 0;
        const volumeMultiplier = tick.payload?.volumeMultiplier ?? 1.0;

        if (newsSentiment === 'POSITIVE' || newsSentiment === 'BULLISH') {
          if (priceChangePct < -1.5 && volumeMultiplier > 1.2) {
            conflicts.push({
              conflictId: `conf_price_news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              conflictType: 'PRICE_NEWS_CONTRADICTION',
              severity: priceChangePct < -3.0 ? 'CRITICAL' : 'MATERIAL',
              description: `Bullish news from ${news.source} contradicted by sharp downward price move (${priceChangePct.toFixed(2)}%) on elevated volume`,
              evidenceIdA: news.id,
              evidenceIdB: tick.id,
              penaltyScore: priceChangePct < -3.0 ? 25 : 15,
              detectedAt: new Date().toISOString(),
              isResolved: false
            });
          }
        } else if (newsSentiment === 'NEGATIVE' || newsSentiment === 'BEARISH') {
          if (priceChangePct > 1.5 && volumeMultiplier > 1.2) {
            conflicts.push({
              conflictId: `conf_price_news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              conflictType: 'PRICE_NEWS_CONTRADICTION',
              severity: priceChangePct > 3.0 ? 'CRITICAL' : 'MATERIAL',
              description: `Bearish news from ${news.source} contradicted by strong upward price surge (+${priceChangePct.toFixed(2)}%)`,
              evidenceIdA: news.id,
              evidenceIdB: tick.id,
              penaltyScore: priceChangePct > 3.0 ? 25 : 15,
              detectedAt: new Date().toISOString(),
              isResolved: false
            });
          }
        }
      }
    }

    // 2. Check Volume / Price Divergence
    for (const tick of marketTickEvidence) {
      const priceChangePct = tick.payload?.priceChangePercent ?? 0;
      const volumeRatio = tick.payload?.volumeRatio ?? 1.0;
      if (Math.abs(priceChangePct) > 2.5 && volumeRatio < 0.3) {
        conflicts.push({
          conflictId: `conf_vol_price_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          conflictType: 'VOLUME_PRICE_CONTRADICTION',
          severity: 'MINOR',
          description: `Price move of ${priceChangePct.toFixed(2)}% occurred on critically low volume (volumeRatio: ${volumeRatio})`,
          evidenceIdA: tick.id,
          evidenceIdB: tick.id,
          penaltyScore: 8,
          detectedAt: new Date().toISOString(),
          isResolved: false
        });
      }
    }

    // 3. Check Macro vs Market Contradiction
    for (const macro of macroEvidence) {
      const crudeSurge = macro.payload?.crudeOilChangePercent ?? 0;
      const bondYieldSurge = macro.payload?.tenYearYieldChangeBps ?? 0;

      if (signalDirection === 'LONG' && crudeSurge > 3.5) {
        conflicts.push({
          conflictId: `conf_macro_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          conflictType: 'MACRO_MARKET_CONTRADICTION',
          severity: 'MINOR',
          description: `Long thesis pressured by sharp spike in Brent crude oil (+${crudeSurge.toFixed(1)}%)`,
          evidenceIdA: macro.id,
          evidenceIdB: newsEvidence[0]?.id || macro.id,
          penaltyScore: 6,
          detectedAt: new Date().toISOString(),
          isResolved: false
        });
      }
    }

    // 4. Calculate total penalty
    const totalPenalty = conflicts.reduce((sum, c) => sum + c.penaltyScore, 0);
    const hasMaterialOrCriticalConflicts = conflicts.some(c => c.severity === 'MATERIAL' || c.severity === 'CRITICAL');

    const result = {
      hasConflicts: conflicts.length > 0,
      hasMaterialOrCriticalConflicts,
      totalPenalty: Math.min(50, totalPenalty),
      conflicts
    };

    // Allow accessing both as ConflictDetectionResult and as direct conflicts array
    return Object.assign(conflicts, result) as any;
  }
}

export const evidenceConflictEngine = EvidenceConflictEngine.getInstance();
