import { ProviderType } from './AIProvider';

export interface TokenUsageRecord {
  provider: ProviderType;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimateUSD: number;
  latencyMs: number;
  timestamp: string;
}

export interface CostSummary {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalEstimatedCostUSD: number;
  averageLatencyMs: number;
  providerBreakdown: Record<ProviderType, {
    requests: number;
    tokens: number;
    costUSD: number;
    avgLatencyMs: number;
  }>;
}

export class CostTracker {
  private static instance: CostTracker;
  private records: TokenUsageRecord[] = [];

  // Estimated pricing per 1k tokens (USD)
  private readonly PRICING: Record<ProviderType, { prompt: number; completion: number }> = {
    grok: { prompt: 0.005, completion: 0.015 },      // Grok-beta
    gemini: { prompt: 0.000075, completion: 0.0003 }, // Gemini 3.7 Flash
    local: { prompt: 0.0, completion: 0.0 }           // Local deterministic
  };

  private constructor() {}

  public static getInstance(): CostTracker {
    if (!CostTracker.instance) {
      CostTracker.instance = new CostTracker();
    }
    return CostTracker.instance;
  }

  public trackUsage(
    provider: ProviderType,
    promptTokens: number,
    completionTokens: number,
    latencyMs: number
  ): number {
    const rates = this.PRICING[provider] || { prompt: 0, completion: 0 };
    const costEstimateUSD = (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
    const totalTokens = promptTokens + completionTokens;

    const record: TokenUsageRecord = {
      provider,
      promptTokens,
      completionTokens,
      totalTokens,
      costEstimateUSD,
      latencyMs,
      timestamp: new Date().toISOString()
    };

    this.records.push(record);
    if (this.records.length > 5000) {
      this.records.shift(); // keep sliding window
    }

    return costEstimateUSD;
  }

  public getSummary(): CostSummary {
    const summary: CostSummary = {
      totalRequests: this.records.length,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalEstimatedCostUSD: 0,
      averageLatencyMs: 0,
      providerBreakdown: {
        grok: { requests: 0, tokens: 0, costUSD: 0, avgLatencyMs: 0 },
        gemini: { requests: 0, tokens: 0, costUSD: 0, avgLatencyMs: 0 },
        local: { requests: 0, tokens: 0, costUSD: 0, avgLatencyMs: 0 }
      }
    };

    let totalLatencySum = 0;

    for (const r of this.records) {
      summary.totalPromptTokens += r.promptTokens;
      summary.totalCompletionTokens += r.completionTokens;
      summary.totalTokens += r.totalTokens;
      summary.totalEstimatedCostUSD += r.costEstimateUSD;
      totalLatencySum += r.latencyMs;

      const p = summary.providerBreakdown[r.provider];
      if (p) {
        p.requests++;
        p.tokens += r.totalTokens;
        p.costUSD += r.costEstimateUSD;
        p.avgLatencyMs += r.latencyMs;
      }
    }

    if (summary.totalRequests > 0) {
      summary.averageLatencyMs = Math.round(totalLatencySum / summary.totalRequests);
    }

    for (const key of ['grok', 'gemini', 'local'] as ProviderType[]) {
      const p = summary.providerBreakdown[key];
      if (p && p.requests > 0) {
        p.avgLatencyMs = Math.round(p.avgLatencyMs / p.requests);
      }
    }

    return summary;
  }
}
