/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * PortfolioReconciliationEngine.ts
 * 
 * Multi-Source Cross-Reconciliation Engine.
 * Reconciles Live Broker State (Zerodha) vs Imported External State (Excel/CSV)
 * vs Canonical Internal State.
 * 
 * Invariant: Discrepancies are highlighted with audit trail and never silently auto-corrected.
 */

import crypto from 'node:crypto';
import {
  CanonicalPortfolioState,
  CanonicalHolding,
  CanonicalPosition,
  PortfolioReconciliationReport,
  ReconciliationDiscrepancy,
  PortfolioSourceType
} from './types.ts';

export class PortfolioReconciliationEngine {
  private static instance: PortfolioReconciliationEngine;

  public static getInstance(): PortfolioReconciliationEngine {
    if (!this.instance) {
      this.instance = new PortfolioReconciliationEngine();
    }
    return this.instance;
  }

  /**
   * Reconciles Live Broker state against an external imported reference dataset.
   */
  public reconcileSources(params: {
    brokerState: CanonicalPortfolioState;
    externalHoldings?: CanonicalHolding[];
    externalPositions?: CanonicalPosition[];
    externalSourceName?: PortfolioSourceType;
  }): PortfolioReconciliationReport {
    const now = new Date().toISOString();
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const sourceName = params.externalSourceName || 'EXCEL';

    const brokerHoldingsMap = new Map<string, CanonicalHolding>();
    for (const h of params.brokerState.holdings) {
      brokerHoldingsMap.set(h.symbol.toUpperCase(), h);
    }

    const brokerPositionsMap = new Map<string, CanonicalPosition>();
    for (const p of params.brokerState.positions) {
      brokerPositionsMap.set(p.symbol.toUpperCase(), p);
    }

    // 1. Reconcile Holdings
    if (params.externalHoldings) {
      for (const extH of params.externalHoldings) {
        const symbol = extH.symbol.toUpperCase();
        const brokerH = brokerHoldingsMap.get(symbol);

        if (!brokerH) {
          discrepancies.push({
            id: `DISC_MISSING_BROKER_${symbol}_${Date.now()}`,
            symbol,
            field: 'MISSING_SYMBOL',
            severity: 'WARNING',
            brokerValue: null,
            externalValue: `${extH.quantity} shares @ ₹${extH.averagePrice}`,
            difference: extH.quantity,
            message: `Symbol ${symbol} exists in ${sourceName} (${extH.quantity} qty) but was not found in Zerodha live holdings.`,
            timestamp: now
          });
        } else {
          // Check Quantity
          if (brokerH.quantity !== extH.quantity) {
            discrepancies.push({
              id: `DISC_QTY_${symbol}_${Date.now()}`,
              symbol,
              field: 'QUANTITY',
              severity: 'CRITICAL',
              brokerValue: brokerH.quantity,
              externalValue: extH.quantity,
              difference: brokerH.quantity - extH.quantity,
              message: `Quantity discrepancy on ${symbol}: Broker has ${brokerH.quantity}, ${sourceName} has ${extH.quantity}.`,
              timestamp: now
            });
          }

          // Check Average Price (allowing slight tolerance < 1%)
          const priceDiffPct = Math.abs(brokerH.averagePrice - extH.averagePrice) / brokerH.averagePrice;
          if (priceDiffPct > 0.01) {
            discrepancies.push({
              id: `DISC_AVG_PRICE_${symbol}_${Date.now()}`,
              symbol,
              field: 'AVERAGE_PRICE',
              severity: 'WARNING',
              brokerValue: brokerH.averagePrice,
              externalValue: extH.averagePrice,
              difference: Number((brokerH.averagePrice - extH.averagePrice).toFixed(2)),
              message: `Average purchase price discrepancy on ${symbol}: Broker ₹${brokerH.averagePrice} vs ${sourceName} ₹${extH.averagePrice}.`,
              timestamp: now
            });
          }
        }
      }

      // Check for holdings in Broker missing in External
      for (const brokerH of params.brokerState.holdings) {
        const symbol = brokerH.symbol.toUpperCase();
        const found = params.externalHoldings.find(e => e.symbol.toUpperCase() === symbol);
        if (!found) {
          discrepancies.push({
            id: `DISC_MISSING_EXT_${symbol}_${Date.now()}`,
            symbol,
            field: 'MISSING_POSITION',
            severity: 'INFO',
            brokerValue: `${brokerH.quantity} shares`,
            externalValue: null,
            difference: brokerH.quantity,
            message: `Holding ${symbol} (${brokerH.quantity} shares) is present in Zerodha but missing in ${sourceName} file.`,
            timestamp: now
          });
        }
      }
    }

    // 2. Reconcile Derivatives Positions
    if (params.externalPositions) {
      for (const extP of params.externalPositions) {
        const symbol = extP.symbol.toUpperCase();
        const brokerP = brokerPositionsMap.get(symbol);

        if (!brokerP) {
          discrepancies.push({
            id: `DISC_POS_MISSING_${symbol}_${Date.now()}`,
            symbol,
            field: 'MISSING_POSITION',
            severity: 'WARNING',
            brokerValue: null,
            externalValue: `${extP.quantity} contracts`,
            difference: extP.quantity,
            message: `Position ${symbol} present in ${sourceName} but not open in Zerodha.`,
            timestamp: now
          });
        } else {
          if (brokerP.quantity !== extP.quantity) {
            discrepancies.push({
              id: `DISC_POS_QTY_${symbol}_${Date.now()}`,
              symbol,
              field: 'QUANTITY',
              severity: 'CRITICAL',
              brokerValue: brokerP.quantity,
              externalValue: extP.quantity,
              difference: brokerP.quantity - extP.quantity,
              message: `Derivatives contract count mismatch for ${symbol}: Broker ${brokerP.quantity} vs ${sourceName} ${extP.quantity}.`,
              timestamp: now
            });
          }
        }
      }
    }

    // Generate hash of reconciliation result
    const provenanceHash = crypto.createHash('sha256')
      .update(JSON.stringify({ now, discrepanciesCount: discrepancies.length, snapshotId: params.brokerState.snapshotId }))
      .digest('hex');

    return {
      reconciledAt: now,
      isConsistent: discrepancies.filter(d => d.severity === 'CRITICAL').length === 0,
      totalDiscrepancies: discrepancies.length,
      discrepancies,
      sourcesCompared: ['ZERODHA', sourceName],
      provenanceHash
    };
  }
}

export const portfolioReconciliationEngine = PortfolioReconciliationEngine.getInstance();
