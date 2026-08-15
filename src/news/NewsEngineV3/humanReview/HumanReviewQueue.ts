/**
 * ATHENA NEWS ENGINE V3 — HUMAN REVIEW QUEUE
 * 
 * Manages stories or raw articles flagged for human inspection due to:
 * - Low parser confidence score
 * - Quality gate soft warnings
 * - Metric/Financial number conflicts
 * - Executive quote attribution conflicts
 * - Deduplication uncertainty
 * 
 * Supports human reviewer actions: APPROVE, REJECT, CORRECT, REPLAY
 */

import { V3RawArticle, V3Story } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import { V3Logger } from '../logging/V3Logger';
import { NotificationHub } from '../notificationHub/NotificationHub';

export type V3HumanReviewReason =
  | 'LOW_PARSER_CONFIDENCE'
  | 'QUALITY_GATE_WARNING'
  | 'METRIC_CONFLICT'
  | 'QUOTE_CONFLICT'
  | 'DUPLICATE_UNCERTAINTY';

export type V3HumanReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTED' | 'REPLAYED';

export type V3ReviewerAction = 'APPROVE' | 'REJECT' | 'CORRECT' | 'REPLAY';

export interface V3HumanReviewItem {
  reviewId: string;
  articleId: string;
  flaggedAt: string;
  reason: V3HumanReviewReason;
  confidenceScore: number;
  status: V3HumanReviewStatus;
  article: V3RawArticle;
  storyCandidate?: Partial<V3Story>;
  reviewerNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  correctedFields?: Record<string, any>;
}

export class HumanReviewQueue {
  private static instance: HumanReviewQueue;
  private reviewItems: Map<string, V3HumanReviewItem> = new Map();

  private constructor() {}

  public static getInstance(): HumanReviewQueue {
    if (!HumanReviewQueue.instance) {
      HumanReviewQueue.instance = new HumanReviewQueue();
    }
    return HumanReviewQueue.instance;
  }

  public enqueueForReview(
    article: V3RawArticle,
    reason: V3HumanReviewReason,
    confidenceScore: number,
    storyCandidate?: Partial<V3Story>
  ): V3HumanReviewItem {
    const reviewId = V3Utils.generateId('REV');
    const item: V3HumanReviewItem = {
      reviewId,
      articleId: article.id,
      flaggedAt: new Date().toISOString(),
      reason,
      confidenceScore,
      status: 'PENDING_REVIEW',
      article,
      storyCandidate
    };

    this.reviewItems.set(reviewId, item);

    V3Logger.getInstance().warn('HumanReviewQueue', `Article ${article.id} flagged for human review. Reason: ${reason}`, { reviewId });

    // Alert operations
    NotificationHub.getInstance().dispatch({
      type: 'QUALITY',
      title: '🕵️ Human Review Flagged',
      message: `Article "${article.title.substring(0, 50)}..." flagged for review (${reason}). Confidence: ${confidenceScore}%`,
      priority: 'NORMAL',
      metadata: { reviewId, articleId: article.id, reason }
    }).catch(() => {});

    return item;
  }

  public processReviewAction(
    reviewId: string,
    action: V3ReviewerAction,
    reviewerId: string,
    note?: string,
    correctedFields?: Record<string, any>
  ): V3HumanReviewItem {
    const item = this.reviewItems.get(reviewId);
    if (!item) {
      throw new Error(`Review item ${reviewId} not found.`);
    }

    item.reviewedAt = new Date().toISOString();
    item.reviewedBy = reviewerId;
    item.reviewerNote = note;

    switch (action) {
      case 'APPROVE':
        item.status = 'APPROVED';
        break;
      case 'REJECT':
        item.status = 'REJECTED';
        break;
      case 'CORRECT':
        item.status = 'CORRECTED';
        item.correctedFields = correctedFields;
        break;
      case 'REPLAY':
        item.status = 'REPLAYED';
        break;
    }

    V3Logger.getInstance().info('HumanReviewQueue', `Human review ${reviewId} processed with action: ${action}`, {
      reviewerId,
      status: item.status
    });

    return item;
  }

  public getPendingItems(): V3HumanReviewItem[] {
    return Array.from(this.reviewItems.values()).filter(i => i.status === 'PENDING_REVIEW');
  }

  public getAllItems(): V3HumanReviewItem[] {
    return Array.from(this.reviewItems.values());
  }

  public getItem(reviewId: string): V3HumanReviewItem | undefined {
    return this.reviewItems.get(reviewId);
  }

  public clear(): void {
    this.reviewItems.clear();
  }
}
