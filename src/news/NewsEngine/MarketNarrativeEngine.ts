import { StoryCluster } from './StoryClusterEngine';
import { MarketTheme } from './ThemeDetectionEngine';

export interface MarketNarrative {
  id: string;
  headline: string;
  summary: string;
  keyDrivers: string[];
  dominantThemes: string[];
  prevailingSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  topClusters: string[];
  updatedAt: string;
}

export class MarketNarrativeEngine {
  private static instance: MarketNarrativeEngine;
  private currentNarrative: MarketNarrative | null = null;

  public static getInstance(): MarketNarrativeEngine {
    if (!MarketNarrativeEngine.instance) {
      MarketNarrativeEngine.instance = new MarketNarrativeEngine();
    }
    return MarketNarrativeEngine.instance;
  }

  /**
   * Synthesizes top story clusters and active themes into a single unified narrative.
   */
  public generate(clusters: StoryCluster[], themes: MarketTheme[]): MarketNarrative {
    const topClusters = clusters.slice(0, 5);
    const topThemes = themes.slice(0, 5);

    const drivers: string[] = [];
    const themeNames: string[] = [];
    let bullishCount = 0;
    let bearishCount = 0;

    topClusters.forEach(c => {
      drivers.push(c.title);
      if (c.marketImpact === 'BULLISH') bullishCount++;
      if (c.marketImpact === 'BEARISH') bearishCount++;
    });

    topThemes.forEach(t => {
      themeNames.push(t.theme);
    });

    let prevailingSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' = 'NEUTRAL';
    if (bullishCount > bearishCount && bullishCount >= 2) prevailingSentiment = 'BULLISH';
    else if (bearishCount > bullishCount && bearishCount >= 2) prevailingSentiment = 'BEARISH';
    else if (bullishCount > 0 && bearishCount > 0) prevailingSentiment = 'MIXED';

    let headline = 'Markets Consolidate Amidst Mixed Corporate and Macro Cues';
    if (drivers.length > 0) {
      if (prevailingSentiment === 'BULLISH') {
        headline = `Markets Driven Higher by ${themeNames.slice(0, 2).join(' and ')} Momentum & Solid Earnings Disclosures`;
      } else if (prevailingSentiment === 'BEARISH') {
        headline = `Markets Under Pressure Citing Headwinds in ${themeNames.slice(0, 2).join(' and ')}`;
      } else if (themeNames.length > 0) {
        headline = `Market Focus Centers Around ${themeNames.slice(0, 3).join(', ')}`;
      }
    }

    const summary = `Institutional focus remains locked on ${themeNames.join(', ') || 'macro indicators'}. Key market drivers include ${drivers.slice(0, 3).join('; ') || 'ongoing corporate earnings and regulatory policy disclosures'}. Risk appetite reflects a ${prevailingSentiment.toLowerCase()} undertone as investors balance valuation dynamics with growth expectations.`;

    this.currentNarrative = {
      id: `narrative_${Date.now()}`,
      headline,
      summary,
      keyDrivers: drivers.slice(0, 5),
      dominantThemes: themeNames.slice(0, 5),
      prevailingSentiment,
      topClusters: topClusters.map(c => c.id),
      updatedAt: new Date().toISOString()
    };

    return this.currentNarrative;
  }

  public getNarrative(): MarketNarrative | null {
    return this.currentNarrative;
  }
}
