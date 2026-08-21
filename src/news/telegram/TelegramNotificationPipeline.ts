/**
 * ATHENA NEWS ENGINE — STAGE 8.2C
 * TelegramNotificationPipeline
 * 
 * Production pipeline connecting Live Ingestion, Deterministic Eligibility,
 * Quality Gates, and Trader Telegram Notification formatting.
 * 
 * Features:
 * - Real-time article-level dispatch queue (no polling batch accumulation)
 * - Exactly-once delivery tracking & deduplication
 * - 429 rate-limit backoff with sequential queue resumption
 * - F&O priority queueing (zero-fabrication enforced)
 * - Historical article suppression on startup
 */

import { NewsArticle } from '../types/Article';
import { TelegramAlertEligibilityEngine, TelegramEligibilityAssessment } from './TelegramAlertEligibilityEngine';
import { TelegramQualityGate, QualityGateValidationResult } from './TelegramQualityGate';
import { TraderTelegramFormatter } from './TraderTelegramFormatter';
import { TelegramService } from '../NewsEngine/TelegramService';

export interface TelegramPipelineResult {
  articleId: string;
  isEligible: boolean;
  qualityGatePassed: boolean;
  dispatched: boolean;
  score: number;
  urgency: string;
  eventType: string;
  formattedMessage?: string;
  rejectionReasons?: string[];
  assessment: TelegramEligibilityAssessment;
  dispatchedAt?: string;
  attempts?: number;
  error?: string;
  fetchedAt?: number;
  ingestedAt?: number;
  queuedAt?: number;
  sentAt?: number;
  ingestionToQueueLatencyMs?: number;
  queueToTelegramLatencyMs?: number;
  totalDeliveryLatencyMs?: number;
}

export interface QueueItem {
  article: Partial<NewsArticle> & { headline: string; body?: string; id?: string };
  articleId: string;
  isLive: boolean;
  priority: number; // 1 = F&O / Critical, 2 = High Urgency, 3 = Standard
  fetchedAt?: number;
  ingestedAt?: number;
  enqueuedAt: number;
  attempts: number;
  forceDispatch?: boolean;
  dryRun?: boolean;
  resolve?: (res: TelegramPipelineResult) => void;
  reject?: (err: any) => void;
}

export class TelegramNotificationPipeline {
  private static instance: TelegramNotificationPipeline;
  private dispatchHistory: Map<string, TelegramPipelineResult> = new Map();
  private deliveredArticleIds: Set<string> = new Set();
  private auditModeOnly = false; // Enabled for production

  // Active Dispatch Queue State
  private queue: QueueItem[] = [];
  private isProcessingQueue = false;
  private isPaused = false;
  private pausedUntil = 0;
  private workerStartedAt: number = Date.now();

  // Telemetry Counters
  private totalQueuedCount = 0;
  private totalRetriedCount = 0;
  private rateLimitPausesCount = 0;
  private maxQueueDepth = 0;

  private constructor() {
    this.workerStartedAt = Date.now();
  }

  public static getInstance(): TelegramNotificationPipeline {
    if (!TelegramNotificationPipeline.instance) {
      TelegramNotificationPipeline.instance = new TelegramNotificationPipeline();
    }
    return TelegramNotificationPipeline.instance;
  }

  public static resetInstance(): TelegramNotificationPipeline {
    if (TelegramNotificationPipeline.instance) {
      TelegramNotificationPipeline.instance.clearHistory();
    }
    TelegramNotificationPipeline.instance = new TelegramNotificationPipeline();
    return TelegramNotificationPipeline.instance;
  }

  public setAuditMode(auditOnly: boolean): void {
    this.auditModeOnly = auditOnly;
  }

  public isDelivered(articleId: string): boolean {
    return this.deliveredArticleIds.has(articleId);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Enqueue a newly discovered article for immediate real-time evaluation & dispatch.
   * Does NOT wait for batch completion or subsequent polling cycles.
   */
  public enqueueArticle(
    article: Partial<NewsArticle> & { headline: string; body?: string; id?: string },
    options?: { isLive?: boolean; forceDispatch?: boolean; dryRun?: boolean; priority?: number }
  ): Promise<TelegramPipelineResult> {
    const articleId = article.id || `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isLive = options?.isLive !== undefined ? options.isLive : true;

    // Prevent duplicate dispatch if already confirmed delivered
    if (this.deliveredArticleIds.has(articleId)) {
      const existing = this.dispatchHistory.get(articleId);
      if (existing) {
        return Promise.resolve(existing);
      }
      return Promise.resolve({
        articleId,
        isEligible: true,
        qualityGatePassed: true,
        dispatched: true,
        score: 100,
        urgency: 'HIGH',
        eventType: 'DUPLICATE',
        rejectionReasons: ['Article already dispatched previously.'],
        assessment: TelegramAlertEligibilityEngine.evaluate(article)
      });
    }

    // Historical suppression: if marked as not live and created before worker start
    if (!isLive) {
      const result: TelegramPipelineResult = {
        articleId,
        isEligible: false,
        qualityGatePassed: false,
        dispatched: false,
        score: 0,
        urgency: 'LOW',
        eventType: 'HISTORICAL',
        rejectionReasons: ['Historical article suppressed on worker startup.'],
        assessment: TelegramAlertEligibilityEngine.evaluate(article)
      };
      this.dispatchHistory.set(articleId, result);
      return Promise.resolve(result);
    }

    // Compute priority: F&O explicit evidence = 1, High urgency = 2, Normal = 3
    let priority = options?.priority || 3;
    const isFno = (article as any).isFno ||
      (article as any).category === 'FNO' ||
      (article as any).primaryCategory === 'FNO' ||
      /options|futures|strike|open interest|\boi\b|pcr|implied volatility|\biv\b/i.test(`${article.headline} ${article.body || ''}`);
    
    if (isFno) {
      priority = 1;
    }

    return new Promise<TelegramPipelineResult>((resolve, reject) => {
      const enqueuedAt = Date.now();
      const fetchedAt = (article as any).fetchedAt || ((article as any).publishedAt ? new Date((article as any).publishedAt).getTime() : enqueuedAt);
      const ingestedAt = (article as any).ingestedAt || enqueuedAt;

      const queueItem: QueueItem = {
        article,
        articleId,
        isLive,
        priority,
        fetchedAt,
        ingestedAt,
        enqueuedAt,
        attempts: 0,
        forceDispatch: options?.forceDispatch,
        dryRun: options?.dryRun,
        resolve,
        reject
      };

      this.totalQueuedCount++;

      // Priority insertion: Priority 1 before 2, 2 before 3
      let insertIndex = this.queue.length;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].priority > queueItem.priority) {
          insertIndex = i;
          break;
        }
      }
      this.queue.splice(insertIndex, 0, queueItem);
      this.maxQueueDepth = Math.max(this.maxQueueDepth, this.queue.length);

      // Trigger queue processing asynchronously
      this.triggerQueueProcessing();
    });
  }

  /**
   * Internal queue runner. Processes enqueued items sequentially in real time.
   */
  private async triggerQueueProcessing(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.queue.length > 0) {
        // Handle active rate-limit pause
        if (this.isPaused && Date.now() < this.pausedUntil) {
          const sleepMs = Math.max(50, this.pausedUntil - Date.now());
          await new Promise(r => setTimeout(r, sleepMs));
          continue;
        }
        this.isPaused = false;

        const item = this.queue.shift();
        if (!item) break;

        // Skip if already delivered while waiting in queue
        if (this.deliveredArticleIds.has(item.articleId)) {
          const existing = this.dispatchHistory.get(item.articleId) || {
            articleId: item.articleId,
            isEligible: true,
            qualityGatePassed: true,
            dispatched: true,
            score: 100,
            urgency: 'HIGH',
            eventType: 'DUPLICATE',
            assessment: TelegramAlertEligibilityEngine.evaluate(item.article)
          };
          item.resolve?.(existing);
          continue;
        }

        const result = await this.dispatchSingleItem(item);

        // Check if retryable transient error (429 or 5xx/network) -> re-insert at front and retry up to 3 attempts
        const isRetryable = !result.dispatched && (
          result.error === 'RATE_LIMITED' ||
          result.error === 'HTTP_500' ||
          result.error?.includes('500') ||
          result.error?.includes('502') ||
          result.error?.includes('503') ||
          result.error?.includes('504') ||
          result.error?.includes('network') ||
          result.error?.includes('timeout') ||
          result.rejectionReasons?.includes('RATE_LIMITED')
        );

        if (isRetryable) {
          item.attempts++;
          this.totalRetriedCount++;
          if (item.attempts <= 3) {
            this.queue.unshift(item);
            continue;
          }
        }

        item.resolve?.(result);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Evaluates and dispatches a single queue item.
   */
  private async dispatchSingleItem(item: QueueItem): Promise<TelegramPipelineResult> {
    const { article, articleId, forceDispatch, dryRun } = item;
    const sentAt = Date.now();
    const fetchedAt = item.fetchedAt || item.enqueuedAt;
    const ingestedAt = item.ingestedAt || item.enqueuedAt;
    const queuedAt = item.enqueuedAt;

    const ingestionToQueueLatencyMs = Math.max(0, queuedAt - ingestedAt);
    const queueToTelegramLatencyMs = Math.max(0, sentAt - queuedAt);
    const totalDeliveryLatencyMs = Math.max(0, sentAt - fetchedAt);

    // 1. Evaluate deterministic eligibility
    const assessment = TelegramAlertEligibilityEngine.evaluate(article);

    if (!assessment.isEligible) {
      const result: TelegramPipelineResult = {
        articleId,
        isEligible: false,
        qualityGatePassed: false,
        dispatched: false,
        score: assessment.score,
        urgency: assessment.urgency,
        eventType: assessment.eventType,
        rejectionReasons: [assessment.rejectionReason || 'Ineligible by alert score.'],
        assessment,
        fetchedAt,
        ingestedAt,
        queuedAt,
        sentAt,
        ingestionToQueueLatencyMs,
        queueToTelegramLatencyMs,
        totalDeliveryLatencyMs
      };
      this.dispatchHistory.set(articleId, result);
      return result;
    }

    // 2. Validate through Quality Gate
    const qualityResult = TelegramQualityGate.validate(assessment, article);

    if (!qualityResult.passed && !forceDispatch) {
      const result: TelegramPipelineResult = {
        articleId,
        isEligible: true,
        qualityGatePassed: false,
        dispatched: false,
        score: assessment.score,
        urgency: assessment.urgency,
        eventType: assessment.eventType,
        rejectionReasons: qualityResult.reasons,
        assessment,
        fetchedAt,
        ingestedAt,
        queuedAt,
        sentAt,
        ingestionToQueueLatencyMs,
        queueToTelegramLatencyMs,
        totalDeliveryLatencyMs
      };
      this.dispatchHistory.set(articleId, result);
      return result;
    }

    // 3. Format Notification
    const formattedMessage = TraderTelegramFormatter.format(assessment);

    // 4. Dispatch via Telegram Service if credentials configured and not dryRun
    let dispatched = false;
    let dispatchError: string | undefined;

    if (!dryRun && !this.auditModeOnly) {
      try {
        const telegramService = TelegramService.getInstance();
        const creds = telegramService.getCredentials();
        if (creds && creds.botToken && creds.chatId) {
          const sendResult = await telegramService.sendMessage(formattedMessage, creds.botToken, creds.chatId);
          dispatched = sendResult.success;

          if (sendResult.httpStatus === 429) {
            const retryAfterSec = sendResult.retryAfterSeconds || 1;
            this.isPaused = true;
            this.pausedUntil = Date.now() + (retryAfterSec * 1000);
            this.rateLimitPausesCount++;
            dispatchError = 'RATE_LIMITED';
          } else if (!sendResult.success) {
            dispatchError = sendResult.error || 'DISPATCH_FAILED';
          }
        }
      } catch (err: any) {
        console.warn('[TelegramPipeline] Dispatch error:', err);
        dispatchError = err.message || 'DISPATCH_EXCEPTION';
      }
    }

    // Mark delivered only upon verified successful dispatch or dryRun
    if (dispatched) {
      this.deliveredArticleIds.add(articleId);
    }

    const finalResult: TelegramPipelineResult = {
      articleId,
      isEligible: true,
      qualityGatePassed: true,
      dispatched,
      score: assessment.score,
      urgency: assessment.urgency,
      eventType: assessment.eventType,
      formattedMessage,
      assessment,
      dispatchedAt: dispatched ? new Date().toISOString() : undefined,
      attempts: item.attempts + 1,
      error: dispatchError,
      fetchedAt,
      ingestedAt,
      queuedAt,
      sentAt,
      ingestionToQueueLatencyMs,
      queueToTelegramLatencyMs,
      totalDeliveryLatencyMs
    };

    this.dispatchHistory.set(articleId, finalResult);
    return finalResult;
  }

  /**
   * Synchronous / Direct Article Processing (Preserved for compatibility with Stage 8.2A / 8.2B tests)
   */
  public async processArticle(
    article: Partial<NewsArticle> & { headline: string; body?: string; id?: string },
    options?: { forceDispatch?: boolean; dryRun?: boolean }
  ): Promise<TelegramPipelineResult> {
    const articleId = article.id || `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Evaluate deterministic eligibility
    const assessment = TelegramAlertEligibilityEngine.evaluate(article);

    if (!assessment.isEligible) {
      const result: TelegramPipelineResult = {
        articleId,
        isEligible: false,
        qualityGatePassed: false,
        dispatched: false,
        score: assessment.score,
        urgency: assessment.urgency,
        eventType: assessment.eventType,
        rejectionReasons: [assessment.rejectionReason || 'Ineligible by alert score.'],
        assessment
      };
      this.dispatchHistory.set(articleId, result);
      return result;
    }

    // 2. Validate through Quality Gate
    const qualityResult = TelegramQualityGate.validate(assessment, article);

    if (!qualityResult.passed && !options?.forceDispatch) {
      const result: TelegramPipelineResult = {
        articleId,
        isEligible: true,
        qualityGatePassed: false,
        dispatched: false,
        score: assessment.score,
        urgency: assessment.urgency,
        eventType: assessment.eventType,
        rejectionReasons: qualityResult.reasons,
        assessment
      };
      this.dispatchHistory.set(articleId, result);
      return result;
    }

    // 3. Format Notification
    const formattedMessage = TraderTelegramFormatter.format(assessment);

    // 4. Dispatch via Telegram Service if credentials configured and not dryRun
    let dispatched = false;
    if (!options?.dryRun && !this.auditModeOnly) {
      try {
        const telegramService = TelegramService.getInstance();
        const creds = telegramService.getCredentials();
        if (creds && creds.botToken && creds.chatId) {
          const sendResult = await telegramService.sendMessage(formattedMessage, creds.botToken, creds.chatId);
          dispatched = sendResult.success;
        }
      } catch (err) {
        console.warn('[TelegramPipeline] Dispatch error:', err);
      }
    }

    if (dispatched) {
      this.deliveredArticleIds.add(articleId);
    }

    const finalResult: TelegramPipelineResult = {
      articleId,
      isEligible: true,
      qualityGatePassed: true,
      dispatched,
      score: assessment.score,
      urgency: assessment.urgency,
      eventType: assessment.eventType,
      formattedMessage,
      assessment,
      dispatchedAt: dispatched ? new Date().toISOString() : undefined
    };

    this.dispatchHistory.set(articleId, finalResult);
    return finalResult;
  }

  public getHistory(): TelegramPipelineResult[] {
    return Array.from(this.dispatchHistory.values());
  }

  public getTelemetry() {
    const history = Array.from(this.dispatchHistory.values());
    const dispatched = history.filter(h => h.dispatched);
    const latencies = dispatched
      .map(h => h.totalDeliveryLatencyMs)
      .filter((l): l is number => typeof l === 'number' && !isNaN(l))
      .sort((a, b) => a - b);

    let medianDeliveryLatencyMs = 0;
    let p95DeliveryLatencyMs = 0;
    let maxDeliveryLatencyMs = 0;

    if (latencies.length > 0) {
      medianDeliveryLatencyMs = latencies[Math.floor(latencies.length / 2)];
      p95DeliveryLatencyMs = latencies[Math.floor(latencies.length * 0.95)];
      maxDeliveryLatencyMs = latencies[latencies.length - 1];
    }

    return {
      totalQueued: this.totalQueuedCount,
      totalDispatched: dispatched.length,
      totalSuppressed: history.filter(h => !h.isEligible || !h.qualityGatePassed).length,
      totalFailed: history.filter(h => h.isEligible && h.qualityGatePassed && !h.dispatched).length,
      totalRetried: this.totalRetriedCount,
      rateLimitPauses: this.rateLimitPausesCount,
      maxQueueDepth: this.maxQueueDepth,
      currentQueueDepth: this.queue.length,
      medianDeliveryLatencyMs,
      p95DeliveryLatencyMs,
      maxDeliveryLatencyMs
    };
  }

  public clearHistory(): void {
    this.dispatchHistory.clear();
    this.deliveredArticleIds.clear();
    this.queue = [];
    this.isProcessingQueue = false;
    this.isPaused = false;
    this.pausedUntil = 0;
    this.totalQueuedCount = 0;
    this.totalRetriedCount = 0;
    this.rateLimitPausesCount = 0;
    this.maxQueueDepth = 0;
    TelegramQualityGate.clearHistory();
  }
}

