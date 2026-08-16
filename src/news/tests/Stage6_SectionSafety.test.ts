import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6: Section Safety & Non-Destructive Invariance', () => {
  it('should not mutate original article object when routing', () => {
    const rawArticle = Object.freeze({
      id: 'immutable-1',
      headline: 'RBI holds repo rate at 6.5%, maintains withdrawal of accommodation stance',
      summary: 'Monetary Policy Committee retains key benchmark interest rates.',
      primaryCategory: 'Economy',
      publishedAt: new Date().toISOString()
    });

    expect(() => NewsSectionRouter.routeArticle(rawArticle)).not.toThrow();
    const routed = NewsSectionRouter.routeArticle(rawArticle);
    expect(routed.primarySection).toBe(NewsSectionId.ECONOMY);
    // Confirm rawArticle was not mutated
    expect((rawArticle as any).primarySection).toBeUndefined();
  });

  it('should gracefully handle corrupt or null inputs without throwing exceptions', () => {
    expect(() => NewsSectionRouter.routeArticle(null)).not.toThrow();
    expect(() => NewsSectionRouter.routeArticle({})).not.toThrow();
    expect(() => NewsSectionRouter.routeArticle({ headline: null, summary: undefined })).not.toThrow();

    const nullResult = NewsSectionRouter.routeArticle(null);
    expect(nullResult.primarySection).toBe(NewsSectionId.MARKET);
    expect(nullResult.secondarySections).toEqual([]);
  });

  it('should guarantee no secondary section duplicates the primary section', () => {
    const article = {
      id: 'dup-guard-1',
      headline: 'SEBI regulatory order regarding stock exchanges and derivatives trading rules',
      primaryCategory: 'Regulatory',
      isFnO: true,
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(article);
    expect(routed.secondarySections).not.toContain(routed.primarySection);
  });
});
