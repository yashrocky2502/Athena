/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * OrderBookTruthEngine.ts
 * 
 * Deterministic order book depth validator and liquidity metric calculator.
 * ZERO-AI: Microstructure depth math and invariant verification.
 */

import {
  CanonicalOrderBook,
  CanonicalOrderBookLevel,
  TickValidationStatus
} from './types.ts';

export interface RawOrderBookInput {
  symbol: string;
  timestamp?: string;
  bids: { price: number; quantity: number; ordersCount?: number }[];
  asks: { price: number; quantity: number; ordersCount?: number }[];
  sequenceNumber?: number;
}

export class OrderBookTruthEngine {
  private static instance: OrderBookTruthEngine;

  private constructor() {}

  public static getInstance(): OrderBookTruthEngine {
    if (!OrderBookTruthEngine.instance) {
      OrderBookTruthEngine.instance = new OrderBookTruthEngine();
    }
    return OrderBookTruthEngine.instance;
  }

  /**
   * Validates and constructs CanonicalOrderBook from raw depth arrays.
   */
  public processOrderBook(raw: RawOrderBookInput, referenceTimeMs: number = Date.now()): CanonicalOrderBook {
    const symbol = raw.symbol;
    const timestamp = raw.timestamp || new Date().toISOString();
    const timeMs = new Date(timestamp).getTime();
    const isStale = !isNaN(timeMs) && (referenceTimeMs - timeMs > 10000);

    const validBids: CanonicalOrderBookLevel[] = [];
    const validAsks: CanonicalOrderBookLevel[] = [];

    // Filter and sanitize Bids
    for (const b of (raw.bids || [])) {
      if (typeof b.price === 'number' && b.price > 0 && typeof b.quantity === 'number' && b.quantity >= 0) {
        validBids.push({
          price: Number(b.price.toFixed(2)),
          quantity: Math.floor(b.quantity),
          ordersCount: b.ordersCount
        });
      }
    }

    // Filter and sanitize Asks
    for (const a of (raw.asks || [])) {
      if (typeof a.price === 'number' && a.price > 0 && typeof a.quantity === 'number' && a.quantity >= 0) {
        validAsks.push({
          price: Number(a.price.toFixed(2)),
          quantity: Math.floor(a.quantity),
          ordersCount: a.ordersCount
        });
      }
    }

    // Sort Bids descending (highest bid first)
    validBids.sort((a, b) => b.price - a.price);
    // Sort Asks ascending (lowest ask first)
    validAsks.sort((a, b) => a.price - b.price);

    const bestBid = validBids.length > 0 ? validBids[0].price : null;
    const bestAsk = validAsks.length > 0 ? validAsks[0].price : null;
    const bestBidQty = validBids.length > 0 ? validBids[0].quantity : 0;
    const bestAskQty = validAsks.length > 0 ? validAsks[0].quantity : 0;

    let spread: number | null = null;
    let spreadPercent: number | null = null;
    let isCrossed = false;
    let isLocked = false;
    let validationStatus: TickValidationStatus = 'VALID';

    if (bestBid !== null && bestAsk !== null) {
      spread = Number((bestAsk - bestBid).toFixed(2));
      const mid = (bestBid + bestAsk) / 2;
      spreadPercent = mid > 0 ? Number(((spread / mid) * 100).toFixed(4)) : null;

      if (bestBid > bestAsk) {
        isCrossed = true;
        validationStatus = 'CROSSED_MARKET';
      } else if (bestBid === bestAsk) {
        isLocked = true;
      }
    } else {
      validationStatus = 'ANOMALOUS';
    }

    // Calculate Top of Book Liquidity
    const topOfBookLiquidity = bestBidQty + bestAskQty;

    // Calculate Order Book Imbalance (Top of Book)
    // Range: -1.0 (100% Ask heavy) to +1.0 (100% Bid heavy)
    const totalTopQty = bestBidQty + bestAskQty;
    const orderBookImbalance = totalTopQty > 0
      ? Number(((bestBidQty - bestAskQty) / totalTopQty).toFixed(4))
      : 0;

    // Calculate Full Depth Imbalance
    const totalBidDepth = validBids.reduce((sum, b) => sum + b.quantity, 0);
    const totalAskDepth = validAsks.reduce((sum, a) => sum + a.quantity, 0);
    const totalDepth = totalBidDepth + totalAskDepth;
    const depthImbalance = totalDepth > 0
      ? Number(((totalBidDepth - totalAskDepth) / totalDepth).toFixed(4))
      : 0;

    // Calculate Volume-Weighted Mid-Price (VWMP)
    let weightedMidPrice: number | null = null;
    if (bestBid !== null && bestAsk !== null && totalTopQty > 0) {
      weightedMidPrice = Number((((bestBid * bestAskQty) + (bestAsk * bestBidQty)) / totalTopQty).toFixed(2));
    }

    return {
      symbol,
      timestamp,
      bids: validBids.slice(0, 10), // Top 10 levels
      asks: validAsks.slice(0, 10), // Top 10 levels
      bestBid,
      bestAsk,
      spread,
      spreadPercent,
      topOfBookLiquidity,
      depthImbalance,
      weightedMidPrice,
      orderBookImbalance,
      isCrossed,
      isLocked,
      isStale,
      validationStatus
    };
  }
}

export const orderBookTruthEngine = OrderBookTruthEngine.getInstance();
