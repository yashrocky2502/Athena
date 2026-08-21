/**
 * ATHENA NEWS ENGINE — STAGE 8.4 SOURCE AUTHORITY RANKER
 * Deterministic source ranking into Tiers 1-4.
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
      url.includes('livemint') || url.includes('reuters')
    ) {
      return 2;
    }

    // Tier 3: Other Financial Publishers
    if (
      pub.includes('financial express') || pub.includes('zee business') || pub.includes('ndtv profit') ||
      pub.includes('business today') || pub.includes('fortune') || pub.includes('mint') ||
      pub.includes('cnbctv18') || pub.includes('businessline')
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
