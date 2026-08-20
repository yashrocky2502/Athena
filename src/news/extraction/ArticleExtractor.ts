/**
 * ATHENA NEWS ENGINE — STAGE 7.4 EXTRACTOR INTERFACE & REGISTRY
 */

import { ExtractedArticle } from '../types/NewsSummary';

export interface ArticleExtractor {
  name: string;
  canHandle(url: string): boolean;
  extract(url: string, rawHtmlOrText?: string): Promise<ExtractedArticle>;
  isEnabled(): boolean;
}

export class ExtractorRegistry {
  private static instance: ExtractorRegistry;
  private extractors: ArticleExtractor[] = [];

  private constructor() {}

  public static getInstance(): ExtractorRegistry {
    if (!ExtractorRegistry.instance) {
      ExtractorRegistry.instance = new ExtractorRegistry();
    }
    return ExtractorRegistry.instance;
  }

  public register(extractor: ArticleExtractor): void {
    // Avoid duplicate registration
    if (!this.extractors.some(e => e.name === extractor.name)) {
      this.extractors.push(extractor);
    }
  }

  public getExtractors(): ArticleExtractor[] {
    return this.extractors.filter(e => e.isEnabled());
  }

  public getExtractorByName(name: string): ArticleExtractor | undefined {
    return this.extractors.find(e => e.name === name && e.isEnabled());
  }
}
