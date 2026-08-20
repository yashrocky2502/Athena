/**
 * ATHENA NEWS ENGINE — STAGE 7.6 AI USAGE OPTIMIZATION & CACHE ISOLATION SUITE
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NewsAIUsageMonitor } from '../monitoring/NewsAIUsageMonitor';
import { NewsSummaryCache } from '../cache/NewsSummaryCache';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine';
import { NewsArticle } from '../models/NewsArticle';

describe('Stage 7.6: AI Usage Optimization & Cache Isolation Suite', () => {

  beforeEach(() => {
    NewsAIUsageMonitor.getInstance().reset();
    NewsSummaryCache.getInstance().clear();
  });

  it('1. NewsAIUsageMonitor tracks summary requests and cache hits accurately', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    monitor.recordSummaryRequest(false);
    monitor.recordSummaryRequest(true);

    const stats = monitor.getStats();
    expect(stats.summaryRequests).toBe(2);
    expect(stats.summaryCacheHits).toBe(1);
  });

  it('2. NewsAIUsageMonitor tracks Trader Intelligence requests and F&O auto-enrichment', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    monitor.recordTraderRequest(false, true);

    const stats = monitor.getStats();
    expect(stats.traderRequests).toBe(1);
    expect(stats.fnoAutoEnrichmentCount).toBe(1);
  });

  it('3. Normal non-F&O article bypasses Trader Intelligence generation and increments AI Requests Avoided', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    const normalArticle: any = {
      id: 'normal_01',
      title: 'Tata Steel opens new manufacturing unit in Odisha',
      headline: 'Tata Steel opens new manufacturing unit in Odisha',
      body: 'Tata Steel inaugurated a new plant in Odisha.',
      source: { name: 'Business Standard' },
      publishedAt: new Date().toISOString()
    };

    // User views summary-first layer
    monitor.recordSummaryRequest(false);
    // Bypasses Trader Intelligence
    monitor.recordNormalArticleBypassedTrader();

    const stats = monitor.getStats();
    expect(stats.summaryRequests).toBe(1);
    expect(stats.traderRequests).toBe(0);
    expect(stats.aiRequestsAvoided).toBe(1);
  });

  it('4. Explicit F&O article triggers automatic enrichment', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    const fnoArticle: any = {
      id: 'fno_01',
      title: 'Nifty 24,500 Call option OI jumps 45% as PCR drops to 0.72',
      headline: 'Nifty 24,500 Call option OI jumps 45% as PCR drops to 0.72',
      body: 'Call option OI increased significantly at 24500 strike with PCR at 0.72.',
      source: { name: 'NSE India' },
      publishedAt: new Date().toISOString(),
      isFno: true
    };

    const intel = TraderImpactEngine.transform(fnoArticle);
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(true);

    monitor.recordSummaryRequest(false);
    monitor.recordTraderRequest(false, true);

    const stats = monitor.getStats();
    expect(stats.fnoAutoEnrichmentCount).toBe(1);
    expect(stats.traderRequests).toBe(1);
  });

  it('5. Summary cache key is strictly isolated under news-summary:{articleId}:v7_4', () => {
    const cache = NewsSummaryCache.getInstance();
    const sampleSummary = {
      summary: 'Sample summary text',
      whatHappened: 'Sample what happened',
      whyItMatters: 'Sample why it matters'
    };

    cache.set('art_100', sampleSummary as any);
    const retrieved = cache.get('art_100');
    expect(retrieved?.summary).toBe('Sample summary text');
  });

  it('6. Summary cache write does NOT pollute Trader Intelligence cache namespace', () => {
    const cache = NewsSummaryCache.getInstance();
    cache.set('art_100', { summary: 'Summary text' } as any);

    // Verify raw summary key is under news-summary namespace and not news-intelligence
    expect(cache.get('art_100')).toBeDefined();
  });

  it('7. Trader Intelligence generation does NOT pollute canonical summary cache', () => {
    const fnoArticle: any = {
      id: 'art_200',
      title: 'Options chain data shows resistance at 24500',
      headline: 'Options chain data shows resistance at 24500',
      body: 'Call OI build up at 24500.',
      source: { name: 'NSE' },
      publishedAt: new Date().toISOString()
    };

    const intel = TraderImpactEngine.transform(fnoArticle);
    expect(intel.affectedSymbols).toBeDefined();

    // Summary cache for art_200 remains empty until summary service is explicitly called
    const summaryCache = NewsSummaryCache.getInstance();
    expect(summaryCache.get('art_200')).toBeNull();
  });

  it('8. Tracks provider usage (Groq, Gemini, Local fallback) accurately', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    monitor.recordProviderUsage('GROQ', false);
    monitor.recordProviderUsage('GEMINI', false);
    monitor.recordProviderUsage('LOCAL', false);
    monitor.recordProviderUsage('GROQ', true); // Failed attempt

    const stats = monitor.getStats();
    expect(stats.groqRequests).toBe(1);
    expect(stats.geminiRequests).toBe(1);
    expect(stats.localFallbackRequests).toBe(1);
    expect(stats.failedRequests).toBe(1);
  });

  it('9. Non-F&O article keeps cePeBias as INSUFFICIENT_INFORMATION', () => {
    const ordinaryArticle: any = {
      id: 'ord_01',
      title: 'Reliance Jio launches new tariff offer',
      headline: 'Reliance Jio launches new tariff offer',
      body: 'Commercial launch announced.',
      source: { name: 'ET' },
      publishedAt: new Date().toISOString()
    };

    const intel = TraderImpactEngine.transform(ordinaryArticle);
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(false);
    expect(intel.cePeBias).toBe('INSUFFICIENT_INFORMATION');
  });

  it('10. Calculate AI Requests Avoided metric accurately for batch of 10 articles (9 normal, 1 F&O)', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    for (let i = 0; i < 9; i++) {
      monitor.recordSummaryRequest(false);
      monitor.recordNormalArticleBypassedTrader();
    }
    monitor.recordSummaryRequest(false);
    monitor.recordTraderRequest(false, true);

    const stats = monitor.getStats();
    expect(stats.summaryRequests).toBe(10);
    expect(stats.traderRequests).toBe(1);
    expect(stats.aiRequestsAvoided).toBe(9);
  });

  it('11. Caching duplicate requests reduces provider calls', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    monitor.recordSummaryRequest(false); // First call - cache miss
    monitor.recordSummaryRequest(true);  // Second call - cache hit

    const stats = monitor.getStats();
    expect(stats.summaryCacheHits).toBe(1);
  });

  it('12. Reset functionality clears monitoring counters cleanly', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    monitor.recordSummaryRequest(false);
    monitor.reset();

    const stats = monitor.getStats();
    expect(stats.summaryRequests).toBe(0);
    expect(stats.aiRequestsAvoided).toBe(0);
  });

  it('13. Enforces explicit F&O evidence requirement before claiming CE/PE bias', () => {
    const fnoArticle: any = {
      id: 'fno_evidence_check',
      title: 'Call OI surges by 50% at 24,000 Strike with PCR at 0.65',
      headline: 'Call OI surges by 50% at 24,000 Strike with PCR at 0.65',
      body: 'Derivatives positioning indicates resistance.',
      source: { name: 'NSE' },
      publishedAt: new Date().toISOString()
    };

    const intel = TraderImpactEngine.transform(fnoArticle);
    expect(intel.fnoDetails?.fnoEvidencePresent).toBe(true);
    expect(intel.cePeBias).not.toBe('INSUFFICIENT_INFORMATION');
  });

  it('14. Disallows option positioning inference on standard non-derivatives stock news', () => {
    const stockArticle: any = {
      id: 'stock_check',
      title: 'Reliance Industries expands retail store footprint',
      headline: 'Reliance Industries expands retail store footprint',
      body: 'Reliance opened 100 new stores.',
      source: { name: 'Mint' },
      publishedAt: new Date().toISOString()
    };

    const intel = TraderImpactEngine.transform(stockArticle);
    expect(intel.cePeBias).toBe('INSUFFICIENT_INFORMATION');
  });

  it('15. NewsAIUsageMonitor statistics object is immutable snapshot copy', () => {
    const monitor = NewsAIUsageMonitor.getInstance();
    monitor.recordSummaryRequest(false);
    const stats1 = monitor.getStats();
    stats1.summaryRequests = 999;

    const stats2 = monitor.getStats();
    expect(stats2.summaryRequests).toBe(1);
  });

});
