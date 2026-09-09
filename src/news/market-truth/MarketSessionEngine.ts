/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketSessionEngine.ts
 * 
 * Deterministic Indian market session calculation.
 * Accurately models NSE/BSE trading sessions, holidays, weekends, expiry days, and post-market windows.
 * ZERO-AI: Deterministic calendar & clock mathematics.
 */

import { MarketSessionState, MarketExchange, CanonicalMarketSession } from './types.ts';

export class MarketSessionEngine {
  private static instance: MarketSessionEngine;

  private holidays: Set<string> = new Set([
    '2026-01-26', // Republic Day
    '2026-03-06', // Holi
    '2026-04-02', // Mahavir Jayanti
    '2026-04-14', // Ambedkar Jayanti
    '2026-05-01', // Maharashtra Day
    '2026-08-15', // Independence Day
    '2026-10-02', // Gandhi Jayanti
    '2026-11-09', // Diwali Laxmi Pujan (Muhurat Trading)
    '2026-12-25', // Christmas
  ]);

  private specialMuhuratDates: Set<string> = new Set(['2026-11-09']);
  private haltedExchanges: Set<MarketExchange> = new Set();

  private constructor() {}

  public static getInstance(): MarketSessionEngine {
    if (!MarketSessionEngine.instance) {
      MarketSessionEngine.instance = new MarketSessionEngine();
    }
    return MarketSessionEngine.instance;
  }

  public registerHoliday(dateStr: string): void {
    this.holidays.add(dateStr);
  }

  public setExchangeHalted(exchange: MarketExchange, halted: boolean): void {
    if (halted) {
      this.haltedExchanges.add(exchange);
    } else {
      this.haltedExchanges.delete(exchange);
    }
  }

  /**
   * Deterministically returns the detailed CanonicalMarketSession for a given timestamp.
   */
  public getSession(utcIsoString?: string, exchange: MarketExchange = 'NSE'): CanonicalMarketSession {
    const d = utcIsoString ? new Date(utcIsoString) : new Date();
    if (isNaN(d.getTime())) {
      return {
        state: 'UNKNOWN',
        exchange,
        isHoliday: false,
        isWeekend: false,
        isSpecialSession: false,
        isExpiryDay: false,
        sessionStartTime: '',
        sessionEndTime: '',
        timeToNextSessionMs: 0
      };
    }

    // Convert UTC to IST (+5.5 hours = +330 mins)
    const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const datePart = istTime.toISOString().split('T')[0];
    const dayOfWeek = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday, 4 = Thursday

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = this.holidays.has(datePart);
    const isSpecialSession = this.specialMuhuratDates.has(datePart);
    const isExpiryDay = dayOfWeek === 4; // Standard NSE weekly/monthly expiry on Thursday

    if (this.haltedExchanges.has(exchange)) {
      return {
        state: 'HALTED',
        exchange,
        isHoliday,
        isWeekend,
        isSpecialSession,
        isExpiryDay,
        sessionStartTime: `${datePart}T09:15:00.000+05:30`,
        sessionEndTime: `${datePart}T15:30:00.000+05:30`,
        timeToNextSessionMs: 0
      };
    }

    if (isWeekend) {
      return {
        state: 'CLOSED',
        exchange,
        isHoliday: false,
        isWeekend: true,
        isSpecialSession: false,
        isExpiryDay: false,
        sessionStartTime: `${datePart}T09:15:00.000+05:30`,
        sessionEndTime: `${datePart}T15:30:00.000+05:30`,
        timeToNextSessionMs: 3600000 * 24
      };
    }

    if (isHoliday && !isSpecialSession) {
      return {
        state: 'HOLIDAY',
        exchange,
        isHoliday: true,
        isWeekend: false,
        isSpecialSession: false,
        isExpiryDay: false,
        sessionStartTime: `${datePart}T09:15:00.000+05:30`,
        sessionEndTime: `${datePart}T15:30:00.000+05:30`,
        timeToNextSessionMs: 3600000 * 24
      };
    }

    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    // NSE/BSE Trading Schedule in IST:
    // 09:00 - 09:08: Pre-open order entry
    // 09:08 - 09:15: Pre-open order matching & buffer
    // 09:15 - 15:30: Continuous trading
    // 15:30 - 15:40: Closing price calculation auction
    // 15:40 - 16:00: Post-market trading
    // 16:00+: Market closed

    let state: MarketSessionState;
    if (totalMinutes < 540) { // Before 09:00 IST
      state = 'CLOSED';
    } else if (totalMinutes >= 540 && totalMinutes < 555) { // 09:00 - 09:15 IST
      state = 'PRE_OPEN';
    } else if (totalMinutes >= 555 && totalMinutes < 930) { // 09:15 - 15:30 IST
      state = 'CONTINUOUS_TRADING';
    } else if (totalMinutes >= 930 && totalMinutes < 940) { // 15:30 - 15:40 IST
      state = 'AUCTION';
    } else if (totalMinutes >= 940 && totalMinutes <= 960) { // 15:40 - 16:00 IST
      state = 'POST_MARKET';
    } else {
      state = 'CLOSED';
    }

    return {
      state,
      exchange,
      isHoliday,
      isWeekend,
      isSpecialSession,
      isExpiryDay,
      sessionStartTime: `${datePart}T09:15:00.000+05:30`,
      sessionEndTime: `${datePart}T15:30:00.000+05:30`,
      timeToNextSessionMs: totalMinutes < 555 ? (555 - totalMinutes) * 60000 : 0
    };
  }

  /**
   * Checks if an incoming tick is from a previous session and prevents it from appearing as live continuous truth.
   */
  public isStaleSessionPrice(tickTimestamp: string, currentSession: CanonicalMarketSession): boolean {
    const tickTime = new Date(tickTimestamp).getTime();
    if (isNaN(tickTime)) return true;

    // If current session is live continuous, but tick is from more than 15 hours ago
    const ageMs = Date.now() - tickTime;
    if (currentSession.state === 'CONTINUOUS_TRADING' && ageMs > 15 * 3600 * 1000) {
      return true;
    }
    return false;
  }
}

export const marketSessionEngine = MarketSessionEngine.getInstance();
