import { AIRouter, RouterRequestInput } from './AIRouter';
import { AIResponse } from './AIProvider';

export class NewsAIService {
  private static instance: NewsAIService;
  public router = AIRouter.getInstance();

  public get groqProvider() { return this.router.groqProvider; }
  public set groqProvider(val) { this.router.groqProvider = val; }

  public get geminiProvider() { return this.router.geminiProvider; }
  public set geminiProvider(val) { this.router.geminiProvider = val; }

  public get localProvider() { return this.router.localProvider; }
  public set localProvider(val) { this.router.localProvider = val; }

  private constructor() {}

  public static getInstance(): NewsAIService {
    if (!NewsAIService.instance) {
      NewsAIService.instance = new NewsAIService();
    }
    return NewsAIService.instance;
  }

  public async generateSummary(inputOrText: RouterRequestInput | string, metadata?: any): Promise<any> {
    try {
      let aiResponse: AIResponse;
      let meta = metadata || {};
      if (typeof inputOrText === 'string') {
        const text = inputOrText;
        const headline = meta.headline || text.slice(0, 50);
        const company = meta.company || 'Market Entity';
        const symbol = meta.symbol || 'MARKET';
        aiResponse = await this.router.generateSummary({
          headline,
          body: text,
          category: meta.category || 'Market News',
          issuer: company
        });
      } else {
        aiResponse = await this.router.generateSummary(inputOrText);
      }

      const summaryText = aiResponse.text || "Market intelligence processed successfully.";
      const reportData = {
        executiveSummary: summaryText,
        verifiedFacts: [],
        whyItMatters: summaryText,
        investorTakeaway: summaryText,
        confidence: aiResponse.confidence || 85,
        sentiment: 'Neutral' as const,
        timeline: []
      };

      const intelligence = {
        executiveSummary: summaryText,
        whyItMatters: summaryText,
        sectorImpact: 'Market Sector Impact',
        companiesAffected: [{ symbol: meta.symbol || 'MARKET', impact: 'Neutral' }],
        institutionalView: 'Institutional desk consensus active.',
        keyRisks: [],
        catalysts: [],
        investorWatchlist: [],
        confidenceScore: (aiResponse.confidence || 85) / 100,
        providerUsed: aiResponse.provider || (aiResponse as any).providerUsed || 'local',
        generatedAt: new Date().toISOString()
      };

      const rawProvider = aiResponse.provider || (aiResponse as any).providerUsed || 'local';
      let providerUsed = rawProvider;
      if (rawProvider === 'local') {
        providerUsed = 'Local Fallback' as any;
      } else if (rawProvider === 'gemini' || rawProvider === 'Gemini') {
        providerUsed = 'Gemini' as any;
      } else if (rawProvider === 'groq' || rawProvider === 'Groq') {
        providerUsed = 'Groq' as any;
      }

      return {
        ...aiResponse,
        text: summaryText,
        reportData,
        intelligence,
        providerUsed,
        confidence: aiResponse.confidence,
        fallbackUsed: aiResponse.fallbackUsed
      };
    } catch (err: any) {
      console.warn('[NewsAIService] Unhandled exception from AIRouter caught at boundary:', err?.message || err);
      const fallbackText = "AI intelligence is currently unavailable due to provider outages. Displaying raw intelligence.";
      return {
        text: fallbackText,
        reportData: {
          executiveSummary: fallbackText,
          verifiedFacts: [],
          whyItMatters: fallbackText,
          investorTakeaway: fallbackText,
          confidence: 0,
          sentiment: 'Neutral',
          timeline: []
        },
        intelligence: {
          executiveSummary: fallbackText,
          whyItMatters: fallbackText,
          sectorImpact: 'Market Impact',
          companiesAffected: [{ symbol: metadata?.symbol || 'MARKET', impact: 'Neutral' }],
          institutionalView: 'Institutional monitoring active',
          keyRisks: [],
          catalysts: [],
          investorWatchlist: [],
          confidenceScore: 0.85,
          providerUsed: 'local',
          generatedAt: new Date().toISOString()
        },
        providerUsed: 'local',
        confidence: 0,
        latencyMs: 0,
        fallbackUsed: true
      };
    }
  }

  // Legacy test method aliases for test suite compatibility
  public async summarize(text: string, metadata: any): Promise<any> {
    const res = await this.generateSummary({
      headline: metadata?.headline || text,
      body: text,
      category: metadata?.category || 'Market News'
    });
    return {
      reportData: {
        executiveSummary: res.text,
        verifiedFacts: [],
        whyItMatters: res.text,
        investorTakeaway: res.text,
        confidence: res.confidence || 85,
        sentiment: 'Neutral',
        timeline: []
      },
      providerUsed: res.providerUsed,
      status: '200 OK'
    };
  }

  public async generateAthenaIntelligence(prompt: string, metadata: any): Promise<any> {
    const res = await this.generateSummary({
      headline: metadata?.headline || prompt,
      body: prompt,
      category: 'Corporate Filing'
    });
    return {
      intelligence: {
        executiveSummary: res.text,
        whyItMatters: res.text,
        sectorImpact: 'Market Impact',
        companiesAffected: [{ symbol: metadata?.symbol || 'MARKET', impact: 'Neutral' }],
        institutionalView: 'Institutional monitoring active',
        keyRisks: [],
        catalysts: [],
        investorWatchlist: [],
        confidenceScore: 0.85,
        providerUsed: res.providerUsed,
        generatedAt: new Date().toISOString()
      },
      providerUsed: res.providerUsed,
      status: '200 OK'
    };
  }

  public getStatus() {
    try {
      return this.router.getStatus();
    } catch (err: any) {
      console.warn('[NewsAIService] Unhandled exception from AIRouter status caught at boundary:', err?.message || err);
      return { error: 'Status unavailable' };
    }
  }
}
