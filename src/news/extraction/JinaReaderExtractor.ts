/**
 * ATHENA NEWS ENGINE — STAGE 7.4 JINA READER EXTRACTOR (THIRD FALLBACK)
 * External reader fallback converting web content into structured markdown text.
 */

import { ArticleExtractor } from './ArticleExtractor';
import { ExtractedArticle } from '../types/NewsSummary';
import { ExtractionQualityEvaluator } from './ExtractionQualityEvaluator';

export class JinaReaderExtractor implements ArticleExtractor {
  public readonly name = 'JinaReaderExtractor';

  public canHandle(url: string): boolean {
    return !!url;
  }

  public isEnabled(): boolean {
    return true; // Enabled as third fallback
  }

  public async extract(url: string, rawHtmlOrText?: string): Promise<ExtractedArticle> {
    const rawText = rawHtmlOrText || '';
    const cleanText = this.convertToCleanMarkdownText(rawText);
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
      jsRendered: false
    };
  }

  private convertToCleanMarkdownText(rawText: string): string {
    if (!rawText) return '';
    let text = rawText
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  }

  private extractTitle(rawText: string, cleanText: string): string {
    const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
    return cleanText.substring(0, 100).trim() || 'Market News Update';
  }
}
