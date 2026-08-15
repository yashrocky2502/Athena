import { CrossArticleEngine } from '../../news/NewsEngine/CrossArticleEngine';
import { IntelligenceEngine } from '../../news/NewsEngine/IntelligenceEngine';

interface TestArticleInput {
  title: string;
  body: string;
  publisher?: string;
  category?: string;
  symbol?: string;
}

const sequenceOfArticles: TestArticleInput[] = [
  {
    title: 'RBI Keeps Repo Rate Unchanged at 6.50% Citing Inflation Target',
    body: 'Reserve Bank of India Monetary Policy Committee decided to maintain repo rate at 6.50% while emphasizing liquidity management and inflation balance.',
    publisher: 'RBI',
    category: 'Monetary Policy'
  },
  {
    title: 'Bank Nifty Surges 450 Points Following RBI Monetary Policy Announcement',
    body: 'Indian banking sector stocks rallied sharply with HDFC Bank and State Bank of India leading gains following steady interest rate guidance by RBI.',
    publisher: 'Economic Times',
    category: 'Banking'
  },
  {
    title: 'Bond Yields Drop as Inflation Expectations Stabilize Post-RBI Policy',
    body: 'Government bond yields softened 4 basis points to 6.98% as market participants priced in stable monetary conditions through Q2.',
    publisher: 'Bloomberg',
    category: 'Markets'
  },
  {
    title: 'Rupee Strengthens Against US Dollar Supported by FII Inflows',
    body: 'Indian Rupee appreciated 12 paise against the US dollar supported by steady foreign portfolio investments into debt and banking equities.',
    publisher: 'Reuters',
    category: 'Forex'
  },
  {
    title: 'Reliance Industries Reports Q1 Net Profit Growth of 18% YoY',
    body: 'Reliance Industries reported Q1 consolidated net profit of ₹19,500 crore driven by retail expansion and digital services subscriber addition.',
    publisher: 'BSE',
    category: 'Earnings',
    symbol: 'RELIANCE'
  },
  {
    title: 'Brent Crude Oil Prices Slip 3% Below $78 per Barrel',
    body: 'International crude oil prices declined 3% following OPEC supply indications, relieving input cost pressure on refiners and transportation companies.',
    publisher: 'Reuters',
    category: 'Commodities'
  },
  {
    title: 'Reliance Promoter Group Increases Equity Stake via Open Market Route',
    body: 'Promoter group entities acquired additional equity shares of Reliance Industries, reflecting confidence in O2C margin expansion and retail growth.',
    publisher: 'BSE',
    category: 'Corporate Action',
    symbol: 'RELIANCE'
  }
];

export async function runCrossArticleVerification() {
  console.log('================================================================');
  console.log('ATHENA V9.1 — Cross-Article Market Intelligence Verification Audit');
  console.log('================================================================\n');

  const crossEngine = CrossArticleEngine.getInstance();
  crossEngine.clear();

  let totalMs = 0;
  let articleCount = 0;

  for (const item of sequenceOfArticles) {
    const articleContent: any = {
      headline: item.title,
      title: item.title,
      body: item.body,
      publisher: item.publisher,
      knowledge: {
        companies: item.symbol ? [{ symbol: item.symbol, name: item.symbol }] : []
      }
    };

    articleContent.athenaIntelligence = IntelligenceEngine.getInstance().generate(articleContent);

    const start = process.hrtime.bigint();
    const result = crossEngine.processArticle(articleContent);
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    totalMs += durationMs;
    articleCount++;

    console.log(`[ARTICLE ${articleCount}] ${item.title.substring(0, 45)}...`);
    console.log(`  └─ Cluster      : ${result.cluster.title} (Type: ${result.relation}, Signal: ${result.cluster.signalStrength}/100)`);
    console.log(`  └─ Themes       : ${result.themes.map(t => t.theme).join(', ') || 'General Market'}`);
    if (result.memoryReference) {
      console.log(`  └─ Market Memory: ${result.memoryReference}`);
    }
    console.log(`  └─ Latency      : ${durationMs.toFixed(3)} ms\n`);
  }

  const snapshot = crossEngine.getIntelligenceSnapshot();

  console.log('----------------------------------------------------------------');
  console.log('CROSS-ARTICLE AGGREGATE INTELLIGENCE SNAPSHOT');
  console.log('----------------------------------------------------------------');
  console.log(`Market Narrative  : "${snapshot.narrative?.headline}"`);
  console.log(`Narrative Summary : ${snapshot.narrative?.summary}`);
  console.log(`Institutional Flow: ${snapshot.institutionalFlow.regime} (${snapshot.institutionalFlow.confidence}% confidence)`);
  console.log(`Flow Reasoning    : ${snapshot.institutionalFlow.reasoning}`);
  console.log(`Active Clusters   : ${snapshot.clusters.length}`);
  console.log(`Active Themes     : ${snapshot.themes.map(t => `${t.theme} (${t.trendStrength})`).join(', ')}`);
  console.log(`Event Correlations: ${snapshot.correlations.length}`);
  console.log(`Avg Latency/Art   : ${(totalMs / articleCount).toFixed(3)} ms`);
  console.log('----------------------------------------------------------------\n');
}

runCrossArticleVerification().catch(console.error);
