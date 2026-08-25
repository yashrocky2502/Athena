import { 
  EquityObservation, 
  FuturesObservation, 
  OptionObservation, 
  OptionChainSnapshot,
  MarketDataProvenance,
  StrikeConcentrationItem,
  ConcentrationType
} from './types.ts';

export class MarketDataNormalizer {
  // Global counts for tracking validation failures to satisfy Section 24
  public static telemetry = {
    malformedCount: 0,
    staleCount: 0,
    expiredCount: 0,
    futureTimestampCount: 0,
    duplicateCount: 0
  };

  private static processedRequests = new Set<string>();

  /**
   * Clears the duplicate detection registry
   */
  public static clearRegistry(): void {
    this.processedRequests.clear();
  }

  /**
   * Standardizes age classification
   */
  public static getFreshness(timestampStr: string): 'REAL_TIME' | 'FRESH' | 'STALE' | 'EXPIRED' | 'NOT_AVAILABLE' {
    const timeMs = new Date(timestampStr).getTime();
    if (isNaN(timeMs)) return 'NOT_AVAILABLE';
    
    const ageMs = Date.now() - timeMs;
    if (ageMs < 0) return 'REAL_TIME'; // Future drift
    
    const ageMins = ageMs / (1000 * 60);
    if (ageMins <= 1) return 'REAL_TIME';
    if (ageMins <= 15) return 'FRESH';
    if (ageMins <= 120) return 'STALE';
    return 'EXPIRED';
  }

  /**
   * Helper to validate timestamp parameters
   */
  private static validateTimestamp(timestampStr: string): boolean {
    if (!timestampStr) return false;
    const timeMs = new Date(timestampStr).getTime();
    if (isNaN(timeMs)) return false;

    // Check future timestamps (strictly ahead of current system time with 1 min grace)
    const now = Date.now();
    if (timeMs > now + 60000) {
      this.telemetry.futureTimestampCount++;
      return false;
    }

    return true;
  }

  /**
   * Validates Equity/Index payloads (Section 8, Section 9)
   */
  public static normalizeEquity(raw: any, provenanceInput: Partial<MarketDataProvenance>): EquityObservation | null {
    if (!raw) return null;

    // Required fields check
    if (!raw.symbol || typeof raw.symbol !== 'string') {
      this.telemetry.malformedCount++;
      return null;
    }

    // Timestamp integrity
    if (!this.validateTimestamp(raw.timestamp)) {
      this.telemetry.malformedCount++;
      return null;
    }

    // Convert raw numeric inputs
    const ltp = Number(raw.ltp);
    const open = Number(raw.open);
    const high = Number(raw.high);
    const low = Number(raw.low);
    const prevClose = Number(raw.previousClose);
    const volume = Number(raw.volume);

    // Numeric validity (price <= 0 and NaN check)
    if (isNaN(ltp) || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(prevClose) || isNaN(volume)) {
      this.telemetry.malformedCount++;
      return null;
    }

    if (ltp <= 0 || open <= 0 || high <= 0 || low <= 0 || prevClose <= 0 || volume < 0) {
      this.telemetry.malformedCount++;
      return null;
    }

    // Deterministic OHLC validation (Section 9)
    // Reject observations where:
    // high < low, high < open, high < close, low > open, low > close
    if (high < low || high < open || high < ltp || low > open || low > ltp) {
      this.telemetry.malformedCount++;
      return null;
    }

    // Duplicate detection (Section 8)
    const duplicateKey = `EQ:${raw.symbol}:${raw.timestamp}:${ltp}:${volume}`;
    if (this.processedRequests.has(duplicateKey)) {
      this.telemetry.duplicateCount++;
      return null;
    }
    this.processedRequests.add(duplicateKey);

    // Construct full provenance (Section 5)
    const obsTime = new Date(raw.timestamp).toISOString();
    const rxTime = new Date().toISOString();
    const freshness = this.getFreshness(obsTime);

    const provenance: MarketDataProvenance = {
      provider: provenanceInput.provider || 'NSE_ADAPTER',
      providerType: provenanceInput.providerType || 'OFFICIAL_EXCHANGE',
      exchange: raw.exchange || 'NSE',
      observedAt: obsTime,
      receivedAt: rxTime,
      normalizedAt: rxTime,
      requestId: provenanceInput.requestId || `req_${Math.random().toString(36).substr(2, 9)}`,
      dataStatus: freshness === 'EXPIRED' ? 'EXPIRED' : (freshness === 'STALE' ? 'STALE' : 'AVAILABLE'),
      freshness,
      sourceConfidence: provenanceInput.sourceConfidence ?? 1.0
    };

    if (provenance.dataStatus === 'STALE') this.telemetry.staleCount++;
    if (provenance.dataStatus === 'EXPIRED') this.telemetry.expiredCount++;

    return {
      symbol: raw.symbol.toUpperCase(),
      exchange: raw.exchange || 'NSE',
      ltp,
      open,
      high,
      low,
      previousClose: prevClose,
      volume,
      timestamp: obsTime,
      tradingStatus: raw.tradingStatus || 'ACTIVE',
      provenance
    };
  }

  /**
   * Validates Futures payloads (Section 8, Section 10)
   */
  public static normalizeFutures(raw: any, provenanceInput: Partial<MarketDataProvenance>): FuturesObservation | null {
    if (!raw) return null;

    if (!raw.symbol || typeof raw.symbol !== 'string') {
      this.telemetry.malformedCount++;
      return null;
    }

    if (!this.validateTimestamp(raw.timestamp)) {
      this.telemetry.malformedCount++;
      return null;
    }

    const ltp = Number(raw.ltp);
    const open = Number(raw.open);
    const high = Number(raw.high);
    const low = Number(raw.low);
    const prevClose = Number(raw.previousClose);
    const volume = Number(raw.volume);
    const openInterest = Number(raw.openInterest);
    const openInterestChange = Number(raw.openInterestChange);

    if (
      isNaN(ltp) || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(prevClose) || 
      isNaN(volume) || isNaN(openInterest) || isNaN(openInterestChange)
    ) {
      this.telemetry.malformedCount++;
      return null;
    }

    if (ltp <= 0 || open <= 0 || high <= 0 || low <= 0 || prevClose <= 0 || volume < 0 || openInterest < 0) {
      this.telemetry.malformedCount++;
      return null;
    }

    // Deterministic OHLC validation
    if (high < low || high < open || high < ltp || low > open || low > ltp) {
      this.telemetry.malformedCount++;
      return null;
    }

    const duplicateKey = `FUT:${raw.symbol}:${raw.timestamp}:${ltp}:${openInterest}`;
    if (this.processedRequests.has(duplicateKey)) {
      this.telemetry.duplicateCount++;
      return null;
    }
    this.processedRequests.add(duplicateKey);

    const obsTime = new Date(raw.timestamp).toISOString();
    const rxTime = new Date().toISOString();
    const freshness = this.getFreshness(obsTime);

    const provenance: MarketDataProvenance = {
      provider: provenanceInput.provider || 'NSE_ADAPTER',
      providerType: provenanceInput.providerType || 'OFFICIAL_EXCHANGE',
      exchange: raw.exchange || 'NSE',
      observedAt: obsTime,
      receivedAt: rxTime,
      normalizedAt: rxTime,
      requestId: provenanceInput.requestId || `req_${Math.random().toString(36).substr(2, 9)}`,
      dataStatus: freshness === 'EXPIRED' ? 'EXPIRED' : (freshness === 'STALE' ? 'STALE' : 'AVAILABLE'),
      freshness,
      sourceConfidence: provenanceInput.sourceConfidence ?? 1.0
    };

    return {
      symbol: raw.symbol.toUpperCase(),
      expiry: raw.expiry,
      ltp,
      open,
      high,
      low,
      previousClose: prevClose,
      volume,
      openInterest,
      openInterestChange,
      timestamp: obsTime,
      provenance
    };
  }

  /**
   * Validates individual Options payloads (Section 8, Section 10)
   */
  public static normalizeOption(raw: any, provenanceInput: Partial<MarketDataProvenance>): OptionObservation | null {
    if (!raw) return null;

    if (!raw.underlying || typeof raw.underlying !== 'string') {
      this.telemetry.malformedCount++;
      return null;
    }

    if (!this.validateTimestamp(raw.timestamp)) {
      this.telemetry.malformedCount++;
      return null;
    }

    const strike = Number(raw.strike);
    const ltp = Number(raw.ltp);
    const volume = Number(raw.volume);
    const openInterest = Number(raw.openInterest);
    const openInterestChange = Number(raw.openInterestChange);
    const impliedVolatility = Number(raw.impliedVolatility);

    if (
      isNaN(strike) || isNaN(ltp) || isNaN(volume) || 
      isNaN(openInterest) || isNaN(openInterestChange) || isNaN(impliedVolatility)
    ) {
      this.telemetry.malformedCount++;
      return null;
    }

    // Section 8: Impossible strikes
    if (strike <= 0 || ltp < 0 || volume < 0 || openInterest < 0 || impliedVolatility < 0) {
      this.telemetry.malformedCount++;
      return null;
    }

    if (raw.optionType !== 'CALL' && raw.optionType !== 'PUT') {
      this.telemetry.malformedCount++;
      return null;
    }

    const obsTime = new Date(raw.timestamp).toISOString();
    const rxTime = new Date().toISOString();
    const freshness = this.getFreshness(obsTime);

    const provenance: MarketDataProvenance = {
      provider: provenanceInput.provider || 'NSE_ADAPTER',
      providerType: provenanceInput.providerType || 'OFFICIAL_EXCHANGE',
      exchange: raw.exchange || 'NSE',
      observedAt: obsTime,
      receivedAt: rxTime,
      normalizedAt: rxTime,
      requestId: provenanceInput.requestId || `req_${Math.random().toString(36).substr(2, 9)}`,
      dataStatus: freshness === 'EXPIRED' ? 'EXPIRED' : (freshness === 'STALE' ? 'STALE' : 'AVAILABLE'),
      freshness,
      sourceConfidence: provenanceInput.sourceConfidence ?? 1.0
    };

    return {
      underlying: raw.underlying.toUpperCase(),
      expiry: raw.expiry,
      strike,
      optionType: raw.optionType,
      ltp,
      volume,
      openInterest,
      openInterestChange,
      impliedVolatility,
      timestamp: obsTime,
      provenance
    };
  }

  /**
   * Normalizes Option Chain Payload & Computes PCR / Strike Concentrations (Section 11, Section 13)
   */
  public static normalizeOptionChain(
    underlying: string,
    rawContracts: any[],
    provenanceInput: Partial<MarketDataProvenance>
  ): OptionChainSnapshot | null {
    if (!underlying || !Array.isArray(rawContracts)) {
      this.telemetry.malformedCount++;
      return null;
    }

    const normalizedContracts: OptionObservation[] = [];

    for (const raw of rawContracts) {
      const norm = this.normalizeOption(raw, provenanceInput);
      if (norm && norm.underlying === underlying.toUpperCase()) {
        normalizedContracts.push(norm);
      }
    }

    if (normalizedContracts.length === 0) {
      this.telemetry.malformedCount++;
      return null;
    }

    // Standardize Option Chain overall observation time as the newest valid timestamp
    const newestTime = normalizedContracts.reduce(
      (max, curr) => Math.max(max, new Date(curr.timestamp).getTime()),
      0
    );
    const obsTime = new Date(newestTime || Date.now()).toISOString();
    const rxTime = new Date().toISOString();
    const freshness = this.getFreshness(obsTime);

    const provenance: MarketDataProvenance = {
      provider: provenanceInput.provider || 'NSE_ADAPTER',
      providerType: provenanceInput.providerType || 'OFFICIAL_EXCHANGE',
      exchange: provenanceInput.exchange || 'NSE',
      observedAt: obsTime,
      receivedAt: rxTime,
      normalizedAt: rxTime,
      requestId: provenanceInput.requestId || `req_${Math.random().toString(36).substr(2, 9)}`,
      dataStatus: freshness === 'EXPIRED' ? 'EXPIRED' : (freshness === 'STALE' ? 'STALE' : 'AVAILABLE'),
      freshness,
      sourceConfidence: provenanceInput.sourceConfidence ?? 1.0
    };

    return {
      underlying: underlying.toUpperCase(),
      timestamp: obsTime,
      contracts: normalizedContracts,
      provenance
    };
  }

  /**
   * Section 11: Calculates PCR (Put-Call Ratio) from normalized option chain data
   */
  public static calculatePcr(contracts: OptionObservation[]): number | 'NOT_AVAILABLE' {
    if (!contracts || contracts.length === 0) return 'NOT_AVAILABLE';

    let totalCallOI = 0;
    let totalPutOI = 0;

    for (const contract of contracts) {
      if (contract.optionType === 'CALL') {
        totalCallOI += contract.openInterest;
      } else if (contract.optionType === 'PUT') {
        totalPutOI += contract.openInterest;
      }
    }

    // Call OI must be greater than zero and Put OI must be non-negative
    if (totalCallOI > 0 && totalPutOI >= 0) {
      return totalPutOI / totalCallOI;
    }

    return 'NOT_AVAILABLE';
  }

  /**
   * Section 13: Computes Normalized Strike Concentration Metrics
   */
  public static calculateStrikeConcentrations(contracts: OptionObservation[]): StrikeConcentrationItem[] {
    if (!contracts || contracts.length === 0) return [];

    // Group option contracts by strike
    const strikesMap = new Map<number, {
      strike: number;
      callOI: number;
      putOI: number;
      callOIChange: number;
      putOIChange: number;
    }>();

    for (const c of contracts) {
      if (!strikesMap.has(c.strike)) {
        strikesMap.set(c.strike, {
          strike: c.strike,
          callOI: 0,
          putOI: 0,
          callOIChange: 0,
          putOIChange: 0
        });
      }
      const item = strikesMap.get(c.strike)!;
      if (c.optionType === 'CALL') {
        item.callOI += c.openInterest;
        item.callOIChange += c.openInterestChange;
      } else {
        item.putOI += c.openInterest;
        item.putOIChange += c.openInterestChange;
      }
    }

    const items = Array.from(strikesMap.values());
    
    // Compute total metrics for concentration bounds classification
    const sortedByCombinedOI = [...items].sort((a, b) => (b.callOI + b.putOI) - (a.callOI + a.putOI));

    return sortedByCombinedOI.map((item, index) => {
      let concentrationType: ConcentrationType = 'MIXED';

      // Logical threshold triggers
      if (item.callOI > item.putOI * 2) {
        concentrationType = item.callOIChange > 0 ? 'CALL_BUILDUP' : 'CALL_RESISTANCE';
      } else if (item.putOI > item.callOI * 2) {
        concentrationType = item.putOIChange > 0 ? 'PUT_BUILDUP' : 'PUT_SUPPORT';
      }

      return {
        strike: item.strike,
        callOI: item.callOI,
        putOI: item.putOI,
        callOIChange: item.callOIChange,
        putOIChange: item.putOIChange,
        rank: index + 1,
        concentrationType
      };
    });
  }
}
export default MarketDataNormalizer;
