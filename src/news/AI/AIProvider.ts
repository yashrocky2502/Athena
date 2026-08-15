export type ProviderType = 'grok' | 'gemini' | 'local';

export interface AIRequestOptions {
  prompt: string;
  systemPrompt?: string;
  domainType?: string;
  headline?: string;
  contentHash?: string;
  url?: string;
  publisher?: string;
  facts?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  streamingCallback?: (stage: 'thinking' | 'generating' | 'final', token: string) => void;
}

export interface AIResponse {
  text: string;
  provider: ProviderType;
  confidence: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costEstimate: number;
  fallbackUsed: boolean;
  cached?: boolean;
}

export interface IAIProvider {
  readonly providerName: ProviderType;
  generate(options: AIRequestOptions): Promise<AIResponse>;
  isHealthy(): boolean;
}
