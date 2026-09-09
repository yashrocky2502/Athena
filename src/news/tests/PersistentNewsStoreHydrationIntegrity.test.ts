import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersistentNewsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';
import { LegacyWriterGuard } from '../isolation/LegacyWriterGuard';

describe('PersistentNewsStore Hydration Data Integrity & Immutability', () => {
  const tempTestDir = path.join(process.cwd(), 'data', 'temp_test_store');
  const tempStorePath = path.join(tempTestDir, 'test_hydration_integrity.json');
  const tempBackupPath = `${tempStorePath}.bak`;

  beforeEach(() => {
    LegacyWriterGuard.setLegacyWritersEnabled(true);
    cleanupFiles();
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
  });

  afterEach(() => {
    cleanupFiles();
  });

  function cleanupFiles() {
    try {
      if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
      if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
      if (fs.existsSync(tempTestDir)) {
        const files = fs.readdirSync(tempTestDir);
        for (const f of files) {
          try {
            fs.unlinkSync(path.join(tempTestDir, f));
          } catch (e) {}
        }
        try {
          fs.rmdirSync(tempTestDir);
        } catch (e) {}
      }
    } catch (e) {}
  }

  // TEST 1 — Historical classification is immutable during hydration
  it('Test 1: Historical classification remains strictly immutable during hydration without startup reclassification or disk writes', () => {
    // Construct an article with classification fields that DELIBERATELY differ from what current FNOEligibilityEngine & NewsClassifier would compute
    const deliberatelyStaleArticle: NewsArticleV2 = {
      id: 'historical_art_001',
      canonicalUrl: 'https://example.com/tata-motors-q1-results',
      headline: 'Tata Motors Q1 Net Profit Jumps 30% To Rs 5,400 Crore',
      body: 'Tata Motors reported strong quarterly earnings driven by JLR sales and domestic expansion.',
      source: {
        publisher: 'Economic Times',
        url: 'https://example.com/tata-motors-q1-results',
        collectionMethod: 'RSS'
      },
      publishedAt: '2024-01-15T10:00:00.000Z',
      collectedAt: '2024-01-15T10:05:00.000Z',
      // Stored classification deliberately differing from current classifier outputs (which would produce F&O eligible, Results, EARNINGS, HIGH)
      category: 'Market' as any,
      primaryCategory: 'Market',
      secondaryCategories: ['Economy', 'SpecialReports'],
      eventType: 'MACRO_REPORT',
      categoryConfidence: 'LOW',
      classificationEvidence: ['Historical evidence locked in 2024'],
      sentiment: 'NEUTRAL',
      relevanceScore: 42,
      fno: {
        eligible: false,
        symbol: null,
        confidence: 'NONE',
        decision: 'EXCLUDE',
        reason: 'Historical manual rule freeze'
      }
    };

    const initialJson = JSON.stringify([deliberatelyStaleArticle], null, 2);
    fs.writeFileSync(tempStorePath, initialJson, 'utf-8');
    const mtimeBeforeHydration = fs.statSync(tempStorePath).mtimeMs;

    // Instantiate PersistentNewsStore against this temporary canonical file
    const store = new PersistentNewsStore(tempStorePath);

    // Verify loaded article in memory
    const loadedArticles = store.getAllArticles();
    expect(loadedArticles.length).toBe(1);

    const loaded = store.getArticle('historical_art_001');
    expect(loaded).toBeDefined();

    // Assert ALL classifier-driven fields remain exactly as persisted
    expect(loaded?.fno?.eligible).toBe(false);
    expect(loaded?.fno?.decision).toBe('EXCLUDE');
    expect(loaded?.fno?.symbol).toBeNull();
    expect(loaded?.fno?.confidence).toBe('NONE');
    expect(loaded?.fno?.reason).toBe('Historical manual rule freeze');

    expect(loaded?.category).toBe('Market');
    expect(loaded?.primaryCategory).toBe('Market');
    expect(loaded?.secondaryCategories).toEqual(['Economy', 'SpecialReports']);
    expect(loaded?.eventType).toBe('MACRO_REPORT');
    expect(loaded?.categoryConfidence).toBe('LOW');
    expect(loaded?.classificationEvidence).toEqual(['Historical evidence locked in 2024']);

    // Assert that the file on disk was NOT modified (no startup reclassification persistence)
    const mtimeAfterHydration = fs.statSync(tempStorePath).mtimeMs;
    expect(mtimeAfterHydration).toBe(mtimeBeforeHydration);

    const contentAfterHydration = fs.readFileSync(tempStorePath, 'utf-8');
    expect(contentAfterHydration).toBe(initialJson);
  });

  // TEST 2 — Explicit reclassification still works
  it('Test 2: Explicit reclassifyArticles(force, limit) successfully updates classifications on request', async () => {
    const historicalArticle: NewsArticleV2 = {
      id: 'reclassify_target_001',
      canonicalUrl: 'https://example.com/tata-motors-results',
      headline: 'Tata Motors Q1 Net Profit Jumps 30% To Rs 5,400 Crore',
      body: 'Tata Motors reported strong quarterly earnings driven by JLR sales.',
      source: {
        publisher: 'Economic Times',
        url: 'https://example.com/tata-motors-results',
        collectionMethod: 'RSS'
      },
      publishedAt: '2024-01-15T10:00:00.000Z',
      collectedAt: '2024-01-15T10:05:00.000Z',
      category: 'Market' as any,
      primaryCategory: 'Market',
      secondaryCategories: [],
      eventType: 'GENERAL',
      sentiment: 'NEUTRAL',
      relevanceScore: 50,
      fno: {
        eligible: false,
        symbol: null,
        confidence: 'NONE',
        decision: 'EXCLUDE',
        reason: 'Legacy classification'
      }
    };

    fs.writeFileSync(tempStorePath, JSON.stringify([historicalArticle], null, 2), 'utf-8');
    const store = new PersistentNewsStore(tempStorePath);

    // Verify it stays unmodified after startup hydration
    expect(store.getArticle('reclassify_target_001')?.primaryCategory).toBe('Market');

    // Trigger explicit reclassification
    const result = await store.reclassifyArticles(true, 10);
    expect(result.processed).toBe(1);
    expect(result.updated).toBe(1);

    // Verify updated fields in memory
    const updated = store.getArticle('reclassify_target_001');
    expect(updated?.fno?.eligible).toBe(true);
    expect(updated?.fno?.symbol).toBe('TATAMOTORS');
    expect(updated?.primaryCategory).toBe('Results');
    expect(updated?.eventType).toBe('EARNINGS');

    // Verify updated fields persisted to disk
    const diskContent = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
    expect(diskContent[0].primaryCategory).toBe('Results');
    expect(diskContent[0].fno.eligible).toBe(true);
  });

  // TEST 3 — Existing persistence safety remains intact
  describe('Test 3: Existing persistence safety mechanisms remain intact', () => {
    it('3a. Dataset shrink protection blocks unauthorized reductions in article count', async () => {
      const articles: NewsArticleV2[] = [
        {
          id: 'art_1',
          canonicalUrl: 'https://example.com/1',
          headline: 'Headline 1',
          body: 'Body 1',
          source: { publisher: 'Wire', url: 'https://example.com/1', collectionMethod: 'RSS' },
          publishedAt: new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          category: 'Market' as any,
          sentiment: 'NEUTRAL',
          relevanceScore: 50,
          fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
        },
        {
          id: 'art_2',
          canonicalUrl: 'https://example.com/2',
          headline: 'Headline 2',
          body: 'Body 2',
          source: { publisher: 'Wire', url: 'https://example.com/2', collectionMethod: 'RSS' },
          publishedAt: new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          category: 'Market' as any,
          sentiment: 'NEUTRAL',
          relevanceScore: 50,
          fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
        }
      ];

      fs.writeFileSync(tempStorePath, JSON.stringify(articles, null, 2), 'utf-8');
      const store = new PersistentNewsStore(tempStorePath);
      expect(store.getAllArticles().length).toBe(2);

      // Attempt to save fewer articles by directly modifying store internal articles and invoking private saveToDisk via persist
      // Or via saveArticles: saveArticles deduplicates against existing, so it never shrinks.
      // We test saveToDisk rejection directly:
      (store as any).articles = [articles[0]]; // mutate to 1 candidate
      await (store as any).saveToDisk(false);

      expect(store.lastPersistenceGuardRejection).not.toBeNull();
      expect(store.lastPersistenceGuardRejection.reason).toBe('DATASET_SHRINK');
      expect(store.persistGuardRejectionsCount).toBeGreaterThan(0);

      // Verify file on disk still has 2 records
      const diskArticles = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
      expect(diskArticles.length).toBe(2);
    });

    it('3b. Identity replacement protection rejects loss of historical article IDs', async () => {
      const articles: NewsArticleV2[] = [
        {
          id: 'hist_1',
          canonicalUrl: 'https://example.com/h1',
          headline: 'Hist 1',
          body: 'Body 1',
          source: { publisher: 'Wire', url: 'https://example.com/h1', collectionMethod: 'RSS' },
          publishedAt: new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          category: 'Market' as any,
          sentiment: 'NEUTRAL',
          relevanceScore: 50,
          fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
        }
      ];

      fs.writeFileSync(tempStorePath, JSON.stringify(articles, null, 2), 'utf-8');
      const store = new PersistentNewsStore(tempStorePath);

      // Candidate with same length (1) but different ID
      const replacementCandidate: NewsArticleV2 = {
        id: 'malicious_replacement_1',
        canonicalUrl: 'https://example.com/m1',
        headline: 'Replacement',
        body: 'Body replacement',
        source: { publisher: 'Attacker', url: 'https://example.com/m1', collectionMethod: 'RSS' },
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        category: 'Market' as any,
        sentiment: 'NEUTRAL',
        relevanceScore: 50,
        fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
      };

      (store as any).articles = [replacementCandidate];
      await (store as any).saveToDisk(false);

      expect(store.lastPersistenceGuardRejection).not.toBeNull();
      expect(store.lastPersistenceGuardRejection.reason).toBe('IDENTITY_REPLACEMENT');

      // Verify original file on disk retained hist_1
      const diskArticles = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
      expect(diskArticles[0].id).toBe('hist_1');
    });

    it('3c. Backup recovery restores from backup when primary is missing or suspiciously shrunk', () => {
      const backupArticles: NewsArticleV2[] = [
        {
          id: 'bak_art_1',
          canonicalUrl: 'https://example.com/b1',
          headline: 'Backup Article 1',
          body: 'Body B1',
          source: { publisher: 'Wire', url: 'https://example.com/b1', collectionMethod: 'DIRECT' },
          publishedAt: new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          category: 'Market' as any,
          sentiment: 'NEUTRAL',
          relevanceScore: 60,
          fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
        },
        {
          id: 'bak_art_2',
          canonicalUrl: 'https://example.com/b2',
          headline: 'Backup Article 2',
          body: 'Body B2',
          source: { publisher: 'Wire', url: 'https://example.com/b2', collectionMethod: 'DIRECT' },
          publishedAt: new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          category: 'Market' as any,
          sentiment: 'NEUTRAL',
          relevanceScore: 60,
          fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
        }
      ];

      // Primary is missing, backup exists
      fs.writeFileSync(tempBackupPath, JSON.stringify(backupArticles, null, 2), 'utf-8');

      const storeMissingPrimary = new PersistentNewsStore(tempStorePath);
      expect(storeMissingPrimary.getAllArticles().length).toBe(2);
      expect(fs.existsSync(tempStorePath)).toBe(true);

      // Primary is suspiciously shrunk: primary has 1 record, backup has 2 records
      const shrunkPrimary = [backupArticles[0]];
      fs.writeFileSync(tempStorePath, JSON.stringify(shrunkPrimary, null, 2), 'utf-8');

      const storeShrunkPrimary = new PersistentNewsStore(tempStorePath);
      expect(storeShrunkPrimary.getAllArticles().length).toBe(2);
      const restoredDisk = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
      expect(restoredDisk.length).toBe(2);
    });

    it('3d. Atomic persistence creates backup and updates canonical file correctly', async () => {
      const initialArticle: NewsArticleV2 = {
        id: 'atomic_1',
        canonicalUrl: 'https://example.com/a1',
        headline: 'Atomic 1',
        body: 'Body A1',
        source: { publisher: 'Wire', url: 'https://example.com/a1', collectionMethod: 'DIRECT' },
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        category: 'Market' as any,
        sentiment: 'NEUTRAL',
        relevanceScore: 60,
        fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
      };

      const store = new PersistentNewsStore(tempStorePath);
      await store.saveArticles([initialArticle]);

      expect(fs.existsSync(tempStorePath)).toBe(true);
      const parsed1 = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
      expect(parsed1.length).toBe(1);

      const secondArticle: NewsArticleV2 = {
        id: 'atomic_2',
        canonicalUrl: 'https://example.com/a2',
        headline: 'Atomic 2',
        body: 'Body A2',
        source: { publisher: 'Wire', url: 'https://example.com/a2', collectionMethod: 'DIRECT' },
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        category: 'Market' as any,
        sentiment: 'NEUTRAL',
        relevanceScore: 60,
        fno: { eligible: false, symbol: null, confidence: 'NONE', decision: 'EXCLUDE', reason: 'None' }
      };

      await store.saveArticles([secondArticle]);
      expect(fs.existsSync(tempBackupPath)).toBe(true);
      const backupParsed = JSON.parse(fs.readFileSync(tempBackupPath, 'utf-8'));
      expect(backupParsed.length).toBe(1); // backup holds the prior 1-record state

      const currentParsed = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
      expect(currentParsed.length).toBe(2);
    });
  });
});
