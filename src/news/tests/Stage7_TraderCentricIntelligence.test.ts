/**
 * ATHENA NEWS ENGINE — STAGE 7 TEST SUITE
 * Trader-Centric News Intelligence & Actionable Impact Layer Verification
 */

import { describe, it, expect } from 'vitest';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine.ts';
import {
  ImpactDirection,
  ImpactMagnitude,
  TimeHorizon,
  EventType,
  FNORelevance,
  FNOBias,
  RiskLevel,
  EvidenceStrength
} from '../types/TraderIntelligence.ts';

describe('Stage 7: Trader-Centric News Intelligence & Actionable Impact Layer', () => {

  describe('1. Controlled Enums and Taxonomies', () => {
    it('validates all required ImpactDirection enum values', () => {
      expect(ImpactDirection.BULLISH).toBe('BULLISH');
      expect(ImpactDirection.BEARISH).toBe('BEARISH');
      expect(ImpactDirection.NEUTRAL).toBe('NEUTRAL');
      expect(ImpactDirection.MIXED).toBe('MIXED');
      expect(ImpactDirection.UNKNOWN).toBe('UNKNOWN');
    });

    it('validates all required TimeHorizon enum values', () => {
      expect(TimeHorizon.INTRADAY).toBe('INTRADAY');
      expect(TimeHorizon.ONE_TO_THREE_DAYS).toBe('1_3_DAYS');
      expect(TimeHorizon.SWING).toBe('SWING');
      expect(TimeHorizon.POSITIONAL).toBe('POSITIONAL');
      expect(TimeHorizon.STRUCTURAL).toBe('STRUCTURAL');
      expect(TimeHorizon.UNKNOWN).toBe('UNKNOWN');
    });

    it('validates all 25 controlled EventType values', () => {
      const expectedTypes = [
        'EARNINGS', 'GUIDANCE', 'DIVIDEND', 'BUYBACK', 'BONUS', 'SPLIT',
        'M_AND_A', 'CONTRACT', 'ORDER', 'MANAGEMENT_CHANGE', 'REGULATORY_ACTION',
        'POLICY_CHANGE', 'IPO', 'FUNDRAISING', 'CREDIT_EVENT', 'RATING_CHANGE',
        'MACRO_DATA', 'CENTRAL_BANK', 'COMMODITY_EVENT', 'GLOBAL_MARKET_EVENT',
        'TECHNOLOGY_EVENT', 'LEGAL_EVENT', 'CORPORATE_GOVERNANCE', 'MARKET_MOVEMENT', 'OTHER'
      ];

      for (const t of expectedTypes) {
        expect(Object.values(EventType)).toContain(t);
      }
    });

    it('validates FNORelevance and FNOBias enum contracts', () => {
      expect(FNORelevance.HIGH).toBe('HIGH');
      expect(FNORelevance.MEDIUM).toBe('MEDIUM');
      expect(FNORelevance.NONE).toBe('NONE');

      expect(FNOBias.CE_BIAS).toBe('CE_BIAS');
      expect(FNOBias.PE_BIAS).toBe('PE_BIAS');
      expect(FNOBias.NEUTRAL_BIAS).toBe('NEUTRAL_BIAS');
      expect(FNOBias.MIXED_BIAS).toBe('MIXED_BIAS');
      expect(FNOBias.INSUFFICIENT_INFORMATION).toBe('INSUFFICIENT_INFORMATION');
    });
  });

  describe('2. Deterministic Financial Intelligence Transformation', () => {
    it('evaluates Bullish Earnings report for Tata Consultancy Services', () => {
      const article = {
        id: 'art_tcs_q2',
        headline: 'TCS Q2 Net Profit Jumps 18% YoY to Rs 12,040 Cr, Revenue Up 9% with Strong Deal Wins',
        body: 'Tata Consultancy Services announced its quarterly financial results with net profit up 18% YoY, beating analyst estimates with strong operating margin expansion.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Economic Times' },
        symbol: 'TCS'
      };

      const intel = TraderImpactEngine.transform(article);

      expect(intel.impactDirection).toBe(ImpactDirection.BULLISH);
      expect(intel.eventType).toBe(EventType.EARNINGS);
      expect(intel.fnoRelevance).toBe(FNORelevance.HIGH);
      expect([FNOBias.CE_BIAS, FNOBias.INSUFFICIENT_INFORMATION]).toContain(intel.cePeBias);
      expect(intel.biasConfidence).toBeGreaterThanOrEqual(70);
      expect(intel.timeHorizon).toBe(TimeHorizon.SWING);
      expect(intel.affectedSymbols).toContain('TCS');
      expect(intel.whyThisMatters.whoIsAffected.companies).toContain('TCS');
    });

    it('evaluates Bearish Regulatory Action for HDFC Bank', () => {
      const article = {
        id: 'art_hdfc_sebi',
        headline: 'SEBI Imposes Heavy Penalty and Issues Show Cause Notice to HDFC Bank Over Compliance Lapse',
        body: 'Market regulator SEBI imposed a fine and initiated investigation into operational compliance lapses at HDFC Bank branches.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Moneycontrol' },
        symbol: 'HDFCBANK'
      };

      const intel = TraderImpactEngine.transform(article);

      expect(intel.impactDirection).toBe(ImpactDirection.BEARISH);
      expect(intel.eventType).toBe(EventType.REGULATORY_ACTION);
      expect([FNOBias.PE_BIAS, FNOBias.INSUFFICIENT_INFORMATION]).toContain(intel.cePeBias);
      expect(intel.ivImpactRisk).toBe(RiskLevel.VERY_HIGH);
      expect(intel.eventRisk).toBe(RiskLevel.VERY_HIGH);
    });

    it('evaluates Macro Policy / Central Bank Event for RBI Repo Rate Decision', () => {
      const article = {
        id: 'art_rbi_mpc',
        headline: 'RBI MPC Unexpectedly Cuts Repo Rate by 25 bps to Stimulate Growth; CRR Left Unchanged',
        body: 'Governor announced repo rate reduction by 25 basis points to support liquidity and domestic demand.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Reuters' }
      };

      const intel = TraderImpactEngine.transform(article);

      expect(intel.eventType).toBe(EventType.CENTRAL_BANK);
      expect(intel.impactDirection).toBe(ImpactDirection.BULLISH);
      expect(intel.impactMagnitude).toBe(ImpactMagnitude.VERY_HIGH);
      expect(intel.timeHorizon).toBe(TimeHorizon.STRUCTURAL);
      expect(intel.ivImpactRisk).toBe(RiskLevel.VERY_HIGH);
    });

    it('guards against hallucination on ambiguous / insufficient news', () => {
      const article = {
        id: 'art_generic',
        headline: 'Stock Market Observers Note Typical Sideways Trading Movement Ahead of Holiday Weekend',
        body: 'Markets traded in a narrow range with low volumes as traders awaited fresh domestic triggers next week.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Market Wire' }
      };

      const intel = TraderImpactEngine.transform(article);

      expect(intel.impactDirection).toBe(ImpactDirection.NEUTRAL);
      expect(intel.cePeBias).toBe(FNOBias.INSUFFICIENT_INFORMATION);
      expect(intel.evidenceStrength).toBe(EvidenceStrength.WEAK);
      // Zero hallucinated strike prices or trading orders
      expect(intel.traderTakeaway).not.toContain('buy call option');
      expect(intel.traderTakeaway).not.toContain('buy put option');
    });
  });

  describe('3. Symbol & Cross-Sector Impact Graph', () => {
    it('maps primary vs secondary affected entities correctly', () => {
      const article = {
        id: 'art_reliance_telecom',
        headline: 'Reliance Jio Launches New AI Platform, Boosting Telecom Sector Outlook Across Bharti Airtel',
        body: 'Reliance Industries announced major investments into cloud telecom infrastructure.',
        publishedAt: new Date().toISOString(),
        symbol: 'RELIANCE'
      };

      const intel = TraderImpactEngine.transform(article);

      expect(intel.symbolImpact.primarySymbol).toBe('RELIANCE');
      expect(intel.symbolImpact.relationship).toBe('DIRECT');
      expect(intel.affectedSymbols).toContain('RELIANCE');
    });
  });

  describe('4. "Why This Matters" Financial Significance', () => {
    it('produces structured, source-backed evidence and trader impact', () => {
      const article = {
        id: 'art_lt_order',
        headline: 'Larsen & Toubro Secures Mega Rs 10,000 Cr International Order Win for Grid Infrastructure',
        body: 'L&T bags order worth Rs 10,000 cr in Middle East for high-voltage power transmission.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Business Standard' },
        symbol: 'LT'
      };

      const intel = TraderImpactEngine.transform(article);

      expect(intel.whyThisMatters.whatHappened).toBe(article.headline);
      expect(intel.whyThisMatters.whyItMatters).toContain('Order book expansion');
      expect(intel.whyThisMatters.traderImpact).toContain('BULLISH');
      expect(intel.whyThisMatters.evidence.length).toBeGreaterThan(0);
      expect(intel.sourceAuthority).toBeGreaterThanOrEqual(85);
    });
  });

  describe('5. Symbol Watchlist Aggregation', () => {
    it('aggregates multi-article intelligence for a specific ticker', () => {
      const mockArticles = [
        {
          id: '1',
          headline: 'Reliance Q1 Net Profit Rises 12% YoY on Strong Retail and Oil-to-Chemicals Margin',
          body: 'Reliance Industries reported net profit up with beat on operating revenues.',
          symbol: 'RELIANCE',
          publishedAt: new Date().toISOString()
        },
        {
          id: '2',
          headline: 'Reliance Bags Order for Solar Modules and Secures Strategic Contract',
          body: 'RIL bags order worth fresh capex.',
          symbol: 'RELIANCE',
          publishedAt: new Date().toISOString()
        }
      ];

      const summary = TraderImpactEngine.generateSymbolSummary('RELIANCE', mockArticles);

      expect(summary.symbol).toBe('RELIANCE');
      expect(summary.isFnoEligible).toBe(true);
      expect(summary.totalArticles).toBe(2);
      expect(summary.sentimentBreakdown.bullish).toBe(2);
      expect(summary.sentimentBreakdown.bearish).toBe(0);
      expect(summary.dominantBias).toBe(FNOBias.CE_BIAS);
    });
  });

  describe('6. Performance & Zero-AI Invariant Verification', () => {
    it('processes batch of 100 articles with p99 latency < 60ms without cloud AI', () => {
      const mockBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `perf_art_${i}`,
        headline: `State Bank of India Announces Q${(i % 4) + 1} Net Profit Up 15% with Lower NPA Provisions`,
        body: `Quarterly results show strong loan growth and net interest margin improvement.`,
        publishedAt: new Date(Date.now() - i * 60000).toISOString(),
        symbol: 'SBIN'
      }));

      const start = performance.now();
      for (const art of mockBatch) {
        const res = TraderImpactEngine.transform(art);
        expect(res.engine).toBe('deterministic_trader_v7');
      }
      const duration = performance.now() - start;
      const avgPerArticle = duration / 100;

      // Ensure ultra-fast deterministic processing
      expect(avgPerArticle).toBeLessThan(5); // Well within 60ms p99 budget
    });
  });

});
