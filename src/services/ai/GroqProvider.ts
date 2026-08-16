import axios from 'axios';

export interface AthenaAISchema {
  executiveSummary: string;
  verifiedFacts: string[];
  articleSummaryBullets?: string[];
  marketCommentary?: string[];
  whyItMatters: string;
  investorTakeaway: string;
  confidence: number;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  timeline: { time: string; event: string }[];
  marketImpact?: 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';
  stocksAffected?: string[];
  sectorImpact?: string;
  foImpact?: string;
  cePeBias?: 'CE Bias' | 'PE Bias' | 'Neutral' | 'Mixed';
  riskFactors?: string[];
  whatToWatchNext?: string;
}

export interface IGroqProvider {
  generateIntelligence(prompt: string, options?: { systemPrompt?: string }): Promise<AthenaAISchema>;
  getPrimaryModel(): string;
  isAvailable(): boolean;
}

export class GroqProvider implements IGroqProvider {
  private primaryModel = process.env.GROQ_PRIMARY_MODEL || 'openai/gpt-oss-120b';
  private fallbackModels = [
    process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.2-3b-preview',
  ];

  public getPrimaryModel(): string {
    return this.primaryModel;
  }

  public isAvailable(): boolean {
    const key = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
    return !!key && key.trim().length > 0;
  }

  public async generateIntelligence(
    prompt: string,
    options?: { systemPrompt?: string }
  ): Promise<AthenaAISchema> {
    const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey) {
      throw new Error('GroqProvider Error: GROQ_API_KEY environment variable is missing.');
    }

    const modelsToTry = [this.primaryModel, ...this.fallbackModels].filter(
      (m, idx, self) => self.indexOf(m) === idx
    );

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model,
            messages: [
              {
                role: 'system',
                content:
                  options?.systemPrompt ||
                  'You are ATHENA, an elite Indian financial market AI engine. Return valid JSON matching the Athena AI schema.',
              },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1500,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(`Empty completion content from model ${model}`);
        }

        const parsed = JSON.parse(content);
        return this.normalizeToAthenaSchema(parsed);
      } catch (err: any) {
        lastError = err;
        const msg = err.response?.data?.error?.message || err.message || String(err);
        console.warn(`[GroqProvider (service)] Model ${model} failed: ${msg}`);
        if (err.response?.status === 429) {
          continue; // Fail over to next model in sequence
        }
      }
    }

    throw new Error(`GroqProvider Error: All models failed. Last error: ${lastError?.message || lastError}`);
  }

  /**
   * Normalizes arbitrary JSON AI responses strictly into the standard Athena AI schema.
   */
  public normalizeToAthenaSchema(raw: any): AthenaAISchema {
    const rawFacts = Array.isArray(raw.verifiedFacts)
      ? raw.verifiedFacts
      : Array.isArray(raw.facts)
      ? raw.facts
      : [];

    const rawTimeline = Array.isArray(raw.timeline) ? raw.timeline : [];

    const sentimentValue = (raw.sentiment || 'Neutral').toString().trim();
    const normalizedSentiment: 'Bullish' | 'Bearish' | 'Neutral' =
      sentimentValue.toLowerCase().includes('bull')
        ? 'Bullish'
        : sentimentValue.toLowerCase().includes('bear')
        ? 'Bearish'
        : 'Neutral';

    const confidenceVal = Number(raw.confidence);
    const normalizedConfidence = !isNaN(confidenceVal) && confidenceVal >= 0 && confidenceVal <= 100
      ? Math.round(confidenceVal)
      : 85;

    return {
      executiveSummary:
        raw.executiveSummary || raw.summary || raw.headline || 'Financial market news intelligence event.',
      verifiedFacts: rawFacts.map((f: any) => String(f).trim()).filter(Boolean),
      articleSummaryBullets: Array.isArray(raw.articleSummaryBullets)
        ? raw.articleSummaryBullets.map(String)
        : rawFacts.map((f: any) => String(f).trim()),
      marketCommentary: Array.isArray(raw.marketCommentary)
        ? raw.marketCommentary.map(String)
        : [],
      whyItMatters: raw.whyItMatters || raw.importance || 'Key operational or market development for Indian equity markets.',
      investorTakeaway: raw.investorTakeaway || raw.takeaway || 'Monitor market opening and institutional volume indicators.',
      confidence: normalizedConfidence,
      sentiment: normalizedSentiment,
      timeline: rawTimeline.map((item: any) => ({
        time: item.time || new Date().toISOString(),
        event: item.event || String(item),
      })),
      marketImpact: (raw.marketImpact || 'UNKNOWN').toUpperCase() as any,
      stocksAffected: Array.isArray(raw.stocksAffected) ? raw.stocksAffected.map(String) : [],
      sectorImpact: raw.sectorImpact ? String(raw.sectorImpact) : undefined,
      foImpact: raw.foImpact ? String(raw.foImpact) : undefined,
      cePeBias: raw.cePeBias || 'Neutral',
      riskFactors: Array.isArray(raw.riskFactors) ? raw.riskFactors.map(String) : [],
      whatToWatchNext: raw.whatToWatchNext || 'Monitor company exchange disclosures and NIFTY volume trends.',
    };
  }
}
