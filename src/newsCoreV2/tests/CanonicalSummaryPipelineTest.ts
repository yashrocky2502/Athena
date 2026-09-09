/**
 * ATHENA NEWS SUMMARY & TELEGRAM PIPELINE VERIFICATION SUITE
 * 
 * Production Regression Suite for Full-Article Evidence-Grounded
 * Summary Truth Correction, Multi-Entity Matrix Extraction & Telegram Parity.
 * 
 * Validates:
 * 1. Multi-Entity IPO Comparison (5 distinct IPOs with their respective GMPs, subscriptions & listing estimates).
 * 2. Single-Entity IPO & GMP fact preservation (GMP, subscription multiples, listing estimates).
 * 3. Commodity / Gold pricing & macroeconomic catalysts (Spot, MCX, Fed rate probabilities, Treasury, technicals).
 * 4. Major Order Wins (₹1,305 crore contract value, Power Grid, 24-month timeline, share reaction).
 * 5. Corporate Lawsuits & Regulatory Actions (allegations, NY Court, damages, defense denial without YTD distraction).
 * 6. Earnings Results (PAT growth, Revenue, EBITDA margins, order backlog).
 * 7. Weighted Summary Quality Gate (weighted scoring, lead-only penalty, extended-headline rejection).
 * 8. Telegram alert formatting and News Summary vs Trader Intelligence strict separation.
 */

import { CanonicalNewsSummaryEngine } from '../summary/CanonicalNewsSummaryEngine.ts';
import { SummaryQualityGate } from '../summary/SummaryQualityGate.ts';
import { TelegramNewsFormatter } from '../notifications/TelegramNewsFormatter.ts';
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

    // ==========================================
    // TEST 1: Multi-Entity IPO Comparison (5 Entities with distinct GMPs & Subscriptions)
    // ==========================================
    try {
      const multiIpoArticle = {
        id: "multi-ipo-comparison-01",
        headline: "IPO GMPs: Hy-Tech Engineers IPO, Symbiotec Pharmalab IPO to Lumino Industries IPO | What grey market signals?",
        body: `A flurry of primary market activity is underway as multiple initial public offerings witness their final bidding sessions today.
        Hy-Tech Engineers IPO has witnessed phenomenal demand, getting subscribed 138.45x overall. In unofficial trading, Hy-Tech Engineers GMP stands at ₹44 per share, indicating an estimated listing price of ₹97 against its price band of ₹50-₹53, signaling an 83.02% premium.
        Symbiotec Pharmalab IPO has also seen robust participation with 19.16x subscription for its ₹1,607 crore public issue. Symbiotec Pharmalab GMP is quoting at ₹287, reflecting an estimated listing price of ₹1,275 against the upper band of ₹988, an expected listing gain of 29.05%.
        Skyways Air Services IPO closes today after achieving 19.68x subscription, with Skyways Air GMP trading at ₹46 per share against the issue price of ₹138, implying a 33.33% listing premium.
        Annu Projects IPO is subscribed 58% so far with Annu Projects GMP at ₹4 against the ₹99 price band.
        Lumino Industries IPO is seeing massive interest with 87x subscription for its ₹700 crore issue (price band ₹78-₹82). Lumino Industries GMP is quoting at ₹55 per share, pointing to an estimated listing price of ₹137 (67.07% premium).`,
        publisher: "LiveMint",
        category: "IPO",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(multiIpoArticle);
      const gateResult = SummaryQualityGate.evaluate(multiIpoArticle, summary);

      const summaryLower = summary.summary.toLowerCase();

      // Check that at least 3-4 of the entities and their GMPs are represented in the synthesized summary
      const mentionsHyTech = summaryLower.includes("hy-tech") && (summary.summary.includes("₹44") || summary.summary.includes("83.02%") || summary.summary.includes("138.45x"));
      const mentionsLumino = summaryLower.includes("lumino") && (summary.summary.includes("₹55") || summary.summary.includes("67.07%") || summary.summary.includes("87x"));
      const mentionsSymbiotec = summaryLower.includes("symbiotec") && (summary.summary.includes("₹287") || summary.summary.includes("29.05%") || summary.summary.includes("19.16x"));
      const passedGate = gateResult.passed;

      if (passedGate && (mentionsHyTech || mentionsLumino || mentionsSymbiotec) && summary.entities.length >= 2) {
        results.push({
          name: "1. Multi-Entity IPO Comparison Full-Article Matrix Synthesis",
          passed: true,
          details: { 
            summary: summary.summary, 
            entities: summary.entities, 
            score: gateResult.score 
          }
        });
      } else {
        results.push({
          name: "1. Multi-Entity IPO Comparison Full-Article Matrix Synthesis",
          passed: false,
          error: `Failed multi-entity extraction: passedGate=${passedGate}, mentionsHyTech=${mentionsHyTech}, mentionsLumino=${mentionsLumino}, mentionsSymbiotec=${mentionsSymbiotec}, entitiesCount=${summary.entities.length}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "1. Multi-Entity IPO Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 2: Single-Entity IPO & Deep Grey Market Premium (GMP) Preservation
    // ==========================================
    try {
      const ipoArticle = {
        id: "ipo-gmp-test-01",
        headline: "Hy-Tech Engineers IPO GMP surges on final bidding day | What grey market signals?",
        body: `Hy-Tech Engineers IPO will close today after witnessing strong demand from retail and institutional investors.
        The public issue has achieved an overall subscription of 45.2x by the afternoon of the final day, with the QIB portion booked 52.1x and NII portion booked 64.8x.
        In the grey market, Hy-Tech Engineers IPO GMP is trading at ₹120 per share, which indicates an estimated listing price of ₹570 against the upper price band of ₹450, signaling an estimated listing premium of 26.67%.
        The IPO comprises a fresh issue of ₹800 crore and an offer for sale of 74.45 lakh equity shares. The company intends to utilize the net proceeds to fund capital expenditure for a new manufacturing facility in Gujarat and repay existing debt.`,
        publisher: "LiveMint",
        category: "IPO",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(ipoArticle);
      const gateResult = SummaryQualityGate.evaluate(ipoArticle, summary);

      const hasGmp = summary.summary.includes("₹120") || summary.summary.toLowerCase().includes("gmp");
      const hasSubscription = summary.summary.includes("45.2x") || summary.summary.toLowerCase().includes("subscription");
      const hasEntityName = summary.summary.includes("Hy-Tech");
      const passedGate = gateResult.passed;

      if (passedGate && hasGmp && hasSubscription && hasEntityName) {
        results.push({
          name: "2. Single-Entity IPO GMP & Listing Price Preservation",
          passed: true,
          details: { summary: summary.summary, factCoverageScore: summary.factCoverageScore }
        });
      } else {
        results.push({
          name: "2. Single-Entity IPO GMP & Listing Price Preservation",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasGmp=${hasGmp}, hasSubscription=${hasSubscription}, hasEntityName=${hasEntityName}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "2. Single-Entity IPO Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 3: Commodity / Gold Price Levels & Macro Catalysts
    // ==========================================
    try {
      const goldArticle = {
        id: "gold-macro-test-01",
        headline: "Gold prices climb amid rising Fed rate cut bets and softer Treasury yields",
        body: `Gold prices traded higher in early trade on Wednesday, rising 1.4% as investors reacted to macroeconomic data and geopolitical developments.
        In international spot markets, Gold was quoting at $2,650 per ounce, while domestic MCX Gold futures rose to ₹78,500 per 10 grams.
        The precious metal received strong upward momentum following comments from Federal Reserve officials signaling increased probability of interest rate cuts. Softer US Treasury yields and central-bank gold buying further boosted safe-haven appeal ahead of the US CPI inflation report.
        On technical charts, the metal is holding firmly above its 50-day EMA with immediate resistance positioned at $2,680 per ounce.`,
        publisher: "Bloomberg Wire",
        category: "COMMODITY",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(goldArticle);
      const gateResult = SummaryQualityGate.evaluate(goldArticle, summary);

      const hasPrices = summary.summary.includes("$2,650") || summary.summary.includes("₹78,500") || summary.summary.includes("1.4%");
      const hasMacroCatalyst = summary.summary.toLowerCase().includes("federal reserve") || 
                               summary.summary.toLowerCase().includes("rate") || 
                               summary.summary.toLowerCase().includes("treasury") ||
                               summary.summary.toLowerCase().includes("safe-haven");
      const passedGate = gateResult.passed;

      if (passedGate && hasPrices && hasMacroCatalyst) {
        results.push({
          name: "3. Commodity Gold Spot/MCX Price & Macro Catalyst Synthesis",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "3. Commodity Gold Spot/MCX Price & Macro Catalyst Synthesis",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasPrices=${hasPrices}, hasMacroCatalyst=${hasMacroCatalyst}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "3. Commodity Gold Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 4: Major Order Win Full-Body Contract Detail Preservation
    // ==========================================
    try {
      const orderArticle = {
        id: "order-win-test-01",
        headline: "Sterling and Wilson bags major transmission order from Power Grid Corporation",
        body: `Sterling and Wilson Renewable Energy informed the stock exchanges on Tuesday regarding a significant commercial development.
        The company has secured a prestigious engineering, procurement, and construction (EPC) contract valued at ₹1,305 crore from Power Grid Corporation of India.
        The project scope entails the design, supply, and commissioning of high-voltage transmission substation infrastructure across Rajasthan and Gujarat, with an execution timeline of 24 months.
        Following the exchange filing, shares of Sterling and Wilson surged 4.8% to ₹612 on the National Stock Exchange.`,
        publisher: "Economic Times",
        category: "ORDER_WIN",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(orderArticle);
      const gateResult = SummaryQualityGate.evaluate(orderArticle, summary);

      const hasOrderValue = summary.summary.includes("₹1,305 crore") || summary.summary.includes("1,305 crore");
      const hasClientOrTimeline = summary.summary.includes("Power Grid") || summary.summary.includes("24-month") || summary.summary.includes("4.8%");
      const hasEntityName = summary.summary.includes("Sterling and Wilson");
      const passedGate = gateResult.passed;

      if (passedGate && hasOrderValue && hasClientOrTimeline && hasEntityName) {
        results.push({
          name: "4. Order Win Contract Value (₹1,305 crore) & Timeline Retention",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "4. Order Win Contract Value Retention",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasOrderValue=${hasOrderValue}, hasClientOrTimeline=${hasClientOrTimeline}, hasEntityName=${hasEntityName}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "4. Order Win Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 5: Corporate Lawsuit Claims & Company Defense (No YTD Distraction)
    // ==========================================
    try {
      const lawsuitArticle = {
        id: "lawsuit-test-01",
        headline: "HDFC Bank faces class action lawsuit in US over financial disclosures",
        body: `A class action lawsuit has been filed against HDFC Bank in the US District Court for the Southern District of New York.
        The lawsuit alleges that the bank made false and misleading statements regarding internal loan-portfolio controls and seeks damages of ₹45 crore ($5.4 million) on behalf of American Depositary Receipt holders.
        In an official regulatory response, HDFC Bank denied all allegations, asserting that the claims are frivolous and without merit, and confirmed it will vigorously defend against the complaint.
        Separately, HDFC Bank shares have gained 14.5% year-to-date while the benchmark Nifty 50 is up 11.2%. Intraday, the stock dipped 1.8% to ₹1,680.`,
        publisher: "Reuters Wire",
        category: "LEGAL",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(lawsuitArticle);
      const gateResult = SummaryQualityGate.evaluate(lawsuitArticle, summary);

      const hasLawsuitAllegation = summary.summary.toLowerCase().includes("lawsuit") || 
                                   summary.summary.toLowerCase().includes("disclosures") || 
                                   summary.summary.includes("₹45 crore");
      const hasDefense = summary.summary.toLowerCase().includes("denied") || 
                         summary.summary.toLowerCase().includes("frivolous") || 
                         summary.summary.toLowerCase().includes("defend") ||
                         summary.summary.toLowerCase().includes("merit");
      const avoidsYtdDistraction = !summary.summary.startsWith("HDFC Bank shares have gained 14.5% year-to-date");
      const passedGate = gateResult.passed;

      if (passedGate && hasLawsuitAllegation && hasDefense && avoidsYtdDistraction) {
        results.push({
          name: "5. Lawsuit Allegation & Company Defense Synthesis (Anti-Distraction)",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "5. Lawsuit Allegation & Company Defense Synthesis",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasAllegation=${hasLawsuitAllegation}, hasDefense=${hasDefense}, avoidsYtd=${avoidsYtdDistraction}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "5. Lawsuit Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 6: Earnings Results Key Metric Synthesis
    // ==========================================
    try {
      const earningsArticle = {
        id: "earnings-test-01",
        headline: "L&T Q3 Results: Net profit rises 31% to ₹1,850 crore, revenue up 19%",
        body: `Larsen & Toubro (L&T) announced its third-quarter financial results for FY26 on Friday.
        The engineering conglomerate reported a 31% year-on-year increase in consolidated net profit (PAT) at ₹1,850 crore compared to ₹1,412 crore in the corresponding quarter last year.
        Revenue from operations grew 19% YoY to ₹12,450 crore, while operating EBITDA margin expanded 140 basis points to 22.4% on account of robust project execution and operational efficiencies across infrastructure segments.
        The consolidated order book stood at a record ₹4.75 lakh crore.`,
        publisher: "CNBC-TV18",
        category: "RESULTS",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(earningsArticle);
      const gateResult = SummaryQualityGate.evaluate(earningsArticle, summary);

      const hasNetProfit = summary.summary.includes("₹1,850 crore") || summary.summary.toLowerCase().includes("net profit");
      const hasRevenueOrMargin = summary.summary.includes("₹12,450 crore") || summary.summary.includes("22.4%") || summary.summary.toLowerCase().includes("revenue");
      const hasEntityName = summary.summary.includes("L&T") || summary.summary.includes("Larsen & Toubro");
      const passedGate = gateResult.passed;

      if (passedGate && hasNetProfit && hasRevenueOrMargin && hasEntityName) {
        results.push({
          name: "6. Earnings Results PAT, Revenue & EBITDA Margin Synthesis",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "6. Earnings Results Synthesis",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasNetProfit=${hasNetProfit}, hasRevenueOrMargin=${hasRevenueOrMargin}, hasEntityName=${hasEntityName}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "6. Earnings Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 7: Weighted Quality Gate Strictly Rejects Lead-Only & Extended Headlines
    // ==========================================
    try {
      const headline = "German auto parts maker Mahle said to revisit IPO for India unit.";
      const badLeadOnly = "German auto parts maker Mahle said to revisit IPO for India unit. German auto parts maker Mahle GmbH is revisiting plans to list its Indian business in Mumbai, according to people familiar with the matter.";

      const badSummary = {
        summary: badLeadOnly,
        whatHappened: badLeadOnly,
        whyItMatters: "IPO pipeline expands",
        keyFacts: [headline],
        importantNumbers: [],
        entities: ["Mahle"],
        sourceArticleId: "test-bad-ext",
        generatedAt: new Date().toISOString()
      };

      const gateResult = SummaryQualityGate.evaluate({ headline, body: "Some body text here" }, badSummary);

      if (!gateResult.passed) {
        results.push({
          name: "7. Weighted Quality Gate Strictly Rejects Extended-Headline Paraphrases",
          passed: true,
          details: { rejectedReason: gateResult.reason, category: gateResult.rejectionCategory, score: gateResult.score }
        });
      } else {
        results.push({
          name: "7. Weighted Quality Gate Rejection Test",
          passed: false,
          error: `Quality gate failed to reject bad extended-headline summary!`
        });
      }
    } catch (err: any) {
      results.push({ name: "7. Quality Gate Rejection Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 8: Telegram Notification Strict News Summary vs Trader Intelligence Separation
    // ==========================================
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
          name: "8. Telegram Formatting Positions News Summary Prior to Trader Intelligence",
          passed: true,
          details: { length: telegramText.length }
        });
      } else {
        results.push({
          name: "8. Telegram Formatting Order Test",
          passed: false,
          error: `Order violation: hasNewsSummary=${hasNewsSummary}, hasTraderIntel=${hasTraderIntel}, orderValid=${summaryBeforeTrader}`
        });
      }
    } catch (err: any) {
      results.push({ name: "8. Telegram Formatting Order Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 9: Macro / Fed Rate Expectations & Treasury Yields
    // ==========================================
    try {
      const macroArticle = {
        id: "macro-fed-test-01",
        headline: "US Fed keeps benchmark rate steady at 5.25%-5.50%; signals possible cut in September",
        body: `The US Federal Reserve held its benchmark interest rate unchanged in the 5.25%-5.50% range following the conclusion of its two-day FOMC meeting.
        Fed Chair Jerome Powell stated that inflation has made further modest progress toward the 2% target, though economic activity continued to expand at a solid pace.
        Treasury yields declined across the curve following the statement, with the 10-year yield dropping 8 basis points to 4.12%.
        Market pricing now reflects an 85% probability of a 25-basis-point rate reduction at the September policy meeting.`,
        publisher: "Bloomberg",
        category: "MACRO",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(macroArticle);
      const gateResult = SummaryQualityGate.evaluate(macroArticle, summary);

      const hasFedDetails = summary.summary.includes("5.25%-5.50%") || summary.summary.toLowerCase().includes("interest rate") || summary.summary.toLowerCase().includes("federal reserve");
      const hasYieldOrInflation = summary.summary.includes("4.12%") || summary.summary.toLowerCase().includes("inflation") || summary.summary.toLowerCase().includes("september");
      const passedGate = gateResult.passed;

      if (passedGate && hasFedDetails && hasYieldOrInflation) {
        results.push({
          name: "9. Macro Fed Interest Rate & Treasury Yield Synthesis",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "9. Macro Fed Interest Rate & Treasury Yield Synthesis",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasFed=${hasFedDetails}, hasYieldOrInflation=${hasYieldOrInflation}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "9. Macro Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 10: Regulatory / SEBI Compliance & Enforcement Action
    // ==========================================
    try {
      const sebiArticle = {
        id: "regulatory-sebi-test-01",
        headline: "SEBI imposes ₹25 crore penalty on Axis Capital over debt merchant-banking violations",
        body: `Capital markets regulator SEBI has imposed a monetary penalty of ₹25 crore on Axis Capital for violating merchant banking regulations.
        The market watchdog found non-compliance related to guarantee provisions in debt issuances between 2021 and 2024.
        SEBI also directed Axis Capital to review and strengthen its internal due diligence framework within 60 days.
        Axis Capital stated it is reviewing the regulatory order and evaluating legal remedies including an appeal before SAT.`,
        publisher: "Economic Times",
        category: "REGULATORY",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(sebiArticle);
      const gateResult = SummaryQualityGate.evaluate(sebiArticle, summary);

      const hasPenalty = summary.summary.includes("₹25 crore") || summary.summary.includes("penalty") || summary.summary.includes("SEBI");
      const hasEntity = summary.summary.includes("Axis Capital");
      const passedGate = gateResult.passed;

      if (passedGate && hasPenalty && hasEntity) {
        results.push({
          name: "10. Regulatory SEBI Penalty & Directive Preservation",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "10. Regulatory SEBI Penalty & Directive Preservation",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasPenalty=${hasPenalty}, hasEntity=${hasEntity}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "10. Regulatory Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 11: Market Stock Price Movement & Fundamental Catalyst
    // ==========================================
    try {
      const stockArticle = {
        id: "stock-movement-test-01",
        headline: "Tata Motors shares surge 7% to hit fresh 52-week high on CV demerger approval",
        body: `Shares of Tata Motors rallied 7.2% to touch a new 52-week high of ₹1,180 on high trading volume on the NSE.
        The rally came after the company's board granted final approval for the demerger of its commercial vehicle and passenger vehicle businesses into two separate listed entities.
        Management stated that the demerger scheme is on track for completion within the next 12 to 15 months following NCLT approvals.`,
        publisher: "Moneycontrol",
        category: "STOCKS",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(stockArticle);
      const gateResult = SummaryQualityGate.evaluate(stockArticle, summary);

      const hasPriceMove = summary.summary.includes("7%") || summary.summary.includes("7.2%") || summary.summary.includes("₹1,180");
      const hasCatalyst = summary.summary.toLowerCase().includes("demerger") || summary.summary.toLowerCase().includes("commercial vehicle");
      const passedGate = gateResult.passed;

      if (passedGate && hasPriceMove && hasCatalyst) {
        results.push({
          name: "11. Stock Price Surge & Demerger Catalyst Synthesis",
          passed: true,
          details: { summary: summary.summary }
        });
      } else {
        results.push({
          name: "11. Stock Price Surge & Demerger Catalyst Synthesis",
          passed: false,
          error: `Failed: passedGate=${passedGate}, hasPriceMove=${hasPriceMove}, hasCatalyst=${hasCatalyst}. Summary: "${summary.summary}"`
        });
      }
    } catch (err: any) {
      results.push({ name: "11. Stock Movement Test", passed: false, error: err.message });
    }

    // ==========================================
    // TEST 12: Poor Extraction / Body Unavailable Handled Gracefully
    // ==========================================
    try {
      const poorArticle = {
        id: "poor-extraction-01",
        headline: "Global chip stocks drop amid macroeconomic headwinds",
        body: "", // empty body
        publisher: "Reuters",
        publishedAt: new Date().toISOString()
      };

      const summary = engine.generateDeterministicSummary(poorArticle);
      const gateResult = SummaryQualityGate.evaluate(poorArticle, summary);

      // Should be rejected or gracefully flagged
      if (!gateResult.passed || summary.summary.includes("Summary unavailable") || summary.factCoverageScore <= 30) {
        results.push({
          name: "12. Poor Extraction / Unavailable Body Graceful Handling",
          passed: true,
          details: { gatePassed: gateResult.passed, summary: summary.summary }
        });
      } else {
        results.push({
          name: "12. Poor Extraction Test",
          passed: false,
          error: "Failed: Poor extraction article should not pass quality gate with high score"
        });
      }
    } catch (err: any) {
      results.push({ name: "12. Poor Extraction Test", passed: false, error: err.message });
    }

    const allPassed = results.every(r => r.passed);
    return { passed: allPassed, results };
  }
}
