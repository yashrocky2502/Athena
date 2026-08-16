import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6.1: F&O Section Accuracy & Relevance', () => {
  it('should correctly route derivatives-sensitive news to F&O section', () => {
    const fnoArt = {
      id: 'fno-test-1',
      headline: 'BankNifty sees massive short covering ahead of weekly options expiry with high open interest',
      isFnO: true,
      primaryCategory: 'F&O'
    };

    const routed = NewsSectionRouter.routeArticle(fnoArt);
    expect(routed.primarySection === NewsSectionId.FNO || routed.secondarySections.includes(NewsSectionId.FNO)).toBe(true);
  });

  it('should not automatically classify generic corporate mentions as F&O', () => {
    const genericArt = {
      id: 'gen-art-1',
      headline: 'Company holds annual general meeting for shareholders',
      primaryCategory: 'Corporate'
    };

    const routed = NewsSectionRouter.routeArticle(genericArt);
    expect(routed.primarySection).not.toBe(NewsSectionId.FNO);
    expect(routed.secondarySections).not.toContain(NewsSectionId.FNO);
  });
});
