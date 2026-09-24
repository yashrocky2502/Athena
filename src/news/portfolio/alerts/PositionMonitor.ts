/**
 * ATHENA — PHASE 10P-2: PERSONAL POSITION ALERT FOUNDATION
 * PositionMonitor.ts
 * 
 * Source-Agnostic Position Monitoring Engine.
 * Observes user position state across polling/evaluation cycles, detects
 * position lifecycle transitions (open, quantity change, price change, close),
 * and generates deterministic lifecycle events.
 * 
 * Invariants:
 * - Strictly read-only: No order placement, no portfolio mutations.
 * - Source-agnostic: Operates against the PositionSource interface.
 * - Accurately differentiates NO_POSITION vs POSITION_EXISTS.
 */

import {
  PositionSource,
  NormalizedPosition,
  PositionSnapshot,
  PositionLifecycleEvent,
  PositionLifecycleEventType,
  PositionPresenceState
} from './types.ts';

export class PositionMonitor {
  private source: PositionSource;
  private currentSnapshot: PositionSnapshot | null = null;
  private previousSnapshot: PositionSnapshot | null = null;
  private lifecycleHistory: PositionLifecycleEvent[] = [];

  constructor(source: PositionSource) {
    this.source = source;
  }

  /**
   * Replaces or updates the underlying position source.
   */
  public setSource(source: PositionSource): void {
    this.source = source;
  }

  /**
   * Returns the current active position source.
   */
  public getSource(): PositionSource {
    return this.source;
  }

  /**
   * Performs a single evaluation cycle:
   * 1. Fetches current normalized positions from source.
   * 2. Constructs an immutable snapshot.
   * 3. Compares against the previous snapshot to detect lifecycle events.
   * 4. Returns the new snapshot and detected events.
   */
  public async evaluatePositions(): Promise<{
    snapshot: PositionSnapshot;
    events: PositionLifecycleEvent[];
  }> {
    const rawPositions = await this.source.getPositions();
    const now = new Date().toISOString();

    const positionMap = new Map<string, NormalizedPosition>();
    let totalQty = 0;

    for (const pos of rawPositions) {
      if (pos.quantity > 0) {
        positionMap.set(pos.positionId, pos);
        totalQty += pos.quantity;
      }
    }

    const presenceState: PositionPresenceState = positionMap.size > 0
      ? 'POSITION_EXISTS'
      : 'NO_POSITION';

    const newSnapshot: PositionSnapshot = {
      snapshotId: `SNP_${this.source.sourceId}_${Date.now()}`,
      sourceId: this.source.sourceId,
      timestamp: now,
      positions: positionMap,
      presenceState,
      totalPositions: positionMap.size,
      totalQuantity: totalQty
    };

    const detectedEvents: PositionLifecycleEvent[] = [];

    if (this.currentSnapshot) {
      const prevPositions = this.currentSnapshot.positions;

      // 1. Check for appeared or modified positions in current snapshot
      for (const [posId, currPos] of positionMap.entries()) {
        const prevPos = prevPositions.get(posId);

        if (!prevPos) {
          // Position Appeared / Opened
          detectedEvents.push({
            eventId: `EVT_APP_${posId}_${Date.now()}`,
            positionId: posId,
            symbol: currPos.symbol,
            type: 'POSITION_APPEARED',
            timestamp: now,
            previousPosition: null,
            currentPosition: currPos,
            quantityDelta: currPos.quantity,
            details: `New position detected: ${currPos.quantity} units of ${currPos.symbol} (${currPos.assetClass}).`
          });
        } else {
          // Check for quantity change
          if (currPos.quantity !== prevPos.quantity) {
            const delta = currPos.quantity - prevPos.quantity;
            detectedEvents.push({
              eventId: `EVT_QTY_${posId}_${Date.now()}`,
              positionId: posId,
              symbol: currPos.symbol,
              type: 'POSITION_QUANTITY_CHANGED',
              timestamp: now,
              previousPosition: prevPos,
              currentPosition: currPos,
              quantityDelta: delta,
              details: `Position quantity changed for ${currPos.symbol}: ${prevPos.quantity} -> ${currPos.quantity} (delta: ${delta > 0 ? '+' : ''}${delta}).`
            });
          }

          // Check for entry/average price change
          if (
            currPos.averagePrice !== undefined &&
            prevPos.averagePrice !== undefined &&
            currPos.averagePrice !== prevPos.averagePrice &&
            currPos.averagePrice !== null &&
            prevPos.averagePrice !== null
          ) {
            const priceDelta = currPos.averagePrice - prevPos.averagePrice;
            detectedEvents.push({
              eventId: `EVT_PRC_${posId}_${Date.now()}`,
              positionId: posId,
              symbol: currPos.symbol,
              type: 'POSITION_PRICE_CHANGED',
              timestamp: now,
              previousPosition: prevPos,
              currentPosition: currPos,
              priceDelta,
              details: `Average price changed for ${currPos.symbol}: ₹${prevPos.averagePrice} -> ₹${currPos.averagePrice}.`
            });
          }

          // Check for side change (e.g. LONG -> SHORT in derivatives)
          if (currPos.side && prevPos.side && currPos.side !== prevPos.side) {
            detectedEvents.push({
              eventId: `EVT_SIDE_${posId}_${Date.now()}`,
              positionId: posId,
              symbol: currPos.symbol,
              type: 'POSITION_SIDE_CHANGED',
              timestamp: now,
              previousPosition: prevPos,
              currentPosition: currPos,
              details: `Position side changed for ${currPos.symbol}: ${prevPos.side} -> ${currPos.side}.`
            });
          }
        }
      }

      // 2. Check for closed/disappeared positions (in previous but not in current)
      for (const [posId, prevPos] of prevPositions.entries()) {
        if (!positionMap.has(posId)) {
          detectedEvents.push({
            eventId: `EVT_CLS_${posId}_${Date.now()}`,
            positionId: posId,
            symbol: prevPos.symbol,
            type: 'POSITION_CLOSED',
            timestamp: now,
            previousPosition: prevPos,
            currentPosition: null,
            quantityDelta: -prevPos.quantity,
            details: `Position closed / removed: ${prevPos.symbol} (${prevPos.quantity} units).`
          });
        }
      }
    } else {
      // First evaluation cycle: all existing positions are registered as POSITION_APPEARED
      for (const [posId, currPos] of positionMap.entries()) {
        detectedEvents.push({
          eventId: `EVT_INIT_${posId}_${Date.now()}`,
          positionId: posId,
          symbol: currPos.symbol,
          type: 'POSITION_APPEARED',
          timestamp: now,
          previousPosition: null,
          currentPosition: currPos,
          quantityDelta: currPos.quantity,
          details: `Initial position observed: ${currPos.quantity} units of ${currPos.symbol} (${currPos.assetClass}).`
        });
      }
    }

    this.previousSnapshot = this.currentSnapshot;
    this.currentSnapshot = newSnapshot;
    this.lifecycleHistory.push(...detectedEvents);

    return {
      snapshot: newSnapshot,
      events: detectedEvents
    };
  }

  public getLatestSnapshot(): PositionSnapshot | null {
    return this.currentSnapshot;
  }

  public getPreviousSnapshot(): PositionSnapshot | null {
    return this.previousSnapshot;
  }

  public getLifecycleHistory(): PositionLifecycleEvent[] {
    return [...this.lifecycleHistory];
  }

  public reset(): void {
    this.currentSnapshot = null;
    this.previousSnapshot = null;
    this.lifecycleHistory = [];
  }
}
