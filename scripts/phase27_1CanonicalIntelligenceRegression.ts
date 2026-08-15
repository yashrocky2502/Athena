import { NewsArticleV2 } from "../src/newsCoreV2/domain/NewsArticle.ts";
import { UnifiedIntelligenceEngine } from "../src/newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine.ts";
import { IntelligenceStore } from "../src/newsCoreV2/intelligenceV2/IntelligenceStore.ts";
import { IntelligenceValidator } from "../src/newsCoreV2/intelligenceV2/IntelligenceValidator.ts";
import { TraderTelegramFormatter } from "../src/news/NewsEngine/TraderTelegramFormatter.ts";
import { TelegramNotificationPipeline } from "../src/news/NewsEngine/TelegramNotificationPipeline.ts";
import { newsStore } from "../src/newsCoreV2/storage/PersistentNewsStore.ts";
import { NewsCoreV2UIAdapter } from "../src/newsCoreV2/api/NewsCoreV2UIAdapter.ts";

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details?: string;
}

export async function runPhase27_1Regression(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];

  function record(id: number, name: string, passed: boolean, details?: string) {
    results.push({ id, name, passed, details });
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`[TEST ${id.toString().padStart(2, '0')}] ${status} - ${name}${details ? ` (${details})` : ""}`);
  }

  console.log("================================================================");
  console.log("ATHENA — PHASE 27.1 CANONICAL INTELLIGENCE REGRESSION TEST SUITE");
  console.log("================================================================\n");

  const store = IntelligenceStore.getInstance();

  // Helper dummy article generator
  const createArt = (partial: Partial<NewsArticleV2>): NewsArticleV2 => ({
    id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    headline: "Default Headline",
    body: "Default Body text with sufficient words for processing.",
    canonicalUrl: "https://example.com/news/1",
    source: { publisher: "Reuters", url: "https://example.com/news/1", collectionMethod: "RSS" },
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    category: "CORPORATE",
    sentiment: "NEUTRAL",
    relevanceScore: 80,
    fno: { eligible: false, symbol: null, decision: "EXCLUDE", confidence: "NONE", reason: "Default test" },
    ...partial
  });

  // TEST 1: Canonical record generation
  try {
    const art = createArt({
      headline: "Tata Motors reports Q1 net profit of Rs 5,500 crore",
      body: "Tata Motors reported a net profit of Rs 5,500 crore for Q1, up 74% YoY. Revenue stood at Rs 1,05,000 crore."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const validation = IntelligenceValidator.validate(intel);
    record(1, "Canonical record generation", intel && intel.intelligenceVersion === "27.1" && validation.valid, `Version: ${intel.intelligenceVersion}`);
  } catch (e: any) {
    record(1, "Canonical record generation", false, e.message);
  }

  // TEST 2: UI/Telegram same record
  try {
    const art = createArt({
      headline: "Infosys signs $1.5 billion deal with global enterprise",
      body: "Infosys announced a strategic five-year collaboration valued at $1.5 billion."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const tgFormatted = TraderTelegramFormatter.format(intel);
    const uiAdapted = NewsCoreV2UIAdapter.adapt(art);

    const matchExecutive = tgFormatted.includes(intel.executiveSummary) && uiAdapted.summary === intel.executiveSummary;
    const matchSymbol = tgFormatted.includes("INFY") && uiAdapted.fnoSymbol === "INFY";
    record(2, "UI/Telegram same record", matchExecutive && matchSymbol, `Executive summary and symbol match exactly`);
  } catch (e: any) {
    record(2, "UI/Telegram same record", false, e.message);
  }

  // TEST 3: Company entity preservation
  try {
    const art = createArt({
      headline: "Reliance Industries to invest Rs 75,000 crore in clean energy gigafactories",
      body: "Reliance Industries announced ambitious expansion in renewable energy manufacturing."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(3, "Company entity preservation", intel.companyName === "Reliance Industries" && intel.symbol === "RELIANCE", `Company: ${intel.companyName}, Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(3, "Company entity preservation", false, e.message);
  }

  // TEST 4: F&O metadata preservation
  try {
    const art = createArt({
      headline: "HDFC Bank quarterly updates show loan growth of 15% YoY",
      body: "HDFC Bank reported advances growth of 15% YoY in its quarterly business update.",
      fno: { eligible: true, symbol: "HDFCBANK", decision: "INCLUDE", confidence: "HIGH", reason: "Authoritative FNO inclusion" }
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(4, "F&O metadata preservation", intel.fnoEligible === true && intel.symbol === "HDFCBANK" && intel.fnoConfidence === "HIGH", `Preserved FNO symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(4, "F&O metadata preservation", false, e.message);
  }

  // TEST 5: Solar Industries → SOLARINDS
  try {
    const art = createArt({
      headline: "Solar Industries reports 92.6% jump in Q1 net profit to Rs 653 crore",
      body: "Solar Industries India posted stellar performance with net profit rising to Rs 653 crore."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(5, "Solar Industries → SOLARINDS", intel.symbol === "SOLARINDS" && intel.fnoEligible === true, `Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(5, "Solar Industries → SOLARINDS", false, e.message);
  }

  // TEST 6: Ipca Labs → IPCALAB
  try {
    const art = createArt({
      headline: "Ipca Labs receives USFDA approval for generic blood pressure medication",
      body: "Ipca Laboratories announced final approval from USFDA for its generic formulation."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(6, "Ipca Labs → IPCALAB", intel.symbol === "IPCALAB" && intel.companyName.toLowerCase().includes("ipca"), `Symbol: ${intel.symbol}, Company: ${intel.companyName}`);
  } catch (e: any) {
    record(6, "Ipca Labs → IPCALAB", false, e.message);
  }

  // TEST 7: HAL → HAL
  try {
    const art = createArt({
      headline: "HAL bags Rs 26,000 crore contract for Sukhoi aero-engines",
      body: "Hindustan Aeronautics Limited (HAL) has signed a contract with the Ministry of Defence."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(7, "HAL → HAL", intel.symbol === "HAL" && intel.companyName.toLowerCase().includes("hindustan aeronautics"), `Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(7, "HAL → HAL", false, e.message);
  }

  // TEST 8: Bank Nifty does not resolve as NIFTY
  try {
    const art = createArt({
      headline: "Bank Nifty tumbles 450 points led by selling in private banking heavyweights",
      body: "Bank Nifty index closed lower amid broad risk-off sentiment in financial stocks."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const isBankNifty = intel.symbol === "BANKNIFTY";
    record(8, "Bank Nifty does not resolve as NIFTY", isBankNifty && intel.companyName === "Bank Nifty", `Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(8, "Bank Nifty does not resolve as NIFTY", false, e.message);
  }

  // TEST 9: Indian Oil does not create false IOC match
  try {
    const art = createArt({
      headline: "Indian oil imports from Russia jump 12% in July to record high",
      body: "Crude oil shipments to India increased significantly during the month of July."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(9, "Indian Oil does not create false IOC match", intel.symbol === null && intel.entityType === "COMMODITY", `EntityType: ${intel.entityType}, Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(9, "Indian Oil does not create false IOC match", false, e.message);
  }

  // TEST 10: Macro article does not become NIFTY
  try {
    const art = createArt({
      headline: "India GDP growth projected at 7.2% by RBI amid resilient domestic demand",
      body: "The Reserve Bank of India projected real GDP growth of 7.2% for the ongoing fiscal year."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(10, "Macro article does not become NIFTY", intel.entityType === "MACRO" && intel.symbol === null, `EntityType: ${intel.entityType}, Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(10, "Macro article does not become NIFTY", false, e.message);
  }

  // TEST 11: Commodity article does not become NIFTY
  try {
    const art = createArt({
      headline: "Gold prices drop Rs 300 per 10 grams tracking weak global bullion cues",
      body: "Precious metal prices softened in national capital markets today."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(11, "Commodity article does not become NIFTY", intel.entityType === "COMMODITY" && intel.symbol === null, `EntityType: ${intel.entityType}, Symbol: ${intel.symbol}`);
  } catch (e: any) {
    record(11, "Commodity article does not become NIFTY", false, e.message);
  }

  // TEST 12: No "NONE" when authoritative entity exists
  try {
    const art = createArt({
      headline: "TCS bags $1 billion multi-year digital transformation deal",
      body: "Tata Consultancy Services won a major enterprise contract.",
      fno: { eligible: true, symbol: "TCS", decision: "INCLUDE", confidence: "HIGH", reason: "Authoritative FNO" }
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(12, 'No "NONE" when authoritative entity exists', intel.companyName !== "NONE" && intel.symbol === "TCS" && intel.companyName.includes("Tata Consultancy Services"), `Company: ${intel.companyName}`);
  } catch (e: any) {
    record(12, 'No "NONE" when authoritative entity exists', false, e.message);
  }

  // TEST 13: Financial metrics preserved
  try {
    const art = createArt({
      headline: "Grasim Q1 net profit up 51% YoY to Rs 1,120 crore; revenue at Rs 31,000 crore",
      body: "Grasim Industries announced Q1 results with net profit jumping 51% YoY to Rs 1,120 crore. Revenue reached Rs 31,000 crore."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const hasPat = intel.financialMetrics.some(m => m.name === "PAT" && m.currentValue === 1120);
    const hasRev = intel.financialMetrics.some(m => m.name === "Revenue" && m.currentValue === 31000);
    record(13, "Financial metrics preserved", hasPat && hasRev, `Extracted ${intel.financialMetrics.length} metrics (PAT: ${hasPat}, Rev: ${hasRev})`);
  } catch (e: any) {
    record(13, "Financial metrics preserved", false, e.message);
  }

  // TEST 14: Metric direction preserved
  try {
    const art = createArt({
      headline: "Wipro Q1 net profit falls 8% YoY to Rs 2,870 crore",
      body: "Wipro reported a decline of 8% in its consolidated net profit to Rs 2,870 crore for the first quarter."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const pat = intel.pat || intel.financialMetrics.find(m => m.name === "PAT");
    record(14, "Metric direction preserved", pat?.direction === "DOWN", `PAT Direction: ${pat?.direction}`);
  } catch (e: any) {
    record(14, "Metric direction preserved", false, e.message);
  }

  // TEST 15: Negative PAT handled correctly
  try {
    const art = createArt({
      headline: "Vodafone Idea posts net loss of Rs 6,432 crore in Q1",
      body: "Vodafone Idea announced a net loss of Rs 6,432 crore for the quarter ended June 30."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const pat = intel.pat || intel.financialMetrics.find(m => m.name === "PAT");
    record(15, "Negative PAT handled correctly", pat !== undefined && pat.direction === "DOWN" && (pat.currentValue !== null && pat.currentValue < 0), `Value: ${pat?.currentValue}, Direction: ${pat?.direction}`);
  } catch (e: any) {
    record(15, "Negative PAT handled correctly", false, e.message);
  }

  // TEST 16: Unsupported numbers rejected
  try {
    const art = createArt({
      headline: "L&T wins significant infrastructure order for high-speed rail project",
      body: "Larsen & Toubro secured an infrastructure package for construction of bridges."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const inventedPat = intel.financialMetrics.some(m => m.name === "PAT" && m.currentValue !== null && m.currentValue > 0);
    record(16, "Unsupported numbers rejected", !inventedPat, `Invented PAT metrics: ${inventedPat}`);
  } catch (e: any) {
    record(16, "Unsupported numbers rejected", false, e.message);
  }

  // TEST 17: Unsupported options guidance rejected
  try {
    const art = createArt({
      headline: "SEBI issues notice to financial intermediary regarding disclosure delays",
      body: "Market regulator SEBI has sought clarification from the intermediary regarding timelines."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    const val = IntelligenceValidator.validate(intel);
    const hasSpeculation = /buy\s*\d+|sell\s*\d+|target\s*price|guaranteed/i.test(intel.optionsSellerImpact);
    record(17, "Unsupported options guidance rejected", val.valid && !hasSpeculation && intel.optionsSellerImpact.includes("No actionable F&O setup"), `Impact: "${intel.optionsSellerImpact}"`);
  } catch (e: any) {
    record(17, "Unsupported options guidance rejected", false, e.message);
  }

  // TEST 18: Historical summary has zero Telegram side effects
  try {
    const pipeline = TelegramNotificationPipeline.getInstance();
    const statsBefore = pipeline.getTelemetryStats();
    
    // Generate canonical summary for an old article
    const art = createArt({
      id: "historical_test_art_001",
      headline: "Historical article for on-demand inspection",
      body: "This is a historical archive article being opened on demand in the UI."
    });
    const intel = UnifiedIntelligenceEngine.build(art);

    const statsAfter = pipeline.getTelemetryStats();
    const noSideEffects = statsBefore.sentCount === statsAfter.sentCount && statsBefore.digestPendingCount === statsAfter.digestPendingCount;
    record(18, "Historical summary has zero Telegram side effects", noSideEffects && !!intel, `Telemetry state intact`);
  } catch (e: any) {
    record(18, "Historical summary has zero Telegram side effects", false, e.message);
  }

  // TEST 19: Missing article blocks Telegram
  try {
    const pipeline = TelegramNotificationPipeline.getInstance();
    const missingArt = createArt({
      id: "non_existent_orphan_article_99999",
      headline: "Ghost article not in PersistentNewsStore",
      body: "This article was never saved to PersistentNewsStore."
    });

    const result = await pipeline.processArticle(missingArt);
    record(19, "Missing article blocks Telegram", result.enqueued === false && result.reason === "SUMMARY_ORPHAN_BLOCKED", `Result reason: ${result.reason}`);
  } catch (e: any) {
    record(19, "Missing article blocks Telegram", false, e.message);
  }

  // TEST 20: UI/API/Telegram parity
  try {
    const art = createArt({
      id: "parity_art_101",
      headline: "Maruti Suzuki auto sales jump 18% in July",
      body: "Maruti Suzuki recorded total vehicle sales growth of 18% YoY."
    });
    // Save to store so it's a real article
    newsStore.upsertArticle(art);

    const intel = UnifiedIntelligenceEngine.build(art);
    const ui = NewsCoreV2UIAdapter.adapt(art);
    const tg = TraderTelegramFormatter.format(intel);

    const paritySummary = ui.summary === intel.executiveSummary;
    const parityTg = tg.includes(TraderTelegramFormatter.escapeHtml(intel.executiveSummary));
    const paritySymbol = ui.fnoSymbol === intel.symbol;
    const parityCompany = ui.companyName === intel.companyName;
    const parityOk = paritySummary && parityTg && paritySymbol && parityCompany;

    record(20, "UI/API/Telegram parity", parityOk, `All three layers consume identical canonical values (Summary: ${paritySummary}, TG: ${parityTg}, Symbol: ${paritySymbol}, Co: ${parityCompany})`);
  } catch (e: any) {
    record(20, "UI/API/Telegram parity", false, e.message);
  }

  // TEST 21: Intelligence cache works
  try {
    const art = createArt({
      id: "cached_article_202",
      headline: "Bajaj Finance expands customer franchise by 4.5 million in Q1",
      body: "Bajaj Finance reported robust customer acquisitions in the first quarter."
    });
    const firstCall = UnifiedIntelligenceEngine.build(art);
    const cached = store.get(art.id, "27.1");
    record(21, "Intelligence cache works", cached !== null && cached.articleId === art.id && cached === firstCall, `Retrieved from cache correctly`);
  } catch (e: any) {
    record(21, "Intelligence cache works", false, e.message);
  }

  // TEST 22: Restart preserves cache safely
  try {
    store.saveToDisk();
    const sizeBefore = store.size();
    store.hydrateFromDisk();
    const sizeAfter = store.size();
    record(22, "Restart preserves cache safely", sizeAfter >= sizeBefore, `Hydrated ${sizeAfter} records from disk`);
  } catch (e: any) {
    record(22, "Restart preserves cache safely", false, e.message);
  }

  // TEST 23: Duplicate article does not create duplicate intelligence
  try {
    const art = createArt({
      id: "dedup_article_303",
      headline: "ITC launches new FMCG product line in premium foods segment",
      body: "ITC Limited expanded its foods portfolio with premium product offerings."
    });
    const first = UnifiedIntelligenceEngine.build(art);
    const second = UnifiedIntelligenceEngine.build(art);
    record(23, "Duplicate article does not create duplicate intelligence", first === second && first.articleId === second.articleId, `Identical reference returned`);
  } catch (e: any) {
    record(23, "Duplicate article does not create duplicate intelligence", false, e.message);
  }

  // TEST 24: Generic BSE earnings calendar remains non-company intelligence
  try {
    const art = createArt({
      headline: "BSE earnings calendar: 50 companies to announce Q1 results today including midcaps",
      body: "Over 50 corporate board meetings are scheduled today to consider quarterly earnings."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(24, "Generic BSE earnings calendar remains non-company intelligence", intel.entityType === "BROAD_MARKET" && intel.companyName === "Earnings Calendar" && intel.symbol === null, `EntityType: ${intel.entityType}, Company: ${intel.companyName}`);
  } catch (e: any) {
    record(24, "Generic BSE earnings calendar remains non-company intelligence", false, e.message);
  }

  // TEST 25: Body-only mention does not create F&O entity
  try {
    const art = createArt({
      headline: "Global stock markets rally as tech shares extend weekly gains",
      body: "Wall Street gains led Asian markets higher today, while Tata Motors and Infosys were mentioned in passing by brokers."
    });
    const intel = UnifiedIntelligenceEngine.build(art);
    record(25, "Body-only mention does not create F&O entity", intel.entityType === "BROAD_MARKET" && intel.symbol === null && intel.fnoEligible === false, `EntityType: ${intel.entityType}, Symbol: ${intel.symbol}, fnoEligible: ${intel.fnoEligible}`);
  } catch (e: any) {
    record(25, "Body-only mention does not create F&O entity", false, e.message);
  }

  console.log("\n================================================================");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`PHASE 27.1 REGRESSION SUMMARY: ${passed}/${results.length} PASSED (Failed: ${failed})`);
  console.log("================================================================\n");

  return {
    total: results.length,
    passed,
    failed,
    results
  };
}

// Run if called directly
runPhase27_1Regression().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error("Regression error:", err);
  process.exit(1);
});
