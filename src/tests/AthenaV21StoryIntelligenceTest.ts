import { StoryIntelligenceEngine } from '../news/NewsEngine/StoryIntelligenceEngine';
import { parseAthenaV106Summary } from '../news/utils/AthenaV10SummaryParser';

export function runAthenaV21Tests() {
  console.log('================================================================');
  console.log('    ATHENA V21 — STORY INTELLIGENCE ENGINE & BLOOMBERG TEST     ');
  console.log('================================================================\n');

  let allPassed = true;

  // TEST 1 — STORY UNDERSTANDING & MAIN EVENT DETECTION
  console.log('--- TEST 1: Main Event Detection & Story Intelligence ---');
  const airtelArticle = {
    title: 'Bharti Airtel Q3 net profit leaps 54% to Rs 2,442 crore; ARPU touches Rs 233',
    publisher: 'Reuters',
    publishedAt: new Date().toISOString(),
    category: 'Telecom',
    cleanText: `Bharti Airtel Limited reported a 54% YoY increase in net profit for Q3 FY25 to Rs 2,442 crore driven by mobile tariff hikes. Revenue grew 18.3% YoY to Rs 37,899 crore compared to Rs 32,042 crore in the year-ago period. EBITDA margin expanded to 52.4% from 51.1%. ARPU expanded to Rs 233 from Rs 211. Executive Vice Chairman Gopal Vittal said that demand remained resilient across mobile and enterprise businesses while ARPU continued improving. Board approved expansion of 5G network coverage. Looking ahead, investor call is scheduled for tomorrow.`
  };

  const storyObj = StoryIntelligenceEngine.analyzeStory(airtelArticle);

  console.log(`  Headline: "${storyObj.headline}"`);
  console.log(`  Main Event Detected: "${storyObj.mainEvent}"`);
  console.log(`  Financial Performance Metrics (${storyObj.financialPerformance.length}):`);
  storyObj.financialPerformance.forEach(m => {
    console.log(`    - ${m.metric}: Current = ${m.current}, Prev = ${m.previous || 'None'}, Change = ${m.change || 'None'}, Dir = ${m.direction}`);
  });

  if (storyObj.mainEvent !== 'Quarterly Results') {
    console.error(`❌ Main event detection failed (Expected 'Quarterly Results', got '${storyObj.mainEvent}')`);
    allPassed = false;
  }

  if (storyObj.financialPerformance.length < 3) {
    console.error('❌ Failed to extract financial performance table metrics');
    allPassed = false;
  }

  // TEST 2 — BUSINESS HIGHLIGHTS (MAX 18 WORDS, NO AI JARGON)
  console.log('\n--- TEST 2: Business Highlights Word Limit & Anti-Slop Check ---');
  console.log(`  Highlights (${storyObj.businessUpdates.length}):`);
  storyObj.businessUpdates.forEach((h, idx) => {
    const wordCount = h.bullet.split(/\s+/).length;
    console.log(`    ${idx + 1}. [${wordCount} w] ${h.bullet}`);
    if (wordCount > 20) {
      console.error(`❌ Highlight exceeds word limit: "${h.bullet}"`);
      allPassed = false;
    }
  });

  // TEST 3 — MANAGEMENT COMMENTARY (NO GENERIC "EXECUTIVE MANAGEMENT")
  console.log('\n--- TEST 3: Management Commentary Check ---');
  if (storyObj.managementCommentary) {
    console.log(`  Executive: ${storyObj.managementCommentary.executiveName} (${storyObj.managementCommentary.designation})`);
    console.log(`  Statement: "${storyObj.managementCommentary.statement}"`);

    if (storyObj.managementCommentary.executiveName === 'Executive Management') {
      console.error('❌ Generic Executive Management name emitted');
      allPassed = false;
    }
  } else {
    console.error('❌ Expected management commentary for Gopal Vittal');
    allPassed = false;
  }

  // TEST 4 — STRATEGIC AI SUMMARY (100-140 WORDS, REUTERS STYLE, NO BANNED CLICHES)
  console.log('\n--- TEST 4: Strategic Summary Reuters Style & Banned Phrases Check ---');
  const summaryText = storyObj.strategicSummaryNarrative;
  const wordCount = summaryText.split(/\s+/).length;
  console.log(`  Summary Word Count: ${wordCount}`);
  console.log(`  Narrative: "${summaryText}"`);

  const bannedPhrases = [
    'operational momentum', 'strategic alignment', 'this demonstrates', 'this highlights',
    'institutional focus', 'overall assessment', 'operational execution', 'business activity remains focused',
    'management guidance update', 'exchange filing disclosures', 'key highlights', 'investor takeaway',
    'why it matters', 'strategic initiatives', 'execution milestones'
  ];

  bannedPhrases.forEach(phrase => {
    if (summaryText.toLowerCase().includes(phrase)) {
      console.error(`❌ Found Phase 10 banned phrase in summary: "${phrase}"`);
      allPassed = false;
    }
  });

  // TEST 5 — FULL ATHENA SUMMARY PARSER INTEGRATION
  console.log('\n--- TEST 5: Parser Integration with Story Intelligence ---');
  const summaryData = parseAthenaV106Summary(airtelArticle);

  if (!summaryData.storyIntelligence) {
    console.error('❌ storyIntelligence object missing from parseAthenaV106Summary output');
    allPassed = false;
  } else {
    console.log(`  storyIntelligence present: Headline="${summaryData.storyIntelligence.headline}", MainEvent="${summaryData.storyIntelligence.mainEvent}"`);
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  ✅ ALL ATHENA V21 STORY INTELLIGENCE TESTS PASSED');
  } else {
    console.log('  ❌ ATHENA V21 TESTS FAILED — SEE ERRORS ABOVE');
  }
  console.log('================================================================\n');

  return allPassed;
}
