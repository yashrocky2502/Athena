import { marketDataProvider, PriceTick } from './MarketDataProvider.ts';

export type MarketSession = 'PRE_MARKET' | 'LIVE_SESSION' | 'POST_MARKET' | 'WEEKEND' | 'UNKNOWN';

export type ReactionWindow =
  | 'PRE_EVENT'
  | 'EVENT_TO_5M'
  | 'EVENT_TO_15M'
  | 'EVENT_TO_30M'
  | 'EVENT_TO_60M'
  | 'INTRADAY'
  | 'POST_MARKET'
  | 'NEXT_SESSION';

export type ReactionDirection = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN';

export type ReactionStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';

export type DataFreshness = 'REAL_TIME' | 'FRESH' | 'STALE' | 'EXPIRED' | 'NOT_AVAILABLE';

export type ReactionAvailability = 'AVAILABLE' | 'PARTIAL' | 'NOT_AVAILABLE' | 'STALE' | 'INVALID';

export interface MarketReactionSnapshot {
  symbol: string;
  underlying: string;
  eventTimestamp: string;
  marketSession: MarketSession;
  priceBeforeEvent?: number;
  eventTimePrice?: number;
  currentPrice?: number;
  absolutePriceChange?: number;
  percentagePriceChange?: number;
  sessionOpen?: number;
  sessionHigh?: number;
  sessionLow?: number;
  gapPercentage?: number;
  reactionWindow: ReactionWindow;
  reactionDirection: ReactionDirection;
  reactionStrength: ReactionStrength;
  dataTimestamp?: string;
  dataFreshness: DataFreshness;
  dataSource: string;
  availability: ReactionAvailability;
}

export class LiveMarketReactionEngine {
  /**
   * Evaluates and snaps actual live market-price behavior for a target corporate action.
   */
  public static calculate(
    symbol: string,
    eventTimestampStr: string,
    config?: {
      freshThresholdMin?: number;
      staleThresholdMin?: number;
    }
  ): MarketReactionSnapshot {
    const freshThresholdMin = config?.freshThresholdMin ?? 15;
    const staleThresholdMin = config?.staleThresholdMin ?? 120;

    const cleanSymbol = symbol.trim().toUpperCase();
    const eventTimeMs = new Date(eventTimestampStr).getTime();

    const resultTemplate = (availability: ReactionAvailability, freshness: DataFreshness): MarketReactionSnapshot => ({
      symbol: cleanSymbol,
      underlying: cleanSymbol,
      eventTimestamp: eventTimestampStr,
      marketSession: 'UNKNOWN',
      reactionWindow: 'PRE_EVENT',
      reactionDirection: 'UNKNOWN',
      reactionStrength: 'NONE',
      dataFreshness: freshness,
      dataSource: 'Live Exchange Feed (MOCK)',
      availability
    });

    if (isNaN(eventTimeMs)) {
      return resultTemplate('INVALID', 'NOT_AVAILABLE');
    }

    // 1. Resolve Timezone & Market Session
    const marketSession = this.determineMarketSession(eventTimestampStr);

    // 2. Fetch ticks
    const ticks = marketDataProvider.getPriceTicks(cleanSymbol);
    if (!ticks || ticks.length === 0) {
      const snap = resultTemplate('NOT_AVAILABLE', 'NOT_AVAILABLE');
      snap.marketSession = marketSession;
      return snap;
    }

    // Sort ticks chronologically to align searches
    const sortedTicks = [...ticks].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 3. Anchoring event prices
    let priceBeforeEvent: number | undefined;
    let eventTimePrice: number | undefined;
    let eventTimePriceStamp: string | undefined;

    // Find price before event (strictly before timestamp)
    for (let i = sortedTicks.length - 1; i >= 0; i--) {
      const tickMs = new Date(sortedTicks[i].timestamp).getTime();
      if (tickMs < eventTimeMs) {
        priceBeforeEvent = sortedTicks[i].price;
        break;
      }
    }

    // Find eventTimePrice (closest valid observation on or after eventTimestamp)
    if (marketSession === 'PRE_MARKET') {
      // Find first tick on or after 9:15 IST (first tick of the trading session)
      const firstSessionTick = sortedTicks.find(t => {
        const tickMs = new Date(t.timestamp).getTime();
        if (tickMs < eventTimeMs) return false;
        // Check if it fits the morning open
        const istDate = new Date(tickMs + 5.5 * 60 * 60 * 1000);
        const hours = istDate.getUTCHours();
        const mins = istDate.getUTCMinutes();
        return (hours === 9 && mins >= 15) || hours > 9;
      });
      if (firstSessionTick) {
        eventTimePrice = firstSessionTick.price;
        eventTimePriceStamp = firstSessionTick.timestamp;
      }
    } else if (marketSession === 'POST_MARKET' || marketSession === 'WEEKEND') {
      // Find first tick of the next trading session
      const nextSessionTick = sortedTicks.find(t => {
        const tickMs = new Date(t.timestamp).getTime();
        return tickMs > eventTimeMs;
      });
      if (nextSessionTick) {
        eventTimePrice = nextSessionTick.price;
        eventTimePriceStamp = nextSessionTick.timestamp;
      }
    } else {
      // LIVE_SESSION: Find closest tick on or immediately after the event (within 60m firewall)
      const matches = sortedTicks.filter(t => {
        const tickMs = new Date(t.timestamp).getTime();
        return tickMs >= eventTimeMs && (tickMs - eventTimeMs) <= 60 * 60 * 1000;
      });
      if (matches.length > 0) {
        eventTimePrice = matches[0].price;
        eventTimePriceStamp = matches[0].timestamp;
      }
    }

    // 4. Resolve current price (latest tick)
    const latestTick = sortedTicks[sortedTicks.length - 1];
    const currentPrice = latestTick.price;
    const dataTimestamp = latestTick.timestamp;

    // 5. Query session summary metrics
    const eventDateStr = eventTimestampStr.split('T')[0];
    const session = marketDataProvider.getSessionSummary(cleanSymbol, eventDateStr);
    const sessionOpen = session?.open;
    const sessionHigh = session?.high;
    const sessionLow = session?.low;

    let gapPercentage: number | undefined;
    if (sessionOpen && priceBeforeEvent && priceBeforeEvent > 0) {
      gapPercentage = Number((((sessionOpen - priceBeforeEvent) / priceBeforeEvent) * 100).toFixed(2));
    }

    // 6. Calculate Price changes
    let absolutePriceChange: number | undefined;
    let percentagePriceChange: number | undefined;

    if (currentPrice !== undefined && eventTimePrice !== undefined) {
      absolutePriceChange = Number((currentPrice - eventTimePrice).toFixed(2));
      percentagePriceChange = Number((((currentPrice - eventTimePrice) / eventTimePrice) * 100).toFixed(2));
    }

    // 7. Resolve reaction window based on time elapsed between anchor and latest tick
    let reactionWindow: ReactionWindow = 'INTRADAY';
    if (eventTimePriceStamp) {
      const anchorMs = new Date(eventTimePriceStamp).getTime();
      const latestMs = new Date(dataTimestamp).getTime();
      const diffMin = (latestMs - anchorMs) / (1000 * 60);

      if (diffMin <= 5) reactionWindow = 'EVENT_TO_5M';
      else if (diffMin <= 15) reactionWindow = 'EVENT_TO_15M';
      else if (diffMin <= 30) reactionWindow = 'EVENT_TO_30M';
      else if (diffMin <= 60) reactionWindow = 'EVENT_TO_60M';
      else if (marketSession === 'POST_MARKET') reactionWindow = 'POST_MARKET';
      else if (new Date(dataTimestamp).getDate() !== new Date(eventTimestampStr).getDate()) {
        reactionWindow = 'NEXT_SESSION';
      }
    }

    // 8. Classify Direction & Strength
    let reactionDirection: ReactionDirection = 'NEUTRAL';
    let reactionStrength: ReactionStrength = 'NONE';

    if (percentagePriceChange !== undefined) {
      const absPct = Math.abs(percentagePriceChange);
      if (percentagePriceChange > 0.5) {
        reactionDirection = 'POSITIVE';
      } else if (percentagePriceChange < -0.5) {
        reactionDirection = 'NEGATIVE';
      }

      if (absPct >= 2.0) reactionStrength = 'STRONG';
      else if (absPct >= 1.0) reactionStrength = 'MODERATE';
      else if (absPct >= 0.5) reactionStrength = 'WEAK';
    }

    // 9. Calculate Freshness state
    let dataFreshness: DataFreshness = 'NOT_AVAILABLE';
    const latestTickMs = new Date(dataTimestamp).getTime();
    const ageMin = (Date.now() - latestTickMs) / (1000 * 60);

    if (ageMin < 2) dataFreshness = 'REAL_TIME';
    else if (ageMin <= freshThresholdMin) dataFreshness = 'FRESH';
    else if (ageMin <= staleThresholdMin) dataFreshness = 'STALE';
    else dataFreshness = 'EXPIRED';

    // Availability classification
    let availability: ReactionAvailability = 'AVAILABLE';
    if (eventTimePrice === undefined && currentPrice === undefined) {
      availability = 'NOT_AVAILABLE';
    } else if (eventTimePrice === undefined || currentPrice === undefined) {
      availability = 'PARTIAL';
    } else if (ageMin > 1440) {
      availability = 'STALE';
    }

    return {
      symbol: cleanSymbol,
      underlying: cleanSymbol,
      eventTimestamp: eventTimestampStr,
      marketSession,
      priceBeforeEvent,
      eventTimePrice,
      currentPrice,
      absolutePriceChange,
      percentagePriceChange,
      sessionOpen,
      sessionHigh,
      sessionLow,
      gapPercentage,
      reactionWindow,
      reactionDirection,
      reactionStrength,
      dataTimestamp,
      dataFreshness,
      dataSource: 'Live Exchange Feed (MOCK)',
      availability
    };
  }

  /**
   * Helper to determine market session on Indian Markets (IST)
   */
  public static determineMarketSession(timestampStr: string): MarketSession {
    const dateUtc = new Date(timestampStr);
    if (isNaN(dateUtc.getTime())) return 'UNKNOWN';

    // Convert UTC to IST (+5.5 hours)
    const dateIst = new Date(dateUtc.getTime() + 5.5 * 60 * 60 * 1000);
    const day = dateIst.getUTCDay(); // 0 = Sunday, 6 = Saturday

    if (day === 0 || day === 6) {
      return 'WEEKEND';
    }

    const hours = dateIst.getUTCHours();
    const minutes = dateIst.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    // NSE hours: 9:15 AM (555 mins) to 3:30 PM (930 mins)
    if (totalMinutes < 555) {
      return 'PRE_MARKET';
    } else if (totalMinutes >= 555 && totalMinutes <= 930) {
      return 'LIVE_SESSION';
    } else {
      return 'POST_MARKET';
    }
  }
}
