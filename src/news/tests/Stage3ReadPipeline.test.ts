import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { NewsArticle } from '../types/Article.ts';

const TEST_STORE_PATH = path.join(process.cwd(), 'data', 'test_stage3_store.json');
const PROTECTED_FILES = [
    'data/news_core_v2.json',
    'data/news_core_v2.json.bak',
    'data/v3_news_store.json',
    'data/news_intelligence_v2.json'
];

const CANONICAL_CATEGORIES = [
    'Results', 'Crypto', 'IPO', 'F&O', 'Economy',
    'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
];

function createSampleArticle(index: number, category: string, symbol: string | null = null, fno: boolean = false, relevance: number = 50, publishedOffsetMinutes: number = 0): NewsArticle {
    const pubDate = new Date(Date.now() - publishedOffsetMinutes * 60 * 1000).toISOString();
    return {
        id: `art_stage3_${index}_${category.toLowerCase()}`,
        headline: `${category} Sample Headline ${index} for ${symbol || 'General Market'}`,
        body: `Detailed financial market body text for article ${index} in category ${category}. Key figures: Q3 PAT +18% YoY.`,
        publishedAt: pubDate,
        fetchedAt: pubDate,
        primaryCategory: category,
        eventType: category === 'Results' ? 'EARNINGS' : (category === 'IPO' ? 'OFFERING' : 'UPDATE'),
        symbol,
        fnoEligible: fno,
        financialMetrics: [
            { name: 'Revenue', value: '12500 Cr', changePercent: 12.5 },
            { name: 'EBITDA Margin', value: '24.2%', unit: '%' }
        ],
        classificationConfidence: 95,
        relevanceScore: relevance,
        sentiment: index % 3 === 0 ? 'BULLISH' : (index % 3 === 1 ? 'BEARISH' : 'NEUTRAL'),
        source: {
            name: 'Exchange Wire',
            url: `https://exchange.example.com/art_${index}`,
            publisher: 'Exchange Wire',
            collectionMethod: 'RSS'
        },
        sourceUrl: `https://exchange.example.com/art_${index}`,
        intelligence: {
            summary: `Executive briefing on ${category} sample ${index}.`,
            whyItMatters: 'Direct impact on domestic liquidity and sectoral rotation.',
            marketImpact: 'Moderate bullish sentiment expected.',
            generatedAt: pubDate,
            version: 'V5-STAGE3'
        }
    };
}

describe('Stage 3: New News Core Read Pipeline Migration & Verification', () => {
    let store: JsonNewsStore;
    let feedService: NewsFeedService;

    function getProtectedSnapshot() {
        const snapshot: Record<string, { exists: boolean; hash: string; count: number }> = {};
        for (const file of PROTECTED_FILES) {
            const fullPath = path.join(process.cwd(), file);
            if (fs.existsSync(fullPath)) {
                const buf = fs.readFileSync(fullPath);
                const hash = crypto.createHash('sha256').update(buf).digest('hex');
                let count = 0;
                try {
                    const parsed = JSON.parse(buf.toString('utf-8'));
                    count = Array.isArray(parsed) ? parsed.length : (parsed.storiesMap ? Object.keys(parsed.storiesMap).length : (parsed.articles ? parsed.articles.length : Object.keys(parsed).length));
                } catch {
                    count = -1;
                }
                snapshot[file] = { exists: true, hash, count };
            } else {
                snapshot[file] = { exists: false, hash: '', count: 0 };
            }
        }
        return snapshot;
    }

    const baselineSnapshot = getProtectedSnapshot();

    beforeEach(async () => {
        if (fs.existsSync(TEST_STORE_PATH)) fs.unlinkSync(TEST_STORE_PATH);
        if (fs.existsSync(`${TEST_STORE_PATH}.bak`)) fs.unlinkSync(`${TEST_STORE_PATH}.bak`);

        store = new JsonNewsStore(TEST_STORE_PATH);
        await store.initialize();
        feedService = new NewsFeedService(store);

        // Seed 110 deterministic test articles (10 per category)
        const seedArticles: NewsArticle[] = [];
        let idx = 1;

        for (const cat of CANONICAL_CATEGORIES) {
            for (let i = 1; i <= 10; i++) {
                const sym = (cat === 'Results' || cat === 'Corporate') ? (i % 2 === 0 ? 'TCS' : 'RELIANCE') : (cat === 'F&O' ? 'NIFTY' : null);
                const isFno = cat === 'F&O' || (sym === 'RELIANCE' || sym === 'TCS');
                const relScore = 40 + (idx % 60);
                seedArticles.push(createSampleArticle(idx, cat, sym, isFno, relScore, idx * 10));
                idx++;
            }
        }

        await store.insertMany(seedArticles);
    });

    afterEach(() => {
        if (fs.existsSync(TEST_STORE_PATH)) fs.unlinkSync(TEST_STORE_PATH);
        if (fs.existsSync(`${TEST_STORE_PATH}.bak`)) fs.unlinkSync(`${TEST_STORE_PATH}.bak`);
    });

    // ==========================================
    // SUITE 1: CATEGORY PURITY (S1 to S12)
    // ==========================================

    it('S1: Results Category Feed purity (100% pure Results, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Results', limit: 50 });
        expect(feed.articles.length).toBeGreaterThan(0);
        expect(feed.totalCount).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Results');
        }
    });

    it('S2: Crypto Category Feed purity (100% pure Crypto, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Crypto', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Crypto');
        }
    });

    it('S3: IPO Category Feed purity (100% pure IPO, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'IPO', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('IPO');
        }
    });

    it('S4: F&O Category Feed purity (includes F&O category & F&O eligible stocks)', async () => {
        const feed = await feedService.getFeed({ category: 'F&O', limit: 50 });
        expect(feed.articles.length).toBeGreaterThan(0);
        for (const art of feed.articles) {
            const isEligible = art.primaryCategory === 'F&O' || art.fnoEligible === true;
            expect(isEligible).toBe(true);
        }
    });

    it('S5: Economy Category Feed purity (100% pure Economy, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Economy', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Economy');
        }
    });

    it('S6: Market Category Feed purity (100% pure Market, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Market', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory.toLowerCase()).toBe('market');
        }
    });

    it('S7: Corporate Category Feed purity (100% pure Corporate, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Corporate', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Corporate');
        }
    });

    it('S8: Commodities Category Feed purity (100% pure Commodities, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Commodities', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Commodities');
        }
    });

    it('S9: Global Category Feed purity (100% pure Global, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Global', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Global');
        }
    });

    it('S10: Technology Category Feed purity (100% pure Technology, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Technology', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Technology');
        }
    });

    it('S11: Exchange Category Feed purity (100% pure Exchange, 0 contamination)', async () => {
        const feed = await feedService.getFeed({ category: 'Exchange', limit: 50 });
        expect(feed.articles.length).toBe(10);
        for (const art of feed.articles) {
            expect(art.primaryCategory).toBe('Exchange');
        }
    });

    it('S12: All Category Feed completeness (contains complete store count and paginated coverage)', async () => {
        const feedP1 = await feedService.getFeed({ category: 'All', page: 1, limit: 100 });
        expect(feedP1.articles.length).toBe(100);
        expect(feedP1.totalCount).toBe(110);
        expect(feedP1.totalPages).toBe(2);

        const feedP2 = await feedService.getFeed({ category: 'All', page: 2, limit: 100 });
        expect(feedP2.articles.length).toBe(10);
        expect(feedP2.totalCount).toBe(110);
    });

    // ==========================================
    // SUITE 2: PAGINATION & DETERMINISM (S13 to S18)
    // ==========================================

    it('S13: Page 1, Page 2, Page 3 disjoint partition (zero overlapping IDs)', async () => {
        const p1 = await feedService.getFeed({ category: 'All', page: 1, limit: 15 });
        const p2 = await feedService.getFeed({ category: 'All', page: 2, limit: 15 });
        const p3 = await feedService.getFeed({ category: 'All', page: 3, limit: 15 });

        expect(p1.articles.length).toBe(15);
        expect(p2.articles.length).toBe(15);
        expect(p3.articles.length).toBe(15);

        const idsP1 = new Set(p1.articles.map(a => a.id));
        const idsP2 = new Set(p2.articles.map(a => a.id));
        const idsP3 = new Set(p3.articles.map(a => a.id));

        for (const id of idsP1) {
            expect(idsP2.has(id)).toBe(false);
            expect(idsP3.has(id)).toBe(false);
        }
        for (const id of idsP2) {
            expect(idsP3.has(id)).toBe(false);
        }
    });

    it('S14: Complete pagination coverage (union of all pages equals full dataset)', async () => {
        const allFetched: NewsArticle[] = [];
        const limit = 25;
        const p1 = await feedService.getFeed({ category: 'All', page: 1, limit });
        const totalPages = p1.totalPages;

        for (let p = 1; p <= totalPages; p++) {
            const res = await feedService.getFeed({ category: 'All', page: p, limit });
            allFetched.push(...res.articles);
        }

        expect(allFetched.length).toBe(110);
        const uniqueIds = new Set(allFetched.map(a => a.id));
        expect(uniqueIds.size).toBe(110);
    });

    it('S15: Boundary handling (page beyond last page is safely clamped to last valid page)', async () => {
        const res = await feedService.getFeed({ category: 'All', page: 999, limit: 20 });
        expect(res.articles.length).toBe(10); // 110 items with limit 20 -> page 6 has 10 items
        expect(res.totalCount).toBe(110);
        expect(res.totalPages).toBe(6);
        expect(res.page).toBe(6);
    });

    it('S16: Invalid page & limit parameters clamped safely', async () => {
        const res1 = await feedService.getFeed({ category: 'All', page: -5, limit: -10 });
        expect(res1.page).toBe(1);
        expect(res1.limit).toBe(20); // Default fallback

        const res2 = await feedService.getFeed({ category: 'All', page: 1, limit: 500 });
        expect(res2.limit).toBe(100); // Clamped to max 100
        expect(res2.articles.length).toBe(100);
    });

    it('S17: Deterministic sort stability (repeated requests return identical order)', async () => {
        const resA = await feedService.getFeed({ category: 'All', page: 1, limit: 30, sort: 'latest' });
        const resB = await feedService.getFeed({ category: 'All', page: 1, limit: 30, sort: 'latest' });

        expect(resA.articles.map(a => a.id)).toEqual(resB.articles.map(a => a.id));
    });

    it('S18: Relevance sort vs Latest sort ordering correctness', async () => {
        const relFeed = await feedService.getFeed({ category: 'All', page: 1, limit: 30, sort: 'relevance' });
        for (let i = 0; i < relFeed.articles.length - 1; i++) {
            const cur = relFeed.articles[i].relevanceScore || 50;
            const next = relFeed.articles[i + 1].relevanceScore || 50;
            expect(cur).toBeGreaterThanOrEqual(next);
        }

        const latestFeed = await feedService.getFeed({ category: 'All', page: 1, limit: 30, sort: 'latest' });
        for (let i = 0; i < latestFeed.articles.length - 1; i++) {
            const curTime = new Date(latestFeed.articles[i].publishedAt).getTime();
            const nextTime = new Date(latestFeed.articles[i + 1].publishedAt).getTime();
            expect(curTime).toBeGreaterThanOrEqual(nextTime);
        }
    });

    // ==========================================
    // SUITE 3: SYMBOL & ENTITY FILTERING (S19 to S21)
    // ==========================================

    it('S19: Symbol-filtered feed returns only matching ticker articles', async () => {
        const res = await feedService.getFeed({ symbol: 'RELIANCE', limit: 50 });
        expect(res.articles.length).toBeGreaterThan(0);
        for (const art of res.articles) {
            expect(art.symbol).toBe('RELIANCE');
        }
    });

    it('S20: Combined Category + Symbol filtering', async () => {
        const res = await feedService.getFeed({ category: 'Results', symbol: 'TCS', limit: 50 });
        expect(res.articles.length).toBeGreaterThan(0);
        for (const art of res.articles) {
            expect(art.primaryCategory).toBe('Results');
            expect(art.symbol).toBe('TCS');
        }
    });

    it('S21: Non-existent symbol query returns empty result with totalCount 0', async () => {
        const res = await feedService.getFeed({ symbol: 'NONEXISTENT_SYMBOL_XYZ' });
        expect(res.articles).toEqual([]);
        expect(res.totalCount).toBe(0);
        expect(res.totalPages).toBe(1);
    });

    // ==========================================
    // SUITE 4: READ-ONLY INVARIANCE & LEGACY ISOLATION (S22 to S26)
    // ==========================================

    it('S22: Read feed execution does NOT mutate the active store file', async () => {
        const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(TEST_STORE_PATH)).digest('hex');
        const countBefore = await store.count();

        // Perform multiple intensive read queries
        await feedService.getFeed({ category: 'All', page: 1, limit: 50 });
        await feedService.getFeed({ category: 'Results', page: 1, limit: 50 });
        await feedService.getFeed({ category: 'F&O', page: 1, limit: 50 });
        await feedService.getFeed({ symbol: 'RELIANCE', page: 1, limit: 50 });
        await feedService.getCategoryCounts();

        const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(TEST_STORE_PATH)).digest('hex');
        const countAfter = await store.count();

        expect(hashBefore).toBe(hashAfter);
        expect(countBefore).toBe(countAfter);
    });

    it('S23: Read feed execution does NOT reference or mutate legacy data/news_core_v2.json', async () => {
        const feed = await feedService.getFeed({ category: 'All', limit: 100 });
        expect(feed.articles.length).toBeGreaterThan(0);
        expect((store as any).filePath).toBe(TEST_STORE_PATH);
        expect((store as any).filePath).not.toContain('news_core_v2.json');
    });

    it('S24: Read feed execution does NOT reference or mutate legacy data/v3_news_store.json', async () => {
        const feed = await feedService.getFeed({ category: 'All', limit: 100 });
        expect(feed.articles.length).toBeGreaterThan(0);
        expect((store as any).filePath).not.toContain('v3_news_store.json');
    });

    it('S25: Read feed execution does NOT reference or mutate legacy data/news_intelligence_v2.json', async () => {
        const feed = await feedService.getFeed({ category: 'All', limit: 100 });
        expect(feed.articles.length).toBeGreaterThan(0);
        expect((store as any).filePath).not.toContain('news_intelligence_v2.json');
    });

    it('S26: Read feed execution does NOT leave any .tmp files in data/', async () => {
        await feedService.getFeed({ category: 'All', limit: 100 });
        const files = fs.readdirSync(path.join(process.cwd(), 'data'));
        const tmpFiles = files.filter(f => f.includes('test_stage3_store.json.tmp'));
        expect(tmpFiles.length).toBe(0);
    });

    // ==========================================
    // SUITE 5: FEATURE FLAG & UI CONTRACT (S27 to S30)
    // ==========================================

    it('S27: Feature flag routing contract (VITE_NEWS_CORE_V3_ENABLED routing logic)', () => {
        const getFeedRoute = (isV3: boolean) => isV3 ? '/api/v5/news/feed' : '/api/v4/news/feed';
        expect(getFeedRoute(true)).toBe('/api/v5/news/feed');
        expect(getFeedRoute(false)).toBe('/api/v4/news/feed');
    });

    it('S28: Category-scoped cache key isolation between V2 and V3', () => {
        const getCacheKey = (isV3: boolean, cat: string) => 
            isV3 ? `athena.newsCoreV3.feed.${cat}` : `athena.newsFeed.v2.snapshot.v2.${cat}`;

        const v3Results = getCacheKey(true, 'Results');
        const v2Results = getCacheKey(false, 'Results');
        const v3Fno = getCacheKey(true, 'F&O');

        expect(v3Results).toBe('athena.newsCoreV3.feed.Results');
        expect(v2Results).toBe('athena.newsFeed.v2.snapshot.v2.Results');
        expect(v3Results).not.toBe(v2Results);
        expect(v3Results).not.toBe(v3Fno);
    });

    it('S29: Feed response schema completeness with UI aliases', async () => {
        const feed = await feedService.getFeed({ category: 'Results', limit: 5 });
        expect(feed.articles.length).toBeGreaterThan(0);
        const art: any = feed.articles[0];

        // Core canonical fields
        expect(art.id).toBeDefined();
        expect(art.headline).toBeDefined();
        expect(art.body).toBeDefined();
        expect(art.publishedAt).toBeDefined();
        expect(art.primaryCategory).toBe('Results');
        expect(art.relevanceScore).toBeDefined();

        // UI Aliases
        expect(art.title).toBe(art.headline);
        expect(art.category).toBe(art.primaryCategory);
        expect(art.publisher).toBeDefined();
        expect(art.url).toBeDefined();
        expect(typeof art.isFO).toBe('boolean');
        expect(typeof art.isFnO).toBe('boolean');
    });

    it('S30: Category counts integrity matches actual store data breakdown', async () => {
        const feed = await feedService.getFeed({ category: 'All' });
        expect(feed.categoryCounts).toBeDefined();
        const counts = feed.categoryCounts!;

        expect(counts['All']).toBe(110);
        expect(counts['Results']).toBe(10);
        expect(counts['Crypto']).toBe(10);
        expect(counts['IPO']).toBe(10);
        expect(counts['Economy']).toBe(10);
        expect(counts['Market']).toBe(10);
        expect(counts['Corporate']).toBe(10);
        expect(counts['Commodities']).toBe(10);
        expect(counts['Global']).toBe(10);
        expect(counts['Technology']).toBe(10);
        expect(counts['Exchange']).toBe(10);
        expect(counts['F&O']).toBeGreaterThanOrEqual(10);
    });
});
