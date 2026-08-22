import { GoogleGenAI } from '@google/genai';
import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';
import { AIModelConfig } from './AIModelConfig';

export class GeminiProvider implements IAIProvider {
  public readonly providerName: ProviderType = 'gemini';
  private readonly TIMEOUT_MS = 8000; // 8s timeout for fast failover
  private healthMonitor = AIHealthMonitor.getInstance();
  private costTracker = CostTracker.getInstance();

  public getApiKey(): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
      return undefined;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GEMINI_API_KEY') || apiKey === 'undefined' || apiKey === 'null' || apiKey.trim() === '') {
      return undefined;
    }
    return apiKey.trim();
  }

  public getModelName(): string {
    const envModel = process.env.GEMINI_MODEL || process.env.GEMINI_FALLBACK_MODEL;
    return (envModel && AIModelConfig.gemini.candidates.includes(envModel))
      ? envModel
      : AIModelConfig.gemini.primary;
  }

  public getPrimaryFallbackModel(): string {
    return this.getModelName();
  }

  public getSecondaryFallbackModel(): string {
    return AIModelConfig.gemini.fallback;
  }

  public isHealthy(): boolean {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return false;
    }
    return this.healthMonitor.isProviderHealthy('gemini');
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.healthMonitor.recordFailure('gemini', 'GEMINI_API_KEY missing or placeholder');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const primaryModel = this.getModelName();
    let candidateModels = Array.from(new Set([
      primaryModel,
      ...AIModelConfig.gemini.candidates
    ]))
      .filter(Boolean)
      .filter(m => !this.healthMonitor.isModelPoisoned(m));

    if (candidateModels.length === 0) {
      candidateModels = [this.getPrimaryFallbackModel() || 'gemini-3.7-flash'];
    }

    const maxRetries = candidateModels.length - 1;
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

        const fullPrompt = options.systemPrompt
          ? `${options.systemPrompt}\n\n${options.prompt}`
          : options.prompt;

        console.log(`[GeminiProvider] Attempting generateContent with model: ${modelToUse} (attempt ${attempt + 1}/${maxRetries + 1})`);

        const apiPromise = ai.models.generateContent({
          model: modelToUse,
          contents: fullPrompt,
          config: {
            systemInstruction: options.systemPrompt ? options.systemPrompt : undefined,
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 2048,
            ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {})
          }
        });

        const response: any = await Promise.race([apiPromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;

        let text = '';
        if (typeof response?.text === 'string') {
          text = response.text.trim();
        }
        if (!text && response?.candidates?.[0]?.content?.parts) {
          text = response.candidates[0].content.parts
            .map((p: any) => p.text || '')
            .filter(Boolean)
            .join('\n')
            .trim();
        }

        if (!text || text.length < 5) {
          const finishReason = response?.candidates?.[0]?.finishReason;
          const finishMsg = finishReason ? ` (finishReason: ${finishReason})` : '';
          throw new Error(`Empty text content received from Gemini API${finishMsg}`);
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

        const isModelErr = msg.includes('404') || msg.includes('not found') || msg.includes('decommissioned') || msg.includes('does not exist') || msg.includes('invalid model');
        if (isModelErr) {
          console.warn(`[GeminiProvider] Model '${modelToUse}' unavailable (${msg}). Recording poisoned model...`);
          this.healthMonitor.recordPoisonedModel(modelToUse);
          this.healthMonitor.recordFailure('gemini', msg, '404');
          attempt++;
          if (attempt <= maxRetries) {
            continue;
          }
          break;
        }

        const isAuthErr = msg.includes('401') || msg.includes('403') || msg.includes('API key') || msg.includes('invalid api key') || msg.includes('invalid key');
        if (isAuthErr) {
          console.warn(`[GeminiProvider] Auth failure: ${msg}`);
          this.healthMonitor.recordFailure('gemini', msg, '401');
          break;
        }

        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('limit')) {
          console.warn(`[GeminiProvider] Quota/rate limit exceeded on model ${modelToUse} (attempt ${attempt + 1}/${candidateModels.length})`);
          this.healthMonitor.recordFailure('gemini', msg, '429');
          attempt++;
          if (attempt <= maxRetries) {
            console.log(`[GeminiProvider] Attempting alternative fallback model: ${candidateModels[attempt % candidateModels.length]}`);
            continue;
          }
          this.healthMonitor.recordQuotaExceeded('gemini');
          break;
        }

        if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('timeout')) {
          let cleanMessage = msg;
          try {
            const parsed = JSON.parse(msg.replace(/^.*?({.*}).*$/, '$1'));
            if (parsed?.error?.message) cleanMessage = parsed.error.message;
          } catch {
            // Keep original msg if not parseable
          }
          console.warn(`[GeminiProvider] Transient/Model error on attempt ${attempt + 1}: ${cleanMessage}`);
          this.healthMonitor.recordFailure('gemini', msg, '503');
          attempt++;
          if (attempt <= maxRetries) {
            // Brief backoff before next candidate attempt
            await new Promise(r => setTimeout(r, 250 * attempt));
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
