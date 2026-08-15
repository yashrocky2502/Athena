import { NewsArticle } from '../types/Article.ts';
import { INewsStore } from '../storage/NewsStore.ts';

export interface FeedResponse {
    articles: NewsArticle[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
}

export class NewsFeedService {
    constructor(private store: INewsStore) {}

    public async getFeed(options: {
        category?: string;
        symbol?: string;
        page?: number;
        limit?: number;
    }): Promise<FeedResponse> {
        const { category = 'All', symbol, page = 1, limit = 20 } = options;
        
        let articles: NewsArticle[];
        if (symbol) {
            articles = await this.store.findBySymbol(symbol);
        } else {
            articles = await this.store.findByCategory(category);
        }

        const totalCount = articles.length;
        const totalPages = Math.ceil(totalCount / limit);
        const safePage = Math.max(1, Math.min(page, totalPages || 1));
        
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
