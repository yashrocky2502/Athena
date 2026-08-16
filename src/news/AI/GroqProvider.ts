import axios from 'axios';
import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';

export type GroqErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'MALFORMED_OUTPUT'
  | 'NETWORK_ERROR'
  | 'UNCONFIGURED';

export class GroqProvider implements IAIProvider {
  public readonly providerName: ProviderType = 'groq';
  private readonly TIMEOUT_MS = 15000; // 15s timeout
  private healthMonitor = AIHealthMonitor.getInstance();
  private costTracker = CostTracker.getInstance();

  public getApiKey(): string | undefined {
    const key = process.env.GROQ_API_KEY || (typeof window === 'undefined' ? process.env?.GROQ_API_KEY : undefined);
    if (!key || key.includes('MY_GROQ_API_KEY') || key === 'undefined' || key === 'null' || key.trim() === '') {
      return undefined;
    }
    return key.trim();
  }

  public isHealthy(): boolean {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return false;
    }
    return this.healthMonitor.isProviderHealthy('groq');
  }

  public getPrimaryModel(): string {
    return process.env.GROQ_PRIMARY_MODEL || 'openai/gpt-oss-120b';
  }

  public getFallbackModel(): string {
    return process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile';
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.healthMonitor.recordFailure('groq', 'GROQ_API_KEY missing or placeholder');
      const err = new Error('GROQ_API_KEY is not configured');
      (err as any).code = 'UNCONFIGURED' as GroqErrorCode;
      throw err;
    }

    const models = [
      this.getPrimaryModel(),
      this.getFallbackModel(),
      'llama-3.3-70b-versatile'
    ].filter((m, idx, self) => self.indexOf(m) === idx);
    const maxRetries = models.length - 1;
    let attempt = 0;
    let lastError: any = null;

    if (options.streamingCallback) {
      options.streamingCallback('thinking', 'Connecting to Groq High-Speed Inference Engine...');
    }

    while (attempt <= maxRetries) {
      const startTime = Date.now();
      const modelToUse = models[attempt % models.length];

      try {
        if (options.streamingCallback) {
          options.streamingCallback('generating', `Groq is composing response using ${modelToUse}...`);
        }

        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

        const requestBody: any = {
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: options.systemPrompt || 'You are Athena Institutional Financial Intelligence Analyst. Provide clear, factual financial analysis.'
            },
            {
              role: 'user',
              content: options.prompt
            }
          ],
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1024
        };

        if (options.responseFormat === 'json') {
          requestBody.response_format = { type: 'json_object' };
        }

        const response = await axios.post(
          endpoint,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.TIMEOUT_MS
          }
        );

        const latencyMs = Date.now() - startTime;
        const choices = response.data?.choices;
        if (!choices || choices.length === 0 || !choices[0]?.message?.content) {
          const err = new Error('Empty or malformed choice response from Groq API');
          (err as any).code = 'MALFORMED_OUTPUT' as GroqErrorCode;
          throw err;
        }

        const text = choices[0].message.content.trim();
        if (!text || text.length < 10) {
          const err = new Error('Empty text content received from Groq API');
          (err as any).code = 'MALFORMED_OUTPUT' as GroqErrorCode;
          throw err;
        }

        const promptTokens = response.data?.usage?.prompt_tokens || Math.ceil(options.prompt.length / 4);
        const completionTokens = response.data?.usage?.completion_tokens || Math.ceil(text.length / 4);
        const totalTokens = promptTokens + completionTokens;

        const costEstimate = this.costTracker.trackUsage('groq', promptTokens, completionTokens, latencyMs);
        this.healthMonitor.recordSuccess('groq', latencyMs, totalTokens);

        if (options.streamingCallback) {
          options.streamingCallback('final', text);
        }

        return {
          text,
          provider: 'groq',
          confidence: 95,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          costEstimate,
          fallbackUsed: false
        };
      } catch (err: any) {
        lastError = err;
        const latencyMs = Date.now() - startTime;
        const status = err?.response?.status;
        const errorMessage = err?.response?.data?.error?.message || err?.message || 'Unknown Groq Error';

        if (status === 401 || status === 403) {
          this.healthMonitor.recordFailure('groq', `Auth error ${status}: ${errorMessage}`);
          const authErr = new Error(`Groq Authentication Failed (${status}): ${errorMessage}`);
          (authErr as any).code = 'AUTH_FAILED' as GroqErrorCode;
          throw authErr;
        }

        if (status === 429) {
          console.warn(`[GroqProvider] Rate limit reached on model ${modelToUse}: ${errorMessage}`);
          attempt++;
          if (attempt <= maxRetries) {
            console.log(`[GroqProvider] Retrying with model: ${models[attempt % models.length]}`);
            continue;
          }
          this.healthMonitor.recordQuotaExceeded('groq');
          const rateErr = new Error(`Groq Rate Limit Exceeded (429): ${errorMessage}`);
          (rateErr as any).code = 'RATE_LIMITED' as GroqErrorCode;
          throw rateErr;
        }

        if (err.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
          console.warn(`[GroqProvider] Request timed out on attempt ${attempt + 1}`);
          this.healthMonitor.recordFailure('groq', `Timeout after ${this.TIMEOUT_MS}ms`);
          attempt++;
          if (attempt <= maxRetries) {
            continue;
          }
          const timeErr = new Error(`Groq Request Timeout after ${this.TIMEOUT_MS}ms`);
          (timeErr as any).code = 'TIMEOUT' as GroqErrorCode;
          throw timeErr;
        }

        if (status >= 500 && status < 600) {
          console.warn(`[GroqProvider] Server error ${status} on attempt ${attempt + 1}`);
          this.healthMonitor.recordFailure('groq', `Server error ${status}: ${errorMessage}`);
          attempt++;
          if (attempt <= maxRetries) {
            continue;
          }
          const serverErr = new Error(`Groq Server Error (${status}): ${errorMessage}`);
          (serverErr as any).code = 'SERVER_ERROR' as GroqErrorCode;
          throw serverErr;
        }

        this.healthMonitor.recordFailure('groq', errorMessage);
        attempt++;
      }
    }

    const finalMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Groq request failed';
    const finalErr = new Error(`GroqProvider Error: ${finalMessage}`);
    (finalErr as any).code = lastError?.code || ('NETWORK_ERROR' as GroqErrorCode);
    throw finalErr;
  }
}
