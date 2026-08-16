export interface OptionSellingContextResult {
  expectedVolatilityImpact: 'High IV Expansion' | 'Moderate IV Crush Expected' | 'Low IV Impact' | 'IV Spike on Unannounced Event';
  eventRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  gapRisk: 'HIGH' | 'MODERATE' | 'LOW';
  expirySensitivity: 'High Expiry Sensitivity' | 'Moderate Expiry Sensitivity' | 'Low Expiry Sensitivity';
  directionalConfidence: number; // 0 to 100
  suitabilityForCaution: boolean;
  cautionNotes: string[];
  optionChainDataAvailable: boolean;
  optionChainStatus: string;
}

export class OptionSellingContext {
  public static evaluate(
    title: string,
    body: string,
    isFOEligible: boolean,
    directionalConfidence: number = 80
  ): OptionSellingContextResult {
    const text = `${title} ${body}`.toLowerCase();
    const cautionNotes: string[] = [];

    let eventRisk: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let gapRisk: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    let volImpact: 'High IV Expansion' | 'Moderate IV Crush Expected' | 'Low IV Impact' | 'IV Spike on Unannounced Event' = 'Low IV Impact';
    let expirySensitivity: 'High Expiry Sensitivity' | 'Moderate Expiry Sensitivity' | 'Low Expiry Sensitivity' = 'Low Expiry Sensitivity';

    if (text.includes('earnings') || text.includes('results') || text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4')) {
      eventRisk = 'HIGH';
      gapRisk = 'HIGH';
      volImpact = 'Moderate IV Crush Expected';
      expirySensitivity = 'High Expiry Sensitivity';
      cautionNotes.push('Scheduled Binary Event: High Vega risk prior to announcement, followed by rapid IV crush post-release.');
    } else if (text.includes('rbi') || text.includes('sebi') || text.includes('investigation') || text.includes('raid') || text.includes('resignation')) {
      eventRisk = 'HIGH';
      gapRisk = 'HIGH';
      volImpact = 'IV Spike on Unannounced Event';
      expirySensitivity = 'High Expiry Sensitivity';
      cautionNotes.push('Unannounced High-Impact Regulatory/Governance Event: Severe overnight gap risk for short options.');
    } else if (text.includes('order') || text.includes('contract') || text.includes('approval') || text.includes('dividend')) {
      eventRisk = 'MEDIUM';
      gapRisk = 'MODERATE';
      volImpact = 'High IV Expansion';
      expirySensitivity = 'Moderate Expiry Sensitivity';
      cautionNotes.push('Corporate Operational Event: Moderate delta risk on underlying price re-rating.');
    }

    const suitabilityForCaution = eventRisk === 'HIGH' || gapRisk === 'HIGH';

    return {
      expectedVolatilityImpact: volImpact,
      eventRisk,
      gapRisk,
      expirySensitivity,
      directionalConfidence,
      suitabilityForCaution,
      cautionNotes,
      optionChainDataAvailable: false,
      optionChainStatus: 'Live exchange option-chain metrics unavailable. Do not trade based on assumed implied volatility values.',
    };
  }
}
