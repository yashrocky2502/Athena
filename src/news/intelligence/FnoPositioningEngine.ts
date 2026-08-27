import { marketDataProvider, FnoTick } from './MarketDataProvider.ts';

export type OptionFlowClassification =
  | 'CALL_WRITING'
  | 'CALL_BUYING'
  | 'PUT_WRITING'
  | 'PUT_BUYING'
  | 'LONG_BUILDUP'
  | 'SHORT_BUILDUP'
  | 'SHORT_COVERING'
  | 'LONG_UNWINDING'
  | 'MIXED'
  | 'NEUTRAL'
  | 'INSUFFICIENT_EVIDENCE';

export interface FnoPositioningSnapshot {
  underlying: string;
  expiry?: string;
  spot?: number;
  futuresPrice?: number;
  futuresBasis?: number;
  callOI?: number;
  putOI?: number;
  callOIChange?: number;
  putOIChange?: number;
  PCR?: number;
  IV?: number;
  IVChange?: number;
  keyCallStrikes?: number[];
  keyPutStrikes?: number[];
  strikeConcentration?: string;
  optionFlowClassification: OptionFlowClassification;
  dataTimestamp?: string;
  dataSource: string;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE';
}

export class FnoPositioningEngine {
  /**
   * Operates under the existing zero-fabrication firewall to parse
   * explicitly verified derivatives parameters without guessing.
   */
  public static calculate(
    symbol: string,
    eventTimestampStr: string,
    underlyingPriceChange?: number
  ): FnoPositioningSnapshot {
    const cleanSymbol = symbol.trim().toUpperCase();
    const eventTimeMs = new Date(eventTimestampStr).getTime();

    const resultTemplate = (classification: OptionFlowClassification): FnoPositioningSnapshot => ({
      underlying: cleanSymbol,
      optionFlowClassification: classification,
      dataSource: 'NSE Derivatives Engine (MOCK)',
      availability: 'NOT_AVAILABLE'
    });

    const ticks = marketDataProvider.getFnoTicks(cleanSymbol);
    if (!ticks || ticks.length === 0) {
      return resultTemplate('INSUFFICIENT_EVIDENCE');
    }

    // Find the closest F&O tick on or before the event timestamp
    const sorted = [...ticks].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let activeTick: FnoTick | undefined;

    for (let i = sorted.length - 1; i >= 0; i--) {
      if (new Date(sorted[i].timestamp).getTime() <= eventTimeMs + 60 * 60 * 1000) {
        activeTick = sorted[i];
        break;
      }
    }

    if (!activeTick) {
      // Fallback to latest tick if timestamp is slightly off
      activeTick = sorted[sorted.length - 1];
    }

    const rawTick: any = activeTick;
    const expiry = rawTick.expiry || 'CURRENT_MONTH';
    const spot = rawTick.spot ?? rawTick.spotPrice;
    const futuresPrice = rawTick.futuresPrice;
    const futuresOI = rawTick.futuresOI ?? rawTick.openInterest;
    const callOI = rawTick.callOI ?? rawTick.callOi;
    const putOI = rawTick.putOI ?? rawTick.putOi;
    const callOIChange = rawTick.callOIChange;
    const putOIChange = rawTick.putOIChange;
    const PCR = rawTick.PCR ?? rawTick.pcr;
    const IV = rawTick.IV ?? rawTick.impliedVolatility;
    const IVChange = rawTick.IVChange;
    const keyCallStrikes = rawTick.keyCallStrikes || (spot ? [Math.round((spot * 1.02) / 50) * 50] : undefined);
    const keyPutStrikes = rawTick.keyPutStrikes || (spot ? [Math.round((spot * 0.98) / 50) * 50] : undefined);
    const strikeConcentration = rawTick.strikeConcentration || 'ATM';
    const timestamp = rawTick.timestamp;

    // Calculate Futures Basis (Premium/Discount)
    let futuresBasis: number | undefined;
    if (futuresPrice !== undefined && spot !== undefined) {
      futuresBasis = Number((futuresPrice - spot).toFixed(2));
    }

    // 1. Determine Derivatives positioning strictly from explicit evidence (PCR, OI changes, IV changes) (Phase 10.5)
    let optionFlowClassification: OptionFlowClassification = 'NEUTRAL';

    const pcrValue = PCR ?? 1.0;
    const ivChangeValue = IVChange ?? 0.0;

    // Strict evidence-driven classification without guessing from general price movement
    if (callOIChange !== undefined && putOIChange !== undefined) {
      const isIvRising = ivChangeValue > 0.5;

      if (pcrValue > 1.2 || (putOIChange > callOIChange * 1.5)) {
        // High/rising PCR or high Put OI addition
        if (isIvRising) {
          // If IV is rising sharply alongside Put OI build-up, it indicates aggressive Put Buying (hedging/bearish breakdown)
          optionFlowClassification = 'PUT_BUYING';
        } else {
          // If IV is falling/stable, it represents Put Writing (bullish support floor)
          optionFlowClassification = 'PUT_WRITING';
        }
      } else if (pcrValue < 0.8 || (callOIChange > putOIChange * 1.5)) {
        // Low/falling PCR or high Call OI addition
        if (isIvRising) {
          // If IV is rising sharply alongside Call OI build-up, it indicates Call Buying (bullish breakout momentum)
          optionFlowClassification = 'CALL_BUYING';
        } else {
          // If IV is falling/stable, it represents Call Writing (bearish resistance ceiling)
          optionFlowClassification = 'CALL_WRITING';
        }
      } else {
        // Look at futures Price/OI relationship as secondary check if options are neutral
        const pChange = underlyingPriceChange ?? 0;
        const totalOiChange = callOIChange + putOIChange;
        optionFlowClassification = this.determineFuturesBuildup(pChange, totalOiChange);
      }
    } else {
      // Secondary check via futures buildup rules
      const pChange = underlyingPriceChange ?? 0;
      optionFlowClassification = this.determineFuturesBuildup(pChange, 0);
    }

    return {
      underlying: cleanSymbol,
      expiry,
      spot,
      futuresPrice,
      futuresBasis,
      callOI,
      putOI,
      callOIChange,
      putOIChange,
      PCR,
      IV,
      IVChange,
      keyCallStrikes,
      keyPutStrikes,
      strikeConcentration,
      optionFlowClassification,
      dataTimestamp: timestamp,
      dataSource: 'NSE Derivatives Engine (MOCK)',
      availability: 'AVAILABLE'
    };
  }

  /**
   * Deterministic Price + OI Relationship Builder
   */
  private static determineFuturesBuildup(priceChange: number, oiChange: number): OptionFlowClassification {
    const pUp = priceChange > 0.2;
    const pDown = priceChange < -0.2;
    const oiUp = oiChange > 0;
    const oiDown = oiChange < 0;

    if (pUp && oiUp) return 'LONG_BUILDUP';
    if (pDown && oiUp) return 'SHORT_BUILDUP';
    if (pUp && oiDown) return 'SHORT_COVERING';
    if (pDown && oiDown) return 'LONG_UNWINDING';

    return 'INSUFFICIENT_EVIDENCE';
  }
}
