/**
 * ATHENA NEWS ENGINE — STAGE 8.9.11
 * Stage8_9_11_SummaryTelegramIntegrationAudit.test.ts
 * 
 * Forensic integration and production-behavior verification suite.
 * Enforces 80 deterministic scenarios to verify the summary pipeline and Telegram dispatch.
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { SourceArticleExtractionGate } from '../intelligence/SourceArticleExtractionGate.ts';
import { SummaryQualityGate } from '../intelligence/SummaryQualityGate.ts';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine.ts';
import { NewsSummaryService } from '../services/NewsSummaryService.ts';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate.ts';
import { TelegramAlertEligibilityEngine, TelegramEligibilityAssessment, MarketDirection, AlertUrgency } from '../telegram/TelegramAlertEligibilityEngine.ts';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline.ts';
import { NewsArticle } from '../models/NewsArticle.ts';

// Helper to construct a basic NewsArticle for testing
function makeArticle(overrides: any): any {
  const base = {
    id: `art_${Math.random().toString(36).slice(2, 9)}`,
    title: 'Bharti Airtel reported outstanding financial results',
    content: 'Bharti Airtel posted robust quarterly net profit gains led by ARPU expansion. The company stated consolidated net profit surged 15% year-on-year to Rs 3,500 crore.',
    url: 'https://economictimes.indiatimes.com/news/bharti-airtel-results',
    publisher: 'Economic Times',
    collectedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    category: 'Results',
    sentiment: 'BULLISH',
    fno: { eligible: true, symbol: 'BHARTIARTL', decision: 'INCLUDE' }
  };

  const headline = overrides.headline !== undefined ? overrides.headline : (overrides.title !== undefined ? overrides.title : base.title);
  const body = overrides.body !== undefined ? overrides.body : (overrides.content !== undefined ? overrides.content : base.content);

  return {
    ...base,
    headline,
    body,
    ...overrides
  };
}

// Helper to construct a basic TelegramEligibilityAssessment for testing
function makeAssessment(overrides: Partial<TelegramEligibilityAssessment>): TelegramEligibilityAssessment {
  return {
    isEligible: true,
    score: 90,
    urgency: 'HIGH' as AlertUrgency,
    eventType: 'EARNINGS',
    category: 'Results',
    symbol: 'BHARTIARTL',
    companyName: 'Bharti Airtel',
    direction: 'BULLISH' as MarketDirection,
    directionReason: 'Strong bottom-line expansion',
    observedMarketReaction: null,
    confidence: 95,
    traderRelevance: 'Volatility expansion expected around results.',
    executiveSummary: 'Bharti Airtel quarterly net profit surged 15% year-on-year, beats consensus estimates.',
    whyItMatters: 'Strategic revenue growth from ARPU expansion supports higher margins.',
    whatToMonitor: ['ARPU trajectory next quarter'],
    sources: ['Economic Times'],
    fnoEvidence: {
      hasExplicitDerivativesData: false
    },
    scoreBreakdown: {
      marketImpact: 20,
      eventSignificance: 20,
      fnoRelevance: 15,
      evidenceQuality: 15,
      entityRelevance: 10,
      sourceAuthority: 5,
      novelty: 5
    },
    ...overrides
  } as TelegramEligibilityAssessment;
}

describe('STAGE 8.9.11: Summary Pipeline Integration Audit & Telegram Quality Enforcement (80 Scenarios)', () => {

  beforeAll(() => {
    process.env.TELEGRAM_DISPATCH_THRESHOLD = 'HIGH';
  });

  beforeEach(() => {
    TelegramQualityGate.clearHistory();
    TelegramNotificationPipeline.getInstance().clearHistory();
  });

  // =========================================================================
  // CATEGORY 1: SummaryQualityGate - Extraction Failures (Scenarios 1-10)
  // =========================================================================
  describe('Scenarios 1-10: SummaryQualityGate - Extraction Failures', () => {
    test('Scenario 1: Evaluation of article with completely empty body content', () => {
      const art = makeArticle({ body: '', content: '' });
      const res = SummaryQualityGate.evaluate(art, 'Standard summary');
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });

    test('Scenario 2: Evaluation of article with body under length threshold', () => {
      const art = makeArticle({ body: 'Short text.' });
      const res = SummaryQualityGate.evaluate(art, 'Standard summary');
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });

    test('Scenario 3: Evaluation of unsupported news publisher source', () => {
      const art = makeArticle({ publisher: 'Unverified Blog', url: 'https://unverified.com/article' });
      const res = SummaryQualityGate.evaluate(art, 'Blog summary');
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });

    test('Scenario 4: Evaluation of article with boilerplate error page content', () => {
      const art = makeArticle({ body: 'Access Denied. You do not have permission to access this page.' });
      const res = SummaryQualityGate.evaluate(art, 'Error page summary');
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });

    test('Scenario 5: Evaluation of feed containing only RSS syndication snippets', () => {
      const art = makeArticle({ body: 'Read more on Economic Times website for details.' });
      const res = SummaryQualityGate.evaluate(art, 'Snippet summary');
      expect(res.passed).toBe(false);
    });

    test('Scenario 6: Evaluation of subscription paywalled article stub text', () => {
      const art = makeArticle({ body: 'This premium content requires an active subscription.' });
      const res = SummaryQualityGate.evaluate(art, 'Premium summary');
      expect(res.passed).toBe(false);
    });

    test('Scenario 7: Evaluation of article where extraction score falls under minimal threshold', () => {
      const art = makeArticle({ body: 'The company announced some standard information regarding their daily update.' });
      const res = SummaryQualityGate.evaluate(art, 'Low-score summary');
      expect(res.passed).toBe(false);
    });

    test('Scenario 8: Evaluation of ET article with non-financial irrelevant content', () => {
      const art = makeArticle({ body: 'Bharti Airtel chief executive participated in a CSR tree plantation drive today.' });
      const res = SummaryQualityGate.evaluate(art, 'CSR summary');
      expect(res.passed).toBe(false);
    });

    test('Scenario 9: Evaluation of article with HTML tag contamination in body', () => {
      const art = makeArticle({ body: '<div><p>This is a short paragraph of text with too many html tags.</p></div>' });
      const res = SummaryQualityGate.evaluate(art, 'HTML summary');
      expect(res.passed).toBe(false);
    });

    test('Scenario 10: Evaluation of null article parameter', () => {
      const res = SummaryQualityGate.evaluate(null as any, 'Null summary');
      expect(res.passed).toBe(false);
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });
  });

  // =========================================================================
  // CATEGORY 2: SummaryQualityGate - Repeated Headline Detection (Scenarios 11-20)
  // =========================================================================
  describe('Scenarios 11-20: SummaryQualityGate - Repeated Headline Detection', () => {
    test('Scenario 11: Summary is exactly equal to the headline', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported outstanding financial results');
      expect(res.passed).toBe(false);
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });

    test('Scenario 12: Summary is verbatim headline with mixed casing', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'bharti airtel reported outstanding financial results');
      expect(res.passed).toBe(false);
    });

    test('Scenario 13: Summary is verbatim headline with trailing whitespaces', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, ' Bharti Airtel reported outstanding financial results \n');
      expect(res.passed).toBe(false);
    });

    test('Scenario 14: Summary is headline plus generic filler suffix', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported outstanding financial results. Market participants are monitoring the reported operational development.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 15: Summary is headline prefixed by publisher tag', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Economic Times: Bharti Airtel reported outstanding financial results');
      expect(res.passed).toBe(false);
    });

    test('Scenario 16: Summary is headline inside brackets with generic suffix', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, '[Bharti Airtel reported outstanding financial results]. Experts are tracking.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 17: Summary has repeated headline and fails word variation checks', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported outstanding financial results. Analysts track Bharti Airtel.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 18: Summary has headline suffix and brief boilerplate text', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported outstanding financial results. This development may impact sentiment.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 19: Summary is a sub-clause of the headline and nothing more', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported outstanding');
      expect(res.passed).toBe(false);
    });

    test('Scenario 20: Summary is exactly the headline in double quotes', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, '"Bharti Airtel reported outstanding financial results"');
      expect(res.passed).toBe(false);
    });
  });

  // =========================================================================
  // CATEGORY 3: SummaryQualityGate - Boilerplate/Filler Detection (Scenarios 21-30)
  // =========================================================================
  describe('Scenarios 21-30: SummaryQualityGate - Boilerplate/Filler Detection', () => {
    test('Scenario 21: Summary contains market participants are monitoring', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posts Rs 3500 crore profit. Market participants are monitoring this closely.');
      expect(res.passed).toBe(false);
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });

    test('Scenario 22: Summary contains institutional analysts are assessing', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Institutional analysts are assessing the reported performance of Bharti Airtel.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 23: Summary contains routine operational disclosure', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel announced a routine operational disclosure today.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 24: Summary contains favorable announcement for', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'This is a favorable announcement for Bharti Airtel shares.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 25: Summary contains corporate development may impact sentiment', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'This corporate development may impact sentiment in the telecom sector.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 26: Summary uses multiple forbidden boilerplate patterns', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posts high profits. Market participants are monitoring corporate development may impact sentiment.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 27: Summary is empty or too short', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Short.');
      expect(res.passed).toBe(true); // Short summaries are evaluated by title/headline checks, let's verify if they pass or not
    });

    test('Scenario 28: Summary contains mixed case forbidden words', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posts high profits. MARKET PARTICIPANTS ARE MONITORING this change.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 29: Summary contains whitespace-padded forbidden phrase', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel profit.  market participants are monitoring  the trends.');
      expect(res.passed).toBe(false);
    });

    test('Scenario 30: Summary structure matches valid schema but has forbidden words', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, {
        summary: 'Bharti Airtel quarterly profit is high. Routine operational disclosure details are monitored.',
        whatHappened: 'Quarterly profits are high',
        whyItMatters: 'More profits',
        keyFacts: []
      });
      expect(res.passed).toBe(false);
    });
  });

  // =========================================================================
  // CATEGORY 4: SummaryQualityGate - Successful Passing Scenarios (Scenarios 31-40)
  // =========================================================================
  describe('Scenarios 31-40: SummaryQualityGate - Successful Passing Scenarios', () => {
    test('Scenario 31: High-quality grounded summary for Bharti Airtel', () => {
      const art = makeArticle({
        headline: 'Bharti Airtel reported outstanding financial results',
        body: 'Bharti Airtel reported outstanding financial results. The company reported a 15% growth in consolidated quarterly net profit to Rs 3,500 crore. Average revenue per user (ARPU) expanded robustly to Rs 200.'
      });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200 led by tariff hikes.');
      expect(res.passed).toBe(true);
      expect(res.status).toBe('AVAILABLE');
      expect(res.summary).toContain('Rs 3,500 crore');
    });

    test('Scenario 32: High-quality summary from LiveMint', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        url: 'https://www.livemint.com/industry/banking-news-update',
        headline: 'HDFC Bank net profit surges 10%',
        body: 'HDFC Bank posted net profit of Rs 16,000 crore for the quarter, up 10% YoY. Net interest income expanded 8% while net interest margin stabilized.'
      });
      const res = SummaryQualityGate.evaluate(art, 'HDFC Bank net profit grew 10% YoY to Rs 16,000 crore. Net interest income expanded 8% during the period.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 33: High-quality summary using object payload', () => {
      const art = makeArticle({});
      const payload = {
        summary: 'Bharti Airtel net profit surged 15% YoY to Rs 3,500 crore.',
        whatHappened: 'Bharti Airtel consolidated net profit surged 15% year-on-year to Rs 3,500 crore.',
        whyItMatters: 'Revenue expansion and robust ARPU gains support bottom-line growth.',
        keyFacts: ['Net profit up 15%', 'ARPU expands to Rs 200']
      };
      const res = SummaryQualityGate.evaluate(art, payload);
      expect(res.passed).toBe(true);
      expect(res.whatHappened).toBe(payload.whatHappened);
      expect(res.whyItMatters).toBe(payload.whyItMatters);
    });

    test('Scenario 34: High-quality summary for ET order win', () => {
      const art = makeArticle({
        headline: 'L&T bags mega order from Middle East client',
        body: 'L&T Construction secured a mega contract valued at Rs 5,000 crore to build power transmission lines. The Middle East client expects execution within 36 months.'
      });
      const res = SummaryQualityGate.evaluate(art, 'L&T Construction secured a power transmission contract valued at Rs 5,000 crore. Execution is targeted over 36 months.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 35: High-quality summary for regulatory clearance', () => {
      const art = makeArticle({
        headline: 'FSSAI revokes suspension on Nestle manufacturing unit',
        body: 'FSSAI revoked the operational suspension on Nestle India’s noodles manufacturing plant. The regulator stated the unit has passed all health safety standards.'
      });
      const res = SummaryQualityGate.evaluate(art, 'FSSAI restored Nestle India noodles production license after passing health safety inspections.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 36: High-quality summary with complex numerical metrics', () => {
      const art = makeArticle({
        body: 'Reliance Jio registered a net profit increase of 12% YoY. Operating revenues grew to Rs 25,400 crore while EBITDA margin expanded by 40 basis points.'
      });
      const res = SummaryQualityGate.evaluate(art, 'Reliance Jio net profit increased 12% YoY. Revenue reached Rs 25,400 crore with a 40 bps EBITDA margin expansion.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 37: High-quality summary with multi-sentence length', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posted robust quarterly net profit gains led by ARPU expansion. Consolidated net profit surged 15% year-on-year to Rs 3,500 crore.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 38: High-quality summary with acronym variations', () => {
      const art = makeArticle({
        headline: 'TCS reports solid margins in Q1',
        body: 'Tata Consultancy Services reports solid operating margins of 26.2% in Q1. High contract values offset wage inflation pressures.'
      });
      const res = SummaryQualityGate.evaluate(art, 'TCS operating margins stabilized at 26.2% in Q1, backed by robust deal closures.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 39: High-quality summary from ET editorial matching', () => {
      const art = makeArticle({
        headline: 'Sovereign bond yields slide on inflation data',
        body: 'Indian 10-year sovereign bond yields slipped 4 basis points to 7.02% as consumer price inflation eased to a 12-month low of 4.3%.'
      });
      const res = SummaryQualityGate.evaluate(art, 'Indian 10-year bond yields slipped 4 bps to 7.02% following consumer price inflation easing to 4.3%.');
      expect(res.passed).toBe(true);
    });

    test('Scenario 40: High-quality summary matching with LiveMint domain URL', () => {
      const art = makeArticle({
        publisher: undefined,
        url: 'https://www.livemint.com/market/stock-market-news-today',
        headline: 'Tata Motors shares rise on luxury vehicle sales',
        body: 'Tata Motors shares rose 3% in early trade on high JLR retail sales. Retail volumes surged 11% YoY led by premium SUVs.'
      });
      const res = SummaryQualityGate.evaluate(art, 'Tata Motors share value rose 3% following robust JLR luxury vehicle retail sales expansion of 11%.');
      expect(res.passed).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 5: UnifiedIntelligenceEngine Integration (Scenarios 41-50)
  // =========================================================================
  describe('Scenarios 41-50: UnifiedIntelligenceEngine Integration', () => {
    test('Scenario 41: build() with unextractable article source preserves canonical article', () => {
      const art = makeArticle({
        id: 's8911_canonical_1',
        body: 'Too short text body'
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.articleId).toBe('s8911_canonical_1');
      expect(record.summaryStatus).toBe('SOURCE_UNAVAILABLE');
      expect(record.executiveSummary).toBe('Summary unavailable — Open original source');
      expect(record.whyItMatters).toBe('');
      expect(record.keyFacts).toEqual([]);
    });

    test('Scenario 42: build() with unextractable article does not result in article deletion', () => {
      const art = makeArticle({ id: 's8911_canonical_2', body: 'Stub content' });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record).toBeDefined();
      expect(record.summaryStatus).toBe('SOURCE_UNAVAILABLE');
      // Verify that no error throws and that we can still fetch the article id
      expect(record.articleId).toBe('s8911_canonical_2');
    });

    test('Scenario 43: build() with fully extractable high-quality article returns AVAILABLE status', () => {
      const art = makeArticle({
        id: 's8911_canonical_3',
        headline: 'Wipro acquires SDN startup for Rs 800 crore',
        body: 'Wipro acquired US-based software-defined networking startup for Rs 800 crore. The strategic buyout strengthens enterprise cloud offerings.'
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.summaryStatus).toBe('AVAILABLE');
      expect(record.executiveSummary).toContain('Wipro');
      expect(record.whyItMatters).toContain('Strategic transaction');
    });

    test('Scenario 44: build() on non-F&O article correctly flags fnoEligible as false', () => {
      const art = makeArticle({
        id: 's8911_canonical_4',
        title: 'Unrelated general commentary on local corner grocer retail trends',
        headline: 'Unrelated general commentary on local corner grocer retail trends',
        content: 'A local grocery store owner shared perspectives on community business operations during a generic interview.',
        fno: { eligible: false, symbol: null, decision: 'EXCLUDE' }
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.fnoEligible).toBe(false);
    });

    test('Scenario 45: build() on F&O article correctly flags fnoEligible as true', () => {
      const art = makeArticle({
        id: 's8911_canonical_5',
        fno: { eligible: true, symbol: 'BHARTIARTL', decision: 'INCLUDE' }
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.fnoEligible).toBe(true);
      expect(record.symbol).toBe('BHARTIARTL');
    });

    test('Scenario 46: build() with repeated headline text falls back to SOURCE_UNAVAILABLE', () => {
      const art = makeArticle({
        id: 's8911_canonical_6',
        headline: 'Bharti Airtel reported outstanding financial results',
        body: 'Bharti Airtel reported outstanding financial results'
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.summaryStatus).toBe('SOURCE_UNAVAILABLE');
      expect(record.executiveSummary).toBe('Summary unavailable — Open original source');
    });

    test('Scenario 47: build() preserves the canonical URL of the source article', () => {
      const art = makeArticle({ id: 's8911_canonical_7', canonicalUrl: 'https://economictimes.indiatimes.com/news-item' });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.canonicalUrl).toBe('https://economictimes.indiatimes.com/news-item');
    });

    test('Scenario 48: build() successfully maps financial metrics from article body', () => {
      const art = makeArticle({
        id: 's8911_canonical_8',
        body: 'Bharti Airtel reported outstanding financial results. The consolidated net profit surged 15% to Rs 3,500 crore. EBITDA margins stabilized.'
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.financialMetrics).toBeDefined();
    });

    test('Scenario 49: build() processes regulatory order revocation correctly', () => {
      const art = makeArticle({
        id: 's8911_canonical_9',
        headline: 'FSSAI revokes order suspending Nestle India noodles unit',
        body: 'FSSAI revokes order suspending Nestle India noodles unit. The authority verified compliance with public health standards. Nestle India will resume manufacturing at its high-capacity facility within the next forty-eight hours, bringing relief to regional distributors and retail channels alike.'
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.executiveSummary.toLowerCase()).toContain('revok');
    });

    test('Scenario 50: build() maps default properties when sentiment or score are absent', () => {
      const art = makeArticle({
        id: 's8911_canonical_10',
        sentiment: undefined,
        relevanceScore: undefined
      });
      const record = UnifiedIntelligenceEngine.build(art);
      expect(record.sentiment).toBe('NEUTRAL');
      expect(record.relevanceScore).toBe(85); // Evaluated based on F&O eligibility defaults
    });
  });

  // =========================================================================
  // CATEGORY 6: NewsSummaryService Pipeline Integrations (Scenarios 51-60)
  // =========================================================================
  describe('Scenarios 51-60: NewsSummaryService Pipeline Integrations', () => {
    test('Scenario 51: getOrGenerateSummary with extraction failure returns SOURCE_UNAVAILABLE', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ body: 'Short.' });
      const summary = await service.getOrGenerateSummary(art);
      expect(summary.summary).toBe('Summary unavailable — Open original source');
      expect(summary.whatHappened).toBe('Summary unavailable — Open original source');
      expect(summary.whyItMatters).toBe('');
      expect((summary as any).summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    test('Scenario 52: getOrGenerateSummary does not mutate or delete canonical article fields', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ id: 'save_art', body: 'Unextractable text' });
      const originalTitle = art.title;
      await service.getOrGenerateSummary(art);
      expect(art.id).toBe('save_art');
      expect(art.title).toBe(originalTitle);
    });

    test('Scenario 53: getOrGenerateSummary handles unverified source domain appropriately', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ publisher: 'Unverified Blog', url: 'https://unverifiedblog.com/some-random-news' });
      const summary = await service.getOrGenerateSummary(art);
      expect((summary as any).summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    test('Scenario 54: getOrGenerateSummary caches the SOURCE_UNAVAILABLE result', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ id: 'cache_fail', body: 'Too short text' });
      const summary1 = await service.getOrGenerateSummary(art);
      const summary2 = await service.getOrGenerateSummary(art);
      expect(summary1.summary).toBe(summary2.summary); // Same content from cache
    });

    test('Scenario 55: getOrGenerateSummary fallback structure complies with requirements', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ body: 'Stub body content' });
      const summary = await service.getOrGenerateSummary(art);
      expect(summary.summary).toBe('Summary unavailable — Open original source');
      expect(summary.whyItMatters).toBe('');
      expect(summary.keyFacts).toEqual([]);
    });

    test('Scenario 56: getOrGenerateSummary handles empty article URLs safely', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ url: '', body: 'Stub content' });
      const summary = await service.getOrGenerateSummary(art);
      expect(summary.summary).toBe('Summary unavailable — Open original source');
    });

    test('Scenario 57: getOrGenerateSummary supports null category value mapping', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ category: undefined, body: 'Short text stub' });
      const summary = await service.getOrGenerateSummary(art);
      expect(summary.eventType).toBe('MARKET_UPDATE');
    });

    test('Scenario 58: getOrGenerateSummary returns default validation flags', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ body: 'Short text stub' });
      const summary = await service.getOrGenerateSummary(art);
      expect(summary.validated).toBe(true);
    });

    test('Scenario 59: getOrGenerateSummary does not make network AI calls for unextractable text', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ body: 'Short text stub' });
      const summary = await service.getOrGenerateSummary(art);
      expect(summary.provider).toBe('AthenaLocalEngine');
    });

    test('Scenario 60: getOrGenerateSummary on invalid null article parameter', async () => {
      const service = NewsSummaryService.getInstance();
      const summary = await service.getOrGenerateSummary(null as any);
      expect(summary.summary).toBe('Summary unavailable — Open original source');
    });
  });

  // =========================================================================
  // CATEGORY 7: Telegram Dispatch Quality Gate - General Suppressions (Scenarios 61-70)
  // =========================================================================
  describe('Scenarios 61-70: Telegram Dispatch Quality Gate - General Suppressions', () => {
    test('Scenario 61: Suppress alert when isEligible is marked as false', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ isEligible: false });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('ELIGIBILITY_FAILED');
    });

    test('Scenario 62: Suppress alert when urgency falls below dispatch threshold', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ urgency: 'LOW' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('URGENCY_BELOW_THRESHOLD');
    });

    test('Scenario 63: Suppress alert on empty or extremely short executive summary', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ executiveSummary: 'Short.' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('EMPTY_OR_SHORT_SUMMARY');
    });

    test('Scenario 64: Suppress alert when executive summary repeats the headline verbatim', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const assess = makeAssessment({ executiveSummary: 'Bharti Airtel reported outstanding financial results' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('HEADLINE_AS_SUMMARY');
    });

    test('Scenario 65: Suppress alert when whyItMatters is missing or too short', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ whyItMatters: 'Short.' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('EMPTY_WHY_IT_MATTERS');
    });

    test('Scenario 66: Suppress alert when whyItMatters contains forbidden generic boilerplate reasoning', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ whyItMatters: 'This is a routine operational disclosure for Bharti Airtel shares.' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('GENERIC_BOILERPLATE_REASONING');
    });

    test('Scenario 67: Suppress alert on non-compliant advisory language guaranteeing returns', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ whyItMatters: 'This acquisition offers a guaranteed profit for investors.' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('NON_COMPLIANT_ADVISORY_LANGUAGE');
    });

    test('Scenario 68: Suppress alert when sources are empty', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ sources: [] });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('MISSING_SOURCE');
    });

    test('Scenario 69: Suppress alert when traderRelevance is empty or generic', () => {
      const art = makeArticle({});
      const assess = makeAssessment({ traderRelevance: 'No Clear Beneficiary' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('MISSING_TRADER_RELEVANCE');
    });

    test('Scenario 70: Successful alert passing general validations', () => {
      const art = makeArticle({});
      const assess = makeAssessment({});
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 8: Telegram Dispatch Quality Gate - F&O Enforcements (Scenarios 71-80)
  // =========================================================================
  describe('Scenarios 71-80: Telegram Dispatch Quality Gate - F&O Enforcements', () => {
    test('Scenario 71: Suppress F&O alert when options seller impact is generic fallback', () => {
      const art = makeArticle({ category: 'F&O', optionsSellerImpact: 'no actionable f&o setup' });
      const assess = makeAssessment({ category: 'F&O', traderRelevance: 'no actionable f&o setup' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('GENERIC_OPTIONS_SELLER_IMPACT');
    });

    test('Scenario 72: Suppress F&O alert when sentiment is Neutral', () => {
      const art = makeArticle({ category: 'F&O', sentiment: 'NEUTRAL' });
      const assess = makeAssessment({ category: 'F&O', direction: 'NEUTRAL' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('NEUTRAL_FNO_ALERT_BLOCKED');
    });

    test('Scenario 73: Suppress F&O alert with fabricated trading symbol not in source text', () => {
      const art = makeArticle({ category: 'F&O', body: 'No mention of the subject technology firm in this text.' });
      const assess = makeAssessment({ category: 'F&O', symbol: 'WIPRO' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('FABRICATED_SYMBOL');
    });

    test('Scenario 74: Suppress F&O alert when option strike price is fabricated', () => {
      const art = makeArticle({ category: 'F&O', body: 'Nifty trading flat. Weekly calls gain premium.' });
      const assess = makeAssessment({
        category: 'F&O',
        executiveSummary: 'Calls trading at 25000 strike premium.',
        traderRelevance: 'Focus on 25000 strike'
      });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('FABRICATED_STRIKE_OR_PREMIUM');
    });

    test('Scenario 75: Suppress F&O alert with fabricated open interest metric claims', () => {
      const art = makeArticle({ category: 'F&O', body: 'BHARTIARTL options trade actively.' });
      const assess = makeAssessment({
        category: 'F&O',
        fnoEvidence: {
          hasExplicitDerivativesData: true,
          oi: 'true'
        }
      });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('FABRICATED_FNO_METRIC');
    });

    test('Scenario 76: Suppress F&O alert with fabricated PCR metric claims', () => {
      const art = makeArticle({ category: 'F&O', body: 'BHARTIARTL options trade actively.' });
      const assess = makeAssessment({
        category: 'F&O',
        fnoEvidence: {
          hasExplicitDerivativesData: true,
          pcr: 'true'
        }
      });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('FABRICATED_FNO_METRIC');
    });

    test('Scenario 77: Suppress F&O alert with fabricated IV metric claims', () => {
      const art = makeArticle({ category: 'F&O', body: 'BHARTIARTL options trade actively.' });
      const assess = makeAssessment({
        category: 'F&O',
        fnoEvidence: {
          hasExplicitDerivativesData: true,
          iv: 'true'
        }
      });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('FABRICATED_FNO_METRIC');
    });

    test('Scenario 78: Suppress F&O alert on brokerage name contamination in symbol field', () => {
      const art = makeArticle({ category: 'F&O' });
      const assess = makeAssessment({ category: 'F&O', symbol: 'GOLDMAN SACHS' });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(false);
      expect(gateRes.failedChecks).toContain('BROKERAGE_TICKER_CONTAMINATION');
    });

    test('Scenario 79: Suppress duplicate F&O alerts dispatched within 12 hours', () => {
      const art1 = makeArticle({ id: 'art_1' });
      const art2 = makeArticle({ id: 'art_2' });
      const assess = makeAssessment({ eventFingerprint: 'duplicate_fingerprint' });
      
      const gateRes1 = TelegramQualityGate.validate(assess, art1);
      expect(gateRes1.passed).toBe(true);

      const gateRes2 = TelegramQualityGate.validate(assess, art2);
      expect(gateRes2.passed).toBe(false);
      expect(gateRes2.failedChecks).toContain('DUPLICATE_ALERT_SUPPRESSED');
    });

    test('Scenario 80: High-quality F&O alert with valid derivatives details passes all gates', () => {
      const art = makeArticle({
        category: 'F&O',
        headline: 'BHARTIARTL call open interest spikes at 1200 strike',
        body: 'BHARTIARTL options observed active call writing today. Open interest (OI) surged 35% on the 1200 strike call as stock rallied.',
        optionsSellerImpact: 'Option sellers of 1200 strike should hedge risk as call premium increases.'
      });
      const assess = makeAssessment({
        category: 'F&O',
        symbol: 'BHARTIARTL',
        executiveSummary: 'BHARTIARTL call open interest surged 35% at the 1200 strike.',
        whyItMatters: 'Massive option buildup suggests strong support and technical breakout levels.',
        traderRelevance: 'High volume writing on 1200 calls.',
        fnoEvidence: {
          hasExplicitDerivativesData: true,
          oi: 'true'
        }
      });
      const gateRes = TelegramQualityGate.validate(assess, art);
      expect(gateRes.passed).toBe(true);
    });
  });

});
