import { NewsArticle } from '../types/Article.ts';

export interface INewsStore {
    insert(article: NewsArticle): Promise<void>;
    insertMany(articles: NewsArticle[]): Promise<void>;
    getById(id: string): Promise<NewsArticle | null>;
    getAll(): Promise<NewsArticle[]>;
    count(): Promise<number>;
    findByCategory(category: string): Promise<NewsArticle[]>;
    findBySymbol(symbol: string): Promise<NewsArticle[]>;
}

export class MemoryNewsStore implements INewsStore {
    private articles: Map<string, NewsArticle> = new Map();

    public async insert(article: NewsArticle): Promise<void> {
        this.articles.set(article.id, article);
    }

    public async insertMany(articles: NewsArticle[]): Promise<void> {
        for (const art of articles) {
            this.articles.set(art.id, art);
        }
    }

    public async getById(id: string): Promise<NewsArticle | null> {
        return this.articles.get(id) || null;
    }

    public async getAll(): Promise<NewsArticle[]> {
        return Array.from(this.articles.values()).sort((a, b) => 
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
    }

    public async count(): Promise<number> {
        return this.articles.size;
    }

    public async findByCategory(category: string): Promise<NewsArticle[]> {
        const all = await this.getAll();
        if (category.toLowerCase() === 'all') return all;
        return all.filter(a => a.primaryCategory.toLowerCase() === category.toLowerCase());
    }

    public async findBySymbol(symbol: string): Promise<NewsArticle[]> {
        const all = await this.getAll();
        return all.filter(a => a.symbol?.toLowerCase() === symbol.toLowerCase());
    }

    // Diagnostic method - not part of interface
    public clear(): void {
        this.articles.clear();
    }
}
