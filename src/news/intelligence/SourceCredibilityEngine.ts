export type SourceTier =
  | 'Official Regulatory'
  | 'Official Exchange'
  | 'Company Filing'
  | 'Major Financial Publication'
  | 'Financial Newswire'
  | 'Aggregated News'
  | 'Secondary Source'
  | 'Unknown';

export interface SourceCredibilityResult {
  tier: SourceTier;
  score: number; // 0 to 100
  isHighAuthority: boolean;
  publisherName: string;
}

export class SourceCredibilityEngine {
  private static officialRegulators = ['rbi', 'sebi', 'pib', 'pib india', 'ministry of finance', 'cci'];
  private static officialExchanges = ['nse', 'bse', 'nse india', 'bse india', 'mcx'];
  private static companyFilings = ['investor relations', 'bse filing', 'nse filing', 'exchange disclosure', 'corporate announcement'];
  private static majorPublications = ['reuters', 'bloomberg', 'economic times', 'moneycontrol', 'financial express', 'business standard', 'livemint', 'cnbc-tv18', 'zee business'];
  private static newswires = ['pti', 'press trust of india', 'ani', 'ians', 'dow jones', 'reuters newswire'];

  public static evaluate(publisherNameOrUrl: string = ''): SourceCredibilityResult {
    const name = (publisherNameOrUrl || '').toLowerCase().trim();

    if (this.officialRegulators.some(r => name.includes(r))) {
      return {
        tier: 'Official Regulatory',
        score: 100,
        isHighAuthority: true,
        publisherName: publisherNameOrUrl || 'Official Regulator',
      };
    }

    if (this.officialExchanges.some(e => name.includes(e))) {
      return {
        tier: 'Official Exchange',
        score: 95,
        isHighAuthority: true,
        publisherName: publisherNameOrUrl || 'Official Exchange',
      };
    }

    if (this.companyFilings.some(f => name.includes(f))) {
      return {
        tier: 'Company Filing',
        score: 90,
        isHighAuthority: true,
        publisherName: publisherNameOrUrl || 'Company Filing',
      };
    }

    if (this.majorPublications.some(p => name.includes(p))) {
      return {
        tier: 'Major Financial Publication',
        score: 85,
        isHighAuthority: true,
        publisherName: publisherNameOrUrl || 'Major Financial Publication',
      };
    }

    if (this.newswires.some(w => name.includes(w))) {
      return {
        tier: 'Financial Newswire',
        score: 80,
        isHighAuthority: true,
        publisherName: publisherNameOrUrl || 'Financial Newswire',
      };
    }

    if (name.includes('google news') || name.includes('yahoo') || name.includes('feed') || name.includes('aggregate')) {
      return {
        tier: 'Aggregated News',
        score: 65,
        isHighAuthority: false,
        publisherName: publisherNameOrUrl || 'Aggregated News',
      };
    }

    if (name.length > 0) {
      return {
        tier: 'Secondary Source',
        score: 60,
        isHighAuthority: false,
        publisherName: publisherNameOrUrl,
      };
    }

    return {
      tier: 'Unknown',
      score: 50,
      isHighAuthority: false,
      publisherName: 'Unknown Source',
    };
  }
}
