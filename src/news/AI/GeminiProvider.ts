import { GoogleGenAI } from '@google/genai';
import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';

export class GeminiProvider implements IAIProvider {
  public readonly providerName: ProviderType = 'gemini';
  private readonly TIMEOUT_MS = 35000; // 35s timeout
  private healthMonitor = AIHealthMonitor.getInstance();
  private costTracker = CostTracker.getInstance();

  public getModelName(): string {
    const model = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash';
    if (model === 'gemini-3.6-flash') {
      return 'gemini-3.7-flash';
    }
    return model;
  }

  public isHealthy(): boolean {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GEMINI_API_KEY') || apiKey === 'undefined' || apiKey === 'null' || apiKey.trim() === '') {
      return false;
    }
    return this.healthMonitor.isProviderHealthy('gemini');
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GEMINI_API_KEY') || apiKey === 'undefined' || apiKey === 'null' || apiKey.trim() === '') {
      this.healthMonitor.recordFailure('gemini', 'GEMINI_API_KEY missing or placeholder');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const primaryModel = this.getModelName();
    const candidateModels = Array.from(new Set([primaryModel, 'gemini-3.7-flash', 'gemini-3.1-flash-lite']));
    const maxRetries = 1;
    let attempt = 0;
    let lastError: any = null;

    if (options.streamingCallback) {
      options.streamingCallback('thinking', 'Failing over to Gemini Fallback Engine...');
    }

    while (attempt <= maxRetries) {
      const modelToUse = candidateModels[attempt % candidateModels.length];
      const startTime = Date.now();
      try {
        if (options.streamingCallback) {
          options.streamingCallback('generating', `Gemini is composing response using ${modelToUse}...`);
        }

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Gemini API timeout after ${this.TIMEOUT_MS / 1000}s`)), this.TIMEOUT_MS);
        });

        const fullPrompt = `${options.systemPrompt || ''}\n\n${options.prompt}`;

        console.log(`[GeminiProvider] Attempting generateContent with model: ${modelToUse} (attempt ${attempt + 1}/${maxRetries + 1})`);

        const apiPromise = ai.models.generateContent({
          model: modelToUse,
          contents: fullPrompt,
          config: {
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 1024,
            ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {})
          }
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;

        const text = response?.text?.trim();
        if (!text || text.length < 10) {
          throw new Error('Empty text content received from Gemini API');
        }

        const promptTokens = Math.ceil(fullPrompt.length / 4);
        const completionTokens = Math.ceil(text.length / 4);
        const totalTokens = promptTokens + completionTokens;

        const costEstimate = this.costTracker.trackUsage('gemini', promptTokens, completionTokens, latencyMs);
        this.healthMonitor.recordSuccess('gemini', latencyMs, totalTokens);

        if (options.streamingCallback) {
          options.streamingCallback('final', text);
        }

        return {
          text,
          provider: 'gemini',
          confidence: 90,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          costEstimate,
          fallbackUsed: true
        };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);

        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          console.warn(`[GeminiProvider] Quota/rate limit exceeded on model ${modelToUse} (attempt ${attempt + 1}/${candidateModels.length})`);
          attempt++;
          if (attempt <= maxRetries) {
            console.log(`[GeminiProvider] Attempting alternative fallback model: ${candidateModels[attempt % candidateModels.length]}`);
            continue;
          }
          this.healthMonitor.recordQuotaExceeded('gemini');
          break;
        }

        if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('timeout')) {
          console.warn(`[GeminiProvider] Transient error on attempt ${attempt + 1}: ${msg}`);
          this.healthMonitor.recordFailure('gemini', msg);
          attempt++;
          if (attempt <= maxRetries) {
            continue;
          }
          break;
        }

        this.healthMonitor.recordFailure('gemini', msg);
        attempt++;
      }
    }

    let errorMessage = lastError?.message || 'Gemini request failed';
    if (typeof errorMessage === 'string' && (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota'))) {
      errorMessage = 'Gemini API Rate Limit / Quota Exceeded (429 RESOURCE_EXHAUSTED)';
    }
    throw new Error(`GeminiProvider Error: ${errorMessage}`);
  }
}
