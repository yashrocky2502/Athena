import { NewsArticle } from '../types/Article.ts';
import { INewsStore } from '../storage/NewsStore.ts';

export interface FeedResponse {
    articles: NewsArticle[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface FeedOptions {
    category?: string;
    symbol?: string;
    page?: number;
    limit?: number;
    sort?: 'latest' | 'relevance';
}

export class NewsFeedService {
    constructor(private store: INewsStore) {}

    public async getFeed(options: FeedOptions = {}): Promise<FeedResponse> {
        const {
            category = 'All',
            symbol,
            page = 1,
            limit = 20,
            sort = 'latest'
        } = options;
        
        let articles: NewsArticle[];
        if (symbol) {
            articles = await this.store.findBySymbol(symbol);
        } else {
            articles = await this.store.findByCategory(category);
        }

        // Apply sorting
        if (sort === 'relevance') {
            articles.sort((a, b) => {
                const diff = (b.relevanceScore || 50) - (a.relevanceScore || 50);
                if (diff !== 0) return diff;
                return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
            });
        } else {
            articles.sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
        }

        const totalCount = articles.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const safePage = Math.max(1, Math.min(page, totalPages));
        
        const start = (safePage - 1) * limit;
        const pagedArticles = articles.slice(start, start + limit);

        return {
            articles: pagedArticles,
            totalCount,
            page: safePage,
            limit,
            totalPages
        };
    }
}

