/**
 * ATHENA NEWS ENGINE — STAGE 10.10
 * CanonicalNewsSummaryEngine
 * 
 * Canonical News Summary Synthesizer implementing genuine Inshorts-style,
 * evidence-grounded news summaries (60–120 words) with strict separation
 * from Trader Intelligence.
 * 
 * Pipeline:
 * SOURCE → EXTRACTION → CONTENT QUALITY CHECK → ARTICLE SUMMARY → SUMMARY QUALITY CHECK → UI / TELEGRAM
 */

import { NewsArticleV2 } from '../domain/NewsArticle.ts';
import { CanonicalArticleSummary } from '../types/CanonicalSchema.ts';
import { SourceArticleExtractionGate } from '../../news/intelligence/SourceArticleExtractionGate.ts';
import { SummaryQualityGate } from '../../news/intelligence/SummaryQualityGate.ts';
import { SummaryCache } from '../../news/NewsEngine/SummaryCache.ts';
import { NewsAIService } from '../../news/AI/NewsAIService.ts';

export class CanonicalNewsSummaryEngine {
  private static instance: CanonicalNewsSummaryEngine;
  private cache = SummaryCache.getInstance();

  private constructor() {}

  public static getInstance(): CanonicalNewsSummaryEngine {
    if (!CanonicalNewsSummaryEngine.instance) {
      CanonicalNewsSummaryEngine.instance = new CanonicalNewsSummaryEngine();
    }
    return CanonicalNewsSummaryEngine.instance;
  }

  /**
   * Generates or retrieves a CanonicalArticleSummary for an article.
   */
  public async getOrGenerateSummary(article: any, forceRefresh: boolean = false): Promise<CanonicalArticleSummary> {
    if (!article || !article.id) {
      return this.buildUnavailableSummary(article?.id || 'unknown', 'Article metadata invalid');
    }

    const cacheKey = `canonical_summary_v10_${article.id}`;
    if (!forceRefresh) {
      const cached = this.cache.get<CanonicalArticleSummary>(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // 1. EXTRACTION & EXTRACTION GATE
    const { diagnostic, cleanBody } = SourceArticleExtractionGate.evaluate(article);
    const hasExtraction = diagnostic.extractionStatus === 'SUCCESS' && !!cleanBody;

    if (!hasExtraction) {
      const isUnavailable = diagnostic.failureCategory === 'NO_SOURCE_BODY' || 
                            diagnostic.failureCategory === 'UNSUPPORTED_PUBLISHER';
      const status = isUnavailable ? 'SOURCE_UNAVAILABLE' : 'EXTRACTION_FAILED';
      const unavailable = this.buildUnavailableSummary(article.id, diagnostic.rejectionReason || 'Extraction failed', status);
      this.cache.set(cacheKey, unavailable, 24 * 60 * 60 * 1000);
      return unavailable;
    }

    const effectiveArticle = {
      ...article,
      body: cleanBody,
      headline: article.headline || article.title || ''
    };

    // 2. AI GENERATION (Grok/Gemini) with strict Inshorts-style prompt
    let aiSummary: CanonicalArticleSummary | null = null;
    try {
      aiSummary = await this.generateAISummary(effectiveArticle);
    } catch (e) {
      // AI generation fallback to deterministic
    }

    if (aiSummary) {
      // Quality Gate Check on AI Summary
      const gateResult = SummaryQualityGate.evaluate(effectiveArticle, aiSummary);
      if (gateResult.passed) {
        aiSummary.qualityGatePassed = true;
        aiSummary.qualityGateScore = 95;
        aiSummary.summaryStatus = 'SOURCE_GROUNDED';
        aiSummary.extractionStatus = 'SOURCE_GROUNDED';
        this.cache.set(cacheKey, aiSummary, 24 * 60 * 60 * 1000);
        return aiSummary;
      }
    }

    // 3. DETERMINISTIC SYNTHESIS (Inshorts-grade multi-sentence body synthesis)
    const deterministic = this.generateDeterministicSummary(effectiveArticle);
    const gateResult = SummaryQualityGate.evaluate(effectiveArticle, deterministic);

    if (gateResult.passed) {
      deterministic.qualityGatePassed = true;
      deterministic.qualityGateScore = 90;
      deterministic.summaryStatus = 'SOURCE_GROUNDED';
      deterministic.extractionStatus = 'SOURCE_GROUNDED';
      this.cache.set(cacheKey, deterministic, 24 * 60 * 60 * 1000);
      return deterministic;
    }

    // Fallback if rejected by quality gate
    const fallback = this.buildUnavailableSummary(article.id, 'Summary rejected by quality gate', 'QUALITY_REJECTED');
    this.cache.set(cacheKey, fallback, 24 * 60 * 60 * 1000);
    return fallback;
  }

  /**
   * Deterministic Inshorts-style summary synthesis from source body.
   */
  public generateDeterministicSummary(article: any): CanonicalArticleSummary {
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || article.cleanText || '').trim();
    const publisher = article.source?.publisher || article.publisher || 'Market Wire';
    const publishedAt = article.publishedAt || article.collectedAt || new Date().toISOString();
    const canonicalUrl = article.canonicalUrl || article.url || '';
    const category = article.primaryCategory || article.category || 'General';

    if (!body || body.length < 40) {
      return this.buildUnavailableSummary(article.id || 'unknown', 'Article body too short for synthesis', 'SOURCE_UNAVAILABLE');
    }

    // Break into sentences
    const rawSentences = body
      .split(/(?<=[.?!])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => {
        if (s.length < 25) return false;
        const low = s.toLowerCase();
        return !low.startsWith('click here') &&
               !low.startsWith('subscribe') &&
               !low.startsWith('read also') &&
               !low.startsWith('image:') &&
               !low.startsWith('photo:') &&
               !low.startsWith('disclaimer:') &&
               !low.includes('terms of service');
      });

    if (rawSentences.length === 0) {
      return this.buildUnavailableSummary(article.id || 'unknown', 'No valid body sentences found', 'EXTRACTION_FAILED');
    }

    // Filter sentences that are merely repeating the headline verbatim or with >75% similarity
    const distinctSentences = rawSentences.filter((s: string) => {
      const sim = SourceArticleExtractionGate.calculateSimilarity(headline, s);
      return sim < 0.72;
    });

    const candidatePool = distinctSentences.length >= 2 ? distinctSentences : rawSentences;

    // 1. Lead / Core Event Sentence
    let leadSentence = candidatePool[0] || '';
    // If the lead sentence is very similar to headline, try candidatePool[1]
    if (SourceArticleExtractionGate.calculateSimilarity(headline, leadSentence) > 0.70 && candidatePool.length > 1) {
      leadSentence = candidatePool[1];
    }

    // 2. Metrics / Factual Details Sentence (deal value, percentage, revenue, profit, units, dates)
    const metricSentence = candidatePool.find((s: string) => {
      if (s === leadSentence) return false;
      return /(?:₹|\$|Rs\.?|crore|billion|million|percent|%|shares|valuation|deal|acquisition|expanded|revenue|pat|ebitda|order|contract)/i.test(s);
    });

    // 3. Background / Context Sentence (previous history, company domain, earlier attempts, reason for action)
    const contextSentence = candidatePool.find((s: string) => {
      if (s === leadSentence || s === metricSentence) return false;
      return /(?:earlier|previously|plans to|aims to|founded in|following|amid|in 202|last year|prior to|as part of|under the|strategy)/i.test(s);
    });

    // 4. Forward-looking / Next Steps Sentence (approvals, timeline, expected completion)
    const forwardSentence = candidatePool.find((s: string) => {
      if (s === leadSentence || s === metricSentence || s === contextSentence) return false;
      return /(?:expected to|subject to|scheduled|timeline|approval|sebi|rbi|filing|spokesperson|stated|commented|management)/i.test(s);
    });

    // Build synthesized Inshorts paragraph (3-4 concise, cohesive sentences)
    const summaryParts: string[] = [];
    if (leadSentence) summaryParts.push(leadSentence);
    if (metricSentence) summaryParts.push(metricSentence);
    if (contextSentence) summaryParts.push(contextSentence);
    if (forwardSentence && summaryParts.length < 3) summaryParts.push(forwardSentence);

    // If we only found 1 sentence, pick next best distinct sentences from candidatePool
    if (summaryParts.length < 2) {
      for (const s of candidatePool) {
        if (!summaryParts.includes(s)) {
          summaryParts.push(s);
          if (summaryParts.length >= 3) break;
        }
      }
    }

    const synthesizedSummary = summaryParts.join(' ').trim();

    // Extract numbers and entities
    const importantNumbers = this.extractImportantNumbers(body);
    const entities = this.extractEntities(article);
    const keyFacts = this.extractKeyFacts(candidatePool, headline);

    const whatHappened = leadSentence || headline;
    const backgroundAndContext = contextSentence || candidatePool.find((s: string) => s !== leadSentence) || '';
    const whyItMatters = this.buildWhyItMatters(article, category);

    return {
      articleId: article.id || 'article',
      headline,
      summary: synthesizedSummary || headline,
      whatHappened,
      backgroundAndContext,
      whyItMatters,
      keyFacts,
      importantNumbers,
      entities,
      eventType: article.eventType || category,
      publisher,
      publishedAt,
      canonicalUrl,
      extractionQuality: 'EXCELLENT',
      extractionStatus: 'SOURCE_GROUNDED',
      summaryStatus: 'SOURCE_GROUNDED',
      qualityGatePassed: true,
      qualityGateScore: 90,
      generatedAt: new Date().toISOString(),
      cached: false
    };
  }

  private async generateAISummary(article: any): Promise<CanonicalArticleSummary | null> {
    const headline = article.headline || article.title || '';
    const body = article.body || article.cleanText || '';
    const publisher = article.source?.publisher || article.publisher || 'Market Wire';

    const prompt = `You are the ATHENA Institutional News Summarizer.
Summarize this news article into an Inshorts-style, information-dense 3-4 sentence paragraph (60-100 words).

CONSTRAINTS:
1. Explain what actually happened, deal values, background context, and forward implications.
2. DO NOT just repeat or rephrase the headline.
3. Ground strictly in the provided article body.
4. Output strictly valid JSON without markdown formatting.

JSON Schema:
{
  "summary": "Cohesive Inshorts-style 3-4 sentence summary...",
  "whatHappened": "Core announcement or event in 1 sentence...",
  "backgroundAndContext": "Background context or previous events leading to this...",
  "whyItMatters": "Significance of this development for the business/industry...",
  "keyFacts": ["Key Fact 1", "Key Fact 2", "Key Fact 3"],
  "importantNumbers": [{"value": "Rs 5,000 Cr", "context": "Deal valuation"}],
  "entities": ["Company A", "Company B"],
  "eventType": "CORPORATE_UPDATE | EARNINGS | MERGER | IPO | REGULATORY"
}

Article Headline: ${headline}
Publisher: ${publisher}
Article Body:
${body.substring(0, 3500)}`;

    const aiRouter = NewsAIService.getInstance();
    const res = await aiRouter.generateSummary({
      category: article.category || 'News Summary',
      headline,
      body: prompt,
      url: article.canonicalUrl || article.url,
      publisher
    });

    if (res && res.text) {
      try {
        const clean = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed.summary && parsed.whatHappened) {
          return {
            articleId: article.id,
            headline,
            summary: parsed.summary,
            whatHappened: parsed.whatHappened,
            backgroundAndContext: parsed.backgroundAndContext || '',
            whyItMatters: parsed.whyItMatters || '',
            keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
            importantNumbers: Array.isArray(parsed.importantNumbers) ? parsed.importantNumbers : [],
            entities: Array.isArray(parsed.entities) ? parsed.entities : [],
            eventType: parsed.eventType || article.category || 'MARKET_UPDATE',
            publisher,
            publishedAt: article.publishedAt || new Date().toISOString(),
            canonicalUrl: article.canonicalUrl || article.url,
            extractionQuality: 'EXCELLENT',
            extractionStatus: 'SOURCE_GROUNDED',
            summaryStatus: 'SOURCE_GROUNDED',
            qualityGatePassed: true,
            generatedAt: new Date().toISOString(),
            cached: false
          };
        }
      } catch (e) {}
    }
    return null;
  }

  private extractImportantNumbers(body: string): Array<{ value: string; context: string }> {
    const numbers: Array<{ value: string; context: string }> = [];
    const regex = /(?:₹|\$|Rs\.?)\s*[\d,.]+\s*(?:crore|cr|lakh|billion|bn|million|mn)?|\b\d+(?:\.\d+)?%/gi;
    const sentences = body.split(/(?<=[.?!])\s+/);

    for (const s of sentences) {
      const matches = s.match(regex);
      if (matches) {
        for (const m of matches) {
          if (numbers.length >= 4) break;
          if (!numbers.some(n => n.value === m)) {
            const cleanContext = s.length > 80 ? s.substring(0, 77) + '...' : s;
            numbers.push({
              value: m.trim(),
              context: cleanContext.trim()
            });
          }
        }
      }
    }
    return numbers;
  }

  private extractEntities(article: any): string[] {
    const entities = new Set<string>();
    if (article.companyName) entities.add(article.companyName);
    if (article.symbol) entities.add(article.symbol);
    if (article.entities && Array.isArray(article.entities)) {
      for (const e of article.entities) {
        if (typeof e === 'string') entities.add(e);
        else if (e?.name) entities.add(e.name);
      }
    }
    return Array.from(entities).slice(0, 5);
  }

  private extractKeyFacts(sentences: string[], headline: string): string[] {
    const facts: string[] = [];
    for (const s of sentences) {
      if (facts.length >= 3) break;
      const clean = s.trim();
      if (clean.length > 25 && clean.length < 200 && clean.toLowerCase() !== headline.toLowerCase()) {
        if (!facts.some(f => f.toLowerCase().includes(clean.slice(0, 30).toLowerCase()))) {
          facts.push(clean);
        }
      }
    }
    return facts;
  }

  private buildWhyItMatters(article: any, category: string): string {
    const cat = (category || '').toUpperCase();
    if (cat === 'RESULTS' || cat === 'EARNINGS') {
      return 'Discloses quarterly operating performance and financial health for fundamental valuation.';
    }
    if (cat === 'IPO') {
      return 'Represents a fresh capital raising event and new public market listing opportunities.';
    }
    if (cat === 'REGULATORY' || cat === 'ECONOMY') {
      return 'Impacts sector compliance requirements and broader macroeconomic market sentiment.';
    }
    if (cat === 'ORDER_CONTRACT' || cat === 'ORDER') {
      return 'Enhances order book visibility and medium-term revenue execution pipeline.';
    }
    return 'Material corporate development affecting market expectations and underlying business outlook.';
  }

  private buildUnavailableSummary(
    articleId: string,
    reason: string,
    status: 'SOURCE_UNAVAILABLE' | 'EXTRACTION_FAILED' | 'QUALITY_REJECTED' = 'SOURCE_UNAVAILABLE'
  ): CanonicalArticleSummary {
    return {
      articleId,
      headline: '',
      summary: 'Summary unavailable — Open original source',
      whatHappened: 'Summary unavailable — Open original source',
      backgroundAndContext: '',
      whyItMatters: '',
      keyFacts: [],
      importantNumbers: [],
      entities: [],
      eventType: 'MARKET_UPDATE',
      extractionQuality: 'UNAVAILABLE',
      extractionStatus: status,
      summaryStatus: status,
      qualityGatePassed: false,
      qualityGateScore: 0,
      qualityGateReason: reason,
      generatedAt: new Date().toISOString(),
      cached: false
    };
  }
}
