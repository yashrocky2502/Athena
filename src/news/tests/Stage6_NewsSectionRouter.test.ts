import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId, getAllSectionDefinitions, isValidSectionId } from '../types/NewsSection';

describe('Stage 6: NewsSectionRouter - Taxonomy & Classification', () => {
  it('should define all 16 fixed news sections correctly', () => {
    const definitions = getAllSectionDefinitions();
    expect(definitions.length).toBe(16);
    expect(definitions.map(d => d.id)).toEqual(
      expect.arrayContaining(Object.values(NewsSectionId))
    );
  });

  it('should correctly route an Earnings/Results article to RESULTS section', () => {
    const article = {
      id: 'art-results-1',
      headline: 'TCS Q3 Net Profit jumps 11% to Rs 11,058 crore, declares dividend',
      summary: 'IT major Tata Consultancy Services reported quarterly results with revenue up 8%.',
      primaryCategory: 'Results',
      publisher: 'Moneycontrol',
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(article);
    expect(routed.primarySection).toBe(NewsSectionId.RESULTS);
    expect(routed.sectionScores[NewsSectionId.RESULTS]).toBeGreaterThan(60);
  });

  it('should correctly route a Regulatory article to REGULATORY section', () => {
    const article = {
      id: 'art-reg-1',
      headline: 'SEBI issues new circular on margin requirements and weekly options expiry',
      summary: 'Capital markets regulator SEBI introduced revised risk management rules for F&O segment.',
      primaryCategory: 'Regulatory',
      publisher: 'SEBI',
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(article);
    expect(routed.primarySection).toBe(NewsSectionId.REGULATORY);
  });

  it('should correctly route an IPO article to IPO section', () => {
    const article = {
      id: 'art-ipo-1',
      headline: 'Swiggy IPO subscribed 3.5x on final day, grey market premium holds firm',
      summary: 'Initial public offer of food delivery giant closes with strong institutional demand.',
      primaryCategory: 'IPO',
      publisher: 'Economic Times',
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(article);
    expect(routed.primarySection).toBe(NewsSectionId.IPO);
  });

  it('should attach secondary sections when evidence score is sufficient', () => {
    const article = {
      id: 'art-multi-1',
      headline: 'HDFC Bank Q2 Results: Net profit up 18%, NPA metrics improve in banking segment',
      summary: 'India largest private lender announced quarterly earnings, with Call Option open interest building in BankNifty.',
      primaryCategory: 'Results',
      tickers: ['HDFCBANK', 'BANKNIFTY'],
      isFnO: true,
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(article);
    expect(routed.primarySection).toBe(NewsSectionId.RESULTS);
    expect(routed.secondarySections).toEqual(
      expect.arrayContaining([NewsSectionId.BANKING, NewsSectionId.FNO, NewsSectionId.STOCKS])
    );
    expect(routed.secondarySections).not.toContain(routed.primarySection);
  });

  it('should handle priority matrix resolution during score ties', () => {
    const article = {
      id: 'art-tie-1',
      headline: 'SEBI circular regarding quarterly financial disclosures by listed companies',
      summary: 'Regulatory order affecting corporate results reporting.',
      primaryCategory: 'General',
      publishedAt: new Date().toISOString()
    };

    const routed = NewsSectionRouter.routeArticle(article);
    // REGULATORY has higher priority in matrix than RESULTS or CORPORATE
    expect(routed.primarySection).toBe(NewsSectionId.REGULATORY);
  });
});
