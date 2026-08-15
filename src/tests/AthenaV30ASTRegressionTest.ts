import { DocumentASTEngine } from '../news/NewsEngine/DocumentASTEngine';
import { StoryIntelligenceEngine } from '../news/NewsEngine/StoryIntelligenceEngine';

export function runAthenaV30ASTRegressionTests() {
  console.log('================================================================');
  console.log('ATHENA V30 — DOCUMENT AST RECONSTRUCTION ENGINE REGRESSION TESTS');
  console.log('================================================================\n');

  const testArticles = [
    {
      company: 'Hero MotoCorp',
      title: 'Hero MotoCorp Q1 Net Profit Jumps 29% YoY to Rs. 1,123 Crore, Revenue Rises 12%',
      body: `Hero MotoCorp Ltd. reported a 29% YoY jump in standalone net profit to Rs. 1,123 crore for Q1 FY27. Revenue from operations increased 12% YoY to Rs. 10,144 crore.

EBITDA margin expanded by 160 bps to 14.4% driven by cost optimization and favorable product mix. Premium motorcycle sales recorded 45% growth.

"Our focus on premiumization and EV segment expansion under VIDA brand continues to drive top-line and margin performance," stated the Chief Executive Officer.

Goldman Sachs maintained a 'BUY' rating on Hero MotoCorp with a target price of Rs. 5,800.`
    },
    {
      company: 'MCX (Multi Commodity Exchange)',
      title: 'MCX Q1 FY27 Net Profit Rises 45% YoY to Rs. 120 Crore, Revenue Jumps 32%',
      body: `Multi Commodity Exchange of India Ltd. (MCX) reported a 45% YoY surge in net profit to Rs. 120 crore for Q1 FY27. Revenue from operations jumped 32% YoY to Rs. 210 crore.

EBITDA margin expanded by 420 bps to 48.5%. The surge was driven by record trading volumes in gold and crude oil options contracts.

"We continue to experience robust participation across energy and bullion derivatives," said MCX Managing Director & CEO. "Our technological upgrade on the new trading software has significantly enhanced operational efficiency."

Nomura Research maintained a 'BUY' rating on MCX with a target price of Rs. 4,200, citing strong option volume growth and operating leverage.`
    },
    {
      company: 'LIC (Life Insurance Corporation)',
      title: 'LIC Q1 Net Profit Jumps 10% YoY to Rs. 10,461 Crore, AUM Crosses Rs. 53 Lakh Crore',
      body: `Life Insurance Corporation of India (LIC) reported a 10% YoY growth in standalone net profit to Rs. 10,461 crore for Q1 FY27. Total AUM surged 15% YoY to cross Rs. 53.5 lakh crore.

Net premium income rose 7.5% YoY to Rs. 1.12 lakh crore. Individual first-year premium growth accelerated across key product categories.

"Our ongoing diversification into high-margin non-participating products is driving sustainable value creation," stated the Chairman of LIC.

Morgan Stanley maintained an 'Equal-weight' rating on LIC with a price target of Rs. 1,150.`
    },
    {
      company: 'Britannia Industries',
      title: 'Britannia Q1 Net Profit Rises 14.5% YoY to Rs. 580 Crore, Revenue Up 10%',
      body: `Britannia Industries Ltd. reported a 14.5% YoY increase in consolidated net profit to Rs. 580 crore for Q1 FY27. Consolidated revenue from operations grew 10% YoY to Rs. 4,520 crore.

EBITDA margin expanded by 110 bps to 18.2% on soft input costs. Distribution reach expanded to over 2.8 million direct outlets.

"Volume growth across biscuits and bakery portfolio remained resilient despite cost pressures," noted the Managing Director.

Kotak Institutional Equities retained an 'Add' recommendation on Britannia Industries.`
    },
    {
      company: 'Trent Limited',
      title: 'Trent Q1 Revenue Surges 56% YoY to Rs. 4,100 Crore, Net Profit Jumps 2.2x',
      body: `Trent Ltd. recorded a massive 56% YoY jump in revenue from operations to Rs. 4,100 crore for Q1 FY27. Standalone net profit surged 2.2-fold to Rs. 392 crore.

Zudio store footprint expanded by adding 38 new stores during the quarter. Westside recorded strong same-store-sales growth.

"Our fashion concepts continue to resonate deeply with Indian consumers across metropolitan and tier-2 markets," stated the Executive Chairman.

Citi Research maintained a 'BUY' rating on Trent with an upgraded target price of Rs. 6,800.`
    },
    {
      company: 'Kalyan Jewellers',
      title: 'Kalyan Jewellers Reports 34% Revenue Growth in Q1 FY27, Expands Store Network',
      body: `Kalyan Jewellers India Ltd. recorded a 34% YoY increase in consolidated revenue for Q1 FY27, driven by strong same-store-sales growth across India and the Middle East.

Net profit grew 28% YoY to Rs. 182 crore. The company added 24 new showrooms during the quarter, taking its total store footprint to 290 locations.

"Customer momentum during festive and wedding seasons remains strong," highlighted the Executive Director. "We are on track to achieve our annual showroom expansion guidance."

Motilal Oswal maintained a 'BUY' rating on the stock with a revised target price.`
    },
    {
      company: 'Bharti Airtel',
      title: 'Bharti Airtel Q1 FY27 Net Profit Rises 2.5x to Rs. 4,160 Crore, ARPU Hits Rs. 211',
      body: `Bharti Airtel Ltd. reported a 2.5-fold increase in consolidated net profit to Rs. 4,160 crore for Q1 FY27. Consolidated revenue rose 12.8% YoY to Rs. 38,500 crore.

Average Revenue Per User (ARPU) for India mobile services improved to Rs. 211 from Rs. 200 in the previous quarter. 4G and 5G subscriber additions totaled 6.7 million.

"Our premiumization strategy and disciplined capital allocation continue to deliver industry-leading ARPU growth," said the Chief Executive Officer.

ICICI Securities maintained a 'BUY' rating on Bharti Airtel with a target price of Rs. 1,650.`
    },
    {
      company: 'Muthoot Microfin',
      title: 'Muthoot Microfin Q1 Net Profit Rises 24% YoY to Rs. 142 Crore, AUM Grows 27%',
      body: `Muthoot Microfin Ltd. reported a 24% YoY increase in net profit to Rs. 142 crore for Q1 FY27. Total Assets Under Management (AUM) expanded 27% YoY to Rs. 12,400 crore.

Net Interest Income (NII) grew 22% YoY to Rs. 390 crore. Collection efficiency stood firm at 98.4% across rural branch networks.

"Microfinance demand remains strong supported by rural income growth and steady repayment discipline," noted the Chief Executive Officer.

Nuvama Equities retained a 'BUY' rating on Muthoot Microfin.`
    },
    {
      company: 'PNB Housing Finance',
      title: 'PNB Housing Q4 FY26 PAT Up 22% YoY at Rs. 438 Crore, Asset Quality Improves',
      body: `PNB Housing Finance Ltd. announced a 22% YoY growth in standalone Profit After Tax (PAT) at Rs. 438 crore for Q4 FY26. Net Interest Income (NII) expanded 18% YoY to Rs. 685 crore.

Gross Non-Performing Assets (GNPA) improved by 65 bps to 1.35%. Retail disbursements grew 28% YoY to Rs. 5,420 crore during the quarter.

"Our relentless focus on retail prime housing and affordable housing segments is yielding strong asset quality and profitability," stated the Chief Financial Officer.

Jefferies retained a 'BUY' recommendation on PNB Housing with a target price of Rs. 980.`
    },
    {
      company: 'BSE Limited',
      title: 'BSE Q1 Revenue Surges 85% YoY to Rs. 620 Crore on Record Equity Derivatives Volume',
      body: `BSE Limited reported an 85% YoY increase in consolidated revenue to Rs. 620 crore for Q1 FY27. Net profit stood at Rs. 265 crore, up 68% compared to the previous year.

Operating EBITDA margin improved to 54.2%. The index provider saw average daily turnover (ADTV) in equity options touch new high records.

"The expansion of our derivatives ecosystem and market share gain in sensex options contracts continue to propel performance," noted the Managing Director.

Morgan Stanley re-iterated an 'Overweight' stance with a price target of Rs. 3,500.`
    }
  ];

  let totalPassed = 0;

  testArticles.forEach((art, idx) => {
    console.log(`[TEST ${idx + 1}/${testArticles.length}] Testing ${art.company}...`);

    // 1. AST Construction
    const ast = DocumentASTEngine.buildAST({
      headline: art.title,
      rawBody: art.body
    });

    // 2. Full Pipeline Processing
    const story = StoryIntelligenceEngine.analyzeStory({
      title: art.title,
      cleanText: art.body
    });

    const isASTValid = ast.confidence >= 80 && ast.body.paragraphs.length > 0;
    const isNarrativeValid = story.qualityPassed && story.strategicSummaryNarrative.length > 50 && !story.strategicSummaryNarrative.includes('Unable to generate');
    const isMetricsExtracted = story.verifiedMetrics.length > 0;
    const isQuotesExtracted = Boolean(story.managementCommentary || story.analystCommentary);

    console.log(`  ✓ Parser Confidence: ${ast.confidence}/100`);
    console.log(`  ✓ AST Paragraphs: ${ast.body.paragraphs.length}`);
    console.log(`  ✓ AST Quotes: ${ast.quotes.length}`);
    console.log(`  ✓ Verified Metrics: ${story.verifiedMetrics.length}`);
    console.log(`  ✓ Quality Gate Passed: ${story.qualityPassed}`);
    console.log(`  ✓ Strategic Summary Length: ${story.strategicSummaryNarrative.length} chars`);

    if (isASTValid && isNarrativeValid && isMetricsExtracted && isQuotesExtracted) {
      console.log(`  PASS: ${art.company}\n`);
      totalPassed++;
    } else {
      console.error(`  FAIL: ${art.company}`);
      console.error(`  Failure Reasons:`, story.debugReport?.failureReasons || ['Unknown failure']);
      console.error(`\n`);
    }
  });

  console.log(`================================================================`);
  console.log(`ATHENA V30 REGRESSION TEST SUMMARY: ${totalPassed}/${testArticles.length} PASSED`);
  console.log(`================================================================`);

  return totalPassed === testArticles.length;
}

// Execute if run directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('AthenaV30ASTRegressionTest')) {
  runAthenaV30ASTRegressionTests();
}
