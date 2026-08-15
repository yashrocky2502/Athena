import { MarketTheme } from './ThemeDetectionEngine';

export interface TrendStrength {
  themeOrSymbol: string;
  mentionCount: number;
  velocity24h: number; // e.g., +31
  trendLabel: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'WEAKENING';
  score: number; // 0-100
}

export class TrendStrengthEngine {
  private static instance: TrendStrengthEngine;

  public static getInstance(): TrendStrengthEngine {
    if (!TrendStrengthEngine.instance) {
      TrendStrengthEngine.instance = new TrendStrengthEngine();
    }
    return TrendStrengthEngine.instance;
  }

  public analyzeTheme(theme: MarketTheme): TrendStrength {
    const mentionCount = theme.mentionsCount;
    const velocity = theme.growthRate;
    
    let score = Math.min(100, Math.round(mentionCount * 8 + velocity * 0.6));
    let trendLabel: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'WEAKENING' = 'MODERATE';

    if (score >= 80) trendLabel = 'VERY_STRONG';
    else if (score >= 60) trendLabel = 'STRONG';
    else if (score >= 40) trendLabel = 'MODERATE';
    else if (velocity < 0) trendLabel = 'WEAKENING';
    else trendLabel = 'WEAK';

    return {
      themeOrSymbol: theme.theme,
      mentionCount,
      velocity24h: velocity,
      trendLabel,
      score
    };
  }

  public analyzeAllThemes(themes: MarketTheme[]): TrendStrength[] {
    return themes.map(t => this.analyzeTheme(t)).sort((a, b) => b.score - a.score);
  }
}
