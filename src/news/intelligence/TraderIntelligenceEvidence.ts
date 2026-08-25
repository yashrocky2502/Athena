import { EvidenceItem, EvidenceType } from './TraderIntelligenceTypes.ts';

export class TraderIntelligenceEvidence {
  /**
   * Evaluates the Tier of a publisher.
   * Tier 1: Official exchange, regulatory body, primary agency.
   * Tier 2: Highly reliable national financial media.
   * Tier 3: General media or regional/syndicated outlets.
   */
  public static evaluateSourceTier(publisher: string): 'TIER_1' | 'TIER_2' | 'TIER_3' {
    const p = publisher.toUpperCase();
    if (
      p.includes('NSE') ||
      p.includes('BSE') ||
      p.includes('SEBI') ||
      p.includes('RBI') ||
      p.includes('FSSAI') ||
      p.includes('MINISTRY OF FINANCE') ||
      p.includes('EXCHANGE FILING') ||
      p.includes('GOVERNMENT')
    ) {
      return 'TIER_1';
    }
    if (
      p.includes('REUTERS') ||
      p.includes('BLOOMBERG') ||
      p.includes('ECONOMIC TIMES') ||
      p.includes('ET ') ||
      p.includes('MINT') ||
      p.includes('BUSINESS STANDARD') ||
      p.includes('CNBC') ||
      p.includes('MONEYCONTROL')
    ) {
      return 'TIER_2';
    }
    return 'TIER_3';
  }

  /**
   * Helper to create a single evidence item.
   */
  public static createEvidenceItem(params: {
    id: string;
    source: string;
    sourceTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
    articleId?: string;
    eventId?: string;
    publishedAt?: string;
    evidenceText: string;
    evidenceType: EvidenceType;
    supportingFactIds?: string[];
  }): EvidenceItem {
    return {
      id: params.id,
      source: params.source,
      sourceTier: params.sourceTier,
      articleId: params.articleId,
      eventId: params.eventId,
      publishedAt: params.publishedAt,
      evidenceText: params.evidenceText,
      evidenceType: params.evidenceType,
      supportingFactIds: params.supportingFactIds
    };
  }

  /**
   * Scan text for explicit numerical values to construct numerical facts.
   */
  public static extractNumericalFacts(
    text: string,
    publisher: string,
    articleId: string,
    publishedAt?: string
  ): EvidenceItem[] {
    const facts: EvidenceItem[] = [];
    const sourceTier = this.evaluateSourceTier(publisher);

    // Regex for financial values: Rs. XXX crore, ₹XXX, USD XXX, XX.XX%
    const rupeePattern = /(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:crore|cr|million|mn|billion|bn|lakh)?/gi;
    const percentagePattern = /(\d+(?:\.\d+)?%)/gi;

    let match;
    let count = 0;

    // Search Rupees
    while ((match = rupeePattern.exec(text)) !== null && count < 5) {
      facts.push({
        id: `${articleId}-num-fact-${count++}`,
        source: publisher,
        sourceTier,
        articleId,
        publishedAt,
        evidenceText: `Financial value reported: ${match[0]}`,
        evidenceType: 'NUMERICAL_FACT'
      });
    }

    // Search Percentages
    while ((match = percentagePattern.exec(text)) !== null && count < 8) {
      facts.push({
        id: `${articleId}-pct-fact-${count++}`,
        source: publisher,
        sourceTier,
        articleId,
        publishedAt,
        evidenceText: `Percentage value reported: ${match[0]}`,
        evidenceType: 'NUMERICAL_FACT'
      });
    }

    return facts;
  }
}
