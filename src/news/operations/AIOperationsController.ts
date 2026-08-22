/**
 * ATHENA NEWS ENGINE — STAGE 8.9 AI OPERATIONS CONTROLLER & COST GUARD
 * AIOperationsController
 * 
 * Centralized governance, telemetry, and cost guarding for AI summaries and enrichments.
 * 
 * Safety & Cost Rules:
 * - When AI is disabled, zero external AI requests are triggered; deterministic fallback summaries are served.
 * - Tracks granular usage across providers (Groq, Gemini), cache hits, timeouts, and avoided redundant calls.
 * - AI failures are isolated and never destroy or hide canonical articles.
 */

import { NewsRuntimeConfig } from './NewsRuntimeConfig';

export interface AIUsageTelemetry {
  totalCalls: number;
  geminiCalls: number;
  groqCalls: number;
  successfulCalls: number;
  failedCalls: number;
  timeoutCalls: number;
  cachedSummaries: number;
  avoidedCalls: number;
  duplicateCallsPrevented: number;
  aiCallsAvoided: number;
  aiCallsMade: number;
  cacheHitRate: number; // percentage 0-100
}

export interface AIOperationsStatus {
  enabled: boolean;
  state: 'ACTIVE' | 'DISABLED' | 'DEGRADED';
  telemetry: AIUsageTelemetry;
  lastCallTimestamp?: string;
  lastError?: string;
}

export class AIOperationsController {
  private static instance: AIOperationsController | null = null;
  private enabled: boolean = true;
  private lastCallTimestamp?: string;
  private lastError?: string;

  // Counters
  private geminiCalls = 0;
  private groqCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private timeoutCalls = 0;
  private cachedSummaries = 0;
  private duplicateCallsPrevented = 0;
  private avoidedCallsCount = 0;

  private constructor() {
    this.syncWithRuntimeConfig();
  }

  public static getInstance(): AIOperationsController {
    if (!AIOperationsController.instance) {
      AIOperationsController.instance = new AIOperationsController();
    }
    return AIOperationsController.instance;
  }

  public static resetInstance(): AIOperationsController {
    AIOperationsController.instance = new AIOperationsController();
    return AIOperationsController.instance;
  }

  private syncWithRuntimeConfig(): void {
    const config = NewsRuntimeConfig.getInstance();
    this.enabled = config.isAIEnrichmentEnabled() && !config.isSafeMode();
  }

  public enableAI(): void {
    this.enabled = true;
    NewsRuntimeConfig.getInstance().setAIEnrichmentEnabled(true);
  }

  public disableAI(): void {
    this.enabled = false;
    NewsRuntimeConfig.getInstance().setAIEnrichmentEnabled(false);
  }

  public isAIEnabled(): boolean {
    const config = NewsRuntimeConfig.getInstance();
    return this.enabled && config.isAIEnrichmentEnabled() && !config.isSafeMode();
  }

  /**
   * Cost Guard: Records an avoided AI call (e.g. duplicate article, low quality, cache hit).
   */
  public recordAvoidedCall(reason?: string): void {
    this.avoidedCallsCount++;
    if (reason === 'DUPLICATE_ARTICLE') {
      this.duplicateCallsPrevented++;
    }
  }

  public recordCacheHit(): void {
    this.cachedSummaries++;
  }

  public recordCallAttempt(provider: 'gemini' | 'groq' | 'local'): void {
    this.lastCallTimestamp = new Date().toISOString();
    if (provider === 'gemini') this.geminiCalls++;
    else if (provider === 'groq') this.groqCalls++;
  }

  public recordCallSuccess(): void {
    this.successfulCalls++;
  }

  public recordCallFailure(error: string, isTimeout = false): void {
    this.failedCalls++;
    this.lastError = error;
    if (isTimeout) {
      this.timeoutCalls++;
    }
  }

  public getUsageTelemetry(): AIUsageTelemetry {
    const aiCallsMade = this.geminiCalls + this.groqCalls;
    const aiCallsAvoided = this.cachedSummaries + this.avoidedCallsCount;
    const totalRequests = aiCallsMade + aiCallsAvoided;
    const cacheHitRate = totalRequests > 0 
      ? Number(((this.cachedSummaries / totalRequests) * 100).toFixed(2)) 
      : 0;

    return {
      totalCalls: aiCallsMade,
      geminiCalls: this.geminiCalls,
      groqCalls: this.groqCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      timeoutCalls: this.timeoutCalls,
      cachedSummaries: this.cachedSummaries,
      avoidedCalls: this.avoidedCallsCount,
      duplicateCallsPrevented: this.duplicateCallsPrevented,
      aiCallsAvoided,
      aiCallsMade,
      cacheHitRate
    };
  }

  public getAIStatus(): AIOperationsStatus {
    const isEnabled = this.isAIEnabled();
    let state: 'ACTIVE' | 'DISABLED' | 'DEGRADED' = isEnabled ? 'ACTIVE' : 'DISABLED';
    if (isEnabled && this.failedCalls > 5 && this.failedCalls > this.successfulCalls) {
      state = 'DEGRADED';
    }

    return {
      enabled: isEnabled,
      state,
      telemetry: this.getUsageTelemetry(),
      lastCallTimestamp: this.lastCallTimestamp,
      lastError: this.lastError
    };
  }

  public resetTelemetry(): void {
    this.geminiCalls = 0;
    this.groqCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.timeoutCalls = 0;
    this.cachedSummaries = 0;
    this.duplicateCallsPrevented = 0;
    this.avoidedCallsCount = 0;
    this.lastError = undefined;
    this.lastCallTimestamp = undefined;
  }
}

export const aiOperationsController = AIOperationsController.getInstance();
