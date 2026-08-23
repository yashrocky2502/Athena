/**
 * ATHENA NEWS ENGINE — STAGE 8.4 & 8.9.2 SOURCE AUTHORITY RANKER
 * Deterministic source ranking into Tiers 1-4 and Authoritative Publisher Resolution.
 */

export class SourceAuthorityRanker {
  private static instance: SourceAuthorityRanker;

  private constructor() {}

  public static getInstance(): SourceAuthorityRanker {
    if (!SourceAuthorityRanker.instance) {
      SourceAuthorityRanker.instance = new SourceAuthorityRanker();
    }
    return SourceAuthorityRanker.instance;
  }

  /**
   * Deterministically resolves the authoritative publisher name from source metadata, URL, and headline.
   * Priority:
   * 1. Explicit connector/source publisher or name (if not generic placeholder like "Athena Verified Source")
   * 2. Canonical domain extraction & mapping
   * 3. Headline/content publisher markers
   * 4. Safe fallback (never an AI-hallucinated publisher)
   */
  public getAuthoritativePublisher(source: any, sourceUrl?: string, headline?: string): string {
    const rawPub = typeof source === 'string' 
      ? source 
      : (source?.publisher || source?.name || '');
    const url = sourceUrl || (typeof source === 'object' ? source?.url || source?.sourceUrl : '') || '';

    // Check if rawPub is valid and not generic filler
    const isGenericPub = !rawPub || 
      rawPub.toLowerCase().includes('athena verified') || 
      rawPub.toLowerCase() === 'athena source' || 
      rawPub.toLowerCase() === 'verified source' ||
      rawPub.toLowerCase() === 'market source';

    // Canonical domain mapping table
    const urlLower = url.toLowerCase();
    if (urlLower.includes('cnbctv18.com') || urlLower.includes('cnbc-tv18')) return 'CNBC TV18';
    if (urlLower.includes('moneycontrol.com')) return 'Moneycontrol';
    if (urlLower.includes('economictimes.indiatimes.com') || urlLower.includes('economictimes')) return 'Economic Times';
    if (urlLower.includes('livemint.com') || urlLower.includes('mint')) return 'LiveMint';
    if (urlLower.includes('business-standard.com')) return 'Business Standard';
    if (urlLower.includes('reuters.com')) return 'Reuters';
    if (urlLower.includes('bloomberg.com')) return 'Bloomberg';
    if (urlLower.includes('financialexpress.com')) return 'Financial Express';
    if (urlLower.includes('ndtvprofit.com') || urlLower.includes('ndtv.com/profit')) return 'NDTV Profit';
    if (urlLower.includes('zeebiz.com')) return 'Zee Business';
    if (urlLower.includes('businesstoday.in')) return 'Business Today';
    if (urlLower.includes('thehindubusinessline.com') || urlLower.includes('thehindu.com/business')) return 'The Hindu BusinessLine';
    if (urlLower.includes('bseindia.com')) return 'BSE';
    if (urlLower.includes('nseindia.com')) return 'NSE';
    if (urlLower.includes('sebi.gov.in')) return 'SEBI';
    if (urlLower.includes('rbi.org.in')) return 'RBI';
    if (urlLower.includes('mcxindia.com')) return 'MCX';
    if (urlLower.includes('pib.gov.in')) return 'PIB';
    if (urlLower.includes('forexfactory.com')) return 'Forex Factory';

    if (!isGenericPub) {
      const pLower = rawPub.toLowerCase().trim();
      if (pLower.includes('cnbc') || pLower.includes('cnbctv18')) return 'CNBC TV18';
      if (pLower.includes('moneycontrol')) return 'Moneycontrol';
      if (pLower.includes('economic times') || pLower === 'et' || pLower.includes('economictimes')) return 'Economic Times';
      if (pLower.includes('livemint') || pLower === 'mint') return 'LiveMint';
      if (pLower.includes('business standard') || pLower === 'bs') return 'Business Standard';
      if (pLower.includes('reuters')) return 'Reuters';
      if (pLower.includes('bloomberg')) return 'Bloomberg';
      if (pLower.includes('bse')) return 'BSE';
      if (pLower.includes('nse')) return 'NSE';
      if (pLower.includes('sebi')) return 'SEBI';
      if (pLower.includes('rbi')) return 'RBI';
      if (pLower.includes('pib')) return 'PIB';
      if (pLower.includes('financial express')) return 'Financial Express';
      if (pLower.includes('zee business') || pLower.includes('zeebiz')) return 'Zee Business';
      if (pLower.includes('ndtv profit')) return 'NDTV Profit';
      if (pLower.includes('business today')) return 'Business Today';
      if (pLower.includes('hindu businessline') || pLower.includes('businessline')) return 'The Hindu BusinessLine';
      if (pLower.includes('forex factory')) return 'Forex Factory';
      return rawPub.trim();
    }

    // Try headline markers (e.g., "[Reuters] ...", "... - Moneycontrol", "... | CNBC TV18")
    if (headline) {
      if (/moneycontrol/i.test(headline)) return 'Moneycontrol';
      if (/cnbc\s*tv18|cnbc/i.test(headline)) return 'CNBC TV18';
      if (/economic\s*times|\bet\b/i.test(headline)) return 'Economic Times';
      if (/reuters/i.test(headline)) return 'Reuters';
      if (/livemint|\bmint\b/i.test(headline)) return 'LiveMint';
      if (/business\s*standard/i.test(headline)) return 'Business Standard';
      if (/bloomberg/i.test(headline)) return 'Bloomberg';
      if (/sebi/i.test(headline)) return 'SEBI';
      if (/rbi/i.test(headline)) return 'RBI';
      if (/bse/i.test(headline)) return 'BSE';
      if (/nse/i.test(headline)) return 'NSE';
    }

    return 'Market Wire';
  }

  /**
   * Validates a source URL for syntax, domain alignment, and publisher consistency.
   */
  public validateSourceUrl(url: string, expectedPublisher?: string): {
    isValid: boolean;
    domainMismatch: boolean;
    canonicalDomain?: string;
    issues?: string[];
  } {
    const issues: string[] = [];
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { isValid: false, domainMismatch: false, issues: ['URL is empty or missing'] };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return { isValid: false, domainMismatch: false, issues: ['Malformed URL syntax'] };
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      issues.push('Invalid URL protocol');
      return { isValid: false, domainMismatch: false, issues };
    }

    const domain = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    let domainMismatch = false;

    if (expectedPublisher) {
      const pubLower = expectedPublisher.toLowerCase();
      const domainMap: Record<string, string[]> = {
        'reuters': ['reuters.com'],
        'moneycontrol': ['moneycontrol.com'],
        'economic times': ['economictimes.indiatimes.com', 'indiatimes.com', 'economictimes.com'],
        'cnbc tv18': ['cnbctv18.com', 'cnbc.com'],
        'livemint': ['livemint.com', 'mint.com'],
        'business standard': ['business-standard.com'],
        'sebi': ['sebi.gov.in'],
        'rbi': ['rbi.org.in'],
        'nse': ['nseindia.com'],
        'bse': ['bseindia.com'],
        'pib': ['pib.gov.in'],
        'forex factory': ['forexfactory.com']
      };

      for (const [key, domains] of Object.entries(domainMap)) {
        if (pubLower.includes(key)) {
          if (!domains.some(d => domain.includes(d) || d.includes(domain))) {
            domainMismatch = true;
            issues.push(`Publisher '${expectedPublisher}' domain mismatch with URL host '${domain}'`);
          }
          break;
        }
      }
    }

    return {
      isValid: issues.length === 0,
      domainMismatch,
      canonicalDomain: domain,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  /**
   * Returns deterministic tier for a given publisher or domain.
   * Tier 1 — Official / Primary (SEBI, RBI, Exchanges, PIB, Investor Relations)
   * Tier 2 — High-quality financial wires & main media (Reuters, ET, BS, Moneycontrol, LiveMint, CNBC TV18)
   * Tier 3 — Other financial publishers
   * Tier 4 — Discovery / Secondary sources
   */
  public getTier(publisher: string, sourceUrl?: string): number {
    const pub = (publisher || '').toLowerCase();
    const url = (sourceUrl || '').toLowerCase();

    // Tier 1: Official / Primary
    if (
      pub.includes('sebi') || pub.includes('rbi') || pub.includes('nse') || pub.includes('bse') ||
      pub.includes('mcx') || pub.includes('pib') || pub.includes('government') ||
      pub.includes('filing') || pub.includes('investor relations') || pub.includes('exchange') ||
      url.includes('sebi.gov.in') || url.includes('rbi.org.in') || url.includes('nseindia.com') ||
      url.includes('bseindia.com') || url.includes('pib.gov.in')
    ) {
      return 1;
    }

    // Tier 2: High-Quality Financial Wires & Major Media
    if (
      pub.includes('reuters') || pub.includes('economic times') || pub.includes('business standard') ||
      pub.includes('cnbc') || pub.includes('moneycontrol') || pub.includes('livemint') ||
      pub.includes('bloomberg') || pub.includes('pti') || pub.includes('press trust') ||
      url.includes('economictimes') || url.includes('business-standard') || url.includes('moneycontrol') ||
      url.includes('livemint') || url.includes('reuters') || url.includes('cnbctv18')
    ) {
      return 2;
    }

    // Tier 3: Other Financial Publishers
    if (
      pub.includes('financial express') || pub.includes('zee business') || pub.includes('ndtv profit') ||
      pub.includes('business today') || pub.includes('fortune') || pub.includes('mint') ||
      pub.includes('businessline') || url.includes('financialexpress') || url.includes('zeebiz') ||
      url.includes('ndtvprofit') || url.includes('businesstoday')
    ) {
      return 3;
    }

    // Tier 4: Discovery / Secondary / Default
    return 4;
  }

  /**
   * Returns numeric authority score (0 to 100).
   */
  public getAuthorityScore(publisher: string, sourceUrl?: string): number {
    const tier = this.getTier(publisher, sourceUrl);
    switch (tier) {
      case 1: return 98;
      case 2: return 85;
      case 3: return 65;
      case 4: default: return 45;
    }
  }

  /**
   * Returns rank object with tier and score.
   */
  public rankSource(publisher: string, sourceUrl?: string): { tier: number; score: number } {
    const tier = this.getTier(publisher, sourceUrl);
    const score = this.getAuthorityScore(publisher, sourceUrl);
    return { tier, score };
  }

  /**
   * Returns true if publisherA outranks publisherB deterministically.
   */
  public outranks(publisherA: string, publisherB: string, urlA?: string, urlB?: string): boolean {
    const tierA = this.getTier(publisherA, urlA);
    const tierB = this.getTier(publisherB, urlB);
    return tierA < tierB;
  }
}

export const sourceAuthorityRanker = SourceAuthorityRanker.getInstance();

