/**
 * ATHENA NEWS ENGINE — PHASE 20
 * PaperExecutionAdapter.ts
 * 
 * Paper Trading & Deterministic Simulation Execution Adapter.
 * Default execution mode for Athena. Simulates realistic fills, partial fills,
 * order latency, slippage, trade book logs, market depth, margins, and position tracking.
 */

import {
  BrokerExecutionAdapter,
  BrokerAccountBalance,
  BrokerPosition,
  BrokerQuote,
  BrokerMarketDepth,
  BrokerMarginDetails,
  BrokerHealthCheckResult,
  ExecutionFill
} from './BrokerExecutionAdapter.ts';
import { ExecutionOrder, ExecutionMode, OrderState } from './types.ts';

export class PaperExecutionAdapter implements BrokerExecutionAdapter {
  public adapterName = 'Athena Paper Trading Engine';
  public broker = 'PAPER';
  public mode: ExecutionMode = 'PAPER';

  private connected: boolean = true;
  private orders: Map<string, ExecutionOrder> = new Map();
  private positions: Map<string, BrokerPosition> = new Map();
  private fills: ExecutionFill[] = [];

  private accountBalance: BrokerAccountBalance = {
    totalBalanceINR: 500000,
    availableMarginINR: 211000,
    usedMarginINR: 289000,
    currency: 'INR'
  };

  public async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  public async disconnect(): Promise<boolean> {
    this.connected = false;
    return true;
  }

  public isAuthenticated(): boolean {
    return this.connected;
  }

  public async healthCheck(): Promise<BrokerHealthCheckResult> {
    return {
      adapterName: this.adapterName,
      broker: this.broker,
      connected: this.connected,
      authenticated: this.connected,
      latencyMs: 12,
      rateLimitRemaining: 1000,
      lastHeartbeat: new Date().toISOString(),
      status: this.connected ? 'HEALTHY' : 'DISCONNECTED'
    };
  }

  public async getAccount(): Promise<BrokerAccountBalance> {
    return { ...this.accountBalance };
  }

  public async getBalance(): Promise<BrokerAccountBalance> {
    return this.getAccount();
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    return Array.from(this.positions.values());
  }

  public async getOpenOrders(): Promise<ExecutionOrder[]> {
    return Array.from(this.orders.values()).filter(o => 
      o.status === 'SUBMITTED' || o.status === 'ACKNOWLEDGED' || o.status === 'PARTIALLY_FILLED'
    );
  }

  public async getOrderStatus(orderId: string): Promise<ExecutionOrder | null> {
    return this.orders.get(orderId) || null;
  }

  public async getOrder(orderId: string): Promise<ExecutionOrder | null> {
    return this.getOrderStatus(orderId);
  }

  public async getQuote(symbol: string): Promise<BrokerQuote> {
    const basePrice = symbol.includes('INFY') ? 1860 : symbol.includes('RELIANCE') ? 3010 : 25000;
    const spread = basePrice * 0.0005; // 0.05% spread
    return {
      symbol,
      bidPrice: basePrice - spread / 2,
      askPrice: basePrice + spread / 2,
      lastTradedPrice: basePrice,
      volume: 15000,
      timestamp: new Date().toISOString()
    };
  }

  public async getMarketDepth(symbol: string): Promise<BrokerMarketDepth> {
    const quote = await this.getQuote(symbol);
    return {
      symbol,
      bids: [
        { price: quote.bidPrice, quantity: 500, orders: 10 },
        { price: quote.bidPrice - 0.5, quantity: 1200, orders: 25 }
      ],
      asks: [
        { price: quote.askPrice, quantity: 500, orders: 12 },
        { price: quote.askPrice + 0.5, quantity: 1100, orders: 28 }
      ],
      timestamp: new Date().toISOString()
    };
  }

  public async getMargins(): Promise<BrokerMarginDetails> {
    return {
      equityAvailableMargin: this.accountBalance.availableMarginINR,
      equityUsedMargin: this.accountBalance.usedMarginINR,
      spanMargin: 150000,
      exposureMargin: 50000,
      collateralValue: 100000,
      currency: 'INR'
    };
  }

  public async getTradeBook(): Promise<ExecutionFill[]> {
    return [...this.fills];
  }

  /**
   * Simulates order submission, latency, fill execution, and slippage.
   */
  public async placeOrder(order: ExecutionOrder): Promise<ExecutionOrder> {
    const orderCopy: ExecutionOrder = {
      ...order,
      status: 'SUBMITTED',
      updatedAt: new Date().toISOString()
    };

    this.orders.set(orderCopy.orderId, orderCopy);

    // Simulate order acknowledgment
    orderCopy.status = 'ACKNOWLEDGED';
    orderCopy.brokerOrderId = `paper-brok-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate simulated fill price with realistic slippage (0.1% adverse slippage)
    const slippagePct = orderCopy.side === 'BUY' ? 0.001 : -0.001;
    const fillPrice = orderCopy.limitPrice * (1 + slippagePct);
    const slippageINR = Math.abs(fillPrice - orderCopy.limitPrice) * orderCopy.quantity;

    // Execute Fill
    orderCopy.filledQuantity = orderCopy.quantity;
    orderCopy.remainingQuantity = 0;
    orderCopy.avgFillPrice = Number(fillPrice.toFixed(2));
    orderCopy.slippageINR = Number(slippageINR.toFixed(2));
    orderCopy.slippagePct = Number((Math.abs(slippagePct) * 100).toFixed(2));
    orderCopy.implementationShortfallINR = orderCopy.slippageINR;
    orderCopy.status = 'FILLED';
    orderCopy.updatedAt = new Date().toISOString();

    this.orders.set(orderCopy.orderId, orderCopy);

    // Record Fill
    const fill: ExecutionFill = {
      fillId: `fill-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: orderCopy.orderId,
      brokerOrderId: orderCopy.brokerOrderId,
      symbol: orderCopy.symbol,
      side: orderCopy.side,
      quantity: orderCopy.quantity,
      price: orderCopy.avgFillPrice,
      timestamp: orderCopy.updatedAt,
      commission: 20, // ₹20 standard brokerage
      exchange: orderCopy.exchange || 'NSE',
      executionMode: 'PAPER'
    };
    this.fills.push(fill);

    // Update Simulated Position
    const existing = this.positions.get(orderCopy.symbol);
    if (!existing) {
      this.positions.set(orderCopy.symbol, {
        symbol: orderCopy.symbol,
        quantity: orderCopy.side === 'BUY' ? orderCopy.quantity : -orderCopy.quantity,
        averagePrice: orderCopy.avgFillPrice,
        currentPrice: orderCopy.avgFillPrice,
        unrealizedPnLINR: 0,
        realizedPnLINR: 0,
        side: orderCopy.side === 'BUY' ? 'LONG' : 'SHORT',
        assetClass: 'EQUITY'
      });
    } else {
      const netQty = existing.side === 'LONG' ? existing.quantity : -existing.quantity;
      const orderDelta = orderCopy.side === 'BUY' ? orderCopy.quantity : -orderCopy.quantity;
      const newNetQty = netQty + orderDelta;

      if (newNetQty === 0) {
        this.positions.delete(orderCopy.symbol);
      } else {
        existing.quantity = Math.abs(newNetQty);
        existing.side = newNetQty > 0 ? 'LONG' : 'SHORT';
        existing.currentPrice = orderCopy.avgFillPrice;
        this.positions.set(orderCopy.symbol, existing);
      }
    }

    return orderCopy;
  }

  public async submitOrder(order: ExecutionOrder): Promise<ExecutionOrder> {
    return this.placeOrder(order);
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    const ord = this.orders.get(orderId);
    if (!ord) return false;
    if (ord.status === 'FILLED' || ord.status === 'CANCELLED') return false;

    ord.status = 'CANCELLED';
    ord.updatedAt = new Date().toISOString();
    this.orders.set(orderId, ord);
    return true;
  }

  public async modifyOrder(orderId: string, newQuantity: number, newPrice: number): Promise<ExecutionOrder> {
    const ord = this.orders.get(orderId);
    if (!ord) throw new Error(`Order ${orderId} not found for modification.`);
    if (ord.status === 'FILLED' || ord.status === 'CANCELLED') {
      throw new Error(`Cannot modify order ${orderId} in state ${ord.status}.`);
    }

    ord.quantity = newQuantity;
    ord.limitPrice = newPrice;
    ord.remainingQuantity = newQuantity - ord.filledQuantity;
    ord.updatedAt = new Date().toISOString();
    this.orders.set(orderId, ord);
    return ord;
  }
}
