import crypto from 'crypto';
import { NewsArticle } from '../types/Article.ts';

export class ArticleIdentity {
    /**
     * Generates a deterministic, immutable ID for an article.
     * Priority: 
     * 1. Normalized URL (if length > 15 and not generic)
     * 2. Normalized Headline + Publisher + Publication Date
     */
    public static generateId(article: NewsArticle): string {
        const url = article.sourceUrl.trim().toLowerCase();
        const headline = article.headline.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const publisher = (article.source.publisher || article.source.name).trim().toLowerCase();
        
        // Simple heuristic for "good" URL
        const isReliableUrl = url.length > 15 && !url.includes('example.com') && !url.includes('localhost');

        let seed: string;
        if (isReliableUrl) {
            // Remove query params for better matching
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            seed = `url:${cleanUrl}`;
        } else {
            // Fallback to semantic fingerprint
            const datePart = article.publishedAt.split('T')[0];
            seed = `semantic:${publisher}:${datePart}:${headline}`;
        }

        return 'v2_' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
    }
}
