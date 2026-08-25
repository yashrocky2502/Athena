import { FnoIntelligenceData, EvidenceState, FnoEvidenceDetail } from './TraderIntelligenceTypes.ts';

export class FnoEvidenceEngine {
  private static FNO_KEYWORDS = [
    { type: 'OI_CHANGE' as const, regex: /(?:open interest|oi)\s+(?:surged|rose|dropped|fell|gained|lost|changed|up|down|buildup)\s+by?\s*(\d+(?:\.\d+)?%|\d+\s*lakh)/i },
    { type: 'PCR' as const, regex: /(?:put-call ratio|pcr)\s+(?:at|of|stood at|rose to|fell to)\s*(\d+(?:\.\d+)?)/i },
    { type: 'IV' as const, regex: /(?:implied volatility|iv)\s+(?:at|of|spiked|rose|fell|stood at)\s*(\d+(?:\.\d+)?%?)/i },
    { type: 'STRIKE' as const, regex: /(\d{4,5})\s*(?:strike|call|put|ce|pe)/i },
    { type: 'CALL_WRITING' as const, regex: /call\s+(?:writing|writers|unwinding|buildup)/i },
    { type: 'PUT_WRITING' as const, regex: /put\s+(?:writing|writers|unwinding|buildup)/i },
    { type: 'FUTURES_POSITIONING' as const, regex: /(?:futures|long buildup|short buildup|short covering|long unwinding)/i },
    { type: 'BASIS' as const, regex: /(?:basis|premium|discount)\s+of\s*(\d+(?:\.\d+)?\s*points?)/i }
  ];

  /**
   * Strictly analyze text for F&O Derivatives Evidence.
   */
  public static analyze(text: string, publisher: string): FnoIntelligenceData {
    const evidence: FnoEvidenceDetail[] = [];
    const lowerText = text.toLowerCase();

    for (const kw of this.FNO_KEYWORDS) {
      const match = text.match(kw.regex);
      if (match) {
        let val: string | number = match[1] || 'Detected';
        // Clean value
        if (typeof val === 'string') {
          val = val.trim();
        }
        evidence.push({
          type: kw.type,
          value: val,
          source: publisher
        });
      }
    }

    if (evidence.length === 0) {
      return {
        status: 'UNKNOWN',
        available: false,
        reason: 'NO_EXPLICIT_DERIVATIVES_EVIDENCE'
      };
    }

    // Since evidence exists, we derive options seller relevance and conditions
    const hasOI = evidence.some(e => e.type === 'OI_CHANGE' || e.type === 'OI');
    const hasIV = evidence.some(e => e.type === 'IV');
    const hasPCR = evidence.some(e => e.type === 'PCR');
    const strikes = evidence.filter(e => e.type === 'STRIKE').map(e => e.value);

    let optionsSellerRelevance = 'No options positioning recommended due to low evidence volume.';
    let volatilityContext = 'Implied Volatility (IV) levels unstated in source.';
    let callWriterEvidence = 'Call writing data unavailable.';
    let putWriterEvidence = 'Put writing data unavailable.';
    let supportResistanceEvidence = 'Technical boundary data unavailable.';
    let riskConditions = 'Standard market risk applies.';

    if (hasOI) {
      optionsSellerRelevance = 'Moderate to high options seller relevance. Scalp near key open interest concentrations.';
    }

    const ivDetail = evidence.find(e => e.type === 'IV');
    if (ivDetail) {
      volatilityContext = `Implied Volatility (IV) recorded at ${ivDetail.value}. Keep positions protected.`;
      riskConditions = 'Elevated Vega risk. Options sellers should look for premium collapse.';
    }

    const callDetail = evidence.find(e => e.type === 'CALL_WRITING');
    if (callDetail) {
      callWriterEvidence = 'Active call writing detected, creating overhead resistance.';
    }

    const putDetail = evidence.find(e => e.type === 'PUT_WRITING');
    if (putDetail) {
      putWriterEvidence = 'Active put writing detected, establishing short-term floor support.';
    }

    if (strikes.length > 0) {
      supportResistanceEvidence = `Strongest options boundary clustering observed around ${strikes.join(', ')} strikes.`;
    }

    return {
      status: 'VERIFIED',
      available: true,
      evidence,
      optionsSellerRelevance,
      volatilityContext,
      callWriterEvidence,
      putWriterEvidence,
      supportResistanceEvidence,
      riskConditions
    };
  }
}
