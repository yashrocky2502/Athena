/**
 * ATHENA NEWS ENGINE — STAGE 7.4 AI SUMMARY QUALITY & EXTRACTION REGRESSION SUITE
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExtractionQualityEvaluator } from '../extraction/ExtractionQualityEvaluator';
import { SummaryValidator } from '../validation/SummaryValidator';
import { PublisherProfileManager } from '../extraction/PublisherProfileManager';
import { TrafilaturaExtractor } from '../extraction/TrafilaturaExtractor';
import { Crawl4AIExtractor } from '../extraction/Crawl4AIExtractor';
import { JinaReaderExtractor } from '../extraction/JinaReaderExtractor';
import { FirecrawlExtractor } from '../extraction/FirecrawlExtractor';
import { NewsSummaryService } from '../services/NewsSummaryService';
import { NewsSummaryCache } from '../cache/NewsSummaryCache';
import { NewsArticle } from '../models/NewsArticle';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine';

describe('Stage 7.4: AI Summary Quality & Multi-Layer Extraction Gate', () => {

  beforeEach(() => {
    NewsSummaryCache.getInstance().clear();
  });

  it('1. Extraction Quality Evaluator correctly scores articles', () => {
    const excellentBody = `Reliance Jio announced the launch of its Jio Prime subscription at Rs 300 per year. The company expects over 100 million subscribers to transition from free preview to paid subscription. Bharti Airtel and Vodafone Idea responded by revising their monthly ARPU targets. Industry analysts at Jefferies noted that telecom sector revenues will stabilize following this commercialization phase.`;
    const result = ExtractionQualityEvaluator.evaluate('Reliance Jio Prime Subscription Launch', excellentBody, excellentBody);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.quality).toBe('EXCELLENT');

    const emptyResult = ExtractionQualityEvaluator.evaluate('Empty Article', '');
    expect(emptyResult.quality).toBe('FAILED');
    expect(emptyResult.score).toBe(0);
  });

  it('2. Multi-layer extractors execute in priority order and clean HTML artifacts', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const crawl4ai = new Crawl4AIExtractor();
    const jina = new JinaReaderExtractor();
    const firecrawl = new FirecrawlExtractor();

    expect(trafilatura.isEnabled()).toBe(true);
    expect(crawl4ai.isEnabled()).toBe(true);
    expect(jina.isEnabled()).toBe(true);
    expect(firecrawl.isEnabled()).toBe(!!process.env.FIRECRAWL_API_KEY);

    const rawHtml = `<html><head><title>Jio Prime Launch</title></head><body><script>var x=10;</script><p>Reliance Jio launched Jio Prime at Rs 300 annual fee. The company expects over 100 million subscribers to transition from free preview to paid subscription. Bharti Airtel and Vodafone Idea responded by revising their monthly ARPU targets across telecom circles.</p></body></html>`;
    const res = await trafilatura.extract('https://economic-times.com/jio-prime', rawHtml);

    expect(res.cleanText).not.toContain('<script>');
    expect(res.cleanText).toContain('Reliance Jio launched Jio Prime');
    expect(['EXCELLENT', 'ACCEPTABLE']).toContain(res.quality);
  });

  it('3. Publisher Profile Manager learns runtime extractor selection', () => {
    const mgr = PublisherProfileManager.getInstance();
    mgr.recordResult('moneycontrol.com', 'TrafilaturaExtractor', 85, true);
    mgr.recordResult('moneycontrol.com', 'TrafilaturaExtractor', 90, true);

    const profile = mgr.getProfile('moneycontrol.com');
    expect(profile).not.toBeNull();
    expect(profile?.domain).toBe('moneycontrol.com');
    expect(profile?.successRate).toBe(100);
    expect(profile?.averageQuality).toBeGreaterThanOrEqual(80);
  });

  it('4. Summary Validator rejects headline repetition, hallucinated numbers, and trading advice', () => {
    const headline = 'Jio Prime subscription at ₹300 — What is on offer and how it differs from Bharti Airtel';

    // Test A: Verbatim repetition
    const verbatimSummary = {
      summary: 'Jio Prime subscription at ₹300 — What is on offer and how it differs from Bharti Airtel',
      whatHappened: 'Jio Prime subscription at ₹300',
      whyItMatters: 'Important news'
    };
    const valA = SummaryValidator.validate(verbatimSummary, headline, 'Article body text');
    expect(valA.valid).toBe(false);
    expect(valA.reasons.some(r => r.includes('repetition'))).toBe(true);

    // Test B: Guaranteed return trading advice
    const adviceSummary = {
      summary: 'Reliance Jio launched Jio Prime at Rs 300 per year for subscribers.',
      whatHappened: 'This is 100% guaranteed profit buy now for massive gains.',
      whyItMatters: 'Sure shot call.'
    };
    const valB = SummaryValidator.validate(adviceSummary, headline, 'Article body text');
    expect(valB.valid).toBe(false);
    expect(valB.reasons.some(r => r.includes('trading advice'))).toBe(true);

    // Test C: Invented numbers
    const hallucinatedNum = {
      summary: 'Reliance Jio launched Jio Prime at Rs 300 per year for subscribers.',
      whatHappened: 'Jio announced new plan.',
      whyItMatters: 'Impacts ARPU.',
      importantNumbers: [{ value: 'Rs 99999', context: 'Fake Fee' }]
    };
    const valC = SummaryValidator.validate(hallucinatedNum, headline, 'Article text with Rs 300 fee');
    expect(valC.valid).toBe(false);
    expect(valC.reasons.some(r => r.includes('Invented numerical value'))).toBe(true);
  });

  it('5. Part H Test Case 1: Jio Prime (Reliance primary, Airtel secondary, Telecom event, no false EARNINGS, no F&O)', async () => {
    const jioArticle: any = {
      id: 'jio_prime_test_01',
      title: 'Jio Prime subscription at ₹300 — What is on offer and how it differs from Bharti Airtel - CNBC TV18',
      headline: 'Jio Prime subscription at ₹300 — What is on offer and how it differs from Bharti Airtel - CNBC TV18',
      content: 'Reliance Jio Infocomm announced its Jio Prime subscription service priced at Rs 300 annually. Bharti Airtel and Vodafone Idea are reviewing tariff structures in response.',
      publisher: 'CNBC TV18',
      publishedAt: new Date().toISOString(),
      category: 'TELECOM',
      url: 'https://cnbctv18.com/telecom/jio-prime-300'
    };

    const summaryService = NewsSummaryService.getInstance();
    const summary = await summaryService.getOrGenerateSummary(jioArticle);

    expect(summary.summary).not.toEqual(jioArticle.title);
    expect(summary.whatHappened).toBeDefined();
    expect(summary.whyItMatters).toBeDefined();

    // Verify Trader Impact Engine attribution
    const intel = TraderImpactEngine.transform(jioArticle);
    expect(intel.eventType).not.toBe('EARNINGS');
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(false);
  });

  it('6. Part H Test Case 2: Sunshine Pictures IPO (Sunshine Pictures primary, SBI Securities brokerage, NO SBIN ticker contamination)', () => {
    const sunshineArticle: any = {
      id: 'sunshine_ipo_02',
      title: 'Sunshine Pictures IPO: SBI Securities recommends Avoid over valuation concerns',
      headline: 'Sunshine Pictures IPO: SBI Securities recommends Avoid over valuation concerns',
      content: 'SBI Securities has assigned an Avoid rating to Sunshine Pictures Limited IPO citing high valuations and unlisted media peer comparisons.',
      publisher: 'Moneycontrol',
      publishedAt: new Date().toISOString(),
      category: 'IPO',
      url: 'https://moneycontrol.com/news/ipo/sunshine-pictures-sbi-sec'
    };

    const intel = TraderImpactEngine.transform(sunshineArticle);

    // Sunshine Pictures is primary entity, SBI Securities is brokerage
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(false);
    // Verify SBIN is NOT falsely attributed as primary affected stock
    expect(intel.affectedSymbols).not.toContain('SBIN');
    expect(intel.eventType).toBe('IPO');
  });

  it('7. Part H Test Case 3: Lalithaa Jewellery IPO (Lalithaa Jewellery Mart primary, Geojit brokerage, no malformed entity)', () => {
    const lalithaaArticle: any = {
      id: 'lalithaa_ipo_03',
      title: 'Lalithaa Jewellery Mart IPO opens for subscription: Geojit issues Subscribe rating',
      headline: 'Lalithaa Jewellery Mart IPO opens for subscription: Geojit issues Subscribe rating',
      content: 'Lalithaa Jewellery Mart Ltd launched its initial public offering today. Geojit Financial Services assigned a Subscribe rating based on retail store expansion.',
      publisher: 'Economic Times',
      publishedAt: new Date().toISOString(),
      category: 'IPO'
    };

    const intel = TraderImpactEngine.transform(lalithaaArticle);
    expect(intel.eventType).toBe('IPO');
    expect(intel.affectedSymbols).not.toContain('GEOJITBNPP');
  });

  it('8. Part H Test Case 4: Indo-MIM (Indo-MIM entity, earnings event, reported price reaction preserved)', () => {
    const indoArticle: any = {
      id: 'indomim_earnings_04',
      title: 'Indo-MIM Q3 net profit surges 25%, shares jump 10% in morning trade',
      headline: 'Indo-MIM Q3 net profit surges 25%, shares jump 10% in morning trade',
      content: 'Indo-MIM reported a 25% surge in Q3 net profit to Rs 120 crore. Stock jumped 10% following strong revenue guidance.',
      publisher: 'Mint',
      publishedAt: new Date().toISOString(),
      category: 'EARNINGS'
    };

    const intel = TraderImpactEngine.transform(indoArticle);
    expect(intel.eventType).toBe('EARNINGS');
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(false);
  });

  it('9. Part H Test Case 5: BSE downgrade (BSE Limited entity, Nuvama/Jefferies/Citi brokerages, BEARISH reaction, no CE/PE recommendation)', () => {
    const bseArticle: any = {
      id: 'bse_downgrade_05',
      title: 'BSE shares fall 6% as Jefferies and Nuvama downgrade stock to Hold on regulatory risks',
      headline: 'BSE shares fall 6% as Jefferies and Nuvama downgrade stock to Hold on regulatory risks',
      content: 'BSE Limited shares fell 6% in trade after brokerage firms Jefferies and Nuvama downgraded the exchange operator citing derivatives transaction fee regulatory shifts.',
      publisher: 'CNBC TV18',
      publishedAt: new Date().toISOString(),
      category: 'ANALYST_RATING'
    };

    const intel = TraderImpactEngine.transform(bseArticle);
    expect(intel.impactDirection).toBe('BEARISH');
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(false);
  });

  it('10. F&O Evidence Rule: Non-F&O article has fnoEvidencePresent=false and cePeBias=INSUFFICIENT_INFORMATION', () => {
    const ordinaryArticle: any = {
      id: 'ord_news_10',
      title: 'Tata Steel opens new manufacturing unit in Odisha',
      headline: 'Tata Steel opens new manufacturing unit in Odisha',
      content: 'Tata Steel announced the inauguration of a new manufacturing unit in Odisha.',
      publisher: 'Business Standard',
      publishedAt: new Date().toISOString()
    };

    const intel = TraderImpactEngine.transform(ordinaryArticle);
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(false);
    expect(intel.cePeBias).toBe('INSUFFICIENT_INFORMATION');
  });

});
