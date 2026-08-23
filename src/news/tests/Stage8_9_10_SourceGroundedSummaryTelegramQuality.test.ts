/**
 * ATHENA NEWS ENGINE — STAGE 8.9.10
 * Stage8_9_10_SourceGroundedSummaryTelegramQuality.test.ts
 * 
 * Production Quality Gate and Source-Grounded Extraction Verification Suite
 * Verifies 50 distinct test scenarios covering ET/Mint gates, boilerplate suppression,
 * and strict F&O zero-fabrication / Telegram eligibility validations.
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { SourceArticleExtractionGate } from '../intelligence/SourceArticleExtractionGate';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate';
import { TelegramEligibilityAssessment, MarketDirection, AlertUrgency } from '../telegram/TelegramAlertEligibilityEngine';
import { NewsArticle } from '../models/NewsArticle';

// Helper to construct a basic NewsArticle for testing
function makeArticle(overrides: any): any {
  const base = {
    id: `art_${Math.random().toString(36).slice(2, 9)}`,
    title: 'Nifty options trade at record high',
    content: 'Stock market derivatives volume spiked on near-month options as implied volatility rose.',
    url: 'https://economictimes.indiatimes.com/markets/stocks/news/nifty-options-trade',
    publisher: 'Economic Times',
    collectedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    category: 'MARKET_UPDATE',
    sentiment: 'BULLISH',
    ...overrides
  };

  return {
    ...base,
    headline: overrides.headline || base.title,
    body: overrides.body || base.content
  };
}

// Helper to construct a basic TelegramEligibilityAssessment for testing
function makeAssessment(overrides: Partial<TelegramEligibilityAssessment>): TelegramEligibilityAssessment {
  return {
    isEligible: true,
    score: 85,
    urgency: 'HIGH' as AlertUrgency,
    eventType: 'FNO',
    category: 'F&O',
    symbol: 'NIFTY',
    companyName: 'Nifty Index',
    direction: 'BULLISH' as MarketDirection,
    directionReason: 'Strong option open interest buildup',
    observedMarketReaction: null,
    confidence: 90,
    traderRelevance: 'Volatility expansion expected around weekly expiry.',
    executiveSummary: 'Implied volatility surges as weekly call open interest gains traction.',
    whyItMatters: 'Strong directional shift indicated by massive near-month option activity.',
    whatToMonitor: ['24000 strike open interest'],
    sources: ['Economic Times'],
    fnoEvidence: {
      hasExplicitDerivativesData: false
    },
    scoreBreakdown: {
      marketImpact: 20,
      eventSignificance: 15,
      fnoRelevance: 15,
      evidenceQuality: 15,
      entityRelevance: 10,
      sourceAuthority: 5,
      novelty: 5
    },
    ...overrides
  } as TelegramEligibilityAssessment;
}

describe('STAGE 8.9.10: Source-Grounded Extraction & Telegram Quality Gate (50 Test Scenarios)', () => {

  beforeAll(() => {
    // Enable strict dispatching thresholds for testing
    process.env.TELEGRAM_DISPATCH_THRESHOLD = 'HIGH';
  });

  beforeEach(() => {
    // Reset the alert history before each test to bypass deduplication logic
    TelegramQualityGate.clearHistory();
  });

  // ==========================================
  // SCENARIOS 1-5: ECONOMIC TIMES VALID SOURCES
  // ==========================================
  describe('Scenarios 1-5: Economic Times (ET) Valid Sources', () => {
    test('Scenario 1: Standard ET Market Ingestion with ample text body', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: 'Nifty indices climbed on Friday led by banking stocks as HDFC Bank shares soared 4% following stellar earnings. Market participants noted that foreign institutional investors were net buyers during the morning session.'
      });
      const { diagnostic, cleanBody } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
      expect(diagnostic.extractionScore).toBeGreaterThanOrEqual(75);
      expect(cleanBody).toContain('Friday led by banking');
    });

    test('Scenario 2: ET article matching via Indiatimes domain', () => {
      const art = makeArticle({
        publisher: undefined,
        url: 'https://economictimes.indiatimes.com/industry/banking/finance/hdfc-bank',
        content: 'Finance sector surges after Reserve Bank of India eases compliance norms for commercial lenders. Lenders are expected to see improved credit flow and a substantial reduction in compliance costs over the next fiscal year.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      if (diagnostic.extractionStatus !== 'SUCCESS') {
        console.log('Scenario 2 failed diagnostic:', JSON.stringify(diagnostic, null, 2));
      }
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 3: ET editorial analysis with sufficient body size', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: 'Indian equity markets entered a consolidation phase. Experts suggest near-term cautiousness, though long-term growth triggers like manufacturing remain intact.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 4: ET Corporate Announcement with 200+ characters', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: 'Reliance Industries announced a joint venture with global tech giant for cloud infrastructure. The deal is valued at $1.5 billion and expected to close in Q3.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 5: ET F&O Derivatives Special Feature', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: 'Derivatives traders added massive open interest in Nifty 24500 calls. PCR dropped to 0.85 signaling a potential cap on the near-term index upside.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });
  });

  // ==========================================
  // SCENARIOS 6-10: ET INVALID / FAILED SOURCES
  // ==========================================
  describe('Scenarios 6-10: Economic Times (ET) Invalid / Short / Contaminated Sources', () => {
    test('Scenario 6: ET article with empty content body', () => {
      const art = makeArticle({ publisher: 'Economic Times', content: '' });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
      expect(diagnostic.rejectionReason).toContain('empty');
    });

    test('Scenario 7: ET article with generic single sentence stub', () => {
      const art = makeArticle({ publisher: 'Economic Times', content: 'Stock prices closed slightly lower today.' });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
      expect(diagnostic.rejectionReason).toContain('fell below threshold');
    });

    test('Scenario 8: ET article containing HTML tags/boilerplate contamination', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: '<html><body>Please login to read the full subscriber-only premium story. Click here for ad-free experience.</body></html>'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
      expect(diagnostic.rejectionReason).toContain('Contamination: true');
    });

    test('Scenario 9: ET article with login wall placeholder only', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: 'Subscribe to ET Prime for premium insights. This article is restricted to premium members.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 10: ET article filled with zero-substance navigation links', () => {
      const art = makeArticle({
        publisher: 'Economic Times',
        content: 'Home | Markets | Stocks | News | Mutual Funds | Wealth | Terms of Service | Privacy Policy'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });
  });

  // ==========================================
  // SCENARIOS 11-15: LIVEMINT VALID SOURCES
  // ==========================================
  describe('Scenarios 11-15: LiveMint Valid Sources', () => {
    test('Scenario 11: LiveMint market wrap with ample text', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        url: 'https://livemint.com/market/live-blog/nifty-sensex-updates',
        content: 'Sensex dropped 500 points in afternoon trade amid heavy selling in metal and energy counters following weak global cues.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 12: LiveMint Corporate earnings report', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'TCS reports solid net profit growth of 8.2% year-on-year, beat analyst expectations on strong retail-banking client deal pipelines.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 13: LiveMint Regulatory and SEBI filing news', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'SEBI proposes tightening derivative trade eligibility rules by raising minimum lot sizes. This regulatory move aims to protect small investors from excessive risk. The minimum transaction threshold is expected to be raised by 50% from next month.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 14: LiveMint Block deal trade announcement', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'A promoter entity of Bharti Airtel sold shares worth Rs 2,500 crore in a secondary market block deal block.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });

    test('Scenario 15: LiveMint Editorial macro economy perspective', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'GST collections for August grew by 11.5% to cross Rs 1.75 lakh crore, reflecting resilient domestic consumer demand.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('SUCCESS');
    });
  });

  // ==========================================
  // SCENARIOS 16-20: LIVEMINT INVALID SOURCES
  // ==========================================
  describe('Scenarios 16-20: LiveMint Invalid / Failed Sources', () => {
    test('Scenario 16: LiveMint article with single-sentence stub', () => {
      const art = makeArticle({ publisher: 'LiveMint', content: 'Gold prices trading steady.' });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 17: LiveMint premium wall text match', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'This is a premium subscriber exclusive. Sign in to your LiveMint account to read the complete article.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 18: LiveMint empty body extraction', () => {
      const art = makeArticle({ publisher: 'LiveMint', content: '   \n  ' });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 19: LiveMint cookie/JavaScript challenge body', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'Please enable JavaScript and refresh the page to view this website correctly.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 20: LiveMint marketing/subscription offer spam', () => {
      const art = makeArticle({
        publisher: 'LiveMint',
        content: 'Subscribe to Mint Premium for ad-free access, daily newsletters, Wall Street Journal bundle and more.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });
  });

  // ==========================================
  // SCENARIOS 21-25: NON-TARGET PUBLISHERS
  // ==========================================
  describe('Scenarios 21-25: Non-Target Publishers Suppressed', () => {
    test('Scenario 21: Business Standard article suppressed', () => {
      const art = makeArticle({
        publisher: 'Business Standard',
        url: 'https://www.business-standard.com/markets/stocks/l-and-t',
        content: 'L&T wins major order worth Rs 4,500 crore for infrastructure.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
      expect(diagnostic.rejectionReason).toContain('not supported');
    });

    test('Scenario 22: Bloomberg India article suppressed', () => {
      const art = makeArticle({
        publisher: 'Bloomberg India',
        url: 'https://www.bloomberg.com/news/articles/bonds',
        content: 'Indian sovereign bonds gain following JP Morgan index inclusion.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 23: Moneycontrol article suppressed', () => {
      const art = makeArticle({
        publisher: 'Moneycontrol',
        url: 'https://www.moneycontrol.com/news/business/markets',
        content: 'Nifty IT index rallies over 3% tracking Nasdaq overnight gain.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 24: Financial Express article suppressed', () => {
      const art = makeArticle({
        publisher: 'Financial Express',
        url: 'https://www.financialexpress.com/market/fmcg',
        content: 'FMCG stocks gain after monsoon rainfall deficit narrows.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });

    test('Scenario 25: Reuters article suppressed', () => {
      const art = makeArticle({
        publisher: 'Reuters',
        url: 'https://www.reuters.com/markets/india',
        content: 'India trade deficit expands in August as gold imports jump.'
      });
      const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
      expect(diagnostic.extractionStatus).toBe('FAILED');
    });
  });

  // ==========================================
  // SCENARIOS 26-30: HEADLINE REPETITION IN SUMMARY
  // ==========================================
  describe('Scenarios 26-30: Headline Repetition Guard checks', () => {
    test('Scenario 26: Block summary that repeats headline verbatim', () => {
      const art = makeArticle({ headline: 'TCS net profit rises 10%' });
      const assessment = makeAssessment({
        executiveSummary: 'TCS net profit rises 10%',
        whyItMatters: 'Strong demand triggers growth.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('HEADLINE_AS_SUMMARY');
    });

    test('Scenario 27: Block summary which is a tiny subset variation of headline', () => {
      const art = makeArticle({
        headline: 'Wipro acquires US consulting firm for $150M',
        content: 'Wipro acquires US consulting firm for $150M. This transaction expands presence.',
        category: 'CORPORATE'
      });
      const assessment = makeAssessment({
        category: 'CORPORATE',
        symbol: 'WIPRO',
        executiveSummary: 'Wipro acquires US consulting firm for $150M.',
        whyItMatters: 'Extends consulting footprint in Western market.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('HEADLINE_AS_SUMMARY');
    });

    test('Scenario 28: Valid summary with genuine synthesis passes', () => {
      const art = makeArticle({
        headline: 'SBI raises lending rates by 10 bps',
        content: 'State Bank of India SBI raised lending rates by 10 bps to protect margins.',
        category: 'CORPORATE'
      });
      const assessment = makeAssessment({
        category: 'CORPORATE',
        symbol: 'SBI',
        executiveSummary: 'State Bank of India SBI marginally hiked its marginal cost of funds-based lending rate across all tenors, raising borrowing costs for retail loans.',
        whyItMatters: 'This policy tightening will compress net interest margins if deposit rate hikes persist.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(true);
    });

    test('Scenario 29: Block summary when executive summary is empty', () => {
      const art = makeArticle({ headline: 'Axis Bank reports high credit cost' });
      const assessment = makeAssessment({
        executiveSummary: '',
        whyItMatters: 'Credit costs are rising for retail book.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('EMPTY_OR_SHORT_SUMMARY');
    });

    test('Scenario 30: Block summary when summary is too short', () => {
      const art = makeArticle({ headline: 'Grasim Industries to expand capital expenditure' });
      const assessment = makeAssessment({
        executiveSummary: 'Grasim expands capex.',
        whyItMatters: 'This expansion targets near-month capacity addition.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('EMPTY_OR_SHORT_SUMMARY');
    });
  });

  // ==========================================
  // SCENARIOS 31-35: WHY IT MATTERS BOILERPLATE
  // ==========================================
  describe('Scenarios 31-35: Why It Matters Quality Guards', () => {
    test('Scenario 31: Block boilerplate sentence: "Material development for market participants."', () => {
      const assessment = makeAssessment({
        whyItMatters: 'Material development for market participants.'
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_BOILERPLATE_REASONING');
    });

    test('Scenario 32: Block boilerplate sentence: "This development is important..."', () => {
      const assessment = makeAssessment({
        whyItMatters: 'This development is important for all investors monitoring stocks.'
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_BOILERPLATE_REASONING');
    });

    test('Scenario 33: Block boilerplate sentence: "This announcement could impact sentiment..."', () => {
      const assessment = makeAssessment({
        whyItMatters: 'This announcement could impact sentiment across banking stocks.'
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_BOILERPLATE_REASONING');
    });

    test('Scenario 34: Block boilerplate sentence: "Investors should monitor..."', () => {
      const assessment = makeAssessment({
        whyItMatters: 'Investors should monitor this company performance over coming quarters.'
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_BOILERPLATE_REASONING');
    });

    test('Scenario 35: Empty Why It Matters is blocked', () => {
      const assessment = makeAssessment({
        whyItMatters: ''
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('EMPTY_WHY_IT_MATTERS');
    });
  });

  // ==========================================
  // SCENARIOS 36-40: F&O OPTIONS SELLER FALLBACKS
  // ==========================================
  describe('Scenarios 36-40: F&O Options Seller Fallback & Compliance Guards', () => {
    test('Scenario 36: Reject F&O alert if options seller impact is standard fallback', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        optionsSellerImpact: 'No actionable F&O setup from this article alone.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        traderRelevance: 'No actionable F&O setup from this article alone.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_OPTIONS_SELLER_IMPACT');
    });

    test('Scenario 37: Reject F&O alert if options seller impact advice contains disclaimer fallback', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        optionsSellerImpact: 'Consult professional advisor before placing options trades.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        traderRelevance: 'Consult professional advisor.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_OPTIONS_SELLER_IMPACT');
    });

    test('Scenario 38: Reject F&O alert if options seller impact is empty', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        optionsSellerImpact: ''
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        traderRelevance: ''
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('GENERIC_OPTIONS_SELLER_IMPACT');
    });

    test('Scenario 39: Allow valid, specific F&O Options Seller analysis', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        headline: 'Nifty options trades near 24500 strike',
        content: 'Derivatives traders active around Nifty 24500 options.',
        optionsSellerImpact: 'Sell Nifty 24500 calls as significant call writing buildup caps index upside potential.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'NIFTY',
        traderRelevance: 'Sell Nifty 24500 calls as significant call writing buildup.',
        whyItMatters: 'Significant options trade buildup near 24500 strike.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(true);
    });

    test('Scenario 40: Low Urgency alert suppression below HIGH threshold', () => {
      const assessment = makeAssessment({
        urgency: 'LOW'
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('URGENCY_BELOW_THRESHOLD');
    });
  });

  // ==========================================
  // SCENARIOS 41-45: SENTIMENT NEUTRAL CO-ORDINATION FOR F&O
  // ==========================================
  describe('Scenarios 41-45: Sentiment and Direction constraints for F&O category', () => {
    test('Scenario 41: Block F&O alert with Neutral direction', () => {
      const art = makeArticle({ category: 'F&O', isFno: true } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        direction: 'NEUTRAL'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('NEUTRAL_FNO_ALERT_BLOCKED');
    });

    test('Scenario 42: Block F&O alert with Neutral article sentiment', () => {
      const art = makeArticle({ category: 'F&O', isFno: true, sentiment: 'NEUTRAL' } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        direction: 'BULLISH'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('NEUTRAL_FNO_ALERT_BLOCKED');
    });

    test('Scenario 43: Accept Bullish F&O alert', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        sentiment: 'BULLISH',
        headline: 'Nifty options trades near 24500 strike',
        content: 'Derivatives traders active around Nifty 24500 options.',
        optionsSellerImpact: 'Sell Nifty 24500 calls as significant call writing buildup caps index upside potential.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'NIFTY',
        direction: 'BULLISH',
        traderRelevance: 'Buy near-month calls as major positive catalyst is anticipated at 24500.',
        whyItMatters: 'Significant options trade buildup near 24500 strike.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      if (!result.passed) {
        console.log('Scenario 43 validation failed:', JSON.stringify(result, null, 2));
      }
      expect(result.passed).toBe(true);
    });

    test('Scenario 44: Accept Bearish F&O alert', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        sentiment: 'BEARISH',
        headline: 'Nifty options trades near 24500 strike',
        content: 'Derivatives traders active around Nifty 24500 options.',
        optionsSellerImpact: 'Sell Nifty 24500 calls as significant call writing buildup caps index upside potential.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'NIFTY',
        direction: 'BEARISH',
        traderRelevance: 'Buy put options to hedge near-term downside pressure at 24500.',
        whyItMatters: 'Significant options trade buildup near 24500 strike.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      if (!result.passed) {
        console.log('Scenario 44 validation failed:', JSON.stringify(result, null, 2));
      }
      expect(result.passed).toBe(true);
    });

    test('Scenario 45: Medium Urgency alert suppression below default HIGH threshold', () => {
      const assessment = makeAssessment({
        urgency: 'MEDIUM'
      });
      const result = TelegramQualityGate.validate(assessment, makeArticle({}));
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('URGENCY_BELOW_THRESHOLD');
    });
  });

  // ==========================================
  // SCENARIOS 46-50: ZERO FABRICATION FOR F&O
  // ==========================================
  describe('Scenarios 46-50: Zero Fabrication of F&O symbols, strikes, or premium levels', () => {
    test('Scenario 46: Block F&O alert if target symbol is fabricated', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        content: 'Stock options volumes are increasing heavily.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'RELIANCE',
        traderRelevance: 'Option volumes spike.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('FABRICATED_SYMBOL');
    });

    test('Scenario 47: Block F&O alert if strike price is fabricated (not in source text)', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        content: 'TCS derivatives volume gained momentum near historical high.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'TCS',
        traderRelevance: 'Derivatives buildup noted near 4200 strike.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('FABRICATED_STRIKE_OR_PREMIUM');
    });

    test('Scenario 48: Block F&O alert if premium level is fabricated (not in source text)', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        content: 'Nifty call premiums expanded significantly.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'NIFTY',
        traderRelevance: 'Option premium levels surged to 150 points.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('FABRICATED_STRIKE_OR_PREMIUM');
    });

    test('Scenario 49: Accept F&O alert when symbols and strikes are completely grounded in source', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        headline: 'TCS option contracts at 4000 strike witnessed heavy call writing',
        content: 'TCS option contracts at 4000 strike witnessed heavy call writing on Thursday.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'TCS',
        traderRelevance: 'Call writing at 4000 strike indicates strong overhead resistance.',
        whyItMatters: 'Heavy call writing at the 4000 strike creates a major supply zone.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(true);
    });

    test('Scenario 50: Critical urgency alert is correctly dispatched', () => {
      const art = makeArticle({
        category: 'F&O',
        isFno: true,
        headline: 'Nifty options saw massive block transactions at the 25000 strike price',
        content: 'Nifty options saw massive block transactions at the 25000 strike price.'
      } as any);
      const assessment = makeAssessment({
        category: 'F&O',
        symbol: 'NIFTY',
        urgency: 'CRITICAL',
        traderRelevance: 'Institutional activity noted at 25000 strike price.',
        whyItMatters: 'Large blocks at 25000 strike indicate strong positioning.'
      });
      const result = TelegramQualityGate.validate(assessment, art);
      expect(result.passed).toBe(true);
    });
  });

});
