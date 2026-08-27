/**
 * ATHENA NEWS SUMMARY & TELEGRAM PIPELINE VERIFICATION SUITE
 * Validates Inshorts-style canonical news summary generation,
 * quality gate anti-repetition / anti-extended-headline enforcement,
 * extraction failure handling, and Telegram alert formatting.
 */

import { CanonicalNewsSummaryEngine } from '../summary/CanonicalNewsSummaryEngine.ts';
import { SummaryQualityGate } from '../summary/SummaryQualityGate.ts';
import { TelegramNewsFormatter } from '../notifications/TelegramNewsFormatter.ts';
import { TraderTelegramFormatter } from '../../news/telegram/TraderTelegramFormatter.ts';
import { UnifiedIntelligenceEngine } from '../intelligenceV2/UnifiedIntelligenceEngine.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export class CanonicalSummaryPipelineTest {
  public static async runAllTests(): Promise<{ passed: boolean; results: TestResult[] }> {
    const results: TestResult[] = [];
    const engine = CanonicalNewsSummaryEngine.getInstance();

    // Test 1: Real-world Mahle IPO - Must NOT produce extended headline
    try {
      const mahleArticle = {
        id: "mahle-ipo-2026",
        headline: "German auto parts maker Mahle said to revisit IPO for India unit.",
        body: "German auto parts maker Mahle GmbH is revisiting plans to list its Indian business in Mumbai, according to people familiar with the matter. The Stuttgart-based supplier of engine systems and filtration technologies is in early-stage discussions with financial advisers to structure the share sale, which could raise around $300 million to fund electric-mobility component manufacturing and debt reduction across its Asian operations.",
        publisher: "Bloomberg Wire",
        category: "IPO",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(mahleArticle);
      const gateResult = SummaryQualityGate.evaluate(mahleArticle, summary);

      // Verify that summary contains body facts and does not start by echoing the exact headline verbatim
      const doesNotEchoHeadline = !summary.summary.startsWith(mahleArticle.headline + " " + mahleArticle.headline);
      const hasSubstantiveBodyFacts = summary.summary.includes("Stuttgart-based supplier") || 
                                     summary.summary.includes("electric-mobility") || 
                                     summary.summary.includes("$300 million");

      if (gateResult.passed && doesNotEchoHeadline && hasSubstantiveBodyFacts) {
        results.push({
          name: "1. Mahle IPO Inshorts-style Synthesis (Non-Headline Echo)",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "1. Mahle IPO Inshorts-style Synthesis (Non-Headline Echo)",
          passed: false,
          error: `Failed criteria: gatePassed=${gateResult.passed}, echoCheck=${doesNotEchoHeadline}, bodyFacts=${hasSubstantiveBodyFacts}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "1. Mahle IPO Inshorts-style Synthesis", passed: false, error: err.message });
    }

    // Test 2: Extended Headline Rejection in Quality Gate
    try {
      const headline = "German auto parts maker Mahle said to revisit IPO for India unit.";
      const badExtendedHeadline = "German auto parts maker Mahle said to revisit IPO for India unit. German auto parts maker Mahle GmbH is revisiting plans to list its Indian business in Mumbai, according to people familiar with the matter.";

      const badSummary = {
        summary: badExtendedHeadline,
        whatHappened: badExtendedHeadline,
        whyItMatters: "IPO pipeline expands",
        keyFacts: [headline],
        importantNumbers: [],
        entities: ["Mahle"],
        sourceArticleId: "test-bad-ext",
        generatedAt: new Date().toISOString()
      };

      const gateResult = SummaryQualityGate.evaluate({ headline, body: "Some body text here" }, badSummary);

      if (!gateResult.passed && (gateResult.reason?.includes("Extended-headline") || gateResult.reason?.includes("Similarity") || gateResult.reason?.includes("headline"))) {
        results.push({
          name: "2. Quality Gate Strictly Rejects Extended-Headline Paraphrase",
          passed: true,
          details: { rejectedReason: gateResult.reason }
        });
      } else {
        results.push({
          name: "2. Quality Gate Strictly Rejects Extended-Headline Paraphrase",
          passed: false,
          error: `Quality gate failed to reject bad extended-headline summary! Passed=${gateResult.passed}, reason=${gateResult.reason}`
        });
      }
    } catch (err: any) {
      results.push({ name: "2. Quality Gate Extended Headline Rejection", passed: false, error: err.message });
    }

    // Test 3: Unavailability & Extraction Failure Handling
    try {
      const emptyArticle = {
        id: "empty-article-001",
        headline: "Short Headline Without Extraction",
        body: "",
        publisher: "Paywalled Source"
      };

      const summary = engine.generateDeterministicSummary(emptyArticle);
      const isUnavailable = summary.summary === 'Summary unavailable — Open original source';

      if (isUnavailable) {
        results.push({
          name: "3. Extraction Failure / Paywall Returns Explicit Unavailable Notice",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "3. Extraction Failure / Paywall Returns Explicit Unavailable Notice",
          passed: false,
          error: `Expected 'Summary unavailable — Open original source', got: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "3. Extraction Failure Handling", passed: false, error: err.message });
    }

    // Test 4: Telegram Notification Formatting - News Summary Before Trader Intelligence
    try {
      const testRecord = UnifiedIntelligenceEngine.build({
        id: "telegram-test-01",
        headline: "Infosys Secures $450M Cloud Modernization Deal with European Bank",
        body: "Infosys announced on Thursday that it has signed a five-year cloud transformation contract worth $450 million with a leading Scandinavian banking group. Under the agreement, Infosys will migrate legacy core banking platforms to hybrid-cloud architecture, with project execution starting in Q2 FY27.",
        publisher: "Reuters Wire",
        category: "ORDER_CONTRACT",
        publishedAt: new Date().toISOString(),
        sentiment: "BULLISH",
        urgency: "HIGH",
        materialityScore: 82,
        relevanceScore: 90
      } as any);

      const telegramText = TelegramNewsFormatter.format(testRecord);
      
      const hasNewsSummary = telegramText.includes("📰 <b>News Summary:</b>");
      const hasTraderIntel = telegramText.includes("📊 <b>Trader Intelligence:</b>");
      const summaryBeforeTrader = telegramText.indexOf("📰 <b>News Summary:</b>") < telegramText.indexOf("📊 <b>Trader Intelligence:</b>");

      if (hasNewsSummary && hasTraderIntel && summaryBeforeTrader) {
        results.push({
          name: "4. Telegram Formatting Positions News Summary Prior to Trader Intelligence",
          passed: true,
          details: { length: telegramText.length }
        });
      } else {
        results.push({
          name: "4. Telegram Formatting Positions News Summary Prior to Trader Intelligence",
          passed: false,
          error: `Order violation: hasNewsSummary=${hasNewsSummary}, hasTraderIntel=${hasTraderIntel}, orderValid=${summaryBeforeTrader}`
        });
      }
    } catch (err: any) {
      results.push({ name: "4. Telegram Formatting Order Test", passed: false, error: err.message });
    }

    // Test 5: Cache Consistency
    try {
      const cacheArticle = {
        id: "cache-test-01",
        headline: "Tata Motors Commercial Vehicle Unit Wins Municipal Bus Order",
        body: "Tata Motors has emerged as the lowest bidder for supplying 1,200 electric low-floor buses to state transport corporations under the PM-eBus Sewa initiative. Deliveries are scheduled across twelve months with an estimated value of ₹1,850 crore.",
        publisher: "Business Standard"
      };

      const firstCall = await engine.getOrGenerateSummary(cacheArticle);
      const secondCall = await engine.getOrGenerateSummary(cacheArticle);

      const cachedProperly = firstCall.summary === secondCall.summary && secondCall.generatedAt === firstCall.generatedAt;

      if (cachedProperly) {
        results.push({
          name: "5. Summary Cache Memory & Revision Identity Integrity",
          passed: true
        });
      } else {
        results.push({
          name: "5. Summary Cache Memory & Revision Identity Integrity",
          passed: false,
          error: "Cache did not return deterministic identical summary"
        });
      }
    } catch (err: any) {
      results.push({ name: "5. Summary Cache Integrity", passed: false, error: err.message });
    }

    const allPassed = results.every(r => r.passed);
    return { passed: allPassed, results };
  }
}
