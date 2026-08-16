export interface BenchmarkTestCase {
  id: string;
  category: string;
  title: string;
  body: string;
  publishedAt: string;
  publisher: string;
  expectedSymbols: string[];
  expectedImpact: 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL';
  expectedUrgency: 'BREAKING' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';
  expectedFOEligible: boolean;
  expectedCEPEBias: 'CE Bias' | 'PE Bias' | 'Neutral' | 'Mixed';
}

export class QualityBenchmarkDataset {
  public static getTestCases(): BenchmarkTestCase[] {
    return [
      {
        id: 'BM_001_EARNINGS_BEAT',
        category: 'Earnings',
        title: 'TCS Q1 Net Profit Jumps 12% YoY, Surpasses Analyst Estimates on Strong Deal Wins',
        body: 'Tata Consultancy Services reported strong financial results for Q1 with revenue growth across North America and BFSI verticals.',
        publishedAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5m ago
        publisher: 'Economic Times',
        expectedSymbols: ['TCS'],
        expectedImpact: 'POSITIVE',
        expectedUrgency: 'BREAKING',
        expectedFOEligible: true,
        expectedCEPEBias: 'CE Bias',
      },
      {
        id: 'BM_002_EARNINGS_MISS',
        category: 'Earnings',
        title: 'Infosys Q2 Net Profit Falls 8%, Guidance Reduced Amid Weak Tech Spending',
        body: 'Infosys missed revenue estimates as client cancellations impacted top-line growth. Management lowered annual guidance.',
        publishedAt: new Date(Date.now() - 12 * 60000).toISOString(),
        publisher: 'Moneycontrol',
        expectedSymbols: ['INFY'],
        expectedImpact: 'NEGATIVE',
        expectedUrgency: 'BREAKING',
        expectedFOEligible: true,
        expectedCEPEBias: 'PE Bias',
      },
      {
        id: 'BM_003_RBI_RATE_HIKE',
        category: 'Macro Policy',
        title: 'RBI Repo Rate Hiked by 25 bps to Tame Inflation; Stance Retained at Withdrawal of Accommodation',
        body: 'The Reserve Bank of India Monetary Policy Committee decided to increase repo rate by 25 basis points with immediate effect.',
        publishedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        publisher: 'RBI',
        expectedSymbols: ['HDFCBANK', 'ICICIBANK', 'SBIN'],
        expectedImpact: 'NEGATIVE',
        expectedUrgency: 'BREAKING',
        expectedFOEligible: true,
        expectedCEPEBias: 'PE Bias',
      },
      {
        id: 'BM_004_SEBI_ACTION',
        category: 'Regulatory',
        title: 'SEBI Issues Revised Disclosure Guidelines for F&O Algo Trading Entities',
        body: 'Capital markets regulator SEBI introduced stricter risk management frameworks for institutional derivative participants.',
        publishedAt: new Date(Date.now() - 25 * 60000).toISOString(),
        publisher: 'SEBI',
        expectedSymbols: [],
        expectedImpact: 'NEUTRAL',
        expectedUrgency: 'HIGH',
        expectedFOEligible: false,
        expectedCEPEBias: 'Neutral',
      },
      {
        id: 'BM_005_ORDER_WIN',
        category: 'Corporate',
        title: 'L&T Construction Bags Major Mega Order Worth ₹7,000 Crore in Middle East',
        body: 'Larsen & Toubro announced securing significant infrastructure expansion contracts across international markets.',
        publishedAt: new Date(Date.now() - 15 * 60000).toISOString(),
        publisher: 'Reuters',
        expectedSymbols: ['LT'],
        expectedImpact: 'POSITIVE',
        expectedUrgency: 'HIGH',
        expectedFOEligible: true,
        expectedCEPEBias: 'CE Bias',
      },
    ];
  }
}
