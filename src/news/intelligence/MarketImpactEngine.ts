export type ExpectedMarketImpact = 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';

export interface MarketImpactResult {
  impact: ExpectedMarketImpact;
  newsSentiment: 'Bullish' | 'Bearish' | 'Neutral';
  reasoning: string;
  evidence: string[];
}

export class MarketImpactEngine {
  public static evaluate(title: string, body: string): MarketImpactResult {
    const text = `${title} ${body}`.toLowerCase();
    const evidence: string[] = [];

    // Check dilution / negative shareholder impact first despite positive headline wording
    if (text.includes('dilution') || text.includes('preferential allotment') || (text.includes('acquisition') && text.includes('debt-funded'))) {
      evidence.push('Equity dilution or heavy debt-funded expansion detected.');
      return {
        impact: 'NEGATIVE',
        newsSentiment: 'Neutral',
        reasoning: 'While corporate expansion/acquisition is reported, equity dilution or debt overhang poses negative immediate valuation risk to existing shareholders.',
        evidence,
      };
    }

    let posCount = 0;
    let negCount = 0;

    if (text.includes('profit up') || text.includes('beat') || text.includes('order win') || text.includes('growth') || text.includes('upgrade') || text.includes('rate cut')) {
      posCount++;
      evidence.push('Positive financial growth / order win / regulatory easing.');
    }

    if (text.includes('profit down') || text.includes('miss') || text.includes('loss') || text.includes('penalty') || text.includes('downgrade') || text.includes('resignation') || text.includes('fine')) {
      negCount++;
      evidence.push('Negative earnings / governance / regulatory penalty.');
    }

    if (posCount > 0 && negCount === 0) {
      return {
        impact: 'POSITIVE',
        newsSentiment: 'Bullish',
        reasoning: 'Positive operational metrics and earnings momentum expected to drive stock re-rating.',
        evidence,
      };
    }

    if (negCount > 0 && posCount === 0) {
      return {
        impact: 'NEGATIVE',
        newsSentiment: 'Bearish',
        reasoning: 'Earnings compression or regulatory headwinds likely to pressure stock price.',
        evidence,
      };
    }

    if (posCount > 0 && negCount > 0) {
      return {
        impact: 'MIXED',
        newsSentiment: 'Neutral',
        reasoning: 'Contradictory signals in news narrative (e.g. higher top-line growth offset by margin compression).',
        evidence,
      };
    }

    return {
      impact: 'NEUTRAL',
      newsSentiment: 'Neutral',
      reasoning: 'Routine corporate disclosure with minimal immediate market price impact.',
      evidence: ['Standard operational updates.'],
    };
  }
}
