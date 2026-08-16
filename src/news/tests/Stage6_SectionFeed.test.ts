import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6: SectionFeed & Section Ranking Policies', () => {
  const sampleArticles = [
    {
      id: 'art-1',
      headline: 'Reliance Industries Q3 Results: Profit rises 11% to Rs 17,265 cr',
      summary: 'Oil-to-telecom conglomerate reports strong performance in retail and O2C.',
      primaryCategory: 'Results',
      tickers: ['RELIANCE'],
      isFnO: true,
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      providerRating: 95
    },
    {
      id: 'art-2',
      headline: 'Nifty 50 surges 250 points led by banking and IT rally',
      summary: 'Benchmark indices scale fresh highs as FIIs turn net buyers.',
      primaryCategory: 'Market',
      tickers: ['NIFTY'],
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      providerRating: 90
    },
    {
      id: 'art-3',
      headline: 'SEBI mandates enhanced disclosure rules for foreign portfolio investors',
      summary: 'Capital market regulator releases new circular effective next month.',
      primaryCategory: 'Regulatory',
      publisher: 'SEBI',
      publishedAt: new Date(Date.now() - 1800000).toISOString(),
      providerRating: 98
    },
    {
      id: 'art-4',
      headline: 'Crude Oil drops 2% to $72/bbl as OPEC+ revises demand forecast',
      summary: 'Energy commodities move lower on global macro cues.',
      primaryCategory: 'Commodities',
      publishedAt: new Date(Date.now() - 5400000).toISOString(),
      providerRating: 88
    }
  ];

  it('should return paginated section feed for RESULTS section with section-specific ranking', () => {
    const feed = NewsSectionRouter.getSectionFeed(sampleArticles, NewsSectionId.RESULTS, { page: 1, limit: 10 });
    expect(feed.section).toBe(NewsSectionId.RESULTS);
    expect(feed.articles.length).toBeGreaterThanOrEqual(1);
    expect(feed.articles[0].id).toBe('art-1');
    expect(feed.articles[0].primarySection).toBe(NewsSectionId.RESULTS);
    expect(feed.articles[0].sectionRankScore).toBeGreaterThan(0);
  });

  it('should support symbol filtering in section feeds', () => {
    const feed = NewsSectionRouter.getSectionFeed(sampleArticles, NewsSectionId.RESULTS, { symbol: 'RELIANCE' });
    expect(feed.articles.length).toBe(1);
    expect(feed.articles[0].id).toBe('art-1');
  });

  it('should support search query filtering in section feeds', () => {
    const feed = NewsSectionRouter.getSectionFeed(sampleArticles, NewsSectionId.REGULATORY, { search: 'SEBI' });
    expect(feed.articles.length).toBe(1);
    expect(feed.articles[0].id).toBe('art-3');
  });

  it('should calculate section pagination accurately', () => {
    const feed = NewsSectionRouter.getSectionFeed(sampleArticles, NewsSectionId.MARKET, { page: 1, limit: 1 });
    expect(feed.limit).toBe(1);
    expect(feed.page).toBe(1);
    expect(feed.articles.length).toBe(1);
  });
});
