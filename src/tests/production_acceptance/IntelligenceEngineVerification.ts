import { IntelligenceEngine } from '../../news/NewsEngine/IntelligenceEngine';
import { InstitutionalTelegramFormatter } from '../../news/NewsEngine/InstitutionalTelegramFormatter';
import { SummaryService } from '../../news/NewsEngine/SummaryService';

interface TestArticle {
  name: string;
  category: string;
  headline: string;
  publisher: string;
  body: string;
  symbol?: string;
  expectedImpactRange: [number, number];
  expectedConfidenceRange: [number, number];
  expectedUrgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expectedParticipants: string[];
}

const testCases: TestArticle[] = [
  {
    name: 'Quarterly Results (Large Cap)',
    category: 'Earnings',
    headline: 'Reliance Industries Q1 Net Profit Jumps 18% YoY to ₹19,500 Crore on Strong Retail Growth',
    publisher: 'Economic Times',
    body: 'Reliance Industries reported a consolidated net profit of ₹19,500 crore for Q1, up 18% compared to the previous fiscal year. Revenue from operations increased to ₹2,35,000 crore driven by retail and digital services.',
    symbol: 'RELIANCE',
    expectedImpactRange: [85, 95],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Intraday Traders', 'Swing Traders', 'Long-term Investors']
  },
  {
    name: 'RBI Policy',
    category: 'Monetary Policy',
    headline: 'RBI Policy: Repo Rate Kept Unchanged at 6.50% with Neutral Stance',
    publisher: 'RBI',
    body: 'The Monetary Policy Committee of the Reserve Bank of India decided to retain the Repo Rate at 6.50% while maintaining an emphasis on inflation targeting and systemic liquidity balance.',
    expectedImpactRange: [95, 100],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'CRITICAL',
    expectedParticipants: ['Intraday Traders', 'Options Traders', 'Futures Traders']
  },
  {
    name: 'FED Policy',
    category: 'Macro',
    headline: 'US Fed Keeps Benchmark Interest Rates Steady as US Inflation Cools',
    publisher: 'Reuters',
    body: 'The US Federal Open Market Committee maintained its target federal funds rate range, citing moderating US inflation and labor market resilience.',
    expectedImpactRange: [95, 98],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'CRITICAL',
    expectedParticipants: ['Futures Traders', 'Options Traders']
  },
  {
    name: 'ECB Policy',
    category: 'Macro',
    headline: 'ECB Holds Deposit Rate Steady in Monetary Policy Update',
    publisher: 'Bloomberg',
    body: 'European Central Bank maintained key benchmark rates in line with market consensus while noting persistent core services price pressures.',
    expectedImpactRange: [90, 96],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Currency Traders', 'Futures Traders']
  },
  {
    name: 'Dividend',
    category: 'Corporate Action',
    headline: 'TCS Board Declares Special Dividend of ₹28 Per Share',
    publisher: 'NSE',
    body: 'Tata Consultancy Services announced a special dividend of ₹28 per share for equity shareholders, payable on August 25.',
    symbol: 'TCS',
    expectedImpactRange: [30, 50],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'MEDIUM',
    expectedParticipants: ['Long-term Investors', 'Mutual Fund Investors']
  },
  {
    name: 'Buyback',
    category: 'Corporate Action',
    headline: 'Infosys Announces Share Buyback Worth ₹9,300 Crore at ₹1,850 Premium',
    publisher: 'BSE',
    body: 'Infosys board approved a share buyback plan of up to ₹9,300 crore through tender offer route at a price of ₹1,850 per share.',
    symbol: 'INFY',
    expectedImpactRange: [75, 88],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Long-term Investors', 'Swing Traders']
  },
  {
    name: 'IPO',
    category: 'IPO',
    headline: 'Hyundai Motor India IPO Opens: Issue Size ₹27,870 Crore, Issue Price ₹1,960',
    publisher: 'Moneycontrol',
    body: 'The initial public offering of Hyundai Motor India opened for subscription today with an issue size of ₹27,870 crore and price band of ₹1,865-₹1,960.',
    expectedImpactRange: [65, 85],
    expectedConfidenceRange: [85, 95],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Long-term Investors', 'Swing Traders']
  },
  {
    name: 'Merger',
    category: 'Corporate Action',
    headline: 'HDFC Bank Completes Strategic Merger Integration across Branch Network',
    publisher: 'Economic Times',
    body: 'HDFC Bank announced full operational integration following its merger, streamlining capital reserves and mortgage loan origination.',
    symbol: 'HDFCBANK',
    expectedImpactRange: [80, 90],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Long-term Investors', 'Mutual Fund Investors']
  },
  {
    name: 'Acquisition',
    category: 'Corporate Action',
    headline: 'Bharti Airtel Acquires Strategic Stake in Regional Telecom Infra for ₹1,200 Crore',
    publisher: 'Moneycontrol',
    body: 'Bharti Airtel acquired a controlling stake in regional telecom infrastructure provider for ₹1,200 crore to expand 5G network footprint.',
    symbol: 'BHARTIARTL',
    expectedImpactRange: [78, 88],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Long-term Investors', 'Swing Traders']
  },
  {
    name: 'Board Meeting',
    category: 'Corporate Action',
    headline: 'ITC Schedules Board Meeting on August 12 to Consider Fund Raising Plan',
    publisher: 'BSE',
    body: 'ITC Ltd notified stock exchanges regarding an upcoming board meeting to evaluate strategic expansion proposals and dividend policy.',
    symbol: 'ITC',
    expectedImpactRange: [20, 45],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'LOW',
    expectedParticipants: ['Long-term Investors']
  },
  {
    name: 'Commodity News (Gold)',
    category: 'Commodities',
    headline: 'Gold Prices Surge to Record Highs near $2,450 on Safe Haven Buying',
    publisher: 'Reuters',
    body: 'Spot gold reached record highs as geopolitical tensions and central bank accumulation boosted demand for precious metals.',
    expectedImpactRange: [70, 85],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Commodity Traders', 'Futures Traders']
  },
  {
    name: 'Commodity News (Crude Oil)',
    category: 'Commodities',
    headline: 'Crude Oil Slips 3% as OPEC+ Outlines Supply Phase-Out Strategy',
    publisher: 'Bloomberg',
    body: 'Brent crude futures dropped below $78 per barrel following OPEC decisions regarding gradual restoration of voluntary production cuts.',
    expectedImpactRange: [70, 85],
    expectedConfidenceRange: [90, 98],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Commodity Traders', 'Futures Traders']
  },
  {
    name: 'Crypto',
    category: 'Crypto',
    headline: 'Bitcoin Rallies Above $68,000 as Institutional Spot ETF Inflows Double',
    publisher: 'CoinDesk',
    body: 'Bitcoin surged past $68,000 supported by net daily inflows into US spot bitcoin ETFs exceeding $500 million.',
    expectedImpactRange: [70, 85],
    expectedConfidenceRange: [80, 90],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Crypto Traders', 'Swing Traders']
  },
  {
    name: 'Government Policy',
    category: 'Policy',
    headline: 'Government Announces ₹20,000 Crore Incentive Scheme for Domestic Battery Manufacturing',
    publisher: 'Government',
    body: 'Union Cabinet approved a new PLI scheme allocation of ₹20,000 crore to foster advanced chemistry cell manufacturing.',
    expectedImpactRange: [80, 92],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Long-term Investors', 'Swing Traders']
  },
  {
    name: 'GDP',
    category: 'Economy',
    headline: 'India Q1 GDP Growth Accelerates to 7.8% Outperforming Estimates',
    publisher: 'Government',
    body: 'Official national statistical data indicates India real gross domestic product grew 7.8% year-on-year in the June quarter.',
    expectedImpactRange: [90, 98],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'CRITICAL',
    expectedParticipants: ['Intraday Traders', 'Options Traders', 'Long-term Investors']
  },
  {
    name: 'CPI',
    category: 'Economy',
    headline: 'India CPI Inflation Cools to 4.75% in May, Reaching 12-Month Low',
    publisher: 'Government',
    body: 'Retail inflation measured by Consumer Price Index eased to 4.75% supported by stabilizing food price inflation.',
    expectedImpactRange: [85, 95],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Options Traders', 'Futures Traders']
  },
  {
    name: 'WPI',
    category: 'Economy',
    headline: 'WPI Inflation Inches Up to 1.26% on Manufactured Product Costs',
    publisher: 'Government',
    body: 'Wholesale Price Index inflation rose modestly in May to 1.26% compared to 1.26% in April.',
    expectedImpactRange: [60, 80],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'MEDIUM',
    expectedParticipants: ['Long-term Investors']
  },
  {
    name: 'PMI',
    category: 'Economy',
    headline: 'India Manufacturing PMI Expands to 58.4 in June Indicating Strong Demand',
    publisher: 'S&P Global',
    body: 'S&P Global India Manufacturing Purchasing Managers Index reached 58.4 as new export orders surged.',
    expectedImpactRange: [70, 85],
    expectedConfidenceRange: [88, 96],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Long-term Investors', 'Swing Traders']
  },
  {
    name: 'Banking Sector',
    category: 'Banking',
    headline: 'State Bank of India Reports Gross NPA Drop to 2.21%, Net Profit up 12%',
    publisher: 'Moneycontrol',
    body: 'State Bank of India reported net profit of ₹17,035 crore while asset quality improved with Gross NPA falling to 2.21%.',
    symbol: 'SBIN',
    expectedImpactRange: [85, 95],
    expectedConfidenceRange: [88, 96],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Intraday Traders', 'Swing Traders', 'Long-term Investors']
  },
  {
    name: 'Auto Sector',
    category: 'Auto',
    headline: 'Tata Motors Monthly Sales Rise 8% YoY to 75,000 Units Driven by EV Push',
    publisher: 'Economic Times',
    body: 'Tata Motors announced monthly passenger and commercial vehicle sales of 75,000 units.',
    symbol: 'TATAMOTORS',
    expectedImpactRange: [70, 85],
    expectedConfidenceRange: [88, 96],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Swing Traders', 'Long-term Investors']
  },
  {
    name: 'Pharma Sector',
    category: 'Pharma',
    headline: 'Sun Pharma Receives US FDA Approval for Key Specialty Dermatology Drug',
    publisher: 'NSE',
    body: 'Sun Pharmaceutical Industries received final abbreviated new drug approval from US FDA for commercial distribution.',
    symbol: 'SUNPHARMA',
    expectedImpactRange: [75, 88],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Swing Traders', 'Long-term Investors']
  },
  {
    name: 'IT Sector',
    category: 'IT',
    headline: 'LTIMindtree Bags Multi-Year $150 Million Digital Transformation Deal in US',
    publisher: 'Moneycontrol',
    body: 'LTIMindtree secured a strategic multi-year contract valued at $150 million with a North American financial services client.',
    symbol: 'LTIM',
    expectedImpactRange: [75, 88],
    expectedConfidenceRange: [88, 96],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Swing Traders', 'Long-term Investors']
  },
  {
    name: 'F&O News',
    category: 'F&O',
    headline: 'Nifty Bank Weekly Options See Heavy Put Writing at 51,000 Strike',
    publisher: 'NSE',
    body: 'Derivatives data shows substantial buildup in open interest at 51,000 strike put contracts ahead of weekly expiry.',
    expectedImpactRange: [65, 82],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'HIGH',
    expectedParticipants: ['Intraday Traders', 'Options Traders', 'Futures Traders']
  },
  {
    name: 'General Market News',
    category: 'Market',
    headline: 'Sensex Consolidates Near 80,000 Mark amid Balanced Institutional Flows',
    publisher: 'Livemint',
    body: 'Benchmark indices traded in a narrow range as institutional investors assessed global macroeconomic signals.',
    expectedImpactRange: [15, 35],
    expectedConfidenceRange: [85, 95],
    expectedUrgency: 'LOW',
    expectedParticipants: ['Long-term Investors']
  },
  {
    name: 'Minor Update',
    category: 'Corporate Action',
    headline: 'XYZ Corp Filing Notice of Address Update for Administrative Office',
    publisher: 'BSE',
    body: 'The company has submitted an official disclosure regarding the shift of its local administrative office.',
    expectedImpactRange: [5, 35],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'LOW',
    expectedParticipants: ['Long-term Investors']
  },
  {
    name: 'Budget 2026',
    category: 'Macro',
    headline: 'Union Budget Announcement: Infrastructure Capex Outlay Increased by 20%',
    publisher: 'Government',
    body: 'Union Finance Minister presented the Budget boosting national infrastructure development allocation.',
    expectedImpactRange: [98, 100],
    expectedConfidenceRange: [95, 100],
    expectedUrgency: 'CRITICAL',
    expectedParticipants: ['Intraday Traders', 'Swing Traders', 'Options Traders', 'Futures Traders', 'Long-term Investors']
  }
];

export async function runVerificationAudit() {
  console.log('================================================================');
  console.log('ATHENA V9.0.1 — Production Intelligence Engine Verification Audit');
  console.log('================================================================\n');

  const engine = IntelligenceEngine.getInstance();
  const results: any[] = [];
  let totalTimeMs = 0;

  for (const tc of testCases) {
    const startTime = process.hrtime.bigint();
    const intel = engine.generate(tc);
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    totalTimeMs += durationMs;

    const telegramText = InstitutionalTelegramFormatter.format(tc);
    const summaryIntel = SummaryService.parseArticleIntelligence(tc as any, tc.body);

    // Verify consistency across outputs
    const isConsistent = 
      intel.executiveSummary === summaryIntel.athenaIntelligence?.executiveSummary &&
      intel.impactScore === summaryIntel.athenaIntelligence?.impactScore &&
      intel.confidence === summaryIntel.athenaIntelligence?.confidence &&
      intel.urgency === summaryIntel.athenaIntelligence?.urgency &&
      intel.marketImpact.direction === summaryIntel.athenaIntelligence?.marketImpact.direction;

    const passedImpact = intel.impactScore >= tc.expectedImpactRange[0] && intel.impactScore <= tc.expectedImpactRange[1];
    const passedConfidence = intel.confidence >= tc.expectedConfidenceRange[0] && intel.confidence <= tc.expectedConfidenceRange[1];

    results.push({
      name: tc.name,
      impactScore: intel.impactScore,
      confidence: intel.confidence,
      urgency: intel.urgency,
      direction: intel.marketImpact.direction,
      participants: intel.participants,
      durationMs: durationMs.toFixed(3),
      isConsistent,
      passedImpact,
      passedConfidence
    });

    console.log(`[TEST] ${tc.name.padEnd(30)} | Score: ${String(intel.impactScore).padStart(3)} | Conf: ${intel.confidence}% | Urgency: ${intel.urgency.padEnd(8)} | Time: ${durationMs.toFixed(2)}ms | Consistent: ${isConsistent ? 'YES' : 'NO'}`);
  }

  const avgLatency = (totalTimeMs / testCases.length).toFixed(3);
  console.log(`\n----------------------------------------------------------------`);
  console.log(`Performance Summary:`);
  console.log(`Total Articles Tested : ${testCases.length}`);
  console.log(`Total Generation Time : ${totalTimeMs.toFixed(2)} ms`);
  console.log(`Average Latency       : ${avgLatency} ms / article`);
  console.log(`----------------------------------------------------------------\n`);

  console.log(`Impact Score Distribution Audit:`);
  results.forEach(r => {
    console.log(`- ${r.name.padEnd(28)}: Score ${r.impactScore} (${r.direction}) [Participants: ${r.participants.join(', ')}]`);
  });

  return { results, avgLatency };
}

runVerificationAudit().catch(console.error);
