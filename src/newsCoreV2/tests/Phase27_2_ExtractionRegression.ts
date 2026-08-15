import { SemanticFactExtractor } from "../intelligence/SemanticFactExtractor";
import { UnifiedIntelligenceEngine } from "../intelligenceV2/UnifiedIntelligenceEngine";
import { IntelligenceMetricResolver } from "../intelligenceV2/IntelligenceMetricResolver";
import { IntelligenceValidator } from "../intelligenceV2/IntelligenceValidator";
import { TraderTelegramFormatter } from "../../news/NewsEngine/TraderTelegramFormatter";
import { NewsArticleV2 } from "../domain/NewsArticle";
import fs from "fs";
import path from "path";

export interface Phase27TestResult {
  testId: string;
  name: string;
  category: "RESULTS" | "CREDIT_RATING" | "IPO" | "CORPORATE" | "MACRO" | "ADVERSARIAL";
  passed: boolean;
  expected: Record<string, any>;
  actual: Record<string, any>;
  errorDetails?: string;
}

export interface Phase27AuditReport {
  timestamp: string;
  version: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  successRate: string;
  allPassed: boolean;
  testResults: Phase27TestResult[];
}

export class Phase27_2_ExtractionRegression {
  public static run(): Phase27AuditReport {
    const testResults: Phase27TestResult[] = [];

    // Load dataset
    const dataPath = path.join(process.cwd(), "data", "news_core_v2.json");
    let articles: NewsArticleV2[] = [];
    if (fs.existsSync(dataPath)) {
      try {
        articles = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      } catch (e) {}
    }

    // ------------------------------------------------------------------------
    // SCENARIO 1: Ashok Leyland (PAT vs Revenue vs Sales Volume)
    // ------------------------------------------------------------------------
    const ashok = articles.find(a => a.id === "v2_2db3cabdda727292");
    if (ashok) {
      const intel = UnifiedIntelligenceEngine.build(ashok);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");
      const vol = intel.financialMetrics.find(m => m.name === "Sales Volume");

      const passed =
        pat?.currentValue === 609.11 &&
        pat?.previousValue === null &&
        pat?.changePercent === 2.6 &&
        pat?.direction === "UP" &&
        rev?.currentValue === 9634.35 &&
        rev?.previousValue === null &&
        rev?.changePercent === 10.4 &&
        rev?.direction === "UP" &&
        vol?.currentValue === 48763;

      testResults.push({
        testId: "TEST-01-ASHOK-LEYLAND",
        name: "Ashok Leyland PAT/Revenue/Volume Isolation",
        category: "RESULTS",
        passed,
        expected: {
          pat: { currentValue: 609.11, previousValue: null, changePercent: 2.6 },
          revenue: { currentValue: 9634.35, previousValue: null, changePercent: 10.4 },
          volume: { currentValue: 48763 }
        },
        actual: {
          pat: { currentValue: pat?.currentValue, previousValue: pat?.previousValue, changePercent: pat?.changePercent },
          revenue: { currentValue: rev?.currentValue, previousValue: rev?.previousValue, changePercent: rev?.changePercent },
          volume: { currentValue: vol?.currentValue }
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 2: IDFC FIRST Bank (S&P Credit Rating)
    // ------------------------------------------------------------------------
    const idfc = articles.find(a => a.id === "v2_b815c2c69f5a415f");
    if (idfc) {
      const intel = UnifiedIntelligenceEngine.build(idfc);
      const rating = intel.financialMetrics.find(m => m.name === "Credit Rating");

      const passed = rating !== undefined && rating.displayText.includes("BBB-") && rating.displayText.includes("Stable Outlook");

      testResults.push({
        testId: "TEST-02-IDFC-FIRST-BANK",
        name: "IDFC FIRST Bank S&P Credit Rating Extraction",
        category: "CREDIT_RATING",
        passed,
        expected: { rating: "BBB- (Stable Outlook)" },
        actual: { rating: rating?.displayText }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 3: Dhoot Transmission (IPO Price Band & GMP Listing)
    // ------------------------------------------------------------------------
    const dhoot = articles.find(a => a.id === "v2_c077638f6393cd23");
    if (dhoot) {
      const intel = UnifiedIntelligenceEngine.build(dhoot);
      const ipo = intel.financialMetrics.find(m => m.name === "IPO");

      const passed = ipo !== undefined && ipo.displayText.includes("₹829") && ipo.displayText.includes("₹1,137");

      testResults.push({
        testId: "TEST-03-DHOOT-TRANSMISSION",
        name: "Dhoot Transmission IPO Price Band & GMP",
        category: "IPO",
        passed,
        expected: { displayText: "Band: ₹829–₹871, Est Listing: ₹1,137" },
        actual: { displayText: ipo?.displayText }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 4: Patel Retail (Stock Jump vs Revenue vs PAT)
    // ------------------------------------------------------------------------
    const patel = articles.find(a => a.id === "v2_a4c6d6104096f72a");
    if (patel) {
      const intel = UnifiedIntelligenceEngine.build(patel);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");

      const passed =
        pat?.currentValue === 9.52 &&
        pat?.changePercent === 37.57 &&
        rev?.currentValue === 309.54 &&
        rev?.changePercent === 69.7;

      testResults.push({
        testId: "TEST-04-PATEL-RETAIL",
        name: "Patel Retail Metric Extraction (Prevent Stock Gain Contamination)",
        category: "RESULTS",
        passed,
        expected: {
          pat: { currentValue: 9.52, changePercent: 37.57 },
          rev: { currentValue: 309.54, changePercent: 69.7 }
        },
        actual: {
          pat: { currentValue: pat?.currentValue, changePercent: pat?.changePercent },
          rev: { currentValue: rev?.currentValue, changePercent: rev?.changePercent }
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 5: Natco Pharma (Profit Fall 57%)
    // ------------------------------------------------------------------------
    const natco = articles.find(a => a.id === "v2_fc238193fa01bb9d");
    if (natco) {
      const intel = UnifiedIntelligenceEngine.build(natco);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");

      const passed =
        pat?.currentValue === 206.5 &&
        pat?.changePercent === 57 &&
        pat?.direction === "DOWN";

      testResults.push({
        testId: "TEST-05-NATCO-PHARMA",
        name: "Natco Pharma Q1 Profit Fall Extraction",
        category: "RESULTS",
        passed,
        expected: { pat: { currentValue: 206.5, changePercent: 57, direction: "DOWN" } },
        actual: { pat: { currentValue: pat?.currentValue, changePercent: pat?.changePercent, direction: pat?.direction } }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 6: Shreeji Shipping Global (PAT % vs Revenue Value + %)
    // ------------------------------------------------------------------------
    const shreeji = articles.find(a => a.id === "v2_0f572a698364b2d7");
    if (shreeji) {
      const intel = UnifiedIntelligenceEngine.build(shreeji);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");

      const passed =
        pat?.changePercent === 19.03 &&
        pat?.direction === "UP" &&
        rev?.currentValue === 208.85 &&
        rev?.changePercent === 29.57;

      testResults.push({
        testId: "TEST-06-SHREEJI-SHIPPING",
        name: "Shreeji Shipping PAT Growth & Revenue Extraction",
        category: "RESULTS",
        passed,
        expected: {
          pat: { changePercent: 19.03, direction: "UP" },
          rev: { currentValue: 208.85, changePercent: 29.57 }
        },
        actual: {
          pat: { changePercent: pat?.changePercent, direction: pat?.direction },
          rev: { currentValue: rev?.currentValue, changePercent: rev?.changePercent }
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 7: Tube Investments (PAT Decline % vs Revenue Growth)
    // ------------------------------------------------------------------------
    const tube = articles.find(a => a.id === "v2_57dfaad029a0edcb");
    if (tube) {
      const intel = UnifiedIntelligenceEngine.build(tube);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");

      const passed =
        pat?.changePercent === 15.25 &&
        pat?.direction === "DOWN" &&
        rev?.currentValue === 6038.11 &&
        rev?.changePercent === 16.78;

      testResults.push({
        testId: "TEST-07-TUBE-INVESTMENTS",
        name: "Tube Investments PAT Decline vs Revenue Growth",
        category: "RESULTS",
        passed,
        expected: {
          pat: { changePercent: 15.25, direction: "DOWN" },
          rev: { currentValue: 6038.11, changePercent: 16.78 }
        },
        actual: {
          pat: { changePercent: pat?.changePercent, direction: pat?.direction },
          rev: { currentValue: rev?.currentValue, changePercent: rev?.changePercent }
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 8: Bharatiya Global (Negative PAT Loss)
    // ------------------------------------------------------------------------
    const bharatiya = articles.find(a => a.id === "v2_266985f2c1ad22d6");
    if (bharatiya) {
      const intel = UnifiedIntelligenceEngine.build(bharatiya);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");

      const passed =
        pat?.currentValue === -0.08 &&
        pat?.direction === "DOWN" &&
        rev?.currentValue === 0.11;

      testResults.push({
        testId: "TEST-08-BHARATIYA-GLOBAL",
        name: "Bharatiya Global Net Loss Representation",
        category: "RESULTS",
        passed,
        expected: { pat: { currentValue: -0.08, direction: "DOWN" }, rev: { currentValue: 0.11 } },
        actual: { pat: { currentValue: pat?.currentValue, direction: pat?.direction }, rev: { currentValue: rev?.currentValue } }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 9: Magnum Ventures (Negative PAT Loss vs Positive Revenue)
    // ------------------------------------------------------------------------
    const magnum = articles.find(a => a.id === "v2_93397c26567d85c7");
    if (magnum) {
      const intel = UnifiedIntelligenceEngine.build(magnum);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");

      const passed =
        pat?.currentValue === -8.28 &&
        pat?.direction === "DOWN" &&
        rev?.currentValue === 123.41 &&
        rev?.changePercent === 6.6;

      testResults.push({
        testId: "TEST-09-MAGNUM-VENTURES",
        name: "Magnum Ventures Net Loss & Revenue Growth",
        category: "RESULTS",
        passed,
        expected: {
          pat: { currentValue: -8.28, direction: "DOWN" },
          rev: { currentValue: 123.41, changePercent: 6.6 }
        },
        actual: {
          pat: { currentValue: pat?.currentValue, direction: pat?.direction },
          rev: { currentValue: rev?.currentValue, changePercent: rev?.changePercent }
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 10: Forbes & Company (Double Decline: PAT & Revenue)
    // ------------------------------------------------------------------------
    const forbes = articles.find(a => a.id === "v2_5905fb614bfcad2d");
    if (forbes) {
      const intel = UnifiedIntelligenceEngine.build(forbes);
      const pat = intel.financialMetrics.find(m => m.name === "PAT");
      const rev = intel.financialMetrics.find(m => m.name === "Revenue");

      const passed =
        pat?.changePercent === 25.93 &&
        pat?.direction === "DOWN" &&
        rev?.currentValue === 13.26 &&
        rev?.changePercent === 40.94 &&
        rev?.direction === "DOWN";

      testResults.push({
        testId: "TEST-10-FORBES-AND-CO",
        name: "Forbes & Company PAT & Revenue Double Decline",
        category: "RESULTS",
        passed,
        expected: {
          pat: { changePercent: 25.93, direction: "DOWN" },
          rev: { currentValue: 13.26, changePercent: 40.94, direction: "DOWN" }
        },
        actual: {
          pat: { changePercent: pat?.changePercent, direction: pat?.direction },
          rev: { currentValue: rev?.currentValue, changePercent: rev?.changePercent, direction: rev?.direction }
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 11: Non-results Corporate (HCL NetApp - Zero Hallucinated Metrics)
    // ------------------------------------------------------------------------
    const hcl = articles.find(a => a.id === "v2_54cbd7071b1ef34b");
    if (hcl) {
      const intel = UnifiedIntelligenceEngine.build(hcl);
      const passed = intel.financialMetrics.length === 0;

      testResults.push({
        testId: "TEST-11-HCL-NETAPP",
        name: "HCL NetApp Partnership (Zero Hallucinated Metrics)",
        category: "CORPORATE",
        passed,
        expected: { metricCount: 0 },
        actual: { metricCount: intel.financialMetrics.length }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 12: Corporate IPO Banks (Quest Global - Zero Hallucinated Metrics)
    // ------------------------------------------------------------------------
    const quest = articles.find(a => a.id === "v2_2eb5ba5205aa89f1");
    if (quest) {
      const intel = UnifiedIntelligenceEngine.build(quest);
      const passed = intel.financialMetrics.length === 0;

      testResults.push({
        testId: "TEST-12-QUEST-GLOBAL",
        name: "Quest Global IPO Mandate (Zero Hallucinated Metrics)",
        category: "CORPORATE",
        passed,
        expected: { metricCount: 0 },
        actual: { metricCount: intel.financialMetrics.length }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 13: Macro Market Index (Sensex / Nifty - Zero Corporate Metrics)
    // ------------------------------------------------------------------------
    const sensex = articles.find(a => a.id === "v2_f8d87bef2446ca90");
    if (sensex) {
      const intel = UnifiedIntelligenceEngine.build(sensex);
      const passed = intel.financialMetrics.length === 0 && intel.entityType === "BROAD_MARKET";

      testResults.push({
        testId: "TEST-13-SENSEX-NIFTY-MACRO",
        name: "Sensex/Nifty Macro Index (Zero Hallucinated Corporate Metrics)",
        category: "MACRO",
        passed,
        expected: { metricCount: 0, entityType: "BROAD_MARKET" },
        actual: { metricCount: intel.financialMetrics.length, entityType: intel.entityType }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 14: Macro FX / RBI (Rupee Weekly Decline - Zero Corporate Metrics)
    // ------------------------------------------------------------------------
    const rupee = articles.find(a => a.id === "v2_7564338efd61bcf7");
    if (rupee) {
      const intel = UnifiedIntelligenceEngine.build(rupee);
      const passed = intel.financialMetrics.length === 0 && (intel.entityType === "MACRO" || intel.entityType === "COMMODITY");

      testResults.push({
        testId: "TEST-14-RUPEE-RBI-MACRO",
        name: "Rupee RBI Intervention (Zero Hallucinated Corporate Metrics)",
        category: "MACRO",
        passed,
        expected: { metricCount: 0 },
        actual: { metricCount: intel.financialMetrics.length }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 15: ADVERSARIAL MULTI-METRIC CLAUSE ISOLATION
    // ------------------------------------------------------------------------
    const adversarialText =
      "Acme Corp Q1 net profit surged 45.2% YoY to Rs 1,450.50 crore on revenue of Rs 12,340 crore which grew 18.5%, while EBITDA stood at Rs 3,200 crore with margin expanding 120 bps.";
    const advFacts = SemanticFactExtractor.extractFacts(adversarialText);
    const advPat = advFacts.find(f => f.metricName === "PAT");
    const advRev = advFacts.find(f => f.metricName === "Revenue");
    const advEbitda = advFacts.find(f => f.metricName === "EBITDA");

    const advPassed =
      advPat?.currentValue === 1450.50 &&
      advPat?.changePercent === 45.2 &&
      advPat?.direction === "UP" &&
      advRev?.currentValue === 12340 &&
      advRev?.changePercent === 18.5 &&
      advRev?.direction === "UP" &&
      advEbitda?.currentValue === 3200;

    testResults.push({
      testId: "TEST-15-ADVERSARIAL-MULTI-METRIC-CLAUSES",
      name: "Adversarial 4-Metric Compound Sentence Extraction",
      category: "ADVERSARIAL",
      passed: advPassed,
      expected: {
        pat: { val: 1450.5, pct: 45.2 },
        rev: { val: 12340, pct: 18.5 },
        ebitda: { val: 3200 }
      },
      actual: {
        pat: { val: advPat?.currentValue, pct: advPat?.changePercent },
        rev: { val: advRev?.currentValue, pct: advRev?.changePercent },
        ebitda: { val: advEbitda?.currentValue }
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 16: PARITY VERIFICATION (Telegram Formatter vs Canonical Record)
    // ------------------------------------------------------------------------
    if (ashok) {
      const intel = UnifiedIntelligenceEngine.build(ashok);
      const tg = TraderTelegramFormatter.format(intel);

      const tgHasPat = tg.includes("PAT: ₹609.11 Cr (↑ 2.6% YoY)");
      const tgHasRev = tg.includes("Revenue: ₹9,634.35 Cr (↑ 10.4% YoY)");
      const tgHasVol = tg.includes("Sales Volume: 48,763 CV units");
      const tgPassed = tgHasPat && tgHasRev && tgHasVol;

      testResults.push({
        testId: "TEST-16-TELEGRAM-PARITY-ASHOK",
        name: "UI / Telegram 100% Metric Parity on Ashok Leyland",
        category: "RESULTS",
        passed: tgPassed,
        expected: {
          patLine: "PAT: ₹609.11 Cr (↑ 2.6% YoY)",
          revLine: "Revenue: ₹9,634.35 Cr (↑ 10.4% YoY)",
          volLine: "Sales Volume: 48,763 CV units"
        },
        actual: {
          tgHasPat,
          tgHasRev,
          tgHasVol
        }
      });
    }

    // ------------------------------------------------------------------------
    // SCENARIO 17: SCHEMA VALIDATOR RESILIENCE
    // ------------------------------------------------------------------------
    if (ashok) {
      const intel = UnifiedIntelligenceEngine.build(ashok);
      const validation = IntelligenceValidator.validate(intel);
      testResults.push({
        testId: "TEST-17-SCHEMA-VALIDATION",
        name: "Canonical Intelligence Schema & Safety Validation",
        category: "RESULTS",
        passed: validation.valid && validation.errors.length === 0,
        expected: { valid: true, errorCount: 0 },
        actual: { valid: validation.valid, errors: validation.errors }
      });
    }

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;
    const totalTests = testResults.length;
    const successRate = `${((passCount / totalTests) * 100).toFixed(1)}%`;

    return {
      timestamp: new Date().toISOString(),
      version: UnifiedIntelligenceEngine.VERSION,
      totalTests,
      passCount,
      failCount,
      successRate,
      allPassed: failCount === 0,
      testResults
    };
  }
}
