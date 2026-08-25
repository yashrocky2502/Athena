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

    const {
      expiry,
      spot,
      futuresPrice,
      futuresOI,
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
      timestamp
    } = activeTick;

    // Calculate Futures Basis (Premium/Discount)
    let futuresBasis: number | undefined;
    if (futuresPrice !== undefined && spot !== undefined) {
      futuresBasis = Number((futuresPrice - spot).toFixed(2));
    }

    // 1. Determine Futures/Options Build-up status deterministically
    let optionFlowClassification: OptionFlowClassification = 'NEUTRAL';

    const pChange = underlyingPriceChange ?? 0;
    const isPriceUp = pChange > 0.2;
    const isPriceDown = pChange < -0.2;

    // Apply the deterministic Price + OI relationship rules
    if (callOIChange !== undefined && putOIChange !== undefined) {
      if (isPriceUp && putOIChange > 0 && putOIChange > callOIChange * 1.5) {
        optionFlowClassification = 'PUT_WRITING';
      } else if (isPriceDown && callOIChange > 0 && callOIChange > putOIChange * 1.5) {
        optionFlowClassification = 'CALL_WRITING';
      } else if (isPriceUp && callOIChange > 0 && callOIChange > putOIChange * 1.5) {
        optionFlowClassification = 'CALL_BUYING';
      } else if (isPriceDown && putOIChange > 0 && putOIChange > callOIChange * 1.5) {
        optionFlowClassification = 'PUT_BUYING';
      } else {
        // Fallback to futures Price/OI rules
        optionFlowClassification = this.determineFuturesBuildup(pChange, callOIChange + putOIChange);
      }
    } else {
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
