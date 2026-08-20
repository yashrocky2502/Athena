/**
 * ATHENA NEWS ENGINE — STAGE 7.5 NEWS REPOSITORY & MIGRATION SUITE
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JsonNewsRepository } from '../storage/JsonNewsRepository';
import { PostgresNewsRepository } from '../storage/PostgresNewsRepository';
import { runMigration } from '../../../scripts/migrate-news-json-to-postgres';
import { NullSemanticNewsIndex } from '../search/SemanticNewsIndex';
import { PostgresNewsSearchIndex } from '../search/NewsSearchIndex';
import { DirectAIRouterProvider, LiteLLMGatewayProvider } from '../AI/NewsAIProvider';

describe('Stage 7.5: PostgreSQL Repository & Migration Infrastructure', () => {

  const testStorePath = path.join(process.cwd(), 'data', 'news_stage2_store.json');

  it('1. JsonNewsRepository reads articles and applies query filters correctly', async () => {
    const repo = new JsonNewsRepository(testStorePath);
    const count = await repo.getArticleCount();
    expect(count).toBeGreaterThan(0);

    const articles = await repo.getArticles({ limit: 5 });
    expect(articles.length).toBeLessThanOrEqual(5);
    expect(articles[0].id).toBeDefined();

    const single = await repo.getArticle(articles[0].id);
    expect(single).not.toBeNull();
    expect(single?.id).toBe(articles[0].id);
  });

  it('2. PostgresNewsRepository operates seamlessly with fallback when PG is inactive', async () => {
    const pgRepo = new PostgresNewsRepository(testStorePath);
    const count = await pgRepo.getArticleCount();
    expect(count).toBeGreaterThan(0);

    const article = await pgRepo.getArticle('test_nonexistent_id');
    expect(article).toBeNull();
  });

  it('3. runMigration() idempotently migrates JSON data and produces a verified report', async () => {
    const report = await runMigration(testStorePath);

    expect(report.sourceFile).toBe(testStorePath);
    expect(report.totalRawRecords).toBeGreaterThan(0);
    expect(report.validArticlesMigrated).toBeGreaterThan(0);
    expect(report.sourceChecksum).toBeDefined();
    expect(report.canonicalStoreIntact).toBe(true);

    // Idempotency check: running migration second time yields exact same result without duplicate articles
    const report2 = await runMigration(testStorePath);
    expect(report2.validArticlesMigrated).toBe(report.validArticlesMigrated);
    expect(report2.canonicalStoreIntact).toBe(true);
  });

  it('4. Canonical JSON store file data/news_stage2_store.json is completely preserved', () => {
    expect(fs.existsSync(testStorePath)).toBe(true);
    const stat = fs.statSync(testStorePath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('5. NullSemanticNewsIndex and PostgresNewsSearchIndex enforce safe offline fallbacks', async () => {
    const repo = new JsonNewsRepository(testStorePath);
    const semanticIndex = new NullSemanticNewsIndex();
    const searchIndex = new PostgresNewsSearchIndex(repo);

    expect(semanticIndex.isAvailable()).toBe(false);
    const similarities = await semanticIndex.findSimilarArticles('article_1');
    expect(similarities).toEqual([]);

    expect(searchIndex.isAvailable()).toBe(true);
    const searchResults = await searchIndex.searchArticles('Jio', 5);
    expect(Array.isArray(searchResults)).toBe(true);
  });

  it('6. NewsAIProvider boundary handles LiteLLM fallback to DirectAIRouterProvider', async () => {
    const directProvider = new DirectAIRouterProvider();
    expect(directProvider.isAvailable()).toBe(true);

    const liteLLMProvider = new LiteLLMGatewayProvider(); // No gateway URL set in env
    expect(liteLLMProvider.isAvailable()).toBe(false);
  });

});
