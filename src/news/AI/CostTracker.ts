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
  providerBreakdown: Record<string, {
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
  private readonly PRICING: Record<string, { prompt: number; completion: number }> = {
    groq: { prompt: 0.00059, completion: 0.00079 },   // Groq Llama-3.3-70b-versatile
    grok: { prompt: 0.00059, completion: 0.00079 },   // Backward compat
    gemini: { prompt: 0.000075, completion: 0.0003 }, // Gemini 3.6 Flash
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

    return Math.round(costEstimateUSD * 100000) / 100000;
  }

  public getSummary(): CostSummary {
    const totalRequests = this.records.length;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalEstimatedCostUSD = 0;
    let totalLatencyMs = 0;

    const breakdown: Record<string, { requests: number; tokens: number; costUSD: number; totalLatencyMs: number }> = {
      groq: { requests: 0, tokens: 0, costUSD: 0, totalLatencyMs: 0 },
      gemini: { requests: 0, tokens: 0, costUSD: 0, totalLatencyMs: 0 },
      local: { requests: 0, tokens: 0, costUSD: 0, totalLatencyMs: 0 }
    };

    for (const rec of this.records) {
      totalPromptTokens += rec.promptTokens;
      totalCompletionTokens += rec.completionTokens;
      totalTokens += rec.totalTokens;
      totalEstimatedCostUSD += rec.costEstimateUSD;
      totalLatencyMs += rec.latencyMs;

      const normProvider = rec.provider === 'grok' ? 'groq' : rec.provider;
      if (!breakdown[normProvider]) {
        breakdown[normProvider] = { requests: 0, tokens: 0, costUSD: 0, totalLatencyMs: 0 };
      }

      breakdown[normProvider].requests++;
      breakdown[normProvider].tokens += rec.totalTokens;
      breakdown[normProvider].costUSD += rec.costEstimateUSD;
      breakdown[normProvider].totalLatencyMs += rec.latencyMs;
    }

    const providerBreakdown: Record<string, { requests: number; tokens: number; costUSD: number; avgLatencyMs: number }> = {};
    for (const key of ['groq', 'gemini', 'local']) {
      const item = breakdown[key] || { requests: 0, tokens: 0, costUSD: 0, totalLatencyMs: 0 };
      providerBreakdown[key] = {
        requests: item.requests,
        tokens: item.tokens,
        costUSD: Math.round(item.costUSD * 10000) / 10000,
        avgLatencyMs: item.requests > 0 ? Math.round(item.totalLatencyMs / item.requests) : 0
      };
    }
    // Backward compat alias
    providerBreakdown.grok = providerBreakdown.groq;

    return {
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalEstimatedCostUSD: Math.round(totalEstimatedCostUSD * 10000) / 10000,
      averageLatencyMs: totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0,
      providerBreakdown
    };
  }

  public clear(): void {
    this.records = [];
  }
}
