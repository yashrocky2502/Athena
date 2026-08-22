/**
 * ATHENA NEWS ENGINE — STAGE 8.9 TELEGRAM OPERATIONS CONTROLLER
 * TelegramOperationsController
 * 
 * Production control plane for Telegram dispatch operations.
 * 
 * Operational Semantics:
 * - ACTIVE: Normal operational dispatch.
 * - PAUSED: Operator explicitly paused dispatch; in-memory queue is retained without silent loss.
 * - DEGRADED: Delivery impaired by rate limits or 5xx API outages.
 * - DISABLED: Telegram dispatch disabled via configuration / runtime control.
 */

import { NewsRuntimeConfig } from './NewsRuntimeConfig';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { TelegramAuditTrail } from './TelegramAuditTrail';

export type TelegramOperationalState = 'ACTIVE' | 'PAUSED' | 'DEGRADED' | 'DISABLED';

export interface TelegramOperationsStatus {
  state: TelegramOperationalState;
  isPaused: boolean;
  isEnabled: boolean;
  pauseReason?: string;
  degradedReason?: string;
  pausedAt?: string;
  queueDepth: number;
  totalQueued: number;
  totalDispatched: number;
  totalSuppressed: number;
  totalFailed: number;
  rateLimitPauses: number;
  sentEventKeysCount: number;
  timestamp: string;
}

export class TelegramOperationsController {
  private static instance: TelegramOperationsController | null = null;
  private state: TelegramOperationalState = 'ACTIVE';
  private pauseReason?: string;
  private degradedReason?: string;
  private pausedAt?: string;
  private dispatchedEventKeys: Set<string> = new Set();

  private constructor() {
    this.syncWithRuntimeConfig();
  }

  public static getInstance(): TelegramOperationsController {
    if (!TelegramOperationsController.instance) {
      TelegramOperationsController.instance = new TelegramOperationsController();
    }
    return TelegramOperationsController.instance;
  }

  public static resetInstance(): TelegramOperationsController {
    TelegramOperationsController.instance = new TelegramOperationsController();
    return TelegramOperationsController.instance;
  }

  private syncWithRuntimeConfig(): void {
    const config = NewsRuntimeConfig.getInstance();
    if (!config.isTelegramEnabled()) {
      this.state = 'DISABLED';
    } else if (this.state === 'DISABLED') {
      this.state = 'ACTIVE';
    }
  }

  /**
   * Pauses Telegram dispatch. Pending and newly arriving queue items are preserved.
   */
  public pause(reason = 'Operator initiated emergency pause'): void {
    this.state = 'PAUSED';
    this.pauseReason = reason;
    this.pausedAt = new Date().toISOString();
  }

  /**
   * Resumes Telegram dispatch. Drains retained queue in FIFO/priority order.
   */
  public resume(): void {
    const config = NewsRuntimeConfig.getInstance();
    if (!config.isTelegramEnabled()) {
      this.state = 'DISABLED';
    } else {
      this.state = 'ACTIVE';
    }
    this.pauseReason = undefined;
    this.pausedAt = undefined;
    this.degradedReason = undefined;

    // Wake up processing queue
    TelegramNotificationPipeline.getInstance().triggerQueueProcessing().catch(err => {
      console.warn('[TelegramOperationsController] Queue wake error:', err);
    });
  }

  public isPaused(): boolean {
    return this.state === 'PAUSED';
  }

  public isEnabled(): boolean {
    return this.state !== 'DISABLED';
  }

  public markDegraded(reason = 'Rate limit backoff or upstream 5xx errors'): void {
    if (this.state !== 'PAUSED' && this.state !== 'DISABLED') {
      this.state = 'DEGRADED';
      this.degradedReason = reason;
    }
  }

  public markActive(): void {
    if (this.state === 'DEGRADED') {
      this.state = 'ACTIVE';
      this.degradedReason = undefined;
    }
  }

  public disable(): void {
    this.state = 'DISABLED';
    NewsRuntimeConfig.getInstance().setTelegramEnabled(false);
  }

  public enable(): void {
    NewsRuntimeConfig.getInstance().setTelegramEnabled(true);
    this.state = 'ACTIVE';
  }

  /**
   * Idempotency tracking: returns true if this exact event state has already been dispatched.
   */
  public isEventAlertDispatched(eventId: string, alertType: string): boolean {
    const key = `${eventId}::${alertType}`;
    return this.dispatchedEventKeys.has(key);
  }

  /**
   * Records that an event alert has been delivered to prevent duplicate alerts.
   */
  public recordDispatchedEvent(eventId: string, alertType: string): void {
    const key = `${eventId}::${alertType}`;
    this.dispatchedEventKeys.add(key);
  }

  /**
   * Hydrates historical dispatched event keys to ensure restart idempotency.
   */
  public hydrateDispatchedKeys(keys: string[]): void {
    for (const key of keys) {
      this.dispatchedEventKeys.add(key);
    }
  }

  public clearIdempotency(): void {
    this.dispatchedEventKeys.clear();
  }

  public getStatus(): TelegramOperationsStatus {
    this.syncWithRuntimeConfig();
    const pipeline = TelegramNotificationPipeline.getInstance();
    const telem = pipeline.getTelemetry();

    return {
      state: this.state,
      isPaused: this.isPaused(),
      isEnabled: this.isEnabled(),
      pauseReason: this.pauseReason,
      degradedReason: this.degradedReason,
      pausedAt: this.pausedAt,
      queueDepth: pipeline.getQueueLength(),
      totalQueued: telem.totalQueued,
      totalDispatched: telem.totalDispatched,
      totalSuppressed: telem.totalSuppressed,
      totalFailed: telem.totalFailed,
      rateLimitPauses: telem.rateLimitPauses,
      sentEventKeysCount: this.dispatchedEventKeys.size,
      timestamp: new Date().toISOString()
    };
  }
}

export const telegramOperationsController = TelegramOperationsController.getInstance();
