import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6: Section Router Determinism & Latency Performance', () => {
  const testArticle = {
    id: 'det-test-100',
    headline: 'Infosys Q3 Results preview: IT major expected to report 5% revenue growth, CC guidance in focus',
    summary: 'Bengaluru-headquartered IT services leader will announce third quarter earnings on Thursday. F&O call option open interest rises.',
    primaryCategory: 'Results',
    tickers: ['INFY'],
    sectors: ['Technology'],
    isFnO: true,
    publishedAt: new Date().toISOString()
  };

  it('should produce identical primary, secondary, and section scores across 100 consecutive executions', () => {
    const initialRoute = NewsSectionRouter.routeArticle(testArticle);

    for (let i = 0; i < 100; i++) {
      const currentRoute = NewsSectionRouter.routeArticle(testArticle);
      expect(currentRoute.primarySection).toBe(initialRoute.primarySection);
      expect(currentRoute.secondarySections).toEqual(initialRoute.secondarySections);
      expect(currentRoute.sectionScores).toEqual(initialRoute.sectionScores);
    }
  });

  it('should meet the p50 < 15ms routing execution latency requirement', () => {
    const latencies: number[] = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      NewsSectionRouter.routeArticle(testArticle);
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length / 2)];

    expect(p50).toBeLessThan(15);
  });
});
