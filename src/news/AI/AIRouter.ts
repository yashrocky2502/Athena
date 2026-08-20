import { AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { GroqProvider } from './GroqProvider';
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

  public groqProvider = new GroqProvider();
  public geminiProvider = new GeminiProvider();
  public localProvider = new LocalProvider();

  // Backward compatibility accessor for legacy tests/references
  public get grokProvider(): GroqProvider {
    return this.groqProvider;
  }
  public set grokProvider(provider: GroqProvider) {
    this.groqProvider = provider;
  }

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

    // 2. Try Primary: Groq (Llama 3.3 70B / Llama 3.1 8B)
    if (this.groqProvider.isHealthy()) {
      try {
        console.log('[AI Router] Dispatching request to Primary Provider: Groq');
        const groqResp = await this.groqProvider.generate(requestOptions);
        const evalResult = ConfidenceEngine.evaluate(groqResp.text, requestOptions.facts, input.body);

        if (evalResult.passed) {
          response = {
            ...groqResp,
            confidence: evalResult.score
          };
        } else {
          console.warn(`[AI Router] Groq confidence score low (${evalResult.score}/100): ${evalResult.issues.join('; ')}. Failing over to Gemini Flash.`);
          fallbackUsed = true;
        }
      } catch (err: any) {
        console.warn(`[AI Router] Groq Provider failed: ${err.message}. Failing over to Gemini Flash.`);
        fallbackUsed = true;
      }
    } else {
      console.log('[AI Router] Groq Provider unhealthy or unconfigured. Failing over to Gemini Flash.');
      fallbackUsed = true;
    }

    // 3. Try Emergency Fallback: Gemini Flash
    if (!response && this.geminiProvider.isHealthy()) {
      try {
        console.log('[AI Router] Dispatching request to Emergency Fallback Provider: Gemini Flash');
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

    // 4. Final Deterministic Fallback: Athena Local Intelligence Engine (ALWAYS SUCCEEDS)
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
   * Direct compatible router generation path.
   */
  public async generateWithRouter(options: AIRequestOptions): Promise<AIResponse> {
    let response: AIResponse | null = null;
    
    // Check Cache
    const cacheKey = this.cacheManager.generateKey({
      url: options.url,
      title: options.headline || options.prompt.slice(0, 50),
      publisher: options.publisher,
      articleHash: options.prompt ? String(options.prompt.length) : undefined,
      promptVersion: 'v5_direct',
      modelVersion: 'v1_direct'
    });
    
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      if (options.streamingCallback) {
        options.streamingCallback('final', cached.text);
      }
      return cached;
    }

    if (this.groqProvider.isHealthy()) {
      try {
        response = await this.groqProvider.generate(options);
      } catch (err) {
        console.warn(`[AIRouter] direct groq failed: ${err}`);
      }
    }
    
    if (!response && this.geminiProvider.isHealthy()) {
      try {
        response = await this.geminiProvider.generate(options);
      } catch (err) {
        console.warn(`[AIRouter] direct gemini failed: ${err}`);
      }
    }
    
    if (!response) {
      response = await this.localProvider.generate(options);
    }
    
    this.cacheManager.set(cacheKey, response, 'Market News');
    return response;
  }

  /**
   * Observability metrics endpoint handler for /api/ai/status
   */
  public getStatus() {
    const health = this.healthMonitor.getHealthSummary();
    const costs = this.costTracker.getSummary();
    const cache = this.cacheManager.getStats();

    const currentProvider: ProviderType = this.groqProvider.isHealthy()
      ? 'groq'
      : (this.geminiProvider.isHealthy() ? 'gemini' : 'local');

    const fallbackProvider: ProviderType = currentProvider === 'groq'
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
