/**
 * ATHENA — Phase 21: Market Intelligence Digest Types
 * DigestTypes.ts
 * 
 * Strict TypeScript types for the four-stage market intelligence digest:
 * 1. Morning Digest (Pre-market)
 * 2. Afternoon Digest (Intraday delta)
 * 3. Evening Digest (Post-market closing)
 * 4. Full Day Digest (Daily intelligence reconstruction)
 */

export type DigestPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FULL_DAY';

export interface MarketIndexItem {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high?: number;
  low?: number;
  prevClose?: number;
  status: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface GlobalMarketItem {
  name: string;
  region: 'US' | 'ASIA' | 'EUROPE';
  price: number;
  changePct: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  commentary?: string;
}

export interface MacroCommodityItem {
  name: string;
  value: string;
  changePct: number;
  unit?: string;
  impactOnIndia: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  commentary: string;
}

export interface InstitutionalFlowItem {
  category: 'FII_CASH' | 'DII_CASH' | 'FII_INDEX_FUTURES' | 'FII_STOCK_FUTURES';
  label: string;
  netValueCr: number; // in ₹ Crores (positive = net buy, negative = net sell)
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
  interpretation: string;
}

export interface MaterialNewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  category: 'OVERNIGHT_GLOBAL' | 'MACRO_REGULATORY' | 'CORPORATE_EARNINGS' | 'GEO_POLITICAL';
  impactTier: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  affectedTickers?: string[];
  summary: string;
  contradictionFlag?: boolean;
}

export interface CorporateActionItem {
  id: string;
  symbol: string;
  companyName: string;
  type: 'EARNINGS' | 'MAJOR_ORDER' | 'M&A' | 'DIVIDEND' | 'MANAGEMENT_CHANGE' | 'REGULATORY_SEBI_RBI';
  headline: string;
  details: string;
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export interface StockInFocusItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  classification: 'POSITIVE' | 'NEGATIVE' | 'VOLATILE' | 'WATCHLIST';
  driver: string;
  catalystTier: 'PRIMARY' | 'SECONDARY';
}

export interface SectorOutlookItem {
  sector: string;
  changePct: number;
  outlook: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'VOLATILE';
  catalysts: string[];
  topPicks: string[];
  risks: string[];
}

export interface TechnicalPivotLevel {
  indexOrStock: string;
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;
  pivot: number;
  trendState: 'STRONG_UPTREND' | 'MILD_UPTREND' | 'RANGE_BOUND' | 'MILD_DOWNTREND' | 'STRONG_DOWNTREND';
  maxPainStrike?: number;
  pcrRatio?: number;
}

export interface AthenaMarketAssessment {
  bias: 'STRONGLY_BULLISH' | 'MILDLY_BULLISH' | 'NEUTRAL' | 'CAUTIOUS_RISK_OFF' | 'STRONGLY_BEARISH';
  confidenceScore: number; // 0 - 100
  primaryDrivers: string[];
  majorRisks: string[];
  contradictions: string[];
  institutionalConclusion: string;
}

export interface DigestDeltaItem {
  metric: string;
  morningValue: string | number;
  currentValue: string | number;
  deltaPctOrAbs: string;
  interpretation: string;
  significance: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface TomorrowWatchlistItem {
  id: string;
  category: 'SCHEDULED_MACRO' | 'EARNINGS_RELEASE' | 'CORPORATE_ACTION' | 'TECHNICAL_LEVEL' | 'UNRESOLVED_CONTRADICTION';
  title: string;
  triggerTimeOrCondition: string;
  significance: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  potentialMarketImpact: string;
}

// -------------------------------------------------------------
// Complete 4-Stage Digest Data Models
// -------------------------------------------------------------

export interface MorningDigestData {
  period: 'MORNING';
  date: string; // YYYY-MM-DD
  generatedAt: string;
  title: string;
  marketSnapshot: {
    nifty: MarketIndexItem;
    bankNifty: MarketIndexItem;
    sensex: MarketIndexItem;
    giftNifty: MarketIndexItem;
    indiaVix: { value: number; changePct: number; regime: string };
    advanceDeclineRatio: string;
  };
  globalMarkets: GlobalMarketItem[];
  macroCommodities: MacroCommodityItem[];
  institutionalFlows: InstitutionalFlowItem[];
  overnightNews: MaterialNewsItem[];
  corporateDevelopments: CorporateActionItem[];
  stocksInFocus: StockInFocusItem[];
  sectorOutlook: SectorOutlookItem[];
  technicalPivots: TechnicalPivotLevel[];
  athenaAssessment: AthenaMarketAssessment;
}

export interface AfternoonDigestData {
  period: 'AFTERNOON';
  date: string;
  generatedAt: string;
  title: string;
  morningVsCurrentDelta: {
    niftyChangeSinceMorning: number;
    bankNiftyChangeSinceMorning: number;
    deltaItems: DigestDeltaItem[];
    sectorRotations: { sector: string; morningOutlook: string; currentOutlook: string; shiftReason: string }[];
    breakingIntradayNews: MaterialNewsItem[];
    unusualVolumeOiSpikes: { symbol: string; rvol: number; oiChangePct: number; anomalyType: string }[];
  };
  liveMarketSnapshot: {
    nifty: MarketIndexItem;
    bankNifty: MarketIndexItem;
    sensex: MarketIndexItem;
    indiaVix: { value: number; changePct: number };
    advanceDeclineRatio: string;
  };
  morningForecastAccuracy: {
    status: 'ACCURATE' | 'PARTIAL' | 'DIVERGENT';
    divergenceExplanation?: string;
  };
  athenaAssessment: AthenaMarketAssessment;
}

export interface EveningDigestData {
  period: 'EVENING';
  date: string;
  generatedAt: string;
  title: string;
  closingSnapshot: {
    nifty: MarketIndexItem;
    bankNifty: MarketIndexItem;
    sensex: MarketIndexItem;
    indiaVix: { value: number; changePct: number };
    advances: number;
    declines: number;
  };
  sectorPerformanceTable: { sector: string; changePct: number; rank: number; leader: string; laggard: string }[];
  topGainersAndLosers: {
    gainers: StockInFocusItem[];
    losers: StockInFocusItem[];
  };
  institutionalCashSummary: {
    fiiNetCr: number;
    diiNetCr: number;
    totalNetCr: number;
    fiiPositioningInsight: string;
  };
  resultsDeclaredToday: CorporateActionItem[];
  technicalClosingStructure: {
    index: string;
    candlestickPattern: string;
    closingVsDma: string;
    derivativesOutlook: string;
  }[];
  morningVsActualComparison: {
    morningBias: string;
    actualOutcome: string;
    accuracyRating: 'HIGH_ACCURACY' | 'MODERATE' | 'DIVERGENT';
    keyLessonLearned: string;
  };
  tomorrowWatchlist: TomorrowWatchlistItem[];
  athenaAssessment: AthenaMarketAssessment;
}

export interface FullDayDigestData {
  period: 'FULL_DAY';
  date: string;
  generatedAt: string;
  title: string;
  executiveSummary: string;
  top5MarketMovingCatalysts: {
    rank: number;
    headline: string;
    impactDescription: string;
    affectedSectors: string[];
    confidence: number;
  }[];
  marketBreadthAndIndices: {
    indices: MarketIndexItem[];
    advances: number;
    declines: number;
    vixClose: number;
    vixChangePct: number;
  };
  globalAndMacroTransmission: {
    usMarketsSummary: string;
    asianMarketsSummary: string;
    brentCrudeAction: string;
    usdinrAction: string;
    usYieldAction: string;
  };
  sectorRotationSummary: string;
  fiiDiiFlowAnalysis: {
    fiiCashCr: number;
    diiCashCr: number;
    fiiFnoBias: string;
    institutionalVerdict: string;
  };
  athenaSignalsScorecard: {
    signalsGenerated: number;
    signalsConfirmed: number;
    signalsInvalidated: number;
    winRatePct: number;
    contradictionsEncountered: number;
  };
  intradayEvolutionStory: string;
  mostImportantEventOfTheDay: string;
  overnightRisksCarriedForward: string[];
  tomorrowWatchlist: TomorrowWatchlistItem[];
  athenaDailyConclusion: {
    keyTakeaway1: string;
    keyTakeaway2: string;
    keyTakeaway3: string;
  };
}

export type AnyMarketDigest = 
  | MorningDigestData 
  | AfternoonDigestData 
  | EveningDigestData 
  | FullDayDigestData;
