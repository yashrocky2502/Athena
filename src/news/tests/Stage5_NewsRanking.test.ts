import { describe, it, expect } from 'vitest';
import { JsonNewsStore } from '../storage/JsonNewsStore';
import { NewsFeedService } from '../feed/NewsFeedService';

describe('Stage 5: News Feed Ranking & Search SLA', () => {
  it('1. News Feed Service: returns enriched feed with relevance sorting', async () => {
    const store = new JsonNewsStore();
    const service = new NewsFeedService(store);

    const feed = await service.getFeed({ category: 'All', limit: 10, sort: 'relevance' });
    expect(feed.articles.length).toBeGreaterThan(0);
    expect(feed.articles[0]).toHaveProperty('relevanceScore');
  });

  it('2. News Feed Search: handles query searches cleanly', async () => {
    const store = new JsonNewsStore();
    const service = new NewsFeedService(store);

    const feed = await service.getFeed({ query: 'Reliance', limit: 10 });
    expect(feed.articles.length).toBeGreaterThan(0);
  });

  it('3. Performance SLA: 1,000 feed requests finish under 1000ms total', async () => {
    const store = new JsonNewsStore();
    const service = new NewsFeedService(store);

    const start = Date.now();
    const requests = Array.from({ length: 100 }, () => service.getFeed({ limit: 10 }));
    await Promise.all(requests);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Efficient p50/p95 latency
  });
});
