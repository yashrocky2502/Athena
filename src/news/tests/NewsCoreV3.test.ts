import { expect, test, describe, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MemoryNewsStore } from '../storage/NewsStore.ts';
import { IngestionPipeline } from '../ingestion/IngestionPipeline.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';
import { ArticleNormalizer } from '../normalization/ArticleNormalizer.ts';

describe('ATHENA News Core V3 - Parallel Build Verification', () => {
    let store: MemoryNewsStore;
    let pipeline: IngestionPipeline;
    let feed: NewsFeedService;

    beforeEach(() => {
        store = new MemoryNewsStore();
        pipeline = new IngestionPipeline(store);
        feed = new NewsFeedService(store);
    });

    test('Full Ingestion Pipeline - Results & Crypto', async () => {
        const resultsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/results.json'), 'utf-8'));
        const cryptoRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/crypto.json'), 'utf-8'));

        const resultsOut = await pipeline.ingest(resultsRaw, 'Google News');
        const cryptoOut = await pipeline.ingest(cryptoRaw, 'Crypto News');

        expect(resultsOut.saved).toBe(2);
        expect(cryptoOut.saved).toBe(2);
        expect(await store.count()).toBe(4);

        const all = await store.getAll();
        
        // Verify Classification
        const reliance = all.find(a => a.headline.includes('Reliance'));
        expect(reliance?.primaryCategory).toBe('Results');
        expect(reliance?.sentiment).toBe('BULLISH');

        const bitcoin = all.find(a => a.headline.includes('Bitcoin'));
        expect(bitcoin?.primaryCategory).toBe('Crypto');
    });

    test('Identity Determinism & Deduplication', async () => {
        const resultsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/results.json'), 'utf-8'));
        
        // First Ingestion
        await pipeline.ingest(resultsRaw, 'Source A');
        const count1 = await store.count();

        // Second Ingestion (Exact Same Data)
        const out2 = await pipeline.ingest(resultsRaw, 'Source B');
        const count2 = await store.count();

        expect(count1).toBe(2);
        expect(out2.duplicates).toBe(2);
        expect(count2).toBe(2); // Should not increase
    });

    test('Feed Filtering & Pagination', async () => {
        const resultsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/results.json'), 'utf-8'));
        const cryptoRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/crypto.json'), 'utf-8'));

        await pipeline.ingest(resultsRaw, 'Source A');
        await pipeline.ingest(cryptoRaw, 'Source B');

        // Test Category Filter
        const cryptoFeed = await feed.getFeed({ category: 'Crypto' });
        expect(cryptoFeed.articles.length).toBe(2);
        expect(cryptoFeed.articles.every(a => a.primaryCategory === 'Crypto')).toBe(true);

        // Test All Feed
        const allFeed = await feed.getFeed({ limit: 3 });
        expect(allFeed.articles.length).toBe(3);
        expect(allFeed.totalCount).toBe(4);
        expect(allFeed.totalPages).toBe(2);

        // Test Page 2
        const page2 = await feed.getFeed({ limit: 3, page: 2 });
        expect(page2.articles.length).toBe(1);
        expect(page2.page).toBe(2);
    });

    test('Normalization Resilience', () => {
        const malformed = {
            title: '  <b>Dirty</b> headline with CDATA <![CDATA[ content ]]>  ',
            url: 'https://example.com/test-url?query=123',
            content: 'Clean this content'
        };

        const normalized = ArticleNormalizer.normalize(malformed, 'Test', 'RSS');
        expect(normalized.headline).toBe('Dirty headline with CDATA content');
        expect(normalized.sourceUrl).toBe('https://example.com/test-url?query=123');
    });

    test('Stable Identity Generation', () => {
        const art1 = {
            sourceUrl: 'https://NEWS.google.com/rss/articles/123?oc=5',
            headline: 'Test Headline!!!',
            source: { name: 'GNews', url: '...' },
            publishedAt: '2026-08-15T10:00:00Z'
        } as any;

        const id1 = ArticleIdentity.generateId(art1);
        
        const art2 = {
            sourceUrl: 'https://news.google.com/rss/articles/123',
            headline: '  test headline  ',
            source: { name: 'gnews', url: '...' },
            publishedAt: '2026-08-15T10:00:00Z'
        } as any;

        const id2 = ArticleIdentity.generateId(art2);
        expect(id1).toBe(id2);
    });
});
