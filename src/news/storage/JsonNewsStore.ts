import fs from 'fs';
import path from 'path';
import { NewsArticle } from '../types/Article.ts';
import { INewsStore } from './NewsStore.ts';

export class JsonNewsStore implements INewsStore {
    private filePath: string;
    private backupPath: string;
    private cache: Map<string, NewsArticle> = new Map();
    private writeLock: Promise<void> = Promise.resolve();
    private isInitialized = false;

    constructor(customPath?: string) {
        this.filePath = customPath || path.join(process.cwd(), 'data', 'news_stage2_store.json');
        this.backupPath = `${this.filePath}.bak`;
    }

    /**
     * Initializes the store by ensuring data directory exists and loading existing dataset safely.
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Clean up any stale temp files matching this path
        try {
            const files = fs.readdirSync(dir);
            const prefix = path.basename(this.filePath) + '.tmp.';
            for (const f of files) {
                if (f.startsWith(prefix)) {
                    const fullTempPath = path.join(dir, f);
                    try { fs.unlinkSync(fullTempPath); } catch {}
                }
            }
        } catch {}

        await this.loadFromDisk();
        this.isInitialized = true;
    }

    private async loadFromDisk(): Promise<void> {
        this.cache.clear();

        // 1. Try reading primary file
        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                if (raw.trim().length > 0) {
                    const data = JSON.parse(raw);
                    if (Array.isArray(data)) {
                        for (const item of data) {
                            if (item && item.id) {
                                this.cache.set(item.id, item);
                            }
                        }
                        return;
                    }
                }
            } catch (err: any) {
                console.warn(`[JsonNewsStore] Primary file read failed (${err.message}). Attempting backup recovery...`);
            }
        }

        // 2. Fallback to backup if primary failed or does not exist
        if (fs.existsSync(this.backupPath)) {
            try {
                const rawBak = fs.readFileSync(this.backupPath, 'utf-8');
                if (rawBak.trim().length > 0) {
                    const data = JSON.parse(rawBak);
                    if (Array.isArray(data)) {
                        for (const item of data) {
                            if (item && item.id) {
                                this.cache.set(item.id, item);
                            }
                        }
                        console.info(`[JsonNewsStore] Successfully recovered ${this.cache.size} articles from backup.`);
                        // Resave to primary
                        await this.persistToDisk();
                        return;
                    }
                }
            } catch (err: any) {
                console.error(`[JsonNewsStore] Backup recovery failed (${err.message}). Initializing empty store.`);
            }
        }
    }

    private async serialize<T>(operation: () => Promise<T>): Promise<T> {
        let release: () => void;
        const nextLock = new Promise<void>((resolve) => {
            release = resolve;
        });
        const currentLock = this.writeLock;
        this.writeLock = currentLock.then(() => nextLock);

        await currentLock;
        try {
            return await operation();
        } finally {
            release!();
        }
    }

    private async persistToDisk(): Promise<void> {
        const dir = path.dirname(this.filePath);
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const tempPath = `${this.filePath}.tmp.${process.pid}.${Date.now()}.${randomSuffix}`;

        const articles = Array.from(this.cache.values()).sort((a, b) => 
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        const serialized = JSON.stringify(articles, null, 2);

        // 1. Write to unique temporary file
        const fd = fs.openSync(tempPath, 'w');
        fs.writeFileSync(fd, serialized, 'utf-8');
        fs.fsyncSync(fd);
        fs.closeSync(fd);

        // 2. Backup existing valid primary file
        if (fs.existsSync(this.filePath)) {
            try {
                const existingContent = fs.readFileSync(this.filePath, 'utf-8');
                if (existingContent.trim().length > 0) {
                    fs.writeFileSync(this.backupPath, existingContent, 'utf-8');
                }
            } catch (err: any) {
                console.warn(`[JsonNewsStore] Backup creation warning:`, err.message);
            }
        }

        // 3. Atomic rename temp file to primary file
        fs.renameSync(tempPath, this.filePath);
    }

    public async insert(article: NewsArticle): Promise<void> {
        await this.initialize();
        return this.serialize(async () => {
            // Count-stability / Invariant: Must not lose existing data
            const existingIds = new Set(this.cache.keys());
            this.cache.set(article.id, article);

            // Verify invariant: existingIds subset of new keys
            for (const id of existingIds) {
                if (!this.cache.has(id)) {
                    throw new Error(`[JsonNewsStore] INVARIANT VIOLATION: Existing article ID "${id}" was dropped during insert.`);
                }
            }

            await this.persistToDisk();
        });
    }

    public async insertMany(articles: NewsArticle[]): Promise<void> {
        if (!articles || articles.length === 0) return;
        await this.initialize();
        return this.serialize(async () => {
            const existingIds = new Set(this.cache.keys());
            for (const art of articles) {
                if (art && art.id) {
                    this.cache.set(art.id, art);
                }
            }

            // Verify invariant
            for (const id of existingIds) {
                if (!this.cache.has(id)) {
                    throw new Error(`[JsonNewsStore] INVARIANT VIOLATION: Existing article ID "${id}" was dropped during batch insert.`);
                }
            }

            await this.persistToDisk();
        });
    }

    public async getById(id: string): Promise<NewsArticle | null> {
        await this.initialize();
        return this.cache.get(id) || null;
    }

    public async getAll(): Promise<NewsArticle[]> {
        await this.initialize();
        return Array.from(this.cache.values()).sort((a, b) => 
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
    }

    public async count(): Promise<number> {
        await this.initialize();
        return this.cache.size;
    }

    public async findByCategory(category: string): Promise<NewsArticle[]> {
        const all = await this.getAll();
        if (!category || category.toLowerCase() === 'all') {
            return all;
        }

        const catLower = category.toLowerCase().trim();
        return all.filter(a => {
            const cat = a.primaryCategory ? a.primaryCategory.toLowerCase() : '';
            if (catLower === 'f&o' || catLower === 'fno') {
                return a.primaryCategory === 'F&O' || a.fnoEligible === true;
            }
            if (catLower === 'market' || catLower === 'markets') {
                return cat === 'market' || cat === 'markets';
            }
            return cat === catLower;
        });
    }

    public async findBySymbol(symbol: string): Promise<NewsArticle[]> {
        const all = await this.getAll();
        if (!symbol) return all;
        const symUpper = symbol.toUpperCase().trim();
        return all.filter(a => a.symbol?.toUpperCase() === symUpper);
    }

    /**
     * Clear is ONLY available for sandbox testing instances targeting temporary files.
     */
    public async clearForTestOnly(): Promise<void> {
        return this.serialize(async () => {
            this.cache.clear();
            if (fs.existsSync(this.filePath)) {
                fs.unlinkSync(this.filePath);
            }
            if (fs.existsSync(this.backupPath)) {
                fs.unlinkSync(this.backupPath);
            }
        });
    }
}
