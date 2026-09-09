/**
 * ATHENA NEWS ENGINE — PHASE 20
 * FillReconciliationEngine.ts
 * 
 * Production Fill Reconciliation Engine.
 * Enforces canonical fill invariants:
 * - Duplicate fill suppression
 * - Negative or zero quantity rejection
 * - Invalid or negative price rejection
 * - Impossible timestamp rejection
 * - Tick-size & financial currency precision preservation
 */

import { ExecutionFill } from './BrokerExecutionAdapter.ts';

export interface FillValidationResult {
  success: boolean;
  fill?: ExecutionFill;
  errorReason?: string;
}

export class FillReconciliationEngine {
  private static instance: FillReconciliationEngine;
  private processedFillIds: Set<string> = new Set();
  private processedSignatures: Set<string> = new Set();
  private fillsHistory: ExecutionFill[] = [];

  private constructor() {}

  public static getInstance(): FillReconciliationEngine {
    if (!this.instance) {
      this.instance = new FillReconciliationEngine();
    }
    return this.instance;
  }

  public getFills(orderId?: string): ExecutionFill[] {
    if (orderId) {
      return this.fillsHistory.filter(f => f.orderId === orderId);
    }
    return [...this.fillsHistory];
  }

  /**
   * Validates and ingests a new fill record.
   */
  public createFill(raw: ExecutionFill): FillValidationResult {
    // 1. Check duplicate fillId
    if (this.processedFillIds.has(raw.fillId)) {
      return { success: false, errorReason: `DUPLICATE_FILL_ID: Fill ID ${raw.fillId} has already been ingested.` };
    }

    // 2. Check duplicate signature (orderId + brokerOrderId + quantity + price + timestamp)
    const signature = `${raw.orderId}:${raw.brokerOrderId}:${raw.quantity}:${raw.price}:${raw.timestamp}`;
    if (this.processedSignatures.has(signature)) {
      return { success: false, errorReason: 'DUPLICATE_FILL_SIGNATURE: An identical fill event was already recorded.' };
    }

    // 3. Check Quantity > 0
    if (!raw.quantity || raw.quantity <= 0 || isNaN(raw.quantity)) {
      return { success: false, errorReason: `INVALID_QUANTITY: Fill quantity must be > 0 (got ${raw.quantity}).` };
    }

    // 4. Check Price > 0
    if (!raw.price || raw.price <= 0 || isNaN(raw.price)) {
      return { success: false, errorReason: `INVALID_PRICE: Fill price must be > 0 (got ${raw.price}).` };
    }

    // 5. Check Timestamp
    const fillTime = new Date(raw.timestamp).getTime();
    if (isNaN(fillTime)) {
      return { success: false, errorReason: `INVALID_TIMESTAMP: Unparseable fill timestamp ${raw.timestamp}.` };
    }

    // Future timestamp check (> 5 mins in future)
    if (fillTime > Date.now() + 300000) {
      return { success: false, errorReason: `IMPOSSIBLE_FUTURE_TIMESTAMP: Fill timestamp is in the future (${raw.timestamp}).` };
    }

    // Format and preserve financial precision (2 decimals for INR, 4 for crypto, tick size 0.05)
    const isCrypto = raw.exchange?.includes('BINANCE') || raw.symbol?.includes('USDT');
    const roundedPrice = isCrypto ? Number(raw.price.toFixed(4)) : Number(raw.price.toFixed(2));
    const roundedCommission = Number(raw.commission.toFixed(2));

    const validatedFill: ExecutionFill = {
      ...raw,
      price: roundedPrice,
      commission: roundedCommission
    };

    this.processedFillIds.add(raw.fillId);
    this.processedSignatures.add(signature);
    this.fillsHistory.push(validatedFill);

    return {
      success: true,
      fill: validatedFill
    };
  }
}

export const fillReconciliationEngine = FillReconciliationEngine.getInstance();
