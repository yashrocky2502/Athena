import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';

describe('Stage 6.1: Production Safety & Immutability', () => {
  it('should not mutate original input article objects during routing', () => {
    const article = {
      id: 'safety-1',
      headline: 'SEBI and RBI update regulatory guidelines',
      primaryCategory: 'Regulatory'
    };

    const frozen = Object.freeze({ ...article });
    const routed = NewsSectionRouter.routeArticle(frozen);

    expect(routed.primarySection).toBeDefined();
    expect((frozen as any).primarySection).toBeUndefined();
  });
});
