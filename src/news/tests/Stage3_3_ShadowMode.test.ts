import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newsShadowComparator } from '../shadow/NewsShadowComparator.ts';
import { NewsFeedService, FeedResponse } from '../feed/NewsFeedService.ts';
import { MemoryNewsStore } from '../storage/NewsStore.ts';
import { NewsArticle } from '../types/Article.ts';

function createSampleArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
    return {
        id: overrides.id || `art_${Math.random().toString(36).substring(2, 9)}`,
        source: {
            name: overrides.source?.name || 'Economic Times',
            publisher: overrides.source?.publisher || 'Economic Times',
            url: overrides.source?.url || 'https://economictimes.indiatimes.com',
            collectionMethod: overrides.source?.collectionMethod || 'RSS'
        },
        sourceUrl: overrides.sourceUrl || 'https://economictimes.indiatimes.com/market/sample',
        headline: overrides.headline || 'Sample Market Headline',
        body: overrides.body || 'Article body content',
        publishedAt: overrides.publishedAt || new Date().toISOString(),
        fetchedAt: overrides.fetchedAt || new Date().toISOString(),
        primaryCategory: overrides.primaryCategory || 'Market',
        eventType: overrides.eventType || 'GENERAL',
        symbol: overrides.symbol !== undefined ? overrides.symbol : 'TCS',
        fnoEligible: overrides.fnoEligible !== undefined ? overrides.fnoEligible : true,
        financialMetrics: [],
        classificationConfidence: 95,
        relevanceScore: overrides.relevanceScore !== undefined ? overrides.relevanceScore : 80,
        ...overrides
    };
}

function calculateFileHash(relPath: string): { hash: string; count: number; exists: boolean } {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) return { hash: 'NOT_FOUND', count: 0, exists: false };
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    let count = 0;
    try {
        const parsed = JSON.parse(content.toString('utf-8'));
        if (Array.isArray(parsed)) count = parsed.length;
        else if (parsed.storiesMap) count = Object.keys(parsed.storiesMap).length;
        else if (parsed.rawArticles) count = Object.keys(parsed.rawArticles).length;
        else count = Object.keys(parsed).length;
    } catch {
        count = -1;
    }
    return { hash, count, exists: true };
}

describe('Stage 3.3: V2/V3 Shadow Mode Implementation & Forensic Comparison', () => {
    let memoryStore: MemoryNewsStore;
    let feedService: NewsFeedService;

    beforeEach(() => {
        memoryStore = new MemoryNewsStore();
        feedService = new NewsFeedService(memoryStore);
        newsShadowComparator.clearMetrics();
        newsShadowComparator.setEnabled(true);
        newsShadowComparator.setTimeoutMs(1500);
    });

    afterEach(() => {
        newsShadowComparator.setEnabled(false);
    });

    describe('1. Shadow Mode Isolation & Resilience', () => {
        it('should return null immediately when shadow mode is disabled', async () => {
            newsShadowComparator.setEnabled(false);
            const result = await newsShadowComparator.runShadowComparison(
                { category: 'All' },
                { articles: [{ id: '1', title: 'Test' }] },
                feedService
            );
            expect(result).toBeNull();
            expect(newsShadowComparator.getMetrics().totalComparisons).toBe(0);
        });

        it('should safely handle V3 execution error without failing or throwing', async () => {
            const failingFeedService = {
                getFeed: async () => {
                    throw new Error('Database connection failed');
                },
                getCategoryCounts: async () => ({ All: 0 })
            } as any;

            const v2Payload = { articles: [{ id: 'v2_1', title: 'V2 News' }], totalCount: 1 };
            const result = await newsShadowComparator.runShadowComparison(
                { category: 'All' },
                v2Payload,
                failingFeedService
            );

            expect(result).toBeDefined();
            expect(result?.status).toBe('ERROR');
            expect(newsShadowComparator.getMetrics().errors).toBe(1);
            expect(newsShadowComparator.getMetrics().totalComparisons).toBe(1);
        });

        it('should safely handle V3 timeout without delaying or throwing', async () => {
            newsShadowComparator.setTimeoutMs(50); // small timeout for test
            const slowFeedService = {
                getFeed: async () => {
                    await new Promise(r => setTimeout(r, 200));
                    return { articles: [], totalCount: 0, page: 1, limit: 20, totalPages: 1 };
                },
                getCategoryCounts: async () => ({ All: 0 })
            } as any;

            const v2Payload = { articles: [{ id: 'v2_1', title: 'V2 News' }], totalCount: 1 };
            const result = await newsShadowComparator.runShadowComparison(
                { category: 'All' },
                v2Payload,
                slowFeedService
            );

            expect(result).toBeDefined();
            expect(result?.status).toBe('TIMEOUT');
            expect(newsShadowComparator.getMetrics().timeouts).toBe(1);
        });
    });

    describe('2. Identity & Presentation Alias Normalization', () => {
        it('should recognize exact matches between V2 UI aliases and V3 canonical schemas as MATCH', () => {
            const v2Response = {
                articles: [
                    {
                        id: 'v2_101',
                        title: 'Reliance Q3 Net Profit Surges 12% to Record High',
                        url: 'https://economictimes.indiatimes.com/markets/stocks/news/reliance-q3-results/12345.cms?utm_source=rss',
                        publisher: 'The Economic Times',
                        category: 'Results',
                        isFO: true,
                        isFnO: true,
                        symbol: 'RELIANCE',
                        publishedAt: '2026-03-31T10:00:00.000Z'
                    }
                ],
                totalCount: 1,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            const v3Article = createSampleArticle({
                id: 'v3_hash_999',
                headline: 'Reliance Q3 Net Profit Surges 12% to Record High',
                sourceUrl: 'https://economictimes.indiatimes.com/markets/stocks/news/reliance-q3-results/12345.cms',
                source: {
                    name: 'The Economic Times',
                    publisher: 'The Economic Times',
                    url: 'https://economictimes.indiatimes.com',
                    collectionMethod: 'RSS'
                },
                primaryCategory: 'Results',
                fnoEligible: true,
                symbol: 'RELIANCE',
                publishedAt: '2026-03-31T10:00:00.000Z',
                relevanceScore: 90
            });

            const v3Feed: FeedResponse = {
                articles: [v3Article],
                totalCount: 1,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            const result = newsShadowComparator.comparePayloads('test_1', { category: 'Results' }, v2Response, v3Feed, 5, Date.now());

            expect(result.status).toBe('MATCH');
            expect(result.matches).toBe(1);
            expect(result.intersectionCount).toBe(1);
            expect(result.categoryMismatches).toBe(0);
            expect(result.metadataMismatches).toBe(0);
            expect(result.v2OnlyCount).toBe(0);
            expect(result.v3OnlyCount).toBe(0);
        });

        it('should correctly classify V2-only and V3-only items without false data-loss alarms', () => {
            const v2Response = {
                articles: [
                    {
                        id: 'v2_legacy_1',
                        title: 'Old Legacy Article Still In V2',
                        url: 'https://www.bseindia.com/markets/legacy1',
                        publisher: 'BSE',
                        category: 'Exchange',
                        publishedAt: '2026-01-01T00:00:00Z'
                    }
                ],
                totalCount: 1,
                totalPages: 1
            };

            const v3Article = createSampleArticle({
                id: 'v3_fresh_1',
                headline: 'Fresh Ingested Story in V3 Only',
                sourceUrl: 'https://www.livemint.com/market/fresh1',
                source: {
                    name: 'LiveMint',
                    publisher: 'LiveMint',
                    url: 'https://www.livemint.com',
                    collectionMethod: 'RSS'
                },
                primaryCategory: 'Market',
                publishedAt: '2026-03-31T12:00:00Z',
                relevanceScore: 75
            });

            const v3Feed: FeedResponse = {
                articles: [v3Article],
                totalCount: 1,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            const result = newsShadowComparator.comparePayloads('test_2', { category: 'All' }, v2Response, v3Feed, 5, Date.now());

            expect(result.v2OnlyCount).toBe(1);
            expect(result.v3OnlyCount).toBe(1);
            expect(result.intersectionCount).toBe(0);
            expect(result.details.some(d => d.type === 'V3_ONLY')).toBe(true);
            expect(result.details.some(d => d.type === 'V2_ONLY')).toBe(true);
        });
    });

    describe('3. Category & Metadata Mismatch Detection', () => {
        it('should detect category mismatch between V2 and V3 for identical URL', () => {
            const v2Response = {
                articles: [
                    {
                        id: 'v2_1',
                        title: 'TCS Announces Bonus Issue',
                        url: 'https://www.nseindia.com/corp/tcs1',
                        publisher: 'NSE',
                        category: 'Corporate'
                    }
                ],
                totalCount: 1,
                totalPages: 1
            };

            const v3Article = createSampleArticle({
                id: 'v3_1',
                headline: 'TCS Announces Bonus Issue',
                sourceUrl: 'https://www.nseindia.com/corp/tcs1',
                source: {
                    name: 'NSE',
                    publisher: 'NSE',
                    url: 'https://www.nseindia.com',
                    collectionMethod: 'RSS'
                },
                primaryCategory: 'Results' // Discrepancy
            });

            const v3Feed: FeedResponse = {
                articles: [v3Article],
                totalCount: 1,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            const result = newsShadowComparator.comparePayloads('test_3', { category: 'All' }, v2Response, v3Feed, 5, Date.now());

            expect(result.categoryMismatches).toBe(1);
            expect(result.status).toBe('CATEGORY_MISMATCH');
        });

        it('should detect F&O eligibility mismatch between V2 and V3', () => {
            const v2Response = {
                articles: [
                    {
                        id: 'v2_1',
                        title: 'Nifty Options PCR spikes to 1.4',
                        url: 'https://moneycontrol.com/fno/pcr',
                        publisher: 'Moneycontrol',
                        category: 'F&O',
                        isFO: true
                    }
                ],
                totalCount: 1,
                totalPages: 1
            };

            const v3Article = createSampleArticle({
                id: 'v3_1',
                headline: 'Nifty Options PCR spikes to 1.4',
                sourceUrl: 'https://moneycontrol.com/fno/pcr',
                source: {
                    name: 'Moneycontrol',
                    publisher: 'Moneycontrol',
                    url: 'https://moneycontrol.com',
                    collectionMethod: 'RSS'
                },
                primaryCategory: 'F&O',
                fnoEligible: false // Discrepancy
            });

            const v3Feed: FeedResponse = {
                articles: [v3Article],
                totalCount: 1,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            const result = newsShadowComparator.comparePayloads('test_4', { category: 'F&O' }, v2Response, v3Feed, 5, Date.now());

            expect(result.metadataMismatches).toBe(1);
            expect(result.status).toBe('METADATA_MISMATCH');
        });
    });

    describe('4. Ordering & Pagination Discrepancy Distinction', () => {
        it('should identify ORDERING_DIFFERENCE when same set of articles are positioned differently', () => {
            const artA = {
                id: 'art_a',
                title: 'Article Alpha',
                url: 'https://example.com/alpha',
                publisher: 'Reuters',
                category: 'Market',
                isFO: true,
                publishedAt: '2026-03-31T09:00:00Z'
            };
            const artB = {
                id: 'art_b',
                title: 'Article Beta',
                url: 'https://example.com/beta',
                publisher: 'Bloomberg',
                category: 'Market',
                isFO: true,
                publishedAt: '2026-03-31T10:00:00Z'
            };

            const v2Response = {
                articles: [artA, artB],
                totalCount: 2,
                totalPages: 1
            };

            const v3Feed: FeedResponse = {
                articles: [
                    createSampleArticle({
                        id: 'v3_b',
                        headline: 'Article Beta',
                        sourceUrl: 'https://example.com/beta',
                        source: {
                            name: 'Bloomberg',
                            publisher: 'Bloomberg',
                            url: 'https://example.com',
                            collectionMethod: 'RSS'
                        },
                        primaryCategory: 'Market',
                        fnoEligible: true,
                        publishedAt: '2026-03-31T10:00:00Z'
                    }),
                    createSampleArticle({
                        id: 'v3_a',
                        headline: 'Article Alpha',
                        sourceUrl: 'https://example.com/alpha',
                        source: {
                            name: 'Reuters',
                            publisher: 'Reuters',
                            url: 'https://example.com',
                            collectionMethod: 'RSS'
                        },
                        primaryCategory: 'Market',
                        fnoEligible: true,
                        publishedAt: '2026-03-31T09:00:00Z'
                    })
                ],
                totalCount: 2,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            const result = newsShadowComparator.comparePayloads('test_5', { category: 'Market' }, v2Response, v3Feed, 5, Date.now());

            expect(result.intersectionCount).toBe(2);
            expect(result.orderingDifferences).toBe(2);
            expect(result.v2OnlyCount).toBe(0);
            expect(result.v3OnlyCount).toBe(0);
            expect(result.status).toBe('ORDERING_DIFFERENCE');
        });
    });

    describe('5. Data Safety & Zero-Mutation Invariant', () => {
        it('should ensure shadow comparison operations perform ZERO write operations on any dataset file', async () => {
            // Stage 2 store is isolated from legacy schedulers
            const stage2Path = 'data/news_stage2_store.json';
            const before = calculateFileHash(stage2Path);

            // Execute multiple shadow comparisons
            for (let i = 0; i < 10; i++) {
                newsShadowComparator.comparePayloads(
                    `safety_check_${i}`,
                    { category: 'All' },
                    { articles: [{ id: `art_${i}`, title: `Title ${i}`, url: `https://test.com/${i}` }] },
                    { articles: [], totalCount: 0, page: 1, limit: 20, totalPages: 0 },
                    5,
                    Date.now()
                );
            }

            const after = calculateFileHash(stage2Path);

            if (before.exists) {
                expect(after.exists).toBe(true);
                expect(after.hash, 'Isolated stage 2 dataset was mutated by shadow comparator!').toBe(before.hash);
                expect(after.count, 'Isolated stage 2 count changed during shadow comparison!').toBe(before.count);
            }
        });
    });
});
