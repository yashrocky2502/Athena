import { DataAvailabilityStatus } from './FOTypes.js';
import { FNO_COMPANIES_REGISTRY } from '../registry/FNORegistry.js';

export interface MarketDataGuardResult {
  isFnOEligible: boolean;
  symbol: string;
  underlyingType: 'INDEX' | 'STOCK' | 'COMMODITY' | 'CURRENCY' | 'UNKNOWN';
  underlyingPriceStatus: DataAvailabilityStatus;
  optionChainStatus: DataAvailabilityStatus;
  ivStatus: DataAvailabilityStatus;
  deltaStatus: DataAvailabilityStatus;
  positionsStatus: DataAvailabilityStatus;
  canExecuteLiveTrade: boolean;
  guardMessages: string[];
}

export class FNODataAvailabilityGuard {
  /**
   * Verifies if a symbol is F&O eligible and audits market data availability.
   */
  public auditAvailability(
    symbolOrName: string,
    liveMarketData?: { underlyingPrice?: number; optionChain?: any; positions?: any }
  ): MarketDataGuardResult {
    const term = (symbolOrName || '').toLowerCase().trim();
    const guardMessages: string[] = [];

    // Find symbol in FNO Registry
    const found = FNO_COMPANIES_REGISTRY.find(c => 
      c.symbol.toLowerCase() === term ||
      c.nseSymbol.toLowerCase() === term ||
      c.name.toLowerCase() === term ||
      c.aliases.some(a => a.toLowerCase() === term)
    );

    const isFnOEligible = found ? found.isFnO : (term.includes('nifty') || term.includes('banknifty') || term.includes('finnty'));
    const symbol = found ? found.symbol : (term.toUpperCase() || 'UNKNOWN');

    let underlyingType: 'INDEX' | 'STOCK' | 'COMMODITY' | 'CURRENCY' | 'UNKNOWN' = 'STOCK';
    if (symbol.includes('NIFTY') || symbol.includes('BANKNIFTY') || symbol.includes('FINNIFTY') || symbol.includes('SENSEX')) {
      underlyingType = 'INDEX';
    } else if (!found && !isFnOEligible) {
      underlyingType = 'UNKNOWN';
    }

    if (!isFnOEligible) {
      guardMessages.push(`Symbol '${symbolOrName}' is NOT in the F&O derivatives registry`);
    }

    // Check live data availability
    const hasPrice = liveMarketData?.underlyingPrice !== undefined && liveMarketData.underlyingPrice > 0;
    const hasChain = Boolean(liveMarketData?.optionChain);
    const hasPositions = Boolean(liveMarketData?.positions);

    const underlyingPriceStatus: DataAvailabilityStatus = hasPrice ? 'AVAILABLE' : 'UNAVAILABLE';
    const optionChainStatus: DataAvailabilityStatus = hasChain ? 'AVAILABLE' : 'UNAVAILABLE';
    const ivStatus: DataAvailabilityStatus = hasChain ? 'AVAILABLE' : 'UNAVAILABLE';
    const deltaStatus: DataAvailabilityStatus = hasChain ? 'AVAILABLE' : 'UNAVAILABLE';
    const positionsStatus: DataAvailabilityStatus = hasPositions ? 'AVAILABLE' : 'UNAVAILABLE';

    if (!hasChain) {
      guardMessages.push('Live option-chain feed UNAVAILABLE — Strategy delta/IV marked UNAVAILABLE');
    }
    if (!hasPositions) {
      guardMessages.push('Broker positions feed UNAVAILABLE — Signal generated as position-unaware');
    }

    const canExecuteLiveTrade = isFnOEligible && hasPrice && hasChain;

    return {
      isFnOEligible,
      symbol,
      underlyingType,
      underlyingPriceStatus,
      optionChainStatus,
      ivStatus,
      deltaStatus,
      positionsStatus,
      canExecuteLiveTrade,
      guardMessages
    };
  }
}
