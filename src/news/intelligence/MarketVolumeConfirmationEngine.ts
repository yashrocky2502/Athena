import { marketDataProvider } from './MarketDataProvider.ts';

export type VolumeConfirmationStatus =
  | 'STRONG_CONFIRMATION'
  | 'CONFIRMED'
  | 'WEAK'
  | 'NEUTRAL'
  | 'CONTRADICTORY'
  | 'NOT_AVAILABLE';

export interface VolumeConfirmationSnapshot {
  currentVolume?: number;
  baselineVolume?: number;
  relativeVolume?: number;
  volumeMultiple?: number;
  volumeAvailability: 'AVAILABLE' | 'NOT_AVAILABLE';
  volumeDirection: 'ABOVE_BASELINE' | 'BELOW_BASELINE' | 'FLAT' | 'UNKNOWN';
  confirmationStatus: VolumeConfirmationStatus;
  dataTimestamp?: string;
  source: string;
}

export class MarketVolumeConfirmationEngine {
  /**
   * Evaluates volume participation to confirm or invalidate price breakouts.
   */
  public static evaluate(
    symbol: string,
    eventTimestampStr: string,
    priceChangePct?: number
  ): VolumeConfirmationSnapshot {
    const cleanSymbol = symbol.trim().toUpperCase();
    const eventDateStr = eventTimestampStr.split('T')[0];

    const resultTemplate = (status: VolumeConfirmationStatus): VolumeConfirmationSnapshot => ({
      volumeAvailability: 'NOT_AVAILABLE',
      volumeDirection: 'UNKNOWN',
      confirmationStatus: status,
      source: 'NSE Volume Data Feed (MOCK)'
    });

    // 1. Look up session summary
    const session = marketDataProvider.getSessionSummary(cleanSymbol, eventDateStr);
    let currentVolume = session?.volume;
    let baselineVolume = session?.baselineVolume;
    let dataTimestamp = session ? `${eventDateStr}T15:30:00+05:30` : undefined;

    // 2. Fallback to tick volumes
    if (!currentVolume) {
      const ticks = marketDataProvider.getPriceTicks(cleanSymbol);
      if (ticks && ticks.length > 0) {
        currentVolume = ticks.reduce((acc, t) => acc + t.volume, 0);
        baselineVolume = 50000; // Baseline average
        dataTimestamp = ticks[ticks.length - 1].timestamp;
      }
    }

    if (!currentVolume || !baselineVolume) {
      return resultTemplate('NOT_AVAILABLE');
    }

    const volumeMultiple = Number((currentVolume / baselineVolume).toFixed(2));
    const relativeVolume = volumeMultiple;

    let volumeDirection: 'ABOVE_BASELINE' | 'BELOW_BASELINE' | 'FLAT' | 'UNKNOWN' = 'FLAT';
    if (volumeMultiple > 1.1) {
      volumeDirection = 'ABOVE_BASELINE';
    } else if (volumeMultiple < 0.9) {
      volumeDirection = 'BELOW_BASELINE';
    }

    // 3. Classify Confirmation Status
    let confirmationStatus: VolumeConfirmationStatus = 'NEUTRAL';

    if (volumeMultiple >= 2.0) {
      confirmationStatus = 'STRONG_CONFIRMATION';
    } else if (volumeMultiple >= 1.2) {
      confirmationStatus = 'CONFIRMED';
    } else if (volumeMultiple >= 0.8) {
      confirmationStatus = 'NEUTRAL';
    } else {
      confirmationStatus = 'WEAK';
    }

    // Contradictory check: If price change is intense but volume multiple is heavily deficient
    if (priceChangePct !== undefined && Math.abs(priceChangePct) >= 1.5 && volumeMultiple < 0.6) {
      confirmationStatus = 'CONTRADICTORY';
    }

    return {
      currentVolume,
      baselineVolume,
      relativeVolume,
      volumeMultiple,
      volumeAvailability: 'AVAILABLE',
      volumeDirection,
      confirmationStatus,
      dataTimestamp,
      source: 'NSE Volume Data Feed (MOCK)'
    };
  }
}
