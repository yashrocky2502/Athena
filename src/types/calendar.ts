export type EventImpact = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type EventStatus = 'UPCOMING' | 'LIVE' | 'RELEASED' | 'DELAYED' | 'HOLIDAY' | 'CLOSED';

export type EventRegion = 'India' | 'USA' | 'Global' | 'RBI' | 'Federal Reserve' | 'ECB' | 'BoJ' | 'China';

export type EventType = 'Macro' | 'Central Bank' | 'Earnings' | 'Dividend' | 'IPO' | 'Corporate Action';

export interface PreEventAiAnalysis {
  expectedVolatility: 'HIGH' | 'MODERATE' | 'LOW';
  likelyAffectedSectors: string[];
  likelyAffectedIndices: string[];
  likelyAffectedCommodities?: string[];
  keyWatchpoints: string[];
}

export interface PostReleaseAiSummary {
  headlineOutcome: string;
  surpriseFactor: 'HAWKISH_SURPRISE' | 'DOVISH_SURPRISE' | 'IN_LINE' | 'BEAT' | 'MISS';
  athenaImpactSummary: string;
  marketImplication: string;
}

export interface AssetImpact {
  asset: 'NIFTY' | 'BANKNIFTY' | 'SENSEX' | 'USDINR' | 'GOLD' | 'SILVER' | 'CRUDE' | 'BOND YIELD';
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  magnitude: 'High' | 'Moderate' | 'Low';
}

export interface HistoricalReaction {
  occurrenceCount: number;
  avgNiftyMovePct: number;
  avgBankNiftyMovePct?: number;
  avgGoldMovePct?: number;
  avgUsdInrMovePct?: number;
  lastOccurrences?: {
    date: string;
    actual: string;
    forecast: string;
    niftyReactionPct: number;
  }[];
}

export interface RelatedNewsLink {
  title: string;
  source: string;
  timestamp: string;
  query: string;
}

export interface EconomicEvent {
  id: string;
  name: string;
  country: string;
  countryCode: string; // ISO 2-char, e.g. 'IN', 'US', 'EU', 'JP', 'CN', 'GB'
  region: EventRegion;
  eventType: EventType;
  timestampIso: string; // ISO datetime
  utcTimestampIso: string; // Standardized UTC ISO string
  officialDateUtc: string; // Standardized UTC ISO string
  officialDateIst: string; // Standardized IST datetime string
  renderedDateIst: string; // 'YYYY-MM-DD' in IST
  timezone: string; // e.g. 'Asia/Kolkata', 'America/New_York', 'Europe/London'
  timeIst: string; // e.g. "14:30 IST"
  impact: EventImpact;
  forecast?: string;
  previous?: string;
  actual?: string;
  status: EventStatus;
  unit?: string;
  relatedSymbol?: string;
  isFOCompany?: boolean;

  // Official Date & Filing Validation (ATHENA V7.3.2)
  exchange?: string; // e.g. 'NSE', 'BSE', 'RBI', 'FOMC', 'MoSPI', 'BLS'
  announcementDocRef?: string; // Official filing reference number
  auditReasonIncluded: string;
  auditReasonRejected?: string;
  auditStatus: 'PASSED' | 'REJECTED';

  // ATHENA V7.3.3 Official Release Fields
  source?: string;
  official_url?: string;
  officialSourceUrl?: string;
  official_release_time?: string;
  verified?: boolean;
  confidence?: number;
  last_updated?: string;

  // ATHENA V7.3.1 Accuracy & Verification Fields
  verifiedSource: string; // e.g. "RBI", "NSE", "BSE", "FRED", "World Bank", "OECD", "IMD", "SEC", "Exchange Filing"
  verifiedBy: string[]; // e.g. ["✓ RBI", "✓ FRED", "✓ NSE"]
  confidenceScore: number; // 0 - 100, e.g. 100, 95, 90
  isNeedsVerification?: boolean; // true if confidenceScore < 90
  isDuplicateMerged?: boolean;
  mergedSourcesCount?: number;
  lastSyncTimestamp?: string;

  // ATHENA V7.3.7 Truth Verification & Trace Fields
  providerName: string;
  rawPayload?: any;
  providerEndpoint?: string;
  httpStatus?: number;
  responseHeaders?: Record<string, string>;
  parsingResult?: {
    extractedFields: Record<string, any>;
    matchedKeywords?: string[];
  };
  normalizationResult?: {
    originalTimeStr: string;
    utcIso: string;
    istFormatted: string;
  };

  preEventAi?: PreEventAiAnalysis;
  postReleaseAi?: PostReleaseAiSummary;
  impactMatrix?: AssetImpact[];
  historicalReaction?: HistoricalReaction;
  relatedNewsLinks?: RelatedNewsLink[];
}

export interface CalendarHealthStatus {
  totalEvents: number;
  verifiedEvents: number;
  rejectedEvents: number;
  mockEventsRemoved: number;
  duplicateEventsMerged: number;
  lastSuccessfulSync: string;
  failedSyncCount: number;
  sourceStatus: Array<{
    source: string;
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    lastPing: string;
    responseMs: number;
    confidenceGrade: 'A+' | 'A' | 'B';
  }>;
}

export interface MarketHoliday {
  id: string;
  dateIso: string; // YYYY-MM-DD
  dayName: string;
  eventName: string;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'ALL';
  tradingStatus: 'CLOSED' | 'SPECIAL_SESSION' | 'CLEARING_ONLY';
  specialSessionTime?: string;
  notes?: string;
}

export interface ExpiryDate {
  id: string;
  dateIso: string;
  dayName: string;
  indexName: 'Nifty 50' | 'Bank Nifty' | 'FinNifty' | 'Sensex' | 'Midcap Nifty';
  expiryType: 'WEEKLY' | 'MONTHLY';
  daysRemaining: number;
}
