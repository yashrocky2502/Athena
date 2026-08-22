/**
 * Extension-safe Source Abstraction for Economic Calendar Providers (e.g. Forex Factory, Investing.com)
 * Allows future integration without modifying core ingestion/event architecture.
 */

export type EconomicCalendarImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'NON_MARKET_MOVING';
export type EconomicReleaseStatus = 'UPCOMING' | 'RELEASED' | 'REVISED' | 'CANCELLED';

export interface EconomicCalendarEvent {
  id: string;
  eventTime: string; // ISO-8601 timestamp
  currency: string;  // e.g. 'USD', 'INR', 'EUR'
  country: string;   // e.g. 'US', 'IN', 'DE'
  eventName: string; // e.g. 'CPI YoY', 'Non-Farm Payrolls', 'RBI Interest Rate Decision'
  importance: EconomicCalendarImportance;
  previous?: string | number | null;
  forecast?: string | number | null;
  actual?: string | number | null;
  revision?: string | number | null;
  source: string;    // e.g. 'ForexFactory', 'Investing.com', 'MOSPI'
  releaseStatus: EconomicReleaseStatus;
  rawPayload?: Record<string, any>;
}

export interface IEconomicCalendarProvider {
  readonly providerName: string;
  fetchUpcomingEvents(startDateISO?: string, endDateISO?: string): Promise<EconomicCalendarEvent[]>;
  fetchLatestReleases(): Promise<EconomicCalendarEvent[]>;
  healthCheck(): Promise<{ ok: boolean; latencyMs?: number; message?: string }>;
}
