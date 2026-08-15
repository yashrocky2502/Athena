/**
 * ATHENA NEWS ENGINE V3 — CONFIGURATION MANAGER
 * 
 * Centralized configuration loader for timeouts, retries, feature flags,
 * collector limits, and system parameters.
 */

export interface V3CollectorConfig {
  enabled: boolean;
  pollIntervalMs: number;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMin: number;
}

export interface V3PipelineFeatureFlags {
  enableAIIntelligence: boolean;
  enableQualityGate: boolean;
  enableTelegramNotifications: boolean;
  enableDeduplication: boolean;
  enableStoragePersistence: boolean;
  enableStrictMetricValidation: boolean;
}

export interface V3SystemConfig {
  environment: 'development' | 'staging' | 'production' | 'test';
  version: string;
  maxWorkerConcurrency: number;
  cacheTtlSeconds: number;
  telemetryWindowMs: number;
  collectors: Record<string, V3CollectorConfig>;
  featureFlags: V3PipelineFeatureFlags;
  apiKeys: {
    geminiApiKey?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
  };
}

export class V3ConfigManager {
  private static instance: V3ConfigManager;
  private config: V3SystemConfig;

  private constructor() {
    this.config = this.loadDefaultConfig();
  }

  public static getInstance(): V3ConfigManager {
    if (!V3ConfigManager.instance) {
      V3ConfigManager.instance = new V3ConfigManager();
    }
    return V3ConfigManager.instance;
  }

  private loadDefaultConfig(): V3SystemConfig {
    const env = (process.env.NODE_ENV as V3SystemConfig['environment']) || 'development';

    return {
      environment: env,
      version: '3.0.0-FOUNDATION',
      maxWorkerConcurrency: parseInt(process.env.V3_MAX_CONCURRENCY || '10', 10),
      cacheTtlSeconds: parseInt(process.env.V3_CACHE_TTL_SEC || '3600', 10),
      telemetryWindowMs: 60000, // 1 minute window
      collectors: {
        ECONOMIC_TIMES: { enabled: true, pollIntervalMs: 30000, timeoutMs: 8000, maxRetries: 3, rateLimitPerMin: 60 },
        MONEYCONTROL: { enabled: true, pollIntervalMs: 30000, timeoutMs: 8000, maxRetries: 3, rateLimitPerMin: 60 },
        REUTERS: { enabled: true, pollIntervalMs: 45000, timeoutMs: 10000, maxRetries: 3, rateLimitPerMin: 40 },
        LIVEMINT: { enabled: true, pollIntervalMs: 30000, timeoutMs: 8000, maxRetries: 3, rateLimitPerMin: 60 },
        BUSINESS_STANDARD: { enabled: true, pollIntervalMs: 45000, timeoutMs: 8000, maxRetries: 3, rateLimitPerMin: 40 },
        CNBC_TV18: { enabled: true, pollIntervalMs: 30000, timeoutMs: 8000, maxRetries: 3, rateLimitPerMin: 60 },
        NSE: { enabled: true, pollIntervalMs: 15000, timeoutMs: 5000, maxRetries: 5, rateLimitPerMin: 120 },
        BSE: { enabled: true, pollIntervalMs: 15000, timeoutMs: 5000, maxRetries: 5, rateLimitPerMin: 120 },
        SEBI: { enabled: true, pollIntervalMs: 60000, timeoutMs: 10000, maxRetries: 3, rateLimitPerMin: 30 },
        RBI: { enabled: true, pollIntervalMs: 60000, timeoutMs: 10000, maxRetries: 3, rateLimitPerMin: 30 },
        PIB: { enabled: true, pollIntervalMs: 60000, timeoutMs: 10000, maxRetries: 3, rateLimitPerMin: 30 },
        INVESTOR_RELATIONS: { enabled: true, pollIntervalMs: 120000, timeoutMs: 15000, maxRetries: 2, rateLimitPerMin: 20 },
        GOOGLE_NEWS_RSS: { enabled: true, pollIntervalMs: 30000, timeoutMs: 8000, maxRetries: 3, rateLimitPerMin: 60 }
      },
      featureFlags: {
        enableAIIntelligence: true,
        enableQualityGate: true,
        enableTelegramNotifications: true,
        enableDeduplication: true,
        enableStoragePersistence: true,
        enableStrictMetricValidation: true
      },
      apiKeys: {
        geminiApiKey: process.env.GEMINI_API_KEY,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: process.env.TELEGRAM_CHAT_ID
      }
    };
  }

  public getConfig(): V3SystemConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<V3SystemConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      featureFlags: {
        ...this.config.featureFlags,
        ...(updates.featureFlags || {})
      },
      apiKeys: {
        ...this.config.apiKeys,
        ...(updates.apiKeys || {})
      }
    };
  }

  public getCollectorConfig(collectorName: string): V3CollectorConfig | undefined {
    return this.config.collectors[collectorName];
  }

  public isFeatureEnabled(flagName: keyof V3PipelineFeatureFlags): boolean {
    return !!this.config.featureFlags[flagName];
  }
}
