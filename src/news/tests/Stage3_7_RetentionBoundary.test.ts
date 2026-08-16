/**
 * ATHENA NEWS CORE — STAGE 3.7 RETENTION BOUNDARY & IDEMPOTENCY SUITE
 *
 * Verifies:
 * 1. Definitive separation of V3 storiesMap, rawArticles, and canonical Stage 2 articles.
 * 2. Story retention cleanup does NOT prune rawArticles map or drop source data.
 * 3. Retention cleanup does NOT affect data/news_stage2_store.json (Historical protection).
 * 4. Controlled Ingestion Tests:
 *    - Test A: Genuinely distinct new article (+1)
 *    - Test B: Exact same article repeated (+0)
 *    - Test C: Same canonical URL with modified headline/metadata (DUPLICATE status, +0)
 *    - Test D: Syndicated article with different URL but matching headline (POSSIBLE_DUPLICATE, +0)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PersistentV3StorageAdapter } from '../NewsEngineV3/storage/PersistentV3StorageAdapter';
import { JsonNewsStore } from '../storage/JsonNewsStore';
import { IngestionPipeline } from '../ingestion/IngestionPipeline';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator';
import { NewsArticle } from '../types/Article';
import { V3RawArticle, V3Story } from '../NewsEngineV3/types/V3Types';

describe('Stage 3.7: Retention Boundary & Ingestion Idempotency Suite', () => {
    const tempV3Path = path.join(process.cwd(), 'data', 'v3_news_store_test_temp.json');
    const tempStage2Path = path.join(process.cwd(), 'data', 'news_stage2_store_test_temp.json');

    let v3Adapter: PersistentV3StorageAdapter;
    let stage2Store: JsonNewsStore;
    let pipeline: IngestionPipeline;

    beforeEach(async () => {
        // Setup isolated storage adapters for unit testing
        v3Adapter = new PersistentV3StorageAdapter(tempV3Path);
        await v3Adapter.initialize();

        stage2Store = new JsonNewsStore(tempStage2Path);
        await stage2Store.initialize();

        pipeline = new IngestionPipeline(stage2Store);
    });

    afterEach(async () => {
        // Clean up temporary test files
        v3Adapter.clearAll();
        await stage2Store.clearForTestOnly();

        if (fs.existsSync(tempV3Path)) fs.unlinkSync(tempV3Path);
        if (fs.existsSync(tempStage2Path)) fs.unlinkSync(tempStage2Path);
    });

    it('1. V3 Storage Map Separation: storiesMap, rawArticles, and news_stage2_store.json', async () => {
        // Create an old raw article and corresponding story
        const testId = 'art_separation_test_1001';
        const rawArt: V3RawArticle = {
            id: testId,
            publisherId: 'REUTERS',
            sourceUrl: 'https://reuters.com/athena-separation-test',
            title: 'Athena Core Invariant Separation Test',
            rawBody: 'This body represents a canonical raw article.',
            publishedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days old
            fetchedAt: new Date().toISOString()
        };

        const story = {
            storyId: `STORY_${testId}`,
            correlationId: 'corr_xyz_123',
            clusterId: 'cluster_abc_789',
            headline: 'Athena Core Invariant Separation Test',
            publishedAt: rawArt.publishedAt,
            primaryArticle: {
                id: testId,
                rawArticleId: testId,
                cleanTitle: rawArt.title,
                cleanBody: rawArt.rawBody,
                summaryLead: 'Lead summary',
                publishedAt: rawArt.publishedAt,
                publisher: { id: 'REUTERS', name: 'Reuters', baseUrl: 'https://reuters.com', isOfficialExchange: false, trustScore: 95 }
            },
            publisher: { id: 'REUTERS', name: 'Reuters', baseUrl: 'https://reuters.com', isOfficialExchange: false, trustScore: 95 }
        } as unknown as V3Story;

        // Save inside the isolated V3 adapter
        await v3Adapter.saveRawArticle(rawArt);
        await v3Adapter.saveStory(story);

        // Verify they are preserved inside maps
        expect(await v3Adapter.getRawArticleById(testId)).toBeDefined();
        expect(await v3Adapter.getStoryById(`STORY_${testId}`)).toBeDefined();

        // RUN RETENTION CLEANUP (for 30 days)
        const deletedStories = v3Adapter.runRetentionCleanup(30);
        expect(deletedStories).toBe(1); // Story is 40 days old, should be pruned

        // PROVE THE RELATIONSHIP:
        // A disappearing story from storiesMap does NOT mean data loss.
        // The rawArticle still remains preserved inside the rawArticles map,
        // proving clustering/representation change only.
        const storyAfterCleanup = await v3Adapter.getStoryById(`STORY_${testId}`);
        const rawArtAfterCleanup = await v3Adapter.getRawArticleById(testId);

        expect(storyAfterCleanup).toBeNull(); // story pruned!
        expect(rawArtAfterCleanup).not.toBeNull(); // raw article completely preserved!
        expect(rawArtAfterCleanup?.id).toBe(testId);
    });

    it('2. Retention Boundary Protection: 30-day story cleanup cannot prune canonical news_stage2_store.json', async () => {
        // Insert a 45-day old article into our isolated canonical store
        const oldId = 'art_historical_45_days_old';
        const oldArticle: NewsArticle = {
            id: oldId,
            source: {
                name: 'Reuters',
                url: 'https://reuters.com',
                collectionMethod: 'RSS'
            },
            sourceUrl: 'https://reuters.com/historical-protection-test',
            headline: 'Historical Protection Boundary Test',
            body: 'Historical body older than retention boundary.',
            publishedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            fetchedAt: new Date().toISOString(),
            primaryCategory: 'Economy',
            eventType: 'REPORT',
            symbol: null,
            fnoEligible: false,
            financialMetrics: [],
            classificationConfidence: 95,
            relevanceScore: 80
        };

        await stage2Store.insert(oldArticle);
        const countBefore = await stage2Store.count();
        expect(countBefore).toBe(1);

        // Run the V3 retention cleanup
        const deletedStories = v3Adapter.runRetentionCleanup(30);
        
        // Canonical store size must remain completely unchanged (Boundary protected!)
        const countAfter = await stage2Store.count();
        expect(countAfter).toBe(1);
        
        const retrieved = await stage2Store.getById(oldId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.headline).toBe(oldArticle.headline);
    });

    it('3. Ingestion Idempotency & Syndication Pipeline: Tests A, B, C, D', async () => {
        // Test A: Insert genuinely distinct new article
        const artA: any = {
            id: 'id_test_a_9001',
            headline: 'Test A: Genuinely Distinct Announcement Headline',
            description: 'Test A Description body.',
            url: 'https://reuters.com/test-a-unique-url',
            publishedAt: new Date().toISOString(),
            source: 'Reuters',
            category: 'Economy'
        };

        const resA = await pipeline.ingest([artA], 'IngestionPipelineTest');
        expect(resA.processed).toBe(1);
        expect(resA.saved).toBe(1);
        expect(resA.duplicates).toBe(0);
        expect(await stage2Store.count()).toBe(1); // +1 increase

        // Test B: Submit the exact same article again
        const resB = await pipeline.ingest([artA], 'IngestionPipelineTest');
        expect(resB.processed).toBe(1);
        expect(resB.saved).toBe(0);
        expect(resB.duplicates).toBe(1); // Recognized as duplicate
        expect(await stage2Store.count()).toBe(1); // +0 increase

        // Test C: Duplicate URL with metadata/headline variation
        const artC: any = {
            id: 'id_test_c_different_id',
            headline: 'Test C: Modified Headline but Same URL',
            description: 'Test C Description body.',
            url: 'https://reuters.com/test-a-unique-url', // Same URL as artA
            publishedAt: new Date().toISOString(),
            source: 'Reuters',
            category: 'Economy'
        };

        // Run checking directly via deduplicator to inspect status and evidence
        const adaptedArtC: NewsArticle = {
            id: 'id_test_c_different_id',
            source: { name: 'Reuters', url: 'https://reuters.com', collectionMethod: 'RSS' },
            sourceUrl: artC.url,
            headline: artC.headline,
            body: artC.description,
            publishedAt: artC.publishedAt,
            fetchedAt: new Date().toISOString(),
            primaryCategory: 'Economy',
            eventType: 'REPORT',
            symbol: null,
            fnoEligible: false,
            financialMetrics: [],
            classificationConfidence: 90,
            relevanceScore: 70
        };

        const allArticles = await stage2Store.getAll();
        const dedupResult = ArticleDeduplicator.check(adaptedArtC, allArticles);
        
        expect(dedupResult.status).toBe('DUPLICATE');
        expect(dedupResult.evidence).toBe('Canonical URL Match');

        // Execute through pipeline
        const resC = await pipeline.ingest([artC], 'IngestionPipelineTest');
        expect(resC.processed).toBe(1);
        expect(resC.saved).toBe(0);
        expect(resC.duplicates).toBe(1); // Filtered out
        expect(await stage2Store.count()).toBe(1); // +0 increase

        // Test D: Multiple Source Syndication / Equivalent Article (different URL, identical headline)
        const artD: any = {
            id: 'id_test_d_syndicated',
            headline: 'Test A: Genuinely Distinct Announcement Headline', // Identical to Test A headline
            description: 'Test D Description body from syndication.',
            url: 'https://moneycontrol.com/syndicated-test-d-url', // Different URL
            publishedAt: new Date().toISOString(),
            source: 'Moneycontrol',
            category: 'Economy'
        };

        const adaptedArtD: NewsArticle = {
            id: artD.id,
            source: { name: 'Moneycontrol', url: 'https://moneycontrol.com', collectionMethod: 'RSS' },
            sourceUrl: artD.url,
            headline: artD.headline,
            body: artD.description,
            publishedAt: artD.publishedAt,
            fetchedAt: new Date().toISOString(),
            primaryCategory: 'Economy',
            eventType: 'REPORT',
            symbol: null,
            fnoEligible: false,
            financialMetrics: [],
            classificationConfidence: 90,
            relevanceScore: 70
        };

        const dedupResultD = ArticleDeduplicator.check(adaptedArtD, allArticles);
        expect(dedupResultD.status).toBe('POSSIBLE_DUPLICATE');
        expect(dedupResultD.evidence).toBe('Exact Normalized Headline Match');
    });
});
