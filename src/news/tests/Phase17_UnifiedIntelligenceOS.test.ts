/**
 * ATHENA UNIFIED INTELLIGENCE OS — Phase 17 Test Suite
 * Phase17_UnifiedIntelligenceOS.test.ts
 * 
 * Verifies 100% functional coverage of the unified orchestration and intelligence layers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AthenaEventBus } from '../intelligence/AthenaEventBus.ts';
import { AthenaContradictionEngine } from '../intelligence/AthenaContradictionEngine.ts';
import { ConfidencePropagationEngine } from '../intelligence/ConfidencePropagationEngine.ts';
import { AthenaTelemetryEngine } from '../intelligence/AthenaTelemetryEngine.ts';
import { AthenaOrchestrator } from '../intelligence/AthenaOrchestrator.ts';
import { UnifiedAthenaEvent } from '../intelligence/UnifiedIntelligenceTypes.ts';

describe('ATHENA Phase 17 — Unified Intelligence OS & Orchestration Layer', () => {
  beforeEach(() => {
    AthenaEventBus.getInstance().reset();
    AthenaContradictionEngine.getInstance().reset();
    AthenaTelemetryEngine.getInstance().reset();
    AthenaOrchestrator.getInstance().reset();
  });

  describe('AthenaEventBus', () => {
    it('should allow publishing and subscribing to unified events', async () => {
      const bus = AthenaEventBus.getInstance();
      let receivedEvent: UnifiedAthenaEvent | null = null;

      bus.subscribe('v17_unified_event', async (evt) => {
        receivedEvent = evt;
      });

      const mockEvent: UnifiedAthenaEvent = {
        schemaVersion: 'v17_unified_event',
        eventId: 'evt-101',
        correlationId: 'corr-101',
        parentEventId: null,
        timestamp: new Date().toISOString(),
        source: 'NSE',
        sourceType: 'P0',
        eventType: 'v17_unified_event',
        articleId: 'art-101',
        evidenceIds: ['art-101'],
        entityIds: ['RELIANCE'],
        sectorIds: ['OIL_GAS'],
        indexIds: ['NIFTY50'],
        macroAssetIds: [],
        marketReactionId: 'react-101',
        regimeSnapshotId: 'regime-101',
        signalId: 'sig-101',
        strategyCandidateIds: ['strat-101'],
        portfolioDecisionId: 'dec-101',
        executionIntentId: 'exec-101',
        executionOrderIds: ['ord-101'],
        fillIds: ['fill-101'],
        outcomeId: 'out-101',
        attributionId: 'att-101',
        learningRecordId: 'learn-101',
        researchHypothesisIds: [],
        strategyVariantIds: [],
        confidence: 90,
        lifecycleState: 'TRADEABLE',
        actionability: 'TRADEABLE',
        contradictionState: 'NONE',
        provenance: 'TEST',
        deterministicOrAI: 'DETERMINISTIC'
      };

      await bus.publish(mockEvent);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.eventId).toBe('evt-101');
      expect(receivedEvent!.correlationId).toBe('corr-101');
    });

    it('should enforce idempotency and deduplicate identical events', async () => {
      const bus = AthenaEventBus.getInstance();
      let callCount = 0;

      bus.subscribe('*', async () => {
        callCount++;
      });

      const mockEvent: UnifiedAthenaEvent = {
        schemaVersion: 'v17_unified_event',
        eventId: 'evt-dup',
        correlationId: 'corr-101',
        parentEventId: null,
        timestamp: new Date().toISOString(),
        source: 'NSE',
        sourceType: 'P0',
        eventType: 'TEST_EVENT',
        articleId: 'art-101',
        evidenceIds: ['art-101'],
        entityIds: ['RELIANCE'],
        sectorIds: [],
        indexIds: [],
        macroAssetIds: [],
        marketReactionId: null,
        regimeSnapshotId: null,
        signalId: null,
        strategyCandidateIds: [],
        portfolioDecisionId: null,
        executionIntentId: null,
        executionOrderIds: [],
        fillIds: [],
        outcomeId: null,
        attributionId: null,
        learningRecordId: null,
        researchHypothesisIds: [],
        strategyVariantIds: [],
        confidence: 85,
        lifecycleState: 'WATCH',
        actionability: 'WATCH',
        contradictionState: 'NONE',
        provenance: 'TEST',
        deterministicOrAI: 'DETERMINISTIC'
      };

      await bus.publish(mockEvent);
      await bus.publish(mockEvent); // Duplicate attempt

      expect(callCount).toBe(1);
    });

    it('should route failed subscriber runs to the dead-letter queue (DLQ) after retries', async () => {
      const bus = AthenaEventBus.getInstance();
      bus.subscribe('FAIL_EVENT', async () => {
        throw new Error('Subscriber simulation failure');
      });

      const mockEvent: UnifiedAthenaEvent = {
        schemaVersion: 'v17_unified_event',
        eventId: 'evt-fail',
        correlationId: 'corr-102',
        parentEventId: null,
        timestamp: new Date().toISOString(),
        source: 'NSE',
        sourceType: 'P1',
        eventType: 'FAIL_EVENT',
        articleId: 'art-102',
        evidenceIds: [],
        entityIds: [],
        sectorIds: [],
        indexIds: [],
        macroAssetIds: [],
        marketReactionId: null,
        regimeSnapshotId: null,
        signalId: null,
        strategyCandidateIds: [],
        portfolioDecisionId: null,
        executionIntentId: null,
        executionOrderIds: [],
        fillIds: [],
        outcomeId: null,
        attributionId: null,
        learningRecordId: null,
        researchHypothesisIds: [],
        strategyVariantIds: [],
        confidence: 80,
        lifecycleState: 'WATCH',
        actionability: 'WATCH',
        contradictionState: 'NONE',
        provenance: 'TEST',
        deterministicOrAI: 'DETERMINISTIC'
      };

      await bus.publish(mockEvent);

      expect(bus.getDLQ().length).toBe(1);
      expect(bus.getDLQ()[0].eventId).toBe('evt-fail');
    });
  });

  describe('AthenaContradictionEngine', () => {
    it('should detect BULLISH catalyst vs BEARISH price action as a material contradiction', () => {
      const engine = AthenaContradictionEngine.getInstance();
      const contradictions = engine.evaluate('evt-c1', {
        newsSentiment: 'BULLISH',
        priceDirection: 'BEARISH'
      });

      expect(contradictions.length).toBe(1);
      expect(contradictions[0].severity).toBe('MATERIAL');
      expect(contradictions[0].description).toContain('market price action shows Bearish');
    });

    it('should detect approved strategy with failed risk gates as a critical contradiction', () => {
      const engine = AthenaContradictionEngine.getInstance();
      const contradictions = engine.evaluate('evt-c2', {
        strategyStatus: 'APPROVED',
        portfolioRiskGatePassed: false
      });

      expect(contradictions.length).toBe(1);
      expect(contradictions[0].severity).toBe('CRITICAL');
      expect(engine.checkCriticalBlock('evt-c2')).toBe(true);
    });
  });

  describe('ConfidencePropagationEngine', () => {
    it('should adjust confidence dynamically based on evidence, source tier and market confirmation', () => {
      const engine = ConfidencePropagationEngine.getInstance();

      // High-fidelity setup
      const highFidelityReport = engine.propagate({
        sourceTier: 1,
        numericalFactCount: 3,
        marketConfirmationPassed: true,
        volumeConfirmationPassed: true,
        fnoConfirmationPassed: true,
        historicalWinRatePct: 70.0,
        strategyRobustnessScore: 90.0,
        portfolioCompatibilityScore: 95.0,
        executionSlippagePct: 0.1
      });

      expect(highFidelityReport.adjustedConfidence).toBeGreaterThan(80.0);
      expect(highFidelityReport.confidenceFactors.length).toBeGreaterThan(0);
      expect(highFidelityReport.confidenceWarnings.length).toBe(0);

      // Low-fidelity / contradiction setup
      const lowFidelityReport = engine.propagate({
        sourceTier: 3,
        numericalFactCount: 0,
        marketConfirmationPassed: false,
        volumeConfirmationPassed: false,
        fnoConfirmationPassed: false,
        historicalWinRatePct: 40.0,
        strategyRobustnessScore: 50.0,
        portfolioCompatibilityScore: 40.0,
        executionSlippagePct: 2.5
      });

      expect(lowFidelityReport.adjustedConfidence).toBeLessThan(50.0);
      expect(lowFidelityReport.confidenceWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('AthenaTelemetryEngine', () => {
    it('should record execution, latency, cache performance, and compute conversion rates', () => {
      const engine = AthenaTelemetryEngine.getInstance();

      engine.logDeterministicCall();
      engine.logCacheHit();
      engine.logCacheMiss();
      engine.logEventProcessed(true, 120);
      engine.logEventProcessed(false, 80);

      const stats = engine.getTelemetry();

      expect(stats.deterministicExecutionCount).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.averageLatencyMs).toBe(100);
      expect(stats.tradeableConversionRate).toBe(50.0);
    });
  });

  describe('AthenaOrchestrator End-To-End Integration', () => {
    it('should execute the canonical pipeline for a high-impact tradeable news catalyst', async () => {
      const orchestrator = AthenaOrchestrator.getInstance();

      const article = {
        id: 'art-success-100',
        headline: 'Reliance Industries wins record Rs 50,000 Crore order, profit surges by 25%',
        body: 'Reliance secures massive order from international consortium. Relative volume (RVOL) is 2.5. Derivatives positioning is heavily bullish.',
        entities: [{
          nseSymbol: 'RELIANCE',
          companyName: 'Reliance Industries Limited',
          sector: 'Energy & Petrochemicals',
          indices: ['NIFTY 50'],
          isFOEligible: true,
          confidence: 100
        }],
        symbol: 'RELIANCE',
        sentiment: 'BULLISH',
        source: { name: 'NSE Corporate Filing', tier: 1 },
        publishedAt: new Date().toISOString(),
        deterministicOrAI: 'DETERMINISTIC'
      };

      const decision = await orchestrator.orchestrate(article);

      expect(decision).toBeDefined();
      expect(decision.event.schemaVersion).toBe('v17_unified_event');
      expect(decision.finalDecision.decision).toBe('ADD');
      expect(decision.finalDecision.actionability).toBe('LEARNED'); // fully executed, attributed, and learned
      expect(decision.research).not.toBeNull();
      expect(decision.research!.hypothesis).toBeDefined();
      expect(decision.research!.mutatedStrategy).toBeDefined();
    });

    it('should block tradeable pipeline and result in NO_TRADE if there are critical contradictions', async () => {
      const orchestrator = AthenaOrchestrator.getInstance();

      const article = {
        id: 'art-contradicted-100',
        headline: 'HDFC Bank announces profit decline but GMP surges',
        body: 'HDFC announces results',
        entities: [{
          nseSymbol: 'HDFCBANK',
          companyName: 'HDFC Bank Limited',
          sector: 'Financial Services',
          indices: ['NIFTY 50', 'BANKNIFTY'],
          isFOEligible: true,
          confidence: 100
        }],
        symbol: 'HDFCBANK',
        sentiment: 'BULLISH',
        publishedAt: new Date().toISOString(),
        deterministicOrAI: 'DETERMINISTIC'
      };

      // Force a contradiction (news BULLISH but price BEARISH)
      const decision = await orchestrator.orchestrate(article, { forceContradiction: true });

      expect(decision.finalDecision.decision).toBe('NO_TRADE');
      expect(decision.finalDecision.actionability).toBe('NO_TRADE');
    });

    it('should support pipeline replay and identify any system drift', async () => {
      const orchestrator = AthenaOrchestrator.getInstance();

      const article = {
        id: 'art-replay-100',
        headline: 'TCS signs landmark multi-billion deal with UK retailer',
        entities: [{
          nseSymbol: 'TCS',
          companyName: 'Tata Consultancy Services Limited',
          sector: 'Information Technology',
          indices: ['NIFTY 50', 'NIFTY IT'],
          isFOEligible: true,
          confidence: 100
        }],
        symbol: 'TCS',
        sentiment: 'BULLISH',
        publishedAt: new Date().toISOString(),
        deterministicOrAI: 'DETERMINISTIC'
      };

      const originalDecision = await orchestrator.orchestrate(article);
      const replayResult = await orchestrator.replayPipeline(originalDecision.event.eventId);

      expect(replayResult.driftDetected).toBe(false);
      expect(replayResult.driftFields.length).toBe(0);
    });

    it('should correctly reconstruct lineage tracking paths from child stages back to news origin', async () => {
      const orchestrator = AthenaOrchestrator.getInstance();

      const article = {
        id: 'art-lineage-100',
        headline: 'Infosys beats Q1 analyst estimates with massive earnings beat',
        entities: [{
          nseSymbol: 'INFY',
          companyName: 'Infosys Limited',
          sector: 'Information Technology',
          indices: ['NIFTY 50', 'NIFTY IT'],
          isFOEligible: true,
          confidence: 100
        }],
        symbol: 'INFY',
        sentiment: 'BULLISH',
        publishedAt: new Date().toISOString(),
        deterministicOrAI: 'DETERMINISTIC'
      };

      const decision = await orchestrator.orchestrate(article);
      const path = orchestrator.reconstructLineage(decision.event.eventId);

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toBe('art-lineage-100');
    });

    it('should reject execution attempt when AI-originated without deterministic validation', async () => {
      const orchestrator = AthenaOrchestrator.getInstance();

      const article = {
        id: 'art-ai-unauthorized',
        headline: 'AI system recommends buying standard equity shares without reason',
        entities: [{
          nseSymbol: 'INFY',
          companyName: 'Infosys Limited',
          sector: 'Information Technology',
          indices: ['NIFTY 50', 'NIFTY IT'],
          isFOEligible: true,
          confidence: 100
        }],
        symbol: 'INFY',
        sentiment: 'BULLISH',
        publishedAt: new Date().toISOString(),
        deterministicOrAI: 'AI'
      };

      await expect(
        orchestrator.orchestrate(article, { forceAiOriginatedExecution: true })
      ).rejects.toThrow('Blocked unauthorized AI-originated execution attempt');
    });
  });
});
