/**
 * ATHENA NEWS ENGINE — PHASE 20
 * BrokerExecutionAdapter.ts
 * 
 * Canonical Broker Execution Adapter Interface.
 * Defines the standard contract across Zerodha KiteConnect, Binance, and Paper Simulation.
 */

import { ExecutionOrder, ExecutionMode, OrderState } from './types.ts';

export interface BrokerAccountBalance {
  totalBalanceINR: number;
  availableMarginINR: number;
  usedMarginINR: number;
  currency: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnLINR: number;
  realizedPnLINR?: number;
  side: 'LONG' | 'SHORT';
  assetClass: string;
  exchange?: string;
  leverage?: number;
  marginUsed?: number;
}

export interface BrokerQuote {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  lastTradedPrice: number;
  volume: number;
  timestamp: string;
}

export interface BrokerMarketDepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface BrokerMarketDepth {
  symbol: string;
  bids: BrokerMarketDepthLevel[];
  asks: BrokerMarketDepthLevel[];
  timestamp: string;
}

export interface BrokerMarginDetails {
  equityAvailableMargin: number;
  equityUsedMargin: number;
  commodityAvailableMargin?: number;
  commodityUsedMargin?: number;
  spanMargin?: number;
  exposureMargin?: number;
  collateralValue?: number;
  currency: string;
}

export interface BrokerHealthCheckResult {
  adapterName: string;
  broker: string;
  connected: boolean;
  authenticated: boolean;
  latencyMs: number;
  rateLimitRemaining: number;
  lastHeartbeat: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' | 'AUTHENTICATION_REQUIRED';
  errorMessage?: string;
}

export interface ExecutionFill {
  fillId: string;
  orderId: string;
  brokerOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
  exchange: string;
  executionMode: ExecutionMode;
}

export interface BrokerExecutionAdapter {
  adapterName: string;
  broker: string;
  mode: ExecutionMode;

  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  healthCheck(): Promise<BrokerHealthCheckResult>;
  isAuthenticated(): boolean;

  getAccount(): Promise<BrokerAccountBalance>;
  getBalance(): Promise<BrokerAccountBalance>;
  getPositions(): Promise<BrokerPosition[]>;
  getOpenOrders(): Promise<ExecutionOrder[]>;
  getOrderStatus(orderId: string): Promise<ExecutionOrder | null>;
  
  placeOrder(order: ExecutionOrder): Promise<ExecutionOrder>;
  submitOrder(order: ExecutionOrder): Promise<ExecutionOrder>; // Backwards compatible alias
  modifyOrder(orderId: string, newQuantity: number, newPrice: number): Promise<ExecutionOrder>;
  cancelOrder(orderId: string): Promise<boolean>;
  
  getTradeBook(): Promise<ExecutionFill[]>;
  getMargins(): Promise<BrokerMarginDetails>;
  getQuote(symbol: string): Promise<BrokerQuote>;
  getMarketDepth(symbol: string): Promise<BrokerMarketDepth>;
}
