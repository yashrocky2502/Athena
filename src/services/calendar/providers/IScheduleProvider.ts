export interface ScheduledEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  region: 'India' | 'USA' | 'Global' | 'RBI' | 'Federal Reserve' | 'ECB' | 'BoJ' | 'China';
  timezone: string;
  officialReleaseTime: string;
  officialReleaseTimeUTC: string;
  impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'Macro' | 'Central Bank' | 'Earnings' | 'Dividend' | 'IPO' | 'Corporate Action';
  officialSource: string;
  officialSourceUrl: string;
  verified: boolean;
  confidence: number;
  lastUpdated: string;
  providerName: string;
  symbol?: string;
  announcementDocRef?: string;

  // ATHENA V7.3.7 Trace & Developer Mode Fields
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
}

export interface IScheduleProvider {
  readonly providerName: string;
  fetchEvents(): Promise<ScheduledEvent[]>;
}
