import { NewsArticle } from '../types/Article.ts';

export interface IntelligenceEnrichmentOptions {
    force?: boolean;
    mode?: 'SUMMARY' | 'FULL';
}

export interface INewsIntelligenceService {
    enrich(article: NewsArticle, options?: IntelligenceEnrichmentOptions): Promise<NewsArticle>;
}

export class NewsIntelligenceService implements INewsIntelligenceService {
    /**
     * Placeholder implementation for future AI integration.
     * Reuses existing AI architecture but remains isolated for now.
     */
    public async enrich(article: NewsArticle, options?: IntelligenceEnrichmentOptions): Promise<NewsArticle> {
        // For now, this is a pass-through.
        // It ensures that AI failure doesn't break the canonical article.
        try {
            // Future logic would call Gemini/Grok here via AIRouter
            return article;
        } catch (err) {
            console.warn(`[NewsIntelligenceService] Enrichment failed for ${article.id}:`, err);
            return article;
        }
    }
}
