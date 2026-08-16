import { describe, it, expect } from 'vitest';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';

describe('Stage 6.1: Section Accuracy Evaluation', () => {
  const corpus = [
    {
      id: 'res-1',
      headline: 'TCS Q3 Net Profit rises 15% to Rs 11,380 crore, declares dividend',
      primaryCategory: 'Results',
      publisher: 'Moneycontrol'
    },
    {
      id: 'reg-1',
      headline: 'SEBI revises weekly options expiry and margin rules for derivatives',
      primaryCategory: 'Regulatory',
      publisher: 'SEBI'
    },
    {
      id: 'ipo-1',
      headline: 'Swiggy IPO subscribed 3.5x on final day of bidding',
      primaryCategory: 'IPO',
      publisher: 'Economic Times'
    },
    {
      id: 'fno-1',
      headline: 'Nifty futures see long buildup with 12% rise in open interest',
      primaryCategory: 'F&O',
      isFnO: true,
      publisher: 'Bloomberg Quint'
    },
    {
      id: 'eco-1',
      headline: 'RBI holds repo rate at 6.5% in monetary policy committee review',
      primaryCategory: 'Economy',
      publisher: 'RBI'
    },
    {
      id: 'com-1',
      headline: 'Crude Oil prices drop 2.5% on US inventory build',
      primaryCategory: 'Commodities',
      publisher: 'Reuters'
    },
    {
      id: 'bank-1',
      headline: 'HDFC Bank reports strong credit growth and stable NIM in quarterly update',
      primaryCategory: 'Banking',
      tickers: ['HDFCBANK']
    },
    {
      id: 'tech-1',
      headline: 'Infosys wins $500M digital transformation contract with European bank',
      primaryCategory: 'Technology',
      tickers: ['INFY']
    }
  ];

  it('should achieve >= 90% primary accuracy across evaluation corpus', () => {
    let correctCount = 0;
    const expectations: Record<string, NewsSectionId> = {
      'res-1': NewsSectionId.RESULTS,
      'reg-1': NewsSectionId.REGULATORY,
      'ipo-1': NewsSectionId.IPO,
      'fno-1': NewsSectionId.FNO,
      'eco-1': NewsSectionId.ECONOMY,
      'com-1': NewsSectionId.COMMODITIES,
      'bank-1': NewsSectionId.BANKING,
      'tech-1': NewsSectionId.TECHNOLOGY
    };

    for (const item of corpus) {
      const routed = NewsSectionRouter.routeArticle(item);
      const expected = expectations[item.id];
      if (routed.primarySection === expected) {
        correctCount++;
      }
    }

    const accuracy = (correctCount / corpus.length) * 100;
    expect(accuracy).toBeGreaterThanOrEqual(90);
  });

  it('should maintain category and section separation', () => {
    const art = {
      id: 'sep-1',
      headline: 'GDP growth and fiscal deficit data released by MOSPI',
      primaryCategory: 'General'
    };

    const routed = NewsSectionRouter.routeArticle(art);
    // Even if category is General, content routes it to ECONOMY
    expect(routed.primarySection).toBe(NewsSectionId.ECONOMY);
    expect(art.primaryCategory).toBe('General'); // Immutability of original property
  });
});
