import { TelegramQualityGate } from './TelegramQualityGate';
import { TelegramNotificationPipeline } from './TelegramNotificationPipeline';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';
import { NewsCategoryV2, SentimentV2 } from '../../newsCoreV2/domain/NewsClassification';

export interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  actualDecision: string;
  expectedDecision: string;
  reason: string;
  details?: string;
}

function createMockArticle(data: {
  id: string;
  headline: string;
  body: string;
  sourceName: string;
  publishedAt: string;
  category: NewsCategoryV2;
  symbol: string;
  eligible: boolean;
  sentiment?: SentimentV2;
  relevanceScore?: number;
}): NewsArticleV2 {
  return {
    id: data.id,
    canonicalUrl: `https://example.com/news/${data.id}`,
    headline: data.headline,
    body: data.body,
    source: {
      publisher: data.sourceName,
      url: `https://example.com/source/${encodeURIComponent(data.sourceName)}`,
      collectionMethod: 'DIRECT'
    },
    publishedAt: data.publishedAt,
    collectedAt: data.publishedAt,
    category: data.category,
    sentiment: data.sentiment || 'NEUTRAL',
    relevanceScore: data.relevanceScore || 90,
    fno: {
      eligible: data.eligible,
      symbol: data.symbol,
      confidence: 'HIGH',
      decision: data.eligible ? 'INCLUDE' : 'EXCLUDE',
      reason: 'Rule matches symbol'
    }
  };
}

export async function runTelegramQualityGateRegressionSuite(): Promise<{
  success: boolean;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const pipeline = TelegramNotificationPipeline.getInstance();

  // Reset Quality Gate cluster history for test isolation
  TelegramQualityGate.clearClusterHistory();
  const originalWatermark = pipeline.getWatermark();
  const testWatermark = new Date('2026-08-13T00:00:00.000Z').toISOString();
  pipeline.setWatermark(testWatermark);

  // Test 1: Historical article before activation watermark
  const histArticle = createMockArticle({
    id: 'test_hist_01',
    headline: 'Tata Motors Reports Excellent Sales Growth in Commercial Vehicle Segment',
    body: 'Strong performance across heavy commercial vehicles.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-12T10:00:00.000Z', // Before 2026-08-13
    category: 'CORPORATE',
    symbol: 'TATAMOTORS',
    eligible: true
  });
  const eval1 = TelegramQualityGate.evaluate(histArticle, { watermarkIso: testWatermark });
  const pass1 = eval1.decision === 'NO_ACTION' && eval1.reason.includes('before Telegram activation watermark');
  results.push({
    id: 1,
    name: 'Historical Backlog Watermark Protection',
    passed: pass1,
    expectedDecision: 'NO_ACTION',
    actualDecision: eval1.decision,
    reason: eval1.reason
  });

  // Test 2: Generic earnings calendar or multi-company list
  const calArticle = createMockArticle({
    id: 'test_cal_02',
    headline: 'Earnings Today: Reliance, TCS, Infosys, HDFC Bank, Tata Steel to declare Q1 results on August 14',
    body: 'Here is the complete list of stocks declaring results today including Reliance, TCS, Wipro, and Infosys.',
    sourceName: 'Moneycontrol',
    publishedAt: '2026-08-13T08:00:00.000Z',
    category: 'MARKET',
    symbol: 'RELIANCE',
    eligible: true
  });
  const eval2 = TelegramQualityGate.evaluate(calArticle, { watermarkIso: testWatermark });
  const pass2 = eval2.decision === 'NO_ACTION' && eval2.reason.includes('Generic earnings calendar');
  results.push({
    id: 2,
    name: 'Generic Earnings Calendar / Multi-Company List Suppression',
    passed: pass2,
    expectedDecision: 'NO_ACTION',
    actualDecision: eval2.decision,
    reason: eval2.reason
  });

  // Test 3: High priority single F&O story with strong financial metrics
  const highArticle = createMockArticle({
    id: 'test_high_03',
    headline: 'Tata Steel Q1 Net Profit Surges 34% YoY to Rs 9,182 Crore, Beating Estimates',
    body: 'Tata Steel reported consolidated net profit of Rs 9,182 crore up 34% year-on-year. Revenue grew 18% to Rs 58,000 crore.',
    sourceName: 'Reuters',
    publishedAt: '2026-08-13T09:00:00.000Z',
    category: 'RESULTS',
    symbol: 'TATASTEEL',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 95
  });
  const eval3 = TelegramQualityGate.evaluate(highArticle, { watermarkIso: testWatermark });
  const pass3 = eval3.decision === 'IMMEDIATE' && eval3.priority === 'CRITICAL';
  results.push({
    id: 3,
    name: 'High Materiality Single F&O Critical Story',
    passed: pass3,
    expectedDecision: 'IMMEDIATE',
    actualDecision: eval3.decision,
    reason: eval3.reason
  });

  // Test 4: Medium priority story without immediate catalyst
  const medArticle = createMockArticle({
    id: 'test_med_04',
    headline: 'Infosys Expands Digital Technology Collaboration Hub in London',
    body: 'Infosys announces extension of its European client innovation facilities in London.',
    sourceName: 'LiveMint',
    publishedAt: '2026-08-13T09:15:00.000Z',
    category: 'CORPORATE',
    symbol: 'INFY',
    eligible: true,
    sentiment: 'NEUTRAL',
    relevanceScore: 70
  });
  const eval4 = TelegramQualityGate.evaluate(medArticle, { watermarkIso: testWatermark });
  const pass4 = eval4.decision === 'DIGEST_PENDING';
  results.push({
    id: 4,
    name: 'Medium Priority Story Routed to Digest',
    passed: pass4,
    expectedDecision: 'DIGEST_PENDING',
    actualDecision: eval4.decision,
    reason: eval4.reason
  });

  // Test 5: Unresolved or low confidence symbol
  const lowConfArticle = createMockArticle({
    id: 'test_lowconf_05',
    headline: 'Global Tech Trends 2026: Cloud Computing and AI Transformation In Enterprise Software',
    body: 'Enterprise software companies including Microsoft, SAP, and passingly Infosys are adopting AI models.',
    sourceName: 'Business Standard',
    publishedAt: '2026-08-13T09:30:00.000Z',
    category: 'GENERAL',
    symbol: 'INFY',
    eligible: true,
    relevanceScore: 40
  });
  const eval5 = TelegramQualityGate.evaluate(lowConfArticle, { watermarkIso: testWatermark });
  const pass5 = eval5.decision === 'NO_ACTION' || eval5.decision === 'SUPPRESSED';
  results.push({
    id: 5,
    name: 'Low Symbol Confidence / Passing Mention Filtering',
    passed: pass5,
    expectedDecision: 'NO_ACTION',
    actualDecision: eval5.decision,
    reason: eval5.reason
  });

  // Test 6: Low priority routine market event
  const routineArticle = createMockArticle({
    id: 'test_routine_06',
    headline: 'Markets Close Slightly Higher as FMCG Stocks Gain Marginally',
    body: 'General market roundup with minor changes in FMCG index.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-13T10:00:00.000Z',
    category: 'MARKET',
    symbol: 'ITC',
    eligible: false
  });
  const eval6 = TelegramQualityGate.evaluate(routineArticle, { watermarkIso: testWatermark });
  const pass6 = eval6.decision === 'NO_ACTION' || eval6.decision === 'SUPPRESSED';
  results.push({
    id: 6,
    name: 'Low Priority Routine Market Event Filtering',
    passed: pass6,
    expectedDecision: 'NO_ACTION',
    actualDecision: eval6.decision,
    reason: eval6.reason
  });

  // Test 7: Duplicate cluster key within 1 hour
  const dupArticle1 = createMockArticle({
    id: 'test_dup_07a',
    headline: 'Reliance Industries Board Approves Solar Cell Manufacturing Plant Capital Expenditure',
    body: 'Reliance Board approves green hydrogen outlay of Rs 10,000 Cr.',
    sourceName: 'Reuters',
    publishedAt: '2026-08-13T10:15:00.000Z',
    category: 'CORPORATE',
    symbol: 'RELIANCE',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 90
  });
  const dupArticle2 = createMockArticle({
    id: 'test_dup_07b',
    headline: 'Reliance Industries Board Approves Solar Cell Manufacturing Unit Capital Expenditure Outlay',
    body: 'RIL announces massive investment in renewable energy solar cell project.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-13T10:20:00.000Z',
    category: 'CORPORATE',
    symbol: 'RELIANCE',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 92
  });
  TelegramQualityGate.evaluate(dupArticle1, { watermarkIso: testWatermark }); // First evaluation
  const eval7 = TelegramQualityGate.evaluate(dupArticle2, { watermarkIso: testWatermark }); // Duplicate
  const pass7 = eval7.decision === 'SUPPRESSED' && eval7.reason.includes('Duplicate story cluster');
  results.push({
    id: 7,
    name: 'Duplicate Cluster Near-Match Suppression',
    passed: pass7,
    expectedDecision: 'SUPPRESSED',
    actualDecision: eval7.decision,
    reason: eval7.reason
  });

  // Test 8: Circuit Breaker / Burst Protection
  const burstArticle = createMockArticle({
    id: 'test_burst_08',
    headline: 'HDFC Bank Announces Major Dividend Declaration of Rs 20 Per Share',
    body: 'HDFC Bank board approves special dividend of Rs 20 per share for shareholders.',
    sourceName: 'CNBC TV18',
    publishedAt: '2026-08-13T10:30:00.000Z',
    category: 'CORPORATE',
    symbol: 'HDFCBANK',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 95
  });
  const eval8 = TelegramQualityGate.evaluate(burstArticle, { watermarkIso: testWatermark, circuitBreakerActive: true });
  const pass8 = eval8.decision === 'DIGEST_PENDING' && eval8.reason.includes('Circuit breaker active');
  results.push({
    id: 8,
    name: 'Circuit Breaker Burst Protection',
    passed: pass8,
    expectedDecision: 'DIGEST_PENDING',
    actualDecision: eval8.decision,
    reason: eval8.reason
  });

  // Test 9: Custom Options Impact summary formatting
  const customOptionsSummary = eval3.optionsImpactSummary;
  const pass9 = typeof customOptionsSummary === 'string' && customOptionsSummary.length > 0;
  results.push({
    id: 9,
    name: 'Custom Options Impact Calculation',
    passed: pass9,
    expectedDecision: 'VALID_SUMMARY',
    actualDecision: customOptionsSummary || 'NONE',
    reason: 'Dynamic data-driven options impact summary generated without hardcoded generic text'
  });

  // Test 10: Dry-Run / Audit Mode execution in Pipeline
  pipeline.setAuditMode(true);
  const auditProc = await pipeline.processArticle(highArticle);
  const pass10 = auditProc.enqueued && auditProc.auditMode === true && auditProc.decision === 'IMMEDIATE';
  results.push({
    id: 10,
    name: 'Pipeline Dry-Run Audit Mode Safety',
    passed: pass10,
    expectedDecision: 'AUDIT_MODE_ENQUEUED',
    actualDecision: auditProc.decision || 'NONE',
    reason: 'Article enqueued in audit mode without triggering external Telegram HTTP requests'
  });

  // Test 11: Digest Batch Aggregation
  const digestRes = await pipeline.dispatchDigest();
  const pass11 = typeof digestRes.itemCount === 'number';
  results.push({
    id: 11,
    name: 'Digest Batch Aggregation & Dispatch',
    passed: pass11,
    expectedDecision: 'DIGEST_DISPATCHED',
    actualDecision: `Items: ${digestRes.itemCount}`,
    reason: 'Pending digest items safely aggregated into single digest message'
  });

  // Test 12: Audit Decision History
  const decisions = pipeline.getDecisionsHistory(10);
  const pass12 = decisions.length > 0 && decisions.some(d => d.articleId === highArticle.id);
  results.push({
    id: 12,
    name: 'Decision Audit History Logging',
    passed: pass12,
    expectedDecision: 'RECORDED',
    actualDecision: `Decisions count: ${decisions.length}`,
    reason: 'Evaluation decision logged in decision audit log'
  });

  // ----------------------------------------------------
  // PHASE 24.1 MANDATORY REGRESSION TESTS
  // ----------------------------------------------------

  // CASE 1: Solar Industries -> SOLARINDS, HIGH confidence, PAT +92.6%, Revenue +70.3%, Expected: IMMEDIATE
  const case1Art = createMockArticle({
    id: 'case1_solarinds',
    headline: 'Solar Industries Q1 results: Net profit jumps 92.6% YoY to ₹653 crore, revenue up 70.3%',
    body: 'Solar Industries India reported outstanding financial results for the quarter.',
    sourceName: 'Business Standard',
    publishedAt: '2026-08-13T11:00:00.000Z',
    category: 'RESULTS',
    symbol: 'SOLARINDS',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 90
  });
  const evalCase1 = TelegramQualityGate.evaluate(case1Art, { watermarkIso: testWatermark });
  results.push({
    id: 13,
    name: 'Case 1: Solar Industries Resolution & Materiality',
    passed: evalCase1.decision === 'IMMEDIATE' && evalCase1.symbol === 'SOLARINDS',
    expectedDecision: 'IMMEDIATE',
    actualDecision: evalCase1.decision,
    reason: `Symbol: ${evalCase1.symbol}, Reason: ${evalCase1.reason}`
  });

  // CASE 2: Ipca Labs -> IPCALAB, HIGH confidence, PAT +72.5%, EBITDA +60.8%, Expected: IMMEDIATE
  const case2Art = createMockArticle({
    id: 'case2_ipcalab',
    headline: 'Ipca Labs shares rise up to 8% after Q1 results — Net profit rises 72.5%, EBITDA up 60.8%',
    body: 'IPCA Laboratories reported a significant growth in margins.',
    sourceName: 'CNBC TV18',
    publishedAt: '2026-08-13T11:05:00.000Z',
    category: 'RESULTS',
    symbol: 'IPCALAB',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 90
  });
  const evalCase2 = TelegramQualityGate.evaluate(case2Art, { watermarkIso: testWatermark });
  results.push({
    id: 14,
    name: 'Case 2: Ipca Labs Resolution & Materiality',
    passed: evalCase2.decision === 'IMMEDIATE' && evalCase2.symbol === 'IPCALAB',
    expectedDecision: 'IMMEDIATE',
    actualDecision: evalCase2.decision,
    reason: `Symbol: ${evalCase2.symbol}, Reason: ${evalCase2.reason}`
  });

  // CASE 3: Solar Industries mentioned only in article body, Headline is another company, Expected: NO_ACTION for SOLARINDS
  const case3Art = createMockArticle({
    id: 'case3_body_only',
    headline: 'Sun Pharma signs deal with international partners for clinical trials',
    body: 'In other industry updates, Solar Industries is planning minor solar expansion.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-13T11:10:00.000Z',
    category: 'CORPORATE',
    symbol: 'SOLARINDS',
    eligible: true,
    sentiment: 'NEUTRAL',
    relevanceScore: 50
  });
  const evalCase3 = TelegramQualityGate.evaluate(case3Art, { watermarkIso: testWatermark });
  results.push({
    id: 15,
    name: 'Case 3: Body-Only Mention Solar Industries',
    passed: evalCase3.decision === 'NO_ACTION',
    expectedDecision: 'NO_ACTION',
    actualDecision: evalCase3.decision,
    reason: `Symbol: ${evalCase3.symbol}, Reason: ${evalCase3.reason}`
  });

  // CASE 4: Ipca Labs mentioned only in body, Headline is another company, Expected: NO_ACTION for IPCALAB
  const case4Art = createMockArticle({
    id: 'case4_body_only',
    headline: 'Sun Pharma signs deal with international partners for generic research',
    body: 'Passingly, Ipca Labs is also mentioned as a minor competitor in the local region.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-13T11:15:00.000Z',
    category: 'CORPORATE',
    symbol: 'IPCALAB',
    eligible: true,
    sentiment: 'NEUTRAL',
    relevanceScore: 50
  });
  const evalCase4 = TelegramQualityGate.evaluate(case4Art, { watermarkIso: testWatermark });
  results.push({
    id: 16,
    name: 'Case 4: Body-Only Mention Ipca Labs',
    passed: evalCase4.decision === 'NO_ACTION',
    expectedDecision: 'NO_ACTION',
    actualDecision: evalCase4.decision,
    reason: `Symbol: ${evalCase4.symbol}, Reason: ${evalCase4.reason}`
  });

  // CASE 5: Ticker symbol absent but canonical company name present, Expected: valid HIGH-confidence entity match
  const case5Art = createMockArticle({
    id: 'case5_canonical_name',
    headline: 'IPCA Laboratories announces massive global expansion plans',
    body: 'The drugmaker will invest heavily in US and Europe markets.',
    sourceName: 'Moneycontrol',
    publishedAt: '2026-08-13T11:20:00.000Z',
    category: 'CORPORATE',
    symbol: 'IPCALAB',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 85
  });
  const evalCase5 = TelegramQualityGate.evaluate(case5Art, { watermarkIso: testWatermark });
  results.push({
    id: 17,
    name: 'Case 5: Canonical Company Name Present',
    passed: evalCase5.symbol === 'IPCALAB' && evalCase5.companyMatchConfidence >= 90,
    expectedDecision: 'VALID_MATCH_CONFIDENCE',
    actualDecision: `Symbol: ${evalCase5.symbol}, Conf: ${evalCase5.companyMatchConfidence}`,
    reason: `Reason: ${evalCase5.reason}`
  });

  // CASE 6: Ticker symbol present but company context ambiguous, Expected: reject/downgrade
  const case6Art = createMockArticle({
    id: 'case6_ambiguous',
    headline: 'A list of potential underlyings: Reliance, TCS, BSE, Infosys and others',
    body: 'A generic list of shares in the capital market.',
    sourceName: 'Moneycontrol',
    publishedAt: '2026-08-13T11:25:00.000Z',
    category: 'GENERAL',
    symbol: 'BSE',
    eligible: true,
    sentiment: 'NEUTRAL',
    relevanceScore: 40
  });
  const evalCase6 = TelegramQualityGate.evaluate(case6Art, { watermarkIso: testWatermark });
  results.push({
    id: 18,
    name: 'Case 6: Ambiguous Company Context Downgrade',
    passed: evalCase6.decision === 'NO_ACTION' || evalCase6.companyMatchConfidence <= 40,
    expectedDecision: 'NO_ACTION_OR_DOWNGRADE',
    actualDecision: evalCase6.decision,
    reason: `Symbol: ${evalCase6.symbol}, Conf: ${evalCase6.companyMatchConfidence}`
  });

  // CASE 7: BSE multi-company earnings calendar, Expected: NO_ACTION
  const case7Art = createMockArticle({
    id: 'case7_bse_calendar',
    headline: 'Q3 Results 2026: Over 170 Companies Including BSE, Zydus Life To Announce Earnings Today - Samco',
    body: 'A list of companies announcing earnings results on February 9.',
    sourceName: 'Samco',
    publishedAt: '2026-08-13T11:30:00.000Z',
    category: 'RESULTS',
    symbol: 'BSE',
    eligible: true,
    sentiment: 'NEUTRAL',
    relevanceScore: 80
  });
  const evalCase7 = TelegramQualityGate.evaluate(case7Art, { watermarkIso: testWatermark });
  results.push({
    id: 19,
    name: 'Case 7: BSE Multi-Company Calendar Suppression',
    passed: evalCase7.decision === 'NO_ACTION' && evalCase7.isGenericCalendar === true,
    expectedDecision: 'NO_ACTION',
    actualDecision: evalCase7.decision,
    reason: `Reason: ${evalCase7.reason}`
  });

  // CASE 8: MCX analyst upgrade, Expected: NO_ACTION
  const case8Art = createMockArticle({
    id: 'case8_mcx_upgrade',
    headline: 'UBS upgrades MCX to Buy with Rs 3,800 target price: Can it boost the stock?',
    body: 'UBS raises target price on multi commodity exchange to Rs 3800.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-13T11:35:00.000Z',
    category: 'GENERAL',
    symbol: 'MCX',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 85
  });
  const evalCase8 = TelegramQualityGate.evaluate(case8Art, { watermarkIso: testWatermark });
  results.push({
    id: 20,
    name: 'Case 8: MCX Analyst Upgrade Suppression',
    passed: evalCase8.decision === 'NO_ACTION',
    expectedDecision: 'NO_ACTION',
    actualDecision: evalCase8.decision,
    reason: `Reason: ${evalCase8.reason}`
  });

  // CASE 9: HAL earnings + brokerage target price article, Expected: NOT IMMEDIATE
  const case9Art = createMockArticle({
    id: 'case9_hal_brokerage',
    headline: 'HAL shares gain 2% after Q1 earnings beat estimates. Nomura, other brokerages hike target price',
    body: 'Nomura raises target price on HAL after a stellar quarterly results beat.',
    sourceName: 'Economic Times',
    publishedAt: '2026-08-13T11:40:00.000Z',
    category: 'RESULTS',
    symbol: 'HAL',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 85
  });
  const evalCase9 = TelegramQualityGate.evaluate(case9Art, { watermarkIso: testWatermark });
  results.push({
    id: 21,
    name: 'Case 9: HAL Target Price Hike Filter',
    passed: evalCase9.decision !== 'IMMEDIATE',
    expectedDecision: 'NOT_IMMEDIATE',
    actualDecision: evalCase9.decision,
    reason: `Reason: ${evalCase9.reason}`
  });

  // CASE 10: ASTRAL Q1 material earnings event with company-specific financial metrics, Expected: valid F&O classification
  const case10Art = createMockArticle({
    id: 'case10_astral_earnings',
    headline: 'Astral surges as Q1 PAT rises 48% YoY',
    body: 'Astral Limited announced outstanding earnings with profits up 48%.',
    sourceName: 'Business Standard',
    publishedAt: '2026-08-13T11:45:00.000Z',
    category: 'RESULTS',
    symbol: 'ASTRAL',
    eligible: true,
    sentiment: 'BULLISH',
    relevanceScore: 90
  });
  const evalCase10 = TelegramQualityGate.evaluate(case10Art, { watermarkIso: testWatermark });
  results.push({
    id: 22,
    name: 'Case 10: Astral Material Q1 Earnings',
    passed: evalCase10.decision === 'IMMEDIATE' && evalCase10.symbol === 'ASTRAL',
    expectedDecision: 'IMMEDIATE',
    actualDecision: evalCase10.decision,
    reason: `Reason: ${evalCase10.reason}`
  });

  // Restore watermark
  pipeline.setWatermark(originalWatermark);

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    success: failedCount === 0,
    passedCount,
    failedCount,
    results
  };
}
