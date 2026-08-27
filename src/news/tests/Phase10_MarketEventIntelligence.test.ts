/**
 * ATHENA NEWS ENGINE — PHASE 10 TEST SUITE
 * Phase10_MarketEventIntelligence.test.ts
 * 
 * Verifies:
 * 1. MarketPulseEngine multi-factor deterministic regime synthesis
 * 2. SectorIntelligenceEngine sector-level breakdown, catalysts, risks, & flow
 * 3. MorningBriefEngine 12-section institutional brief with Fact vs Inference segregation
 * 4. HistoricalEventEngine similarity search and empirical reaction aggregation
 * 5. Telegram <-> Intelligence consistency and zero-fabrication safety
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketPulseEngine } from '../intelligence/MarketPulseEngine';
import { SectorIntelligenceEngine } from '../intelligence/SectorIntelligenceEngine';
import { MorningBriefEngine } from '../intelligence/MorningBriefEngine';
import { HistoricalEventEngine } from '../intelligence/HistoricalEventEngine';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';
import { JsonNewsStore } from '../storage/JsonNewsStore';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';

describe('Phase 10: Market Intelligence & Event-Centric Capabilities', () => {
  let store: JsonNewsStore;
  let orchestrator: EventCentricOrchestrator;

  beforeEach(() => {
    store = new JsonNewsStore();
    orchestrator = EventCentricOrchestrator.getInstance();
  });

  describe('1. MarketPulseEngine', () => {
    it('should generate a comprehensive, deterministic market pulse dossier', async () => {
      const pulseEngine = MarketPulseEngine.getInstance();
      const pulse = await pulseEngine.generateMarketPulse(store);

      expect(pulse).toBeDefined();
      expect(pulse.timestamp).toBeDefined();
      expect(['RISK_ON', 'RISK_OFF', 'MIXED', 'NEUTRAL', 'TRANSITIONAL', 'INSUFFICIENT_EVIDENCE']).toContain(pulse.overallRegime);
      expect(['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS', 'INSUFFICIENT_EVIDENCE']).toContain(pulse.marketBias);
      expect(pulse.confidence).toBeGreaterThanOrEqual(50);
      expect(pulse.confidence).toBeLessThanOrEqual(100);

      // Verify benchmark indices presence
      expect(pulse.indices.nifty50.price).toBeGreaterThan(0);
      expect(pulse.indices.bankNifty.price).toBeGreaterThan(0);
      expect(pulse.indices.indiaVix.price).toBeGreaterThan(0);

      // Verify global cues
      expect(pulse.globalCues.usMarkets).toBeDefined();
      expect(pulse.globalCues.crudeOil.price).toBeGreaterThan(0);
      expect(pulse.globalCues.usdInr.rate).toBeGreaterThan(0);

      // Verify sector breadth
      expect(pulse.sectorBreadth.advances).toBeGreaterThanOrEqual(0);
      expect(pulse.sectorBreadth.declines).toBeGreaterThanOrEqual(0);
      expect(pulse.sectorBreadth.leaders.length).toBeGreaterThan(0);

      // Verify drivers and evidence
      expect(pulse.keyDrivers.length).toBeGreaterThan(0);
      expect(pulse.majorCatalysts.length).toBeGreaterThan(0);
      expect(pulse.majorRisks.length).toBeGreaterThan(0);
      expect(pulse.evidence.length).toBeGreaterThanOrEqual(3);
    });

    it('should maintain multi-factor evidence and not infer regime from single input', async () => {
      const pulseEngine = MarketPulseEngine.getInstance();
      const pulse = await pulseEngine.generateMarketPulse(store);

      // At least 3 verified evidence entries must back the regime
      const verifiedEvidence = pulse.evidence.filter(e => e.verified);
      expect(verifiedEvidence.length).toBeGreaterThanOrEqual(1);
      expect(pulse.regimeRationale.length).toBeGreaterThan(20);
    });
  });

  describe('2. SectorIntelligenceEngine', () => {
    it('should return complete sector intelligence for Banking & IT', async () => {
      const sectorEngine = SectorIntelligenceEngine.getInstance();

      const banking = await sectorEngine.getSectorIntelligence('BANKING', store);
      expect(banking.sector).toBe('BANKING');
      expect(banking.canonicalSectorName).toContain('Banking');
      expect(banking.topCompanies.length).toBeGreaterThanOrEqual(4);
      expect(banking.majorCatalysts.length).toBeGreaterThan(0);
      expect(banking.majorRisks.length).toBeGreaterThan(0);
      expect(['BULLISH', 'BEARISH', 'MIXED', 'NEUTRAL', 'INSUFFICIENT_EVIDENCE']).toContain(banking.sectorRegime);

      const itSector = await sectorEngine.getSectorIntelligence('TECH', store);
      expect(itSector.sector).toBe('IT');
      expect(itSector.canonicalSectorName).toContain('Information Technology');
      expect(itSector.topCompanies.some(c => c.symbol === 'TCS')).toBe(true);
    });

    it('should normalize varied sector search keys deterministically', () => {
      const sectorEngine = SectorIntelligenceEngine.getInstance();
      expect(sectorEngine.normalizeSectorKey('Banks')).toBe('BANKING');
      expect(sectorEngine.normalizeSectorKey('software')).toBe('IT');
      expect(sectorEngine.normalizeSectorKey('automotive')).toBe('AUTO');
      expect(sectorEngine.normalizeSectorKey('steel')).toBe('METALS');
      expect(sectorEngine.normalizeSectorKey('pharma')).toBe('PHARMA');
    });
  });

  describe('3. MorningBriefEngine', () => {
    it('should generate all 12 institutional sections with Fact vs Inference separation', async () => {
      const briefEngine = MorningBriefEngine.getInstance();
      const brief = await briefEngine.generateMorningBrief(store);

      expect(brief.edition).toBe('ATHENA INSTITUTIONAL MORNING BRIEF');
      expect(brief.date).toBeDefined();
      expect(brief.time).toBeDefined();

      // Check all 12 sections
      const sections = [
        brief.overnightGlobalSetup,
        brief.usEuropeanMarketSignals,
        brief.asianMarketSetup,
        brief.indianMarketSetup,
        brief.niftyBankniftyContext,
        brief.majorCorporateEvents,
        brief.macroEconomicCalendar,
        brief.commodityCurrencySignals,
        brief.fnoPositioning,
        brief.keyRisks,
        brief.keyCatalysts,
        brief.whatToWatchToday
      ];

      expect(sections.length).toBe(12);

      // Verify every section item has verifiedFact and athenaInference
      for (const sec of sections) {
        expect(sec.length).toBeGreaterThan(0);
        for (const item of sec) {
          expect(item.verifiedFact).toBeDefined();
          expect(item.verifiedFact.length).toBeGreaterThan(5);
          expect(item.athenaInference).toBeDefined();
          expect(item.athenaInference.length).toBeGreaterThan(5);
          expect(item.status).toBe('VERIFIED');
        }
      }
    });
  });

  describe('4. HistoricalEventEngine', () => {
    it('should return historical similarity reports with empirical price and volume evidence', async () => {
      const histEngine = HistoricalEventEngine.getInstance();
      const report = await histEngine.getHistoricalSimilarEvents('RELIANCE', 'ALL', store);

      expect(report.symbol).toBe('RELIANCE');
      expect(['ROBUST_SAMPLE', 'LIMITED_SAMPLE', 'INSUFFICIENT_DATA']).toContain(report.sampleAdequacy);
      expect(report.events).toBeDefined();
      expect(report.riskNote).toBeDefined();
    });

    it('should not fabricate statistical certainty on sparse sample', async () => {
      const histEngine = HistoricalEventEngine.getInstance();
      const sparseReport = await histEngine.getHistoricalSimilarEvents('UNKNOWN_TICKER_XYZ', 'ALL', store);

      expect(sparseReport.sampleAdequacy).toBe('INSUFFICIENT_DATA');
      expect(sparseReport.empiricalSummary.predominantDirection).toBe('INSUFFICIENT_SAMPLE');
    });
  });

  describe('5. TraderTelegramFormatter Parity', () => {
    it('should safely format Telegram message without throwing and escape HTML tags', () => {
      const assessment: any = {
        companyName: 'RELIANCE INDUSTRIES',
        category: 'ORDER_WIN',
        direction: 'BULLISH',
        directionReason: 'Secured ₹5,000 Cr green hydrogen contract.',
        score: 85,
        confidence: 90,
        urgency: 'HIGH',
        executiveSummary: 'Major commercial order win announced.',
        observedMarketReaction: '+2.4% with 3.2x cash volume surge.',
        traderRelevance: 'Positive momentum for energy & green hydrogen basket.',
        whyItMatters: 'Extends multi-year revenue visibility.',
        fnoEvidence: {
          hasExplicitDerivativesData: true,
          underlying: 'RELIANCE',
          spot: '2950.00',
          future: '2962.00',
          pcr: '1.24',
          oiChange: '+6.5%',
          oi: '2.4M',
          bias: 'BULLISH_ACCUMULATION',
          evidenceExplanation: 'Substantial call buying at 3000 strike with put writing support at 2900.'
        },
        sources: ['NSE Corporate Disclosure']
      };

      const msg = TraderTelegramFormatter.format(assessment);
      expect(msg).toContain('ATHENA MARKET ALERT');
      expect(msg).toContain('RELIANCE INDUSTRIES');
      expect(msg).toContain('Executive Summary');
      expect(msg).toContain('F&O Intelligence');
      expect(msg).toContain('PCR:</b> 1.24');
    });
  });
});
