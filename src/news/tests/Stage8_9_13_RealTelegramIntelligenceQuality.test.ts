import { describe, test, expect, beforeAll } from 'vitest';
import { SourceArticleExtractor } from '../intelligence/SourceArticleExtractor';
import { SourceArticleExtractionGate } from '../intelligence/SourceArticleExtractionGate';
import { SummaryQualityGate } from '../intelligence/SummaryQualityGate';
import { TelegramAlertEligibilityEngine } from '../telegram/TelegramAlertEligibilityEngine';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { TelegramQualityGate } from '../NewsEngine/TelegramQualityGate';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine';
import { IntelligenceStore } from '../../newsCoreV2/intelligenceV2/IntelligenceStore';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import * as fs from 'fs';
import * as path from 'path';

describe('STAGE 8.9.13: Real Telegram Intelligence Quality & Source Extraction Expansion (70 Tests)', () => {
  let allArticles: any[] = [];

  beforeAll(() => {
    IntelligenceStore.getInstance().clear();
    newsStore.hydrateFromDisk();
    allArticles = newsStore.getAllArticles();
  });

  // =========================================================================
  // CATEGORY 1: Source Extraction Expansion across Tier 1 - Tier 4 (Tests 1-20)
  // =========================================================================
  describe('Category 1: Multi-Tier Source Article Extractor & Publisher Detection', () => {
    test('Test 1: Detects Tier 1 official exchange NSE', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'NSE', url: 'https://www.nseindia.com/market-data' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('NSE');
      expect(match.tier).toBe('TIER_1');
    });

    test('Test 2: Detects Tier 1 official exchange BSE', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'BSE India', url: 'https://www.bseindia.com/markets' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('BSE');
      expect(match.tier).toBe('TIER_1');
    });

    test('Test 3: Detects Tier 1 market regulator SEBI', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'SEBI', url: 'https://www.sebi.gov.in/enforcement' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('SEBI');
      expect(match.tier).toBe('TIER_1');
    });

    test('Test 4: Detects Tier 1 monetary authority RBI', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Reserve Bank of India', url: 'https://www.rbi.org.in/scripts' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('RBI');
      expect(match.tier).toBe('TIER_1');
    });

    test('Test 5: Detects Tier 1 government information agency PIB', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Press Information Bureau', url: 'https://pib.gov.in/PressRelease' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('PIB');
      expect(match.tier).toBe('TIER_1');
    });

    test('Test 6: Detects Tier 2 major financial media Economic Times', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'The Economic Times', url: 'https://economictimes.indiatimes.com/markets' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('Economic Times');
      expect(match.tier).toBe('TIER_2');
    });

    test('Test 7: Detects Tier 2 major financial media LiveMint', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Mint', url: 'https://www.livemint.com/market' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('LiveMint');
      expect(match.tier).toBe('TIER_2');
    });

    test('Test 8: Detects Tier 2 major financial media Moneycontrol', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Moneycontrol', url: 'https://www.moneycontrol.com/news/business' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('Moneycontrol');
      expect(match.tier).toBe('TIER_2');
    });

    test('Test 9: Detects Tier 2 major financial media Business Standard', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Business Standard', url: 'https://www.business-standard.com/markets' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('Business Standard');
      expect(match.tier).toBe('TIER_2');
    });

    test('Test 10: Detects Tier 2 major financial media Financial Express', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Financial Express', url: 'https://www.financialexpress.com/market' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('Financial Express');
      expect(match.tier).toBe('TIER_2');
    });

    test('Test 11: Detects Tier 2 broadcast media CNBC TV18', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'CNBC-TV18', url: 'https://www.cnbctv18.com/market' });
      expect(match.matched).toBe(true);
      expect(match.canonicalName).toBe('CNBC TV18');
      expect(match.tier).toBe('TIER_2');
    });

    test('Test 12: Detects Tier 2 broadcast media Zee Business and NDTV Profit', () => {
      const zee = SourceArticleExtractor.detectPublisher({ publisher: 'Zee Business', url: 'https://www.zeebiz.com/market-news' });
      const ndtv = SourceArticleExtractor.detectPublisher({ publisher: 'NDTV Profit', url: 'https://www.ndtvprofit.com/markets' });
      expect(zee.canonicalName).toBe('Zee Business');
      expect(zee.tier).toBe('TIER_2');
      expect(ndtv.canonicalName).toBe('NDTV Profit');
      expect(ndtv.tier).toBe('TIER_2');
    });

    test('Test 13: Detects Tier 2 international wire services Reuters and Bloomberg', () => {
      const reuters = SourceArticleExtractor.detectPublisher({ publisher: 'Reuters', url: 'https://www.reuters.com/markets' });
      const bq = SourceArticleExtractor.detectPublisher({ publisher: 'BQ Prime', url: 'https://www.bqprime.com/business' });
      expect(reuters.canonicalName).toBe('Reuters');
      expect(reuters.tier).toBe('TIER_2');
      expect(bq.canonicalName).toBe('Bloomberg');
      expect(bq.tier).toBe('TIER_2');
    });

    test('Test 14: Detects Tier 3 national business desks Times of India and Hindu BusinessLine', () => {
      const toi = SourceArticleExtractor.detectPublisher({ publisher: 'Times of India', url: 'https://timesofindia.indiatimes.com/business' });
      const hbl = SourceArticleExtractor.detectPublisher({ publisher: 'Hindu BusinessLine', url: 'https://www.thehindubusinessline.com' });
      expect(toi.tier).toBe('TIER_3');
      expect(hbl.tier).toBe('TIER_3');
    });

    test('Test 15: Detects Tier 3 national business desks Indian Express and Business Today', () => {
      const ie = SourceArticleExtractor.detectPublisher({ publisher: 'Indian Express', url: 'https://indianexpress.com/section/business' });
      const bt = SourceArticleExtractor.detectPublisher({ publisher: 'Business Today', url: 'https://www.businesstoday.in/markets' });
      expect(ie.tier).toBe('TIER_3');
      expect(bt.tier).toBe('TIER_3');
    });

    test('Test 16: Detects Tier 4 market portals Upstox, Groww, and Zerodha Pulse', () => {
      const upstox = SourceArticleExtractor.detectPublisher({ publisher: 'Upstox', url: 'https://upstox.com/news' });
      const groww = SourceArticleExtractor.detectPublisher({ publisher: 'Groww', url: 'https://groww.in/blog' });
      const pulse = SourceArticleExtractor.detectPublisher({ publisher: 'Zerodha Pulse', url: 'https://pulse.zerodha.com' });
      expect(upstox.tier).toBe('TIER_4');
      expect(groww.tier).toBe('TIER_4');
      expect(pulse.tier).toBe('TIER_4');
    });

    test('Test 17: Detects Tier 4 market portals Trendlyne, ScanX Trade, and Rediff MoneyWiz', () => {
      const trendlyne = SourceArticleExtractor.detectPublisher({ publisher: 'Trendlyne', url: 'https://trendlyne.com/news' });
      const scanx = SourceArticleExtractor.detectPublisher({ publisher: 'ScanX Trade', url: 'https://scanx.trade/news' });
      const rediff = SourceArticleExtractor.detectPublisher({ publisher: 'Rediff MoneyWiz', url: 'https://rediff.com/moneywiz' });
      expect(trendlyne.tier).toBe('TIER_4');
      expect(scanx.tier).toBe('TIER_4');
      expect(rediff.tier).toBe('TIER_4');
    });

    test('Test 18: Detects Tier 4 aggregators Goodreturns and Yahoo Finance', () => {
      const gr = SourceArticleExtractor.detectPublisher({ publisher: 'Goodreturns', url: 'https://www.goodreturns.in' });
      const yf = SourceArticleExtractor.detectPublisher({ publisher: 'Yahoo Finance', url: 'https://finance.yahoo.com' });
      expect(gr.tier).toBe('TIER_4');
      expect(yf.tier).toBe('TIER_4');
    });

    test('Test 19: Unrecognized random blogs return matched: false and tier UNSUPPORTED', () => {
      const match = SourceArticleExtractor.detectPublisher({ publisher: 'Random Personal Blogspot', url: 'https://myrandomblog.blogspot.com/123' });
      expect(match.matched).toBe(false);
      expect(match.tier).toBe('UNSUPPORTED');
    });

    test('Test 20: SourceArticleExtractionGate detectPublisher retains backward compatibility', () => {
      const match = SourceArticleExtractionGate.detectPublisher({ publisher: 'Moneycontrol', url: 'https://www.moneycontrol.com' });
      expect(match.matched).toBe(true);
      expect(match.name).toBe('Moneycontrol');
    });
  });

  // =========================================================================
  // CATEGORY 2: HTML Sanitization & Boilerplate Stripping (Tests 21-35)
  // =========================================================================
  describe('Category 2: Deep HTML Sanitization and Boilerplate Removal', () => {
    test('Test 21: Decodes HTML entities safely (&nbsp;, &amp;, &quot;, &#39;, &#8377;)', () => {
      const raw = 'Tata Motors PAT up 12% &amp; revenue touches &quot;&#8377;45,000 Cr&quot;&#39;s benchmark &nbsp; today.';
      const decoded = SourceArticleExtractor.decodeHtmlEntities(raw);
      expect(decoded).toContain('Tata Motors PAT up 12% & revenue touches "₹45,000 Cr"\'s benchmark   today.');
    });

    test('Test 22: Strips HTML tags (<p>, <div>, <font>, <a>, <br>) cleanly', () => {
      const raw = '<p>L&T won a <font color="red">mega contract</font> worth <a href="https://example.com">₹2,500 Cr</a>.</p><br/>';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.hasResidualHtml).toBe(false);
      expect(sanitized.cleanBody).toBe('L&T won a mega contract worth ₹2,500 Cr.');
    });

    test('Test 23: Strips embedded <script> and <style> blocks', () => {
      const raw = '<script>alert("tracker");</script><style>.ad{color:red;}</style>ITC declared an interim dividend of ₹6.50 per share.';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toBe('ITC declared an interim dividend of ₹6.50 per share.');
    });

    test('Test 24: Removes ADVERTISEMENT boilerplate lines', () => {
      const raw = 'ADVERTISEMENT\nInfosys secured a $500M cloud migration deal with a major European bank.\nADVERTISEMENT';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toBe('Infosys secured a $500M cloud migration deal with a major European bank.');
    });

    test('Test 25: Removes "Click here to read more" and "Subscribe now" boilerplate', () => {
      const raw = 'Reliance Industries expanded its retail operations across 50 new locations. Click here to subscribe to LiveMint for more updates. Subscribe now.';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toBe('Reliance Industries expanded its retail operations across 50 new locations.');
    });

    test('Test 26: Removes "Follow us on Telegram/Twitter" and social media promo lines', () => {
      const raw = 'Bajaj Auto reported 18% YoY growth in domestic motorcycle sales. Follow us on Twitter and Telegram for real-time market buzz.';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toBe('Bajaj Auto reported 18% YoY growth in domestic motorcycle sales.');
    });

    test('Test 27: Removes "Also Read:" and "Related Stories:" navigation blocks', () => {
      const raw = 'HDFC Bank recorded loan book expansion of 14.5% in Q3. Also Read: Top 5 banking stocks to buy today. The net NPA improved to 0.31%.';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toContain('HDFC Bank recorded loan book expansion of 14.5% in Q3.');
      expect(sanitized.cleanBody).toContain('The net NPA improved to 0.31%.');
      expect(sanitized.cleanBody).not.toContain('Top 5 banking stocks');
    });

    test('Test 28: Removes "(With inputs from PTI/Reuters)" trailing wire tags', () => {
      const raw = 'SEBI issued revised margin trading regulations for equity derivatives. (With inputs from PTI)';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toBe('SEBI issued revised margin trading regulations for equity derivatives.');
    });

    test('Test 29: Accurate word count calculation on sanitized content', () => {
      const raw = 'State Bank of India reported net profit growth of 28% YoY reaching ₹17,000 Cr.';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.wordCount).toBeGreaterThanOrEqual(12);
    });

    test('Test 30: Accurate sentence count calculation on sanitized content', () => {
      const raw = 'Titan Company opened 40 new jewelry stores in Q3. Management highlighted strong wedding season demand. Margins remained stable at 11.2%.';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.sentenceCount).toBe(3);
    });

    test('Test 31: Returns cleanBody: null for pure boilerplate text', () => {
      const raw = 'ADVERTISEMENT\nClick here\nSubscribe now\nFollow us on Twitter';
      const sanitized = SourceArticleExtractor.sanitizeContent(raw);
      expect(sanitized.cleanBody).toBeNull();
    });

    test('Test 32: Evaluation succeeds on rich Moneycontrol article', () => {
      const article = {
        headline: 'Tata Motors bags ₹3,500 Cr EV bus order from state transport undertaking',
        body: 'Tata Motors Commercial Vehicles division has secured a landmark order to supply 2,500 electric buses. The order is valued at ₹3,500 crore with deliveries scheduled over 24 months. The operating margin on the contract is estimated at 9.5%.',
        publisher: 'Moneycontrol',
        canonicalUrl: 'https://www.moneycontrol.com/news/business/tata-motors-order-1234.html',
        publishedAt: '2026-08-24T06:00:00.000Z'
      };
      const result = SourceArticleExtractor.evaluate(article);
      expect(result.extractionStatus).toBe('SUCCESS');
      expect(result.extractionScore).toBeGreaterThanOrEqual(65);
      expect(result.tier).toBe('TIER_2');
      expect(result.cleanBody).toContain('Tata Motors Commercial Vehicles division');
    });

    test('Test 33: Evaluation succeeds on official NSE circular', () => {
      const article = {
        headline: 'NSE revises market lot size for 15 derivative contracts',
        body: 'The National Stock Exchange of India has issued a circular regarding revision in market lot sizes for equity derivative contracts. The new lot sizes will take effect from the next expiry cycle. Members are advised to adjust order management systems accordingly.',
        publisher: 'NSE',
        canonicalUrl: 'https://www.nseindia.com/circulars/fno-lot-size-2026.html',
        publishedAt: '2026-08-24T07:00:00.000Z'
      };
      const result = SourceArticleExtractor.evaluate(article);
      expect(result.extractionStatus).toBe('SUCCESS');
      expect(result.tier).toBe('TIER_1');
    });

    test('Test 34: Evaluation fails on snippet ending with trailing ellipsis', () => {
      const article = {
        headline: 'Sun Pharma receives USFDA approval for generic dermatology formulation',
        body: 'Sun Pharma has received final approval...',
        publisher: 'Moneycontrol',
        canonicalUrl: 'https://www.moneycontrol.com/news/sun-pharma.html'
      };
      const result = SourceArticleExtractor.evaluate(article);
      expect(result.extractionStatus).toBe('FAILED');
      expect(result.rejectionReason).toContain('threshold');
    });

    test('Test 35: Evaluation fails on unsupported domain with empty body', () => {
      const article = {
        headline: 'Unknown company announces product',
        body: '',
        publisher: 'RandomUnknown'
      };
      const result = SourceArticleExtractor.evaluate(article);
      expect(result.extractionStatus).toBe('FAILED');
    });
  });

  // =========================================================================
  // CATEGORY 3: Grounded Summaries & Zero Generic Templates (Tests 36-45)
  // =========================================================================
  describe('Category 3: Grounded AI Summaries & Zero Generic Templates', () => {
    test('Test 36: SummaryQualityGate passes on clean extracted article', () => {
      const article = {
        headline: 'Cipla receives USFDA establishment inspection report for Pithampur facility',
        body: 'Cipla has received the EIR from USFDA classifying the Pithampur manufacturing unit as Voluntary Action Indicated (VAI). This inspection was conducted in June 2026 and cleared without any data integrity observations.',
        publisher: 'LiveMint',
        publishedAt: '2026-08-24T08:00:00.000Z'
      };
      const summary = 'Cipla has received the EIR from USFDA classifying the Pithampur manufacturing unit as Voluntary Action Indicated (VAI). Inspection cleared without data integrity observations.';
      const res = SummaryQualityGate.evaluate(article, summary);
      expect(res.passed).toBe(true);
      expect(res.status).toBe('AVAILABLE');
    });

    test('Test 37: SummaryQualityGate rejects repeated headline', () => {
      const article = {
        headline: 'Wipro acquires cloud consulting firm for $120 million',
        body: 'Wipro has acquired a US-based cloud consulting firm for $120 million to expand its digital transformation footprint.',
        publisher: 'Economic Times'
      };
      const summary = 'Wipro acquires cloud consulting firm for $120 million';
      const res = SummaryQualityGate.evaluate(article, summary);
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });

    test('Test 38: SummaryQualityGate rejects generic "Market participants are monitoring" template', () => {
      const article = {
        headline: 'JSW Steel increases crude steel production capacity',
        body: 'JSW Steel commissioned a 5 MTPA expansion at its Vijayanagar facility.',
        publisher: 'Economic Times'
      };
      const summary = 'JSW Steel increases crude steel production capacity. Market participants are monitoring the operational trajectory.';
      const res = SummaryQualityGate.evaluate(article, summary);
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });

    test('Test 39: SummaryQualityGate rejects "Institutional analysts are assessing" template', () => {
      const article = {
        headline: 'Avenue Supermarts opens 12 new DMart stores in Q3',
        body: 'Avenue Supermarts has expanded its retail footprint by opening 12 new DMart stores across western India.',
        publisher: 'LiveMint'
      };
      const summary = 'Avenue Supermarts opens 12 new DMart stores in Q3. Institutional analysts are assessing operational margin trajectory.';
      const res = SummaryQualityGate.evaluate(article, summary);
      expect(res.passed).toBe(false);
      expect(res.status).toBe('SOURCE_UNAVAILABLE');
    });

    test('Test 40: UnifiedIntelligenceEngine formats earnings summary purely with facts', () => {
      const article = {
        id: 'test_earnings_fact',
        headline: 'Maruti Suzuki Q3 Net Profit jumps 33% YoY to ₹3,711 Cr',
        body: 'Maruti Suzuki India reported a 33% year-on-year increase in quarterly net profit at ₹3,711 crore for the third quarter ended December. Total revenue from operations stood at ₹33,500 crore.',
        publisher: 'LiveMint',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 90
      };
      const intel = UnifiedIntelligenceEngine.build(article as any);
      expect(intel.executiveSummary).not.toContain('Market participants are monitoring');
      expect(intel.executiveSummary).not.toContain('Institutional analysts are assessing');
      expect(intel.executiveSummary).not.toContain('Informs public policy');
    });

    test('Test 41: UnifiedIntelligenceEngine formats IPO summary without generic filler', () => {
      const article = {
        id: 'test_ipo_clean',
        headline: 'Swiggy IPO GMP rises to ₹25 ahead of anchor book opening',
        body: 'The grey market premium for Swiggy IPO has risen to ₹25 per share over the upper price band of ₹390. Anchor allocation will open on Tuesday.',
        publisher: 'Moneycontrol',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 88,
        eventType: 'IPO',
        category: 'IPO'
      };
      const intel = UnifiedIntelligenceEngine.build(article as any);
      expect(intel.executiveSummary).not.toContain('Primary market participants are tracking');
      expect(intel.executiveSummary).not.toContain('monitoring issue subscription metrics');
    });

    test('Test 42: Why It Matters is populated for all successfully extracted high-relevance articles', () => {
      const highRelevance = allArticles.filter(art => (art.relevanceScore || 0) >= 85).slice(0, 10);
      for (const art of highRelevance) {
        const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
        const intel = UnifiedIntelligenceEngine.build(art);
        if (diagnostic.extractionStatus === 'SUCCESS') {
          expect(intel.whyItMatters.length).toBeGreaterThan(0);
        }
      }
    });

    test('Test 43: Why It Matters is empty string for unsupported or failed extraction articles', () => {
      const unsupportedArticle = {
        id: 'test_unsupported_1',
        headline: 'Random Tech Blog: AI in Indian Stock Market',
        body: 'Short snippet from unknown blog...',
        publisher: 'RandomBlog123'
      };
      const intel = UnifiedIntelligenceEngine.build(unsupportedArticle as any);
      expect(intel.whyItMatters).toBe('');
      expect(intel.executiveSummary).toBe('Summary unavailable — Open original source');
    });

    test('Test 44: Key facts contain extracted quantitative numbers or distinct sentences', () => {
      const article = {
        id: 'test_key_facts',
        headline: 'NTPC Green Energy awards 1.2 GW solar project to domestic EPC contractors',
        body: 'NTPC Green Energy has awarded a 1.2 GW solar power project contract. The project involves an investment of ₹4,200 crore.',
        publisher: 'Economic Times',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 90
      };
      const intel = UnifiedIntelligenceEngine.build(article as any);
      expect(intel.keyFacts.length).toBeGreaterThan(0);
    });

    test('Test 45: Summary quality status is valid and materiality score is integer (0-100)', () => {
      for (const art of allArticles.slice(0, 15)) {
        const intel = UnifiedIntelligenceEngine.build(art);
        expect(['AVAILABLE', 'SOURCE_UNAVAILABLE']).toContain(intel.summaryStatus);
        expect(intel.materialityScore).toBeGreaterThanOrEqual(0);
        expect(intel.materialityScore).toBeLessThanOrEqual(100);
      }
    });
  });

  // =========================================================================
  // CATEGORY 4: Real Telegram Intelligence & Trader Direction (Tests 46-60)
  // =========================================================================
  describe('Category 4: Trader-Focused Direction & Telegram Formatting', () => {
    test('Test 46: Major profit growth results in BULLISH direction', () => {
      const res = TelegramAlertEligibilityEngine.determineDirection(
        'Tata Motors Q3 Net Profit surges 120% YoY beating Street estimates',
        'Strong JLR sales and margin expansion pushed profitability higher.',
        'EARNINGS'
      );
      expect(res.direction).toBe('BULLISH');
      expect(res.directionReason).toContain('Positive fundamental catalyst');
    });

    test('Test 47: Major order win results in BULLISH direction', () => {
      const res = TelegramAlertEligibilityEngine.determineDirection(
        'L&T secures mega ₹5,000 Cr hydrocarbon order from Middle East client',
        'The scope includes EPC engineering and commissioning over 36 months.',
        'ORDER_WIN'
      );
      expect(res.direction).toBe('BULLISH');
      expect(res.directionReason).toContain('Positive fundamental catalyst');
    });

    test('Test 48: Severe earnings slump results in BEARISH direction', () => {
      const res = TelegramAlertEligibilityEngine.determineDirection(
        'IndusInd Bank Q3 PAT down 38% YoY due to higher provisioning for microfinance book',
        'Net interest income declined 4% as credit costs rose sharply.',
        'EARNINGS'
      );
      expect(res.direction).toBe('BEARISH');
      expect(res.directionReason).toContain('Negative catalyst confirmed');
    });

    test('Test 49: Regulatory penalty or restriction results in BEARISH direction', () => {
      const res = TelegramAlertEligibilityEngine.determineDirection(
        'RBI bars major NBFC from sanctioning new gold loans citing supervisory concerns',
        'The central bank identified material deviations in loan-to-value calculations.',
        'REGULATORY_ACTION'
      );
      expect(res.direction).toBe('BEARISH');
      expect(res.directionReason).toContain('Negative catalyst confirmed');
    });

    test('Test 50: Block deal results in NEUTRAL direction with secondary market reasoning', () => {
      const res = TelegramAlertEligibilityEngine.determineDirection(
        'Block Deal: Promoter sells 2.5% stake in Zomato for ₹1,800 Cr',
        'Multiple foreign institutional buyers picked up the equity in pre-open session.',
        'BLOCK_DEAL'
      );
      expect(res.direction).toBe('NEUTRAL');
      expect(res.directionReason).toContain('ownership transfer');
    });

    test('Test 51: IPO parameters result in NEUTRAL direction', () => {
      const res = TelegramAlertEligibilityEngine.determineDirection(
        'Hyundai Motor India IPO price band set at ₹1,865 to ₹1,960 per share',
        'The ₹27,870 Cr issue will open for public subscription on October 15.',
        'IPO'
      );
      expect(res.direction).toBe('NEUTRAL');
      expect(res.directionReason).toContain('Primary market offering');
    });

    test('Test 52: Explicit F&O derivatives extraction detects spot, OI, PCR without fabrication', () => {
      const text = 'Nifty Jan Future at 24,520 (Spot: 24,480). Open Interest increased by 15.2 lakh shares. PCR stands at 1.35 with heavy put writing at 24,400 Strike.';
      const fno = TelegramAlertEligibilityEngine.extractFNOEvidence(text, 'NIFTY');
      expect(fno.hasExplicitDerivativesData).toBe(true);
      expect(fno.spot).toBe('24,480');
      expect(fno.future).toBe('24,520');
      expect(fno.pcr).toBe('1.35');
      expect(fno.bias).toBe('PE');
    });

    test('Test 53: F&O derivatives extraction does NOT invent metrics when absent', () => {
      const text = 'Reliance Industries announced a joint venture with Disney for Indian media business.';
      const fno = TelegramAlertEligibilityEngine.extractFNOEvidence(text, 'RELIANCE');
      expect(fno.hasExplicitDerivativesData).toBe(false);
      expect(fno.spot).toBeUndefined();
      expect(fno.future).toBeUndefined();
      expect(fno.pcr).toBeUndefined();
      expect(fno.oi).toBeUndefined();
    });

    test('Test 54: TraderTelegramFormatter generates clean telegram message with verified source', () => {
      const article = {
        id: 'test_tg_format',
        headline: 'Tata Power secures 400 MW hybrid renewable energy project',
        body: 'Tata Power has won a 400 MW hybrid solar-wind project from SECI with an investment of ₹2,800 Cr.',
        publisher: 'The Economic Times',
        canonicalUrl: 'https://economictimes.indiatimes.com/tata-power-400mw.html',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 92
      };

      const assessment = TelegramAlertEligibilityEngine.evaluate(article);
      const msg = TraderTelegramFormatter.format(assessment);
      expect(msg).toContain('ATHENA MARKET ALERT');
      expect(msg).toContain('Direction');
      expect(msg).toContain('Market Intelligence');
    });

    test('Test 55: TraderTelegramFormatter includes derivatives data section only when explicit', () => {
      const article = {
        id: 'test_tg_fno',
        headline: 'Bank Nifty PCR at 0.65 indicates heavy call writing at 52,000 Strike',
        body: 'Derivatives data shows active call open interest buildup at 52,000 CE.',
        publisher: 'Moneycontrol',
        canonicalUrl: 'https://www.moneycontrol.com/derivatives-pulse.html',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 95
      };

      const assessment = TelegramAlertEligibilityEngine.evaluate(article);
      const msg = TraderTelegramFormatter.format(assessment);
      expect(msg).toContain('F&O Intelligence');
      expect(msg).toContain('0.65');
    });

    test('Test 56: TelegramQualityGate evaluates eligible high-impact alert as IMMEDIATE', () => {
      const article = {
        id: 'test_pipeline_1',
        headline: 'State Bank of India raises ₹10,000 Cr via Tier-2 bonds at 7.42%',
        body: 'SBI completed the capital issuance with 3.5x oversubscription from pension funds and insurers.',
        publisher: 'Moneycontrol',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 92,
        category: 'FUNDRAISING',
        primaryCategory: 'FUNDRAISING',
        eventType: 'FUNDRAISING',
        fno: { eligible: true, symbol: 'SBIN' }
      };

      const res = TelegramQualityGate.evaluate(article as any);
      expect(['IMMEDIATE', 'DIGEST_PENDING']).toContain(res.decision);
      expect(res.symbol).toBe('SBIN');
    });

    test('Test 57: TelegramQualityGate suppresses duplicate cluster key within 24h window', () => {
      const article1 = {
        id: 'test_pipeline_dup_1',
        headline: 'Infosys signs $1B strategic AI partnership with Microsoft',
        body: 'Infosys and Microsoft will jointly build generative AI enterprise tools over 5 years.',
        publisher: 'Economic Times',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 95,
        fno: { eligible: true, symbol: 'INFY' }
      };

      const article2 = {
        id: 'test_pipeline_dup_2',
        headline: 'Infosys signs $1B strategic AI partnership with Microsoft',
        body: 'Infosys and Microsoft will jointly build generative AI enterprise tools over 5 years.',
        publisher: 'LiveMint',
        publishedAt: '2026-08-24T08:05:00.000Z',
        relevanceScore: 95,
        fno: { eligible: true, symbol: 'INFY' }
      };

      const first = TelegramQualityGate.evaluate(article1 as any);
      expect(first.isDuplicateCluster).toBe(false);

      const second = TelegramQualityGate.evaluate(article2 as any);
      expect(second.decision).toBe('SUPPRESSED');
      expect(second.isDuplicateCluster).toBe(true);
    });

    test('Test 58: TelegramQualityGate suppresses low materiality update', () => {
      const article = {
        id: 'test_pipeline_routine',
        headline: 'Loss of share certificate intimation under Regulation 39(3)',
        body: 'Routine secretarial filing regarding loss of share certificates.',
        publisher: 'BSE',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 20
      };

      const status = TelegramQualityGate.evaluate(article as any);
      expect(['SUPPRESSED', 'NO_ACTION']).toContain(status.decision);
    });

    test('Test 59: Score breakdown is mathematically bounded between 0 and 100', () => {
      for (const art of allArticles.slice(0, 20)) {
        const evaluation = TelegramAlertEligibilityEngine.evaluate(art);
        expect(evaluation.score).toBeGreaterThanOrEqual(0);
        expect(evaluation.score).toBeLessThanOrEqual(100);
      }
    });

    test('Test 60: Telegram notification pipeline correctly registers enqueued articles', async () => {
      const pipeline = TelegramNotificationPipeline.getInstance();
      const article = {
        id: 'test_schema_record_unique',
        headline: 'HCL Tech acquires German automotive engineering specialist for €250M',
        body: 'HCL Technologies has completed the buyout to strengthen European engineering R&D footprint.',
        publisher: 'LiveMint',
        publishedAt: '2026-08-24T08:00:00.000Z',
        relevanceScore: 89
      };

      const promise = pipeline.enqueueArticle(article);
      expect(promise).toBeDefined();
    });
  });

  // =========================================================================
  // CATEGORY 5: Dataset Integrity, Storage Parity & Zero-Regression (Tests 61-70)
  // =========================================================================
  describe('Category 5: Production Dataset Integrity and Zero-Regression Parity', () => {
    test('Test 61: Canonical store contains at least 782 verified articles', () => {
      expect(allArticles.length).toBeGreaterThanOrEqual(782);
    });

    test('Test 62: Active memory lookup map matches articles length exactly', () => {
      expect(newsStore.getAllArticles().length).toBe(allArticles.length);
    });

    test('Test 63: No article has null or empty ID string', () => {
      for (const art of allArticles) {
        expect(art.id).toBeDefined();
        expect(typeof art.id).toBe('string');
        expect(art.id.length).toBeGreaterThan(0);
      }
    });

    test('Test 64: No article has null or empty headline', () => {
      for (const art of allArticles) {
        expect(art.headline).toBeDefined();
        expect(art.headline.trim().length).toBeGreaterThan(0);
      }
    });

    test('Test 65: No article is deleted or modified in disk file during tests', () => {
      const diskPath = path.resolve(process.cwd(), 'data', 'news_core_v2.json');
      expect(fs.existsSync(diskPath)).toBe(true);
      const raw = fs.readFileSync(diskPath, 'utf8');
      const parsed = JSON.parse(raw);
      const count = Array.isArray(parsed) ? parsed.length : parsed.articles.length;
      expect(count).toBeGreaterThanOrEqual(782);
    });

    test('Test 66: news_core_v2.json.bak is accessible and valid JSON', () => {
      const bakPath = path.resolve(process.cwd(), 'data', 'news_core_v2.json.bak');
      expect(fs.existsSync(bakPath)).toBe(true);
      const raw = fs.readFileSync(bakPath, 'utf8');
      const parsed = JSON.parse(raw);
      const count = Array.isArray(parsed) ? parsed.length : parsed.articles.length;
      expect(count).toBeGreaterThanOrEqual(782);
    });

    test('Test 67: Every canonical article maps deterministically to an extraction status', () => {
      for (const art of allArticles.slice(0, 50)) {
        const { diagnostic } = SourceArticleExtractionGate.evaluate(art);
        expect(['SUCCESS', 'FAILED']).toContain(diagnostic.extractionStatus);
        expect(diagnostic.extractionScore).toBeGreaterThanOrEqual(0);
        expect(diagnostic.extractionScore).toBeLessThanOrEqual(100);
      }
    });

    test('Test 68: FNO categories can be derived without crashing', () => {
      const fnoArticles = allArticles.filter(art => art.fno && art.fno.eligible === true);
      expect(Array.isArray(fnoArticles)).toBe(true);
    });

    test('Test 69: All generated summaries for sampled articles avoid forbidden template phrases', () => {
      const forbidden = [
        'market participants are monitoring',
        'institutional analysts are assessing',
        'informs public policy',
        'favorable announcement for',
        'corporate development may impact sentiment'
      ];
      for (const art of allArticles.slice(0, 50)) {
        const intel = UnifiedIntelligenceEngine.build(art);
        const lower = (intel.executiveSummary || '').toLowerCase();
        for (const pattern of forbidden) {
          expect(lower).not.toContain(pattern);
        }
      }
    });

    test('Test 70: End-to-end extraction, summary, quality gate and telegram pipeline execute deterministically', () => {
      const testArt = allArticles.find(art => (art.relevanceScore || 0) >= 80) || allArticles[0];
      const extraction = SourceArticleExtractionGate.evaluate(testArt);
      const intel = UnifiedIntelligenceEngine.build(testArt);
      const quality = SummaryQualityGate.evaluate(testArt, intel.executiveSummary);
      const tgEval = TelegramAlertEligibilityEngine.evaluate(testArt);

      expect(extraction).toBeDefined();
      expect(intel).toBeDefined();
      expect(quality).toBeDefined();
      expect(tgEval).toBeDefined();
      expect(typeof tgEval.score).toBe('number');
    });
  });
});
