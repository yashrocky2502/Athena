/**
 * ATHENA NEWS ENGINE V3 — NORMALIZATION REGRESSION TEST SUITE
 * 
 * Verifies Phase 3 Universal Normalization Engine across 100+ simulated financial news articles
 * from Economic Times, Reuters, Moneycontrol, LiveMint, Business Standard, NSE, BSE, SEBI, RBI, and filings.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NormalizationEngine, RawArticleInput } from '../normalization/NormalizationEngine';
import { HtmlCleaner } from '../normalization/HtmlCleaner';
import { UnicodeNormalizer } from '../normalization/UnicodeNormalizer';
import { SentenceSegmenter } from '../normalization/SentenceSegmenter';
import { ParagraphBuilder } from '../normalization/ParagraphBuilder';
import { CompanyDetector } from '../normalization/CompanyDetector';
import { CurrencyNormalizer } from '../normalization/CurrencyNormalizer';
import { DateNormalizer } from '../normalization/DateNormalizer';
import { CanonicalUrlResolver } from '../normalization/CanonicalUrlResolver';

describe('NewsEngineV3 — Phase 3 Universal Normalization Engine', () => {
  let engine: NormalizationEngine;

  beforeEach(() => {
    engine = new NormalizationEngine();
  });

  it('1. Should clean raw HTML tags, scripts, tracking pixels, and decode entities', () => {
    const rawHtml = `
      <div class="ad-banner">Sponsored Ad</div>
      <script>var track = true;</script>
      <h1>Reliance Industries Q1 Results &amp; Profit Growth</h1>
      <p>Reliance Industries Ltd. reported net profit of &#8377; 18,900 crore in Q1 FY27.<br>Revenue rose by 12.5% YoY.</p>
      <iframe src="tracker.html"></iframe>
    `;

    const cleaned = HtmlCleaner.cleanHtml(rawHtml);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<iframe>');
    expect(cleaned).toContain('Reliance Industries Ltd. reported net profit of ₹ 18,900 crore');
    expect(cleaned).toContain('Revenue rose by 12.5% YoY.');
  });

  it('2. Should normalize unicode quotes, dashes, and non-breaking spaces', () => {
    const text = "“Reliance Industries Ltd.–Q1 Results” reported ‘strong growth’\u00A0with revenue of ₹10,000 Cr.";
    const normalized = UnicodeNormalizer.normalize(text);

    expect(normalized).toContain('"Reliance Industries Ltd. - Q1 Results"');
    expect(normalized).toContain("'strong growth'");
    expect(normalized).not.toContain('\u00A0');
  });

  it('3. Should protect financial abbreviations during sentence segmentation', () => {
    const para = ParagraphBuilder.buildParagraphs(
      "Reliance Industries Ltd. reported net profit of Rs. 593.50 crore for Q1 FY27. Revenue grew 14.2% YoY to Rs. 12,450 crore. Co. Ltd. expansion plans remain on track."
    );

    const sentences = SentenceSegmenter.segmentParagraphs(para);

    expect(sentences.length).toBe(3);
    expect(sentences[0].text).toContain("Reliance Industries Ltd.");
    expect(sentences[0].text).toContain("Rs. 593.50 crore");
    expect(sentences[1].text).toContain("14.2% YoY");
    expect(sentences[2].text).toContain("Co. Ltd.");
  });

  it('4. Should detect Indian blue-chip companies and ticker symbols', () => {
    const title = "Tata Motors Q1 Net Profit Jumps 30% on Strong JLR Sales";
    const text = "Tata Motors Limited announced strong quarterly performance driven by Jaguar Land Rover. Meanwhile, Infosys and HDFC Bank also reported gains.";

    const companies = CompanyDetector.detectCompanies(title, text);

    expect(companies.length).toBeGreaterThanOrEqual(3);
    const tataMotors = companies.find(c => c.ticker === 'TATAMOTORS');
    expect(tataMotors).toBeDefined();
    expect(tataMotors?.isPrimary).toBe(true);
    expect(tataMotors?.sector).toBe('Automotive');
  });

  it('5. Should extract and normalize INR and USD currencies into Crores and Millions', () => {
    const text = "Company revenue reached Rs 593 crore while international sales brought in $ 1.2 billion.";
    const currencies = CurrencyNormalizer.extractAndNormalize(text);

    expect(currencies.length).toBe(2);
    expect(currencies[0].numericValueCr).toBe(593);
    expect(currencies[0].standardizedDisplay).toBe('₹593 Cr');
    expect(currencies[1].numericValueMn).toBe(1200);
    expect(currencies[1].standardizedDisplay).toBe('$1.2 Bn');
  });

  it('6. Should normalize Indian news timestamps and resolve canonical URLs', () => {
    const dateNorm = DateNormalizer.normalize("August 7, 2026 08:30 IST");
    expect(dateNorm.isoString).toContain("2026-08-07");

    const url = CanonicalUrlResolver.resolve("https://www.moneycontrol.com/news/markets/reliance-q1-123.html?utm_source=telegram&gclid=xyz123#ref");
    expect(url).toBe("https://www.moneycontrol.com/news/markets/reliance-q1-123.html");
  });

  it('7. Should process 100+ simulated articles sequentially with <100ms average latency', async () => {
    const publishers: Array<{ id: any; name: string }> = [
      { id: 'ECONOMIC_TIMES', name: 'The Economic Times' },
      { id: 'REUTERS', name: 'Reuters India' },
      { id: 'MONEYCONTROL', name: 'Moneycontrol' },
      { id: 'LIVEMINT', name: 'LiveMint' },
      { id: 'BUSINESS_STANDARD', name: 'Business Standard' },
      { id: 'NSE', name: 'National Stock Exchange' },
      { id: 'BSE', name: 'Bombay Stock Exchange' },
      { id: 'SEBI', name: 'SEBI Press Release' },
      { id: 'RBI', name: 'Reserve Bank of India' },
      { id: 'COMPANY_FILING', name: 'Corporate Disclosure' }
    ];

    const testArticles: RawArticleInput[] = [];

    // Generate 100 distinct article inputs across the 10 publisher categories
    for (let i = 1; i <= 100; i++) {
      const pub = publishers[(i - 1) % publishers.length];
      testArticles.push({
        title: `Financial News Headline #${i}: Corporate Revenue Update for Q1 FY27`,
        publisher: pub.name,
        publisherId: pub.id as any,
        sourceUrl: `https://news.example.com/article-${i}?utm_source=rss`,
        publishedAt: `August 7, 2026 10:${(i % 50).toString().padStart(2, '0')} IST`,
        rawContent: `
          <div class="header">Header Nav Bar</div>
          <h1>Article Title #${i}</h1>
          <p>Tata Consultancy Services (TCS) and Infosys Ltd. reported Q1 FY27 results. Net profit grew by 12.5% YoY to Rs. ${4000 + i} crore.</p>
          <p>Executive management indicated strong order wins worth $ ${1.5 + (i % 5)} billion across European and North American markets.</p>
          <p>Disclaimer: Read More on Moneycontrol. Copyright © All rights reserved.</p>
        `
      });
    }

    const startTime = Date.now();
    let successCount = 0;

    for (const article of testArticles) {
      const result = await engine.normalize(article);
      if (result.success) {
        successCount++;
        expect(result.document).toBeDefined();
        expect(result.document?.paragraphs.length).toBeGreaterThanOrEqual(1);
        expect(result.document?.sentences.length).toBeGreaterThanOrEqual(2);
        expect(result.document?.hashes.normalizedHash).toBeDefined();
      }
    }

    const totalTimeMs = Date.now() - startTime;
    const avgLatency = totalTimeMs / testArticles.length;

    expect(successCount).toBe(100);
    expect(avgLatency).toBeLessThan(100); // Must be under 100ms per article
  });

  it('8. Should reject invalid articles failing Quality Gate constraints', async () => {
    const invalidArticle: RawArticleInput = {
      title: '', // Missing title
      publisher: 'Test Publisher',
      rawContent: '<p>Only one sentence here.</p>' // Less than 2 sentences & missing title
    };

    const result = await engine.normalize(invalidArticle);
    expect(result.success).toBe(false);
    expect(result.validationResult.isValid).toBe(false);
    expect(result.validationResult.errors.length).toBeGreaterThan(0);
  });
});
