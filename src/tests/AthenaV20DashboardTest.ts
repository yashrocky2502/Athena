import { parseAthenaV106Summary } from '../news/utils/AthenaV10SummaryParser';
import { FinancialMetricExtractor } from '../news/NewsEngine/FinancialMetricExtractor';

export function runAthenaV20Tests() {
  console.log('================================================================');
  console.log('       ATHENA V20 — INSTITUTIONAL BRIEFING DASHBOARD TEST       ');
  console.log('================================================================\n');

  let allPassed = true;

  // TEST 1 — TELECOM & EARNINGS METRIC EXTRACTION (BHARTI AIRTEL Q3 EVENT)
  console.log('--- TEST 1: Telecom & Earnings Metric Extraction (Bharti Airtel) ---');
  const airtelArticle = {
    title: 'Bharti Airtel Q3 net profit leaps 54% to Rs 2,442 crore; ARPU touches Rs 233',
    publisher: 'Reuters',
    publishedAt: new Date().toISOString(),
    category: 'Telecom',
    cleanText: `Bharti Airtel Limited reported a 54% YoY increase in net profit for Q3 FY25 to Rs 2,442 crore driven by mobile tariff hikes. Revenue grew 18.3% YoY to Rs 37,899 crore compared to Rs 32,042 crore in the year-ago period. EBITDA margin expanded to 52.4% from 51.1%. ARPU expanded to Rs 233 from Rs 211. Executive Director Gopal Vittal said that mobile business momentum remains strong across India and Africa. Board approved expansion of 5G network coverage. Looking ahead, investor call is scheduled for tomorrow.`
  };

  const airtelBriefing = parseAthenaV106Summary(airtelArticle);

  console.log(`  Article Title: "${airtelBriefing.title}"`);
  console.log(`  Financial Metrics Extracted (${airtelBriefing.financialSnapshot?.length}):`);
  airtelBriefing.financialSnapshot?.forEach(m => {
    console.log(`    - ${m.name}: ${m.currentValue} | ${m.previousValue || 'No Prev'} | Direction: ${m.direction} | Change: ${m.changeValue || 'N/A'}`);
  });

  if (!airtelBriefing.financialSnapshot || airtelBriefing.financialSnapshot.length < 3) {
    console.error('❌ Failed to extract financial snapshot metrics');
    allPassed = false;
  }

  // Check ARPU and PAT extraction
  const arpuMetric = airtelBriefing.financialSnapshot?.find(m => m.name === 'ARPU');
  if (!arpuMetric || !arpuMetric.currentValue.includes('233')) {
    console.error('❌ ARPU metric extraction failed or incorrect value');
    allPassed = false;
  }

  // TEST 2 — BUSINESS HIGHLIGHTS & MANAGEMENT COMMENTARY
  console.log('\n--- TEST 2: Business Highlights & Management Commentary ---');
  console.log(`  Highlights Count: ${airtelBriefing.businessHighlights?.length}`);
  airtelBriefing.businessHighlights?.forEach((h, i) => {
    console.log(`    ${i + 1}. ${h.bullet}`);
  });

  if (!airtelBriefing.businessHighlights || airtelBriefing.businessHighlights.length === 0) {
    console.error('❌ Failed to extract business highlights');
    allPassed = false;
  }

  console.log(`  Management Commentary:`);
  console.log(`    Executive: ${airtelBriefing.managementCommentary?.executiveName} (${airtelBriefing.managementCommentary?.designation})`);
  console.log(`    Statement: "${airtelBriefing.managementCommentary?.statement}"`);

  if (!airtelBriefing.managementCommentary || !airtelBriefing.managementCommentary.executiveName) {
    console.error('❌ Failed to extract management commentary');
    allPassed = false;
  }

  // TEST 3 — WHAT CHANGED & MARKET IMPACT
  console.log('\n--- TEST 3: What Changed & Market Impact ---');
  console.log(`  What Changed Rows (${airtelBriefing.whatChanged?.length}):`);
  airtelBriefing.whatChanged?.forEach(row => {
    console.log(`    - ${row.metricName}: ${row.direction} (${row.statusText})`);
  });

  console.log(`  Market Impact Direction: ${airtelBriefing.v20MarketImpact?.direction}`);
  console.log(`  Overall Assessment: "${airtelBriefing.v20MarketImpact?.overallAssessment}"`);
  console.log(`  Bullish Factors (${airtelBriefing.bullishBearish?.bullish.length}):`, airtelBriefing.bullishBearish?.bullish.join('; '));

  if (!airtelBriefing.v20MarketImpact || airtelBriefing.v20MarketImpact.direction !== 'Bullish') {
    console.error('❌ Market impact direction mismatch (expected Bullish)');
    allPassed = false;
  }

  // TEST 4 — NEXT CATALYSTS & AI SUMMARY NARRATIVE
  console.log('\n--- TEST 4: Next Catalysts & Strategic AI Summary ---');
  console.log(`  Upcoming Catalysts (${airtelBriefing.nextCatalysts?.length}):`);
  airtelBriefing.nextCatalysts?.forEach(c => console.log(`    - ${c.title}: ${c.detail}`));

  console.log(`  Strategic AI Summary Narrative (Words: ${airtelBriefing.aiSummaryNarrative?.split(/\s+/).length}):`);
  console.log(`    "${airtelBriefing.aiSummaryNarrative}"`);

  if (!airtelBriefing.aiSummaryNarrative || airtelBriefing.aiSummaryNarrative.length === 0) {
    console.error('❌ AI Summary narrative missing');
    allPassed = false;
  }

  // TEST 5 — SMART VISIBILITY & EMPTY CARD SUPPRESSION
  console.log('\n--- TEST 5: Smart Visibility Test (Empty Article without Financials) ---');
  const plainArticle = {
    title: 'Company Appoints New Non-Executive Director to Board',
    publisher: 'Exchange Filing',
    publishedAt: new Date().toISOString(),
    category: 'Governance',
    cleanText: `The company announced the appointment of Mr. Rajesh Kumar as an Independent Director on the Board of Directors effective immediately.`
  };

  const plainBriefing = parseAthenaV106Summary(plainArticle);
  console.log(`  Financial Snapshot count on plain article: ${plainBriefing.financialSnapshot?.length} (Expected: 0)`);
  console.log(`  Management Commentary present on plain article: ${Boolean(plainBriefing.managementCommentary)} (Expected: false)`);

  if (plainBriefing.financialSnapshot && plainBriefing.financialSnapshot.length > 0) {
    console.error('❌ Smart Visibility failure: Financial snapshot should be empty for non-financial article');
    allPassed = false;
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  ✅ ALL ATHENA V20 BRIEFING DASHBOARD TESTS PASSED');
  } else {
    console.log('  ❌ ATHENA V20 TESTS FAILED — CHECK ERRORS ABOVE');
  }
  console.log('================================================================\n');

  return allPassed;
}
