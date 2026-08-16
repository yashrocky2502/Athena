import { NewsArticle } from '../types/Article.ts';
import { INewsStore } from '../storage/NewsStore.ts';

export interface FeedResponse {
    articles: NewsArticle[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    categoryCounts?: Record<string, number>;
}

export interface FeedOptions {
    category?: string;
    symbol?: string;
    page?: number;
    limit?: number;
    sort?: 'latest' | 'relevance';
}

const CANONICAL_CATEGORIES = [
    'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy',
    'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
];

export class NewsFeedService {
    constructor(private store: INewsStore) {}

    public async getCategoryCounts(): Promise<Record<string, number>> {
        const all = await this.store.getAll();
        const counts: Record<string, number> = {
            'All': all.length,
            'Results': 0,
            'Crypto': 0,
            'IPO': 0,
            'F&O': 0,
            'Economy': 0,
            'Market': 0,
            'Corporate': 0,
            'Commodities': 0,
            'Global': 0,
            'Technology': 0,
            'Exchange': 0
        };

        for (const art of all) {
            if (art.primaryCategory === 'F&O' || art.fnoEligible === true) {
                counts['F&O']++;
            }
            const cat = art.primaryCategory;
            if (cat === 'Market' || cat === 'Markets') {
                counts['Market']++;
            } else if (counts[cat] !== undefined && cat !== 'F&O') {
                counts[cat]++;
            }
        }
        return counts;
    }

    public async getFeed(options: FeedOptions = {}): Promise<FeedResponse> {
        const category = options.category || 'All';
        const symbol = options.symbol;
        const rawPage = parseInt(options.page as any, 10);
        const page = (!rawPage || rawPage <= 0) ? 1 : rawPage;
        const rawLimit = parseInt(options.limit as any, 10);
        const limit = (!rawLimit || rawLimit <= 0) ? 20 : Math.min(100, Math.max(1, rawLimit));
        const sort = options.sort === 'relevance' ? 'relevance' : 'latest';
        
        let articles: NewsArticle[] = await this.store.findByCategory(category);

        if (symbol && symbol.trim().length > 0) {
            const symUpper = symbol.trim().toUpperCase();
            articles = articles.filter(a => a.symbol?.toUpperCase() === symUpper);
        }

        // Apply deterministic sorting
        if (sort === 'relevance') {
            articles.sort((a, b) => {
                const diff = (b.relevanceScore || 50) - (a.relevanceScore || 50);
                if (diff !== 0) return diff;
                const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                return a.id.localeCompare(b.id);
            });
        } else {
            articles.sort((a, b) => {
                const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                return a.id.localeCompare(b.id);
            });
        }

        const totalCount = articles.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const effectivePage = Math.min(page, totalPages);
        
        const start = (effectivePage - 1) * limit;
        const pagedArticles = articles.slice(start, start + limit).map(art => ({
            ...art,
            title: art.headline,
            url: art.sourceUrl || art.source?.url || '',
            publisher: art.source?.publisher || art.source?.name || 'Financial Wire',
            category: art.primaryCategory,
            isFO: art.fnoEligible,
            isFnO: art.fnoEligible,
            fnoSymbol: art.symbol,
            summary: art.intelligence?.summary || art.body,
            cleanBody: art.body,
            fullArticleBody: art.body
        }));

        const categoryCounts = await this.getCategoryCounts();

        return {
            articles: pagedArticles,
            totalCount,
            page: effectivePage,
            limit,
            totalPages,
            categoryCounts
        };
    }
}


