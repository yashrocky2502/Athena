import { AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { GrokProvider } from './GrokProvider';
import { GeminiProvider } from './GeminiProvider';
import { LocalProvider } from './LocalProvider';
import { PromptBuilder, PromptBuildInput } from './PromptBuilder';
import { ConfidenceEngine } from './ConfidenceEngine';
import { CostTracker } from './CostTracker';
import { CacheManager, NewsCacheCategory } from './CacheManager';
import { AIHealthMonitor } from './AIHealthMonitor';

export interface RouterRequestInput extends PromptBuildInput {
  url?: string;
  publisher?: string;
  category?: string;
  forceRefresh?: boolean;
  streamingCallback?: (stage: 'thinking' | 'generating' | 'final', token: string) => void;
}

export class AIRouter {
  private static instance: AIRouter;

  private grokProvider = new GrokProvider();
  private geminiProvider = new GeminiProvider();
  private localProvider = new LocalProvider();

  private cacheManager = CacheManager.getInstance();
  private costTracker = CostTracker.getInstance();
  private healthMonitor = AIHealthMonitor.getInstance();

  private constructor() {}

  public static getInstance(): AIRouter {
    if (!AIRouter.instance) {
      AIRouter.instance = new AIRouter();
    }
    return AIRouter.instance;
  }

  public async generateSummary(input: RouterRequestInput): Promise<AIResponse> {
    const builtPrompt = PromptBuilder.build({
      category: input.category,
      headline: input.headline,
      body: input.body,
      facts: input.facts,
      issuer: input.issuer,
      filingType: input.filingType
    });

    const categoryMap: Record<string, NewsCacheCategory> = {
      'Corporate Filing': 'Corporate Filing',
      'Macro': 'Macro Reports',
      'Markets': 'Market News',
      'Breaking News': 'Breaking News'
    };
    const cacheCategory: NewsCacheCategory = categoryMap[builtPrompt.category] || 'Market News';

    // 1. Check Cache
    const cacheKey = this.cacheManager.generateKey({
      url: input.url,
      title: input.headline,
      publisher: input.publisher,
      articleHash: input.body ? String(input.body.length) : undefined,
      promptVersion: 'v5',
      modelVersion: 'v1'
    });

    if (!input.forceRefresh) {
      const cached = this.cacheManager.get(cacheKey);
      if (cached) {
        if (input.streamingCallback) {
          input.streamingCallback('final', cached.text);
        }
        return cached;
      }
    }

    const requestOptions: AIRequestOptions = {
      prompt: builtPrompt.userPrompt,
      systemPrompt: builtPrompt.systemPrompt,
      domainType: builtPrompt.category,
      headline: input.headline,
      url: input.url,
      publisher: input.publisher,
      facts: typeof input.facts === 'object' ? input.facts : undefined,
      streamingCallback: input.streamingCallback
    };

    let response: AIResponse | null = null;
    let fallbackUsed = false;

    // 2. Try Primary: Grok
    if (this.grokProvider.isHealthy()) {
      try {
        console.log('[AI Router] Dispatching request to Primary Provider: Grok');
        const grokResp = await this.grokProvider.generate(requestOptions);
        const evalResult = ConfidenceEngine.evaluate(grokResp.text, requestOptions.facts, input.body);

        if (evalResult.passed) {
          response = {
            ...grokResp,
            confidence: evalResult.score
          };
        } else {
          console.warn(`[AI Router] Grok confidence score low (${evalResult.score}/100): ${evalResult.issues.join('; ')}. Failing over to Gemini.`);
          fallbackUsed = true;
        }
      } catch (err: any) {
        console.warn(`[AI Router] Grok Provider failed: ${err.message}. Failing over to Gemini.`);
        fallbackUsed = true;
      }
    } else {
      console.log('[AI Router] Grok Provider unhealthy or unconfigured. Failing over to Gemini.');
      fallbackUsed = true;
    }

    // 3. Try Backup: Gemini
    if (!response && this.geminiProvider.isHealthy()) {
      try {
        console.log('[AI Router] Dispatching request to Backup Provider: Gemini');
        const geminiResp = await this.geminiProvider.generate(requestOptions);
        const evalResult = ConfidenceEngine.evaluate(geminiResp.text, requestOptions.facts, input.body);

        if (evalResult.passed) {
          response = {
            ...geminiResp,
            confidence: evalResult.score,
            fallbackUsed: true
          };
        } else {
          console.warn(`[AI Router] Gemini confidence score low (${evalResult.score}/100): ${evalResult.issues.join('; ')}. Failing over to Athena Local Engine.`);
        }
      } catch (err: any) {
        console.warn(`[AI Router] Gemini Provider failed: ${err.message}. Failing over to Athena Local Engine.`);
      }
    }

    // 4. Final Fallback: Local Engine (ALWAYS SUCCEEDS)
    if (!response) {
      console.log('[AI Router] Dispatching request to Final Fallback: Athena Local Intelligence Engine');
      const localResp = await this.localProvider.generate(requestOptions);
      response = {
        ...localResp,
        fallbackUsed: true
      };
    }

    // Store in Cache
    this.cacheManager.set(cacheKey, response, cacheCategory);

    return response;
  }

  /**
   * Observability metrics endpoint handler for /api/ai/status
   */
  public getStatus() {
    const health = this.healthMonitor.getHealthSummary();
    const costs = this.costTracker.getSummary();
    const cache = this.cacheManager.getStats();

    const currentProvider: ProviderType = this.grokProvider.isHealthy()
      ? 'grok'
      : (this.geminiProvider.isHealthy() ? 'gemini' : 'local');

    const fallbackProvider: ProviderType = currentProvider === 'grok'
      ? (this.geminiProvider.isHealthy() ? 'gemini' : 'local')
      : 'local';

    const totalRequests = costs.totalRequests || 1;
    const fallbackCount = (costs.providerBreakdown.gemini?.requests || 0) + (costs.providerBreakdown.local?.requests || 0);
    const fallbackPercentage = Math.round((fallbackCount / totalRequests) * 100);

    return {
      timestamp: new Date().toISOString(),
      router: {
        currentProvider,
        fallbackProvider,
        totalRequests: costs.totalRequests,
        averageResponseTimeMs: costs.averageLatencyMs,
        cacheHitPercentage: cache.hitRatioPercentage,
        fallbackPercentage,
        totalEstimatedCostUSD: costs.totalEstimatedCostUSD
      },
      providers: health,
      cache,
      costTracker: costs
    };
  }
}
