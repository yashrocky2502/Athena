export interface FinancialContext {
  revenue?: string;
  revenueYoY?: string;
  pat?: string;
  patYoY?: string;
  ebitda?: string;
  ebitdaYoY?: string;
  margin?: string;
  marginYoY?: string;
}

export interface MarketContextBlock {
  articleType: string;
  financialContext?: FinancialContext;
  bullets: string[];
}

export interface PeerComparisonBlock {
  company: string;
  peers: string[];
}

export interface SectorImpactBlock {
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  sector: string;
  explanation: string;
}

export interface PriceReactionBlock {
  stock: string;
  reaction: string;
  volume: string;
}

export interface ExpectationBlock {
  status: 'Beat' | 'Miss' | 'Inline' | 'Unknown';
  detail?: string;
}

export interface MacroContextBlock {
  topic: string;
  explanation: string;
}
