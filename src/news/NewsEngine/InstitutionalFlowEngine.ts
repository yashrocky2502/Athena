import { SectorImpactData } from './SectorImpactEngine';
import { MarketTheme } from './ThemeDetectionEngine';

export interface InstitutionalFlow {
  regime: 'ACCUMULATION' | 'DISTRIBUTION' | 'RISK_OFF' | 'RISK_ON' | 'DEFENSIVE_ROTATION' | 'CYCLICAL_ROTATION' | 'SECTOR_ROTATION' | 'FLIGHT_TO_SAFETY' | 'HIGH_CONVICTION' | 'WEAK_CONVICTION';
  reasoning: string;
  favoredSectors: string[];
  outflowSectors: string[];
  confidence: number;
}

export class InstitutionalFlowEngine {
  private static instance: InstitutionalFlowEngine;

  public static getInstance(): InstitutionalFlowEngine {
    if (!InstitutionalFlowEngine.instance) {
      InstitutionalFlowEngine.instance = new InstitutionalFlowEngine();
    }
    return InstitutionalFlowEngine.instance;
  }

  public analyze(sectors: SectorImpactData[], themes: MarketTheme[]): InstitutionalFlow {
    const bullishSectors = sectors.filter(s => s.sentiment === 'BULLISH').map(s => s.sector);
    const bearishSectors = sectors.filter(s => s.sentiment === 'BEARISH').map(s => s.sector);

    const isDefensiveLeading = bullishSectors.some(s => ['FMCG', 'Pharma', 'Utilities'].includes(s));
    const isCyclicalLeading = bullishSectors.some(s => ['Banking', 'Auto', 'Metals', 'Real Estate'].includes(s));
    const isTechLeading = bullishSectors.includes('IT');

    let regime: 'ACCUMULATION' | 'DISTRIBUTION' | 'RISK_OFF' | 'RISK_ON' | 'DEFENSIVE_ROTATION' | 'CYCLICAL_ROTATION' | 'SECTOR_ROTATION' | 'FLIGHT_TO_SAFETY' | 'HIGH_CONVICTION' | 'WEAK_CONVICTION' = 'ACCUMULATION';
    let reasoning = '';

    if (isCyclicalLeading && !isDefensiveLeading) {
      regime = 'CYCLICAL_ROTATION';
      reasoning = 'Institutional capital is actively rotating into high-beta cyclicals (Banking, Auto, Metals) supported by buoyant domestic credit expansion and firm corporate earnings trajectory.';
    } else if (isDefensiveLeading && !isCyclicalLeading) {
      regime = 'DEFENSIVE_ROTATION';
      reasoning = 'Capital flows indicate defensive repositioning into quality balance sheets (FMCG, Pharma) amidst heightened global macro uncertainty and valuation resistance.';
    } else if (bullishSectors.length > bearishSectors.length + 2) {
      regime = 'RISK_ON';
      reasoning = 'Broad-based accumulation across large-cap growth and sectoral leaders driven by strong institutional liquidity, stable rate expectations, and earnings upgrades.';
    } else if (bearishSectors.length > bullishSectors.length) {
      regime = 'RISK_OFF';
      reasoning = 'Risk-averse positioning evident as institutional participants trim momentum exposure and increase cash allocation or safe-haven holdings.';
    } else {
      regime = 'SECTOR_ROTATION';
      reasoning = 'Selective sector-specific re-rating under progress with institutional flows pivoting based on discrete quarterly earnings delivery and margin performance.';
    }

    return {
      regime,
      reasoning,
      favoredSectors: bullishSectors.length > 0 ? bullishSectors : ['Banking', 'IT'],
      outflowSectors: bearishSectors.length > 0 ? bearishSectors : ['Metals'],
      confidence: Math.min(96, 82 + bullishSectors.length * 3)
    };
  }
}
