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

  public recordFailure(provider: ProviderType, errorReason?: string): void {
    const key = this.normalizeProvider(provider);
    const p = this.healthState[key];
    if (!p) return;

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

  public getHealthSummary() {
    return {
      groq: { ...this.healthState.groq },
      gemini: { ...this.healthState.gemini },
      local: { ...this.healthState.local },
      // Backward compatibility mirror
      grok: { ...this.healthState.groq }
    };
  }
}
