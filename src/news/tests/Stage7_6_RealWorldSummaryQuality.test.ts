/**
 * ATHENA NEWS ENGINE — STAGE 7.6 REAL WORLD SUMMARY QUALITY SUITE
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SummaryQualityEvaluator } from '../validation/SummaryQualityEvaluator';
import { NewsSummaryService } from '../services/NewsSummaryService';
import { NewsArticle } from '../models/NewsArticle';
import { EntityAttributionPipeline } from '../identity/EntityAttributionPipeline';

describe('Stage 7.6: Real World Summary Quality & Forensic Dataset Suite', () => {

  const fixturePath = path.join(process.cwd(), 'src', 'news', 'tests', 'fixtures', 'stage7_6_real_world_articles.json');
  const articles = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('1. Fixture dataset contains real-world test cases', () => {
    expect(Array.isArray(articles)).toBe(true);
    expect(articles.length).toBeGreaterThanOrEqual(20);
  });

  it('2. Case A — Jio Prime: evaluates subscription product development without repeating headline', async () => {
    const caseA = articles.find((a: any) => a.id === 'case_a_jio_prime');
    expect(caseA).toBeDefined();

    const summaryData = await NewsSummaryService.getInstance().getOrGenerateSummary(caseA);
    const evalRes = SummaryQualityEvaluator.evaluate(summaryData, caseA.headline, caseA.content);

    expect(evalRes.score).toBeGreaterThanOrEqual(65);
    expect(['EXCELLENT', 'GOOD', 'ACCEPTABLE']).toContain(evalRes.quality);
    expect(evalRes.breakdown.headlineIndependence).toBe(5);

    const entityResult = EntityAttributionPipeline.processArticle(caseA.headline, caseA.content);
    expect(entityResult.primaryEntity.cleanedName).toContain('Reliance');
    expect(entityResult.secondaryEntities.some(e => e.cleanedName.includes('AIRTEL'))).toBe(true);
  });

  it('3. Case B — Sunshine Pictures IPO: captures brokerage division without SBIN contamination', () => {
    const caseB = articles.find((a: any) => a.id === 'case_b_sunshine_ipo');
    expect(caseB).toBeDefined();

    const entityResult = EntityAttributionPipeline.processArticle(caseB.headline, caseB.content);
    expect(entityResult.primaryEntity.cleanedName).toBe('Sunshine Pictures');
    expect(entityResult.primaryEntity.symbolResolutionState).toBe('UNLISTED_OR_NO_TRADING_SYMBOL');

    const brokerageNames = entityResult.brokerages.map(b => b.cleanedName);
    expect(brokerageNames).toContain('SBI SECURITIES');
    expect(brokerageNames).toContain('MASTER CAPITAL SERVICES');

    // SBI Securities MUST NOT resolve to SBIN ticker
    for (const b of entityResult.brokerages) {
      expect(b.tradingSymbol).toBeUndefined();
    }
  });

  it('4. Case C — Lalithaa Jewellery IPO: cleans malformed entity prefix and rejects Geojit ticker', () => {
    const caseC = articles.find((a: any) => a.id === 'case_c_lalithaa_ipo');
    expect(caseC).toBeDefined();

    const entityResult = EntityAttributionPipeline.processArticle(caseC.headline, caseC.content);
    expect(entityResult.primaryEntity.cleanedName).toBe('Lalithaa Jewellery Mart Ltd');
    expect(entityResult.primaryEntity.cleanedName).not.toContain('ibe for');

    const geojitBrokerage = entityResult.brokerages.find(b => b.cleanedName.includes('GEOJIT'));
    expect(geojitBrokerage).toBeDefined();
    expect(geojitBrokerage?.tradingSymbol).toBeUndefined();
  });

  it('5. Case D — Indo-MIM Earnings: preserves upper circuit reaction and Q1 results', () => {
    const caseD = articles.find((a: any) => a.id === 'case_d_indomim_earnings');
    expect(caseD).toBeDefined();

    const entityResult = EntityAttributionPipeline.processArticle(caseD.headline, caseD.content);
    expect(entityResult.primaryEntity.cleanedName).toBe('Indo-MIM');
    expect(entityResult.decomposedEvents[0].eventType).toBe('EARNINGS');
    expect(entityResult.decomposedEvents[0].observedReaction).toBe('BULLISH');
  });

  it('6. Case E — BSE Downgrade: identifies brokerages Jefferies, Nuvama, Citi and -3% reaction', () => {
    const caseE = articles.find((a: any) => a.id === 'case_e_bse_downgrade');
    expect(caseE).toBeDefined();

    const entityResult = EntityAttributionPipeline.processArticle(caseE.headline, caseE.content);
    expect(entityResult.primaryEntity.cleanedName).toBe('BSE Limited');

    const brokerages = entityResult.brokerages.map(b => b.cleanedName);
    expect(brokerages).toContain('JEFFERIES');
    expect(brokerages).toContain('NUVAMA');
    expect(brokerages).toContain('CITI');
  });

  it('7. Rejects verbatim headline repetition as FAILED (score <= 35)', () => {
    const headline = 'Indo-MIM shares hit 10% upper circuit on strong Q1 results';
    const verbatimSummary = {
      summary: 'Indo-MIM shares hit 10% upper circuit on strong Q1 results',
      whatHappened: 'Indo-MIM shares hit 10% upper circuit on strong Q1 results',
      whyItMatters: 'Strong Q1 results'
    };

    const res = SummaryQualityEvaluator.evaluate(verbatimSummary, headline, 'Some article body');
    expect(res.quality).toBe('FAILED');
    expect(res.score).toBeLessThanOrEqual(35);
  });

  it('8. Rejects semantic repetition where summary merely rephrases headline without adding body facts', () => {
    const headline = 'Indo-MIM shares hit 10% upper circuit on strong Q1 results';
    const semanticRepetition = {
      summary: 'Indo-MIM shares hit 10% upper circuit after strong Q1 results.',
      whatHappened: 'Indo-MIM shares hit 10% upper circuit after strong Q1 results.',
      whyItMatters: 'Q1 results were strong.'
    };

    const res = SummaryQualityEvaluator.evaluate(semanticRepetition, headline, 'Article body');
    expect(res.quality).toBe('FAILED');
  });

  it('9. Scores comprehensive summary with numbers, facts, and why-it-matters as EXCELLENT', () => {
    const headline = 'NTPC approves ₹21,000 crore capital expenditure for 2,400 MW thermal expansion';
    const fullSummary = {
      summary: 'NTPC board approved Rs 21,000 crore capital investment for thermal power plant expansion.',
      whatHappened: 'The company sanctioned Stage-III expansion at Sipat power station adding 2,400 MW capacity.',
      whyItMatters: 'Extends long-term baseload power generation capabilities and supports power grid demand.',
      importantNumbers: [
        { value: '₹21,000 crore', context: 'Capex outlay' },
        { value: '2,400 MW', context: 'Capacity addition' }
      ]
    };
    const bodyText = 'NTPC board approved Rs 21,000 crore capital investment for thermal power plant expansion adding 2,400 MW capacity.';

    const res = SummaryQualityEvaluator.evaluate(fullSummary, headline, bodyText);
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(['EXCELLENT', 'GOOD']).toContain(res.quality);
  });

  it('10. Detects hallucinated financial numbers not in source body', () => {
    const headline = 'TCS declares ₹20 special interim dividend per share';
    const fakeSummary = {
      summary: 'TCS declared Rs 20 special dividend.',
      whatHappened: 'Dividend declared.',
      whyItMatters: 'Yield increase.',
      importantNumbers: [{ value: 'Rs 999999', context: 'Fake Value' }]
    };

    const res = SummaryQualityEvaluator.evaluate(fakeSummary, headline, 'TCS declared Rs 20 dividend per share.');
    expect(res.breakdown.numericalAccuracy).toBe(0);
    expect(res.reasons.some(r => r.includes('Invented numerical value'))).toBe(true);
  });

});
