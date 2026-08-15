export interface ShareholdingData {
  promoters: number | null;
  fii: number | null;
  dii: number | null;
  public: number | null;
}

export interface CorporateAction {
  type: 'dividend' | 'bonus' | 'split' | 'meeting';
  description: string;
  date: string;
}

export interface QuarterlyResult {
  quarter: string;
  revenue: number | null;
  profit: number | null;
  margin: number | null;
}

export interface AnnualResult {
  year: string;
  revenue: number | null;
  profit: number | null;
  margin: number | null;
}

export interface BalanceSheetData {
  totalAssets: number | null;
  equityShareCapital: number | null;
  totalLiabilities: number | null;
  reservesAndSurplus: number | null;
}

export interface NormalizedFinancialMetrics {
  price: number | null;
  marketCap: number | null;
  revenue: number | null;
  ebitda: number | null;
  netProfit: number | null;
  cashFlow: number | null;
  operatingMargin: number | null;
  roe: number | null;
  roce: number | null;
  debtEquity: number | null;
  bookValue: number | null;
  eps: number | null;
  shareholding: ShareholdingData | null;
  corporateActions: CorporateAction[] | null;
  quarterlyResults: QuarterlyResult[] | null;
  annualResults: AnnualResult[] | null;
  balanceSheet: BalanceSheetData | null;
  isin: string | null;
  currency: string | null;
  lastUpdated: number | null; // epoch timestamp
}

export interface ProviderResponse {
  providerName: string;
  metrics: NormalizedFinancialMetrics | null;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

export interface ConsensusMetricValue<T> {
  value: T | null;
  source: string;
  supportingProviders: string[];
  lastUpdated: number | null;
  confidenceScore: number;
  conflictDetails?: { provider: string; value: any }[];
}

export interface ConsensusRecord {
  symbol: string;
  metrics: {
    price: ConsensusMetricValue<number>;
    marketCap: ConsensusMetricValue<number>;
    revenue: ConsensusMetricValue<number>;
    ebitda: ConsensusMetricValue<number>;
    netProfit: ConsensusMetricValue<number>;
    cashFlow: ConsensusMetricValue<number>;
    operatingMargin: ConsensusMetricValue<number>;
    roe: ConsensusMetricValue<number>;
    roce: ConsensusMetricValue<number>;
    debtEquity: ConsensusMetricValue<number>;
    bookValue: ConsensusMetricValue<number>;
    eps: ConsensusMetricValue<number>;
    shareholding: ConsensusMetricValue<ShareholdingData>;
    corporateActions: ConsensusMetricValue<CorporateAction[]>;
    quarterlyResults: ConsensusMetricValue<QuarterlyResult[]>;
    annualResults: ConsensusMetricValue<AnnualResult[]>;
    balanceSheet: ConsensusMetricValue<BalanceSheetData>;
    isin: ConsensusMetricValue<string>;
    currency: ConsensusMetricValue<string>;
  };
  lastVerification: number;
  agreementPercentage: number;
  conflictingFields: string[];
  missingFields: string[];
  providersQueried: string[];
  providerLatencies: Record<string, number>;
}

export interface FinancialProvider {
  name: string;
  fetchMetrics(symbol: string): Promise<NormalizedFinancialMetrics | null>;
}
