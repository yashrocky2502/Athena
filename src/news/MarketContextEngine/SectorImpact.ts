import { SectorImpactBlock } from './MarketContextTypes';

export class SectorImpact {
  public static analyze(text: string, title: string, company?: string): SectorImpactBlock | undefined {
    const combined = `${title} ${text}`.toLowerCase();

    // 1. BEL / Defence
    if (combined.includes('bel') || combined.includes('bharat electronics') || combined.includes('defence') || (company && company.toLowerCase() === 'bel')) {
      return {
        sentiment: 'Positive',
        sector: 'Defence',
        explanation: 'Defence sector may benefit from higher execution visibility and robust order pipelines.'
      };
    }

    // 2. IT / TCS / Infosys / Wipro / Tech
    if (combined.includes('tcs') || combined.includes('infosys') || combined.includes('wipro') || combined.includes('hcltech') || combined.includes('it services')) {
      return {
        sentiment: 'Positive',
        sector: 'Technology & IT Services',
        explanation: 'Sustained deal wins and enterprise cloud demand support revenue visibility in the IT services sector.'
      };
    }

    // 3. Bank / HDFC / Banking
    if (combined.includes('bank') || combined.includes('hdfc') || combined.includes('icici') || combined.includes('axis') || combined.includes('kotak') || combined.includes('nii') || combined.includes('banking')) {
      return {
        sentiment: 'Positive',
        sector: 'Banking & Financial Services',
        explanation: 'Higher NII and robust credit expansion support banking sector earnings and credit quality.'
      };
    }

    // 4. Oil & Gas / Reliance / BPCL / ONGC
    if (combined.includes('oil') || combined.includes('crude') || combined.includes('reliance') || combined.includes('petrochemical') || combined.includes('bpcl') || combined.includes('ongc') || combined.includes('brent')) {
      return {
        sentiment: 'Neutral',
        sector: 'Oil & Gas',
        explanation: 'Crude volatility and refining margin fluctuations remain key risks for downstream and upstream players.'
      };
    }

    // 5. Metals / Commodities / Gold
    if (combined.includes('gold') || combined.includes('commodity') || combined.includes('silver') || combined.includes('metal')) {
      return {
        sentiment: 'Neutral',
        sector: 'Commodities',
        explanation: 'Macroeconomic uncertainties and safe-haven interest drive physical commodity price volatility.'
      };
    }

    // 6. Generic Fallback
    return {
      sentiment: 'Neutral',
      sector: 'Diversified',
      explanation: 'Stable operational performance and market dynamics support neutral sector outlook.'
    };
  }
}
