import { NewsArticle, NewsArticleSource } from '../types/Article.ts';

export interface RawArticlePayload {
    title?: string;
    headline?: string;
    body?: string;
    content?: string;
    url?: string;
    link?: string;
    publishedAt?: string;
    pubDate?: string;
    publisher?: string;
    source?: string;
    [key: string]: any;
}

export class ArticleNormalizer {
    public static normalize(payload: RawArticlePayload, sourceName: string, method: NewsArticleSource['collectionMethod']): NewsArticle {
        const headline = (payload.headline || payload.title || '').trim();
        const body = (payload.body || payload.content || '').trim();
        const sourceUrl = (payload.url || payload.link || '').trim();
        const publisher = (payload.publisher || payload.source || sourceName).trim();

        if (!headline) throw new Error('Missing headline in raw payload');
        if (!sourceUrl) throw new Error('Missing source URL in raw payload');

        const publishedAt = this.normalizeTimestamp(payload.publishedAt || payload.pubDate || new Date().toISOString());
        const fetchedAt = new Date().toISOString();

        return {
            id: '', // To be filled by IdentityEngine
            source: {
                name: sourceName,
                url: sourceUrl,
                publisher,
                collectionMethod: method
            },
            sourceUrl,
            headline: this.cleanText(headline),
            body: this.cleanText(body),
            publishedAt,
            fetchedAt,
            primaryCategory: 'General',
            eventType: 'UNCATEGORIZED',
            symbol: null,
            fnoEligible: false,
            financialMetrics: [],
            classificationConfidence: 0,
            relevanceScore: 50
        };
    }

    private static normalizeTimestamp(ts: string): string {
        try {
            const date = new Date(ts);
            if (isNaN(date.getTime())) return new Date().toISOString();
            return date.toISOString();
        } catch {
            return new Date().toISOString();
        }
    }

    private static cleanText(text: string): string {
        return text
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // Clean CDATA
            .replace(/<[^>]*>?/gm, '') // Remove HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
}
