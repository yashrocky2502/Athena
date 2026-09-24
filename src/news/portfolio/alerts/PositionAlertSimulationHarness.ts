/**
 * ATHENA — PHASE 10P-5: POSITION ALERT END-TO-END LIFECYCLE & REAL-WORLD SIMULATION
 * PositionAlertSimulationHarness.ts
 * 
 * Deterministic, fully isolated end-to-end simulation harness for the
 * personal-position-alert pipeline.
 * 
 * Pipeline:
 * SimulatedPositionSource
 *         ↓
 * Normalized Position
 *         ↓
 * PositionMonitor
 *         ↓
 * PositionRelevanceEngine
 *         ↓
 * PositionAlertEngine
 *         ↓
 * PositionAlertDeliveryStore
 *         ↓
 * PrivatePositionTelegramNotifier (or Mock Notifier)
 * 
 * Invariants & Guarantees:
 * 1. Zero Broker/Trading Operations: Purely read-only evaluation.
 * 2. Complete Data Store Isolation: Never modifies or touches data/ JSON stores.
 * 3. Exact Orchestration: Uses real production classes without duplicating alert logic.
 * 4. Safe Simulation: Zero real Telegram network calls.
 */

import {
  NormalizedPosition,
  PositionSource,
  PositionSnapshot,
  PositionLifecycleEvent,
  PositionAlertCandidate,
  PositionNewsEventInput,
  PositionTelegramNotifierConfig,
  PositionAlertDeliveryRecord,
  PositionAlertDeliveryStatus
} from './types.ts';
import { PositionMonitor } from './PositionMonitor.ts';
import { PositionRelevanceEngine } from './PositionRelevanceEngine.ts';
import { PositionAlertEngine } from './PositionAlertEngine.ts';
import { PositionAlertDeliveryStore } from './PositionAlertDeliveryStore.ts';
import { PrivatePositionTelegramNotifier, MockPositionAlertNotifier } from './PositionAlertNotifier.ts';

/**
 * Deterministic in-memory simulated position source.
 * Allows programmatic changes between monitoring cycles.
 */
export class SimulatedPositionSource implements PositionSource {
  public readonly sourceId: string;
  public readonly sourceType = 'MOCK' as const;
  private positions: NormalizedPosition[] = [];

  constructor(sourceId: string = 'SIMULATED_PORTFOLIO', initialPositions: NormalizedPosition[] = []) {
    this.sourceId = sourceId;
    this.positions = [...initialPositions];
  }

  public async getPositions(): Promise<NormalizedPosition[]> {
    return this.positions.map(p => ({ ...p }));
  }

  public setPositions(positions: NormalizedPosition[]): void {
    this.positions = positions.map(p => ({ ...p }));
  }

  public addPosition(position: NormalizedPosition): void {
    this.positions.push({ ...position });
  }

  public updatePosition(symbol: string, updater: (pos: NormalizedPosition) => NormalizedPosition): boolean {
    const idx = this.positions.findIndex(p => p.symbol.toUpperCase() === symbol.toUpperCase());
    if (idx >= 0) {
      this.positions[idx] = updater({ ...this.positions[idx] });
      return true;
    }
    return false;
  }

  public updateQuantity(symbol: string, newQuantity: number): boolean {
    return this.updatePosition(symbol, pos => ({
      ...pos,
      quantity: newQuantity,
      observedAt: new Date().toISOString()
    }));
  }

  public updatePrice(symbol: string, newCurrentPrice: number, newAveragePrice?: number): boolean {
    return this.updatePosition(symbol, pos => ({
      ...pos,
      currentPrice: newCurrentPrice,
      averagePrice: newAveragePrice !== undefined ? newAveragePrice : pos.averagePrice,
      observedAt: new Date().toISOString()
    }));
  }

  public updateSide(symbol: string, newSide: 'LONG' | 'SHORT'): boolean {
    return this.updatePosition(symbol, pos => ({
      ...pos,
      side: newSide,
      observedAt: new Date().toISOString()
    }));
  }

  public removePosition(symbol: string): boolean {
    const initLen = this.positions.length;
    this.positions = this.positions.filter(p => p.symbol.toUpperCase() !== symbol.toUpperCase());
    return this.positions.length < initLen;
  }

  public clear(): void {
    this.positions = [];
  }
}

export interface PositionAlertSimulationOptions {
  sourceId?: string;
  initialPositions?: NormalizedPosition[];
  notifierConfig?: PositionTelegramNotifierConfig;
  useMockNotifier?: boolean;
  storePath?: string;
}

/**
 * High-fidelity End-to-End Simulation Harness for Position Alerts.
 */
export class PositionAlertSimulationHarness {
  private source: SimulatedPositionSource;
  private monitor: PositionMonitor;
  private relevanceEngine: PositionRelevanceEngine;
  private deliveryStore: PositionAlertDeliveryStore;
  private notifier: PrivatePositionTelegramNotifier | MockPositionAlertNotifier;
  private alertEngine: PositionAlertEngine;
  private stagedNewsEvents: PositionNewsEventInput[] = [];
  private options: PositionAlertSimulationOptions;

  constructor(options: PositionAlertSimulationOptions = {}) {
    this.options = { ...options };
    const sourceId = options.sourceId || 'SIMULATED_PORTFOLIO';

    this.source = new SimulatedPositionSource(sourceId, options.initialPositions || []);
    this.monitor = new PositionMonitor(this.source);
    this.relevanceEngine = new PositionRelevanceEngine();
    this.deliveryStore = new PositionAlertDeliveryStore(options.storePath);

    if (options.useMockNotifier) {
      this.notifier = new MockPositionAlertNotifier();
    } else {
      const notifierConfig: PositionTelegramNotifierConfig = {
        enabled: true,
        dryRun: true, // Simulation harness strictly runs in dryRun mode by default
        storePath: options.storePath,
        ...options.notifierConfig
      };
      this.notifier = new PrivatePositionTelegramNotifier(notifierConfig);
    }

    this.alertEngine = new PositionAlertEngine({
      monitor: this.monitor,
      notifier: this.notifier,
      relevanceEngine: this.relevanceEngine
    });
  }

  // =========================================================================
  // STATE MANIPULATION
  // =========================================================================

  public setPositions(positions: NormalizedPosition[]): void {
    this.source.setPositions(positions);
  }

  public addPosition(position: NormalizedPosition): void {
    this.source.addPosition(position);
  }

  public updateQuantity(symbol: string, newQuantity: number): boolean {
    return this.source.updateQuantity(symbol, newQuantity);
  }

  public updatePrice(symbol: string, newCurrentPrice: number, newAveragePrice?: number): boolean {
    return this.source.updatePrice(symbol, newCurrentPrice, newAveragePrice);
  }

  public updateSide(symbol: string, newSide: 'LONG' | 'SHORT'): boolean {
    return this.source.updateSide(symbol, newSide);
  }

  public removePosition(symbol: string): boolean {
    return this.source.removePosition(symbol);
  }

  public clearPositions(): void {
    this.source.clear();
  }

  public setNewsEvents(events: PositionNewsEventInput[]): void {
    this.stagedNewsEvents = [...events];
  }

  public addNewsEvent(event: PositionNewsEventInput): void {
    this.stagedNewsEvents.push({ ...event });
  }

  // =========================================================================
  // EXECUTION CYCLES
  // =========================================================================

  /**
   * Executes a full position monitoring cycle.
   * Compares snapshots, detects lifecycle transitions, generates alerts, and delivers them.
   */
  public async runPositionCycle(): Promise<{
    snapshot: PositionSnapshot;
    events: PositionLifecycleEvent[];
    alerts: PositionAlertCandidate[];
  }> {
    const alerts = await this.alertEngine.evaluate();
    const snapshot = this.monitor.getLatestSnapshot()!;
    const events = this.monitor.getLifecycleHistory();

    return {
      snapshot,
      events,
      alerts
    };
  }

  /**
   * Evaluates a single News Core V2 event against the current active position state.
   */
  public async evaluateNewsEvent(event: PositionNewsEventInput): Promise<PositionAlertCandidate | null> {
    return this.alertEngine.evaluateNewsEvent(event);
  }

  /**
   * Evaluates all staged or passed News Core V2 events against the current active position state.
   */
  public async evaluateNewsEvents(events?: PositionNewsEventInput[]): Promise<PositionAlertCandidate[]> {
    const targetEvents = events || this.stagedNewsEvents;
    return this.alertEngine.evaluateNewsEvents(targetEvents);
  }

  /**
   * Simulates a process restart:
   * Creates a brand new instance of monitor, relevance engine, and alert engine,
   * reloading the delivery state from the persisted storage path.
   */
  public async restart(newConfig?: Partial<PositionTelegramNotifierConfig>): Promise<PositionAlertSimulationHarness> {
    const currentPositions = await this.source.getPositions();
    const updatedOptions: PositionAlertSimulationOptions = {
      ...this.options,
      initialPositions: currentPositions,
      notifierConfig: {
        ...this.options.notifierConfig,
        ...newConfig
      }
    };
    return new PositionAlertSimulationHarness(updatedOptions);
  }

  // =========================================================================
  // INSPECTION & TELEMETRY
  // =========================================================================

  public getGeneratedAlerts(): PositionAlertCandidate[] {
    return this.alertEngine.getGeneratedAlerts();
  }

  public getDeliveryRecords(): PositionAlertDeliveryRecord[] {
    if (this.notifier instanceof PrivatePositionTelegramNotifier) {
      return this.notifier.getDeliveryStore().getAllRecords();
    }
    return this.deliveryStore.getAllRecords();
  }

  public getDeliveryStatus(dedupeKey: string): PositionAlertDeliveryStatus | undefined {
    if (this.notifier instanceof PrivatePositionTelegramNotifier) {
      return this.notifier.getDeliveryStatus(dedupeKey);
    }
    return this.deliveryStore.getStatus(dedupeKey);
  }

  public getMonitor(): PositionMonitor {
    return this.monitor;
  }

  public getAlertEngine(): PositionAlertEngine {
    return this.alertEngine;
  }

  public getRelevanceEngine(): PositionRelevanceEngine {
    return this.relevanceEngine;
  }

  public getNotifier(): PrivatePositionTelegramNotifier | MockPositionAlertNotifier {
    return this.notifier;
  }

  public getSource(): SimulatedPositionSource {
    return this.source;
  }
}
