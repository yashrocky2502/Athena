import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6.1: Section Ranking Quality & Freshness', () => {
  const articles = [
    {
      id: 'rank-fresh',
      headline: 'Fresh high impact results announcement',
      primaryCategory: 'Results',
      publishedAt: new Date(Date.now() - 600000).toISOString(),
      providerRating: 95
    },
    {
      id: 'rank-stale',
      headline: 'Older low impact results announcement',
      primaryCategory: 'Results',
      publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      providerRating: 70
    }
  ];

  it('should rank fresher, higher-authority articles higher in section feeds', () => {
    const feed = NewsSectionRouter.getSectionFeed(articles, NewsSectionId.RESULTS);
    expect(feed.articles[0].id).toBe('rank-fresh');
  });
});
