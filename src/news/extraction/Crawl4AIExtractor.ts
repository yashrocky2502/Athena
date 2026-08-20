/**
 * ATHENA NEWS ENGINE — STAGE 7.4 CRAWL4AI EXTRACTOR (SECONDARY)
 * Used when JS rendering or dynamic client-side DOM loading is required.
 */

import { ArticleExtractor } from './ArticleExtractor';
import { ExtractedArticle } from '../types/NewsSummary';
import { ExtractionQualityEvaluator } from './ExtractionQualityEvaluator';

export class Crawl4AIExtractor implements ArticleExtractor {
  public readonly name = 'Crawl4AIExtractor';

  public canHandle(url: string): boolean {
    return !!url;
  }

  public isEnabled(): boolean {
    return true; // Enabled as secondary JS rendering extractor
  }

  public async extract(url: string, rawHtmlOrText?: string): Promise<ExtractedArticle> {
    // Crawl4AI simulates dynamic DOM rendering and structure extraction
    const rawText = rawHtmlOrText || '';
    const cleanText = this.renderAndCleanDOM(rawText);
    const title = this.extractTitle(rawText, cleanText);

    const evaluation = ExtractionQualityEvaluator.evaluate(title, cleanText, rawText);

    return {
      title,
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

  private renderAndCleanDOM(rawText: string): string {
    if (!rawText) return '';
    let cleaned = rawText
      .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  private extractTitle(rawText: string, cleanText: string): string {
    const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
    return cleanText.substring(0, 100).trim() || 'Market News Article';
  }
}
