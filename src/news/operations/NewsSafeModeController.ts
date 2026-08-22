/**
 * ATHENA NEWS ENGINE — STAGE 8.9 SAFE MODE CONTROLLER
 * NewsSafeModeController
 * 
 * Manages emergency degraded operations mode for the news platform.
 * 
 * Key Principles:
 * - SAFE_MODE isolates external instability (AI outages, upstream provider timeouts, rate limits).
 * - Canonical historical news storage and V4 feed remain 100% readable and accessible.
 * - Basic ingestion and integrity monitoring continue without destructive pruning.
 * - Reversible at runtime without requiring an application restart.
 */

import { NewsRuntimeConfig } from './NewsRuntimeConfig';
import { TelegramOperationsController } from './TelegramOperationsController';
import { AIOperationsController } from './AIOperationsController';

export interface SafeModeStatus {
  isSafeMode: boolean;
  activatedAt?: string;
  reason?: string;
  canonicalStorageActive: boolean;
  v4FeedActive: boolean;
  aiEnrichmentDisabled: boolean;
  telegramPaused: boolean;
  forexFactoryDisabled: boolean;
  optionalSourcesDisabled: boolean;
}

export class NewsSafeModeController {
  private static instance: NewsSafeModeController | null = null;
  private isSafeModeActive = false;
  private activatedAt?: string;
  private activationReason?: string;

  private constructor() {
    this.syncWithRuntimeConfig();
  }

  public static getInstance(): NewsSafeModeController {
    if (!NewsSafeModeController.instance) {
      NewsSafeModeController.instance = new NewsSafeModeController();
    }
    return NewsSafeModeController.instance;
  }

  public static resetInstance(): NewsSafeModeController {
    NewsSafeModeController.instance = new NewsSafeModeController();
    return NewsSafeModeController.instance;
  }

  private syncWithRuntimeConfig(): void {
    const config = NewsRuntimeConfig.getInstance();
    if (config.isSafeMode()) {
      this.isSafeModeActive = true;
      this.activatedAt = new Date().toISOString();
      this.activationReason = 'Hydrated from SAFE_MODE runtime config';
    }
  }

  /**
   * Activates SAFE_MODE. Safely suspends optional enrichment layers while preserving canonical feeds.
   */
  public enableSafeMode(reason = 'Operator initiated safe mode'): void {
    this.isSafeModeActive = true;
    this.activatedAt = new Date().toISOString();
    this.activationReason = reason;

    // Apply safe mode across controllers
    NewsRuntimeConfig.getInstance().setSafeMode(true);
    TelegramOperationsController.getInstance().pause('Paused due to Safe Mode activation');
    AIOperationsController.getInstance().disableAI();
  }

  /**
   * Deactivates SAFE_MODE and restores normal operational pipelines.
   */
  public disableSafeMode(): void {
    this.isSafeModeActive = false;
    this.activatedAt = undefined;
    this.activationReason = undefined;

    NewsRuntimeConfig.getInstance().setSafeMode(false);
    TelegramOperationsController.getInstance().resume();
    AIOperationsController.getInstance().enableAI();
  }

  public isSafeMode(): boolean {
    return this.isSafeModeActive;
  }

  public getStatus(): SafeModeStatus {
    return {
      isSafeMode: this.isSafeModeActive,
      activatedAt: this.activatedAt,
      reason: this.activationReason,
      canonicalStorageActive: true, // Always true
      v4FeedActive: true,           // Always true
      aiEnrichmentDisabled: !AIOperationsController.getInstance().isAIEnabled(),
      telegramPaused: TelegramOperationsController.getInstance().isPaused(),
      forexFactoryDisabled: !NewsRuntimeConfig.getInstance().isForexFactoryEnabled(),
      optionalSourcesDisabled: this.isSafeModeActive
    };
  }
}

export const newsSafeModeController = NewsSafeModeController.getInstance();
