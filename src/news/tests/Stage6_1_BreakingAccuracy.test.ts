import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6.1: Breaking News Accuracy & Overlay', () => {
  it('should correctly identify breaking news based on urgency flags and freshness', () => {
    const breakingArt = {
      id: 'break-1',
      headline: 'BREAKING: RBI announces emergency liquidity injection of Rs 50,000 crore',
      isBreaking: true,
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(breakingArt);
    expect(routed.secondarySections.includes(NewsSectionId.BREAKING) || routed.primarySection === NewsSectionId.BREAKING).toBe(true);
  });

  it('should not force breaking primary status when macroeconomic topic is primary', () => {
    const macroBreaking = {
      id: 'break-macro-1',
      headline: 'URGENT: GDP growth accelerates to 7.8% in Q1 according to official statistics',
      primaryCategory: 'Economy',
      isBreaking: true,
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(macroBreaking);
    // Primary section should be ECONOMY, with BREAKING as secondary overlay
    expect(routed.primarySection).toBe(NewsSectionId.ECONOMY);
    expect(routed.secondarySections).toContain(NewsSectionId.BREAKING);
  });
});
