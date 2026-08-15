/**
 * ATHENA NEWS ENGINE V3 — NOTIFICATION HUB
 * 
 * Central unified notification gateway for all NewsEngineV3 events.
 * Nothing else communicates directly with Telegram or external alerting channels.
 * Routes events based on Notification Type and Priority to configured Telegram channels.
 */

import { V3EventPriority } from '../types/V3Types';
import { V3Logger } from '../logging/V3Logger';
import { TelegramMultiChannelRouter, TelegramChannelType } from '../distribution/telegram/TelegramMultiChannelRouter';
import { V3EventBus } from '../events/V3EventBus';
import { V3Utils } from '../utils/V3Utils';

export type V3NotificationType =
  | 'PIPELINE'
  | 'COLLECTOR'
  | 'QUALITY'
  | 'SYSTEM'
  | 'HEALTH'
  | 'SECURITY'
  | 'AI'
  | 'NORMALIZATION'
  | 'DEDUPLICATION'
  | 'CLASSIFICATION';

export interface V3NotificationPayload {
  id: string;
  type: V3NotificationType;
  title: string;
  message: string;
  priority: V3EventPriority;
  timestamp: string;
  metadata?: Record<string, any>;
  targetChannelOverride?: TelegramChannelType;
}

export interface V3NotificationRoutingRule {
  type: V3NotificationType;
  minPriority: V3EventPriority;
  channels: TelegramChannelType[];
}

export class NotificationHub {
  private static instance: NotificationHub;
  private notificationHistory: V3NotificationPayload[] = [];
  private maxHistorySize = 1000;

  // Configurable notification routing table
  private routingRules: V3NotificationRoutingRule[] = [
    { type: 'PIPELINE', minPriority: 'LOW', channels: ['DEVELOPERS'] },
    { type: 'COLLECTOR', minPriority: 'NORMAL', channels: ['DEVELOPERS', 'OPERATIONS'] },
    { type: 'QUALITY', minPriority: 'NORMAL', channels: ['OPERATIONS', 'DEVELOPERS'] },
    { type: 'SYSTEM', minPriority: 'NORMAL', channels: ['OPERATIONS'] },
    { type: 'HEALTH', minPriority: 'HIGH', channels: ['OPERATIONS'] },
    { type: 'SECURITY', minPriority: 'HIGH', channels: ['OPERATIONS', 'DEVELOPERS'] },
    { type: 'AI', minPriority: 'NORMAL', channels: ['DEVELOPERS'] },
    { type: 'NORMALIZATION', minPriority: 'LOW', channels: ['DEVELOPERS', 'OPERATIONS'] },
    { type: 'DEDUPLICATION', minPriority: 'LOW', channels: ['DEVELOPERS', 'OPERATIONS'] },
    { type: 'CLASSIFICATION', minPriority: 'LOW', channels: ['DEVELOPERS', 'OPERATIONS'] }
  ];

  private constructor() {
    this.subscribeToEventBus();
  }

  public static getInstance(): NotificationHub {
    if (!NotificationHub.instance) {
      NotificationHub.instance = new NotificationHub();
    }
    return NotificationHub.instance;
  }

  public async dispatch(notification: Omit<V3NotificationPayload, 'id' | 'timestamp'>): Promise<string> {
    const fullNotification: V3NotificationPayload = {
      ...notification,
      id: V3Utils.generateId('NOTIF'),
      timestamp: new Date().toISOString()
    };

    // Store in history
    this.notificationHistory.push(fullNotification);
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift();
    }

    V3Logger.getInstance().info('NotificationHub', `Dispatching notification [${fullNotification.type}]: ${fullNotification.title}`, {
      id: fullNotification.id,
      priority: fullNotification.priority
    });

    // Resolve target channels
    const targetChannels = fullNotification.targetChannelOverride
      ? [fullNotification.targetChannelOverride]
      : this.resolveChannels(fullNotification.type, fullNotification.priority);

    // Route to Telegram Multi-Channel Router (non-blocking)
    for (const channel of targetChannels) {
      await TelegramMultiChannelRouter.getInstance().sendToChannel(channel, {
        title: fullNotification.title,
        message: fullNotification.message,
        type: fullNotification.type,
        priority: fullNotification.priority,
        metadata: fullNotification.metadata
      });
    }

    return fullNotification.id;
  }

  private resolveChannels(type: V3NotificationType, priority: V3EventPriority): TelegramChannelType[] {
    const priorityWeights: Record<V3EventPriority, number> = {
      LOW: 1,
      NORMAL: 2,
      HIGH: 3,
      CRITICAL: 4
    };

    const targetChannels = new Set<TelegramChannelType>();

    for (const rule of this.routingRules) {
      if (rule.type === type && priorityWeights[priority] >= priorityWeights[rule.minPriority]) {
        rule.channels.forEach(ch => targetChannels.add(ch));
      }
    }

    // Fallback if no specific rule matched
    if (targetChannels.size === 0) {
      targetChannels.add('DEVELOPERS');
    }

    // High/Critical priority always notifies Operations
    if (priority === 'HIGH' || priority === 'CRITICAL') {
      targetChannels.add('OPERATIONS');
    }

    return Array.from(targetChannels);
  }

  private subscribeToEventBus(): void {
    const bus = V3EventBus.getInstance();

    bus.subscribe('ARTICLE_RECEIVED', async (evt) => {
      await this.dispatch({
        type: 'PIPELINE',
        title: '📥 ARTICLE_RECEIVED',
        message: `Article "${evt.payload.article?.title || 'Untitled'}" received from ${evt.payload.collectorName || evt.payload.collectorId} [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'LOW',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('ARTICLE_NORMALIZED', async (evt) => {
      await this.dispatch({
        type: 'NORMALIZATION',
        title: '🧹 ARTICLE_NORMALIZED',
        message: `Article ${evt.payload.documentId || ''} normalized successfully [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'LOW',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('ARTICLE_CLASSIFIED', async (evt) => {
      await this.dispatch({
        type: 'CLASSIFICATION',
        title: '🏷️ ARTICLE_CLASSIFIED',
        message: `Category: ${evt.payload.category || 'GENERAL'} | Confidence: ${evt.payload.confidence || 0}% [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'LOW',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('METRICS_EXTRACTED', async (evt) => {
      await this.dispatch({
        type: 'PIPELINE',
        title: '📊 ARTICLE_PARSED',
        message: `Metrics extracted by ${evt.payload.parserType || 'Parser'}. Count: ${evt.payload.metricsCount || 0} [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'LOW',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('DUPLICATE_DETECTED', async (evt) => {
      await this.dispatch({
        type: 'DEDUPLICATION',
        title: '👯 ARTICLE_DUPLICATE',
        message: `Duplicate detected for cluster ${evt.payload.clusterId || ''} [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'LOW',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('COLLECTOR_FAILED', async (evt) => {
      await this.dispatch({
        type: 'COLLECTOR',
        title: '❌ SOURCE_FETCH_FAILED',
        message: `Collector ${evt.payload.collectorName} failed: ${evt.payload.error} [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'HIGH',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('QUALITY_GATE_FAILED', async (evt) => {
      await this.dispatch({
        type: 'QUALITY',
        title: '⚠️ ARTICLE_QUALITY_FAILED',
        message: `Article ${evt.payload.articleId} failed quality gate. Score: ${evt.payload.score} [TraceID: ${evt.correlationId || 'N/A'}]`,
        priority: 'NORMAL',
        metadata: { ...evt.payload, correlationId: evt.correlationId }
      });
    });

    bus.subscribe('STORY_PUBLISHED', async (evt) => {
      const story = evt.payload.story;
      const pubName = story?.publisher?.name || evt.payload.publisher || 'Unknown';
      const headline = story?.headline || evt.payload.headline || 'Untitled';
      const storyId = story?.storyId || 'N/A';
      const correlation = evt.correlationId || story?.correlationId || 'N/A';

      await this.dispatch({
        type: 'PIPELINE',
        title: '📰 V3 LIVE ARTICLE',
        message: `Source: ${pubName}\nArticle: "${headline}"\nID: ${storyId}\nStage: PUBLISHED\nCorrelation: ${correlation}`,
        priority: 'NORMAL',
        targetChannelOverride: 'NEWS',
        metadata: { ...evt.payload, correlationId: correlation }
      });
    });
  }

  public getHistory(limit = 50): V3NotificationPayload[] {
    return this.notificationHistory.slice(-limit);
  }

  public setRoutingRules(rules: V3NotificationRoutingRule[]): void {
    this.routingRules = rules;
  }

  public getRoutingRules(): V3NotificationRoutingRule[] {
    return [...this.routingRules];
  }

  public clearHistory(): void {
    this.notificationHistory = [];
  }
}
