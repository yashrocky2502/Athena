import { NewsArticle } from '../types/Article.ts';

export type DeduplicationStatus = 'NEW' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE';

export interface DeduplicationResult {
    status: DeduplicationStatus;
    existingId?: string;
    evidence?: string;
}

export class ArticleDeduplicator {
    public static check(incoming: NewsArticle, existingArticles: NewsArticle[]): DeduplicationResult {
        // 1. Exact ID match (Strongest)
        const exactMatch = existingArticles.find(a => a.id === incoming.id);
        if (exactMatch) {
            return {
                status: 'DUPLICATE',
                existingId: exactMatch.id,
                evidence: 'Exact Identity Match'
            };
        }

        // 2. URL Match (Direct)
        const incomingUrl = incoming.sourceUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
        const urlMatch = existingArticles.find(a => {
            const aUrl = a.sourceUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
            return aUrl === incomingUrl && aUrl.length > 15;
        });

        if (urlMatch) {
            return {
                status: 'DUPLICATE',
                existingId: urlMatch.id,
                evidence: 'Canonical URL Match'
            };
        }

        // 3. Fuzzy Headline Match (Weak)
        const incomingHeadline = incoming.headline.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const headlineMatch = existingArticles.find(a => {
            const aHeadline = a.headline.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return aHeadline === incomingHeadline && aHeadline.length > 20;
        });

        if (headlineMatch) {
            return {
                status: 'POSSIBLE_DUPLICATE',
                existingId: headlineMatch.id,
                evidence: 'Exact Normalized Headline Match'
            };
        }

        return { status: 'NEW' };
    }
}
