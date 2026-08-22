/**
 * ATHENA NEWS ENGINE — STAGE 8.7 ECONOMIC CALENDAR PROVIDER INTERFACE
 */

export interface EconomicCalendarEvent {
  id: string;
  title: string;
  country: 'IN' | 'US' | 'EU' | 'GLOBAL';
  agency: 'RBI' | 'FED' | 'MOSPI' | 'ECB' | 'MOF' | 'OTHER';
  indicator: 'INTEREST_RATE' | 'CPI_INFLATION' | 'GDP' | 'IIP' | 'WPI' | 'TRADE_BALANCE' | 'EMPLOYMENT' | 'OTHER';
  scheduledAt: string;
  actualValue?: string;
  forecastValue?: string;
  previousValue?: string;
  unit?: string;
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedSymbols?: string[];
  notes?: string;
}

export interface IEconomicCalendarProvider {
  getUpcomingEvents(timeframeHours?: number): Promise<EconomicCalendarEvent[]>;
  getRecentEvents(timeframeHours?: number): Promise<EconomicCalendarEvent[]>;
  toCanonicalArticle(event: EconomicCalendarEvent): any;
}
