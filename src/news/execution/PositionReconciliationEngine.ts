/**
 * ATHENA NEWS ENGINE — PHASE 20
 * PositionReconciliationEngine.ts
 * 
 * Production Position Reconciliation & Synchronization Engine.
 * Audits ATHENA Internal Expected Positions vs Broker Actual Positions.
 * Computes exact quantity, price, notional, realized/unrealized PnL, and margin drifts.
 * Classifies into MATCHED, MINOR_DRIFT, MATERIAL_DRIFT, and CRITICAL_MISMATCH.
 * Fails closed by blocking new live executions when CRITICAL_MISMATCH is detected.
 */

import { PositionReconciliationReport, ReconciliationMismatch } from './types.ts';
import { BrokerPosition } from './BrokerExecutionAdapter.ts';
import { RawPortfolioPosition } from '../portfolio/types.ts';

export type PositionDriftClassification = 'MATCHED' | 'MINOR_DRIFT' | 'MATERIAL_DRIFT' | 'CRITICAL_MISMATCH';

export interface DetailedPositionReconciliationItem {
  symbol: string;
  classification: PositionDriftClassification;
  quantityDiff: number;
  avgPriceDiff: number;
  directionDiff: boolean;
  notionalDiffINR: number;
  realizedPnLDiffINR: number;
  unrealizedPnLDiffINR: number;
  athenaQuantity: number;
  brokerQuantity: number;
  athenaAvgPrice: number;
  brokerAvgPrice: number;
  description: string;
}

export interface DetailedPositionReconciliationReport {
  timestamp: string;
  overallClassification: PositionDriftClassification;
  totalAthenaPositions: number;
  totalBrokerPositions: number;
  items: DetailedPositionReconciliationItem[];
  mismatches: ReconciliationMismatch[];
  isExecutionBlocked: boolean;
  blockReason?: string;
}

export class PositionReconciliationEngine {
  private static instance: PositionReconciliationEngine;
  private lastReport?: DetailedPositionReconciliationReport;
  private hasCriticalMismatch: boolean = false;

  private constructor() {}

  public static getInstance(): PositionReconciliationEngine {
    if (!this.instance) {
      this.instance = new PositionReconciliationEngine();
    }
    return this.instance;
  }

  public hasActiveCriticalMismatch(): boolean {
    return this.hasCriticalMismatch;
  }

  public getLastReport(): DetailedPositionReconciliationReport | undefined {
    return this.lastReport;
  }

  /**
   * Reconciles internal Athena expected positions with live broker positions.
   * Purely observational — does NOT modify broker accounts.
   */
  public reconcilePositions(
    athenaPositions: RawPortfolioPosition[],
    brokerPositions: BrokerPosition[]
  ): DetailedPositionReconciliationReport {
    const timestamp = new Date().toISOString();
    const items: DetailedPositionReconciliationItem[] = [];
    const mismatches: ReconciliationMismatch[] = [];

    const athenaMap = new Map<string, RawPortfolioPosition>();
    athenaPositions.forEach(p => athenaMap.set(p.symbol, p));

    const brokerMap = new Map<string, BrokerPosition>();
    brokerPositions.forEach(p => brokerMap.set(p.symbol, p));

    const allSymbols = new Set([...athenaMap.keys(), ...brokerMap.keys()]);

    let worstClassification: PositionDriftClassification = 'MATCHED';

    for (const symbol of allSymbols) {
      const athenaPos = athenaMap.get(symbol);
      const brokerPos = brokerMap.get(symbol);

      const aQty = athenaPos ? athenaPos.quantity : 0;
      const bQty = brokerPos ? (brokerPos.side === 'SHORT' ? -brokerPos.quantity : brokerPos.quantity) : 0;
      const aPrice = athenaPos ? athenaPos.entryPrice : 0;
      const bPrice = brokerPos ? brokerPos.averagePrice : 0;
      const aDirection = athenaPos ? (athenaPos.quantity >= 0 ? 'LONG' : 'SHORT') : 'NONE';
      const bDirection = brokerPos ? brokerPos.side : 'NONE';

      const quantityDiff = bQty - (athenaPos ? athenaPos.quantity : 0);
      const avgPriceDiff = bPrice - aPrice;
      const directionDiff = aDirection !== 'NONE' && bDirection !== 'NONE' && aDirection !== bDirection;
      const notionalDiffINR = Math.abs(bQty * bPrice - aQty * aPrice);
      const realizedPnLDiffINR = Math.abs((brokerPos?.realizedPnLINR || 0) - (athenaPos?.realizedPnLINR || 0));
      const unrealizedPnLDiffINR = Math.abs((brokerPos?.unrealizedPnLINR || 0) - (athenaPos?.unrealizedPnLINR || 0));

      let classification: PositionDriftClassification = 'MATCHED';
      let description = `Position ${symbol} is in perfect sync.`;

      if (!brokerPos && athenaPos) {
        classification = 'CRITICAL_MISMATCH';
        description = `MISSING_IN_BROKER: Athena expects ${aQty} of ${symbol}, but missing in broker.`;
        mismatches.push({
          symbol,
          expectedQuantity: aQty,
          brokerQuantity: 0,
          quantityDelta: -aQty,
          expectedAvgPrice: aPrice,
          brokerAvgPrice: 0,
          priceDelta: -aPrice,
          mismatchType: 'MISSING_IN_ATHENA',
          severity: 'CRITICAL',
          description
        });
      } else if (brokerPos && !athenaPos) {
        classification = 'CRITICAL_MISMATCH';
        description = `UNEXPECTED_IN_BROKER: Broker has ${bQty} of ${symbol} not tracked in Athena.`;
        mismatches.push({
          symbol,
          expectedQuantity: 0,
          brokerQuantity: Math.abs(bQty),
          quantityDelta: bQty,
          expectedAvgPrice: 0,
          brokerAvgPrice: bPrice,
          priceDelta: bPrice,
          mismatchType: 'UNEXPECTED_IN_BROKER',
          severity: 'CRITICAL',
          description
        });
      } else if (directionDiff) {
        classification = 'CRITICAL_MISMATCH';
        description = `DIRECTION_MISMATCH: Athena direction is ${aDirection}, Broker direction is ${bDirection}.`;
      } else if (Math.abs(quantityDiff) > 0) {
        const qtyPct = Math.abs(quantityDiff / (aQty || 1)) * 100;
        if (qtyPct > 5) {
          classification = 'CRITICAL_MISMATCH';
          description = `CRITICAL_QUANTITY_DRIFT: Qty delta is ${quantityDiff} (${qtyPct.toFixed(1)}%).`;
        } else {
          classification = 'MATERIAL_DRIFT';
          description = `MATERIAL_QUANTITY_DRIFT: Minor quantity delta ${quantityDiff}.`;
        }
        mismatches.push({
          symbol,
          expectedQuantity: aQty,
          brokerQuantity: Math.abs(bQty),
          quantityDelta: quantityDiff,
          expectedAvgPrice: aPrice,
          brokerAvgPrice: bPrice,
          priceDelta: avgPriceDiff,
          mismatchType: 'QUANTITY_MISMATCH',
          severity: classification === 'CRITICAL_MISMATCH' ? 'CRITICAL' : 'WARNING',
          description
        });
      } else if (Math.abs(avgPriceDiff) > 0) {
        const pricePct = Math.abs(avgPriceDiff / (aPrice || 1)) * 100;
        if (pricePct > 2.0) {
          classification = 'MATERIAL_DRIFT';
          description = `MATERIAL_PRICE_DRIFT: Price differs by ${pricePct.toFixed(2)}%.`;
        } else {
          classification = 'MINOR_DRIFT';
          description = `MINOR_PRICE_DRIFT: Price differs by ${pricePct.toFixed(2)}%.`;
        }
      }

      items.push({
        symbol,
        classification,
        quantityDiff,
        avgPriceDiff,
        directionDiff,
        notionalDiffINR,
        realizedPnLDiffINR,
        unrealizedPnLDiffINR,
        athenaQuantity: aQty,
        brokerQuantity: bQty,
        athenaAvgPrice: aPrice,
        brokerAvgPrice: bPrice,
        description
      });

      if (classification === 'CRITICAL_MISMATCH') {
        worstClassification = 'CRITICAL_MISMATCH';
      } else if (classification === 'MATERIAL_DRIFT' && worstClassification !== 'CRITICAL_MISMATCH') {
        worstClassification = 'MATERIAL_DRIFT';
      } else if (classification === 'MINOR_DRIFT' && worstClassification === 'MATCHED') {
        worstClassification = 'MINOR_DRIFT';
      }
    }

    this.hasCriticalMismatch = worstClassification === 'CRITICAL_MISMATCH';

    const report: DetailedPositionReconciliationReport = {
      timestamp,
      overallClassification: worstClassification,
      totalAthenaPositions: athenaPositions.length,
      totalBrokerPositions: brokerPositions.length,
      items,
      mismatches,
      isExecutionBlocked: this.hasCriticalMismatch,
      blockReason: this.hasCriticalMismatch ? 'Execution blocked due to CRITICAL position mismatch between Athena and Broker.' : undefined
    };

    this.lastReport = report;
    return report;
  }
}

export const positionReconciliationEngine = PositionReconciliationEngine.getInstance();
