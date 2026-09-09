/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * NewsMarketEvidenceEngine.ts
 * 
 * Establishes deterministic news-to-market evidence transmission:
 * News -> Affected Entities -> Affected Sectors -> Expected Direction ->
 * Observed Price/Volume/OI/IV reaction -> Transmission Score -> Market Confirmation -> Contradiction Status.
 * 
 * Answers with deterministic evidence: "Why did this news matter?"
 */

import { NewsMarketEvidence, EvidenceObject, SourceTier } from './types.ts';
import { sourceAuthorityEngine } from './SourceAuthorityEngine.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';

export class NewsMarketEvidenceEngine {
  private static instance: NewsMarketEvidenceEngine;

  private constructor() {}

  public static getInstance(): NewsMarketEvidenceEngine {
    if (!NewsMarketEvidenceEngine.instance) {
      NewsMarketEvidenceEngine.instance = new NewsMarketEvidenceEngine();
    }
    return NewsMarketEvidenceEngine.instance;
  }

  /**
   * Constructs a structured NewsMarketEvidence record linking news to actual market microstructure reaction
   */
  public correlateNewsToMarket(params: {
    newsEvidence: EvidenceObject;
    priceReactionPercent?: number;
    volumeMultiplier?: number;
    oiChangePercent?: number;
    ivChangePercent?: number;
    affectedEntities?: string[];
    affectedSectors?: string[];
    expectedDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
  }): NewsMarketEvidence {
    const {
      newsEvidence,
      priceReactionPercent = 0,
      volumeMultiplier = 1.0,
      oiChangePercent = 0,
      ivChangePercent = 0,
      affectedEntities = newsEvidence.symbol ? [newsEvidence.symbol] : (newsEvidence.entity ? [newsEvidence.entity] : []),
      affectedSectors = newsEvidence.sector ? [newsEvidence.sector] : [],
      expectedDirection = (newsEvidence.payload?.sentiment === 'POSITIVE' ? 'BULLISH' : (newsEvidence.payload?.sentiment === 'NEGATIVE' ? 'BEARISH' : 'NEUTRAL'))
    } = params;

    const sourceTier: SourceTier = newsEvidence.sourceTier || sourceAuthorityEngine.classifySource(newsEvidence.source).tier;
    const headline = newsEvidence.payload?.headline || newsEvidence.payload?.title || 'Company Disclosure';

    // Market confirmation scoring logic
    let marketConfirmation: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTED' | 'PENDING' = 'PENDING';
    let contradictionDetails: string | undefined;
    let transmissionScore = 50;

    const isDirectionConfirmed =
      (expectedDirection === 'BULLISH' && priceReactionPercent > 0.4) ||
      (expectedDirection === 'BEARISH' && priceReactionPercent < -0.4);

    const isDirectionContradicted =
      (expectedDirection === 'BULLISH' && priceReactionPercent < -0.8) ||
      (expectedDirection === 'BEARISH' && priceReactionPercent > 0.8);

    if (isDirectionContradicted) {
      marketConfirmation = 'CONTRADICTED';
      contradictionDetails = `Expected ${expectedDirection} thesis contradicted by observed price reaction (${priceReactionPercent.toFixed(2)}%)`;
      transmissionScore = 20;
    } else if (isDirectionConfirmed) {
      if (volumeMultiplier >= 1.5 || Math.abs(oiChangePercent) >= 5) {
        marketConfirmation = 'STRONG';
        transmissionScore = Math.min(98, Math.round(75 + Math.min(20, Math.abs(priceReactionPercent) * 5) + (volumeMultiplier - 1) * 5));
      } else {
        marketConfirmation = 'MODERATE';
        transmissionScore = 70;
      }
    } else {
      marketConfirmation = 'WEAK';
      transmissionScore = 45;
    }

    return {
      newsEvidenceId: newsEvidence.id,
      headline,
      source: newsEvidence.source,
      sourceTier,
      publishedAt: newsEvidence.sourceTimestamp,
      affectedEntities,
      affectedSectors,
      expectedDirection,
      observedPriceReactionPercent: priceReactionPercent,
      observedVolumeMultiplier: volumeMultiplier,
      observedOIChangePercent: oiChangePercent,
      observedIVChangePercent: ivChangePercent,
      marketConfirmation,
      contradictionDetails,
      transmissionScore
    };
  }
}

export const newsMarketEvidenceEngine = NewsMarketEvidenceEngine.getInstance();
