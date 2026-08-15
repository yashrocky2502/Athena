import { ArticleContent } from './ArticleContent';

export interface MarketTheme {
  id: string;
  theme: string;
  mentionsCount: number;
  growthRate: number; // e.g. +31
  confidence: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendStrength: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'WEAKENING';
  affectedSymbols: string[];
  topArticles: string[];
  lastUpdated: string;
}

export class ThemeDetectionEngine {
  private static instance: ThemeDetectionEngine;
  private themesMap: Map<string, MarketTheme> = new Map();

  // Known Theme Definition Rules
  private static readonly THEME_KEYWORDS: Record<string, string[]> = {
    'Artificial Intelligence': ['ai', 'artificial intelligence', 'llm', 'generative ai', 'machine learning', 'cloud computing'],
    'Semiconductors': ['semiconductor', 'chipmaker', 'foundry', 'silicon', 'fab', 'microchip'],
    'Defence': ['defence', 'defense', 'hal', 'bel', 'mazagon', 'artillery', 'munitions', 'ordnance'],
    'PSU': ['psu', 'public sector', 'state-run', 'pfc', 'rec', 'ntpc', 'sbi', 'coal india'],
    'Power & Utilities': ['power sector', 'power generation', 'electricity', 'grid', 'transformer', 'substation'],
    'Renewables & Green Energy': ['renewable', 'solar', 'wind energy', 'green hydrogen', 'clean energy', 'sustainability'],
    'Banking': ['banking', 'banks', 'nii', 'npa', 'repo rate', 'loan growth', 'deposits', 'credit growth'],
    'NBFC & Financials': ['nbfc', 'non-banking', 'microfinance', 'lending', 'asset quality', 'aum'],
    'Information Technology': ['it services', 'software', 'digital transformation', 'attrition', 'deal win', 'tcs', 'infosys', 'wipro'],
    'Pharma & Healthcare': ['pharma', 'healthcare', 'us fda', 'drug approval', 'abbreviated new drug', 'clinical trial'],
    'Telecom': ['telecom', '5g', 'arpu', 'spectrum', 'airtel', 'jio', 'telecommunication'],
    'Real Estate': ['real estate', 'housing', 'residential sales', 'reit', 'commercial space', 'construction'],
    'FMCG & Consumer': ['fmcg', 'consumer staples', 'rural demand', 'volume growth', 'hustle', 'itc'],
    'Auto & Mobility': ['auto', 'automotive', 'passenger vehicle', 'commercial vehicle', 'two wheeler', 'sales volume'],
    'Electric Vehicles (EV)': ['ev', 'electric vehicle', 'battery', 'charging infrastructure', 'pli scheme'],
    'Metals & Mining': ['metals', 'steel', 'aluminum', 'iron ore', 'copper', 'mining'],
    'Oil & Gas': ['oil', 'gas', 'crude', 'brent', 'o2c', 'refining margin', 'omc', 'petroleum'],
    'Crypto & Digital Assets': ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'web3', 'digital asset'],
    'Inflation & Macro': ['inflation', 'cpi', 'wpi', 'consumer price', 'cost pressures'],
    'Interest Rates & Central Banks': ['interest rate', 'rbi', 'fed', 'monetary policy', 'rate cut', 'rate hike', 'yield'],
    'Government Policy & PLI': ['government policy', 'pli', 'incentive', 'union budget', 'regulation', 'subsidy'],
    'Exports & Global Trade': ['export', 'import', 'current account', 'trade deficit', 'tariff', 'foreign trade'],
    'Global Markets & Sentiment': ['wall street', 'nasdaq', 's&p 500', 'global cues', 'fed stance']
  };

  public static getInstance(): ThemeDetectionEngine {
    if (!ThemeDetectionEngine.instance) {
      ThemeDetectionEngine.instance = new ThemeDetectionEngine();
    }
    return ThemeDetectionEngine.instance;
  }

  public processArticle(article: ArticleContent): MarketTheme[] {
    const headline = (article.headline || article.title || '').toLowerCase();
    const body = (article.body || article.cleanText || '').toLowerCase();
    const fullText = `${headline} ${body}`;
    const articleId = (article as any).id || article.url || headline;
    const detected: MarketTheme[] = [];

    // Extract symbols
    const symbols: string[] = [];
    if (article.knowledge?.companies) {
      article.knowledge.companies.forEach((c: any) => {
        if (c.symbol) symbols.push(c.symbol.toUpperCase());
      });
    }

    for (const [themeName, keywords] of Object.entries(ThemeDetectionEngine.THEME_KEYWORDS)) {
      const isMatched = keywords.some(kw => {
        if (kw.length <= 3) {
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          return regex.test(fullText);
        }
        return fullText.includes(kw);
      });

      if (isMatched) {
        let theme = this.themesMap.get(themeName);
        const articleDirection = article.athenaIntelligence?.marketImpact?.direction || 'NEUTRAL';

        if (!theme) {
          theme = {
            id: `theme_${themeName.replace(/\s+/g, '_').toLowerCase()}`,
            theme: themeName,
            mentionsCount: 0,
            growthRate: 15,
            confidence: 90,
            direction: articleDirection as any,
            trendStrength: 'MODERATE',
            affectedSymbols: [],
            topArticles: [],
            lastUpdated: new Date().toISOString()
          };
          this.themesMap.set(themeName, theme);
        }

        theme.mentionsCount += 1;
        theme.growthRate = Math.min(100, Math.round(theme.growthRate + 4));
        theme.confidence = Math.min(99, Math.round(85 + (theme.mentionsCount * 1.5)));
        theme.lastUpdated = new Date().toISOString();
        if (articleDirection !== 'NEUTRAL') {
          theme.direction = articleDirection as any;
        }

        if (!theme.topArticles.includes(articleId)) {
          theme.topArticles.unshift(articleId);
          if (theme.topArticles.length > 5) theme.topArticles.pop();
        }

        symbols.forEach(sym => {
          if (!theme!.affectedSymbols.includes(sym)) {
            theme!.affectedSymbols.push(sym);
          }
        });

        // Determine trend strength
        if (theme.mentionsCount >= 10 || theme.growthRate > 50) {
          theme.trendStrength = 'VERY_STRONG';
        } else if (theme.mentionsCount >= 5 || theme.growthRate > 25) {
          theme.trendStrength = 'STRONG';
        } else if (theme.mentionsCount >= 2) {
          theme.trendStrength = 'MODERATE';
        } else {
          theme.trendStrength = 'WEAK';
        }

        detected.push(theme);
      }
    }

    return detected;
  }

  public getThemes(): MarketTheme[] {
    return Array.from(this.themesMap.values()).sort((a, b) => b.mentionsCount - a.mentionsCount);
  }

  public clear(): void {
    this.themesMap.clear();
  }
}
