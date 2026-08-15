import { GoogleGenAI } from '@google/genai';
import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';

export class GeminiProvider implements IAIProvider {
  public readonly providerName: ProviderType = 'gemini';
  private readonly TIMEOUT_MS = 35000; // 35s timeout
  private healthMonitor = AIHealthMonitor.getInstance();
  private costTracker = CostTracker.getInstance();

  public isHealthy(): boolean {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GEMINI_API_KEY') || apiKey === 'undefined' || apiKey === 'null') {
      return false;
    }
    return this.healthMonitor.isProviderHealthy('gemini');
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GEMINI_API_KEY') || apiKey === 'undefined' || apiKey === 'null') {
      this.healthMonitor.recordFailure('gemini', 'GEMINI_API_KEY missing or placeholder');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const models = ['gemini-3.7-flash', 'gemini-3.1-flash-lite'];
    const maxRetries = models.length - 1;
    let attempt = 0;
    let lastError: any = null;

    if (options.streamingCallback) {
      options.streamingCallback('thinking', 'Failing over to Gemini AI...');
    }

    while (attempt <= maxRetries) {
      const startTime = Date.now();
      try {
        if (options.streamingCallback) {
          options.streamingCallback('generating', `Gemini is composing response (attempt ${attempt + 1})...`);
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

        const modelToUse = models[attempt];
        if (!modelToUse) {
          break;
        }

        console.log(`[GeminiProvider] Attempting generateContent with model: ${modelToUse} (attempt ${attempt + 1}/${maxRetries + 1})`);

        const apiPromise = ai.models.generateContent({
          model: modelToUse,
          contents: fullPrompt,
          config: {
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 500
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
        const errStr = String(err?.message || err);
        const isQuotaError =
          err?.status === 429 ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          errStr.includes('Quota exceeded') ||
          errStr.includes('quota');

        const is503Error =
          err?.status === 503 ||
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('Service Unavailable');

        if (isQuotaError) {
          this.healthMonitor.recordQuotaExceeded('gemini');
          console.warn('[GeminiProvider] Gemini API quota limit reached (429). Trying fallback model if available.');
          if (attempt >= maxRetries) {
            throw new Error('Gemini API quota exceeded (429)');
          }
        }

        if (is503Error && attempt >= maxRetries) {
          this.healthMonitor.recordFailure('gemini', '503 High Demand / Service Unavailable');
          console.info('[GeminiProvider] Gemini API currently experiencing high demand (503). Retries exhausted.');
          throw new Error('Gemini API high demand (503)');
        }

        attempt++;
        if (attempt <= maxRetries) {
          const delay = is503Error ? 600 * attempt : 400;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    const errorMessage = lastError?.message || 'Gemini API call failed';
    this.healthMonitor.recordFailure('gemini', errorMessage);
    throw new Error(`GeminiProvider Error: ${errorMessage}`);
  }
}
