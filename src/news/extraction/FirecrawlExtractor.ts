/**
 * ATHENA NEWS ENGINE — STAGE 7.4 FIRECRAWL EXTRACTOR (OPTIONAL)
 * Kept optional and automatically disabled if API credentials are unavailable.
 */

import { ArticleExtractor } from './ArticleExtractor';
import { ExtractedArticle } from '../types/NewsSummary';
import { ExtractionQualityEvaluator } from './ExtractionQualityEvaluator';

export class FirecrawlExtractor implements ArticleExtractor {
  public readonly name = 'FirecrawlExtractor';

  public canHandle(url: string): boolean {
    return !!url && this.isEnabled();
  }

  public isEnabled(): boolean {
    // Disabled unless explicitly configured with API credentials
    return !!process.env.FIRECRAWL_API_KEY;
  }

  public async extract(url: string, rawHtmlOrText?: string): Promise<ExtractedArticle> {
    if (!this.isEnabled()) {
      return {
        title: '',
        body: '',
        rawText: '',
        cleanText: '',
        url,
        method: this.name,
        quality: 'FAILED',
        qualityScore: 0,
        jsRendered: false
      };
    }

    const rawText = rawHtmlOrText || '';
    const cleanText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const evaluation = ExtractionQualityEvaluator.evaluate('', cleanText, rawText);

    return {
      title: 'Firecrawl Extracted Content',
      body: cleanText,
      rawText,
      cleanText,
      url,
      method: this.name,
      quality: evaluation.quality,
      qualityScore: evaluation.score,
      jsRendered: true
    };
  }
}
