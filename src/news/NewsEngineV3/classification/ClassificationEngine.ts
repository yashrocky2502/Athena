/**
 * ATHENA NEWS ENGINE V3 — CLASSIFICATION ENGINE
 * 
 * Main orchestrator for Phase 5 Institutional Classification Engine.
 * Purely deterministic, NO AI, Bloomberg/Refinitiv style rule classification.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { CompanyResolver } from './CompanyResolver';
import { RuleEngine } from './RuleEngine';
import { UrgencyScorer } from './UrgencyScorer';
import { ImpactScorer } from './ImpactScorer';
import { ConfidenceCalculator } from './ConfidenceCalculator';
import { RoutingEngine } from './RoutingEngine';
import { ClassificationValidator } from './ClassificationValidator';
import { ClassificationRepository } from './ClassificationRepository';
import { ClassificationResult, ClassificationCategory } from './types/ClassificationTypes';
import { V3EventBus } from '../events/V3EventBus';
import { TelegramMultiChannelRouter } from '../distribution/telegram/TelegramMultiChannelRouter';
import { V3Logger } from '../logging/V3Logger';
import { V3Utils } from '../utils/V3Utils';

export class ClassificationEngine {
  private static instance: ClassificationEngine;

  private repository = ClassificationRepository.getInstance();
  private eventBus = V3EventBus.getInstance();
  private telegramRouter = TelegramMultiChannelRouter.getInstance();
  private logger = V3Logger.getInstance();

  private constructor() {}

  public static getInstance(): ClassificationEngine {
    if (!ClassificationEngine.instance) {
      ClassificationEngine.instance = new ClassificationEngine();
    }
    return ClassificationEngine.instance;
  }

  /**
   * Classifies a NormalizedDocument.
   */
  public async classifyDocument(doc: NormalizedDocument): Promise<ClassificationResult> {
    const startTime = performance.now();
    const correlationId = (doc.metadata as any)?.correlationId || V3Utils.generateId('CORR');

    // 1. Resolve Company
    const resolvedCompanies = CompanyResolver.resolveCompanies(doc);

    // 2. Evaluate Category Rules & Resolve Conflicts
    const { matches, conflicts } = RuleEngine.evaluateRules(doc);

    // Extract categories
    const allCategories: ClassificationCategory[] = matches.length > 0
      ? matches.map(m => m.category)
      : ['GENERAL_MARKET'];

    // Select primary category (highest confidence match)
    const sortedMatches = [...matches].sort((a, b) => b.confidence - a.confidence);
    const primaryCategory: ClassificationCategory = sortedMatches.length > 0
      ? sortedMatches[0].category
      : 'GENERAL_MARKET';

    // 3. Compute Urgency Score
    const urgencyScore = UrgencyScorer.calculateUrgency(allCategories, doc.title);

    // 4. Compute Impact Score
    const primaryCompany = resolvedCompanies[0];
    const impactScore = ImpactScorer.calculateImpact(allCategories, primaryCompany?.marketCapBucket);

    // 5. Compute Classification Confidence
    const classificationConfidence = ConfidenceCalculator.calculateConfidence(
      matches,
      resolvedCompanies,
      conflicts
    );

    // 6. Determine Parser Route
    const targetParser = RoutingEngine.determineRoute(primaryCategory);

    const processingTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    // Build raw ClassificationResult
    let result: ClassificationResult = {
      documentId: doc.documentId,
      title: doc.title,
      primaryCategory,
      allCategories,
      categoryMatches: matches,
      resolvedCompany: primaryCompany,
      resolvedCompanies,
      urgencyScore,
      impactScore,
      classificationConfidence,
      targetParser,
      isRejected: false,
      conflictsDetected: conflicts,
      processingTimeMs,
      timestamp: new Date().toISOString()
    };

    // 7. Validate Classification Result
    const validation = ClassificationValidator.validate(result);
    if (!validation.isValid) {
      result.isRejected = true;
      result.rejectionReason = validation.errors.join('; ');
    }

    // 8. Save to Repository
    this.repository.save(result);

    // 9. Publish Pipeline Event
    if (result.isRejected) {
      await this.eventBus.publish({
        eventId: V3Utils.generateId('EVT'),
        type: 'CLASSIFICATION_FAILED',
        priority: 'HIGH',
        timestamp: new Date().toISOString(),
        correlationId,
        payload: {
          documentId: doc.documentId,
          title: doc.title,
          rejectionReason: result.rejectionReason,
          errors: validation.errors
        }
      });

      // Send Telegram alert to Operations
      await this.telegramRouter.sendToChannel('OPERATIONS', {
        title: '⚠️ CLASSIFICATION REJECTED',
        message: `Article: ${doc.title}\nReason: ${result.rejectionReason}\nDocument ID: ${doc.documentId}`,
        type: 'CLASSIFICATION_FAILURE',
        priority: 'HIGH'
      });
    } else {
      await this.eventBus.publish({
        eventId: V3Utils.generateId('EVT'),
        type: 'ARTICLE_CLASSIFIED',
        priority: 'NORMAL',
        timestamp: new Date().toISOString(),
        correlationId,
        payload: {
          documentId: doc.documentId,
          primaryCategory: result.primaryCategory,
          categories: result.allCategories,
          confidence: result.classificationConfidence,
          targetParser: result.targetParser.parserName,
          company: primaryCompany?.ticker || 'N/A'
        }
      });

      // Telegram Developer Channel Notification
      const devMessage = `⚡ *CLASSIFIED STORY*\n` +
        `• *Company*: ${primaryCompany?.name || 'N/A'} (${primaryCompany?.ticker || 'N/A'})\n` +
        `• *Primary Category*: ${result.primaryCategory}\n` +
        `• *All Categories*: ${result.allCategories.join(', ')}\n` +
        `• *Confidence*: ${result.classificationConfidence}/100\n` +
        `• *Urgency*: ${result.urgencyScore}/100 | *Impact*: ${result.impactScore}\n` +
        `• *Router*: ${result.targetParser.parserName}\n` +
        `• *Latency*: ${result.processingTimeMs}ms`;

      await this.telegramRouter.sendToChannel('DEVELOPERS', {
        title: '⚡ STORY CLASSIFIED',
        message: devMessage,
        type: 'CLASSIFIED',
        priority: 'NORMAL'
      });

      // Telegram Operations Channel Alerts (Low confidence or conflict)
      if (result.classificationConfidence < 80 || conflicts.length > 0) {
        let opsAlert = `⚠️ *CLASSIFICATION ALERT*\n` +
          `• *Story*: ${doc.title.slice(0, 80)}\n` +
          `• *Confidence*: ${result.classificationConfidence}/100\n` +
          `• *Conflicts*: ${conflicts.length > 0 ? conflicts.join('; ') : 'None'}`;

        await this.telegramRouter.sendToChannel('OPERATIONS', {
          title: '⚠️ CLASSIFICATION WARNING',
          message: opsAlert,
          type: 'CLASSIFICATION_WARNING',
          priority: 'NORMAL'
        });
      }
    }

    return result;
  }
}
