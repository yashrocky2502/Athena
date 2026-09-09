/**
 * ATHENA — Phase 18 Market Noise Filter & Deduplication
 * MarketNoiseFilter.ts
 */

export class MarketNoiseFilter {
  private static instance: MarketNoiseFilter;
  private cooldowns: Map<string, number> = new Map(); // key -> lastAlertTime

  private constructor() {}

  public static getInstance(): MarketNoiseFilter {
    if (!MarketNoiseFilter.instance) {
      MarketNoiseFilter.instance = new MarketNoiseFilter();
    }
    return MarketNoiseFilter.instance;
  }

  /**
   * Generates deterministic identity hash for event deduplication
   */
  public generateEventHash(
    symbol: string,
    eventType: string,
    detectionWindow: string,
    direction: string
  ): string {
    return `${symbol}_${eventType}_${detectionWindow}_${direction}`;
  }

  /**
   * Filter check to reject low-liquidity noise or redundant rapid alerts
   */
  public shouldBlock(
    symbol: string,
    eventType: string,
    priceChangePct: number,
    volume: number,
    bidAskSpreadPct: number,
    currentTimeMs: number = Date.now()
  ): { block: boolean; reason?: string } {
    // 1. Extreme Spread Check (low liquidity safety gate)
    if (bidAskSpreadPct > 1.2) {
      return { block: true, reason: 'LIQUIDITY_SPREAD_TOO_WIDE_NOISE' };
    }

    // 2. Insignificant isolated spike check
    if (Math.abs(priceChangePct) < 0.1 && volume < 50) {
      return { block: true, reason: 'PRICE_VOLUME_UNDER_NOISE_THRESHOLD' };
    }

    // 3. Cooldown / Debouncing check to prevent flooding EventBus
    const uniqueKey = this.generateEventHash(symbol, eventType, '15M', priceChangePct >= 0 ? 'UP' : 'DOWN');
    const lastTime = this.cooldowns.get(uniqueKey) || 0;
    if (currentTimeMs - lastTime < 60000) { // 60s event cooldown
      return { block: true, reason: 'ALERT_COOLDOWN_ACTIVE' };
    }

    this.cooldowns.set(uniqueKey, currentTimeMs);
    return { block: false };
  }

  public reset(): void {
    this.cooldowns.clear();
  }
}
export const marketNoiseFilter = MarketNoiseFilter.getInstance();
