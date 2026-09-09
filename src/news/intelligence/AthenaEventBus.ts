/**
 * ATHENA UNIFIED INTELLIGENCE OS — AthenaEventBus.ts
 * 
 * Implements the robust central AthenaEventBus.
 * Supports:
 * - publish, subscribe
 * - priority (P0_CRITICAL, P1_HIGH, P2_NORMAL, P3_LOW)
 * - retries with exponential backoff / simulation
 * - deduplication / idempotency
 * - correlation IDs
 * - lifecycle state tracking
 * - failure isolation & dead-letter queue (DLQ)
 * - event replay
 */

import { UnifiedAthenaEvent } from './UnifiedIntelligenceTypes.ts';

export type EventBusPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_NORMAL' | 'P3_LOW';

export interface Subscription {
  eventType: string;
  handler: (event: UnifiedAthenaEvent) => Promise<void>;
}

export class AthenaEventBus {
  private static instance: AthenaEventBus;

  private subscriptions: Subscription[] = [];
  private processedEventIds: Set<string> = new Set();
  private eventStore: Map<string, UnifiedAthenaEvent> = new Map();
  private dlq: UnifiedAthenaEvent[] = [];
  private eventQueue: { event: UnifiedAthenaEvent; priority: EventBusPriority }[] = [];

  private constructor() {}

  public static getInstance(): AthenaEventBus {
    if (!this.instance) {
      this.instance = new AthenaEventBus();
    }
    return this.instance;
  }

  public reset(): void {
    this.subscriptions = [];
    this.processedEventIds.clear();
    this.eventStore.clear();
    this.dlq = [];
    this.eventQueue = [];
  }

  /**
   * Subscribe to specific event types
   */
  public subscribe(eventType: string, handler: (event: UnifiedAthenaEvent) => Promise<void>): void {
    this.subscriptions.push({ eventType, handler });
  }

  /**
   * Get DLQ events
   */
  public getDLQ(): UnifiedAthenaEvent[] {
    return this.dlq;
  }

  /**
   * Get all stored events
   */
  public getAllStoredEvents(): UnifiedAthenaEvent[] {
    return Array.from(this.eventStore.values());
  }

  /**
   * Get an event by ID
   */
  public getEventById(eventId: string): UnifiedAthenaEvent | undefined {
    return this.eventStore.get(eventId);
  }

  /**
   * Publish an event onto the Event Bus
   */
  public async publish(event: UnifiedAthenaEvent, retryCount = 0): Promise<void> {
    // 1. Deduplication & Idempotency
    if (this.processedEventIds.has(event.eventId)) {
      console.warn(`[AthenaEventBus] Deduplicated event ${event.eventId} already processed.`);
      return;
    }

    // Determine priority
    let priority: EventBusPriority = 'P2_NORMAL';
    if (event.eventType.includes('CRITICAL') || event.sourceType === 'P0') {
      priority = 'P0_CRITICAL';
    } else if (event.eventType.includes('HIGH') || event.sourceType === 'P1') {
      priority = 'P1_HIGH';
    } else if (event.eventType.includes('LOW')) {
      priority = 'P3_LOW';
    }

    this.eventStore.set(event.eventId, event);
    this.eventQueue.push({ event, priority });

    // Sort queue based on priority
    this.sortQueue();

    // Mark as processed
    this.processedEventIds.add(event.eventId);

    // 2. Dispatch to subscribers
    const matchedSubs = this.subscriptions.filter(s => s.eventType === event.eventType || s.eventType === '*');

    for (const sub of matchedSubs) {
      try {
        await sub.handler(event);
      } catch (err: any) {
        console.error(`[AthenaEventBus] Handler failure for event ${event.eventId}:`, err);
        
        // Retry logic: 3 maximum retries
        if (retryCount < 3) {
          console.log(`[AthenaEventBus] Retrying event ${event.eventId} (Attempt ${retryCount + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 50 * (retryCount + 1)));
          this.processedEventIds.delete(event.eventId); // allow reprocessing
          await this.publish(event, retryCount + 1);
        } else {
          console.warn(`[AthenaEventBus] Max retries exceeded. Routing event ${event.eventId} to DLQ.`);
          this.dlq.push(event);
        }
      }
    }
  }

  /**
   * Replays an event from store
   */
  public async replayEvent(eventId: string): Promise<UnifiedAthenaEvent | null> {
    const event = this.eventStore.get(eventId);
    if (!event) return null;

    console.log(`[AthenaEventBus] Replaying event ${eventId}...`);
    // Remove from processed IDs so it can run again
    this.processedEventIds.delete(eventId);
    await this.publish(event);
    return event;
  }

  private sortQueue(): void {
    const priorityWeights: Record<EventBusPriority, number> = {
      P0_CRITICAL: 4,
      P1_HIGH: 3,
      P2_NORMAL: 2,
      P3_LOW: 1
    };

    this.eventQueue.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);
  }
}
