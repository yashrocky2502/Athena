/**
 * ATHENA NEWS ENGINE — STAGE 7.4 TRAFILATURA EXTRACTOR (PRIMARY)
 * Cleans static article text, removes boilerplate, and measures quality.
 */

import { ArticleExtractor } from './ArticleExtractor';
import { ExtractedArticle } from '../types/NewsSummary';
import { ExtractionQualityEvaluator } from './ExtractionQualityEvaluator';

export class TrafilaturaExtractor implements ArticleExtractor {
  public readonly name = 'TrafilaturaExtractor';

  public canHandle(url: string): boolean {
    return !!url && !url.includes('pdf') && !url.includes('youtube.com');
  }

  public isEnabled(): boolean {
    return true; // Always enabled as primary static extractor
  }

  public async extract(url: string, rawHtmlOrText?: string): Promise<ExtractedArticle> {
    const rawText = rawHtmlOrText || '';
    
    // Clean boilerplate: remove scripts, styles, HTML tags, excess whitespace
    const cleanText = this.cleanArticleContent(rawText);
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

  private cleanArticleContent(rawText: string): string {
    if (!rawText) return '';
    
    // If rawText is HTML, strip script/style tags first
    let cleaned = rawText
      .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<footer\b[^<]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header\b[^<]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<nav\b[^<]*>[\s\S]*?<\/nav>/gi, '');

    // Strip remaining tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean multiple whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  private extractTitle(rawText: string, cleanText: string): string {
    const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                       rawText.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    const firstLine = cleanText.split(/[\.\n]/)[0] || 'Market News Update';
    return firstLine.substring(0, 120).trim();
  }
}
