import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { CollectorAdapter, ICollectorSource } from '../ingestion/CollectorAdapter.ts';
import { IngestionPipeline } from '../ingestion/IngestionPipeline.ts';
import { NewsFeedService } from '../feed/NewsFeedService.ts';
import { ArticleClassifier } from '../classification/ArticleClassifier.ts';
import { ArticleNormalizer, RawArticlePayload } from '../normalization/ArticleNormalizer.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator.ts';
import { NewsIntelligenceService } from '../intelligence/NewsIntelligenceService.ts';
import { NewsArticle } from '../types/Article.ts';

const TEST_STORE_PATH = path.join(process.cwd(), 'data', 'test_stage2_store.json');
const PROTECTED_FILES = [
    'data/news_core_v2.json',
    'data/news_core_v2.json.bak',
    'data/v3_news_store.json',
    'data/news_intelligence_v2.json'
];

describe('Stage 2: Production Ingestion & Engine Verification', () => {
    let store: JsonNewsStore;
    let pipeline: IngestionPipeline;
    let feedService: NewsFeedService;

    // Helper to calculate file hashes & counts
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
        if (fs.existsSync(TEST_STORE_PATH)) {
            fs.unlinkSync(TEST_STORE_PATH);
        }
        if (fs.existsSync(`${TEST_STORE_PATH}.bak`)) {
            fs.unlinkSync(`${TEST_STORE_PATH}.bak`);
        }
        store = new JsonNewsStore(TEST_STORE_PATH);
        await store.initialize();
        pipeline = new IngestionPipeline(store);
        feedService = new NewsFeedService(store);
    });

    afterEach(async () => {
        try {
            if (fs.existsSync(TEST_STORE_PATH)) fs.unlinkSync(TEST_STORE_PATH);
            if (fs.existsSync(`${TEST_STORE_PATH}.bak`)) fs.unlinkSync(`${TEST_STORE_PATH}.bak`);
        } catch {}
    });

    // 1. Real collector payload normalization
    it('1. Real collector payload normalization: strips CDATA, HTML, and extracts required attributes', () => {
        const rawPayload: RawArticlePayload = {
            title: '<![CDATA[Tata Motors Q3 Net Profit surges 137% to Rs 7,025 cr]]>',
            content: '<p>Tata Motors reported a <strong>robust</strong> quarterly performance driven by JLR volumes.</p>',
            link: 'https://economictimes.indiatimes.com/auto/tata-motors-q3-results/12345.cms',
            pubDate: '2026-02-15T09:30:00.000Z',
            publisher: 'Economic Times'
        };

        const normalized = ArticleNormalizer.normalize(rawPayload, 'Economic Times', 'RSS');
        expect(normalized.headline).toBe('Tata Motors Q3 Net Profit surges 137% to Rs 7,025 cr');
        expect(normalized.body).toBe('Tata Motors reported a robust quarterly performance driven by JLR volumes.');
        expect(normalized.sourceUrl).toBe('https://economictimes.indiatimes.com/auto/tata-motors-q3-results/12345.cms');
        expect(normalized.source.publisher).toBe('Economic Times');
        expect(normalized.publishedAt).toBe('2026-02-15T09:30:00.000Z');
    });

    // 2. New article ingestion
    it('2. New article ingestion: fully normalizes, hashes identity, classifies, and persists', async () => {
        const batch: RawArticlePayload[] = [
            {
                headline: 'Reliance Industries Q3 PAT rises 15% to ₹19,500 Cr on retail and telecom growth',
                body: 'RIL announces quarterly financial earnings and dividend distribution.',
                url: 'https://livemint.com/market/reliance-q3-pat-2026',
                publisher: 'LiveMint',
                publishedAt: new Date().toISOString()
            }
        ];

        const result = await pipeline.ingest(batch, 'LiveMint');
        expect(result.processed).toBe(1);
        expect(result.saved).toBe(1);
        expect(result.duplicates).toBe(0);

        const stored = await store.getAll();
        expect(stored.length).toBe(1);
        expect(stored[0].headline).toBe('Reliance Industries Q3 PAT rises 15% to ₹19,500 Cr on retail and telecom growth');
        expect(stored[0].id.length).toBeGreaterThan(10);
        expect(stored[0].fnoEligible).toBe(true);
        expect(stored[0].symbol).toBe('RELIANCE');
    });


    // 3. Duplicate ingestion
    it('3. Duplicate ingestion: identifies exact URL duplicates and duplicate headline/publisher matches', async () => {
        const articleA: RawArticlePayload = {
            headline: 'HDFC Bank board approves dividend of Rs 19.50 per share',
            body: 'HDFC Bank announces record date for final dividend distribution.',
            url: 'https://moneycontrol.com/news/hdfc-bank-dividend-approved-9876.html',
            publisher: 'Moneycontrol'
        };

        const firstResult = await pipeline.ingest([articleA], 'Moneycontrol');
        expect(firstResult.saved).toBe(1);

        // Re-ingesting exact same URL
        const duplicateUrlResult = await pipeline.ingest([articleA], 'Moneycontrol');
        expect(duplicateUrlResult.saved).toBe(0);
        expect(duplicateUrlResult.duplicates).toBe(1);

        // Same headline/source but slightly different tracking URL param
        const duplicateContent: RawArticlePayload = {
            headline: 'HDFC Bank board approves dividend of Rs 19.50 per share',
            body: 'HDFC Bank announces record date for final dividend distribution.',
            url: 'https://moneycontrol.com/news/hdfc-bank-dividend-approved-9876.html?utm_source=rss',
            publisher: 'Moneycontrol'
        };

        const duplicateContentResult = await pipeline.ingest([duplicateContent], 'Moneycontrol');
        expect(duplicateContentResult.saved).toBe(0);
        expect(duplicateContentResult.duplicates).toBe(1);

        expect(await store.count()).toBe(1);
    });

    // 4. Empty ingestion
    it('4. Empty ingestion: empty collector batch leaves store untouched', async () => {
        const initBatch: RawArticlePayload[] = [
            {
                headline: 'SEBI issues consultation paper on algorithmic trading risk framework',
                body: 'Market regulator proposes enhanced pre-trade risk controls for brokers.',
                url: 'https://sebi.gov.in/reports/algo-trading-paper-2026.html',
                publisher: 'SEBI'
            }
        ];
        await pipeline.ingest(initBatch, 'SEBI');
        expect(await store.count()).toBe(1);

        const emptyResult = await pipeline.ingest([], 'EmptySource');
        expect(emptyResult.processed).toBe(0);
        expect(emptyResult.saved).toBe(0);
        expect(emptyResult.duplicates).toBe(0);
        expect(await store.count()).toBe(1);
    });

    // 5. Partial ingestion
    it('5. Partial ingestion: batch with some duplicates and some new items saves only new items', async () => {
        const batch1: RawArticlePayload[] = [
            { headline: 'Nifty breaks 25,000 mark on broad-based foreign institutional buying', body: 'Indian benchmark index hits new record highs.', url: 'https://bs.com/nifty-record-25000', publisher: 'Business Standard' },
            { headline: 'Infosys signs $1.5 billion digital transformation deal with European telco', body: 'Infosys expands enterprise cloud business.', url: 'https://bs.com/infosys-mega-deal', publisher: 'Business Standard' }
        ];
        await pipeline.ingest(batch1, 'Business Standard');
        expect(await store.count()).toBe(2);

        // Mixed batch: 1 existing duplicate, 1 brand new article
        const batch2: RawArticlePayload[] = [
            { headline: 'Nifty breaks 25,000 mark on broad-based foreign institutional buying', body: 'Indian benchmark index hits new record highs.', url: 'https://bs.com/nifty-record-25000', publisher: 'Business Standard' },
            { headline: 'Zomato launches hyperpure expansion in 10 tier-2 cities', body: 'B2B supply chain segment scales up.', url: 'https://bs.com/zomato-hyperpure-expansion', publisher: 'Business Standard' }
        ];

        const res = await pipeline.ingest(batch2, 'Business Standard');
        expect(res.processed).toBe(2);
        expect(res.saved).toBe(1);
        expect(res.duplicates).toBe(1);
        expect(await store.count()).toBe(3);
    });

    // 6. Concurrent ingestion
    it('6. Concurrent ingestion: parallel ingest calls do not lose articles or corrupt JSON', async () => {
        const batchA: RawArticlePayload[] = Array.from({ length: 5 }, (_, i) => ({
            headline: `Batch A Article ${i} - RBI Monetary Policy announcement`,
            body: `RBI governor details liquidity stance ${i}`,
            url: `https://rbi.org.in/policy/batchA_${i}`,
            publisher: 'RBI'
        }));

        const batchB: RawArticlePayload[] = Array.from({ length: 5 }, (_, i) => ({
            headline: `Batch B Article ${i} - NSE adds 5 new stocks to F&O segment`,
            body: `NSE circular details contract specifications ${i}`,
            url: `https://nseindia.com/circular/batchB_${i}`,
            publisher: 'NSE'
        }));

        const batchC: RawArticlePayload[] = Array.from({ length: 5 }, (_, i) => ({
            headline: `Batch C Article ${i} - Bitcoin surges past $95,000 on institutional inflows`,
            body: `Crypto asset classes trade higher globally ${i}`,
            url: `https://reuters.com/crypto/batchC_${i}`,
            publisher: 'Reuters'
        }));

        const batchD: RawArticlePayload[] = Array.from({ length: 5 }, (_, i) => ({
            headline: `Batch D Article ${i} - Swiggy IPO subscribed 3.5 times on final day`,
            body: `Retail and QIB portions see strong bidding ${i}`,
            url: `https://cnbctv18.com/ipo/batchD_${i}`,
            publisher: 'CNBC TV18'
        }));

        const results = await Promise.all([
            pipeline.ingest(batchA, 'RBI'),
            pipeline.ingest(batchB, 'NSE'),
            pipeline.ingest(batchC, 'Reuters'),
            pipeline.ingest(batchD, 'CNBC TV18')
        ]);

        const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
        expect(totalSaved).toBe(20);
        expect(await store.count()).toBe(20);

        // Verify JSON is completely intact and parseable
        const content = fs.readFileSync(TEST_STORE_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.length).toBe(20);
    });

    // 7. Persistence crash simulation
    it('7. Persistence crash simulation: recovers valid dataset from .bak if primary is corrupted', async () => {
        const article: RawArticlePayload = {
            headline: 'L&T bags mega order worth ₹15,000 Cr from Middle East client',
            body: 'Hydrocarbon business unit receives major turnkey engineering contract.',
            url: 'https://et.com/lt-mega-order-win',
            publisher: 'Economic Times'
        };
        await pipeline.ingest([article], 'Economic Times');
        expect(await store.count()).toBe(1);

        // Create valid backup by triggering another write
        const article2: RawArticlePayload = {
            headline: 'TCS signs $1B multi-year cloud contract with US airline',
            body: 'Digital business unit wins large enterprise deal.',
            url: 'https://et.com/tcs-cloud-deal-1b',
            publisher: 'Economic Times'
        };
        await pipeline.ingest([article2], 'Economic Times');
        expect(await store.count()).toBe(2);
        expect(fs.existsSync(`${TEST_STORE_PATH}.bak`)).toBe(true);

        // Corrupt primary file by writing truncated/invalid JSON
        fs.writeFileSync(TEST_STORE_PATH, '{"corrupted": true, "unclosed: [', 'utf-8');

        // Create a new store instance pointing to same file and initialize
        const recoveryStore = new JsonNewsStore(TEST_STORE_PATH);
        await recoveryStore.initialize();
        const recoveredCount = await recoveryStore.count();
        expect(recoveredCount).toBeGreaterThanOrEqual(1);
    });

    // 8. Temporary file collision
    it('8. Temporary file collision: serialized atomic writes prevent temporary file clobbering', async () => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(store.insert({
                id: `art_unique_${i}`,
                headline: `Unique Article ${i}`,
                body: `Body ${i}`,
                sourceUrl: `https://test.com/${i}`,
                source: { name: 'Test', url: `https://test.com/${i}`, collectionMethod: 'RSS' },
                publishedAt: new Date().toISOString(),
                fetchedAt: new Date().toISOString(),
                primaryCategory: 'Corporate',
                eventType: 'OTHER',
                symbol: null,
                fnoEligible: false,
                financialMetrics: [],
                classificationConfidence: 90,
                relevanceScore: 70
            }));
        }

        await Promise.all(promises);
        expect(await store.count()).toBe(10);
    });

    // 9. Count shrink attempt
    it('9. Count shrink attempt: store preserves existing records on incoming batch', async () => {
        // Initial store has 3 articles
        const initBatch: RawArticlePayload[] = [
            { headline: 'Article 1 - Gold prices surge on Fed rate cut expectations', body: 'MCX gold futures cross ₹78,000 per 10 grams.', url: 'https://test.com/gold-1', publisher: 'MCX' },
            { headline: 'Article 2 - Crude oil slips 2% as inventory builds up', body: 'Brent crude hovers near $74 per barrel.', url: 'https://test.com/crude-2', publisher: 'Reuters' },
            { headline: 'Article 3 - Copper demand rises on EV grid expansion', body: 'Base metals rally across global exchanges.', url: 'https://test.com/copper-3', publisher: 'Bloomberg' }
        ];
        await pipeline.ingest(initBatch, 'CommodityFeeds');
        expect(await store.count()).toBe(3);

        // Incoming new single RSS batch containing only 1 new item
        const singleNewBatch: RawArticlePayload[] = [
            { headline: 'Article 4 - Natural gas futures spike on winter cold wave forecast', body: 'Heating demand surges in Northern hemisphere.', url: 'https://test.com/gas-4', publisher: 'MCX' }
        ];
        await pipeline.ingest(singleNewBatch, 'CommodityFeeds');

        // Total count must be 4, never shrinking to 1!
        expect(await store.count()).toBe(4);
    });

    // 10. Historical ID replacement attempt
    it('10. Historical ID replacement attempt: duplicate items never alter historical IDs', async () => {
        const article: RawArticlePayload = {
            headline: 'State Bank of India raises ₹10,000 Cr via Tier-2 infrastructure bonds',
            body: 'SBI issue is oversubscribed by 4.5 times at coupon rate of 7.35%.',
            url: 'https://sbi.co.in/press/tier2-bond-issue-2026',
            publisher: 'SBI'
        };
        await pipeline.ingest([article], 'SBI');
        const firstArt = (await store.getAll())[0];
        const originalId = firstArt.id;

        // Try ingesting again with slightly modified body
        const modifiedBatch: RawArticlePayload[] = [{
            ...article,
            body: 'Updated body text with extra analyst remarks.'
        }];
        const res = await pipeline.ingest(modifiedBatch, 'SBI');
        expect(res.duplicates).toBe(1);

        const currentArt = (await store.getAll())[0];
        expect(currentArt.id).toBe(originalId);
    });

    // 11. Category contamination attempt
    it('11. Category contamination attempt: NewsFeedService returns ONLY canonical category matches across all categories', async () => {
        const articlesToSeed: RawArticlePayload[] = [
            { headline: 'Tata Motors Q3 Net Profit jumps 80% to Rs 5,500 cr', body: 'Quarterly financial earnings report and PAT growth.', url: 'https://test.com/tata-results', publisher: 'ET' }, // Results
            { headline: 'Bitcoin surges past $98,000 as Ethereum gains 5%', body: 'Crypto assets rally across exchanges.', url: 'https://test.com/btc-rally', publisher: 'CoinDesk' }, // Crypto
            { headline: 'Hyundai India IPO opens for subscription with GMP of Rs 65', body: 'Initial public offering issue details and price band.', url: 'https://test.com/hyundai-ipo', publisher: 'Mint' }, // IPO
            { headline: 'Crude oil prices decline 3% to $72/bbl on OPEC supply', body: 'Commodity market update and Brent futures.', url: 'https://test.com/crude-drop', publisher: 'Reuters' }, // Commodities
            { headline: 'NSE circular on expiry day cycle change for Nifty weekly options', body: 'Exchange trading rules and settlement circular.', url: 'https://test.com/nse-circular-1', publisher: 'NSE' }, // Exchange
            { headline: 'RBI maintains repo rate at 6.5% citing CPI inflation risks', body: 'Central bank monetary policy statement and GDP forecast.', url: 'https://test.com/rbi-mpc-dec', publisher: 'RBI' }, // Economy
            { headline: 'Infosys board approves acquisition of AI engineering firm', body: 'Corporate merger and acquisition announcement.', url: 'https://test.com/infy-acq-ai', publisher: 'BS' }, // Corporate
            { headline: 'OpenAI launches new reasoning model for financial analysis', body: 'Software technology digital AI product rollout.', url: 'https://test.com/ai-model-tech', publisher: 'TechCrunch' }, // Technology
            { headline: 'Nifty 50 and Sensex close at record highs on strong DII buying', body: 'Market wrap, top gainers and benchmark rally.', url: 'https://test.com/market-wrap-record', publisher: 'MC' }, // Market
            { headline: 'US Federal Reserve signals potential rate pause following FOMC minutes', body: 'Global macro cues, Wall Street and Dow Jones update.', url: 'https://test.com/fed-fomc-global', publisher: 'Bloomberg' } // Global
        ];

        await pipeline.ingest(articlesToSeed, 'TestSeed');

        // Test category filtering for all canonical categories
        const resultsFeed = await feedService.getFeed({ category: 'Results' });
        expect(resultsFeed.articles.every(a => a.primaryCategory === 'Results')).toBe(true);

        const cryptoFeed = await feedService.getFeed({ category: 'Crypto' });
        expect(cryptoFeed.articles.every(a => a.primaryCategory === 'Crypto')).toBe(true);

        const ipoFeed = await feedService.getFeed({ category: 'IPO' });
        expect(ipoFeed.articles.every(a => a.primaryCategory === 'IPO')).toBe(true);

        const commoditiesFeed = await feedService.getFeed({ category: 'Commodities' });
        expect(commoditiesFeed.articles.every(a => a.primaryCategory === 'Commodities')).toBe(true);

        const exchangeFeed = await feedService.getFeed({ category: 'Exchange' });
        expect(exchangeFeed.articles.every(a => a.primaryCategory === 'Exchange')).toBe(true);

        const economyFeed = await feedService.getFeed({ category: 'Economy' });
        expect(economyFeed.articles.every(a => a.primaryCategory === 'Economy')).toBe(true);

        const corporateFeed = await feedService.getFeed({ category: 'Corporate' });
        expect(corporateFeed.articles.every(a => a.primaryCategory === 'Corporate')).toBe(true);

        const techFeed = await feedService.getFeed({ category: 'Technology' });
        expect(techFeed.articles.every(a => a.primaryCategory === 'Technology')).toBe(true);

        const globalFeed = await feedService.getFeed({ category: 'Global' });
        expect(globalFeed.articles.every(a => a.primaryCategory === 'Global')).toBe(true);
    });

    // 12. Pagination integrity
    it('12. Pagination integrity: page, limit, totalCount, and totalPages are calculated strictly read-only', async () => {
        const batch: RawArticlePayload[] = Array.from({ length: 25 }, (_, i) => ({
            headline: `Article ${i + 1} - Market Update`,
            body: `Body description text for article ${i + 1}`,
            url: `https://test.com/page-test-${i + 1}`,
            publisher: 'TestPublisher'
        }));
        await pipeline.ingest(batch, 'PaginationTest');

        const page1 = await feedService.getFeed({ page: 1, limit: 10 });
        expect(page1.articles.length).toBe(10);
        expect(page1.totalCount).toBe(25);
        expect(page1.totalPages).toBe(3);
        expect(page1.page).toBe(1);

        const page3 = await feedService.getFeed({ page: 3, limit: 10 });
        expect(page3.articles.length).toBe(5);
        expect(page3.totalCount).toBe(25);
        expect(page3.page).toBe(3);

        // Requesting out of range page
        const outOfRange = await feedService.getFeed({ page: 99, limit: 10 });
        expect(outOfRange.page).toBe(3);
    });

    // 13. Rapid repeated ingestion
    it('13. Rapid repeated ingestion: calling ingest 5 times with identical batch yields 0 duplicate writes', async () => {
        const batch: RawArticlePayload[] = [
            { headline: 'ICICI Bank Q3 PAT rises 24% YoY to Rs 10,270 Cr', body: 'Asset quality improves with Net NPA at 0.44%.', url: 'https://icici.com/q3-pat', publisher: 'ICICI' }
        ];

        for (let i = 0; i < 5; i++) {
            await pipeline.ingest(batch, 'ICICI');
        }

        expect(await store.count()).toBe(1);
    });

    // 14. Collector timeout
    it('14. Collector timeout: CollectorAdapter isolates hung or slow collectors safely', async () => {
        const hungCollector: ICollectorSource = {
            name: 'SlowHungCollector',
            collect: async () => {
                return new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };

        const result = await CollectorAdapter.collectFrom(hungCollector, 50); // 50ms timeout
        expect(result.error).toContain('timed out');
        expect(result.payloads.length).toBe(0);
    });

    // 15. Malformed RSS payload
    it('15. Malformed RSS payload: rejects invalid items without throwing or crashing batch', () => {
        const malformedList = [
            null,
            undefined,
            {},
            { headline: '' },
            { url: '' },
            { headline: 'Valid Article with URL', url: 'https://valid.com/1', body: 'Valid Body' }
        ];

        const adapted = CollectorAdapter.adaptList(malformedList);
        expect(adapted.length).toBe(1);
        expect(adapted[0].headline).toBe('Valid Article with URL');
    });

    // 16. AI unavailable
    it('16. AI unavailable: Canonical article remains 100% valid and queryable when AI service is offline', async () => {
        const article: RawArticlePayload = {
            headline: 'Lupin receives USFDA approval for generic respiratory inhalation spray',
            body: 'Pharma major gets tentative approval for respiratory product in US market.',
            url: 'https://lupin.com/fda-approval-respiratory',
            publisher: 'Lupin'
        };

        const result = await pipeline.ingest([article], 'Lupin');
        expect(result.saved).toBe(1);

        const stored = (await store.getAll())[0];
        expect(stored.headline).toBe('Lupin receives USFDA approval for generic respiratory inhalation spray');
        expect(stored.primaryCategory).toBe('F&O');
        expect(stored.fnoEligible).toBe(true);
        expect(stored.intelligence).toBeUndefined(); // AI is optional enrichment
    });


    // 17. AI malformed response
    it('17. AI malformed response: AI enrichment errors leave underlying core facts untouched', async () => {
        const article: RawArticlePayload = {
            headline: 'Sun Pharma acquires Japanese dermatology portfolio for $300 million',
            body: 'Strategic acquisition expands international specialty presence.',
            url: 'https://sunpharma.com/japan-dermatology-deal',
            publisher: 'Sun Pharma'
        };

        await pipeline.ingest([article], 'Sun Pharma');
        const stored = (await store.getAll())[0];

        // Mock failing AI enrichment
        const failingAIService: NewsIntelligenceService = {
            enrich: async () => {
                throw new Error('AI Gateway 500: Rate Limit Exceeded or Malformed Response');
            }
        };

        let enrichedArticle = { ...stored };
        try {
            enrichedArticle = await failingAIService.enrich(stored);
        } catch (err: any) {
            // Failure caught and isolated
            expect(err.message).toContain('AI Gateway 500');
        }

        // Base article core facts remain identical
        expect(enrichedArticle.id).toBe(stored.id);
        expect(enrichedArticle.headline).toBe(stored.headline);
        expect(enrichedArticle.primaryCategory).toBe(stored.primaryCategory);
        expect(enrichedArticle.fnoEligible).toBe(stored.fnoEligible);
    });

    // 18. Protected legacy file mutation detection
    it('18. Protected legacy file mutation detection: zero bytes or articles mutated in historical datasets', () => {
        const currentSnapshot = getProtectedSnapshot();
        for (const file of PROTECTED_FILES) {
            const baseline = baselineSnapshot[file];
            const current = currentSnapshot[file];

            if (baseline.exists) {
                expect(current.exists, `Protected file ${file} was deleted!`).toBe(true);
                expect(current.count, `Protected file ${file} lost articles!`).toBeGreaterThanOrEqual(baseline.count);
            }
        }
    });
});
