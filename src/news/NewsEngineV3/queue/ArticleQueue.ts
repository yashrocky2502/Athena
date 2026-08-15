/**
 * ATHENA NEWS ENGINE V3 — ARTICLE PROCESSING QUEUE
 * 
 * Thread-safe, priority-ordered internal processing queue for raw ingested articles.
 */

import { V3RawArticle, V3EventPriority, V3PublisherId } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import { V3Logger } from '../logging/V3Logger';
import { V3EventBus } from '../events/V3EventBus';
import { V3Telemetry } from '../telemetry/V3Telemetry';

export type V3QueueItemStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface V3QueueItem {
  queueId: string;
  receivedAt: string;
  collectorId: V3PublisherId;
  priority: V3EventPriority;
  status: V3QueueItemStatus;
  article: V3RawArticle;
  attempts: number;
  lastError?: string;
}

export class ArticleQueue {
  private static instance: ArticleQueue;
  private queue: V3QueueItem[] = [];
  private itemMap: Map<string, V3QueueItem> = new Map();
  private maxQueueSize = 5000;

  private priorityWeights: Record<V3EventPriority, number> = {
    CRITICAL: 100,
    HIGH: 75,
    NORMAL: 50,
    LOW: 25
  };

  private constructor() {}

  public static getInstance(): ArticleQueue {
    if (!ArticleQueue.instance) {
      ArticleQueue.instance = new ArticleQueue();
    }
    return ArticleQueue.instance;
  }

  public enqueue(
    article: V3RawArticle,
    priority: V3EventPriority = 'NORMAL'
  ): V3QueueItem {
    const queueId = V3Utils.generateId('Q');
    const item: V3QueueItem = {
      queueId,
      receivedAt: new Date().toISOString(),
      collectorId: article.publisherId,
      priority,
      status: 'PENDING',
      article,
      attempts: 0
    };

    // Prevent overflow
    if (this.queue.length >= this.maxQueueSize) {
      V3Logger.getInstance().warn('ArticleQueue', 'Queue overflow! Dropping oldest pending low priority item.');
      const lowestIndex = this.queue.findIndex(i => i.status === 'PENDING' && i.priority === 'LOW');
      if (lowestIndex !== -1) {
        const removed = this.queue.splice(lowestIndex, 1)[0];
        this.itemMap.delete(removed.queueId);
      }
    }

    this.queue.push(item);
    this.itemMap.set(queueId, item);

    // Sort queue by priority weight
    this.sortQueue();

    V3Telemetry.getInstance().setQueueLength(this.getPendingCount());

    V3Logger.getInstance().debug('ArticleQueue', `Enqueued article ${article.id}`, { queueId, priority });

    // Emit event asynchronously
    V3EventBus.getInstance().publish({
      eventId: V3Utils.generateId('EVT'),
      type: 'ARTICLE_QUEUED',
      priority,
      timestamp: new Date().toISOString(),
      correlationId: V3Utils.generateId('ENQUEUE'),
      payload: { queueId, articleId: article.id, collectorId: article.publisherId }
    }).catch(() => {});

    return item;
  }

  public dequeue(): V3QueueItem | undefined {
    const nextItem = this.queue.find(item => item.status === 'PENDING');
    if (nextItem) {
      nextItem.status = 'PROCESSING';
      nextItem.attempts++;
      V3Telemetry.getInstance().setQueueLength(this.getPendingCount());
      return nextItem;
    }
    return undefined;
  }

  public markCompleted(queueId: string): void {
    const item = this.itemMap.get(queueId);
    if (item) {
      item.status = 'COMPLETED';
      V3Telemetry.getInstance().setQueueLength(this.getPendingCount());
    }
  }

  public markFailed(queueId: string, errorMsg: string): void {
    const item = this.itemMap.get(queueId);
    if (item) {
      item.status = 'FAILED';
      item.lastError = errorMsg;
      V3Telemetry.getInstance().setQueueLength(this.getPendingCount());
    }
  }

  public getPendingCount(): number {
    return this.queue.filter(i => i.status === 'PENDING').length;
  }

  public getProcessingCount(): number {
    return this.queue.filter(i => i.status === 'PROCESSING').length;
  }

  public getCompletedCount(): number {
    return this.queue.filter(i => i.status === 'COMPLETED').length;
  }

  public getFailedCount(): number {
    return this.queue.filter(i => i.status === 'FAILED').length;
  }

  public getItem(queueId: string): V3QueueItem | undefined {
    return this.itemMap.get(queueId);
  }

  public getPendingItems(limit = 50): V3QueueItem[] {
    return this.queue.filter(i => i.status === 'PENDING').slice(0, limit);
  }

  public getAllItems(limit = 100): V3QueueItem[] {
    return this.queue.slice(-limit);
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Pending items first, then by priority
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return this.priorityWeights[b.priority] - this.priorityWeights[a.priority];
    });
  }

  public clear(): void {
    this.queue = [];
    this.itemMap.clear();
    V3Telemetry.getInstance().setQueueLength(0);
  }
}
