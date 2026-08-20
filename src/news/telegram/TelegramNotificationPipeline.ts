/**
 * ATHENA NEWS ENGINE — STAGE 8.2A
 * TelegramNotificationPipeline
 * 
 * Production pipeline connecting Live Ingestion, Deterministic Eligibility,
 * Quality Gates, and Trader Telegram Notification formatting.
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
}

export class TelegramNotificationPipeline {
  private static instance: TelegramNotificationPipeline;
  private dispatchHistory: Map<string, TelegramPipelineResult> = new Map();
  private auditModeOnly = false; // Enabled for production

  private constructor() {}

  public static getInstance(): TelegramNotificationPipeline {
    if (!TelegramNotificationPipeline.instance) {
      TelegramNotificationPipeline.instance = new TelegramNotificationPipeline();
    }
    return TelegramNotificationPipeline.instance;
  }

  /**
   * Process an incoming article through the Stage 8.2A Telegram pipeline
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

    const finalResult: TelegramPipelineResult = {
      articleId,
      isEligible: true,
      qualityGatePassed: true,
      dispatched,
      score: assessment.score,
      urgency: assessment.urgency,
      eventType: assessment.eventType,
      formattedMessage,
      assessment
    };

    this.dispatchHistory.set(articleId, finalResult);
    return finalResult;
  }

  public getHistory(): TelegramPipelineResult[] {
    return Array.from(this.dispatchHistory.values());
  }

  public clearHistory(): void {
    this.dispatchHistory.clear();
    TelegramQualityGate.clearHistory();
  }
}
