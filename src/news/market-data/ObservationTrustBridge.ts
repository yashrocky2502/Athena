/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10B-1
 * ObservationTrustBridge.ts
 *
 * Clean internal interface connecting MarketDataProvider abstraction to SignalOutcomeEngine.
 * Establishes the trust boundary for internal providers to supply validated observations.
 */

import type { MarketObservationTick, ObservationValidationError, SignalOutcomeRecord, ObservationProvenance } from '../market-intelligence/SignalOutcomeEngine.ts';
import type { EquityObservation } from './types.ts';

export interface IMarketObservationIngestor {
  ingestTrustedMarketObservations(
    signalId: string,
    observations: MarketObservationTick[]
  ): {
    success: boolean;
    outcome?: SignalOutcomeRecord;
    errors?: ObservationValidationError[];
  };

  validateObservations(
    signalId: string,
    observations: any[],
    options?: { allowLegacyFallback?: boolean }
  ): {
    isValid: boolean;
    errors: ObservationValidationError[];
    validatedTicks: MarketObservationTick[];
  };
}

/**
 * Converts a normalized EquityObservation from MarketDataProviderManager into a trusted MarketObservationTick
 */
export function convertEquityObservationToTick(
  signalId: string,
  equityObs: EquityObservation
): MarketObservationTick {
  const pType = equityObs.provenance?.providerType;
  let sourceType: 'REAL_EXCHANGE' | 'BROKER_FEED' | 'APPROVED_MARKET_PROVIDER' | 'SYNTHETIC_TEST' = 'APPROVED_MARKET_PROVIDER';

  if (pType === 'OFFICIAL_EXCHANGE') {
    sourceType = 'REAL_EXCHANGE';
  } else if (pType === 'AUTHORIZED_PROVIDER' || pType === 'FALLBACK_PROVIDER') {
    sourceType = 'APPROVED_MARKET_PROVIDER';
  } else if (pType === 'TEST_PROVIDER') {
    sourceType = 'SYNTHETIC_TEST';
  }

  return {
    signalId,
    symbol: equityObs.symbol,
    timestamp: equityObs.timestamp || new Date().toISOString(),
    price: equityObs.ltp,
    high: equityObs.high || equityObs.ltp,
    low: equityObs.low || equityObs.ltp,
    volume: equityObs.volume || 0,
    provenance: {
      sourceType,
      provider: equityObs.provenance?.provider || 'MARKET_DATA_PROVIDER',
      exchange: equityObs.exchange || equityObs.provenance?.exchange || 'NSE',
      sourceConfidence: equityObs.provenance?.sourceConfidence ?? 1.0,
      verifiedAt: equityObs.provenance?.normalizedAt || new Date().toISOString()
    }
  };
}

/**
 * Trust bridge class providing a clean wrapper for ingestion into SignalOutcomeEngine
 */
export class ObservationTrustBridge {
  constructor(
    private readonly ingestor: IMarketObservationIngestor,
    public readonly defaultProvider: string = 'MARKET_DATA_PROVIDER'
  ) {}

  public ingestTrustedEquityObservations(
    signalId: string,
    equityObservations: EquityObservation[],
    overrideProvenance?: Partial<ObservationProvenance>
  ): {
    success: boolean;
    outcome?: SignalOutcomeRecord;
    errors?: ObservationValidationError[];
  } {
    const ticks = equityObservations.map(obs => {
      const tick = convertEquityObservationToTick(signalId, obs);
      if (overrideProvenance) {
        tick.provenance = {
          ...(typeof tick.provenance === 'object' ? tick.provenance : { sourceType: tick.provenance as any, provider: this.defaultProvider }),
          ...overrideProvenance
        } as ObservationProvenance;
      }
      return tick;
    });

    return this.ingestor.ingestTrustedMarketObservations(signalId, ticks);
  }
}

