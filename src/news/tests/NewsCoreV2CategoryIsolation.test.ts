import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersistentNewsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';
import { CANONICAL_CATEGORIES } from '../../newsCoreV2/classification/NewsCategoryResolver';
import { NEWS_CATEGORIES } from '../../components/news/NewsCategoryChips';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter';

describe('News Core V2 Category & Feed Isolation Forensic Audit', () => {
  const tempTestDir = path.join(process.cwd(), 'data', 'temp_category_isolation_test');
  const tempStorePath = path.join(tempTestDir, 'test_category_isolation.json');
  const tempBackupPath = `${tempStorePath}.bak`;

  beforeEach(() => {
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

  function createSyntheticArticle(props: Partial<NewsArticleV2> & { id: string; headline: string }): NewsArticleV2 {
    return {
      id: props.id,
      canonicalUrl: props.canonicalUrl || `https://example.com/news/${props.id}`,
      headline: props.headline,
      body: props.body || `Full body text for ${props.headline}`,
      source: props.source || { publisher: 'Moneycontrol', url: `https://example.com/news/${props.id}`, collectionMethod: 'RSS' },
      publishedAt: props.publishedAt || new Date().toISOString(),
      collectedAt: props.collectedAt || new Date().toISOString(),
      category: props.category || 'Market',
      sentiment: props.sentiment || 'NEUTRAL',
      relevanceScore: props.relevanceScore || 70,
      fno: props.fno || { eligible: false, decision: 'EXCLUDE', symbol: null, confidence: 'NONE', reason: 'Non-FNO' },
      primaryCategory: props.primaryCategory,
      secondaryCategories: props.secondaryCategories || [],
      eventType: props.eventType || 'OTHER',
      categoryConfidence: props.categoryConfidence || 'HIGH',
      classificationEvidence: props.classificationEvidence || []
    };
  }

  /**
   * Helper simulating /api/v4/news/feed filtering and categoryCounts logic exactly as in newsCoreV2Routes.ts
   */
  function simulateV4Feed(store: PersistentNewsStore, query: { category?: string; symbol?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 150;
    const categoryQuery = query.category;
    const symbolQuery = query.symbol;

    const allArticles = store.getAllArticles();
    let filtered = allArticles;

    if (categoryQuery && categoryQuery.toLowerCase() !== "all") {
      const lowerQuery = categoryQuery.toLowerCase();
      if (lowerQuery === "f&o" || lowerQuery === "fno") {
        filtered = store.getFNOArticles();
      } else {
        filtered = allArticles.filter(art => {
          const primary = (art.primaryCategory || art.category || "").toLowerCase();
          return primary === lowerQuery;
        });
      }
    }

    if (symbolQuery && symbolQuery.trim().length > 0) {
      const symUpper = symbolQuery.trim().toUpperCase();
      filtered = filtered.filter(art => ((art as any).symbol || art.fno?.symbol || '').toUpperCase() === symUpper);
    }

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedArticles = (page >= 1 && page <= totalPages && startIndex < totalCount)
      ? filtered.slice(startIndex, endIndex)
      : [];

    const categoryCounts: Record<string, number> = {
      "All": allArticles.length,
      "F&O": store.getFNOArticles().length
    };
    const checkCategories = [
      "Crypto",
      "Commodities",
      "IPO",
      "Results",
      "Market",
      "Corporate",
      "Economy",
      "Global",
      "Technology",
      "Exchange"
    ];
    for (const cat of checkCategories) {
      categoryCounts[cat] = allArticles.filter(art => {
        const primary = (art.primaryCategory || art.category || "").toLowerCase();
        return primary === cat.toLowerCase();
      }).length;
    }

    return {
      filteredArticles: filtered,
      paginatedArticles,
      uiArticles: NewsCoreV2UIAdapter.adaptMany(paginatedArticles),
      totalCount,
      categoryCounts
    };
  }

  // =========================================================================
  // Test A — Primary category isolation
  // =========================================================================
  it('Test A: Primary category isolation - article appears ONLY in its primary category feed and not in secondary category feeds', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    const artResults = createSyntheticArticle({
      id: 'art_results_001',
      headline: 'TCS Q3 Net Profit Jumps 12% YoY to Rs 12,000 Cr',
      primaryCategory: 'Results',
      category: 'Results',
      secondaryCategories: ['Market', 'Corporate']
    });

    const artIPO = createSyntheticArticle({
      id: 'art_ipo_001',
      headline: 'Swiggy IPO Subscribed 3.5x on Day 3',
      primaryCategory: 'IPO',
      category: 'IPO',
      secondaryCategories: ['Economy', 'Technology']
    });

    const artCrypto = createSyntheticArticle({
      id: 'art_crypto_001',
      headline: 'Bitcoin Crosses $100K Milestone as ETF Inflows Surge',
      primaryCategory: 'Crypto',
      category: 'Crypto',
      secondaryCategories: ['Commodities', 'Global']
    });

    await store.saveArticles([artResults, artIPO, artCrypto]);

    // Query Results feed
    const resultsFeed = simulateV4Feed(store, { category: 'Results' });
    expect(resultsFeed.filteredArticles.map(a => a.id)).toContain('art_results_001');
    expect(resultsFeed.filteredArticles.map(a => a.id)).not.toContain('art_ipo_001');
    expect(resultsFeed.filteredArticles.map(a => a.id)).not.toContain('art_crypto_001');

    // Query Market feed: artResults must NOT appear solely because Market is a secondary category
    const marketFeed = simulateV4Feed(store, { category: 'Market' });
    expect(marketFeed.filteredArticles.map(a => a.id)).not.toContain('art_results_001');

    // Query Corporate feed: artResults must NOT appear solely because Corporate is a secondary category
    const corpFeed = simulateV4Feed(store, { category: 'Corporate' });
    expect(corpFeed.filteredArticles.map(a => a.id)).not.toContain('art_results_001');

    // Query Economy and Technology feeds: artIPO must NOT appear solely because they are secondary
    const econFeed = simulateV4Feed(store, { category: 'Economy' });
    expect(econFeed.filteredArticles.map(a => a.id)).not.toContain('art_ipo_001');
    const techFeed = simulateV4Feed(store, { category: 'Technology' });
    expect(techFeed.filteredArticles.map(a => a.id)).not.toContain('art_ipo_001');

    // Query Commodities and Global feeds: artCrypto must NOT appear solely because they are secondary
    const commFeed = simulateV4Feed(store, { category: 'Commodities' });
    expect(commFeed.filteredArticles.map(a => a.id)).not.toContain('art_crypto_001');
    const globalFeed = simulateV4Feed(store, { category: 'Global' });
    expect(globalFeed.filteredArticles.map(a => a.id)).not.toContain('art_crypto_001');
  });

  // =========================================================================
  // Test B — Legacy category compatibility
  // =========================================================================
  it('Test B: Legacy category compatibility - article with absent primaryCategory falls back to category field', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    const legacyArticle = createSyntheticArticle({
      id: 'art_legacy_001',
      headline: 'Infosys Posts Solid Q2 Performance',
      category: 'Results',
      primaryCategory: undefined
    });

    await store.saveArticles([legacyArticle]);

    const resultsFeed = simulateV4Feed(store, { category: 'Results' });
    expect(resultsFeed.filteredArticles.length).toBe(1);
    expect(resultsFeed.filteredArticles[0].id).toBe('art_legacy_001');

    const marketFeed = simulateV4Feed(store, { category: 'Market' });
    expect(marketFeed.filteredArticles.length).toBe(0);
  });

  // =========================================================================
  // Test C — Conflicting category fields
  // =========================================================================
  it('Test C: Conflicting category fields - primaryCategory has authoritative precedence over legacy category', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    // Conflict: legacy category is "Market", but resolved primaryCategory is "Results"
    const conflictingArticle = createSyntheticArticle({
      id: 'art_conflict_001',
      headline: 'Reliance Q2 Net Profit Up 10%',
      category: 'Market',
      primaryCategory: 'Results'
    });

    await store.saveArticles([conflictingArticle]);

    // Results feed must include the article because primaryCategory is authoritative
    const resultsFeed = simulateV4Feed(store, { category: 'Results' });
    expect(resultsFeed.filteredArticles.length).toBe(1);
    expect(resultsFeed.filteredArticles[0].id).toBe('art_conflict_001');

    // Market feed must NOT include the article
    const marketFeed = simulateV4Feed(store, { category: 'Market' });
    expect(marketFeed.filteredArticles.length).toBe(0);
  });

  // =========================================================================
  // Test D — Secondary category isolation
  // =========================================================================
  it('Test D: Secondary category isolation - article does not leak into Market or Global feeds via secondaryCategories', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    const econArticle = createSyntheticArticle({
      id: 'art_econ_001',
      headline: 'RBI Keeps Repo Rate Unchanged at 6.5%, Focus on Inflation',
      primaryCategory: 'Economy',
      category: 'Economy',
      secondaryCategories: ['Market', 'Global']
    });

    await store.saveArticles([econArticle]);

    const economyFeed = simulateV4Feed(store, { category: 'Economy' });
    expect(economyFeed.filteredArticles.length).toBe(1);
    expect(economyFeed.filteredArticles[0].id).toBe('art_econ_001');

    // Must NOT appear in Market
    const marketFeed = simulateV4Feed(store, { category: 'Market' });
    expect(marketFeed.filteredArticles.length).toBe(0);

    // Must NOT appear in Global
    const globalFeed = simulateV4Feed(store, { category: 'Global' });
    expect(globalFeed.filteredArticles.length).toBe(0);
  });

  // =========================================================================
  // Test E — F&O isolation
  // =========================================================================
  it('Test E: F&O isolation - F&O feed is governed by FNO eligibility and does not simply mirror Market category', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    // 1. F&O-eligible article with primaryCategory = "Market"
    const fnoMarketArt = createSyntheticArticle({
      id: 'art_fno_market',
      headline: 'Nifty Futures Surge to Record High with Massive OI Addition',
      primaryCategory: 'Market',
      category: 'Market',
      fno: { eligible: true, decision: 'INCLUDE', symbol: 'NIFTY', confidence: 'HIGH', reason: 'Index derivative' }
    });

    // 2. Non-F&O article with primaryCategory = "Market"
    const nonFnoMarketArt = createSyntheticArticle({
      id: 'art_non_fno_market',
      headline: 'Midcap Index Consolidates in Afternoon Trade',
      primaryCategory: 'Market',
      category: 'Market',
      fno: { eligible: false, decision: 'EXCLUDE', symbol: null, confidence: 'NONE', reason: 'No FNO' }
    });

    // 3. F&O-eligible article with primaryCategory = "Results"
    const fnoResultsArt = createSyntheticArticle({
      id: 'art_fno_results',
      headline: 'Reliance Q3 Profit Surges 15%; Heavy Call Unwinding Seen at 3000 Strike',
      primaryCategory: 'Results',
      category: 'Results',
      secondaryCategories: ['F&O'],
      fno: { eligible: true, decision: 'INCLUDE', symbol: 'RELIANCE', confidence: 'HIGH', reason: 'FNO Stock Results' }
    });

    await store.saveArticles([fnoMarketArt, nonFnoMarketArt, fnoResultsArt]);

    // F&O Feed: Must contain (1) and (3), but NOT (2)
    const fnoFeed = simulateV4Feed(store, { category: 'F&O' });
    const fnoIds = fnoFeed.filteredArticles.map(a => a.id);
    expect(fnoIds).toContain('art_fno_market');
    expect(fnoIds).toContain('art_fno_results');
    expect(fnoIds).not.toContain('art_non_fno_market');
    expect(fnoFeed.filteredArticles.length).toBe(2);

    // Market Feed: Must contain (1) and (2), but NOT (3)
    const marketFeed = simulateV4Feed(store, { category: 'Market' });
    const marketIds = marketFeed.filteredArticles.map(a => a.id);
    expect(marketIds).toContain('art_fno_market');
    expect(marketIds).toContain('art_non_fno_market');
    expect(marketIds).not.toContain('art_fno_results');
    expect(marketFeed.filteredArticles.length).toBe(2);

    // Results Feed: Must contain (3), but NOT (1) or (2)
    const resultsFeed = simulateV4Feed(store, { category: 'Results' });
    const resultsIds = resultsFeed.filteredArticles.map(a => a.id);
    expect(resultsIds).toContain('art_fno_results');
    expect(resultsIds).not.toContain('art_fno_market');
    expect(resultsIds).not.toContain('art_non_fno_market');
    expect(resultsFeed.filteredArticles.length).toBe(1);
  });

  // =========================================================================
  // Test F — Symbol filtering + category filtering
  // =========================================================================
  it('Test F: Symbol filtering + category filtering - combined filters never broaden the result set', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    const relResults = createSyntheticArticle({
      id: 'rel_results',
      headline: 'Reliance Industries Reports 15% Growth in Q3 Net Profit',
      primaryCategory: 'Results',
      category: 'Results',
      fno: { eligible: true, decision: 'INCLUDE', symbol: 'RELIANCE', confidence: 'HIGH', reason: 'FNO results' }
    });

    const tcsResults = createSyntheticArticle({
      id: 'tcs_results',
      headline: 'TCS Q3 Revenue Beats Estimates',
      primaryCategory: 'Results',
      category: 'Results',
      fno: { eligible: true, decision: 'INCLUDE', symbol: 'TCS', confidence: 'HIGH', reason: 'FNO results' }
    });

    const relMarket = createSyntheticArticle({
      id: 'rel_market',
      headline: 'Reliance Leads Bulls in Morning Trade, Nifty Crosses 25000',
      primaryCategory: 'Market',
      category: 'Market',
      fno: { eligible: true, decision: 'INCLUDE', symbol: 'RELIANCE', confidence: 'HIGH', reason: 'FNO market mover' }
    });

    const tcsMarket = createSyntheticArticle({
      id: 'tcs_market',
      headline: 'IT Index Trades Mixed; TCS Fluctuates',
      primaryCategory: 'Market',
      category: 'Market',
      fno: { eligible: false, decision: 'EXCLUDE', symbol: 'TCS', confidence: 'NONE', reason: 'Non-FNO signal' }
    });

    await store.saveArticles([relResults, tcsResults, relMarket, tcsMarket]);

    // 1. category=Results (no symbol) -> 2 articles
    const resultsOnly = simulateV4Feed(store, { category: 'Results' });
    expect(resultsOnly.filteredArticles.length).toBe(2);

    // 2. category=Results&symbol=RELIANCE -> 1 article (relResults only)
    const resultsReliance = simulateV4Feed(store, { category: 'Results', symbol: 'RELIANCE' });
    expect(resultsReliance.filteredArticles.length).toBe(1);
    expect(resultsReliance.filteredArticles[0].id).toBe('rel_results');
    expect(resultsReliance.filteredArticles.length).toBeLessThanOrEqual(resultsOnly.filteredArticles.length);

    // 3. category=F&O (no symbol) -> 3 articles (relResults, tcsResults, relMarket)
    const fnoOnly = simulateV4Feed(store, { category: 'F&O' });
    expect(fnoOnly.filteredArticles.length).toBe(3);

    // 4. category=F&O&symbol=RELIANCE -> 2 articles (relResults, relMarket)
    const fnoReliance = simulateV4Feed(store, { category: 'F&O', symbol: 'RELIANCE' });
    expect(fnoReliance.filteredArticles.length).toBe(2);
    const fnoRelIds = fnoReliance.filteredArticles.map(a => a.id);
    expect(fnoRelIds).toContain('rel_results');
    expect(fnoRelIds).toContain('rel_market');
    expect(fnoReliance.filteredArticles.length).toBeLessThanOrEqual(fnoOnly.filteredArticles.length);
  });

  // =========================================================================
  // Test G — Category counts consistency
  // =========================================================================
  it('Test G: Category counts consistency - categoryCounts for every category exactly equals the number of articles returned by the respective category filter', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    const testArticles: NewsArticleV2[] = [
      createSyntheticArticle({ id: 'c_crypto_1', headline: 'Crypto 1', primaryCategory: 'Crypto' }),
      createSyntheticArticle({ id: 'c_crypto_2', headline: 'Crypto 2', primaryCategory: 'Crypto' }),
      createSyntheticArticle({ id: 'c_comm_1', headline: 'Commodity 1', primaryCategory: 'Commodities' }),
      createSyntheticArticle({ id: 'c_ipo_1', headline: 'IPO 1', primaryCategory: 'IPO' }),
      createSyntheticArticle({ id: 'c_res_1', headline: 'Results 1', primaryCategory: 'Results' }),
      createSyntheticArticle({ id: 'c_res_2', headline: 'Results 2', primaryCategory: 'Results', fno: { eligible: true, decision: 'INCLUDE', symbol: 'INFY', confidence: 'HIGH', reason: 'FNO' } }),
      createSyntheticArticle({ id: 'c_mkt_1', headline: 'Market 1', primaryCategory: 'Market' }),
      createSyntheticArticle({ id: 'c_mkt_2', headline: 'Market 2', primaryCategory: 'Market', fno: { eligible: true, decision: 'INCLUDE', symbol: 'NIFTY', confidence: 'HIGH', reason: 'FNO' } }),
      createSyntheticArticle({ id: 'c_corp_1', headline: 'Corporate 1', primaryCategory: 'Corporate' }),
      createSyntheticArticle({ id: 'c_econ_1', headline: 'Economy 1', primaryCategory: 'Economy' }),
      createSyntheticArticle({ id: 'c_glob_1', headline: 'Global 1', primaryCategory: 'Global' }),
      createSyntheticArticle({ id: 'c_tech_1', headline: 'Technology 1', primaryCategory: 'Technology' }),
      createSyntheticArticle({ id: 'c_exch_1', headline: 'Exchange 1', primaryCategory: 'Exchange' }),
      createSyntheticArticle({ id: 'c_other_1', headline: 'Other 1', primaryCategory: 'Other' })
    ];

    await store.saveArticles(testArticles);

    const feedAll = simulateV4Feed(store, { category: 'All' });
    const counts = feedAll.categoryCounts;

    // Check "All" count
    expect(counts['All']).toBe(testArticles.length);
    expect(counts['All']).toBe(feedAll.filteredArticles.length);

    // Check "F&O" count (should be 2 articles with fno.eligible = true)
    const fnoFeed = simulateV4Feed(store, { category: 'F&O' });
    expect(counts['F&O']).toBe(2);
    expect(counts['F&O']).toBe(fnoFeed.filteredArticles.length);

    // Check every single category chip
    const fixedCategories = [
      'Crypto',
      'Commodities',
      'IPO',
      'Results',
      'Market',
      'Corporate',
      'Economy',
      'Global',
      'Technology',
      'Exchange'
    ];

    for (const cat of fixedCategories) {
      const feed = simulateV4Feed(store, { category: cat });
      expect(counts[cat]).toBeDefined();
      expect(counts[cat]).toBe(feed.filteredArticles.length);
    }
  });

  // =========================================================================
  // Test H — All feed canonical integrity
  // =========================================================================
  it('Test H: All feed canonical integrity - category=All returns the canonical dataset without secondary category duplication', async () => {
    const store = new PersistentNewsStore(tempStorePath);

    const article1 = createSyntheticArticle({
      id: 'art_multi_sec_1',
      headline: 'Article With Multiple Secondary Categories',
      primaryCategory: 'Results',
      secondaryCategories: ['Market', 'Corporate', 'F&O', 'Economy']
    });

    const article2 = createSyntheticArticle({
      id: 'art_multi_sec_2',
      headline: 'Second Article With Secondary Categories',
      primaryCategory: 'Economy',
      secondaryCategories: ['Global', 'Market']
    });

    await store.saveArticles([article1, article2]);

    const allFeed = simulateV4Feed(store, { category: 'All' });
    expect(allFeed.filteredArticles.length).toBe(2);
    
    // Ensure no duplication of IDs
    const ids = allFeed.filteredArticles.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids).toEqual(['art_multi_sec_1', 'art_multi_sec_2']);
  });

  // =========================================================================
  // Test I — Cross-Verification of Taxonomy Definitions
  // =========================================================================
  it('Test I: Taxonomy verification - CANONICAL_CATEGORIES, NEWS_CATEGORIES and checkCategories are coherent', () => {
    // 1. All UI chips in NEWS_CATEGORIES (except 'All') should be valid canonical categories
    const nonAllChips = NEWS_CATEGORIES.filter(c => c !== 'All');
    for (const chip of nonAllChips) {
      expect(CANONICAL_CATEGORIES).toContain(chip);
    }

    // 2. Canonical categories contains exactly the 10 fixed + F&O + Other
    expect(CANONICAL_CATEGORIES).toContain('F&O');
    expect(CANONICAL_CATEGORIES).toContain('Other');
    expect(CANONICAL_CATEGORIES.length).toBe(12);
  });
});
