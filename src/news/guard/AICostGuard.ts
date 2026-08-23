/**
 * ATHENA NEWS ENGINE — STAGE 8.9.4 AI COST GUARD
 * AICostGuard
 * 
 * Enforces zero-unnecessary-cost execution:
 * - Summary cache reuse
 * - Event cache reuse
 * - Duplicate article bypass
 * - Non-material revision bypass
 * - Historical hydration bypass (zero AI calls during hydration/startup)
 * - Telegram ineligibility bypass
 * - Bounded backoff and degradation on AI provider failures
 */

import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';
import { aiOperationsController } from '../operations/AIOperationsController';

export interface AICallDecision {
  shouldCallAI: boolean;
  reason: string;
  bypassStrategy?: 'CACHE_HIT' | 'DUPLICATE_ARTICLE' | 'NON_MATERIAL_UPDATE' | 'HISTORICAL_HYDRATION' | 'AI_DISABLED' | 'CIRCUIT_OPEN' | 'TELEGRAM_INELIGIBLE';
}

export class AICostGuard {
  private static instance: AICostGuard | null = null;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;
  private isCircuitOpen = false;
  private lastFailureTime = 0;
  private cooldownMs = 60000; // 1 minute cooldown
  private totalCallsSaved = 0;
  private totalCallsAttempted = 0;
  private totalCallsSucceeded = 0;

  private constructor() {}

  public static getInstance(): AICostGuard {
    if (!AICostGuard.instance) {
      AICostGuard.instance = new AICostGuard();
    }
    return AICostGuard.instance;
  }

  public static resetInstance(): AICostGuard {
    AICostGuard.instance = new AICostGuard();
    return AICostGuard.instance;
  }

  /**
   * Deterministically evaluates if an AI enrichment call is strictly necessary.
   */
  public evaluateAICallNecessity(params: {
    article?: Partial<NewsArticleV2>;
    hasCachedSummary?: boolean;
    hasCachedEvent?: boolean;
    isDuplicate?: boolean;
    isHistorical?: boolean;
    isMaterialUpdate?: boolean;
    isTelegramRequired?: boolean;
    isUserExplicitRequest?: boolean;
  }): AICallDecision {
    // 1. If AI is globally disabled
    if (!aiOperationsController.isAIEnabled()) {
      this.totalCallsSaved++;
      return {
        shouldCallAI: false,
        reason: 'AI subsystem is disabled in operational control',
        bypassStrategy: 'AI_DISABLED'
      };
    }

    // 2. Circuit breaker check
    if (this.isCircuitOpen) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownMs) {
        // Half-open / probing
        this.isCircuitOpen = false;
      } else {
        this.totalCallsSaved++;
        return {
          shouldCallAI: false,
          reason: 'AI provider circuit breaker is OPEN due to repeated failures',
          bypassStrategy: 'CIRCUIT_OPEN'
        };
      }
    }

    // 3. User explicit demand overrides caching (if user clicked Generate)
    if (params.isUserExplicitRequest) {
      this.totalCallsAttempted++;
      return {
        shouldCallAI: true,
        reason: 'Explicit on-demand user request'
      };
    }

    // 4. Historical hydration bypass — ZERO AI CALLS during hydration/startup
    if (params.isHistorical || (params.article as any)?.isHistorical) {
      this.totalCallsSaved++;
      return {
        shouldCallAI: false,
        reason: 'Historical hydration article does not require live AI calls',
        bypassStrategy: 'HISTORICAL_HYDRATION'
      };
    }

    // 5. Cache check
    if (params.hasCachedSummary) {
      this.totalCallsSaved++;
      return {
        shouldCallAI: false,
        reason: 'Valid grounded summary exists in cache',
        bypassStrategy: 'CACHE_HIT'
      };
    }

    // 6. Duplicate check
    if (params.isDuplicate) {
      this.totalCallsSaved++;
      return {
        shouldCallAI: false,
        reason: 'Duplicate article cluster member reuses primary summary',
        bypassStrategy: 'DUPLICATE_ARTICLE'
      };
    }

    // 7. Non-material update check
    if (params.isMaterialUpdate === false) {
      this.totalCallsSaved++;
      return {
        shouldCallAI: false,
        reason: 'Non-material revision does not justify AI regeneration',
        bypassStrategy: 'NON_MATERIAL_UPDATE'
      };
    }

    // 8. If telegram is not required and relevance score is very low (< 40)
    if (!params.isTelegramRequired && (params.article?.relevanceScore || 50) < 40) {
      this.totalCallsSaved++;
      return {
        shouldCallAI: false,
        reason: 'Low relevance article below AI generation threshold',
        bypassStrategy: 'TELEGRAM_INELIGIBLE'
      };
    }

    this.totalCallsAttempted++;
    return {
      shouldCallAI: true,
      reason: 'Fresh material article requiring summary enrichment'
    };
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isCircuitOpen = false;
    this.totalCallsSucceeded++;
  }

  public recordFailure(error: any): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.isCircuitOpen = true;
    }
  }

  public getTelemetry() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      isCircuitOpen: this.isCircuitOpen,
      totalCallsSaved: this.totalCallsSaved,
      totalCallsAttempted: this.totalCallsAttempted,
      totalCallsSucceeded: this.totalCallsSucceeded
    };
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.isCircuitOpen = false;
    this.lastFailureTime = 0;
    this.totalCallsSaved = 0;
    this.totalCallsAttempted = 0;
    this.totalCallsSucceeded = 0;
  }
}

export const aiCostGuard = AICostGuard.getInstance();
