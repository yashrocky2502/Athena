import { ArticleContent } from './ArticleContent';

export interface EventCorrelation {
  id: string;
  triggerArticleId: string;
  connectedArticleIds: string[];
  chainSummary: string;
  origin: string;
  intermediateEvents: string[];
  finalImpact: string;
  confidence: number;
  involvedEntities: string[];
  transmissionSectors: string[];
  correlationScore: number; // 0-100
}

export class EventCorrelationEngine {
  private static instance: EventCorrelationEngine;
  private correlations: EventCorrelation[] = [];

  public static getInstance(): EventCorrelationEngine {
    if (!EventCorrelationEngine.instance) {
      EventCorrelationEngine.instance = new EventCorrelationEngine();
    }
    return EventCorrelationEngine.instance;
  }

  public processArticle(article: ArticleContent, recentArticles: ArticleContent[] = []): EventCorrelation | null {
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || article.cleanText || '').trim();
    const text = `${headline} ${body}`.toLowerCase();
    const articleId = (article as any).id || article.url || headline;

    const entities: string[] = [];
    if (article.knowledge?.companies) {
      article.knowledge.companies.forEach((c: any) => {
        if (c.name) entities.push(c.name);
        if (c.symbol) entities.push(c.symbol);
      });
    }

    // Known Macro & Micro Chain Heuristics
    let chainSummary = '';
    let origin = '';
    let intermediateEvents: string[] = [];
    let finalImpact = '';
    const transmissionSectors: string[] = [];

    if (text.includes('fed') || text.includes('interest rate') || text.includes('us fed')) {
      origin = 'US Federal Reserve Interest Rate Stance';
      intermediateEvents = ['USD Index Dynamics', 'Emerging Market Capital Flows'];
      finalImpact = 'Indian IT & High Growth Tech Valuations Shift';
      chainSummary = 'US Fed monetary stance -> USD index dynamics -> Emerging market capital flows -> Indian IT & Equity valuations';
      transmissionSectors.push('IT', 'Banking', 'Global Markets');
    } else if (text.includes('rbi') || text.includes('repo rate')) {
      origin = 'RBI Repo Rate Policy Announcement';
      intermediateEvents = ['Systemic Liquidity Adjustment', '10Y Yield Curve Compression'];
      finalImpact = 'Bank Nifty & Financials NIM Margin Re-expansion';
      chainSummary = 'RBI Policy decision -> Systemic liquidity & bond yield reaction -> Bank NII & credit growth expectations';
      transmissionSectors.push('Banking', 'NBFC', 'Real Estate');
    } else if (text.includes('crude oil') || text.includes('brent')) {
      origin = 'Crude Oil Supply Shifts & OPEC+ Decisions';
      intermediateEvents = ['OMC Refining Margin Fluctuations', 'Corporate Input Cost Relief'];
      finalImpact = 'Aviation, Paint & Automotive Margin Expansion';
      chainSummary = 'Crude Oil price shifts -> OMC refining margins & input cost pressures -> Automotive & Aviation sector profitability';
      transmissionSectors.push('Energy', 'Auto', 'FMCG');
    } else if (text.includes('gold') || text.includes('precious metal')) {
      origin = 'Global Geopolitical Safe-Haven Asset Allocation';
      intermediateEvents = ['Rupee Currency Hedging', 'Bullion Collateral Re-valuation'];
      finalImpact = 'Jeweller Retail Volumes & Gold NBFC Loan Growth';
      chainSummary = 'Safe-haven asset flows -> Currency hedging -> Jewellers & NBFC gold loan collateral quality';
      transmissionSectors.push('Commodities', 'NBFC', 'Consumer');
    } else if (text.includes('earnings') || text.includes('net profit') || text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4')) {
      origin = 'Quarterly Corporate Earnings & Operational Guidance';
      intermediateEvents = ['EBITDA Margin Trajectory', 'Institutional Consensus Earnings Revision'];
      finalImpact = 'Sector Re-rating & Capital Re-allocation';
      chainSummary = 'Quarterly earnings performance -> Operating leverage & margin trajectory -> Institutional re-rating & sector rotation';
      transmissionSectors.push(article.intelligence?.classification?.domain || 'Equity Markets');
    }

    if (!chainSummary) {
      return null;
    }

    // Find connected articles from recent set
    const connectedIds: string[] = [];
    recentArticles.forEach(a => {
      const aId = (a as any).id || a.url || a.headline;
      if (aId !== articleId) {
        const aText = `${a.headline} ${a.body}`.toLowerCase();
        if (transmissionSectors.some(sec => aText.includes(sec.toLowerCase()))) {
          connectedIds.push(aId);
        }
      }
    });

    const correlation: EventCorrelation = {
      id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      triggerArticleId: articleId,
      connectedArticleIds: connectedIds.slice(0, 4),
      chainSummary,
      origin,
      intermediateEvents,
      finalImpact,
      confidence: Math.min(98, 80 + connectedIds.length * 4),
      involvedEntities: Array.from(new Set(entities)).slice(0, 5),
      transmissionSectors: Array.from(new Set(transmissionSectors)),
      correlationScore: Math.min(98, 75 + connectedIds.length * 5)
    };

    this.correlations.unshift(correlation);
    if (this.correlations.length > 20) this.correlations.pop();

    return correlation;
  }

  public getCorrelations(): EventCorrelation[] {
    return this.correlations;
  }

  public clear(): void {
    this.correlations = [];
  }
}
