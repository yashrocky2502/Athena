/**
 * ATHENA NEWS ENGINE — PHASE 20
 * OrderReconciliationEngine.ts
 * 
 * Idempotent Order Reconciliation Engine.
 * Reconciles internal Athena orders with external broker execution responses.
 * Guarantees that duplicate responses from REST or WebSocket never cause duplicate fills or state corruption.
 */

import { ExecutionOrder, OrderState } from './types.ts';
import { ExecutionFill } from './BrokerExecutionAdapter.ts';
import { fillReconciliationEngine } from './FillReconciliationEngine.ts';

export interface BrokerOrderSnapshot {
  brokerOrderId: string;
  clientOrderId?: string;
  exchangeOrderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  status: OrderState;
  requestedQuantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  avgFillPrice: number;
  limitPrice: number;
  commissionINR?: number;
  rejectReason?: string;
  timestamp: string;
}

export interface OrderReconciliationResult {
  orderId: string;
  brokerOrderId?: string;
  isSynchronized: boolean;
  stateTransition: {
    from: OrderState;
    to: OrderState;
  };
  newFillsGenerated: ExecutionFill[];
  isDuplicateResponse: boolean;
  warnings: string[];
  reconciledAt: string;
}

export class OrderReconciliationEngine {
  private static instance: OrderReconciliationEngine;
  private internalOrders: Map<string, ExecutionOrder> = new Map();
  private processedBrokerResponses: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): OrderReconciliationEngine {
    if (!this.instance) {
      this.instance = new OrderReconciliationEngine();
    }
    return this.instance;
  }

  public registerOrder(order: ExecutionOrder): void {
    this.internalOrders.set(order.orderId, { ...order });
  }

  public getOrder(orderId: string): ExecutionOrder | undefined {
    return this.internalOrders.get(orderId);
  }

  /**
   * Idempotently reconciles a broker response with the internal order.
   */
  public reconcileOrder(
    internalOrderId: string,
    brokerSnapshot: BrokerOrderSnapshot
  ): OrderReconciliationResult {
    const now = new Date().toISOString();
    const order = this.internalOrders.get(internalOrderId);
    const warnings: string[] = [];
    const newFills: ExecutionFill[] = [];

    if (!order) {
      warnings.push(`UNKNOWN_ORDER: No internal order found for ${internalOrderId}.`);
      return {
        orderId: internalOrderId,
        brokerOrderId: brokerSnapshot.brokerOrderId,
        isSynchronized: false,
        stateTransition: { from: 'FAILED', to: 'FAILED' },
        newFillsGenerated: [],
        isDuplicateResponse: false,
        warnings,
        reconciledAt: now
      };
    }

    // Check idempotency signature
    const responseSignature = `${internalOrderId}:${brokerSnapshot.brokerOrderId}:${brokerSnapshot.status}:${brokerSnapshot.filledQuantity}:${brokerSnapshot.avgFillPrice}`;
    if (this.processedBrokerResponses.has(responseSignature)) {
      return {
        orderId: internalOrderId,
        brokerOrderId: brokerSnapshot.brokerOrderId,
        isSynchronized: true,
        stateTransition: { from: order.status, to: order.status },
        newFillsGenerated: [],
        isDuplicateResponse: true,
        warnings: ['IDEMPOTENT_NOOP: Broker response already processed previously.'],
        reconciledAt: now
      };
    }
    this.processedBrokerResponses.add(responseSignature);

    const oldStatus = order.status;
    const oldFilledQty = order.filledQuantity;

    // Detect incremental fill
    const fillQtyDelta = brokerSnapshot.filledQuantity - oldFilledQty;
    if (fillQtyDelta > 0 && brokerSnapshot.avgFillPrice > 0) {
      const fillRes = fillReconciliationEngine.createFill({
        fillId: `fill-${brokerSnapshot.brokerOrderId}-${Date.now()}`,
        orderId: order.orderId,
        brokerOrderId: brokerSnapshot.brokerOrderId,
        symbol: order.symbol,
        side: order.side,
        quantity: fillQtyDelta,
        price: brokerSnapshot.avgFillPrice,
        timestamp: brokerSnapshot.timestamp || now,
        commission: brokerSnapshot.commissionINR || 20,
        exchange: order.exchange || 'NSE',
        executionMode: 'PAPER'
      });

      if (fillRes.success && fillRes.fill) {
        newFills.push(fillRes.fill);
      } else {
        warnings.push(`FILL_REJECTED: ${fillRes.errorReason}`);
      }
    }

    // Update internal order state
    order.brokerOrderId = brokerSnapshot.brokerOrderId;
    order.status = brokerSnapshot.status;
    order.filledQuantity = brokerSnapshot.filledQuantity;
    order.remainingQuantity = Math.max(0, order.quantity - order.filledQuantity);
    order.avgFillPrice = brokerSnapshot.avgFillPrice;
    if (brokerSnapshot.rejectReason) {
      order.rejectionReason = brokerSnapshot.rejectReason;
    }
    order.updatedAt = now;

    this.internalOrders.set(order.orderId, order);

    return {
      orderId: internalOrderId,
      brokerOrderId: brokerSnapshot.brokerOrderId,
      isSynchronized: true,
      stateTransition: { from: oldStatus, to: order.status },
      newFillsGenerated: newFills,
      isDuplicateResponse: false,
      warnings,
      reconciledAt: now
    };
  }
}

export const orderReconciliationEngine = OrderReconciliationEngine.getInstance();
