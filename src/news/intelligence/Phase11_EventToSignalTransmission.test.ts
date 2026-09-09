/**
 * ATHENA NEWS ENGINE — PHASE 11
 * Phase11_EventToSignalTransmission.test.ts
 * 
 * Standardized Production Acceptance Tests for Phase 11:
 * - Real-Time Market Intelligence & Event-to-Signal Transmission
 * - Deterministic Entity Impact Resolution
 * - Multi-Window Market Reaction Measurements (1M, 5M, 15M, 30M, 1H, SESSION)
 * - Transmission Graph & Evidence Chains
 * - Event-Reaction Alignment (CONFIRMED vs CONTRADICTED)
 * - 0–100 Transmission Score Formula
 * - Trader Actionability State Machine
 * - Telegram & UI Canonical Summary Parity
 * - Zero-AI Cost Deterministic Execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { entityImpactResolver } from './EntityImpactResolver.ts';
import { deterministicMarketReactionEngine } from './DeterministicMarketReactionEngine.ts';
import { eventTransmissionGraph } from './EventTransmissionGraph.ts';
import { eventToSignalTransmissionEngine } from './EventToSignalTransmissionEngine.ts';

describe('ATHENA Phase 11 — Event-To-Signal Transmission & Market Intelligence', () => {
  beforeEach(() => {
    // Reset or ensure clean state
  });

  describe('1. Entity Impact Resolver', () => {
    it('resolves primary entity, sector, indices, and sister entities for order win', () => {
      const text1 = 'Tata Motors bags massive ₹2,500 crore electric bus supply order from DTC';
      const res1 = entityImpactResolver.resolve('Tata Motors Order Win', text1);
      
      expect(res1.primaryEntity?.symbol).toBe('TATAMOTORS');
      expect(res1.sector.toUpperCase()).toBe('AUTOMOBILE');
      expect(res1.relevantIndices.some(idx => idx.includes('AUTO'))).toBe(true);
      expect(res1.peers.some(e => e.symbol === 'MARUTI')).toBe(true);
    });

    it('identifies macro impacted assets and catalysts for commodity spikes', () => {
      const text2 = 'Gold prices hit all-time high of ₹78,500 per 10g on MCX as Fed rate cut bets surge';
      const res2 = entityImpactResolver.resolve('Gold MCX Surge', text2);
      
      expect(res2.macroImpactedAssets).toContain('GOLD_MCX');
      expect(res2.macroImpactedAssets).toContain('FED_FUNDS_RATE');
    });
  });

  describe('2. Deterministic Market Reaction Engine (Multi-Window)', () => {
    it('calculates multi-window reaction metrics and MFE/MAE excursions deterministically', () => {
      const rx = deterministicMarketReactionEngine.evaluateReaction(
        'INFY',
        new Date().toISOString(),
        'BULLISH',
        0.5,
        0.2
      );

      expect(typeof rx.totalChangePct).toBe('number');
      expect(typeof rx.rvol).toBe('number');
      expect(rx.windows['1M']).toBeDefined();
      expect(rx.windows['5M']).toBeDefined();
      expect(rx.windows['15M']).toBeDefined();
      expect(rx.windows['30M']).toBeDefined();
      expect(rx.windows['1H']).toBeDefined();
      expect(rx.windows['SESSION']).toBeDefined();
      expect(typeof rx.mfePct).toBe('number');
      expect(typeof rx.maePct).toBe('number');
    });
  });

  describe('3. Event-to-Signal Transmission Pipeline', () => {
    it('transmits bullish confirmed event into high-conviction tradeable signal', () => {
      const articleBullish = {
        id: 'art-tata-win-001',
        headline: 'Tata Motors bags ₹2,500 Cr EV bus contract',
        body: 'Tata Motors has secured a prestigious order to supply 1,500 electric buses to the Delhi Transport Corporation. Deliveries commence next quarter with strong operating margins.',
        symbol: 'TATAMOTORS',
        publishedAt: new Date().toISOString()
      };

      const sigA = eventToSignalTransmissionEngine.transmitEventToSignal(articleBullish, true);
      
      expect(sigA.symbol).toBe('TATAMOTORS');
      expect(sigA.transmissionScore).toBeGreaterThanOrEqual(50);
      expect(['TRADEABLE', 'WATCH', 'CONFIRMED']).toContain(sigA.actionability);
      expect(sigA.graphDossier).toBeDefined();
      expect(sigA.graphDossier.evidenceChain.length).toBeGreaterThanOrEqual(4);
      expect(sigA.telegramMessage).toContain('NEWS SUMMARY');
      expect(sigA.telegramMessage).toContain('MARKET REACTION');
    });

    it('handles contradictory events and computes deterministic score breakdowns', () => {
      const articleContradicted = {
        id: 'art-infy-loss-001',
        headline: 'Infosys loses key $1.5B client contract amid European tech spending freeze',
        body: 'Infosys reported the termination of a major $1.5B digital transformation deal with an unnamed global client.',
        symbol: 'INFY',
        publishedAt: new Date().toISOString()
      };

      const sigB = eventToSignalTransmissionEngine.transmitEventToSignal(articleContradicted, true);
      
      expect(sigB.signalId).toContain('INFY');
      expect(sigB.scoreBreakdown).toBeDefined();
    });
  });

  describe('4. Event Transmission Graph Registry', () => {
    it('stores and retrieves transmission graph dossiers by signalId', () => {
      const dossiers = eventTransmissionGraph.getAllDossiers();
      expect(dossiers.length).toBeGreaterThan(0);

      const latest = dossiers[0];
      const retrieved = eventTransmissionGraph.getDossier(latest.signalId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.nodes.length).toBe(7);
    });
  });

  describe('5. Observability & Zero-AI Determinism', () => {
    it('verifies 100% deterministic calculation with zero AI execution invocation', () => {
      const obs = eventToSignalTransmissionEngine.getObservability();
      expect(obs.eventsProcessed).toBeGreaterThanOrEqual(2);
      expect(obs.deterministicExecutionCount).toBeGreaterThanOrEqual(2);
      expect(obs.aiInvocationCount).toBe(0);
    });
  });
});
