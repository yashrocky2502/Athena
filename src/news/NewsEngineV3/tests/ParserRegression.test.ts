/**
 * ATHENA NEWS ENGINE V3 — PARSER REGRESSION TEST SUITE
 *
 * Runs 2000 real-world simulated financial articles across all 20 specialized parser categories.
 * Validates deterministic routing, extraction accuracy, telemetry tracking, and latency performance.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ParserRegistry } from '../parsers/ParserRegistry';
import { ParserTelemetryRepository } from '../parsers/ParserTelemetryRepository';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult, ClassificationCategory } from '../classification/types/ClassificationTypes';

interface ParserTestCaseSpec {
  title: string;
  body: string;
  primaryCategory: ClassificationCategory;
  parserName: string;
  ticker: string;
  companyName: string;
}

describe('ParserEngine Regression Suite (2000 Scenarios)', () => {
  let registry: ParserRegistry;
  let telemetry: ParserTelemetryRepository;

  beforeAll(() => {
    registry = ParserRegistry.getInstance();
    telemetry = ParserTelemetryRepository.getInstance();
  });

  beforeEach(() => {
    telemetry.clear();
  });

  it('should parse 2000 financial news scenarios across all categories with high performance & accuracy', async () => {
    const testCases: ParserTestCaseSpec[] = [];

    const templates = [
      {
        parserName: 'QuarterlyResultsParser',
        category: 'QUARTERLY_RESULTS' as ClassificationCategory,
        title: '{company} Q1 FY27 Net Profit rises 25% to Rs {amount} crore',
        body: 'Mumbai: {company} ({ticker}) today reported its Q1 earnings. Revenue stood at Rs {amount} crore and net profit surged to Rs {pat} crore vs Rs {prev} crore YoY.'
      },
      {
        parserName: 'BrokerReportParser',
        category: 'BROKER_REPORT' as ClassificationCategory,
        title: 'Jefferies reiterates Buy rating on {company}, raises target to Rs {amount}',
        body: 'Brokerage firm Jefferies issued an updated research note on {company} ({ticker}) setting a new price target of Rs {amount} with upside of 25% percent.'
      },
      {
        parserName: 'CorporateActionParser',
        category: 'CORPORATE_ACTION' as ClassificationCategory,
        title: '{company} Board schedules meeting on corporate restructuring',
        body: '{company} ({ticker}) today informed stock exchanges that a Board meeting is scheduled to consider critical mergers and corporate action.'
      },
      {
        parserName: 'DividendParser',
        category: 'DIVIDEND' as ClassificationCategory,
        title: '{company} declares special dividend of Rs {amount} per share',
        body: 'The Board of Directors of {company} ({ticker}) recommended an interim dividend of Rs {amount} per equity share. Record Date is Aug 25, 2026.'
      },
      {
        parserName: 'BuybackParser',
        category: 'BUYBACK' as ClassificationCategory,
        title: '{company} Board approves Rs {amount} crore share buyback offer',
        body: '{company} ({ticker}) approved buyback of shares totaling Rs {amount} crore at a premium buyback price of Rs 450 per share.'
      },
      {
        parserName: 'BonusSplitParser',
        category: 'BONUS' as ClassificationCategory,
        title: '{company} Board announces 1:1 bonus share issue',
        body: 'The Board of {company} ({ticker}) approved 1:1 bonus shares. It also recommended a stock split in 1:10 ratio.'
      },
      {
        parserName: 'ManagementChangeParser',
        category: 'MANAGEMENT_CHANGE' as ClassificationCategory,
        title: '{company} appoints Rajesh Kumar as MD and CEO',
        body: '{company} ({ticker}) today announced that its Board approved the appointment of Rajesh Kumar as new CEO effective date is Sept 1, 2026.'
      },
      {
        parserName: 'OrderWinParser',
        category: 'ORDER_WIN' as ClassificationCategory,
        title: '{company} bags major domestic order worth Rs {amount} crore',
        body: 'Engineering firm {company} ({ticker}) has received a letter of intent for a contract valued at Rs {amount} crore from Ministry of Railways.'
      },
      {
        parserName: 'MergersAcquisitionParser',
        category: 'ACQUISITION' as ClassificationCategory,
        title: '{company} completes acquisition of strategic stake for Rs {amount} crore',
        body: '{company} ({ticker}) completed the acquisition of 51% stake in target firm for Rs {amount} crore.'
      },
      {
        parserName: 'IPOParser',
        category: 'IPO' as ClassificationCategory,
        title: '{company} IPO fixed with price band of Rs {amount} to Rs 320',
        body: '{company} ({ticker}) set its public issue price band of Rs {amount} per share. Total size is expected at Rs {pat} crore.'
      },
      {
        parserName: 'BlockDealParser',
        category: 'BLOCK_DEAL' as ClassificationCategory,
        title: 'Block Deal: {company} shares worth Rs {amount} crore traded on NSE',
        body: 'Exchange block deal window witnessed transactions in {company} ({ticker}) involving shares worth Rs {amount} crore at average price Rs 850.'
      },
      {
        parserName: 'BulkDealParser',
        category: 'BULK_DEAL' as ClassificationCategory,
        title: 'Bulk Deal: Foreign fund buys stake in {company} for Rs {amount} crore',
        body: 'Bulk deal transaction data on NSE showed global fund bought shares of {company} ({ticker}) worth Rs {amount} crore.'
      },
      {
        parserName: 'FundRaiseParser',
        category: 'QIP' as ClassificationCategory,
        title: '{company} plans qualified institutional placement to raise Rs {amount} crore',
        body: 'Board approved raising capital of Rs {amount} crore via qualified institutional placement or QIP.'
      },
      {
        parserName: 'RBIParser',
        category: 'RBI_POLICY' as ClassificationCategory,
        title: 'RBI Monetary Policy: Repo rate kept unchanged at 6.5%',
        body: 'The Reserve Bank of India kept repo rate at 6.50% percent and maintained neutral stance during the policy meeting.'
      },
      {
        parserName: 'SEBIParser',
        category: 'SEBI_ACTION' as ClassificationCategory,
        title: 'SEBI imposes Rs {amount} lakh penalty on {company}',
        body: 'Regulator SEBI passed final order imposing penalty of Rs {amount} lakh on {company} ({ticker}) for disclosure non-compliance.'
      },
      {
        parserName: 'MacroParser',
        category: 'MACRO' as ClassificationCategory,
        title: 'India retail CPI inflation falls to 4.2% in June',
        body: 'Retail cpi inflation in June dropped to 4.2% percent while industrial manufacturing pmi was reported at 58.5 index.'
      },
      {
        parserName: 'CommodityParser',
        category: 'COMMODITY' as ClassificationCategory,
        title: 'Gold price surges to Rs 72,000 per 10 grams',
        body: 'Precious metals gold price traded at 2300 USD per ounce while Brent crude oil stood at 82 USD per barrel.'
      },
      {
        parserName: 'ForexParser',
        category: 'FOREX' as ClassificationCategory,
        title: 'Indian Rupee closed flat at 83.45 vs US Dollar',
        body: 'In interbank currency market, the Indian Rupee was quoted traded at 83.45 INR against the greenback.'
      },
      {
        parserName: 'GeneralParser',
        category: 'GENERAL_MARKET' as ClassificationCategory,
        title: '{company} expands operational manufacturing capacity',
        body: '{company} ({ticker}) announced addition of manufacturing assembly lines at its industrial plant.'
      }
    ];

    const companyPool = [
      { name: 'Reliance Industries Limited', ticker: 'RELIANCE' },
      { name: 'HDFC Bank Limited', ticker: 'HDFCBANK' },
      { name: 'Infosys Limited', ticker: 'INFY' },
      { name: 'Tata Motors Limited', ticker: 'TATAMOTORS' },
      { name: 'State Bank of India', ticker: 'SBIN' }
    ];

    // Generate 2000 test cases dynamically (approx 105 per template category)
    let idx = 0;
    while (testCases.length < 2000) {
      const template = templates[idx % templates.length];
      const comp = companyPool[idx % companyPool.length];
      const amount = 100 + (idx * 5);
      const pat = Math.round(amount * 0.15);
      const prev = Math.round(pat * 0.8);

      const title = template.title
        .replace(/{company}/g, comp.name)
        .replace(/{ticker}/g, comp.ticker)
        .replace(/{amount}/g, amount.toString());

      const body = template.body
        .replace(/{company}/g, comp.name)
        .replace(/{ticker}/g, comp.ticker)
        .replace(/{amount}/g, amount.toString())
        .replace(/{pat}/g, pat.toString())
        .replace(/{prev}/g, prev.toString());

      testCases.push({
        title,
        body,
        primaryCategory: template.category,
        parserName: template.parserName,
        ticker: comp.ticker,
        companyName: comp.name
      });

      idx++;
    }

    expect(testCases.length).toBe(2000);

    let totalLatencyMs = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];

      // Build mock NormalizedDocument
      const doc: NormalizedDocument = {
        documentId: `DOC_PARSER_REG_${i}`,
        publisherId: 'ECONOMIC_TIMES',
        publisherName: 'Economic Times',
        canonicalUrl: `https://economictimes.com/art_${i}`,
        sourceUrl: `https://economictimes.com/art_${i}`,
        title: tc.title,
        plainText: tc.body,
        paragraphs: [{ id: `p_${i}`, index: 0, text: tc.body, wordCount: tc.body.split(' ').length, charCount: tc.body.length, hash: `h_p_${i}` }],
        sentences: [
          {
            id: `s_${i}_title`,
            paragraphIndex: -1,
            indexInParagraph: 0,
            globalIndex: 0,
            text: tc.title,
            protectedTokens: [],
            hash: `h_s_${i}_title`
          },
          ...tc.body.split('.').filter(Boolean).map((s, sIdx) => ({
            id: `s_${i}_${sIdx}`,
            paragraphIndex: 0,
            indexInParagraph: sIdx,
            globalIndex: sIdx + 1,
            text: s.trim(),
            protectedTokens: [],
            hash: `h_s_${i}_${sIdx}`
          }))
        ],
        language: 'EN',
        companies: [{
          name: tc.companyName,
          ticker: tc.ticker,
          exchange: 'NSE',
          sector: 'GENERAL',
          industry: 'GENERAL',
          marketCapBucket: 'LARGE_CAP',
          confidence: 100,
          isPrimary: true
        } as any],
        currencies: [],
        wordCount: tc.body.split(' ').length,
        characterCount: tc.body.length,
        processingTimeMs: 0.1,
        normalizedAt: new Date().toISOString(),
        metadata: {
          publisher: 'Economic Times',
          publisherId: 'ECONOMIC_TIMES' as any,
          title: tc.title,
          publishedAt: new Date().toISOString(),
          displayDate: new Date().toISOString(),
          tags: [],
          sourceUrl: `https://economictimes.com/art_${i}`,
          canonicalUrl: `https://economictimes.com/art_${i}`,
          language: 'EN'
        },
        hashes: {
          rawHash: `h_raw_${i}`,
          normalizedHash: `h_norm_${i}`,
          paragraphHashes: [`h_p_${i}`],
          sentenceHashes: tc.body.split('.').filter(Boolean).map((_, sIdx) => `h_s_${i}_${sIdx}`)
        }
      };

      // Build mock ClassificationResult matching the mapped targetParser
      const classification: ClassificationResult = {
        documentId: doc.documentId,
        title: doc.title,
        primaryCategory: tc.primaryCategory,
        allCategories: [tc.primaryCategory],
        categoryMatches: [],
        resolvedCompany: doc.companies[0] as any,
        resolvedCompanies: doc.companies as any[],
        urgencyScore: 80,
        impactScore: 'HIGH',
        classificationConfidence: 100,
        targetParser: {
          parserName: tc.parserName === 'BrokerReportParser' ? 'BrokerParser' : tc.parserName as any,
          priority: 10,
          handlerName: tc.parserName
        },
        isRejected: false,
        conflictsDetected: [],
        processingTimeMs: 1,
        timestamp: new Date().toISOString()
      };

      const start = performance.now();
      const result = await registry.parseDocument(doc, classification);
      const elapsed = performance.now() - start;
      totalLatencyMs += elapsed;

      // Verify basic expectations of returned structured extraction
      expect(result.articleId).toBe(doc.documentId);
      expect(result.parserType).toBe(tc.parserName);
      expect(result.company).toBe(tc.companyName);
      expect(result.ticker).toBe(tc.ticker);
      expect(result.confidence).toBeGreaterThanOrEqual(40);
    }

    const stats = telemetry.getStats();
    const averageTime = totalLatencyMs / testCases.length;

    console.log(`Parser Engine Regression Testing complete:`);
    console.log(`- Simulated articles: ${testCases.length}`);
    console.log(`- Average parsing latency: ${averageTime.toFixed(3)} ms/article (Target < 5ms)`);
    console.log(`- Parser Health: ${stats.parserHealth}%`);
    console.log(`- Extraction Accuracy: ${stats.extractionAccuracy}%`);
    console.log(`- Metrics Extracted: ${stats.metricsExtracted}`);
    console.log(`- Missing Metrics tracked: ${stats.missingMetrics}`);
    console.log(`- Top Missing Fields:`, stats.topMissingFields);
    console.log(`- Top Parsing Warnings/Errors:`, stats.topParsingErrors);

    expect(stats.parserHealth).toBe(100); // 100% of parsers executed successfully without error
    expect(stats.extractionAccuracy).toBeGreaterThanOrEqual(35);
    expect(averageTime).toBeLessThan(5); // Pure memory-deterministic parsers must be blazing fast
  });
});
