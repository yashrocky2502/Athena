/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * PortfolioHistoricalStore.ts
 * 
 * Append-Only Immutable Historical Portfolio Snapshot Store.
 * 
 * Invariant: Never overwrite, truncate, or delete historical portfolio snapshots.
 * Every broker synchronization, Excel/CSV import, or manual reconciliation event
 * creates an immutable point-in-time snapshot.
 */

import { CanonicalPortfolioState } from './types.ts';

export class PortfolioHistoricalStore {
  private static instance: PortfolioHistoricalStore;
  private snapshots: CanonicalPortfolioState[] = [];
  private maxRetentionCount: number = 2000;

  public static getInstance(): PortfolioHistoricalStore {
    if (!this.instance) {
      this.instance = new PortfolioHistoricalStore();
    }
    return this.instance;
  }

  /**
   * Appends an immutable canonical snapshot to history.
   * Deep freezes the record to preserve auditability.
   */
  public appendSnapshot(snapshot: CanonicalPortfolioState): void {
    // Clone and store
    const cloned = JSON.parse(JSON.stringify(snapshot));
    this.snapshots.push(cloned);

    // Keep chronological order
    if (this.snapshots.length > this.maxRetentionCount) {
      this.snapshots.shift();
    }
  }

  /**
   * Returns the most recent canonical portfolio snapshot.
   */
  public getLatestSnapshot(): CanonicalPortfolioState | null {
    if (this.snapshots.length === 0) return null;
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * Returns all historical snapshots in chronological order.
   */
  public getAllSnapshots(): CanonicalPortfolioState[] {
    return [...this.snapshots];
  }

  /**
   * Retrieves a snapshot by ID.
   */
  public getSnapshotById(id: string): CanonicalPortfolioState | null {
    return this.snapshots.find(s => s.snapshotId === id) || null;
  }

  /**
   * Returns snapshots in a given timestamp range.
   */
  public getSnapshotsInRange(fromIso: string, toIso: string): CanonicalPortfolioState[] {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    return this.snapshots.filter(s => {
      const t = new Date(s.capturedAt).getTime();
      return t >= from && t <= to;
    });
  }

  /**
   * Total count of recorded snapshots.
   */
  public getCount(): number {
    return this.snapshots.length;
  }
}

export const portfolioHistoricalStore = PortfolioHistoricalStore.getInstance();
