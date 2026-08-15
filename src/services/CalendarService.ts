import { EconomicEvent, MarketHoliday, ExpiryDate, CalendarHealthStatus } from '../types/calendar';
import { CalendarAggregatorService } from './CalendarAggregatorService';

/**
 * CalendarService
 * Thin wrapper delegating to CalendarAggregatorService to ensure 100% backward compatibility.
 * Contains ZERO hardcoded events or static arrays.
 */
export class CalendarService {
  private static instance: CalendarService;
  private aggregator = CalendarAggregatorService.getInstance();

  public static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  public getEconomicEvents(): EconomicEvent[] {
    return this.aggregator.getEconomicEvents();
  }

  public getRejectedEventsAudit(): EconomicEvent[] {
    return this.aggregator.getRejectedEventsAudit();
  }

  public deduplicateAndMergeEvents(events: EconomicEvent[]): EconomicEvent[] {
    return this.aggregator.deduplicateAndMergeEvents(events);
  }

  public getHighConfidenceEvents(minConfidence: number = 95): EconomicEvent[] {
    return this.aggregator.getHighConfidenceEvents(minConfidence);
  }

  public getCalendarHealthStatus(): CalendarHealthStatus {
    return this.aggregator.getCalendarHealthStatus();
  }

  public getMarketHolidays(): MarketHoliday[] {
    return this.aggregator.getMarketHolidays();
  }

  public getExpiryCalendar(): ExpiryDate[] {
    return this.aggregator.getExpiryCalendar();
  }
}
