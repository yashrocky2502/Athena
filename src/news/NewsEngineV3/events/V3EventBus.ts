/**
 * ATHENA NEWS ENGINE V3 — ASYNCHRONOUS EVENT BUS
 * 
 * High-performance, priority-aware asynchronous event bus with retry logic,
 * event history tracking, error containment, and subscriber management.
 */

import { V3PipelineEvent, V3EventPriority } from '../types/V3Types';
import { V3Logger } from '../logging/V3Logger';
import { V3Telemetry } from '../telemetry/V3Telemetry';

export type V3EventHandler = (event: V3PipelineEvent) => Promise<void> | void;

export interface V3SubscriptionOptions {
  priority?: V3EventPriority;
  maxRetries?: number;
}

interface RegisteredSubscriber {
  id: string;
  handler: V3EventHandler;
  priority: V3EventPriority;
  maxRetries: number;
}

export class V3EventBus {
  private static instance: V3EventBus;
  private subscribers: Map<string, RegisteredSubscriber[]> = new Map();
  private eventHistory: V3PipelineEvent[] = [];
  private maxHistorySize = 1000;
  private subscriberIdCounter = 0;

  private priorityWeights: Record<V3EventPriority, number> = {
    CRITICAL: 100,
    HIGH: 75,
    NORMAL: 50,
    LOW: 25
  };

  private constructor() {}

  public static getInstance(): V3EventBus {
    if (!V3EventBus.instance) {
      V3EventBus.instance = new V3EventBus();
    }
    return V3EventBus.instance;
  }

  public subscribe(
    eventType: V3PipelineEvent['type'],
    handler: V3EventHandler,
    options?: V3SubscriptionOptions
  ): () => void {
    const subscriberId = `SUB_${++this.subscriberIdCounter}`;
    const sub: RegisteredSubscriber = {
      id: subscriberId,
      handler,
      priority: options?.priority || 'NORMAL',
      maxRetries: options?.maxRetries !== undefined ? options.maxRetries : 2
    };

    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const list = this.subscribers.get(eventType)!;
    list.push(sub);

    // Sort by priority weight descending
    list.sort((a, b) => this.priorityWeights[b.priority] - this.priorityWeights[a.priority]);

    V3Logger.getInstance().debug('V3EventBus', `Subscribed to ${eventType}`, { subscriberId, priority: sub.priority });

    return () => this.unsubscribe(eventType, subscriberId);
  }

  public unsubscribe(eventType: V3PipelineEvent['type'], subscriberId: string): void {
    const list = this.subscribers.get(eventType);
    if (!list) return;

    this.subscribers.set(
      eventType,
      list.filter(s => s.id !== subscriberId)
    );

    V3Logger.getInstance().debug('V3EventBus', `Unsubscribed from ${eventType}`, { subscriberId });
  }

  public async publish(event: V3PipelineEvent): Promise<void> {
    // Record event in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    V3Logger.getInstance().debug('V3EventBus', `Publishing event: ${event.type}`, {
      eventId: event.eventId,
      correlationId: event.correlationId,
      priority: event.priority
    });

    const list = this.subscribers.get(event.type) || [];
    if (list.length === 0) {
      return;
    }

    // Execute handlers sequentially by priority order
    for (const sub of list) {
      let attempts = 0;
      let success = false;

      while (attempts <= sub.maxRetries && !success) {
        attempts++;
        try {
          await sub.handler(event);
          success = true;
        } catch (err) {
          V3Telemetry.getInstance().recordError();
          if (attempts <= sub.maxRetries) {
            V3Telemetry.getInstance().recordRetry();
            V3Logger.getInstance().warn('V3EventBus', `Handler error on ${event.type}, retrying (attempt ${attempts}/${sub.maxRetries})`, {
              eventId: event.eventId,
              subscriberId: sub.id,
              error: err instanceof Error ? err.message : String(err)
            });
            // Small backoff before retry
            await new Promise(r => setTimeout(r, 50 * attempts));
          } else {
            V3Logger.getInstance().error(
              'V3EventBus',
              `Handler failed permanently for ${event.type} after ${sub.maxRetries} retries`,
              err,
              { eventId: event.eventId, subscriberId: sub.id }
            );
          }
        }
      }
    }
  }

  public getEventHistory(limit: number = 50, typeFilter?: V3PipelineEvent['type']): V3PipelineEvent[] {
    let history = this.eventHistory;
    if (typeFilter) {
      history = history.filter(e => e.type === typeFilter);
    }
    return history.slice(-limit);
  }

  public clearHistory(): void {
    this.eventHistory = [];
  }

  public clearAllSubscribers(): void {
    this.subscribers.clear();
  }
}
