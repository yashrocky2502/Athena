/**
 * ATHENA NEWS ENGINE — PHASE 20
 * types.ts (Market Data Engine)
 * 
 * Defines canonical market data streaming types, quality states, depth, trades, and adapter interfaces.
 */

export type MarketDataPayloadType = 'TICK' | 'QUOTE' | 'DEPTH' | 'TRADE' | 'ORDER_BOOK';

export type MarketDataHealthStatus = 'DATA_HEALTHY' | 'DATA_DEGRADED' | 'DATA_STALE' | 'DATA_DISCONNECTED';

export interface MarketTick {
  type: 'TICK';
  symbol: string;
  exchange: string;
  source: string;
  lastPrice: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume: number;
  timestamp: string;
  sequenceNumber?: number;
}

export interface MarketDepthLevel {
  price: number;
  quantity: number;
  ordersCount: number;
}

export interface MarketDepth {
  type: 'DEPTH';
  symbol: string;
  exchange: string;
  source: string;
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
  timestamp: string;
  sequenceNumber?: number;
}

export interface MarketQuote {
  type: 'QUOTE';
  symbol: string;
  exchange: string;
  source: string;
  bidPrice: number;
  bidQuantity: number;
  askPrice: number;
  askQuantity: number;
  lastPrice: number;
  volume: number;
  timestamp: string;
}

export interface MarketTrade {
  type: 'TRADE';
  tradeId: string;
  symbol: string;
  exchange: string;
  source: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: string;
}

export interface MarketDataQualityReport {
  symbol: string;
  status: MarketDataHealthStatus;
  lastTickAgeMs: number;
  stalenessThresholdMs: number;
  isStale: boolean;
  hasPriceDiscontinuity: boolean;
  hasVolumeAnomaly: boolean;
  hasTimestampGaps: boolean;
  hasOutOfOrderTicks: boolean;
  isDisconnected: boolean;
  warnings: string[];
  evaluatedAt: string;
}

export interface MarketDataAdapter {
  adapterName: string;
  exchange: string;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected(): boolean;
  subscribeQuotes(symbols: string[]): void;
  subscribeDepth(symbol: string): void;
  subscribeTrades(symbol: string): void;
  unsubscribe(symbols: string[]): void;
  getQuote(symbol: string): Promise<MarketQuote>;
  getDepth(symbol: string): Promise<MarketDepth>;
  healthCheck(): MarketDataHealthStatus;
}
