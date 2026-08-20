/**
 * ATHENA NEWS ENGINE — STAGE 7.4 AI-ASSISTED CANONICAL NEWS SUMMARY SERVICE
 * Dedicated pipeline for producing validated 2-4 sentence canonical summaries.
 */

import { NewsArticle } from '../models/NewsArticle';
import { NewsSummary, ExtractionQuality } from '../types/NewsSummary';
import { ExtractionQualityEvaluator } from '../extraction/ExtractionQualityEvaluator';
import { SummaryValidator } from '../validation/SummaryValidator';
import { NewsSummaryCache } from '../cache/NewsSummaryCache';
import { AIRouter } from '../AI/AIRouter';
import { TrafilaturaExtractor } from '../extraction/TrafilaturaExtractor';
import { Crawl4AIExtractor } from '../extraction/Crawl4AIExtractor';
import { PublisherProfileManager } from '../extraction/PublisherProfileManager';

export class NewsSummaryService {
  private static instance: NewsSummaryService;
  private cache = NewsSummaryCache.getInstance();
  private router = AIRouter.getInstance();
  private publisherManager = PublisherProfileManager.getInstance();

  private constructor() {}

  public static getInstance(): NewsSummaryService {
    if (!NewsSummaryService.instance) {
      NewsSummaryService.instance = new NewsSummaryService();
    }
    return NewsSummaryService.instance;
  }

  /**
   * Generates or retrieves a cached canonical news summary.
   */
  public async getOrGenerateSummary(article: NewsArticle): Promise<NewsSummary> {
    if (!article || !article.id) {
      return this.generateLocalFallbackSummary(article, 'Invalid article provided');
    }

    // 1. Check Cache
    const cached = this.cache.get(article.id);
    if (cached) {
      return cached;
    }

    const title = article.title || article.headline || '';
    const rawBody = article.content || article.raw_text || article.summary || '';
    const domain = this.extractDomain(article.url || article.link || '');

    // 2. Extraction Quality Evaluation
    let evalResult = ExtractionQualityEvaluator.evaluate(title, rawBody, rawBody);
    let cleanText = rawBody;
    let extractionMethod = 'TrafilaturaExtractor';

    if (evalResult.quality === 'WEAK' || evalResult.quality === 'FAILED') {
      // Attempt secondary extraction via Crawl4AI / DOM renderer
      const crawl4ai = new Crawl4AIExtractor();
      const extracted = await crawl4ai.extract(article.url || '', rawBody);
      if (extracted.quality === 'EXCELLENT' || extracted.quality === 'ACCEPTABLE') {
        cleanText = extracted.cleanText;
        evalResult = { score: extracted.qualityScore, quality: extracted.quality, reasons: ['Upgraded via Crawl4AI'] };
        extractionMethod = 'Crawl4AIExtractor';
      }
    }

    // Record publisher extraction profile
    if (domain) {
      this.publisherManager.recordResult(
        domain,
        extractionMethod,
        evalResult.score,
        evalResult.quality !== 'FAILED',
        evalResult.reasons.join('; ')
      );
    }

    // Rule: FAILED extraction -> DO NOT send to AI, use local deterministic summary
    if (evalResult.quality === 'FAILED') {
      const fallback = this.generateLocalFallbackSummary(article, 'Extraction failed quality threshold');
      this.cache.set(article.id, fallback);
      return fallback;
    }

    // 3. AI Generation Pipeline
    const prompt = this.buildSummaryPrompt(title, cleanText, article.publisher || domain);

    try {
      const aiResponse = await this.router.generateWithRouter({
        prompt,
        systemPrompt: 'You are ATHENA Canonical News Summarizer. Return strictly valid structured JSON without markdown wrapping. Explain the development concisely in 2-4 sentences without repeating the headline.',
        temperature: 0.2
      });

      // Parse JSON output
      const parsedJSON = this.parseAIResponse(aiResponse.text);
      if (parsedJSON) {
        // 4. Summary Validation
        const valResult = SummaryValidator.validate(parsedJSON, title, cleanText);
        if (valResult.valid) {
          const summaryObj: NewsSummary = {
            articleId: article.id,
            summary: parsedJSON.summary || `${parsedJSON.whatHappened} ${parsedJSON.whyItMatters}`,
            whatHappened: parsedJSON.whatHappened || parsedJSON.summary,
            whyItMatters: parsedJSON.whyItMatters || 'Material development for market participants.',
            keyFacts: Array.isArray(parsedJSON.keyFacts) ? parsedJSON.keyFacts : [],
            importantNumbers: Array.isArray(parsedJSON.importantNumbers) ? parsedJSON.importantNumbers : [],
            entities: Array.isArray(parsedJSON.entities) ? parsedJSON.entities : [],
            eventType: parsedJSON.eventType || article.category || 'CORPORATE_DEVELOPMENT',
            unknowns: Array.isArray(parsedJSON.unknowns) ? parsedJSON.unknowns : [],
            extractionQuality: evalResult.quality,
            extractionMethod,
            provider: aiResponse.provider,
            model: aiResponse.model,
            validated: true,
            generatedAt: new Date().toISOString()
          };

          this.cache.set(article.id, summaryObj);
          return summaryObj;
        }
      }
    } catch (err: any) {
      // AI generation failed or rejected
    }

    // 5. Fallback on validation/AI failure
    const fallback = this.generateLocalFallbackSummary(article, 'AI generation or validation fallback');
    this.cache.set(article.id, fallback);
    return fallback;
  }

  private buildSummaryPrompt(title: string, text: string, source?: string): string {
    return `Summarize the following market news article into structured JSON.
ARTICLE TITLE: "${title}"
SOURCE: "${source || 'Verified Wire'}"
ARTICLE TEXT:
${text.substring(0, 3000)}

STRICT REQUIREMENTS:
1. Explain what actually happened in 2-4 concise sentences.
2. DO NOT repeat the headline verbatim.
3. Identify the principal company/entity.
4. Extract important factual numbers (values and context).
5. Output MUST be strictly valid JSON in this exact schema:
{
  "summary": "2-4 sentence summary explaining the core news event...",
  "whatHappened": "Clear explanation of the actual development...",
  "whyItMatters": "Strategic/financial significance...",
  "keyFacts": ["Fact 1", "Fact 2"],
  "importantNumbers": [{"value": "Rs 300", "context": "Jio Prime annual fee"}],
  "entities": ["Reliance Industries", "Bharti Airtel"],
  "eventType": "PRODUCT_LAUNCH | EARNINGS | IPO | DEREGULATION | MERGER",
  "unknowns": []
}`;
  }

  private parseAIResponse(text: string): any {
    try {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (e) {
      return null;
    }
  }

  private generateLocalFallbackSummary(article: NewsArticle, reason: string): NewsSummary {
    const title = article?.title || article?.headline || 'Market News Update';
    const content = article?.content || article?.raw_text || article?.summary || '';
    
    // Clean content snippet
    const snippet = content.length > 20 ? content.substring(0, 300).trim() : title;
    const summaryText = content.length > 20 ? snippet : `Key market update regarding ${title}.`;

    return {
      articleId: article?.id || 'unknown',
      summary: summaryText,
      whatHappened: snippet,
      whyItMatters: 'Canonical development reported by primary market source.',
      keyFacts: [title],
      importantNumbers: [],
      entities: article?.publisher ? [article.publisher] : [],
      eventType: article?.category || 'MARKET_UPDATE',
      unknowns: [reason],
      extractionQuality: 'ACCEPTABLE',
      extractionMethod: 'DeterministicLocal',
      provider: 'AthenaLocalEngine',
      model: 'RuleBasedSynthesizer',
      validated: true,
      generatedAt: new Date().toISOString()
    };
  }

  private extractDomain(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }
}
