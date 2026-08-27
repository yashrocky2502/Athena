/**
 * ATHENA FINANCIAL INTELLIGENCE ENGINE — PHASE 10.6
 * Phase10_6_MarketIntelligenceFusion.test.ts
 * 
 * Production Acceptance & Real-Time Reality Validation Test Suite verifying:
 * - Deterministic Scoring Weights & Components (0-100 Math)
 * - Alignment States (STRONGLY_ALIGNED, ALIGNED, CONFLICTING, NEUTRAL, etc.)
 * - Priority Tiering & Downgrades (P0_CRITICAL promotion and safety capping)
 * - Lifecycle States (ACTIVE, CONFIRMED, CONTRADICTED, WEAKENING)
 * - Cross-Asset Propagation Maps
 * - Revision-Aware Identity & Caching Integrity
 * - Observability Telemetry Counters
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { marketIntelligenceFusionEngine, MarketIntelligenceFusionEngine } from '../intelligence/MarketIntelligenceFusionEngine.ts';
import { NewsEvent } from '../types/NewsEvent.ts';
import { NewsArticle } from '../types/Article.ts';
import { MarketConfirmationDossier } from '../intelligence/MarketConfirmationEngine.ts';
import { ProductionDossier } from '../intelligence/TraderDecisionSupportEngine.ts';
import { MarketDataProviderManager } from '../market-data/MarketDataProvider.ts';
import { signalLifecycleEngine } from '../intelligence/SignalLifecycleEngine.ts';

describe('PHASE 10.6 — REAL-TIME MARKET INTELLIGENCE FUSION & SIGNAL RANKING', () => {
  let engine: MarketIntelligenceFusionEngine;

  // Set up mock inputs
  const mockEvent: any = {
    eventId: 'evt_reliance_earnings_123',
    symbol: 'RELIANCE',
    eventType: 'EARNINGS',
    eventPriority: 'P1',
    eventFreshness: 'BREAKING',
    sourceCount: 2,
    latestArticleId: 'art_financial_times_456',
    primarySource: {
      publisher: 'Financial Times',
      tier: 1,
      publishedAt: '2026-08-25T12:00:00Z',
      extractionStatus: 'SUCCESS'
    },
    conflictStatus: 'NONE'
  };

  const mockArticle: any = {
    id: 'art_financial_times_456',
    title: 'Reliance Industries Reports Outstanding Q1 Profits',
    source: 'Financial Times',
    sourceTier: 1,
    publishedAt: '2026-08-25T12:00:00Z'
  };

  beforeEach(() => {
    engine = MarketIntelligenceFusionEngine.getInstance();
    engine.clear();
    signalLifecycleEngine.clear();
    // Reset telemetry
    MarketDataProviderManager.telemetry.providerConflictCount = 0;
  });

  describe('1. Weighted Scoring Components & 0-100 Scoring Math', () => {
    it('1.1 Should evaluate fundamental catalyst strength correctly based on Tier and Materiality', () => {
      // P1 event, Tier 1 source, no conflict
      const scoreObj = (engine as any).calculateScoreComponents(mockEvent, 'TIER_1', 'BULLISH', 'POSITIVE', 'CONFIRMED', 'PUT_WRITING', []);
      expect(scoreObj.fundamentalStrength).toBe(30); // Max possible for P1 Tier 1 is 30
    });

    it('1.2 Should penalize fundamental catalyst strength when source tier is lower', () => {
      // P1 event, Tier 3 source
      const scoreObj = (engine as any).calculateScoreComponents(mockEvent, 'TIER_3', 'BULLISH', 'POSITIVE', 'CONFIRMED', 'PUT_WRITING', []);
      expect(scoreObj.fundamentalStrength).toBeLessThan(30);
    });

    it('1.3 Should compute maximum pristine score of 100 when all confirmations align perfectly', () => {
      const p0Event: NewsEvent = { ...mockEvent, eventPriority: 'P0' };
      const confirmation: MarketConfirmationDossier = {
        symbol: 'RELIANCE',
        fundamentalDirection: 'BULLISH',
        overallConfirmation: 'CONFIRMED',
        priceReaction: {
          symbol: 'RELIANCE',
          reactionDirection: 'POSITIVE',
          percentagePriceChange: 3.5,
          availability: 'AVAILABLE',
          dataTimestamp: '2026-08-25T12:05:00Z',
          dataFreshness: 'REAL_TIME'
        } as any,
        volumeConfirmation: {
          symbol: 'RELIANCE',
          confirmationStatus: 'STRONG_VOLUME_CONFIRMED' as any,
          volumeMultiple: 3.5,
          volumeAvailability: 'AVAILABLE'
        } as any,
        fnoPositioning: {
          symbol: 'RELIANCE',
          optionFlowClassification: 'PUT_WRITING',
          availability: 'AVAILABLE',
          dataTimestamp: '2026-08-25T12:05:00Z'
        } as any,
        marketInterpretation: 'Pristine alignment.'
      } as any;

      const signal = engine.fuse(p0Event, mockArticle, confirmation);
      expect(signal.signalScore).toBe(100);
      expect(signal.priority).toBe('P0_CRITICAL');
    });

    it('1.4 Should evaluate zero strength for unavailable pricing or derivatives components', () => {
      const confirmation: MarketConfirmationDossier = {
        symbol: 'RELIANCE',
        fundamentalDirection: 'BULLISH',
        overallConfirmation: 'INSUFFICIENT_EVIDENCE',
        priceReaction: {
          symbol: 'RELIANCE',
          reactionDirection: 'UNKNOWN',
          percentagePriceChange: 0,
          availability: 'NOT_AVAILABLE',
          dataTimestamp: '',
          dataFreshness: 'REAL_TIME'
        } as any,
        volumeConfirmation: {
          symbol: 'RELIANCE',
          confirmationStatus: 'INSUFFICIENT_EVIDENCE' as any,
          volumeMultiple: 1,
          volumeAvailability: 'NOT_AVAILABLE'
        } as any,
        fnoPositioning: {
          symbol: 'RELIANCE',
          optionFlowClassification: 'INSUFFICIENT_EVIDENCE',
          availability: 'NOT_AVAILABLE',
          dataTimestamp: ''
        } as any,
        marketInterpretation: 'No data.'
      } as any;

      const signal = engine.fuse(mockEvent, mockArticle, confirmation);
      expect(signal.components.marketReactionStrength).toBe(0);
      expect(signal.components.volumeStrength).toBe(0);
      expect(signal.components.fnoStrength).toBe(0);
      expect(signal.signalScore).toBeLessThan(50);
    });
  });

  describe('2. Deterministic Alignment Engine', () => {
    it('2.1 Should resolve STRONGLY_ALIGNED when all market forces move in the catalyst direction', () => {
      const alignment = (engine as any).determineAlignment('BULLISH', 'POSITIVE', 'CONFIRMED', 'PUT_WRITING');
      expect(alignment).toBe('STRONGLY_ALIGNED');
    });

    it('2.2 Should resolve CONFLICTING when price moves opposite to corporate announcement thesis', () => {
      const alignment = (engine as any).determineAlignment('BULLISH', 'NEGATIVE', 'CONFIRMED', 'PUT_WRITING');
      expect(alignment).toBe('CONFLICTING');
    });

    it('2.3 Should resolve INSUFFICIENT_EVIDENCE when components are missing or unavailable', () => {
      const alignment = (engine as any).determineAlignment('UNKNOWN', 'UNKNOWN', 'INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE');
      expect(alignment).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  describe('3. Priority Tiering & Safety-Capped Downgrades', () => {
    it('3.1 Should promote pristine high-signal events to P0_CRITICAL', () => {
      const priority = (engine as any).determinePriority('P0', 95, 'STRONGLY_ALIGNED', 'TIER_1', false, false, false);
      expect(priority).toBe('P0_CRITICAL');
    });

    it('3.2 Should safety-downgrade signals with provider conflicts to P2_MEDIUM', () => {
      // Even with maximum score and perfect alignment, baseline high signals are capped at P2 on conflicts
      const priority = (engine as any).determinePriority('P0', 95, 'STRONGLY_ALIGNED', 'TIER_1', true, false, false);
      expect(priority).toBe('P2_MEDIUM');
    });

    it('3.3 Should cap contradictory signals to P2_MEDIUM or lower to suppress noise', () => {
      const priority = (engine as any).determinePriority('P0', 85, 'CONFLICTING', 'TIER_1', false, false, true);
      expect(priority).toBe('P2_MEDIUM');
    });
  });

  describe('4. Lifecycle State Transitions', () => {
    it('4.1 Should mark pristine aligned signals as CONFIRMED', () => {
      const confirmation: MarketConfirmationDossier = {
        symbol: 'RELIANCE',
        fundamentalDirection: 'BULLISH',
        overallConfirmation: 'CONFIRMED',
        priceReaction: {
          symbol: 'RELIANCE',
          reactionDirection: 'POSITIVE',
          percentagePriceChange: 2.1,
          availability: 'AVAILABLE',
          dataTimestamp: '2026-08-25T12:00:00Z',
          dataFreshness: 'REAL_TIME'
        } as any,
        volumeConfirmation: {
          symbol: 'RELIANCE',
          confirmationStatus: 'CONFIRMED',
          volumeMultiple: 2,
          volumeAvailability: 'AVAILABLE'
        } as any,
        fnoPositioning: {
          symbol: 'RELIANCE',
          optionFlowClassification: 'PUT_WRITING',
          availability: 'AVAILABLE',
          dataTimestamp: '2026-08-25T12:00:00Z'
        } as any,
        marketInterpretation: 'Aligned.'
      } as any;

      const signal = engine.fuse(mockEvent, mockArticle, confirmation);
      expect(signal.lifecycleState).toBe('CONFIRMED');
    });

    it('4.2 Should mark aging or stale signals as WEAKENING', () => {
      const staleEvent: NewsEvent = { ...mockEvent, eventFreshness: 'STALE' };
      const signal = engine.fuse(staleEvent, mockArticle);
      expect(signal.lifecycleState).toBe('WEAKENING');
    });
  });

  describe('5. Cross-Asset & Sector Peer Propagation Maps', () => {
    it('5.1 Should propagate RELIANCE (Energy) impacts to energy sector index PEER_ENERGY', () => {
      const propagated = (engine as any).resolveCrossAssetImpacts('RELIANCE', 'EARNINGS', mockEvent);
      expect(propagated.length).toBeGreaterThan(0);
      expect(propagated[0].targetAsset).toBe('PEER_ENERGY');
      expect(propagated[0].transmissionLogic).toContain('Reliance Industries');
    });

    it('5.2 Should map TCS (IT) impacts to peer sector index PEER_IT', () => {
      const propagated = (engine as any).resolveCrossAssetImpacts('TCS', 'EARNINGS', mockEvent);
      expect(propagated.length).toBeGreaterThan(0);
      expect(propagated[0].targetAsset).toBe('PEER_IT');
    });
  });

  describe('6. Revision-Aware Identity & Caching Integrity', () => {
    it('6.1 Should assign revision-aware signal identity based on event ID, signal type, and revision', () => {
      const confirmation: MarketConfirmationDossier = {
        symbol: 'RELIANCE',
        fundamentalDirection: 'BULLISH',
        overallConfirmation: 'CONFIRMED',
        volumeConfirmation: {
          symbol: 'RELIANCE',
          confirmationStatus: 'CONFIRMED',
          volumeMultiple: 2,
          volumeAvailability: 'AVAILABLE'
        } as any
      } as any;
      const signal = engine.fuse(mockEvent, mockArticle, confirmation);
      expect(signal.signalId).toBe('evt_reliance_earnings_123::BULLISH_VOLUME_CONFIRMED::2');
    });

    it('6.2 Should serve subsequent requests from cache when components match exactly', () => {
      const confirmation: MarketConfirmationDossier = {
        symbol: 'RELIANCE',
        fundamentalDirection: 'BULLISH',
        overallConfirmation: 'CONFIRMED',
        volumeConfirmation: {
          symbol: 'RELIANCE',
          confirmationStatus: 'CONFIRMED',
          volumeMultiple: 2,
          volumeAvailability: 'AVAILABLE'
        } as any
      } as any;
      
      const firstResult = engine.fuse(mockEvent, mockArticle, confirmation);
      const secondResult = engine.fuse(mockEvent, mockArticle, confirmation);
      
      expect(firstResult).toBe(secondResult); // Reference equality check for cache hit
      expect(engine.getObservability().cacheHits).toBe(1);
    });
  });
});
