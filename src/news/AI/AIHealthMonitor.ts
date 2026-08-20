import { ProviderType } from './AIProvider';

export type HealthStatus = 'Healthy' | 'Degraded' | 'Unhealthy';

export interface ProviderHealth {
  provider: ProviderType;
  status: HealthStatus;
  averageLatencyMs: number;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  successRatePercentage: number;
  totalTokens: number;
  consecutiveFailures: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
}

export class AIHealthMonitor {
  private static instance: AIHealthMonitor;

  private poisonedModels = new Set<string>();

  private healthState: Record<string, ProviderHealth> = {
    groq: {
      provider: 'groq',
      status: 'Healthy',
      averageLatencyMs: 0,
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      successRatePercentage: 100,
      totalTokens: 0,
      consecutiveFailures: 0
    },
    gemini: {
      provider: 'gemini',
      status: 'Healthy',
      averageLatencyMs: 0,
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      successRatePercentage: 100,
      totalTokens: 0,
      consecutiveFailures: 0
    },
    local: {
      provider: 'local',
      status: 'Healthy',
      averageLatencyMs: 0,
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      successRatePercentage: 100,
      totalTokens: 0,
      consecutiveFailures: 0
    }
  };

  private constructor() {}

  public static getInstance(): AIHealthMonitor {
    if (!AIHealthMonitor.instance) {
      AIHealthMonitor.instance = new AIHealthMonitor();
    }
    return AIHealthMonitor.instance;
  }

  private normalizeProvider(provider: ProviderType | string): string {
    return provider === 'grok' ? 'groq' : provider;
  }

  public recordSuccess(provider: ProviderType, latencyMs: number, tokens: number): void {
    const key = this.normalizeProvider(provider);
    const p = this.healthState[key];
    if (!p) return;

    p.totalCalls++;
    p.successCount++;
    p.consecutiveFailures = 0;
    p.lastSuccessTime = new Date().toISOString();
    p.totalTokens += tokens;

    // Moving average for latency
    p.averageLatencyMs = p.totalCalls === 1 ? latencyMs : Math.round(p.averageLatencyMs * 0.8 + latencyMs * 0.2);
    p.successRatePercentage = Math.round((p.successCount / p.totalCalls) * 1000) / 10;

    // Status evaluation
    if (p.successRatePercentage >= 90) {
      p.status = 'Healthy';
    } else if (p.successRatePercentage >= 70) {
      p.status = 'Degraded';
    } else {
      p.status = 'Unhealthy';
    }
  }

  public recordFailure(provider: ProviderType, errorReason?: string, codeOrStatus?: string | number): void {
    const key = this.normalizeProvider(provider);
    const p = this.healthState[key];
    if (!p) return;

    const reason = String(errorReason || '').toUpperCase();
    const statusStr = String(codeOrStatus || '');

    // 1. Credential/Access Failure (401/403/AUTH_FAILED)
    const isAuthError =
      statusStr === '401' ||
      statusStr === '403' ||
      reason.includes('AUTH_FAILED') ||
      reason.includes('UNAUTHORIZED') ||
      reason.includes('FORBIDDEN') ||
      reason.includes('AUTHENTICATION') ||
      reason.includes('API KEY');

    if (isAuthError) {
      p.totalCalls++;
      p.errorCount++;
      p.consecutiveFailures = 10; // Instantly toxic
      p.status = 'Unhealthy';
      p.lastFailureTime = new Date().toISOString();
      return;
    }

    // 2. Model Configuration Failure (404/NOT_FOUND/decommissioned/model unavailable)
    const isModelError =
      statusStr === '404' ||
      reason.includes('NOT_FOUND') ||
      reason.includes('DECOMMISSIONED') ||
      reason.includes('MODEL') ||
      reason.includes('NOT EXIST') ||
      reason.includes('UNAVAILABLE');

    if (isModelError) {
      // Do NOT record a full provider failure if other model candidates could still work.
      // Simply log, let the provider handle poisoning.
      p.totalCalls++;
      p.errorCount++;
      p.lastFailureTime = new Date().toISOString();
      return;
    }

    // 3. Regular error
    p.totalCalls++;
    p.errorCount++;
    p.consecutiveFailures++;
    p.lastFailureTime = new Date().toISOString();

    p.successRatePercentage = Math.round((p.successCount / p.totalCalls) * 1000) / 10;

    if (p.consecutiveFailures >= 3 || p.successRatePercentage < 60) {
      p.status = 'Unhealthy';
    } else {
      p.status = 'Degraded';
    }
  }

  public recordQuotaExceeded(provider: ProviderType): void {
    const key = this.normalizeProvider(provider);
    const p = this.healthState[key];
    if (!p) return;
    p.totalCalls++;
    p.errorCount++;
    p.consecutiveFailures = 5;
    p.status = 'Unhealthy';
    p.lastFailureTime = new Date().toISOString();
  }

  public isProviderHealthy(provider: ProviderType): boolean {
    if (provider === 'local') return true; // Local is always available
    const key = this.normalizeProvider(provider);
    const p = this.healthState[key];
    if (!p) return false;

    // Auto-recover after 3 minutes if it was marked unhealthy due to temporary rate limits
    if (p.status === 'Unhealthy' && p.lastFailureTime) {
      const elapsedMs = Date.now() - new Date(p.lastFailureTime).getTime();
      if (elapsedMs > 3 * 60 * 1000) {
        p.status = 'Degraded';
        p.consecutiveFailures = 0;
      }
    }

    return p.status !== 'Unhealthy' && p.consecutiveFailures < 4;
  }

  public recordPoisonedModel(model: string): void {
    if (model) {
      this.poisonedModels.add(model);
    }
  }

  public isModelPoisoned(model: string): boolean {
    if (!model) return false;
    return this.poisonedModels.has(model);
  }

  public clearPoisonedModels(): void {
    this.poisonedModels.clear();
  }

  public getHealthSummary() {
    return {
      groq: { ...this.healthState.groq },
      gemini: { ...this.healthState.gemini },
      local: { ...this.healthState.local },
      // Backward compatibility mirror
      grok: { ...this.healthState.groq }
    };
  }

  public reset(): void {
    this.poisonedModels.clear();
    for (const key of Object.keys(this.healthState)) {
      const p = this.healthState[key];
      p.status = 'Healthy';
      p.totalCalls = 0;
      p.successCount = 0;
      p.errorCount = 0;
      p.successRatePercentage = 100;
      p.totalTokens = 0;
      p.consecutiveFailures = 0;
      delete p.lastFailureTime;
      delete p.lastSuccessTime;
    }
  }
}
