/**
 * ATHENA NEWS ENGINE — PHASE 20
 * PositionReconciliationScheduler.ts
 * 
 * Periodic Background Reconciliation Worker.
 * Periodically audits broker actual state vs internal Athena portfolio state.
 * Emits drift classifications and automatically trips safety gates on CRITICAL_MISMATCH.
 */

import { positionReconciliationEngine, DetailedPositionReconciliationReport } from './PositionReconciliationEngine.ts';
import { executionAdapterFactory } from './ExecutionAdapterFactory.ts';
import { RawPortfolioPosition } from '../portfolio/types.ts';

export class PositionReconciliationScheduler {
  private static instance: PositionReconciliationScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private internalPositionsProvider: () => RawPortfolioPosition[] = () => [];
  private lastRunReport?: DetailedPositionReconciliationReport;

  private constructor() {}

  public static getInstance(): PositionReconciliationScheduler {
    if (!this.instance) {
      this.instance = new PositionReconciliationScheduler();
    }
    return this.instance;
  }

  public setInternalPositionsProvider(provider: () => RawPortfolioPosition[]): void {
    this.internalPositionsProvider = provider;
  }

  public start(intervalMs: number = 30000): void {
    if (this.isRunning) {
      console.warn('[PositionReconciliationScheduler] Worker is already running. Duplicate startup avoided.');
      return;
    }
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.runReconciliationCycle().catch(err => {
        console.error('[PositionReconciliationScheduler] Reconciliation cycle error:', err);
      });
    }, intervalMs);
    console.log(`[PositionReconciliationScheduler] Started periodic worker (interval: ${intervalMs}ms).`);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[PositionReconciliationScheduler] Stopped worker.');
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public getLastReport(): DetailedPositionReconciliationReport | undefined {
    return this.lastRunReport;
  }

  /**
   * Executes a single reconciliation cycle.
   */
  public async runReconciliationCycle(): Promise<DetailedPositionReconciliationReport> {
    const adapter = executionAdapterFactory.getAdapter();
    const brokerPositions = await adapter.getPositions();
    const internalPositions = this.internalPositionsProvider();

    const report = positionReconciliationEngine.reconcilePositions(internalPositions, brokerPositions);
    this.lastRunReport = report;

    if (report.overallClassification === 'CRITICAL_MISMATCH') {
      console.error(`🚨 [RECONCILIATION CRITICAL] ${report.mismatches.length} critical mismatch(es) detected. Live execution gated.`);
    }

    return report;
  }
}

export const positionReconciliationScheduler = PositionReconciliationScheduler.getInstance();
