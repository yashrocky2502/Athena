import { describe, it, expect } from 'vitest';
import { SyndicationEngine } from '../intelligence/SyndicationEngine';
import { NewsArticle } from '../types/Article';

describe('Stage 5: Syndication & Duplicate Alert Suppression', () => {
  it('1. Clusters syndicated articles with identical headlines into a single story', () => {
    const articles: NewsArticle[] = [
      {
        id: 'A1',
        headline: 'RBI Keeps Repo Rate Unchanged at 6.5%',
        body: 'The RBI kept rates steady.',
        publishedAt: '2026-08-16T10:00:00Z',
        publisher: { name: 'Reuters', url: '' },
      } as any,
      {
        id: 'A2',
        headline: 'RBI Keeps Repo Rate Unchanged at 6.5%',
        body: 'The RBI announced rate decision.',
        publishedAt: '2026-08-16T10:05:00Z',
        publisher: { name: 'Economic Times', url: '' },
      } as any,
    ];

    const clustered = SyndicationEngine.clusterArticles(articles);
    expect(clustered.length).toBe(1);
    expect(clustered[0].sourceCount).toBe(2);
    expect(clustered[0].sources).toContain('Reuters');
    expect(clustered[0].sources).toContain('Economic Times');
  });
});
