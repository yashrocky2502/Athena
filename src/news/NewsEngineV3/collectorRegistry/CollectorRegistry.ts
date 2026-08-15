/**
 * ATHENA NEWS ENGINE V3 — COLLECTOR REGISTRY
 * 
 * Central registry managing lifecycle, polling, enabling/disabling, and
 * health inspection across all registered news collectors.
 */

import { ICollector, V3CollectorState, V3CollectorHealthMetrics } from '../collectors/ICollector';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Logger } from '../logging/V3Logger';
import { V3EventBus } from '../events/V3EventBus';
import { V3Utils } from '../utils/V3Utils';

export class CollectorRegistry {
  private static instance: CollectorRegistry;
  private collectors: Map<V3PublisherId, ICollector> = new Map();
  private pollIntervals: Map<V3PublisherId, NodeJS.Timeout> = new Map();

  private constructor() {}

  public static getInstance(): CollectorRegistry {
    if (!CollectorRegistry.instance) {
      CollectorRegistry.instance = new CollectorRegistry();
    }
    return CollectorRegistry.instance;
  }

  public register(collector: ICollector): void {
    if (this.collectors.has(collector.id)) {
      V3Logger.getInstance().warn('CollectorRegistry', `Collector ${collector.id} already registered. Overwriting.`);
    }
    this.collectors.set(collector.id, collector);
    V3Logger.getInstance().info('CollectorRegistry', `Registered collector: ${collector.name}`, { id: collector.id });
  }

  public unregister(collectorId: V3PublisherId): void {
    this.stopPolling(collectorId);
    const c = this.collectors.get(collectorId);
    if (c) {
      c.shutdown();
      this.collectors.delete(collectorId);
      V3Logger.getInstance().info('CollectorRegistry', `Unregistered collector: ${collectorId}`);
    }
  }

  public get(collectorId: V3PublisherId): ICollector | undefined {
    return this.collectors.get(collectorId);
  }

  public getAll(): ICollector[] {
    return Array.from(this.collectors.values());
  }

  public async initializeAll(): Promise<void> {
    for (const collector of this.collectors.values()) {
      try {
        await collector.initialize();
      } catch (err) {
        V3Logger.getInstance().error('CollectorRegistry', `Failed to initialize collector ${collector.name}`, err);
      }
    }
  }

  public async shutdownAll(): Promise<void> {
    for (const id of this.collectors.keys()) {
      this.stopPolling(id);
    }
    for (const collector of this.collectors.values()) {
      await collector.shutdown();
    }
  }

  public async restartAll(): Promise<void> {
    await this.shutdownAll();
    await this.initializeAll();
  }

  public enable(collectorId: V3PublisherId): void {
    const c = this.collectors.get(collectorId);
    if (c) {
      c.resume();
    }
  }

  public disable(collectorId: V3PublisherId): void {
    const c = this.collectors.get(collectorId);
    if (c) {
      c.pause();
    }
  }

  public async pollSingle(collectorId: V3PublisherId): Promise<V3RawArticle[]> {
    const collector = this.collectors.get(collectorId);
    if (!collector) return [];

    try {
      const articles = await collector.fetch();
      for (const article of articles) {
        await V3EventBus.getInstance().publish({
          eventId: V3Utils.generateId('EVT'),
          type: 'ARTICLE_RECEIVED',
          priority: 'NORMAL',
          timestamp: new Date().toISOString(),
          correlationId: V3Utils.generateId('FETCH'),
          payload: { article, collectorId: collector.id, collectorName: collector.name }
        });
      }
      return articles;
    } catch (err) {
      V3Logger.getInstance().error('CollectorRegistry', `Error polling single collector ${collectorId}`, err);
      return [];
    }
  }

  public async pollAll(): Promise<Record<string, V3RawArticle[]>> {
    const results: Record<string, V3RawArticle[]> = {};
    for (const [id] of this.collectors) {
      results[id] = await this.pollSingle(id);
    }
    return results;
  }

  public startPolling(collectorId: V3PublisherId, intervalMs = 30000): void {
    this.stopPolling(collectorId);
    const timer = setInterval(async () => {
      await this.pollSingle(collectorId);
    }, intervalMs);
    this.pollIntervals.set(collectorId, timer);
    V3Logger.getInstance().info('CollectorRegistry', `Started polling for ${collectorId} every ${intervalMs}ms`);
  }

  public stopPolling(collectorId: V3PublisherId): void {
    const timer = this.pollIntervals.get(collectorId);
    if (timer) {
      clearInterval(timer);
      this.pollIntervals.delete(collectorId);
      V3Logger.getInstance().info('CollectorRegistry', `Stopped polling for ${collectorId}`);
    }
  }

  public status(): Record<string, V3CollectorState> {
    const res: Record<string, V3CollectorState> = {};
    this.collectors.forEach((c, id) => {
      res[id] = c.getState();
    });
    return res;
  }

  public health(): Record<string, V3CollectorHealthMetrics> {
    const res: Record<string, V3CollectorHealthMetrics> = {};
    this.collectors.forEach((c, id) => {
      res[id] = c.getHealth();
    });
    return res;
  }

  public clear(): void {
    this.pollIntervals.forEach(t => clearInterval(t));
    this.pollIntervals.clear();
    this.collectors.clear();
  }
}
