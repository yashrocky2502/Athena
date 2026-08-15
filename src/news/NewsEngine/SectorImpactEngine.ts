import { ArticleContent } from './ArticleContent';

export interface SectorImpactData {
  sector: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  score: number; // -100 to +100 (netScore)
  netScore: number; // -100 to +100
  bullishScore: number; // 0 to 100
  bearishScore: number; // 0 to 100
  confidence: number; // 0 to 100
  trendArrow: '↑' | '↓' | '→';
  keyDrivers: string[];
  articleCount: number;
}

export class SectorImpactEngine {
  private static instance: SectorImpactEngine;

  public static readonly SUPPORTED_SECTORS = [
    'Banking',
    'IT',
    'Auto',
    'Energy',
    'PSU',
    'Defence',
    'Metals',
    'Pharma',
    'Telecom',
    'FMCG',
    'Real Estate',
    'Chemicals',
    'Infrastructure',
    'Utilities',
    'Renewables'
  ];

  private sectorStats: Map<string, { bullish: number; bearish: number; neutral: number; drivers: string[] }> = new Map();

  public static getInstance(): SectorImpactEngine {
    if (!SectorImpactEngine.instance) {
      SectorImpactEngine.instance = new SectorImpactEngine();
    }
    return SectorImpactEngine.instance;
  }

  public processArticle(article: ArticleContent): SectorImpactData[] {
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || article.cleanText || '').trim();
    const text = `${headline} ${body}`.toLowerCase();
    const direction = article.athenaIntelligence?.marketImpact?.direction || 'NEUTRAL';

    const affectedSectors: string[] = [];

    // Keyword mapping for 15 sectors
    if (text.includes('bank') || text.includes('nii') || text.includes('npa') || text.includes('rbi') || text.includes('credit growth')) affectedSectors.push('Banking');
    if (text.includes('software') || text.includes('it services') || text.includes('tech') || text.includes('tcs') || text.includes('infosys') || text.includes('cloud')) affectedSectors.push('IT');
    if (text.includes('auto') || text.includes('vehicle') || text.includes('car') || text.includes('ev ') || text.includes('motor')) affectedSectors.push('Auto');
    if (text.includes('oil') || text.includes('gas') || text.includes('crude') || text.includes('petroleum') || text.includes('refining')) affectedSectors.push('Energy');
    if (text.includes('psu') || text.includes('public sector') || text.includes('state-owned')) affectedSectors.push('PSU');
    if (text.includes('defence') || text.includes('defense') || text.includes('military') || text.includes('armament')) affectedSectors.push('Defence');
    if (text.includes('steel') || text.includes('metal') || text.includes('aluminum') || text.includes('copper') || text.includes('iron ore')) affectedSectors.push('Metals');
    if (text.includes('pharma') || text.includes('drug') || text.includes('fda') || text.includes('healthcare') || text.includes('clinical')) affectedSectors.push('Pharma');
    if (text.includes('telecom') || text.includes('5g') || text.includes('airtel') || text.includes('spectrum')) affectedSectors.push('Telecom');
    if (text.includes('fmcg') || text.includes('consumer staples') || text.includes('rural demand') || text.includes('itc')) affectedSectors.push('FMCG');
    if (text.includes('real estate') || text.includes('housing') || text.includes('reit') || text.includes('property')) affectedSectors.push('Real Estate');
    if (text.includes('chemical') || text.includes('agrochemical') || text.includes('specialty chemical')) affectedSectors.push('Chemicals');
    if (text.includes('infra') || text.includes('construction') || text.includes('highway') || text.includes('bridge') || text.includes('road')) affectedSectors.push('Infrastructure');
    if (text.includes('power') || text.includes('utility') || text.includes('grid') || text.includes('electricity')) affectedSectors.push('Utilities');
    if (text.includes('solar') || text.includes('renewable') || text.includes('wind') || text.includes('green energy')) affectedSectors.push('Renewables');

    const updated: SectorImpactData[] = [];

    affectedSectors.forEach(sec => {
      let stats = this.sectorStats.get(sec);
      if (!stats) {
        stats = { bullish: 0, bearish: 0, neutral: 0, drivers: [] };
        this.sectorStats.set(sec, stats);
      }

      if (direction === 'BULLISH') stats.bullish += 1;
      else if (direction === 'BEARISH') stats.bearish += 1;
      else stats.neutral += 1;

      if (headline && !stats.drivers.includes(headline)) {
        stats.drivers.unshift(headline);
        if (stats.drivers.length > 3) stats.drivers.pop();
      }

      updated.push(this.getSectorData(sec));
    });

    return updated;
  }

  public getSectorData(sector: string): SectorImpactData {
    const stats = this.sectorStats.get(sector) || { bullish: 0, bearish: 0, neutral: 0, drivers: [] };
    const total = stats.bullish + stats.bearish + stats.neutral;

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' = 'NEUTRAL';
    let score = 0;
    let bullishScore = 0;
    let bearishScore = 0;
    let trendArrow: '↑' | '↓' | '→' = '→';

    if (total > 0) {
      bullishScore = Math.round((stats.bullish / total) * 100);
      bearishScore = Math.round((stats.bearish / total) * 100);
      score = Math.round(((stats.bullish - stats.bearish) / total) * 100);

      if (score >= 25) {
        sentiment = 'BULLISH';
        trendArrow = '↑';
      } else if (score <= -25) {
        sentiment = 'BEARISH';
        trendArrow = '↓';
      } else if (stats.bullish > 0 && stats.bearish > 0) {
        sentiment = 'MIXED';
        trendArrow = '→';
      }
    }

    const confidence = total > 0 ? Math.min(98, 70 + total * 5) : 80;

    return {
      sector,
      sentiment,
      score,
      netScore: score,
      bullishScore,
      bearishScore,
      confidence,
      trendArrow,
      keyDrivers: stats.drivers,
      articleCount: total
    };
  }

  public getAllSectors(): SectorImpactData[] {
    return SectorImpactEngine.SUPPORTED_SECTORS.map(sec => this.getSectorData(sec));
  }

  public clear(): void {
    this.sectorStats.clear();
  }
}
