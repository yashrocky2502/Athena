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
import {
  NormalizedPosition,
  NormalizedPortfolioState,
  PositionLifecycleEvent,
  PositionLifecycleEventType,
  PortfolioReconciliationOptions,
  PortfolioReconciliationResult,
  PortfolioSourceStatus,
  PositionSource
} from '../alerts/types.ts';

/**
 * Resolves a stable, deterministic position identity using the strongest structured identifiers:
 * ISIN -> Exchange + Symbol -> Symbol
 */
export function resolveDeterministicPositionId(pos: {
  symbol: string;
  isin?: string | null;
  exchange?: string | null;
  assetClass?: string | null;
  source?: string | null;
  expiryDate?: string | null;
  strikePrice?: number | null;
  optionType?: string | null;
  positionId?: string | null;
}): string {
  if (pos.isin && typeof pos.isin === 'string' && pos.isin.trim().length >= 10) {
    const cleanIsin = pos.isin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `POS_ISIN_${cleanIsin}`;
  }

  const cleanSym = (pos.symbol || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '_');
  const cleanEx = (pos.exchange || 'NSE').toUpperCase().trim();
  const cleanAsset = (pos.assetClass || 'EQUITY').toUpperCase().trim();
  const cleanSource = (pos.source || 'CSV').toUpperCase().trim();
  const cleanExpiry = pos.expiryDate ? pos.expiryDate.trim().replace(/[^0-9A-Z]/g, '') : 'SPOT';
  const cleanStrike = pos.strikePrice !== undefined && pos.strikePrice !== null ? String(pos.strikePrice) : '0';
  const cleanOpt = pos.optionType ? pos.optionType.toUpperCase().trim() : 'NA';

  return `POS_${cleanSource}_${cleanEx}_${cleanSym}_${cleanAsset}_${cleanExpiry}_${cleanStrike}_${cleanOpt}`;
}

export class PortfolioReconciliationEngine {
  private static instance: PortfolioReconciliationEngine;

  public static getInstance(): PortfolioReconciliationEngine {
    if (!this.instance) {
      this.instance = new PortfolioReconciliationEngine();
    }
    return this.instance;
  }

  /**
   * Creates an initial empty NormalizedPortfolioState.
   */
  public createInitialState(options?: {
    portfolioId?: string;
    sourceId?: string;
    sourceType?: string;
  }): NormalizedPortfolioState {
    const now = new Date().toISOString();
    return {
      portfolioId: options?.portfolioId || 'PORTFOLIO_PRIMARY',
      sourceId: options?.sourceId || 'SRC_DEFAULT',
      sourceType: options?.sourceType || 'FILE',
      timestamp: now,
      activePositions: new Map<string, NormalizedPosition>(),
      closedPositions: new Map<string, NormalizedPosition>(),
      presenceState: 'NO_POSITION',
      totalActivePositions: 0,
      totalActiveQuantity: 0,
      sourceStatus: 'VALID_EMPTY_PORTFOLIO'
    };
  }

  /**
   * Helper: Normalizes numbers for accurate numeric comparison (eliminates "10" vs 10 or 1350 vs 1350.00).
   */
  private normalizeNumber(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
    if (isNaN(num)) return null;
    return Number(num.toFixed(6));
  }

  /**
   * Helper: Normalizes strings for case-insensitive and whitespace-trimmed comparison.
   */
  private normalizeString(val: any): string | null {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    return s.length > 0 ? s.toUpperCase() : null;
  }

  /**
   * Reconciles previous portfolio state against a new set of normalized positions or PositionSource.
   * Completely source-agnostic, deterministic, idempotent, and historical-data-safe.
   */
  public async reconcilePortfolioState(
    previousState: NormalizedPortfolioState,
    currentInput: NormalizedPosition[] | PositionSource,
    options?: PortfolioReconciliationOptions
  ): Promise<PortfolioReconciliationResult> {
    const now = new Date().toISOString();
    let sourcePositions: NormalizedPosition[] = [];
    let detectedSourceId = options?.sourceId || previousState.sourceId;
    let detectedSourceType = options?.sourceType || previousState.sourceType;

    let sourceStatus: PortfolioSourceStatus | undefined = options?.sourceStatus;

    // 1. Fetch positions if PositionSource was provided
    if (currentInput && typeof (currentInput as any).getPositions === 'function') {
      const source = currentInput as PositionSource;
      detectedSourceId = source.sourceId || detectedSourceId;
      detectedSourceType = source.sourceType || detectedSourceType;
      try {
        if (typeof source.fetchPositions === 'function') {
          const res = await source.fetchPositions();
          sourcePositions = res.positions || [];
          if (!sourceStatus) {
            sourceStatus = res.status;
          }
        } else {
          sourcePositions = await source.getPositions();
          if (!sourceStatus && typeof source.getSourceStatus === 'function') {
            sourceStatus = source.getSourceStatus();
          }
        }
      } catch (err: any) {
        return {
          success: false,
          status: 'FAIL_CLOSED',
          previousState,
          newState: previousState,
          lifecycleEvents: [],
          summary: {
            added: 0,
            updated: 0,
            quantityChanged: 0,
            priceChanged: 0,
            sideChanged: 0,
            closed: 0,
            unchanged: 0,
            totalActive: previousState.totalActivePositions
          },
          error: `PositionSource fetch failure: ${err?.message || 'Unknown source error'}`
        };
      }
    } else if (Array.isArray(currentInput)) {
      sourcePositions = currentInput;
    } else {
      // Malformed input -> Fail closed
      return {
        success: false,
        status: 'FAIL_CLOSED',
        previousState,
        newState: previousState,
        lifecycleEvents: [],
        summary: {
          added: 0,
          updated: 0,
          quantityChanged: 0,
          priceChanged: 0,
          sideChanged: 0,
          closed: 0,
          unchanged: 0,
          totalActive: previousState.totalActivePositions
        },
        error: 'Invalid input: expected NormalizedPosition array or PositionSource'
      };
    }

    // 2. Stale Source Safety / Status Validation
    if (!sourceStatus) {
      if (options?.isAuthoritativeEmpty) {
        sourceStatus = 'VALID_EMPTY_PORTFOLIO';
      } else if (sourcePositions.length > 0) {
        sourceStatus = 'VALID_ACTIVE';
      } else if (previousState.totalActivePositions === 0) {
        sourceStatus = 'VALID_EMPTY_PORTFOLIO';
      } else {
        // Source returned [] with NO explicit status and NO authoritative empty flag when previous positions existed.
        // Never infer VALID_EMPTY_PORTFOLIO merely because getPositions() returned []. Fail closed!
        sourceStatus = 'UNAVAILABLE';
      }
    }

    if (
      sourceStatus === 'INVALID_SOURCE' ||
      sourceStatus === 'SOURCE_ERROR' ||
      sourceStatus === 'UNAVAILABLE'
    ) {
      // Fail closed: Maintain existing active positions, emit ZERO closures or deletions
      return {
        success: false,
        status: 'FAIL_CLOSED',
        previousState,
        newState: previousState,
        lifecycleEvents: [],
        summary: {
          added: 0,
          updated: 0,
          quantityChanged: 0,
          priceChanged: 0,
          sideChanged: 0,
          closed: 0,
          unchanged: 0,
          totalActive: previousState.totalActivePositions
        },
        error: `Source in invalid/error state: ${sourceStatus}`
      };
    }

    // 3. Normalize current positions into Map keyed by deterministic positionId
    const currentPositionsMap = new Map<string, NormalizedPosition>();
    for (const rawPos of sourcePositions) {
      if (!rawPos || !rawPos.symbol) continue;
      const cleanQty = this.normalizeNumber(rawPos.quantity);
      if (cleanQty === null || cleanQty <= 0) continue; // Only strictly positive quantities are active

      const deterministicId = rawPos.positionId && rawPos.positionId.startsWith('POS_')
        ? rawPos.positionId
        : resolveDeterministicPositionId(rawPos);

      const normalizedPos: NormalizedPosition = {
        ...rawPos,
        positionId: deterministicId,
        symbol: rawPos.symbol.trim().toUpperCase(),
        exchange: rawPos.exchange ? rawPos.exchange.trim().toUpperCase() : (rawPos.exchange === null ? null : undefined),
        assetClass: rawPos.assetClass || 'EQUITY',
        quantity: cleanQty,
        averagePrice: this.normalizeNumber(rawPos.averagePrice),
        currentPrice: this.normalizeNumber(rawPos.currentPrice),
        isin: rawPos.isin ? rawPos.isin.trim().toUpperCase() : (rawPos.isin === null ? null : undefined),
        sector: rawPos.sector ? rawPos.sector.trim() : (rawPos.sector === null ? null : undefined),
        source: rawPos.source || detectedSourceType || 'FILE',
        observedAt: rawPos.observedAt || now
      };

      currentPositionsMap.set(deterministicId, normalizedPos);
    }

    // 4. Distinguish Valid Authoritative Empty Portfolio vs Non-empty
    const isAuthoritativeEmpty = sourceStatus === 'VALID_EMPTY_PORTFOLIO' || options?.isAuthoritativeEmpty === true || (sourcePositions.length === 0 && previousState.totalActivePositions === 0);

    const newActivePositions = new Map<string, NormalizedPosition>();
    // Clone previous closed positions to preserve historical state
    const newClosedPositions = new Map<string, NormalizedPosition>(previousState.closedPositions);
    const lifecycleEvents: PositionLifecycleEvent[] = [];

    let addedCount = 0;
    let updatedCount = 0;
    let qtyChangedCount = 0;
    let priceChangedCount = 0;
    let sideChangedCount = 0;
    let closedCount = 0;
    let unchangedCount = 0;

    // 5. If authoritative empty portfolio, close all active positions
    if (isAuthoritativeEmpty && currentPositionsMap.size === 0) {
      for (const [posId, prevPos] of previousState.activePositions.entries()) {
        newClosedPositions.set(posId, {
          ...prevPos,
          observedAt: now
        });
        closedCount++;
        lifecycleEvents.push({
          eventId: `EVT_CLS_${posId}_${Date.now()}_${closedCount}`,
          positionId: posId,
          symbol: prevPos.symbol,
          type: 'POSITION_CLOSED',
          timestamp: now,
          previousPosition: prevPos,
          currentPosition: null,
          details: `Authoritative empty portfolio closed active position: ${prevPos.symbol}`
        });
      }
    } else {
      // 6. Process Current Positions vs Previous Active Positions
      for (const [posId, currentPos] of currentPositionsMap.entries()) {
        const prevPos = previousState.activePositions.get(posId);

        if (!prevPos) {
          // Position Added / Appeared
          addedCount++;
          newActivePositions.set(posId, currentPos);
          lifecycleEvents.push({
            eventId: `EVT_ADD_${posId}_${Date.now()}_${addedCount}`,
            positionId: posId,
            symbol: currentPos.symbol,
            type: 'POSITION_ADDED',
            timestamp: now,
            previousPosition: null,
            currentPosition: currentPos,
            details: `Position added: ${currentPos.symbol} (qty: ${currentPos.quantity}${currentPos.averagePrice !== null && currentPos.averagePrice !== undefined ? ` @ ₹${currentPos.averagePrice}` : ''})`
          });
          continue;
        }

        // Position exists in both snapshots — compare attributes
        newActivePositions.set(posId, currentPos);

        const prevQty = this.normalizeNumber(prevPos.quantity) ?? 0;
        const currQty = this.normalizeNumber(currentPos.quantity) ?? 0;

        if (prevQty !== currQty) {
          // Quantity Changed (Increase, Decrease, or Partial Exit)
          qtyChangedCount++;
          const delta = Number((currQty - prevQty).toFixed(6));
          lifecycleEvents.push({
            eventId: `EVT_QTY_${posId}_${Date.now()}_${qtyChangedCount}`,
            positionId: posId,
            symbol: currentPos.symbol,
            type: 'POSITION_QUANTITY_CHANGED',
            timestamp: now,
            previousPosition: prevPos,
            currentPosition: currentPos,
            quantityDelta: delta,
            details: `Position ${currentPos.symbol} quantity changed: ${prevQty} -> ${currQty} (delta: ${delta > 0 ? `+${delta}` : delta})`
          });
          continue;
        }

        // Side Change
        const prevSide = this.normalizeString(prevPos.side);
        const currSide = this.normalizeString(currentPos.side);
        if (prevSide && currSide && prevSide !== currSide) {
          sideChangedCount++;
          lifecycleEvents.push({
            eventId: `EVT_SIDE_${posId}_${Date.now()}_${sideChangedCount}`,
            positionId: posId,
            symbol: currentPos.symbol,
            type: 'POSITION_SIDE_CHANGED',
            timestamp: now,
            previousPosition: prevPos,
            currentPosition: currentPos,
            details: `Position ${currentPos.symbol} side changed: ${prevSide} -> ${currSide}`
          });
          continue;
        }

        // Price Change
        const prevAvgPrice = this.normalizeNumber(prevPos.averagePrice);
        const currAvgPrice = this.normalizeNumber(currentPos.averagePrice);
        const prevCurrPrice = this.normalizeNumber(prevPos.currentPrice);
        const currCurrPrice = this.normalizeNumber(currentPos.currentPrice);

        const avgPriceDiff = (prevAvgPrice !== null && currAvgPrice !== null && prevAvgPrice !== currAvgPrice);
        const currPriceDiff = (prevCurrPrice !== null && currCurrPrice !== null && prevCurrPrice !== currCurrPrice);

        if (avgPriceDiff || currPriceDiff) {
          priceChangedCount++;
          const priceDelta = currCurrPrice !== null && prevCurrPrice !== null
            ? Number((currCurrPrice - prevCurrPrice).toFixed(6))
            : (currAvgPrice !== null && prevAvgPrice !== null ? Number((currAvgPrice - prevAvgPrice).toFixed(6)) : 0);

          lifecycleEvents.push({
            eventId: `EVT_PRC_${posId}_${Date.now()}_${priceChangedCount}`,
            positionId: posId,
            symbol: currentPos.symbol,
            type: 'POSITION_PRICE_CHANGED',
            timestamp: now,
            previousPosition: prevPos,
            currentPosition: currentPos,
            priceDelta,
            details: `Position ${currentPos.symbol} price updated.`
          });
          continue;
        }

        // Structured Field Updates (e.g. sector, isin, exchange)
        const changedFields: string[] = [];
        if (this.normalizeString(prevPos.sector) !== this.normalizeString(currentPos.sector)) {
          changedFields.push('sector');
        }
        if (this.normalizeString(prevPos.exchange) !== this.normalizeString(currentPos.exchange)) {
          changedFields.push('exchange');
        }
        if (this.normalizeString(prevPos.isin) !== this.normalizeString(currentPos.isin)) {
          changedFields.push('isin');
        }

        if (changedFields.length > 0) {
          updatedCount++;
          lifecycleEvents.push({
            eventId: `EVT_UPD_${posId}_${Date.now()}_${updatedCount}`,
            positionId: posId,
            symbol: currentPos.symbol,
            type: 'POSITION_UPDATED',
            timestamp: now,
            previousPosition: prevPos,
            currentPosition: currentPos,
            changedFields,
            details: `Position ${currentPos.symbol} updated fields: ${changedFields.join(', ')}`
          });
          continue;
        }

        // If no changes observed
        unchangedCount++;
        lifecycleEvents.push({
          eventId: `EVT_UNC_${posId}_${Date.now()}_${unchangedCount}`,
          positionId: posId,
          symbol: currentPos.symbol,
          type: 'POSITION_UNCHANGED',
          timestamp: now,
          previousPosition: prevPos,
          currentPosition: currentPos,
          details: `Position ${currentPos.symbol} unchanged`
        });
      }

      // 7. Check for positions in previous state missing from current authoritative set
      for (const [posId, prevPos] of previousState.activePositions.entries()) {
        if (!currentPositionsMap.has(posId)) {
          // Position Closed / Exited
          closedCount++;
          newClosedPositions.set(posId, {
            ...prevPos,
            observedAt: now
          });
          lifecycleEvents.push({
            eventId: `EVT_CLS_${posId}_${Date.now()}_${closedCount}`,
            positionId: posId,
            symbol: prevPos.symbol,
            type: 'POSITION_CLOSED',
            timestamp: now,
            previousPosition: prevPos,
            currentPosition: null,
            details: `Position closed: ${prevPos.symbol} (last qty: ${prevPos.quantity})`
          });
        }
      }
    }

    let totalActiveQty = 0;
    for (const p of newActivePositions.values()) {
      totalActiveQty += p.quantity;
    }

    const presenceState = newActivePositions.size > 0 ? 'POSITION_EXISTS' : 'NO_POSITION';

    const newState: NormalizedPortfolioState = {
      portfolioId: previousState.portfolioId,
      sourceId: detectedSourceId,
      sourceType: detectedSourceType,
      timestamp: now,
      activePositions: newActivePositions,
      closedPositions: newClosedPositions,
      presenceState,
      totalActivePositions: newActivePositions.size,
      totalActiveQuantity: Number(totalActiveQty.toFixed(6)),
      sourceStatus: newActivePositions.size > 0 ? 'VALID_ACTIVE' : 'VALID_EMPTY_PORTFOLIO'
    };

    const isIdempotent = addedCount === 0 &&
      updatedCount === 0 &&
      qtyChangedCount === 0 &&
      priceChangedCount === 0 &&
      sideChangedCount === 0 &&
      closedCount === 0;

    return {
      success: true,
      status: isIdempotent ? 'IDEMPOTENT' : 'RECONCILED',
      previousState,
      newState,
      lifecycleEvents,
      summary: {
        added: addedCount,
        updated: updatedCount,
        quantityChanged: qtyChangedCount,
        priceChanged: priceChangedCount,
        sideChanged: sideChangedCount,
        closed: closedCount,
        unchanged: unchangedCount,
        totalActive: newActivePositions.size
      }
    };
  }

  // =========================================================================
  // EXISTING PHASE 26 MULTI-SOURCE CROSS RECONCILIATION METHODS (PRESERVED)
  // =========================================================================

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
