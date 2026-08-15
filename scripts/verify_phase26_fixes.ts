import { FNOEligibilityEngine } from '../src/newsCoreV2/fno/FNOEligibilityEngine';
import { TelegramQualityGate } from '../src/news/NewsEngine/TelegramQualityGate';

const testCases = [
  {
    name: "HAL Earnings with Target Price (The HAL Case)",
    headline: "HAL shares rally 45% since April. Is the stock still attractive after Q1 earnings?",
    body: "Domestic brokerages maintain a positive outlook on Hindustan Aeronautics after strong June-quarter results. Motilal Oswal and Anand Rathi both retained 'Buy' ratings with a target price of ₹5,800, while JM Financial and InCred have 'Add' and 'Hold' ratings, respectively.",
    expectedEligible: true,
    expectedSymbol: "HAL"
  },
  {
    name: "Generic Stocks to Watch (Exclusion)",
    headline: "Stocks to watch: RIL, TCS, HDFC Bank, HAL",
    body: "Here are the top stocks to watch in today's trade.",
    expectedEligible: false,
    expectedSymbol: "RELIANCE" // HAL is in list, but RIL is first (or whichever is matched)
  },
  {
    name: "RELIANCE Earnings with Brokerage Upgrade",
    headline: "RELIANCE Q1 profit surges 20%. Brokerage upgrades to Buy.",
    body: "Reliance Industries reported strong numbers.",
    expectedEligible: true,
    expectedSymbol: "RELIANCE"
  }
];

async function runTests() {
  console.log('--- PHASE 26 REGRESSION TESTS ---');
  for (const tc of testCases) {
    console.log(`\nTesting: ${tc.name}`);
    const fnoResult = FNOEligibilityEngine.evaluate(tc.headline, tc.body);
    console.log('F&O Result:', fnoResult.eligible ? '✅ ELIGIBLE' : '❌ EXCLUDED', `(${fnoResult.reason})`);
    
    const mockArticle: any = {
      id: 'test_id',
      headline: tc.headline,
      body: tc.body,
      fno: fnoResult,
      relevanceScore: 100,
      category: 'RESULTS',
      sentiment: 'BULLISH'
    };
    
    const qgResult = TelegramQualityGate.evaluate(mockArticle);
    console.log('Quality Gate Result:', qgResult.decision, `(${qgResult.reason})`);
    console.log('Symbol:', qgResult.symbol);
    console.log('Materiality Score:', qgResult.materialityScore);
  }
}

runTests();
