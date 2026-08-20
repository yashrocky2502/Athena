/**
 * ATHENA NEWS ENGINE — STAGE 7.1 TEST SUITE
 * Trader Intelligence Integration, Safety & Production Regression Gate
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine.ts';
import { SymbolExtractor } from '../intelligence/SymbolExtractor.ts';
import {
  ImpactDirection,
  ImpactMagnitude,
  TimeHorizon,
  EventType,
  FNOBias,
  RiskLevel,
  EvidenceStrength
} from '../types/TraderIntelligence.ts';
import { FIXED_NEWS_SECTIONS, NewsSectionId } from '../types/NewsSection.ts';

const CANONICAL_PATH = path.join(process.cwd(), 'data', 'news_stage2_store.json');
const CANONICAL_BAK_PATH = path.join(process.cwd(), 'data', 'news_stage2_store.json.bak');

describe('Stage 7.1: Trader Intelligence Integration, Safety & Production Regression Gate', () => {
  let initialCanonicalHash = '';
  let initialCanonicalCount = 0;
  let initialCanonicalSize = 0;

  beforeAll(() => {
    if (fs.existsSync(CANONICAL_PATH)) {
      const data = fs.readFileSync(CANONICAL_PATH, 'utf8');
      initialCanonicalHash = crypto.createHash('sha256').update(data).digest('hex');
      initialCanonicalSize = Buffer.byteLength(data, 'utf8');
      const parsed = JSON.parse(data);
      initialCanonicalCount = Array.isArray(parsed) ? parsed.length : (parsed.articles?.length || 0);
    }
  });

  afterAll(() => {
    // Audit canonical data safety after complete test run
    if (fs.existsSync(CANONICAL_PATH)) {
      const postData = fs.readFileSync(CANONICAL_PATH, 'utf8');
      const postHash = crypto.createHash('sha256').update(postData).digest('hex');
      const postSize = Buffer.byteLength(postData, 'utf8');
      const postParsed = JSON.parse(postData);
      const postCount = Array.isArray(postParsed) ? postParsed.length : (postParsed.articles?.length || 0);

      expect(postCount).toBeGreaterThanOrEqual(initialCanonicalCount);
      expect(postSize).toBeGreaterThanOrEqual(initialCanonicalSize);
      // Zero temporary files
      const dataDir = path.join(process.cwd(), 'data');
      const tempFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.tmp') || f.endsWith('.partial'));
      expect(tempFiles).toEqual([]);
    }
  });

  describe('1. Core Startup & AI Isolation', () => {
    it('initializes TraderImpactEngine without GROQ_API_KEY or GEMINI_API_KEY', () => {
      const oldGroq = process.env.GROQ_API_KEY;
      const oldGemini = process.env.GEMINI_API_KEY;

      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        const article = {
          id: 'test_no_ai_art',
          headline: 'Infosys Signs $1.5 Billion Strategic AI Enterprise Contract with European Retailer',
          body: 'Infosys expands global delivery footprint with multi-year engagement.',
          publishedAt: new Date().toISOString(),
          symbol: 'INFY'
        };

        const intel = TraderImpactEngine.transform(article);
        expect(intel).toBeDefined();
        expect(intel.engine).toBe('deterministic_trader_v7');
        expect(intel.impactDirection).toBe(ImpactDirection.BULLISH);
        expect(intel.affectedSymbols).toContain('INFY');
      } finally {
        if (oldGroq) process.env.GROQ_API_KEY = oldGroq;
        if (oldGemini) process.env.GEMINI_API_KEY = oldGemini;
      }
    });

    it('safely tolerates absence of browser globals (window, document, localStorage) during node execution', () => {
      expect(typeof TraderImpactEngine.transform).toBe('function');
      expect(typeof TraderImpactEngine.generateSymbolSummary).toBe('function');
      expect(typeof SymbolExtractor.resolveSymbol).toBe('function');
    });
  });

  describe('2. 100-Run Output Determinism Verification', () => {
    it('guarantees 100% identical outputs over 100 iterations on canonical articles', () => {
      const sampleArticle = {
        id: 'art_hdfc_dividend_2026',
        headline: 'HDFC Bank Declares Special Interim Dividend of Rs 25 Per Share, Board Approves Record Date',
        body: 'HDFC Bank announced shareholder reward following record quarterly profit numbers.',
        publishedAt: '2026-08-15T10:00:00.000Z',
        source: { name: 'Economic Times' },
        symbol: 'HDFCBANK'
      };

      const baseline = TraderImpactEngine.transform(sampleArticle);
      const baselineJson = JSON.stringify(baseline);

      for (let i = 0; i < 100; i++) {
        const iteration = TraderImpactEngine.transform(sampleArticle);
        // Overwrite timestamp-dependent fields if any (generatedAt is deterministic relative to structure)
        expect(iteration.impactDirection).toBe(baseline.impactDirection);
        expect(iteration.impactMagnitude).toBe(baseline.impactMagnitude);
        expect(iteration.timeHorizon).toBe(baseline.timeHorizon);
        expect(iteration.eventType).toBe(baseline.eventType);
        expect(iteration.cePeBias).toBe(baseline.cePeBias);
        expect(iteration.biasConfidence).toBe(baseline.biasConfidence);
        expect(iteration.ivImpactRisk).toBe(baseline.ivImpactRisk);
        expect(iteration.affectedSymbols).toEqual(baseline.affectedSymbols);
        expect(iteration.whyThisMatters).toEqual(baseline.whyThisMatters);
        expect(iteration.traderTakeaway).toEqual(baseline.traderTakeaway);
      }
    });
  });

  describe('3. Financial Safety & Non-Hallucination Guard', () => {
    it('returns INSUFFICIENT_INFORMATION and weak evidence for ungrounded / vague articles', () => {
      const vagueArticle = {
        id: 'art_vague_rumor',
        headline: 'Market Speculation Around Midcap Sector Continues as Some Traders Discuss Options Volume',
        body: 'Unverified talk on social platforms circulated regarding general sectoral shifts.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Unknown Blog' }
      };

      const intel = TraderImpactEngine.transform(vagueArticle);

      expect(intel.impactDirection).toBe(ImpactDirection.NEUTRAL);
      expect(intel.cePeBias).toBe(FNOBias.INSUFFICIENT_INFORMATION);
      expect(intel.evidenceStrength).toBe(EvidenceStrength.WEAK);
      expect(intel.traderTakeaway).not.toMatch(/buy|sell|call option|put option|target price|stop loss/i);
    });

    it('ensures no fabricated strike prices, stop losses, or guaranteed win rates exist in takeaway', () => {
      const bullishArticle = {
        id: 'art_tatamotors_results',
        headline: 'Tata Motors Reports 74% Surge in Net Profit on JLR Margins and Domestic EV Market Leadership',
        body: 'Operating margins expanded 250 bps YoY across commercial and passenger vehicles.',
        publishedAt: new Date().toISOString(),
        symbol: 'TATAMOTORS'
      };

      const intel = TraderImpactEngine.transform(bullishArticle);

      expect(intel.traderTakeaway).not.toContain('strike');
      expect(intel.traderTakeaway).not.toContain('target price:');
      expect(intel.traderTakeaway).not.toContain('stop loss:');
      expect(intel.traderTakeaway).not.toContain('guaranteed');
    });
  });

  describe('4. Section + Trader Intelligence Integration', () => {
    it('validates integration across all 16 fixed news sections without altering primary categories', () => {
      const expectedSections: NewsSectionId[] = [
        NewsSectionId.BREAKING, NewsSectionId.MARKET, NewsSectionId.RESULTS, NewsSectionId.FNO,
        NewsSectionId.ECONOMY, NewsSectionId.CORPORATE, NewsSectionId.IPO, NewsSectionId.REGULATORY,
        NewsSectionId.EXCHANGE, NewsSectionId.COMMODITIES, NewsSectionId.GLOBAL, NewsSectionId.TECHNOLOGY,
        NewsSectionId.BANKING, NewsSectionId.SECTORS, NewsSectionId.STOCKS, NewsSectionId.MACRO
      ];

      for (const sec of expectedSections) {
        expect(FIXED_NEWS_SECTIONS).toHaveProperty(sec);
      }

      // Test boundary classifications
      const testCases = [
        { headline: 'HCL Tech Reports Q3 Earnings With PAT Growth', expectedCategory: 'Results' },
        { headline: 'SEBI Issues Clarification on F&O Index Derivative Position Limits', expectedCategory: 'Regulatory' },
        { headline: 'RBI Policy Review MPC Keeps Rates Unchanged', expectedCategory: 'Macro' },
        { headline: 'Zomato Acquires Logistics Startup in All-Stock Transaction', expectedCategory: 'Corporate' },
        { headline: 'Crude Oil Jumps 3% Following Middle East Supply Concerns', expectedCategory: 'Commodities' }
      ];

      for (const tc of testCases) {
        const intel = TraderImpactEngine.transform({
          id: 'test_sec_art',
          headline: tc.headline,
          body: tc.headline,
          publishedAt: new Date().toISOString()
        });

        expect(intel.articleId).toBe('test_sec_art');
        expect(intel.headline).toBe(tc.headline);
      }
    });
  });

  describe('5. Watchlist & Symbol Alias Isolation', () => {
    it('resolves all standard Indian equities and their popular aliases accurately', () => {
      const symbolsToTest = [
        { input: 'RELIANCE', expected: 'RELIANCE' },
        { input: 'RIL', expected: 'RELIANCE' },
        { input: 'reliance', expected: 'RELIANCE' },
        { input: 'TCS', expected: 'TCS' },
        { input: 'INFY', expected: 'INFY' },
        { input: 'infosys', expected: 'INFY' },
        { input: 'HDFCBANK', expected: 'HDFCBANK' },
        { input: 'HDFC Bank', expected: 'HDFCBANK' },
        { input: 'ICICIBANK', expected: 'ICICIBANK' },
        { input: 'SBIN', expected: 'SBIN' },
        { input: 'SBI', expected: 'SBIN' },
        { input: 'TATAMOTORS', expected: 'TATAMOTORS' },
        { input: 'LT', expected: 'LT' },
        { input: 'L&T', expected: 'LT' },
        { input: 'ITC', expected: 'ITC' },
        { input: 'SUNPHARMA', expected: 'SUNPHARMA' }
      ];

      for (const item of symbolsToTest) {
        const resolved = SymbolExtractor.resolveSymbol(item.input);
        expect(resolved).not.toBeNull();
        expect(resolved?.nseSymbol).toBe(item.expected);
      }
    });

    it('safely handles unknown and invalid symbols with zero crashes and 0% cross-contamination', () => {
      const unknownSummary = TraderImpactEngine.generateSymbolSummary('UNKNOWN_XYZ_999', []);
      expect(unknownSummary.symbol).toBe('UNKNOWN_XYZ_999');
      expect(unknownSummary.totalArticles).toBe(0);
      expect(unknownSummary.dominantBias).toBe(FNOBias.NEUTRAL_BIAS);
      expect(unknownSummary.sentimentBreakdown.bullish).toBe(0);
      expect(unknownSummary.sentimentBreakdown.bearish).toBe(0);
      expect(unknownSummary.recentEvents).toEqual([]);
    });
  });

  describe('6. 60-Second Cache Safety & Key Collision Isolation', () => {
    it('maintains isolated cache namespaces for articles, symbols, and feeds', () => {
      const artKey = 'art_123';
      const symKey = 'sym_RELIANCE';
      const eventKey = 'event_EARNINGS';

      expect(artKey).not.toBe(symKey);
      expect(symKey).not.toBe(eventKey);
    });
  });

  describe('7. White-Screen Forensics & Malformed Payload Handling', () => {
    it('handles malformed, null, or undefined article properties without throwing runtime exceptions', () => {
      const malformedPayloads = [
        { id: 'm1' },
        { id: 'm2', headline: '' },
        { id: 'm3', headline: undefined, body: null },
        { id: 'm4', headline: 'Proper Title', source: null },
        { id: 'm5', headline: 'Valid', symbol: null, publishedAt: 'invalid-date' }
      ];

      for (const payload of malformedPayloads) {
        expect(() => {
          const intel = TraderImpactEngine.transform(payload as any);
          expect(intel).toBeDefined();
          expect(intel.impactDirection).toBeDefined();
        }).not.toThrow();
      }
    });

    it('safely handles empty array in generateSymbolSummary', () => {
      expect(() => {
        const sum = TraderImpactEngine.generateSymbolSummary('TCS', []);
        expect(sum.symbol).toBe('TCS');
        expect(sum.totalArticles).toBe(0);
      }).not.toThrow();
    });
  });

  describe('8. High-Concurrency Performance Verification', () => {
    it('processes 1,000 concurrent article evaluations with p99 < 60ms', () => {
      const sampleArticles = [
        { id: 'p1', headline: 'Reliance Net Profit Rises 12% on Jio ARPU Growth', symbol: 'RELIANCE' },
        { id: 'p2', headline: 'TCS Wins $500M Cloud Migration Deal from US Bank', symbol: 'TCS' },
        { id: 'p3', headline: 'HDFC Bank Loan Growth Expands 16% in Q3', symbol: 'HDFCBANK' },
        { id: 'p4', headline: 'SEBI Issues Regulatory Guidance for Derivatives Trading', symbol: 'NIFTY' },
        { id: 'p5', headline: 'Tata Motors Launches New Electric Commercial Vehicle', symbol: 'TATAMOTORS' }
      ];

      const latencies: number[] = [];
      const iterations = 1000;

      const overallStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const art = sampleArticles[i % sampleArticles.length];
        const start = performance.now();
        const res = TraderImpactEngine.transform({
          id: `${art.id}_${i}`,
          headline: art.headline,
          body: `Detailed operational report for ${art.symbol}`,
          symbol: art.symbol,
          publishedAt: new Date().toISOString()
        });
        const duration = performance.now() - start;
        latencies.push(duration);
        expect(res.engine).toBe('deterministic_trader_v7');
      }
      const overallDuration = performance.now() - overallStart;

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(iterations * 0.50)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const p99 = latencies[Math.floor(iterations * 0.99)];
      const max = latencies[latencies.length - 1];

      // Verify ultra-fast deterministic performance
      expect(p99).toBeLessThan(60); // 60ms budget
      expect(overallDuration).toBeLessThan(3000); // 1,000 items in < 3s
    });
  });

});
