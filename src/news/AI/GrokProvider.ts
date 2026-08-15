import axios from 'axios';
import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';

export class GrokProvider implements IAIProvider {
  public readonly providerName: ProviderType = 'grok';
  private readonly TIMEOUT_MS = 15000; // 15s timeout
  private healthMonitor = AIHealthMonitor.getInstance();
  private costTracker = CostTracker.getInstance();

  public isHealthy(): boolean {
    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GROK_API_KEY') || apiKey === 'undefined' || apiKey === 'null') {
      return false;
    }
    return this.healthMonitor.isProviderHealthy('grok');
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    if (!apiKey || apiKey.includes('MY_GROK_API_KEY') || apiKey === 'undefined' || apiKey === 'null') {
      this.healthMonitor.recordFailure('grok', 'GROK_API_KEY missing or placeholder');
      throw new Error('GROK_API_KEY is not configured');
    }

    const maxRetries = 1;
    let attempt = 0;
    let lastError: any = null;

    if (options.streamingCallback) {
      options.streamingCallback('thinking', 'Connecting to Grok AI...');
    }

    while (attempt <= maxRetries) {
      const startTime = Date.now();
      try {
        if (options.streamingCallback) {
          options.streamingCallback('generating', 'Grok is composing response...');
        }

        const isGroq = apiKey.startsWith('gsk_');
        const endpoint = isGroq 
          ? 'https://api.groq.com/openai/v1/chat/completions'
          : 'https://api.x.ai/v1/chat/completions';
        
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
        const modelName = isGroq
          ? groqModels[attempt % groqModels.length]
          : 'grok-2';

        const response = await axios.post(
          endpoint,
          {
            model: modelName,
            messages: [
              {
                role: 'system',
                content: options.systemPrompt || 'You are a senior financial news editor at Bloomberg.'
              },
              {
                role: 'user',
                content: options.prompt
              }
            ],
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 500
          },
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
          throw new Error('Empty or malformed choice response from Grok API');
        }

        const text = choices[0].message.content.trim();
        if (!text || text.length < 10) {
          throw new Error('Empty text content received from Grok API');
        }

        const promptTokens = response.data?.usage?.prompt_tokens || Math.ceil(options.prompt.length / 4);
        const completionTokens = response.data?.usage?.completion_tokens || Math.ceil(text.length / 4);
        const totalTokens = promptTokens + completionTokens;

        const costEstimate = this.costTracker.trackUsage('grok', promptTokens, completionTokens, latencyMs);
        this.healthMonitor.recordSuccess('grok', latencyMs, totalTokens);

        if (options.streamingCallback) {
          options.streamingCallback('final', text);
        }

        return {
          text,
          provider: 'grok',
          confidence: 95, // initial score before ConfidenceEngine validation
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          costEstimate,
          fallbackUsed: false
        };
      } catch (err: any) {
        lastError = err;
        const msg = err?.response?.data?.error?.message || err?.message || '';
        const isRateLimit = err?.response?.status === 429 || 
                            msg.toLowerCase().includes('rate limit') || 
                            msg.toLowerCase().includes('tpm') ||
                            msg.toLowerCase().includes('limit reached');
        if (isRateLimit) {
          this.healthMonitor.recordQuotaExceeded('grok');
          if (attempt >= maxRetries) {
            break; // Avoid further retries on rate limit only if max retries reached
          }
        }
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 500)); // brief wait before 1 retry
        }
      }
    }

    const errorMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Grok API call failed';
    const isRateLimit = lastError?.response?.status === 429 || 
                        errorMessage.toLowerCase().includes('rate limit') || 
                        errorMessage.toLowerCase().includes('tpm') ||
                        errorMessage.toLowerCase().includes('limit reached');
    if (isRateLimit) {
      this.healthMonitor.recordQuotaExceeded('grok');
    } else {
      this.healthMonitor.recordFailure('grok', errorMessage);
    }
    throw new Error(`GrokProvider Error: ${errorMessage}`);
  }
}
