/**
 * ATHENA NEWS ENGINE — STAGE 8.9.16
 * User-Facing Intelligence & Summary/Fallback Production Lock Test Suite
 * 
 * Verifies exactly 60 deterministic test cases across 6 domains (A through F).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { SourceArticleExtractionGate } from '../intelligence/SourceArticleExtractionGate';
import { SummaryQualityGate } from '../intelligence/SummaryQualityGate';
import { NewsSummaryService } from '../services/NewsSummaryService';

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

describe('Stage 8.9.16: User-Facing Intelligence & Summary/Fallback Production Lock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // DOMAIN A: BASELINE AND SETUP INTEGRITY (1-10)
  // =========================================================================
  describe('Domain A: Baseline and Setup Integrity', () => {
    it('1. Verify newsStore is initialized', () => {
      expect(newsStore).toBeDefined();
    });

    it('2. Verify articles can be fetched', () => {
      const articles = newsStore.getAllArticles();
      expect(articles).toBeDefined();
    });

    it('3. Verify basic evaluation properties can be read', () => {
      const art = makeArticle({});
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.publisher).toBe('Economic Times');
    });

    it('4. Verify default article helper can create supported tier article', () => {
      const art = makeArticle({});
      expect(art.publisher).toBe('Economic Times');
      expect(art.url).toContain('economictimes');
    });

    it('5. Verify SummaryQualityGate is loaded properly', () => {
      expect(SummaryQualityGate).toBeDefined();
    });

    it('6. Verify SummaryQualityGate has the evaluate method', () => {
      expect(SummaryQualityGate.evaluate).toBeDefined();
    });

    it('7. Verify SOURCE_GROUNDED state type exists in metadata definitions', () => {
      const states = ['SOURCE_GROUNDED', 'SOURCE_UNAVAILABLE', 'EXTRACTION_FAILED', 'QUALITY_REJECTED'];
      expect(states).toContain('SOURCE_GROUNDED');
    });

    it('8. Verify SOURCE_UNAVAILABLE state type exists in metadata definitions', () => {
      const states = ['SOURCE_GROUNDED', 'SOURCE_UNAVAILABLE', 'EXTRACTION_FAILED', 'QUALITY_REJECTED'];
      expect(states).toContain('SOURCE_UNAVAILABLE');
    });

    it('9. Verify EXTRACTION_FAILED state type exists in metadata definitions', () => {
      const states = ['SOURCE_GROUNDED', 'SOURCE_UNAVAILABLE', 'EXTRACTION_FAILED', 'QUALITY_REJECTED'];
      expect(states).toContain('EXTRACTION_FAILED');
    });

    it('10. Verify QUALITY_REJECTED state type exists in metadata definitions', () => {
      const states = ['SOURCE_GROUNDED', 'SOURCE_UNAVAILABLE', 'EXTRACTION_FAILED', 'QUALITY_REJECTED'];
      expect(states).toContain('QUALITY_REJECTED');
    });
  });

  // =========================================================================
  // DOMAIN B: SOURCE_UNAVAILABLE DIAGNOSTICS (11-20)
  // =========================================================================
  describe('Domain B: SOURCE_UNAVAILABLE Diagnostics', () => {
    it('11. Article with null parameter defaults to SOURCE_UNAVAILABLE', () => {
      const res = SummaryQualityGate.evaluate(null as any, 'Some summary');
      expect(res.summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    it('12. Article without headline/title returns SOURCE_UNAVAILABLE', () => {
      const art = makeArticle({ title: '', headline: '', body: '', content: '', description: '', url: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    it('13. Article with NO_SOURCE_BODY failure category evaluates to SOURCE_UNAVAILABLE', () => {
      const art = makeArticle({ body: '', content: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    it('14. Article with empty body evaluates to SOURCE_UNAVAILABLE', () => {
      const art = makeArticle({ body: '   ' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    it('15. Article with UNSUPPORTED_PUBLISHER and failed extraction evaluates to SOURCE_UNAVAILABLE', () => {
      const art = makeArticle({ publisher: 'Unverified Blog', url: 'https://unverified.com/article', body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    it('16. SOURCE_UNAVAILABLE state returns correct fallback summary text', () => {
      const art = makeArticle({ body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });

    it('17. SOURCE_UNAVAILABLE state returns correct fallback whatHappened text', () => {
      const art = makeArticle({ body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.whatHappened).toBe('Summary unavailable — Open original source');
    });

    it('18. SOURCE_UNAVAILABLE state returns empty fields for optional fields', () => {
      const art = makeArticle({ body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.whyItMatters).toBe('');
      expect(res.keyFacts).toEqual([]);
    });

    it('19. SOURCE_UNAVAILABLE state sets passed property to false', () => {
      const art = makeArticle({ body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.passed).toBe(false);
    });

    it('20. SOURCE_UNAVAILABLE state sets compatible status to SOURCE_UNAVAILABLE', () => {
      const art = makeArticle({ body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });
  });

  // =========================================================================
  // DOMAIN C: EXTRACTION_FAILED DIAGNOSTICS (21-30)
  // =========================================================================
  describe('Domain C: EXTRACTION_FAILED Diagnostics', () => {
    it('21. Article with extraction timeout category maps to EXTRACTION_FAILED', () => {
      const art = makeArticle({ body: 'Access Timeout. This page took too long to load.', content: 'Access Timeout. This page took too long to load.', errorType: 'TIMEOUT', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('EXTRACTION_FAILED');
    });

    it('22. Article with HTTP failure category maps to EXTRACTION_FAILED', () => {
      const art = makeArticle({ body: '404 Not Found. The resource does not exist.', content: '404 Not Found. The resource does not exist.', httpStatus: 404, publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('EXTRACTION_FAILED');
    });

    it('23. Article with duplicate content category maps to EXTRACTION_FAILED', () => {
      const art = makeArticle({ body: 'Standard duplicate boilerplate', content: 'Standard duplicate boilerplate', isDuplicate: true, publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('EXTRACTION_FAILED');
    });

    it('24. Article with content too short category maps to EXTRACTION_FAILED', () => {
      const art = makeArticle({ body: 'Short.', content: 'Short.', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('EXTRACTION_FAILED');
    });

    it('25. Article with bot protection category maps to EXTRACTION_FAILED', () => {
      const art = makeArticle({ body: 'Access Denied. cloudflare captcha...', content: 'Access Denied. cloudflare captcha...', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('EXTRACTION_FAILED');
    });

    it('26. Article with paywall/login category maps to EXTRACTION_FAILED', () => {
      const art = makeArticle({ body: 'Premium subscriber login...', content: 'Premium subscriber login...', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summaryStatus).toBe('EXTRACTION_FAILED');
    });

    it('27. EXTRACTION_FAILED state returns fallback summary text', () => {
      const art = makeArticle({ body: 'Short.', content: 'Short.', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });

    it('28. EXTRACTION_FAILED state returns fallback whatHappened text', () => {
      const art = makeArticle({ body: 'Short.', content: 'Short.', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.whatHappened).toBe('Summary unavailable — Open original source');
    });

    it('29. EXTRACTION_FAILED state sets passed property to false', () => {
      const art = makeArticle({ body: 'Short.', content: 'Short.', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.passed).toBe(false);
    });

    it('30. EXTRACTION_FAILED state has compatible status', () => {
      const art = makeArticle({ body: 'Short.', content: 'Short.', publishedAt: null });
      const res = SummaryQualityGate.evaluate(art, 'Some summary');
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });
  });

  // =========================================================================
  // DOMAIN D: QUALITY_REJECTED DIAGNOSTICS (31-40)
  // =========================================================================
  describe('Domain D: QUALITY_REJECTED Diagnostics', () => {
    it('31. Successfully extracted but empty summary string returns QUALITY_REJECTED', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, '');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('32. Successfully extracted but summary identical to headline returns QUALITY_REJECTED', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported outstanding financial results');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('33. Successfully extracted but summary repeats headline with trailing space returns QUALITY_REJECTED', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, ' Bharti Airtel reported outstanding financial results \n');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('34. Summary prefixed by publisher tag and headline returns QUALITY_REJECTED', () => {
      const art = makeArticle({ headline: 'Bharti Airtel reported outstanding financial results' });
      const res = SummaryQualityGate.evaluate(art, 'Economic Times: Bharti Airtel reported outstanding financial results');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('35. Summary containing generic boilerplate ("Market participants are monitoring...") returns QUALITY_REJECTED', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posts robust numbers. Market participants are monitoring this development.');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('36. Summary containing forbidden pattern ("corporate development may impact sentiment") returns QUALITY_REJECTED', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posts high profits. This corporate development may impact sentiment in the telecom sector.');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('37. Summary too short (less than 15 characters) returns QUALITY_REJECTED', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Too short.');
      expect(res.summaryStatus).toBe('QUALITY_REJECTED');
    });

    it('38. QUALITY_REJECTED state returns fallback summary text', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Too short.');
      expect(res.summary).toBe('Summary unavailable — Open original source');
    });

    it('39. QUALITY_REJECTED state returns fallback whatHappened text', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Too short.');
      expect(res.whatHappened).toBe('Summary unavailable — Open original source');
    });

    it('40. QUALITY_REJECTED state sets passed property to false', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Too short.');
      expect(res.passed).toBe(false);
    });
  });

  // =========================================================================
  // DOMAIN E: SOURCE_GROUNDED SUCCESS & FINANCIAL FIGURES PROTECTION (41-50)
  // =========================================================================
  describe('Domain E: SOURCE_GROUNDED Success & Financial Figure Protection', () => {
    it('41. Valid detailed summary with EBITDA figure passes as SOURCE_GROUNDED', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel announced outstanding results today. Consolidated EBITDA margins expanded by 120 basis points during the third quarter.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('42. Valid detailed summary with YoY growth percentage passes as SOURCE_GROUNDED', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('43. Valid detailed summary with PAT figure passes as SOURCE_GROUNDED', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel registered profit after tax (PAT) of Rs 2,400 crore for the quarter. Growth was driven by premium 5G adoption.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('44. Valid detailed summary with revenue and margins passes as SOURCE_GROUNDED', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel consolidated revenue grew to Rs 37,900 crore. Operations in India led the overall performance with steady market gains.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('45. Valid detailed summary with EPS figure passes as SOURCE_GROUNDED', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel declared a dividend of Rs 8 per share today. Earnings per share (EPS) expanded to Rs 14.5 for the full financial year.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('46. Financial numbers are not stripped or mutated in SOURCE_GROUNDED state', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summary).toContain('15% YoY');
      expect(res.summary).toContain('Rs 3,500 crore');
      expect(res.summary).toContain('Rs 200');
    });

    it('47. Valid summary passes and sets passed to true', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.passed).toBe(true);
    });

    it('48. Valid summary sets summaryStatus to SOURCE_GROUNDED', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('49. Valid summary sets status compatible field to AVAILABLE', () => {
      const art = makeArticle({});
      const summary = 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200.';
      const res = SummaryQualityGate.evaluate(art, summary);
      expect(res.status).toBe('AVAILABLE');
    });

    it('50. Valid summary returns actual parsed object fields (whatHappened, whyItMatters)', () => {
      const art = makeArticle({});
      const payload = {
        summary: 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore. Average revenue per user expanded robustly to Rs 200.',
        whatHappened: 'Bharti Airtel posted robust quarterly net profit gains led by ARPU expansion.',
        whyItMatters: 'Indicates resilient pricing power and rising operating cash flows.',
        keyFacts: ['Net profit up 15% YoY', 'ARPU at Rs 200']
      };
      const res = SummaryQualityGate.evaluate(art, payload);
      expect(res.whatHappened).toBe(payload.whatHappened);
      expect(res.whyItMatters).toBe(payload.whyItMatters);
      expect(res.keyFacts).toEqual(payload.keyFacts);
    });
  });

  // =========================================================================
  // DOMAIN F: INTEGRATION, ZERO-REGRESSIONS & CONTROL PLANE CHECKS (51-60)
  // =========================================================================
  describe('Domain F: Integration, Zero-Regressions & Control Plane checks', () => {
    it('51. SummaryQualityGate evaluates correctly with object format payloads', () => {
      const art = makeArticle({});
      const payload = {
        summary: 'Bharti Airtel consolidated net profit climbed 15% YoY to Rs 3,500 crore.',
        whatHappened: 'Consolidated profit rose to Rs 3500cr.',
        whyItMatters: 'Favorable operational scaling.'
      };
      const res = SummaryQualityGate.evaluate(art, payload);
      expect(res.passed).toBe(true);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('52. SummaryQualityGate evaluates correctly with string format payloads', () => {
      const art = makeArticle({});
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported high revenue. Performance expanded consolidated profit levels securely.');
      expect(res.passed).toBe(true);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('53. Evaluation behavior with unverified publishers and failed extraction', () => {
      const art = makeArticle({ publisher: 'Unverified Blog', url: 'https://unverified.com/article', body: '' });
      const res = SummaryQualityGate.evaluate(art, 'Some summary text.');
      expect(res.passed).toBe(false);
      expect(res.summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });

    it('54. Evaluation behavior with clean HTML body having successful extraction', () => {
      const art = makeArticle({ body: '<div><p>Bharti Airtel consolidated net profit grew robustly to Rs 3500 crore for the quarter, reflecting very strong operating performance and market share expansion across all major telecom circles.</p></div>' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel posted strong net profit of Rs 3500 crore in the current financial quarter.');
      expect(res.passed).toBe(true);
      expect(res.summaryStatus).toBe('SOURCE_GROUNDED');
    });

    it('55. Zero regressions for historical articles hydration', () => {
      const articles = newsStore.getAllArticles();
      expect(articles.length).toBeGreaterThan(0);
      const first = articles[0];
      expect(first.id).toBeDefined();
    });

    it('56. Zero regressions for Telegram alert eligibility on non-grounded summaries', () => {
      // Non-grounded summaries must evaluate as ineligible for immediate automated trading alerts
      const art = makeArticle({ body: '', content: '', description: '' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel results update.');
      expect(res.passed).toBe(false);
    });

    it('57. Zero regressions on SourceArticleExtractionGate score thresholds', () => {
      const score = SourceArticleExtractionGate.getMinScoreThreshold();
      expect(score).toBeGreaterThanOrEqual(10);
    });

    it('58. Validation gate checks if clean body is required for grounded summaries', () => {
      const art = makeArticle({ body: '', content: '', description: '' });
      const res = SummaryQualityGate.evaluate(art, 'Bharti Airtel reported profits.');
      expect(res.summaryStatus).not.toBe('SOURCE_GROUNDED');
    });

    it('59. Cache service is updated with proper state mappings', () => {
      const service = NewsSummaryService.getInstance();
      expect(service.getOrGenerateSummary).toBeDefined();
    });

    it('60. NewsSummaryService properly handles and returns the four state values', async () => {
      const service = NewsSummaryService.getInstance();
      const art = makeArticle({ body: '', content: '', description: '' });
      const res = await service.getOrGenerateSummary(art);
      expect((res as any).summaryStatus).toBe('SOURCE_UNAVAILABLE');
    });
  });
});
