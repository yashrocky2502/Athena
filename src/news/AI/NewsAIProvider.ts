/**
 * ATHENA NEWS ENGINE — STAGE 7.5 NEWS AI PROVIDER BOUNDARY (LITELLM PREPARATION)
 * Abstraction layer preparing future LiteLLM routing while maintaining direct Groq/Gemini/Local providers.
 */

import { AIRouter } from './AIRouter';
import { AIRequestOptions, AIResponse } from './AIProvider';

export interface NewsAIProvider {
  generate(options: AIRequestOptions): Promise<AIResponse>;
  isAvailable(): boolean;
}

export class DirectAIRouterProvider implements NewsAIProvider {
  private router = AIRouter.getInstance();

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    return this.router.generateSummary(options);
  }

  public isAvailable(): boolean {
    return true;
  }
}

export class LiteLLMGatewayProvider implements NewsAIProvider {
  private gatewayUrl: string;

  constructor(gatewayUrl = process.env.LITELLM_GATEWAY_URL || '') {
    this.gatewayUrl = gatewayUrl;
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    if (!this.isAvailable()) {
      // Fall back to direct router if LiteLLM is not deployed
      const direct = new DirectAIRouterProvider();
      return direct.generate(options);
    }

    // Future LiteLLM HTTP client proxying
    const direct = new DirectAIRouterProvider();
    return direct.generate(options);
  }

  public isAvailable(): boolean {
    return !!this.gatewayUrl && this.gatewayUrl.length > 0;
  }
}
