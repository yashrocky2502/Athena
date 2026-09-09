/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * MarketDataNormalizationEngine.ts
 * 
 * Deterministic normalization of heterogeneous market data feeds into CanonicalMarketTick.
 * ZERO-AI: 100% deterministic rules, zero hallucination, strict typing.
 */

import {
  CanonicalMarketTick,
  AssetClass,
  MarketExchange,
  MarketSessionState,
  SourcePriorityLevel,
  TickValidationStatus,
  MarketTruthStatus,
  FreshnessStatus
} from './types.ts';

export interface RawMarketTickInput {
  instrumentId?: string;
  symbol: string;
  exchange?: string;
  assetClass?: string;
  timestamp?: string | number;
  exchangeTimestamp?: string | number;
  receivedTimestamp?: string | number;
  sequenceNumber?: number;
  lastPrice: number;
  previousClose?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  tradedValue?: number | null;
  bidPrice?: number | null;
  askPrice?: number | null;
  bidQuantity?: number | null;
  askQuantity?: number | null;
  VWAP?: number | null;
  marketStatus?: string;
  source?: string;
  sourcePriority?: SourcePriorityLevel;
  correlationId?: string;
}

export class MarketDataNormalizationEngine {
  private static instance: MarketDataNormalizationEngine;
  private static sequenceCounter = 0;

  // Canonical Symbol Mapping Dictionary
  private symbolDictionary: Map<string, { canonical: string; assetClass: AssetClass; exchange: MarketExchange }> = new Map([
    // Indices
    ['NIFTY', { canonical: 'NIFTY 50', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY50', { canonical: 'NIFTY 50', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY 50', { canonical: 'NIFTY 50', assetClass: 'INDEX', exchange: 'NSE' }],
    ['^NSEI', { canonical: 'NIFTY 50', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY.NS', { canonical: 'NIFTY 50', assetClass: 'INDEX', exchange: 'NSE' }],

    ['BANKNIFTY', { canonical: 'NIFTY BANK', assetClass: 'INDEX', exchange: 'NSE' }],
    ['BANK NIFTY', { canonical: 'NIFTY BANK', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTYBANK', { canonical: 'NIFTY BANK', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY BANK', { canonical: 'NIFTY BANK', assetClass: 'INDEX', exchange: 'NSE' }],
    ['^NSEBANK', { canonical: 'NIFTY BANK', assetClass: 'INDEX', exchange: 'NSE' }],

    ['SENSEX', { canonical: 'SENSEX', assetClass: 'INDEX', exchange: 'BSE' }],
    ['BSE SENSEX', { canonical: 'SENSEX', assetClass: 'INDEX', exchange: 'BSE' }],
    ['^BSESN', { canonical: 'SENSEX', assetClass: 'INDEX', exchange: 'BSE' }],
    ['SENSEX.BO', { canonical: 'SENSEX', assetClass: 'INDEX', exchange: 'BSE' }],

    ['FINNIFTY', { canonical: 'NIFTY FINANCIAL SERVICES', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY FIN SERVICE', { canonical: 'NIFTY FINANCIAL SERVICES', assetClass: 'INDEX', exchange: 'NSE' }],
    ['MIDCPNIFTY', { canonical: 'NIFTY MIDCAP SELECT', assetClass: 'INDEX', exchange: 'NSE' }],

    ['INDIAVIX', { canonical: 'INDIA VIX', assetClass: 'INDEX', exchange: 'NSE' }],
    ['INDIA VIX', { canonical: 'INDIA VIX', assetClass: 'INDEX', exchange: 'NSE' }],
    ['^INDIAVIX', { canonical: 'INDIA VIX', assetClass: 'INDEX', exchange: 'NSE' }],

    // Sector Indices
    ['NIFTY IT', { canonical: 'NIFTY IT', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTYIT', { canonical: 'NIFTY IT', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY AUTO', { canonical: 'NIFTY AUTO', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY PHARMA', { canonical: 'NIFTY PHARMA', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY METAL', { canonical: 'NIFTY METAL', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY FMCG', { canonical: 'NIFTY FMCG', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY ENERGY', { canonical: 'NIFTY ENERGY', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY INFRA', { canonical: 'NIFTY INFRA', assetClass: 'INDEX', exchange: 'NSE' }],
    ['NIFTY REALTY', { canonical: 'NIFTY REALTY', assetClass: 'INDEX', exchange: 'NSE' }]
  ]);

  private constructor() {}

  public static getInstance(): MarketDataNormalizationEngine {
    if (!MarketDataNormalizationEngine.instance) {
      MarketDataNormalizationEngine.instance = new MarketDataNormalizationEngine();
    }
    return MarketDataNormalizationEngine.instance;
  }

  /**
   * Deterministically normalizes a raw tick into CanonicalMarketTick.
   */
  public normalizeTick(raw: RawMarketTickInput): { tick: CanonicalMarketTick; isKnownMapping: boolean } {
    const rawSym = (raw.symbol || '').trim();
    const cleanSym = rawSym.toUpperCase().replace(/\.NS$/, '').replace(/\.BO$/, '').trim();

    const lookup = this.symbolDictionary.get(rawSym.toUpperCase()) || this.symbolDictionary.get(cleanSym);
    const isKnownMapping = lookup !== undefined;

    const canonicalSymbol = lookup ? lookup.canonical : cleanSym;
    const assetClass: AssetClass = lookup 
      ? lookup.assetClass 
      : this.inferAssetClass(raw.symbol, raw.assetClass);

    const exchange: MarketExchange = lookup
      ? lookup.exchange
      : this.inferExchange(raw.exchange, raw.symbol);

    const instrumentId = raw.instrumentId || `${exchange}:${canonicalSymbol}`;

    // Normalize timestamps
    const nowIso = new Date().toISOString();
    const timestamp = this.normalizeTimestamp(raw.timestamp) || nowIso;
    const exchangeTimestamp = this.normalizeTimestamp(raw.exchangeTimestamp) || timestamp;
    const receivedTimestamp = this.normalizeTimestamp(raw.receivedTimestamp) || nowIso;

    // Sequence Number
    const sequenceNumber = typeof raw.sequenceNumber === 'number' && raw.sequenceNumber >= 0
      ? raw.sequenceNumber
      : ++MarketDataNormalizationEngine.sequenceCounter;

    // Rounding & Precision
    const lastPrice = this.roundPrice(raw.lastPrice, assetClass);
    const previousClose = raw.previousClose !== undefined && raw.previousClose !== null
      ? this.roundPrice(raw.previousClose, assetClass)
      : null;

    const open = raw.open !== undefined && raw.open !== null ? this.roundPrice(raw.open, assetClass) : null;
    const high = raw.high !== undefined && raw.high !== null ? this.roundPrice(raw.high, assetClass) : null;
    const low = raw.low !== undefined && raw.low !== null ? this.roundPrice(raw.low, assetClass) : null;

    const volume = raw.volume !== undefined && raw.volume !== null && raw.volume >= 0 ? Math.floor(raw.volume) : null;
    const tradedValue = raw.tradedValue !== undefined && raw.tradedValue !== null ? Number(raw.tradedValue.toFixed(2)) : null;

    const bidPrice = raw.bidPrice !== undefined && raw.bidPrice !== null ? this.roundPrice(raw.bidPrice, assetClass) : null;
    const askPrice = raw.askPrice !== undefined && raw.askPrice !== null ? this.roundPrice(raw.askPrice, assetClass) : null;
    const bidQuantity = raw.bidQuantity !== undefined && raw.bidQuantity !== null && raw.bidQuantity >= 0 ? Math.floor(raw.bidQuantity) : null;
    const askQuantity = raw.askQuantity !== undefined && raw.askQuantity !== null && raw.askQuantity >= 0 ? Math.floor(raw.askQuantity) : null;

    // Spread
    const spread = (bidPrice !== null && askPrice !== null)
      ? Number((askPrice - bidPrice).toFixed(2))
      : null;

    // Price Change & Percent
    let priceChange: number | null = null;
    let priceChangePercent: number | null = null;
    if (previousClose !== null && previousClose > 0) {
      priceChange = Number((lastPrice - previousClose).toFixed(2));
      priceChangePercent = Number((((lastPrice - previousClose) / previousClose) * 100).toFixed(2));
    }

    const VWAP = raw.VWAP !== undefined && raw.VWAP !== null ? this.roundPrice(raw.VWAP, assetClass) : null;

    const marketStatus: MarketSessionState = this.normalizeSessionState(raw.marketStatus);
    const source = raw.source || 'UNKNOWN_SOURCE';
    const sourcePriority: SourcePriorityLevel = raw.sourcePriority || 'P1_PRIMARY';

    const provenance = {
      source,
      sourceTimestamp: exchangeTimestamp,
      receivedTimestamp,
      normalizationVersion: 'v22_canonical_norm',
      validationVersion: 'v22_tick_validator',
      qualityVersion: 'v22_quality_gate',
      correlationId: raw.correlationId || `corr_${Date.now()}_${sequenceNumber}`,
      isModified: false
    };

    const tick: CanonicalMarketTick = {
      instrumentId,
      symbol: cleanSym,
      canonicalSymbol,
      exchange,
      assetClass,
      timestamp,
      exchangeTimestamp,
      receivedTimestamp,
      sequenceNumber,
      lastPrice,
      previousClose,
      open,
      high,
      low,
      volume,
      tradedValue,
      bidPrice,
      askPrice,
      bidQuantity,
      askQuantity,
      spread,
      priceChange,
      priceChangePercent,
      VWAP,
      marketStatus,
      source,
      sourcePriority,
      qualityStatus: 'VALID' as MarketTruthStatus,
      freshnessStatus: 'FRESH' as FreshnessStatus,
      validationStatus: 'VALID' as TickValidationStatus,
      provenance
    };

    return { tick, isKnownMapping };
  }

  private inferAssetClass(symbol: string, declaredClass?: string): AssetClass {
    if (declaredClass) {
      const upper = declaredClass.toUpperCase();
      if (['EQUITY', 'FUTURES', 'OPTIONS', 'INDEX', 'ETF', 'COMMODITY', 'CRYPTO'].includes(upper)) {
        return upper as AssetClass;
      }
    }
    const sym = symbol.toUpperCase();
    if (sym.includes('FUT') || sym.endsWith('-I') || sym.endsWith('-II')) return 'FUTURES';
    if (sym.includes('CE') || sym.includes('PE') || sym.includes('CALL') || sym.includes('PUT')) return 'OPTIONS';
    if (sym.startsWith('NIFTY') || sym.startsWith('SENSEX') || sym.startsWith('BANKNIFTY') || sym.includes('INDEX')) return 'INDEX';
    if (sym.endsWith('BEES') || sym.includes('ETF')) return 'ETF';
    if (sym.includes('GOLD') || sym.includes('CRUDE') || sym.includes('SILVER')) return 'COMMODITY';
    if (sym.includes('USDT') || sym.includes('BTC') || sym.includes('ETH')) return 'CRYPTO';
    return 'EQUITY';
  }

  private inferExchange(exchange?: string, symbol?: string): MarketExchange {
    if (exchange) {
      const ex = exchange.toUpperCase();
      if (['NSE', 'BSE', 'MCX', 'GLOBAL'].includes(ex)) return ex as MarketExchange;
    }
    const sym = (symbol || '').toUpperCase();
    if (sym.endsWith('.BO') || sym === 'SENSEX') return 'BSE';
    if (sym.endsWith('.NS') || sym.startsWith('NIFTY')) return 'NSE';
    return 'NSE';
  }

  private normalizeTimestamp(input?: string | number): string | null {
    if (!input) return null;
    if (typeof input === 'number') {
      const d = new Date(input);
      return !isNaN(d.getTime()) ? d.toISOString() : null;
    }
    const d = new Date(input);
    return !isNaN(d.getTime()) ? d.toISOString() : null;
  }

  private normalizeSessionState(status?: string): MarketSessionState {
    if (!status) return 'CONTINUOUS_TRADING';
    const s = status.toUpperCase();
    if (s.includes('PRE')) return 'PRE_OPEN';
    if (s.includes('POST')) return 'POST_MARKET';
    if (s.includes('CLOSE')) return 'CLOSED';
    if (s.includes('HALT')) return 'HALTED';
    if (s.includes('HOLIDAY')) return 'HOLIDAY';
    if (s.includes('AUCTION')) return 'AUCTION';
    return 'CONTINUOUS_TRADING';
  }

  public roundPrice(price: number, assetClass: AssetClass): number {
    if (isNaN(price) || price === null || price === undefined) return 0;
    if (assetClass === 'CRYPTO') {
      return Number(price.toFixed(4));
    }
    // Standard Indian market 0.05 tick rounding for liquid assets, or 2 decimal precision
    return Number(price.toFixed(2));
  }
}

export const marketDataNormalizationEngine = MarketDataNormalizationEngine.getInstance();
