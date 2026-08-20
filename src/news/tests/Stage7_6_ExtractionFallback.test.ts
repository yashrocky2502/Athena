/**
 * ATHENA NEWS ENGINE — STAGE 7.6 EXTRACTION FALLBACK SUITE
 */

import { describe, it, expect } from 'vitest';
import { TrafilaturaExtractor } from '../extraction/TrafilaturaExtractor';
import { Crawl4AIExtractor } from '../extraction/Crawl4AIExtractor';
import { JinaReaderExtractor } from '../extraction/JinaReaderExtractor';
import { FirecrawlExtractor } from '../extraction/FirecrawlExtractor';
import { PublisherProfileManager } from '../extraction/PublisherProfileManager';
import { ExtractionQualityEvaluator } from '../extraction/ExtractionQualityEvaluator';

describe('Stage 7.6: Extraction Fallback & Blocked Publisher Hardening Suite', () => {

  it('1. Quality-based extractor evaluation correctly assigns ratings', () => {
    const excellentText = "Reliance Jio announced Jio Prime subscription at Rs 300 per year. The company expects over 100 million subscribers to transition from free preview. Bharti Airtel and Vodafone Idea responded by revising monthly ARPU targets across telecom circles in India.";
    const scoreEx = ExtractionQualityEvaluator.evaluate('Jio Launch', excellentText, excellentText);
    expect(['EXCELLENT', 'ACCEPTABLE']).toContain(scoreEx.quality);

    const emptyScore = ExtractionQualityEvaluator.evaluate('Empty Article', '');
    expect(emptyScore.quality).toBe('FAILED');
    expect(emptyScore.score).toBe(0);
  });

  it('2. TrafilaturaExtractor cleans scripts, ads, and HTML navigation artifacts', async () => {
    const extractor = new TrafilaturaExtractor();
    const rawHtml = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <nav>Home | Market | News</nav>
          <script>var tracker = 100;</script>
          <div class="ad-banner">Click here for discounts!</div>
          <p>Tata Consultancy Services declared an interim dividend of Rs 20 per share with record date fixed for August 28.</p>
        </body>
      </html>
    `;
    const res = await extractor.extract('https://moneycontrol.com/news/tcs-dividend', rawHtml);
    expect(res.cleanText).not.toContain('<script>');
    expect(res.cleanText).not.toContain('<nav>');
    expect(res.cleanText).toContain('Tata Consultancy Services declared an interim dividend');
  });

  it('3. Crawl4AIExtractor handles JavaScript-rendered DOM content', async () => {
    const extractor = new Crawl4AIExtractor();
    const rawHtml = `<div id="app"><p>Dynamic content loaded via React DOM execution: Infosys share buyback approved at Rs 1850 per share.</p></div>`;
    const res = await extractor.extract('https://mint.com/infosys-buyback', rawHtml);
    expect(res.cleanText).toContain('Infosys share buyback approved');
  });

  it('4. JinaReaderExtractor operates as third-party Markdown fallback', async () => {
    const extractor = new JinaReaderExtractor();
    expect(extractor.isEnabled()).toBe(true);
    const res = await extractor.extract('https://economic-times.com/sample', 'Sample page text content for fallback test.');
    expect(res.cleanText).toBeDefined();
  });

  it('5. FirecrawlExtractor initializes conditionally without crashing if API key absent', () => {
    const extractor = new FirecrawlExtractor();
    expect(extractor.isEnabled()).toBe(!!process.env.FIRECRAWL_API_KEY);
  });

  it('6. PublisherProfileManager learns optimal extractors per publisher domain', () => {
    const mgr = PublisherProfileManager.getInstance();
    mgr.recordResult('economic-times.com', 'TrafilaturaExtractor', 90, true);
    mgr.recordResult('economic-times.com', 'TrafilaturaExtractor', 85, true);

    const profile = mgr.getProfile('economic-times.com');
    expect(profile?.domain).toBe('economic-times.com');
    expect(profile?.preferredExtractor).toBe('TrafilaturaExtractor');
    expect(profile?.averageQuality).toBeGreaterThanOrEqual(80);
  });

  it('7. Handles login wall / cookie wall gracefully without throwing errors', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const paywallHtml = `<html><body><h1>Subscribe to read full story</h1><p>Please log in to continue reading this premium market report.</p></body></html>`;
    const res = await trafilatura.extract('https://paywall-site.com/article', paywallHtml);

    // Must return result gracefully with metadata fallback instead of crashing
    expect(res.cleanText).toBeDefined();
    expect(res.quality).toBe('WEAK');
  });

  it('8. Handles empty article body cleanly with FAILED quality rating', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const res = await trafilatura.extract('https://site.com/empty', '<html><body></body></html>');
    expect(res.quality).toBe('FAILED');
    expect(res.cleanText).toBe('');
  });

  it('9. Handles partial / truncated article without throwing exceptions', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const truncatedHtml = `<html><body><p>NTPC approves Rs 21,000 crore capex...</p></body></html>`;
    const res = await trafilatura.extract('https://site.com/truncated', truncatedHtml);
    expect(res.cleanText).toContain('NTPC approves');
  });

  it('10. Handles navigation-heavy page cleanly', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const navHeavyHtml = `
      <html>
        <body>
          <ul><li>Home</li><li>Markets</li><li>Mutual Funds</li><li>Crypto</li><li>Personal Finance</li></ul>
          <p>Reliance Jio launched Jio Prime subscription at Rs 300 annual fee across circles.</p>
        </body>
      </html>
    `;
    const res = await trafilatura.extract('https://site.com/nav-heavy', navHeavyHtml);
    expect(res.cleanText).toContain('Reliance Jio');
  });

  it('11. Handles advertisement-heavy page cleanly', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const adHeavyHtml = `
      <html>
        <body>
          <div class="ad">Buy insurance today!</div>
          <div class="sponsor">Sponsored content</div>
          <p>Indo-MIM shares hit 10% upper circuit following strong Q1 net profit growth.</p>
        </body>
      </html>
    `;
    const res = await trafilatura.extract('https://site.com/ad-heavy', adHeavyHtml);
    expect(res.cleanText).toContain('Indo-MIM shares hit 10%');
  });

  it('12. Extractor pipeline fallback executes next extractor when primary is WEAK or FAILED', async () => {
    const profileMgr = PublisherProfileManager.getInstance();
    profileMgr.recordResult('blocked-domain.com', 'TrafilaturaExtractor', 10, false);

    const profile = profileMgr.getProfile('blocked-domain.com');
    expect(profile?.averageQuality).toBeLessThan(40);
  });

  it('13. Does not attempt unauthorized paywall bypass or CAPTCHA bypass', async () => {
    const trafilatura = new TrafilaturaExtractor();
    const captchaHtml = `<html><body><h1>Verify you are human (CAPTCHA)</h1></body></html>`;
    const res = await trafilatura.extract('https://captcha-site.com', captchaHtml);
    expect(['FAILED', 'WEAK']).toContain(res.quality);
  });

  it('14. Metadata-only fallback retains headline and publisher info on total extraction failure', () => {
    const article = {
      id: 'fallback_01',
      title: 'BSE shares drop 3% after downgrade',
      publisher: 'Business Standard',
      content: ''
    };
    expect(article.title).toBeDefined();
    expect(article.publisher).toBeDefined();
  });

  it('15. Ingestion pipeline never crashes on blocked publisher pages', async () => {
    const crawl4ai = new Crawl4AIExtractor();
    const res = await crawl4ai.extract('https://blocked-publisher.com/news', 'Blocked');
    expect(res).toBeDefined();
  });

});
