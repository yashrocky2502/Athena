export enum NewsSectionId {
  BREAKING = 'BREAKING',
  MARKET = 'MARKET',
  RESULTS = 'RESULTS',
  FNO = 'FNO',
  ECONOMY = 'ECONOMY',
  CORPORATE = 'CORPORATE',
  IPO = 'IPO',
  REGULATORY = 'REGULATORY',
  EXCHANGE = 'EXCHANGE',
  COMMODITIES = 'COMMODITIES',
  GLOBAL = 'GLOBAL',
  TECHNOLOGY = 'TECHNOLOGY',
  BANKING = 'BANKING',
  SECTORS = 'SECTORS',
  STOCKS = 'STOCKS',
  MACRO = 'MACRO',
}

export interface NewsSectionDefinition {
  id: NewsSectionId;
  name: string;
  order: number;
  explanation: string;
}

export const FIXED_NEWS_SECTIONS: Record<NewsSectionId, NewsSectionDefinition> = {
  [NewsSectionId.BREAKING]: {
    id: NewsSectionId.BREAKING,
    name: 'Breaking News',
    order: 1,
    explanation: 'High-urgency, real-time market updates and macro alerts requiring immediate trader attention.'
  },
  [NewsSectionId.MARKET]: {
    id: NewsSectionId.MARKET,
    name: 'Market',
    order: 2,
    explanation: 'Benchmark index movements, trading sentiment, institutional flows, and market commentary.'
  },
  [NewsSectionId.RESULTS]: {
    id: NewsSectionId.RESULTS,
    name: 'Results',
    order: 3,
    explanation: 'Quarterly earnings, profit/revenue growth disclosures, and corporate financial performance.'
  },
  [NewsSectionId.FNO]: {
    id: NewsSectionId.FNO,
    name: 'F&O',
    order: 4,
    explanation: 'Derivatives-sensitive news that may affect volatility, direction, or event risk in F&O securities.'
  },
  [NewsSectionId.ECONOMY]: {
    id: NewsSectionId.ECONOMY,
    name: 'Economy',
    order: 5,
    explanation: 'Indian macroeconomic developments, RBI policy rates, inflation metrics, GDP, and trade balance.'
  },
  [NewsSectionId.CORPORATE]: {
    id: NewsSectionId.CORPORATE,
    name: 'Corporate',
    order: 6,
    explanation: 'Mergers and acquisitions, strategic expansions, leadership changes, and capex announcements.'
  },
  [NewsSectionId.IPO]: {
    id: NewsSectionId.IPO,
    name: 'IPO',
    order: 7,
    explanation: 'Initial public offerings, prospectus filings (DRHP/RHP), anchor allotments, and listing trends.'
  },
  [NewsSectionId.REGULATORY]: {
    id: NewsSectionId.REGULATORY,
    name: 'Regulatory',
    order: 8,
    explanation: 'SEBI mandates, RBI circulars, policy notifications, and market compliance updates.'
  },
  [NewsSectionId.EXCHANGE]: {
    id: NewsSectionId.EXCHANGE,
    name: 'Exchange',
    order: 9,
    explanation: 'Official NSE and BSE announcements, surveillance list updates, and trading session notices.'
  },
  [NewsSectionId.COMMODITIES]: {
    id: NewsSectionId.COMMODITIES,
    name: 'Commodities',
    order: 10,
    explanation: 'Crude oil, gold, silver, base metals, energy trends, and MCX market movements.'
  },
  [NewsSectionId.GLOBAL]: {
    id: NewsSectionId.GLOBAL,
    name: 'Global',
    order: 11,
    explanation: 'US Federal Reserve decisions, Wall Street trends, geopolitical events, and global economic cues.'
  },
  [NewsSectionId.TECHNOLOGY]: {
    id: NewsSectionId.TECHNOLOGY,
    name: 'Technology',
    order: 12,
    explanation: 'IT services earnings, AI developments, SaaS trends, tech infrastructure, and digital economy.'
  },
  [NewsSectionId.BANKING]: {
    id: NewsSectionId.BANKING,
    name: 'Banking',
    order: 13,
    explanation: 'Bank Nifty constituents, credit growth, NPA metrics, deposit rates, and banking sector updates.'
  },
  [NewsSectionId.SECTORS]: {
    id: NewsSectionId.SECTORS,
    name: 'Sectors',
    order: 14,
    explanation: 'Industry-wide trends, sectoral index movements, and thematic equity analysis.'
  },
  [NewsSectionId.STOCKS]: {
    id: NewsSectionId.STOCKS,
    name: 'Stocks',
    order: 15,
    explanation: 'Company-specific single-stock updates, price sensitive disclosures, and ticker movements.'
  },
  [NewsSectionId.MACRO]: {
    id: NewsSectionId.MACRO,
    name: 'Macro',
    order: 16,
    explanation: 'Global and domestic macroeconomic structural indicators, forex (USD/INR), and bond yield curves.'
  }
};

export function getAllSectionDefinitions(): NewsSectionDefinition[] {
  return Object.values(FIXED_NEWS_SECTIONS).sort((a, b) => a.order - b.order);
}

export function isValidSectionId(id: string): boolean {
  if (!id) return false;
  const normalized = id.toUpperCase().replace(/&/g, '').replace(/[^A-Z]/g, '');
  if (normalized === 'FNO' || normalized === 'FO') return true;
  return Object.values(NewsSectionId).includes(normalized as NewsSectionId);
}

export function normalizeSectionId(id: string): NewsSectionId | null {
  if (!id) return null;
  const rawUpper = id.toUpperCase().trim();
  if (rawUpper === 'F&O' || rawUpper === 'FNO' || rawUpper === 'FO' || rawUpper === 'DERIVATIVES') {
    return NewsSectionId.FNO;
  }
  const clean = rawUpper.replace(/[^A-Z]/g, '');
  if (Object.values(NewsSectionId).includes(clean as NewsSectionId)) {
    return clean as NewsSectionId;
  }
  return null;
}
