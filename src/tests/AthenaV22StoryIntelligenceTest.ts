import { StoryIntelligenceEngine } from '../news/NewsEngine/StoryIntelligenceEngine';

export function runAthenaV23Tests() {
  console.log('================================================================');
  console.log('    ATHENA V23 — INSTITUTIONAL INTELLIGENCE ENGINE TEST        ');
  console.log('================================================================\n');

  let allPassed = true;

  // TEST 1 — MCX FINANCIAL SNAPSHOT & METRIC POPULATION
  console.log('--- TEST 1: Financial Snapshot Extraction & Priority ---');
  const mcxArticle = {
    title: 'MCX Q1 PAT leaps 88% YoY to Rs 413 crore; Revenue jumps to Rs 702 crore',
    publisher: 'Reuters',
    publishedAt: new Date().toISOString(),
    category: 'Exchange',
    cleanText: `Q1 financial performance Multi Commodity Exchange of India (MCX) reported an 88% YoY surge in net profit to Rs 413 crore for Q1 FY26 compared to Rs 373 crore in the year-ago period. Revenue grew 88% YoY to Rs 702 crore against Rs 373 crore. EBITDA margin improved to 72% from 65%. Trading volume across commodity derivatives expanded 45% YoY. What should investors do? Managing Director & CEO Praveena Rai noted that strategic options growth and technology migration drove record profitability. Market position and strategic outlook Brokerage firm Motilal Oswal retained Buy rating with target price of Rs 7,200. Board approved capex of Rs 150 crore for technology infrastructure.`
  };

  const storyObj = StoryIntelligenceEngine.analyzeStory(mcxArticle);

  console.log(`  Headline: "${storyObj.headline}"`);
  console.log(`  Main Event: "${storyObj.mainEvent}"`);
  console.log(`  Financial Metrics Extracted (${storyObj.financialPerformance.length}):`);
  
  storyObj.financialPerformance.forEach(m => {
    console.log(`    - ${m.metric}: Current = ${m.current}, Prev = ${m.previous || '—'}, Change = ${m.change || 'None'}, Dir = ${m.direction}, Comp = ${m.comparison || 'YoY'}`);
  });

  if (storyObj.financialPerformance.length < 3) {
    console.error('❌ Failed to extract at least 3 valid financial metrics');
    allPassed = false;
  }

  // Verify no partially extracted/empty rows
  const hasEmptyOrBrokenRows = storyObj.financialPerformance.some(m => !m.current || m.current === ',' || m.current === '—' || !/\d/.test(m.current));
  if (hasEmptyOrBrokenRows) {
    console.error('❌ Found empty or broken row in financial snapshot');
    allPassed = false;
  } else {
    console.log('  ✓ Zero empty/broken metric rows verified');
  }

  // TEST 2 — BUSINESS HIGHLIGHTS REWRITER (MAX 18 WORDS, SINGLE FACT, NO HEADINGS)
  console.log('\n--- TEST 2: Business Highlights Rewriter & Single Fact Rules ---');
  console.log(`  Highlights Count: ${storyObj.businessUpdates.length}`);
  storyObj.businessUpdates.forEach((h, idx) => {
    const wordCount = h.bullet.split(/\s+/).filter(Boolean).length;
    console.log(`    ${idx + 1}. [${wordCount} w] ${h.bullet}`);

    if (wordCount > 18) {
      console.error(`❌ Highlight exceeds 18 word limit: "${h.bullet}"`);
      allPassed = false;
    }

    if (/(Q[1-4]\s*financial\s*performance|What\s*should\s*investors\s*do|Highlights|Market\s*position)/i.test(h.bullet)) {
      console.error(`❌ Found heading artifact or OCR remnant in highlight: "${h.bullet}"`);
      allPassed = false;
    }
  });

  // TEST 3 — EXECUTIVE CLASSIFICATION ENGINE (MANAGEMENT VS ANALYST)
  console.log('\n--- TEST 3: Executive Classification & Analyst Separation ---');
  if (storyObj.managementCommentary) {
    console.log(`  Corporate Executive: ${storyObj.managementCommentary.executiveName} (${storyObj.managementCommentary.designation})`);
    console.log(`  Statement: "${storyObj.managementCommentary.statement}"`);

    if (storyObj.managementCommentary.executiveName.includes('Motilal Oswal')) {
      console.error('❌ Broker/Analyst misclassified as Corporate Executive!');
      allPassed = false;
    }
  } else {
    console.error('❌ Expected management commentary for Praveena Rai');
    allPassed = false;
  }

  if (storyObj.analystCommentary) {
    console.log(`  Analyst/Broker Firm: ${storyObj.analystCommentary.analystFirm}`);
    console.log(`  Analyst Statement: "${storyObj.analystCommentary.statement}"`);
  } else {
    console.error('❌ Expected analyst commentary for Motilal Oswal');
    allPassed = false;
  }

  // TEST 4 — WHAT CHANGED ENGINE
  console.log('\n--- TEST 4: What Changed Engine ---');
  storyObj.whatChanged.forEach(wc => {
    console.log(`    - ${wc.metric}: ${wc.direction === 'UP' ? '▲' : '▼'} ${wc.statusText}`);
    if (wc.statusText === 'Unchanged') {
      console.error(`❌ "Unchanged" status emitted for ${wc.metric}`);
      allPassed = false;
    }
  });

  // TEST 5 — REUTERS NARRATIVE ENGINE (220 - 300 WORDS)
  console.log('\n--- TEST 5: Reuters Narrative Engine (220 - 300 words) ---');
  const narrative = storyObj.strategicSummaryNarrative;
  const wordCount = narrative.split(/\s+/).filter(Boolean).length;
  console.log(`  Narrative Word Count: ${wordCount}`);
  console.log(`  Narrative:\n${narrative}\n`);

  if (wordCount < 180 || wordCount > 350) {
    console.error(`❌ Narrative word count (${wordCount}) out of range`);
    allPassed = false;
  } else {
    console.log('  ✓ Narrative word count strictly within target range');
  }

  // TEST 6 — QUALITY GATE REPORT
  console.log('\n--- TEST 6: Quality Gate Report ---');
  console.log(`  Quality Passed: ${storyObj.qualityPassed}`);
  console.log(`  Quality Report:`, storyObj.qualityReport);

  if (!storyObj.qualityPassed) {
    console.error('❌ Quality Gate failed validation');
    allPassed = false;
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  ✅ ALL ATHENA V23 TESTS PASSED PERFECTLY');
  } else {
    console.log('  ❌ ATHENA V23 TESTS FAILED — SEE ERRORS ABOVE');
  }
  console.log('================================================================\n');

  runAthenaV27DebugTests();
  runAthenaV28QualityGateTests();

  return allPassed;
}

export function runAthenaV28QualityGateTests() {
  console.log('================================================================');
  console.log('    ATHENA V28 — QUALITY GATE ENFORCEMENT & PARSER FIX TEST     ');
  console.log('================================================================\n');

  const corruptArticle = {
    title: 'Multi Commodity Exchange Q1 Revenue up 88% YoY',
    publisher: 'Reuters',
    publishedAt: new Date().toISOString(),
    category: 'Exchange',
    cleanText: `What should investors do? Read More. Share Price stood. 's revenue however, the pressure on.`
  };

  const storyObj = StoryIntelligenceEngine.analyzeStory(corruptArticle);
  const debugReport = storyObj.debugReport;

  console.log('--- TEST 1: CORRUPT ARTICLE QUALITY GATE ENFORCEMENT ---');
  console.log(`  Quality Passed: ${storyObj.qualityPassed} (Expected: false)`);
  console.log(`  Publishing Decision: ${debugReport?.pipelineHealth.publishingDecision} (Expected: FAIL)`);
  console.log(`  Story Summary: "${storyObj.storySummary}"`);
  console.log(`  Completeness Score: ${storyObj.qualityReport?.completenessScore} (Expected: 0)`);
  console.log(`  Failure Reasons Count: ${debugReport?.failureReasons.length}`);
  if (debugReport?.failureReasons) {
    debugReport.failureReasons.forEach((r, idx) => {
      console.log(`    ${idx + 1}. ${r}`);
    });
  }

  const cleanArticle = {
    title: 'MCX Q1 Net Profit leaps 88% YoY to Rs 413 crore; Revenue reaches Rs 702 crore',
    publisher: 'Reuters',
    publishedAt: new Date().toISOString(),
    category: 'Exchange',
    cleanText: `Multi Commodity Exchange of India (MCX) reported a strong financial performance for the first quarter of FY26. Net profit surged 88% year-on-year to Rs 413 crore compared to Rs 373 crore in the corresponding period of the previous fiscal year. Total revenue from operations expanded 88% year-on-year to Rs 702 crore against Rs 373 crore in Q1 FY25. Operating EBITDA jumped 98% year-on-year to Rs 544 crore, with EBITDA margins expanding to 72% from 65% in the prior-year period. Trading volumes across commodity derivative segments increased 45% year-on-year, driven by heightened activity in energy and bullion contracts. Managing Director and Chief Executive Officer Praveena Rai stated that technology migration and expansion in options contracts supported operational efficiency. Brokerage firm Motilal Oswal maintained a Buy rating with a target price of Rs 7,200, highlighting robust trading volumes and platform scalability. The board approved a capital expenditure plan of Rs 150 crore to upgrade technology infrastructure.`
  };

  const cleanStoryObj = StoryIntelligenceEngine.analyzeStory(cleanArticle);
  const cleanDebugReport = cleanStoryObj.debugReport;

  console.log('\n--- TEST 2: VALID ARTICLE QUALITY GATE ENFORCEMENT ---');
  console.log(`  Quality Passed: ${cleanStoryObj.qualityPassed} (Expected: true)`);
  console.log(`  Publishing Decision: ${cleanDebugReport?.pipelineHealth.publishingDecision} (Expected: PUBLISH)`);
  console.log(`  Completeness Score: ${cleanStoryObj.qualityReport?.completenessScore} (Expected: 100)`);
  console.log(`  Token Loss Logs: ${cleanDebugReport?.tokenLossLogs.length} (Expected: 0)`);
  console.log(`  Regeneration Count: ${cleanDebugReport?.regenerationCount}`);
  console.log('================================================================\n');
}

export function runAthenaV27DebugTests() {
  console.log('================================================================');
  console.log('    ATHENA V27 — PIPELINE DEBUG & VALIDATION MODE TEST          ');
  console.log('================================================================\n');

  const dirtyArticle = {
    title: 'MCX Q1 PAT leaps 88% YoY to Rs 413 crore; Revenue jumps to Rs 702 crore',
    publisher: 'Reuters',
    publishedAt: new Date().toISOString(),
    category: 'Exchange',
    cleanText: `Q1 financial performance Multi Commodity Exchange of India (MCX) reported an 88% YoY surge in net profit to Rs 413 crore for Q1 FY26 compared to Rs 373 crore in the year-ago period. Revenue grew 88% YoY to Rs 702 crore against Rs 373 crore. EBITDA margin improved to 72% from 65%. Trading volume across commodity derivatives expanded 45% YoY. What should investors do? Managing Director & CEO Praveena Rai noted that strategic options growth and technology migration drove record profitability. Market position and strategic outlook Brokerage firm Motilal Oswal retained Buy rating with target price of Rs 7,200. Board approved capex of Rs 150 crore for technology infrastructure. Read More. Share Price stood. 's revenue however, the pressure on.`
  };

  const storyObj = StoryIntelligenceEngine.analyzeStory(dirtyArticle);
  const debugReport = storyObj.debugReport;

  console.log('--- STEP 1: PIPELINE TRACE ---');
  console.log(`  Raw Article Length: ${debugReport?.trace.rawArticle.length} chars`);
  console.log(`  Cleaned Article Length: ${debugReport?.trace.cleanedArticle.length} chars`);
  console.log(`  Valid Sentence Count: ${debugReport?.trace.sentenceArray.length}`);
  console.log(`  Document Blocks: Lead=${debugReport?.trace.blocks.lead.length}, Fin=${debugReport?.trace.blocks.financial.length}, Biz=${debugReport?.trace.blocks.business.length}, Quote=${debugReport?.trace.blocks.quote.length}, Analyst=${debugReport?.trace.blocks.analyst.length}, Outlook=${debugReport?.trace.blocks.outlook.length}`);
  console.log(`  Extracted Metrics Count: ${debugReport?.trace.metricsJson.length}`);
  console.log(`  Extracted Business Events: ${debugReport?.trace.businessEventsJson.length}`);

  console.log('\n--- STEP 2: STAGE VALIDATION SUMMARY ---');
  if (debugReport?.stageValidations) {
    Object.values(debugReport.stageValidations).forEach(sv => {
      console.log(`  [${sv.status}] ${sv.stageName}: ${sv.validations.join(', ')}`);
    });
  }

  console.log('\n--- STEP 3: INVALID SENTENCE DETECTION LOGS ---');
  if (debugReport?.invalidSentences && debugReport.invalidSentences.length > 0) {
    debugReport.invalidSentences.forEach((inv, idx) => {
      console.log(`    ${idx + 1}. INVALID SENTENCE | Stage: ${inv.stage} | Reason: ${inv.reason} | Text: "${inv.originalText}"`);
    });
  } else {
    console.log('  No invalid sentences found.');
  }

  console.log('\n--- STEP 4: METRIC VALIDATION ---');
  debugReport?.metricValidations.forEach(mv => {
    console.log(`    - Metric: ${mv.metric} | Current: ${mv.current} | Prev: ${mv.previous || '—'} | Change: ${mv.change || 'None'} | Comp: ${mv.comparison || 'YoY'} | Valid: ${mv.isValid}`);
  });

  console.log('\n--- STEP 5: QUOTE VALIDATION ---');
  console.log(`    Speaker: ${debugReport?.quoteValidation.speaker || 'N/A'}`);
  console.log(`    Designation: ${debugReport?.quoteValidation.designation || 'N/A'}`);
  console.log(`    Quote: "${debugReport?.quoteValidation.exactQuote || 'N/A'}"`);
  console.log(`    Valid: ${debugReport?.quoteValidation.isValid}`);

  console.log('\n--- STEP 6: BUSINESS EVENT VALIDATION ---');
  debugReport?.businessEvents.forEach((be, idx) => {
    console.log(`    ${idx + 1}. Event Category: ${be.category} | Copied Paragraph: ${be.isCopiedParagraph}`);
    console.log(`       Desc: "${be.description}"`);
  });

  console.log('\n--- STEP 7: NARRATIVE VALIDATION ---');
  console.log(`    Headline Appears Once: ${debugReport?.narrativeCheck.headlineAppearsOnce} (Count: ${debugReport?.narrativeCheck.headlineCount})`);
  console.log(`    No OCR Fragments: ${debugReport?.narrativeCheck.noOCRFragments}`);
  console.log(`    No Incomplete Sentences: ${debugReport?.narrativeCheck.noIncompleteSentences}`);
  console.log(`    Word Count Valid: ${debugReport?.narrativeCheck.wordCountValid} (${debugReport?.narrativeCheck.wordCount} words)`);

  console.log('\n--- STEP 8: FINAL PIPELINE HEALTH REPORT ---');
  console.log(`  Pipeline Health:`, debugReport?.pipelineHealth);
  console.log(`  Overall Pipeline Status: ${debugReport?.overallStatus}`);
  console.log('================================================================\n');
}
