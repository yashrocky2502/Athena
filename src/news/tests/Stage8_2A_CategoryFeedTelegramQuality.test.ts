/**
 * ATHENA NEWS ENGINE — STAGE 8.2A
 * Comprehensive Category Feed & High-Signal Telegram Quality Test Suite
 * 
 * 20 Forensic Regression Cases:
 * 1. Jio Prime / Reliance
 * 2. Lalithaa Jewellery IPO
 * 3. Sunshine Pictures IPO
 * 4. Indo-MIM earnings
 * 5. BSE downgrade
 * 6. Paytm block deal
 * 7. Tata Consumer growth announcement
 * 8. Hindalco generic price-update article (Filtered out)
 * 9. LTIMindtree generic price-update article (Filtered out)
 * 10. F&O article with explicit OI (F&O exception passed)
 * 11. F&O article without derivatives metrics (No fabrication)
 * 12. Regulatory announcement (Critical path)
 * 13. Duplicate syndicated article (Suppressed)
 * 14. Empty article (Rejected)
 * 15. Headline-only article (Rejected)
 * 16. AI unavailable (Deterministic fallback)
 * 17. Summary hallucination attempt (Blocked by Quality Gate)
 * 18. Wrong brokerage-to-ticker contamination (Prevented)
 * 19. Multi-company list article (Filtered)
 * 20. Low-impact routine disclosure (Filtered)
 */

import { describe, test, expect } from 'vitest';
import { TelegramAlertEligibilityEngine } from '../telegram/TelegramAlertEligibilityEngine';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runStage8_2ATests(): Promise<{ success: boolean; passedCount: number; totalCount: number }> {
  console.log('================================================================');
  console.log('🚀 RUNNING STAGE 8.2A — CATEGORY FEED & TELEGRAM QUALITY SUITE');
  console.log('================================================================\n');

  TelegramQualityGate.clearHistory();
  const pipeline = TelegramNotificationPipeline.getInstance();
  pipeline.clearHistory();

  let passed = 0;

  // -------------------------------------------------------------
  // Test 1: Jio Prime / Reliance
  // -------------------------------------------------------------
  console.log('Test 1: Jio Prime / Reliance Industries entity attribution & high-signal alert...');
  const res1 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Reliance Jio launches new Jio Prime 5G enterprise plan with nationwide rollout',
    body: 'Reliance Industries telecom arm Jio announced nationwide enterprise 5G services targeting corporate clients. The expansion is expected to generate incremental annual contract value.',
    source: { publisher: 'Economic Times', name: 'ET Telecom', url: 'https://et.com/jio', collectionMethod: 'API' }
  });
  assert(res1.isEligible === true, 'Jio Prime enterprise news must be eligible for alert');
  assert(res1.symbol === 'RELIANCE', 'Symbol must resolve to RELIANCE');
  assert(res1.companyName.includes('Reliance'), 'Company name must identify Reliance Industries');
  assert(res1.direction === 'BULLISH', 'Direction must be BULLISH on expansion');
  passed++;
  console.log('✓ Test 1 Passed\n');

  // -------------------------------------------------------------
  // Test 2: Lalithaa Jewellery IPO
  // -------------------------------------------------------------
  console.log('Test 2: Lalithaa Jewellery IPO classification & unlisted entity safety...');
  const res2 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Lalithaa Jewellery files draft papers with SEBI to raise Rs 1,800 crore via IPO',
    body: 'Regional jewellery retail chain Lalithaa Jewellery Mart has submitted its Draft Red Herring Prospectus (DRHP) to SEBI. The fresh issue proceeds will fund new showroom additions.',
    source: { publisher: 'Moneycontrol', name: 'MC IPO', url: 'https://mc.com/lalithaa', collectionMethod: 'API' }
  });
  assert(res2.isEligible === true, 'Substantial IPO filing must be eligible');
  assert(res2.eventType === 'IPO', 'Event type must be IPO');
  assert(res2.category === 'IPO', 'Category must be IPO');
  assert(res2.symbol === null, 'Unlisted IPO candidate should not be assigned arbitrary listed ticker');
  assert(res2.companyName.includes('Lalithaa Jewellery'), 'Correct entity name identified');
  passed++;
  console.log('✓ Test 2 Passed\n');

  // -------------------------------------------------------------
  // Test 3: Sunshine Pictures IPO
  // -------------------------------------------------------------
  console.log('Test 3: Sunshine Pictures IPO event classification...');
  const res3 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Sunshine Pictures IPO opens for subscription today: GMP, price band, and key details',
    body: 'Film production company Sunshine Pictures opened its initial public offer today with a price band of Rs 150-160 per share. Retail portion was subscribed 1.4x in the morning session.',
    source: { publisher: 'LiveMint', name: 'LiveMint', url: 'https://livemint.com/sunshine', collectionMethod: 'API' }
  });
  assert(res3.eventType === 'IPO', 'Sunshine Pictures headline must classify as IPO');
  assert(res3.companyName.includes('Sunshine Pictures'), 'Resolved Sunshine Pictures entity');
  passed++;
  console.log('✓ Test 3 Passed\n');

  // -------------------------------------------------------------
  // Test 4: Indo-MIM earnings
  // -------------------------------------------------------------
  console.log('Test 4: Indo-MIM earnings classification & financial metric preservation...');
  const res4 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Indo-MIM Q3 net profit jumps 42% to Rs 128 crore on robust aerospace exports',
    body: 'Metal injection molding component maker Indo-MIM reported consolidated revenue of Rs 650 crore, up 28% year-on-year. EBITDA margin expanded 250 bps to 22.4%.',
    source: { publisher: 'Reuters', name: 'Reuters', url: 'https://reuters.com/indo-mim', collectionMethod: 'API' }
  });
  assert(res4.isEligible === true, 'Substantial profit growth must be eligible');
  assert(res4.eventType === 'EARNINGS', 'Event type must be EARNINGS');
  assert(res4.direction === 'BULLISH', 'Direction must be BULLISH on profit surge');
  assert(res4.score >= 65, 'Strong earnings score >= 65');
  passed++;
  console.log('✓ Test 4 Passed\n');

  // -------------------------------------------------------------
  // Test 5: BSE downgrade
  // -------------------------------------------------------------
  console.log('Test 5: BSE downgrade direction and ticker resolution...');
  const res5 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'BSE shares slump 6% after brokerage downgrades rating to Underperform citing derivatives volume cap',
    body: 'Institutional equity research desk slashed its target price on BSE Limited following regulatory shifts. The note forecasts a 12% contraction in transaction revenue.',
    source: { publisher: 'CNBC-TV18', name: 'CNBC', url: 'https://cnbctv18.com/bse', collectionMethod: 'API' }
  });
  assert(res5.symbol === 'BSE', 'Symbol must be BSE');
  assert(res5.direction === 'BEARISH', 'Direction must be BEARISH on downgrade and volume slump');
  assert(res5.observedMarketReaction !== null, 'Observed market reaction captured');
  passed++;
  console.log('✓ Test 5 Passed\n');

  // -------------------------------------------------------------
  // Test 6: Paytm block deal
  // -------------------------------------------------------------
  console.log('Test 6: Paytm block deal classification & entity...');
  const res6 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Paytm shares in focus as 3.2% equity changes hands via block deal on exchanges',
    body: 'Over 2 crore shares of One97 Communications (Paytm) were transacted in early trade at an average floor price of Rs 680 per share.',
    source: { publisher: 'Economic Times', name: 'ET Markets', url: 'https://et.com/paytm', collectionMethod: 'API' }
  });
  assert(res6.symbol === 'PAYTM', 'Symbol must be PAYTM');
  assert(res6.eventType === 'BLOCK_DEAL', 'Event type must be BLOCK_DEAL');
  assert(res6.isEligible === true, 'Major block deal qualifies for Telegram');
  passed++;
  console.log('✓ Test 6 Passed\n');

  // -------------------------------------------------------------
  // Test 7: Tata Consumer growth announcement
  // -------------------------------------------------------------
  console.log('Test 7: Tata Consumer expansion / growth announcement...');
  const res7 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Tata Consumer to acquire food & beverage brand for Rs 5,100 crore to expand pantry portfolio',
    body: 'Tata Consumer Products Limited has entered into a definitive agreement to acquire 100% stake in organic beverage manufacturer. Management projects double-digit margin accretion within 2 years.',
    source: { publisher: 'Business Standard', name: 'BS', url: 'https://bs.com/tataconsum', collectionMethod: 'API' }
  });
  assert(res7.symbol === 'TATACONSUM', 'Symbol must be TATACONSUM');
  assert(res7.eventType === 'M_AND_A', 'Event type must be M_AND_A');
  assert(res7.direction === 'BULLISH', 'Direction is BULLISH on accretive acquisition');
  passed++;
  console.log('✓ Test 7 Passed\n');

  // -------------------------------------------------------------
  // Test 8: Hindalco generic price-update article (Filtered)
  // -------------------------------------------------------------
  console.log('Test 8: Hindalco generic price-update filtered out from Telegram...');
  const res8 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Hindalco Share Price Live Updates: Stock trades flat with minor gains in afternoon trade',
    body: 'Hindalco Industries shares were trading at Rs 620 on Tuesday. Market breadth remained mixed across metal sector counters.',
    source: { publisher: 'Economic Times', name: 'ET Live', url: 'https://et.com/hindalco-live', collectionMethod: 'API' }
  });
  assert(res8.isEligible === false, 'Generic price update article MUST be filtered from Telegram');
  assert(res8.rejectionReason?.includes('low-signal') || res8.rejectionReason?.includes('threshold'), 'Rejection reason states low-signal / routine commentary');
  passed++;
  console.log('✓ Test 8 Passed\n');

  // -------------------------------------------------------------
  // Test 9: LTIMindtree generic price-update article (Filtered)
  // -------------------------------------------------------------
  console.log('Test 9: LTIMindtree generic price-update filtered out from Telegram...');
  const res9 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'LTIMindtree Share Price Today: Track live price movement, volume, and intraday charts',
    body: 'LTIMindtree opened at Rs 5,400 on the NSE. Track real time price and volume statistics.',
    source: { publisher: 'LiveMint', name: 'LiveMint Live', url: 'https://livemint.com/ltim-live', collectionMethod: 'API' }
  });
  assert(res9.isEligible === false, 'Generic tracking article MUST be filtered from Telegram');
  passed++;
  console.log('✓ Test 9 Passed\n');

  // -------------------------------------------------------------
  // Test 10: F&O article with explicit OI (F&O exception passed)
  // -------------------------------------------------------------
  console.log('Test 10: F&O article with explicit OI & PCR metrics...');
  const res10 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Tata Motors derivatives outlook: Open interest surged by 35% as PCR rises to 1.35',
    body: 'Significant put writing was observed at the 950 strike for Tata Motors. Total call open interest unwound while futures basis traded at a 4-point premium.',
    source: { publisher: 'Moneycontrol', name: 'MC FNO', url: 'https://mc.com/tatamotors-fno', collectionMethod: 'API' }
  });
  assert(res10.isEligible === true, 'F&O article with explicit metrics qualifies under F&O exception');
  assert(res10.eventType === 'F_AND_O', 'Event type is F_AND_O');
  assert(res10.fnoEvidence.hasExplicitDerivativesData === true, 'Explicit derivatives data detected');
  assert(res10.fnoEvidence.pcr === '1.35', 'PCR correctly extracted');
  passed++;
  console.log('✓ Test 10 Passed\n');

  // -------------------------------------------------------------
  // Test 11: F&O article without derivatives metrics (No fabrication)
  // -------------------------------------------------------------
  console.log('Test 11: F&O article without derivatives metrics handles data safely...');
  const res11 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'F&O Market Action: Metal counters see active trading interest today',
    body: 'Traders tracked metal counters across the board as global commodity prices showed steady trends.',
    source: { publisher: 'LiveMint', name: 'LiveMint', url: 'https://livemint.com/metal-fno', collectionMethod: 'API' }
  });
  assert(res11.fnoEvidence.hasExplicitDerivativesData === false, 'Must NOT fabricate F&O metrics when absent');
  assert(res11.isEligible === false, 'Cannot qualify on F&O grounds alone without actual derivatives numbers');
  passed++;
  console.log('✓ Test 11 Passed\n');

  // -------------------------------------------------------------
  // Test 12: Regulatory announcement
  // -------------------------------------------------------------
  console.log('Test 12: Regulatory action critical path...');
  const res12 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'RBI imposes penalty of Rs 1.5 crore on financial institution for KYC non-compliance',
    body: 'The Reserve Bank of India found procedural discrepancies during its statutory inspection regarding customer identification processes.',
    source: { publisher: 'RBI Press Release', name: 'RBI', url: 'https://rbi.org.in/press', collectionMethod: 'API' }
  });
  assert(res12.eventType === 'REGULATORY_ACTION', 'Event type is REGULATORY_ACTION');
  assert(res12.category === 'Regulatory', 'Category is Regulatory');
  assert(res12.direction === 'BEARISH', 'Direction is BEARISH on regulatory penalty');
  passed++;
  console.log('✓ Test 12 Passed\n');

  // -------------------------------------------------------------
  // Test 13: Duplicate syndicated article (Suppressed by Quality Gate)
  // -------------------------------------------------------------
  console.log('Test 13: Duplicate syndicated article suppression...');
  TelegramQualityGate.clearHistory();
  const article13 = {
    headline: 'Reliance Jio secures 5G contract with state utility worth Rs 450 crore',
    body: 'Reliance Industries telecom arm was awarded a digital automation smart metering contract.',
    source: { publisher: 'Economic Times', name: 'ET', url: 'https://et.com/ril-order-1', collectionMethod: 'API' as const }
  };
  const res13First = TelegramAlertEligibilityEngine.evaluate(article13);
  const gate1 = TelegramQualityGate.validate(res13First, article13);
  assert(gate1.passed === true, 'First alert must pass Quality Gate');

  // Second identical syndicated alert
  const gate2 = TelegramQualityGate.validate(res13First, article13);
  assert(gate2.passed === false, 'Second identical alert MUST be suppressed by duplicate check');
  assert(gate2.failedChecks.includes('DUPLICATE_ALERT_SUPPRESSED'), 'Duplicate check caught repeat dispatch');
  passed++;
  console.log('✓ Test 13 Passed\n');

  // -------------------------------------------------------------
  // Test 14: Empty article (Rejected)
  // -------------------------------------------------------------
  console.log('Test 14: Empty article rejection...');
  const res14 = TelegramAlertEligibilityEngine.evaluate({
    headline: '',
    body: ''
  });
  assert(res14.isEligible === false, 'Empty article must be marked ineligible');
  passed++;
  console.log('✓ Test 14 Passed\n');

  // -------------------------------------------------------------
  // Test 15: Headline-only article (Rejected)
  // -------------------------------------------------------------
  console.log('Test 15: Headline-only minimal article rejection...');
  const res15 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Stocks in news today',
    body: ''
  });
  assert(res15.isEligible === false, 'Headline-only routine item must be rejected');
  passed++;
  console.log('✓ Test 15 Passed\n');

  // -------------------------------------------------------------
  // Test 16: AI unavailable (Deterministic fallback)
  // -------------------------------------------------------------
  console.log('Test 16: Deterministic fallback operates flawlessly without external AI...');
  const res16 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Tata Motors Q4 net profit jumps 38% to Rs 7,200 crore; announces dividend of Rs 6 per share',
    body: 'Tata Motors reported consolidated revenue growth of 14% driven by JLR order backlog execution and commercial vehicle margin improvements.',
    source: { publisher: 'Moneycontrol', name: 'MC', url: 'https://mc.com/tm-results', collectionMethod: 'API' }
  });
  assert(res16.isEligible === true, 'Deterministic engine generates valid assessment');
  assert(res16.executiveSummary.length > 50, 'Deterministic summary generated');
  assert(res16.whyItMatters.length > 30, 'Why It Matters generated deterministically');
  passed++;
  console.log('✓ Test 16 Passed\n');

  // -------------------------------------------------------------
  // Test 17: Summary hallucination attempt (Blocked by Quality Gate)
  // -------------------------------------------------------------
  console.log('Test 17: Quality Gate blocks unverified/guaranteed profit language...');
  const article16 = {
    headline: 'Tata Motors Q4 net profit jumps 38% to Rs 7,200 crore; announces dividend of Rs 6 per share',
    body: 'Tata Motors reported consolidated revenue growth of 14% driven by JLR order backlog execution and commercial vehicle margin improvements.',
    source: { publisher: 'Moneycontrol', name: 'MC', url: 'https://mc.com/tm-results', collectionMethod: 'API' as const }
  };
  const badAssessment = { ...res16, executiveSummary: 'Buy now for guaranteed 100% profit with zero risk.' };
  const gateBad = TelegramQualityGate.validate(badAssessment, article16);
  assert(gateBad.passed === false, 'Must block non-compliant guaranteed return language');
  assert(gateBad.failedChecks.includes('NON_COMPLIANT_ADVISORY_LANGUAGE'), 'Flagged non-compliant advisory language');
  passed++;
  console.log('✓ Test 17 Passed\n');

  // -------------------------------------------------------------
  // Test 18: Wrong brokerage-to-ticker contamination (Prevented)
  // -------------------------------------------------------------
  console.log('Test 18: Brokerage firm name not confused for traded stock ticker...');
  const res18 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Macquarie downgrades Zomato to Neutral with revised target price of Rs 240',
    body: 'Global brokerage Macquarie noted rising competitive intensity in the quick-commerce segment.',
    source: { publisher: 'LiveMint', name: 'LM', url: 'https://lm.com/zomato-macquarie', collectionMethod: 'API' }
  });
  assert(res18.symbol === 'ZOMATO', 'Target company ZOMATO identified, not MACQUARIE');
  assert(res18.symbol !== 'MACQUARIE', 'MACQUARIE rejected as ticker');
  passed++;
  console.log('✓ Test 18 Passed\n');

  // -------------------------------------------------------------
  // Test 19: Multi-company list article (Filtered)
  // -------------------------------------------------------------
  console.log('Test 19: Multi-company routine market list filtered...');
  const res19 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Stocks to watch today: Reliance, Tata Motors, Infosys, and HDFC Bank in focus',
    body: 'Here is a list of top 10 stocks likely to see action in morning trade across indices.',
    source: { publisher: 'Economic Times', name: 'ET', url: 'https://et.com/stocks-watch', collectionMethod: 'API' }
  });
  assert(res19.isEligible === false, 'Generic multi-stock list is low-signal and filtered');
  passed++;
  console.log('✓ Test 19 Passed\n');

  // -------------------------------------------------------------
  // Test 20: Low-impact routine disclosure (Filtered)
  // -------------------------------------------------------------
  console.log('Test 20: Routine secretarial / share certificate loss disclosure filtered...');
  const res20 = TelegramAlertEligibilityEngine.evaluate({
    headline: 'Infosys files intimation regarding loss of duplicate share certificate with exchanges',
    body: 'Pursuant to Regulation 39(3) of SEBI LODR, company received information regarding misplaced share certificate from shareholder.',
    source: { publisher: 'BSE Corporate Filing', name: 'BSE', url: 'https://bseindia.com/filing', collectionMethod: 'API' }
  });
  assert(res20.isEligible === false, 'Routine certificate disclosure must be filtered');
  assert(res20.eventType === 'ROUTINE_UPDATE', 'Classified as ROUTINE_UPDATE');
  passed++;
  console.log('✓ Test 20 Passed\n');

  // -------------------------------------------------------------
  // Test Telegram Formatter Output Format Check
  // -------------------------------------------------------------
  console.log('Testing Part N Telegram Notification Formatter typography...');
  const formattedTelegram = TraderTelegramFormatter.format(res1);
  assert(formattedTelegram.includes('🚨 <b>ATHENA MARKET ALERT</b>'), 'Contains Athena Market Alert header');
  assert(formattedTelegram.includes('<b>RELIANCE INDUSTRIES LIMITED</b>'), 'Contains company headline');
  assert(formattedTelegram.includes('📰 <b>Executive Summary</b>'), 'Contains Executive Summary section');
  assert(formattedTelegram.includes('📊 <b>Market Intelligence</b>'), 'Contains Market Intelligence section');
  assert(formattedTelegram.includes('Why It Matters') || formattedTelegram.includes('<b>Why It Matters:</b>'), 'Contains Why It Matters section');
  assert(formattedTelegram.includes('What To Monitor') || formattedTelegram.includes('What to Monitor'), 'Contains What to Monitor section');
  assert(formattedTelegram.includes('🔗 <b>Open ATHENA</b>'), 'Contains footer link');

  console.log('================================================================');
  console.log(`🎉 ALL ${passed}/20 STAGE 8.2A REGRESSION TESTS PASSED!`);
  console.log('================================================================\n');

  return { success: true, passedCount: passed, totalCount: 20 };
}

describe('Stage 8.2A: Category Feed & Telegram Quality Suite', () => {
  test('should pass all Stage 8.2A quality tests', async () => {
    const res = await runStage8_2ATests();
    expect(res.success).toBe(true);
  });
});

// Allow direct execution via tsx / node
if (process.argv[1] && process.argv[1].endsWith('Stage8_2A_CategoryFeedTelegramQuality.test.ts')) {
  runStage8_2ATests()
    .then(r => process.exit(r.success ? 0 : 1))
    .catch(err => {
      console.error('Test run failed:', err);
      process.exit(1);
    });
}
