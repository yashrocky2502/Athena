export type DirectionalBias = 'CE Bias' | 'PE Bias' | 'Neutral' | 'Mixed';
export type TimeHorizon = 'Short-term' | 'Medium-term' | 'Long-term';

export interface FOIntelligenceResult {
  isFOEligible: boolean;
  directionalBias: DirectionalBias;
  confidence: number; // 0 to 100
  timeHorizon: TimeHorizon;
  reasons: string[];
  disclaimer: string;
}

export class FOIntelligenceEngine {
  private static bullishKeywords = [
    'beat', 'beats', 'profit up', 'revenue up', 'surpassed', 'order win', 'bagged order',
    'upgrade', 'upgraded', 'rate cut', 'margin expansion', 'stake buy', 'dividend', 'buyback',
    'strong guidance', 'growth', 'all-time high', 'approval', 'clearance'
  ];

  private static bearishKeywords = [
    'miss', 'missed', 'profit down', 'loss', 'revenue down', 'margin compression',
    'downgrade', 'downgraded', 'rate hike', 'penalty', 'fine', 'investigation', 'resignation',
    'guidance cut', 'order cancellation', 'stake sale', 'dilution', 'fraud', 'default', 'litigation'
  ];

  public static analyze(
    title: string,
    body: string,
    isFOEligible: boolean = false,
    entitiesCount: number = 0
  ): FOIntelligenceResult {
    const text = `${title} ${body}`.toLowerCase();
    
    // Default disclaimer
    const disclaimer = 'INFORMATIONAL DIRECTIONAL ASSESSMENT ONLY. THIS IS NOT GUARANTEED TRADING OR INVESTMENT ADVICE.';

    if (!isFOEligible && entitiesCount > 0) {
      return {
        isFOEligible: false,
        directionalBias: 'Neutral',
        confidence: 70,
        timeHorizon: 'Short-term',
        reasons: ['Security is not listed under NSE F&O segment list.'],
        disclaimer,
      };
    }

    let bullPoints = 0;
    let bearPoints = 0;
    const reasons: string[] = [];

    for (const kw of this.bullishKeywords) {
      if (text.includes(kw)) {
        bullPoints++;
        reasons.push(`Bullish indicator observed: '${kw}'`);
      }
    }

    for (const kw of this.bearishKeywords) {
      if (text.includes(kw)) {
        bearPoints++;
        reasons.push(`Bearish indicator observed: '${kw}'`);
      }
    }

    let directionalBias: DirectionalBias = 'Neutral';
    let confidence = 75;

    if (bullPoints > 0 && bearPoints === 0) {
      directionalBias = 'CE Bias';
      confidence = Math.min(95, 75 + bullPoints * 5);
    } else if (bearPoints > 0 && bullPoints === 0) {
      directionalBias = 'PE Bias';
      confidence = Math.min(95, 75 + bearPoints * 5);
    } else if (bullPoints > 0 && bearPoints > 0) {
      directionalBias = 'Mixed';
      confidence = 70;
    } else {
      directionalBias = 'Neutral';
      reasons.push('Neutral impact: Balanced operational or corporate news flow.');
    }

    let timeHorizon: TimeHorizon = 'Short-term';
    if (text.includes('guidance') || text.includes('acquisition') || text.includes('merger') || text.includes('capex')) {
      timeHorizon = 'Medium-term';
    } else if (text.includes('strategy') || text.includes('restructuring') || text.includes('policy')) {
      timeHorizon = 'Long-term';
    }

    return {
      isFOEligible: isFOEligible || entitiesCount > 0,
      directionalBias,
      confidence,
      timeHorizon,
      reasons,
      disclaimer,
    };
  }
}
