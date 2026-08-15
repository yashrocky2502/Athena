export interface SourceConfidenceInfo {
  name: string;
  category: 'Filing' | 'Regulator' | 'IR' | 'Tier1_Global' | 'Tier1_Indian' | 'Tier2_Indian' | 'General';
  score: number;
}

export class SourcePriorityEngine {
  private static readonly SOURCE_SCORES: Record<string, SourceConfidenceInfo> = {
    'NSE Corporate Announcements': { name: 'NSE Corporate Announcements', category: 'Filing', score: 100 },
    'BSE Corporate Announcements': { name: 'BSE Corporate Announcements', category: 'Filing', score: 100 },
    'NSE': { name: 'NSE Corporate Announcements', category: 'Filing', score: 100 },
    'BSE': { name: 'BSE Corporate Announcements', category: 'Filing', score: 100 },
    'SEBI': { name: 'SEBI', category: 'Regulator', score: 100 },
    'RBI': { name: 'RBI', category: 'Regulator', score: 100 },
    'PIB': { name: 'PIB (Press Information Bureau)', category: 'Regulator', score: 99 },
    'Company IR': { name: 'Company Investor Relations', category: 'IR', score: 99 },
    'Reuters': { name: 'Reuters', category: 'Tier1_Global', score: 98 },
    'Reuters India': { name: 'Reuters India', category: 'Tier1_Global', score: 98 },
    'Bloomberg': { name: 'Bloomberg', category: 'Tier1_Global', score: 98 },
    'Bloomberg India': { name: 'Bloomberg India', category: 'Tier1_Global', score: 98 },
    'Financial Times': { name: 'Financial Times', category: 'Tier1_Global', score: 97 },
    'AP Business': { name: 'AP Business', category: 'Tier1_Global', score: 96 },
    'Economic Times': { name: 'Economic Times', category: 'Tier1_Indian', score: 95 },
    'ET': { name: 'Economic Times', category: 'Tier1_Indian', score: 95 },
    'Moneycontrol': { name: 'Moneycontrol', category: 'Tier1_Indian', score: 94 },
    'LiveMint': { name: 'LiveMint', category: 'Tier1_Indian', score: 94 },
    'Mint': { name: 'LiveMint', category: 'Tier1_Indian', score: 94 },
    'Business Standard': { name: 'Business Standard', category: 'Tier1_Indian', score: 93 },
    'Financial Express': { name: 'Financial Express', category: 'Tier1_Indian', score: 92 },
    'BusinessLine': { name: 'Hindu BusinessLine', category: 'Tier2_Indian', score: 91 },
    'Hindu BusinessLine': { name: 'Hindu BusinessLine', category: 'Tier2_Indian', score: 91 },
    'CNBC TV18': { name: 'CNBC TV18', category: 'Tier2_Indian', score: 90 },
    'CNBC': { name: 'CNBC TV18', category: 'Tier2_Indian', score: 90 },
    'Business Today': { name: 'Business Today', category: 'Tier2_Indian', score: 89 },
    'NDTV Profit': { name: 'NDTV Profit', category: 'Tier2_Indian', score: 89 },
    'Yahoo Finance': { name: 'Yahoo Finance', category: 'Tier2_Indian', score: 85 }
  };

  /**
   * Resolves publisher name and assigns institutional confidence score (0-100)
   */
  public static evaluateSource(publisherStr?: string, url?: string): { sourceName: string; confidenceScore: number; category: string } {
    if (!publisherStr && url) {
      publisherStr = this.extractDomainName(url);
    }
    const cleanStr = (publisherStr || 'Unknown Source').trim();

    // Direct lookup
    if (this.SOURCE_SCORES[cleanStr]) {
      const info = this.SOURCE_SCORES[cleanStr];
      return { sourceName: info.name, confidenceScore: info.score, category: info.category };
    }

    // Fuzzy matching against known sources
    const lower = cleanStr.toLowerCase();
    for (const [key, info] of Object.entries(this.SOURCE_SCORES)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        return { sourceName: info.name, confidenceScore: info.score, category: info.category };
      }
    }

    // Dynamic fallback evaluation based on publisher characteristics
    if (lower.includes('filing') || lower.includes('exchange') || lower.includes('disclosure')) {
      return { sourceName: cleanStr, confidenceScore: 100, category: 'Filing' };
    }
    if (lower.includes('official') || lower.includes('gov') || lower.includes('press')) {
      return { sourceName: cleanStr, confidenceScore: 95, category: 'Regulator' };
    }

    return { sourceName: cleanStr, confidenceScore: 60, category: 'General' };
  }

  private static extractDomainName(url: string): string {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace('www.', '');
      if (host.includes('reuters')) return 'Reuters';
      if (host.includes('bloomberg')) return 'Bloomberg';
      if (host.includes('economictimes') || host.includes('indiatimes')) return 'Economic Times';
      if (host.includes('moneycontrol')) return 'Moneycontrol';
      if (host.includes('livemint') || host.includes('mint')) return 'LiveMint';
      if (host.includes('business-standard')) return 'Business Standard';
      if (host.includes('financialexpress')) return 'Financial Express';
      if (host.includes('cnbctv18')) return 'CNBC TV18';
      if (host.includes('nseindia')) return 'NSE Corporate Announcements';
      if (host.includes('bseindia')) return 'BSE Corporate Announcements';
      return host;
    } catch {
      return 'Market Wire';
    }
  }
}
